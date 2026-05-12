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
		if (!(await storage.exists(storage.BESTIARY_DIR))) return res.json([]);

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

router.get("/sources", async (req, res, next) => {
	try {
		if (!(await storage.exists(storage.BESTIARY_DIR))) return res.json([]);
		const allPath = path.join(storage.BESTIARY_DIR, "all.json");
		if (await storage.exists(allPath)) {
			const data = await storage.readJson(allPath);
			const monsters = Array.isArray(data)
				? data
				: data.monster || data.monsters || data.results || [];
			const sources = [
				...new Set(monsters.map((m) => m.source).filter(Boolean)),
			].sort((a, b) => a.localeCompare(b));
			return res.json(sources);
		}

		const entries = await require("fs/promises").readdir(storage.BESTIARY_DIR, {
			withFileTypes: true,
		});
		res.json(
			entries
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
		let filePath =
			String(sourceParam).toLowerCase() === "all"
				? path.join(storage.BESTIARY_DIR, "all.json")
				: path.join(storage.BESTIARY_DIR, `${path.basename(sourceParam)}.json`);

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
			const source = String(sourceParam).toUpperCase();
			const allMonsters = Array.isArray(allData)
				? allData
				: allData.monster || allData.monsters || allData.results || [];
			return res.json(
				allMonsters.filter((m) => m.source?.toUpperCase() === source),
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
