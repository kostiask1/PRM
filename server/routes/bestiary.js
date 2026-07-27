const express = require("express");
const router = express.Router();
const path = require("path");
const storage = require("../storage");
const { sortByNameQuery } = require("./searchUtils");
const {
	applyArrayMod,
	clone,
	normalizeCustomMonsterHpAverage,
	toArray,
} = require("../../shared/bestiaryUtils.cjs");

function normalizeSource(source) {
	return String(source || "")
		.trim()
		.toUpperCase();
}

const CUSTOM_SOURCE = storage.CUSTOM_BESTIARY_SOURCE || "CUSTOM";

function monsterNameKey(monster) {
	return String(monster?.name || "")
		.trim()
		.toLowerCase();
}

function monsterId(monster) {
	return String(monster?.id || "").trim();
}

function findCustomMonsterIndex(monsters, identifier) {
	const target = String(identifier || "").trim();
	if (!target) return -1;
	const targetKey = target.toLowerCase();
	const idIndex = monsters.findIndex((monster) => monsterId(monster) === target);
	if (idIndex >= 0) return idIndex;
	return monsters.findIndex(
		(monster) => monsterNameKey(monster) === targetKey,
	);
}

function buildReplacementCustomMonster(previousMonster, rawMonster) {
	const nextMonster = clone(rawMonster);
	const nextName = String(nextMonster.name || "").trim();
	nextMonster.name = nextName;
	nextMonster.source = CUSTOM_SOURCE;
	if (!Object.prototype.hasOwnProperty.call(nextMonster, "imageUrl")) {
		nextMonster.imageUrl = previousMonster?.imageUrl || null;
	}
	return nextMonster;
}

async function readCustomMonsterTarget(identifier, res) {
	const targetIdentifier = String(identifier || "").trim();
	if (!targetIdentifier) {
		res.status(400).json({ error: "Creature name is required." });
		return null;
	}

	const monsters = await storage.readCustomBestiaryMonsters();
	const index = findCustomMonsterIndex(monsters, targetIdentifier);
	if (index < 0) {
		res.status(404).json({ error: "Custom creature not found." });
		return null;
	}

	return { monsters, index };
}

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
	res.set(
		"Cache-Control",
		"no-store, no-cache, must-revalidate, proxy-revalidate",
	);
	res.set("Pragma", "no-cache");
	res.set("Expires", "0");
	res.set("Surrogate-Control", "no-store");
}

function groupKey(name, source) {
	return `${String(name || "")
		.trim()
		.toLowerCase()}|${normalizeSource(source)}`;
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
		throw new Error(
			`Circular legendary group _copy chain: ${[...stack, currentKey].join(" -> ")}`,
		);
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

		sortByNameQuery(results, nameQuery);

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
		const target = await readCustomMonsterTarget(req.params.name, res);
		if (!target) return;
		const { monsters, index } = target;
		const previousNameKey = monsterNameKey(monsters[index]);
		const previousId = monsterId(monsters[index]);

		if (req.body?.monster && typeof req.body.monster === "object") {
			const nextMonster = buildReplacementCustomMonster(
				monsters[index],
				req.body.monster,
			);
			const nextName = String(nextMonster.name || "").trim();
			if (!nextName) {
				return res.status(400).json({ error: "Creature name is required." });
			}
			const nextNameKey = nextName.toLowerCase();
			const duplicate = monsters.some(
				(monster, monsterIndex) =>
					monsterIndex !== index && monsterNameKey(monster) === nextNameKey,
			);
			if (duplicate) {
				return res.status(409).json({
					error: "Custom creature with this name already exists.",
				});
			}
			monsters[index] = normalizeCustomMonsterHpAverage(nextMonster);
			const updated = await storage.writeCustomBestiaryMonsters(monsters);

			if (nextNameKey !== previousNameKey) {
				const favorites = await storage.readFavorites();
				const nextFavorites = favorites.map((favorite) =>
					String(favorite.name || "")
						.trim()
						.toLowerCase() === previousNameKey &&
					normalizeSource(favorite.source) === CUSTOM_SOURCE
						? { ...favorite, name: nextName, source: CUSTOM_SOURCE }
						: favorite,
				);
				await storage.writeFavorites(nextFavorites);
			}

			return res.json(
				updated.find(
					(monster) => monsterNameKey(monster) === nextNameKey,
				) || nextMonster,
			);
		}

		const imageUrl =
			req.body?.imageUrl === null
				? null
				: String(req.body?.imageUrl || "").trim();
		monsters[index] = {
			...monsters[index],
			imageUrl: imageUrl || null,
		};
		const updated = await storage.writeCustomBestiaryMonsters(monsters);
		res.json(
			updated.find(
				(monster) =>
					(previousId && monsterId(monster) === previousId) ||
					monsterNameKey(monster) === previousNameKey,
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
		const target = await readCustomMonsterTarget(req.params.name, res);
		if (!target) return;
		const { monsters, index } = target;
		const targetName = monsterNameKey(monsters[index]);
		const nextMonsters = monsters.filter(
			(monster, monsterIndex) => monsterIndex !== index,
		);

		const updated = await storage.writeCustomBestiaryMonsters(nextMonsters);
		const favorites = await storage.readFavorites();
		const nextFavorites = favorites.filter(
			(favorite) =>
				!(
					String(favorite.name || "")
						.trim()
						.toLowerCase() === targetName &&
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
		if (!(await storage.exists(storage.BESTIARY_DIR)))
			return res.json(customSources);

		const entries = await require("fs/promises").readdir(storage.BESTIARY_DIR, {
			withFileTypes: true,
		});
		res.json([
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
		]);
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

		let filePath = path.join(
			storage.BESTIARY_DIR,
			`${path.basename(sourceParam)}.json`,
		);

		if (!(await storage.exists(filePath))) {
			// Try the bestiary- prefix when the direct path is not found.
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
				return res.status(404).json({ error: "Source not found." });

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

Object.defineProperty(router, "__test", {
	value: {
		buildReplacementCustomMonster,
	},
});

module.exports = router;
