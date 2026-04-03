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

		const entries = await require("fs/promises").readdir(storage.BESTIARY_DIR, { withFileTypes: true });
		const files = entries.filter((e) => e.isFile() && e.name.endsWith(".json")).map((e) => e.name);

		let results = [];
		for (const file of files) {
			const sourceName = path.parse(file).name;
			const data = await storage.readJson(path.join(storage.BESTIARY_DIR, file));
			const monsters = Array.isArray(data) ? data : (data.monster || data.monsters || data.results || []);
			results.push(...monsters.filter(m => (nameQuery ? m.name?.toLowerCase().includes(nameQuery) : true) && (typeQuery ? m.type?.toLowerCase().includes(typeQuery) : true)).map(m => ({ ...m, source: m.source || sourceName })));
		}
		res.json(results);
	} catch (error) { next(error); }
});

router.get("/sources", async (req, res, next) => {
	try {
		if (!(await storage.exists(storage.BESTIARY_DIR))) return res.json([]);
		const entries = await require("fs/promises").readdir(storage.BESTIARY_DIR, { withFileTypes: true });
		res.json(entries.filter((e) => e.isFile() && e.name.endsWith(".json") && e.name !== "legendarygroups.json").map((e) => path.parse(e.name).name));
	} catch (error) { next(error); }
});

router.get("/legendarygroups", async (req, res, next) => {
	try {
		const filePath = path.join(storage.BESTIARY_DIR, "legendarygroups.json");
		res.json((await storage.exists(filePath)) ? (await storage.readJson(filePath)).legendaryGroup || [] : []);
	} catch (error) { next(error); }
});

router.get("/:source", async (req, res, next) => {
	try {
		const filePath = path.join(storage.BESTIARY_DIR, `${path.basename(req.params.source)}.json`);
		if (!(await storage.exists(filePath))) return res.status(404).json({ error: "Джерело не знайдено." });
		const data = await storage.readJson(filePath);
		const list = Array.isArray(data) ? data : (data.monster || data.monsters || data.results || []);
		res.json(list.map(m => ({ ...m, source: m.source || path.parse(filePath).name })));
	} catch (error) { next(error); }
});

module.exports = router;