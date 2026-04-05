const express = require("express");
const router = express.Router();
const path = require("path");
const storage = require("../storage");

router.get("/search", async (req, res, next) => {
	try {
		const { name, level, school } = req.query;
		const nameQuery = name?.toLowerCase() || "";
		const schoolQuery = school?.toLowerCase() || "";
		if (!(await storage.exists(storage.SPELLS_DIR))) return res.json([]);

		const indexPath = path.join(storage.SPELLS_DIR, "index.json");
		if (!(await storage.exists(indexPath))) return res.json([]);

		const index = await storage.readJson(indexPath);
		let results = [];
		for (const [sourceKey, fileName] of Object.entries(index)) {
			const data = await storage.readJson(
				path.join(storage.SPELLS_DIR, fileName),
			);
			const spells = Array.isArray(data)
				? data
				: data.spell || data.spells || data.results || [];
			results.push(
				...spells
					.filter(
						(s) =>
							(nameQuery ? s.name?.toLowerCase().includes(nameQuery) : true) &&
							(level !== undefined
								? String(s.level) === String(level)
								: true) &&
							(schoolQuery ? s.school?.toLowerCase() === schoolQuery : true),
					)
					.map((s) => ({ ...s, source: sourceKey })),
			);
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

router.get("/sources", async (req, res, next) => {
	try {
		const indexPath = path.join(storage.SPELLS_DIR, "index.json");
		if (!(await storage.exists(indexPath))) return res.json([]);
		const index = await storage.readJson(indexPath);
		res.json(Object.keys(index));
	} catch (error) {
		next(error);
	}
});

router.get("/:source", async (req, res, next) => {
	try {
		const indexPath = path.join(storage.SPELLS_DIR, "index.json");
		const index = await storage.readJson(indexPath);
		const fileName = index[req.params.source];
		if (!fileName)
			return res.status(404).json({ error: "Джерело не знайдено." });
		const data = await storage.readJson(
			path.join(storage.SPELLS_DIR, fileName),
		);
		const list = Array.isArray(data)
			? data
			: data.spell || data.spells || data.results || [];
		res.json(list.map((s) => ({ ...s, source: req.params.source })));
	} catch (error) {
		next(error);
	}
});

module.exports = router;
