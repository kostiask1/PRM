const express = require("express");
const router = express.Router();
const path = require("path");
const storage = require("../storage");

router.get("/search", async (req, res, next) => {
	try {
		const { name, type } = req.query;
		const nameQuery = name?.toLowerCase() || "";
		const typeQuery = type?.toLowerCase() || "";
		if (!(await storage.exists(storage.BESTIARY_DIR))) return res.json([]);

		const index = await storage.getBestiaryIndex();
		const results = [];

		for (const monster of index.values()) {
			const resolved = storage.resolveMonster(monster, index);

			const matchesName = nameQuery
				? resolved.name?.toLowerCase().includes(nameQuery)
				: true;
			const matchesType = typeQuery
				? JSON.stringify(resolved.type || "")
						.toLowerCase()
						.includes(typeQuery)
				: true;

			if (matchesName && matchesType) {
				results.push(resolved);
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
		res.json(favorites.map(f => ({ ...f, source: f.source?.toUpperCase() })));
	} catch (error) {
		next(error);
	}
});

router.post("/favorites/toggle", async (req, res, next) => {
	try {
		const { name, source } = req.body;
		const normalizedSource = source?.toUpperCase();
		
		let favorites = await storage.readFavorites();
		const index = favorites.findIndex(f => f.name === name && f.source?.toUpperCase() === normalizedSource);
		
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
		res.json(
			(await storage.exists(filePath))
				? (await storage.readJson(filePath)).legendaryGroup || []
				: [],
		);
	} catch (error) {
		next(error);
	}
});

router.get("/:source", async (req, res, next) => {
	try {
		const sourceParam = req.params.source;
		let filePath = path.join(
			storage.BESTIARY_DIR,
			`${path.basename(sourceParam)}.json`,
		);

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

		if (!(await storage.exists(filePath)))
			return res.status(404).json({ error: "Джерело не знайдено." });
		const data = await storage.readJson(filePath);
		const monsters = Array.isArray(data)
			? data
			: data.monster || data.monsters || data.results || [];

		const index = await storage.getBestiaryIndex();
		const resolvedList = monsters.map((m) =>
			storage.resolveMonster(
				{
					...m,
					source:
						(m.source || path.parse(filePath).name.replace(/^bestiary-/i, "")).toUpperCase(),
				},
				index,
			),
		);

		res.json(resolvedList);
	} catch (error) {
		next(error);
	}
});

module.exports = router;
