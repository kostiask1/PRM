const express = require("express");
const router = express.Router();
const path = require("path");
const storage = require("../storage");

function clone(value) {
	return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeSource(source) {
	return String(source || "").trim().toUpperCase();
}

const CUSTOM_SOURCE = storage.CUSTOM_BESTIARY_SOURCE || "CUSTOM";

async function readAllDatabaseMonsters() {
	const allPath = path.join(storage.BESTIARY_DIR, "all.json");
	if (!(await storage.exists(allPath))) return [];
	const data = await storage.readJson(allPath);
	const monsters = Array.isArray(data)
		? data
		: data.monster || data.monsters || data.results || [];
	return monsters.map((monster) => ({
		...monster,
		source: normalizeSource(monster.source),
	}));
}

async function readCustomMonsters() {
	const data = await storage.readCustomBestiary();
	return (Array.isArray(data.monster) ? data.monster : []).map((monster) => ({
		...monster,
		source: CUSTOM_SOURCE,
	}));
}

function disableResponseCache(res) {
	res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
	res.set("Pragma", "no-cache");
	res.set("Expires", "0");
	res.set("Surrogate-Control", "no-store");
}

function groupKey(name, source) {
	return `${String(name || "").trim().toLowerCase()}|${normalizeSource(source)}`;
}

function toArray(value) {
	if (value === undefined || value === null) return [];
	return Array.isArray(value) ? value : [value];
}

function entryName(value) {
	if (value && typeof value === "object") {
		return value.name || value.id || value.title || "";
	}
	return value;
}

function matchesEntry(value, expected) {
	return String(entryName(value)).toLowerCase() === String(expected).toLowerCase();
}

function ensureArray(target, prop) {
	if (!Array.isArray(target[prop])) target[prop] = [];
	return target[prop];
}

function appendUnique(targetList, items) {
	const seen = new Set(targetList.map((item) => JSON.stringify(item)));
	for (const item of items) {
		const key = JSON.stringify(item);
		if (seen.has(key)) continue;
		targetList.push(item);
		seen.add(key);
	}
}

function calculateDiceFormulaAverage(input) {
	const clean = String(input || "")
		.toLowerCase()
		.replace(/\s+/g, "");
	if (!clean) return null;

	const parts = clean.replace(/-/g, "+-").split("+").filter(Boolean);
	if (parts.length === 0) return null;

	let average = 0;
	for (const part of parts) {
		const dieMatch = part.match(/^(\d+)?d(\d+)([hl]\d+)?$/i);
		if (dieMatch) {
			const count = Number.parseInt(dieMatch[1], 10) || 1;
			const sides = Number.parseInt(dieMatch[2], 10);
			const keepSuffix = dieMatch[3];
			if (!Number.isFinite(count) || !Number.isFinite(sides) || sides < 1) {
				return null;
			}
			const keepCount = keepSuffix
				? Math.min(Number.parseInt(keepSuffix.slice(1), 10), count)
				: count;
			if (!Number.isFinite(keepCount) || keepCount < 0) return null;
			average += keepCount * ((sides + 1) / 2);
			continue;
		}

		if (/^[+-]?\d+$/.test(part)) {
			average += Number.parseInt(part, 10);
			continue;
		}

		return null;
	}

	return Math.max(1, Math.floor(average));
}

function normalizeCustomMonsterHpAverage(monster) {
	if (!monster || typeof monster !== "object") return monster;
	if (!monster.hp || typeof monster.hp !== "object" || Array.isArray(monster.hp)) {
		return monster;
	}
	const average = calculateDiceFormulaAverage(monster.hp.formula);
	if (average === null) return monster;
	return {
		...monster,
		hp: {
			...monster.hp,
			average,
		},
	};
}

function applyArrayMod(target, prop, mod) {
	const list = ensureArray(target, prop);
	const items = clone(toArray(mod.items));

	if (mod.mode === "appendArr") {
		list.push(...items);
		return;
	}
	if (mod.mode === "prependArr") {
		list.unshift(...items);
		return;
	}
	if (mod.mode === "appendIfNotExistsArr") {
		appendUnique(list, items);
		return;
	}
	if (mod.mode === "insertArr") {
		const index = Math.max(0, Math.min(Number(mod.index) || 0, list.length));
		list.splice(index, 0, ...items);
		return;
	}
	if (mod.mode === "replaceArr") {
		const next = [];
		for (const entry of list) {
			if (matchesEntry(entry, mod.replace)) next.push(...items);
			else next.push(entry);
		}
		target[prop] = next;
		return;
	}
	if (mod.mode === "removeArr") {
		const names = toArray(mod.names ?? mod.items);
		target[prop] = list.filter(
			(entry) => !names.some((name) => matchesEntry(entry, name)),
		);
	}
}

function applyLegendaryGroupMods(target, mods) {
	if (!mods || typeof mods !== "object") return;
	for (const [prop, rawMods] of Object.entries(mods)) {
		for (const mod of toArray(rawMods)) {
			if (mod === "remove") {
				delete target[prop];
				continue;
			}
			if (!mod || typeof mod !== "object") continue;

			switch (mod.mode) {
				case "appendArr":
				case "prependArr":
				case "appendIfNotExistsArr":
				case "insertArr":
				case "replaceArr":
				case "removeArr":
					applyArrayMod(target, prop, mod);
					break;
				case "setProp":
					target[mod.prop] = clone(mod.value);
					break;
				default:
					break;
			}
		}
	}
}

function resolveLegendaryGroup(group, index, stack = []) {
	const source = normalizeSource(group.source);
	const currentKey = groupKey(group.name, source);

	if (stack.includes(currentKey)) {
		throw new Error(`Circular legendary group _copy chain: ${[...stack, currentKey].join(" -> ")}`);
	}

	if (!group._copy) {
		return {
			...clone(group),
			source: group.source || source,
		};
	}

	const copySource = normalizeSource(group._copy.source || group.source);
	const base = index.get(groupKey(group._copy.name, copySource));
	if (!base) {
		throw new Error(
			`Base legendary group not found for ${group.name} (${source}): ${group._copy.name}`,
		);
	}

	const resolved = resolveLegendaryGroup(base, index, [...stack, currentKey]);
	for (const [key, value] of Object.entries(group)) {
		if (key === "_copy" || key === "_mod") continue;
		resolved[key] = clone(value);
	}

	applyLegendaryGroupMods(resolved, group._copy._mod);
	delete resolved._copy;
	delete resolved._mod;
	return resolved;
}

function resolveLegendaryGroups(groups) {
	const index = new Map();
	for (const group of groups) {
		if (!group?.name) continue;
		index.set(groupKey(group.name, group.source), group);
	}
	return groups.map((group) => resolveLegendaryGroup(group, index));
}

router.get("/search", async (req, res, next) => {
	try {
		const { name, type } = req.query;
		const nameQuery = name?.toLowerCase() || "";
		const typeQuery = type?.toLowerCase() || "";

		const index = await storage.getBestiaryIndex();
		const results = [];

		for (const monster of index.values()) {
			const matchesName = nameQuery
				? monster.name?.toLowerCase().includes(nameQuery)
				: true;
			const matchesType = typeQuery
				? JSON.stringify(monster.type || "")
						.toLowerCase()
						.includes(typeQuery)
				: true;

			if (matchesName && matchesType) {
				results.push(monster);
			}
		}

		if (nameQuery) {
			results.sort((a, b) => {
				const nA = a.name?.toLowerCase() || "";
				const nB = b.name?.toLowerCase() || "";

				if (nA === nameQuery && nB !== nameQuery) return -1;
				if (nB === nameQuery && nA !== nameQuery) return 1;

				const startsA = nA.startsWith(nameQuery);
				const startsB = nB.startsWith(nameQuery);
				if (startsA && !startsB) return -1;
				if (startsB && !startsA) return 1;

				if (nA.length !== nB.length) return nA.length - nB.length;
				return nA.localeCompare(nB);
			});
		}

		res.json(results);
	} catch (error) {
		next(error);
	}
});

router.get("/favorites", async (req, res, next) => {
	try {
		const favorites = await storage.readFavorites();
		res.json(favorites.map((f) => ({ ...f, source: f.source?.toUpperCase() })));
	} catch (error) {
		next(error);
	}
});

router.post("/favorites/toggle", async (req, res, next) => {
	try {
		const { name, source } = req.body;
		const normalizedSource = source?.toUpperCase();

		let favorites = await storage.readFavorites();
		const index = favorites.findIndex(
			(f) => f.name === name && f.source?.toUpperCase() === normalizedSource,
		);

		if (index > -1) {
			favorites.splice(index, 1);
		} else {
			favorites.push({ name, source: normalizedSource });
		}

		await storage.writeFavorites(favorites);
		res.json(favorites);
	} catch (error) {
		next(error);
	}
});

router.patch("/custom/:name", async (req, res, next) => {
	try {
		disableResponseCache(res);
		const targetName = String(req.params.name || "").trim().toLowerCase();
		if (!targetName) {
			return res.status(400).json({ error: "Назва істоти обов'язкова." });
		}

		const monsters = await storage.readCustomBestiaryMonsters();
		const index = monsters.findIndex(
			(monster) => String(monster.name || "").trim().toLowerCase() === targetName,
		);
		if (index < 0) {
			return res.status(404).json({ error: "Кастомну істоту не знайдено." });
		}

		if (req.body?.monster && typeof req.body.monster === "object") {
			const nextMonster = clone(req.body.monster);
			const nextName = String(nextMonster.name || "").trim();
			if (!nextName) {
				return res.status(400).json({ error: "Назва істоти обов'язкова." });
			}
			const nextNameKey = nextName.toLowerCase();
			const duplicate = monsters.some(
				(monster, monsterIndex) =>
					monsterIndex !== index &&
					String(monster.name || "").trim().toLowerCase() === nextNameKey,
			);
			if (duplicate) {
				return res.status(409).json({
					error: "Кастомна істота з такою назвою вже існує.",
				});
			}

			nextMonster.name = nextName;
			nextMonster.source = CUSTOM_SOURCE;
			monsters[index] = normalizeCustomMonsterHpAverage(nextMonster);
			const updated = await storage.writeCustomBestiaryMonsters(monsters);

			if (nextNameKey !== targetName) {
				const favorites = await storage.readFavorites();
				const nextFavorites = favorites.map((favorite) =>
					String(favorite.name || "").trim().toLowerCase() === targetName &&
					normalizeSource(favorite.source) === CUSTOM_SOURCE
						? { ...favorite, name: nextName, source: CUSTOM_SOURCE }
						: favorite,
				);
				await storage.writeFavorites(nextFavorites);
			}

			return res.json(
				updated.find(
					(monster) =>
						String(monster.name || "").trim().toLowerCase() === nextNameKey,
				) || nextMonster,
			);
		}

		const imageUrl =
			req.body?.imageUrl === null ? null : String(req.body?.imageUrl || "").trim();
		monsters[index] = {
			...monsters[index],
			imageUrl: imageUrl || null,
		};
		const updated = await storage.writeCustomBestiaryMonsters(monsters);
		res.json(
			updated.find(
				(monster) =>
					String(monster.name || "").trim().toLowerCase() === targetName,
			) || monsters[index],
		);
	} catch (error) {
		next(error);
	}
});

router.put("/custom", async (req, res, next) => {
	try {
		disableResponseCache(res);
		const monsters = Array.isArray(req.body?.monsters) ? req.body.monsters : [];
		const normalized = monsters
			.filter((monster) => monster && typeof monster === "object")
			.map((monster) => ({
				...monster,
				name: String(monster.name || "").trim(),
				source: CUSTOM_SOURCE,
			}))
			.filter((monster) => monster.name);
		const updated = await storage.writeCustomBestiaryMonsters(normalized);
		res.json(updated);
	} catch (error) {
		next(error);
	}
});

router.delete("/custom/:name", async (req, res, next) => {
	try {
		disableResponseCache(res);
		const targetName = String(req.params.name || "").trim().toLowerCase();
		if (!targetName) {
			return res.status(400).json({ error: "Назва істоти обов'язкова." });
		}

		const monsters = await storage.readCustomBestiaryMonsters();
		const nextMonsters = monsters.filter(
			(monster) => String(monster.name || "").trim().toLowerCase() !== targetName,
		);
		if (nextMonsters.length === monsters.length) {
			return res.status(404).json({ error: "Кастомну істоту не знайдено." });
		}

		const updated = await storage.writeCustomBestiaryMonsters(nextMonsters);
		const favorites = await storage.readFavorites();
		const nextFavorites = favorites.filter(
			(favorite) =>
				!(
					String(favorite.name || "").trim().toLowerCase() === targetName &&
					normalizeSource(favorite.source) === CUSTOM_SOURCE
				),
		);
		if (nextFavorites.length !== favorites.length) {
			await storage.writeFavorites(nextFavorites);
		}

		res.json(updated);
	} catch (error) {
		next(error);
	}
});

router.get("/sources", async (req, res, next) => {
	try {
		const allPath = path.join(storage.BESTIARY_DIR, "all.json");
		const customSources = [CUSTOM_SOURCE];
		if (await storage.exists(allPath)) {
			const data = await storage.readJson(allPath);
			const monsters = Array.isArray(data)
				? data
				: data.monster || data.monsters || data.results || [];
			const sources = [
				...new Set([
					...monsters.map((m) => m.source).filter(Boolean),
					...customSources,
				]),
			].sort((a, b) => a.localeCompare(b));
			return res.json(sources);
		}
		if (!(await storage.exists(storage.BESTIARY_DIR))) return res.json(customSources);

		const entries = await require("fs/promises").readdir(storage.BESTIARY_DIR, {
			withFileTypes: true,
		});
		res.json(
			[
				...new Set([
					...entries
						.filter((e) => {
							const name = e.name.toLowerCase();
							return (
								e.isFile() &&
								name.endsWith(".json") &&
								name !== "all.json" &&
								name !== "legendarygroups.json" &&
								name !== "index.json"
							);
						})
						.map((e) => path.parse(e.name).name.replace(/^bestiary-/i, "")),
					...customSources,
				]),
			],
		);
	} catch (error) {
		next(error);
	}
});

router.get("/legendarygroups", async (req, res, next) => {
	try {
		const filePath = path.join(storage.BESTIARY_DIR, "legendarygroups.json");
		if (!(await storage.exists(filePath))) return res.json([]);

		const groups = (await storage.readJson(filePath)).legendaryGroup || [];
		res.json(resolveLegendaryGroups(groups));
	} catch (error) {
		next(error);
	}
});

router.get("/:source", async (req, res, next) => {
	try {
		const sourceParam = req.params.source;
		const normalizedSource = normalizeSource(sourceParam);
		const customMonsters = await readCustomMonsters();

		if (String(sourceParam).toLowerCase() === "all") {
			return res.json(await readAllDatabaseMonsters());
		}

		if (normalizedSource === CUSTOM_SOURCE) {
			disableResponseCache(res);
			return res.json(customMonsters);
		}

		let filePath =
			path.join(storage.BESTIARY_DIR, `${path.basename(sourceParam)}.json`);

		if (!(await storage.exists(filePath))) {
			// Спробуємо знайти файл з префіксом bestiary-, якщо прямий шлях не знайдено
			const prefixedPath = path.join(
				storage.BESTIARY_DIR,
				`bestiary-${path.basename(sourceParam)}.json`,
			);
			if (await storage.exists(prefixedPath)) {
				filePath = prefixedPath;
			}
		}

		if (!(await storage.exists(filePath))) {
			const allPath = path.join(storage.BESTIARY_DIR, "all.json");
			if (!(await storage.exists(allPath)))
				return res.status(404).json({ error: "Джерело не знайдено." });

			const allData = await storage.readJson(allPath);
			const allMonsters = Array.isArray(allData)
				? allData
				: allData.monster || allData.monsters || allData.results || [];
			return res.json(
				allMonsters
					.filter((m) => m.source?.toUpperCase() === normalizedSource)
					.map((monster) => ({
						...monster,
						source: normalizeSource(monster.source),
					})),
			);
		}

		const data = await storage.readJson(filePath);
		const monsters = Array.isArray(data)
			? data
			: data.monster || data.monsters || data.results || [];

		const fileSource = path.parse(filePath).name.replace(/^bestiary-/i, "");
		const resolvedList = monsters.map((m) => ({
			...m,
			source: (m.source || fileSource).toUpperCase(),
		}));

		res.json(resolvedList);
	} catch (error) {
		next(error);
	}
});

module.exports = router;
