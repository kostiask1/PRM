const express = require("express");
const router = express.Router();
const path = require("path");
const storage = require("../storage");
const fs = require("fs/promises");

/**
 * Створює індекс усіх монстрів для швидкого пошуку баз для копіювання
 */
async function getBestiaryIndex() {
	if (!(await storage.exists(storage.BESTIARY_DIR))) return new Map();

	const entries = await fs.readdir(storage.BESTIARY_DIR, { withFileTypes: true });
	const files = entries.filter((e) => e.isFile() && e.name.endsWith(".json") && e.name !== "legendarygroups.json");

	const index = new Map();
	for (const file of files) {
		const data = await storage.readJson(path.join(storage.BESTIARY_DIR, file.name));
		
		// Визначаємо основне джерело файлу з метаданих або назви файлу
		let fileSource = (data._meta?.sources?.[0]?.json || path.parse(file.name).name).toUpperCase();
		
		const monsters = Array.isArray(data) ? data : (data.monster || data.monsters || data.results || []);
		
		for (const m of monsters) {
			if (!m.name) continue;
			const monsterSource = (m.source || fileSource).toUpperCase();
			const key = `${m.name.trim().toLowerCase()}|${monsterSource}`;
			index.set(key, { ...m, source: monsterSource });
		}
	}
	return index;
}

/**
 * Рекурсивно розгортає дані монстра, якщо він є копією (_copy)
 */
function resolveMonster(monster, index, depth = 0) {
	if (depth > 10 || !monster._copy) return monster;

	const baseName = monster._copy.name;
	const baseSource = (monster._copy.source || monster.source || "").toUpperCase();
	const baseKey = `${baseName.toLowerCase()}|${baseSource}`;
	
	let base = index.get(baseKey);
	if (!base) {
		// Спробуємо знайти базу в будь-якому джерелі, якщо точний збіг не знайдено
		const keys = Array.from(index.keys());
		const foundKey = keys.find(k => k.startsWith(`${baseName.toLowerCase()}|`));
		if (foundKey) base = index.get(foundKey);
	}

	if (!base) return monster;

	// Рекурсивно розгортаємо базу, якщо вона теж копія
	const resolvedBase = resolveMonster(JSON.parse(JSON.stringify(base)), index, depth + 1);

	// Результат починається з розгорнутої бази
	let resolved = { ...resolvedBase };

	// Накладаємо властивості поточного монстра поверх бази (крім службових)
	for (const key in monster) {
		if (key !== "_copy" && key !== "_mod") {
			resolved[key] = monster[key];
		}
	}

	// Застосовуємо модифікатори _mod
	if (monster._copy._mod) {
		const mods = monster._copy._mod;
		
		// Обробляємо "*" (глобальна заміна тексту)
		if (mods["*"]) {
			const globalMods = Array.isArray(mods["*"]) ? mods["*"] : [mods["*"]];
			globalMods.forEach(mod => {
				if (mod.mode === "replaceTxt") {
					resolved = applyReplaceTxt(resolved, mod);
				}
			});
		}

		// Обробляємо специфічні поля (trait, action, і т.д.)
		for (const prop in mods) {
			if (prop === "*") continue;
			const propMods = Array.isArray(mods[prop]) ? mods[prop] : [mods[prop]];
			
			propMods.forEach(mod => {
				if (!resolved[prop]) resolved[prop] = [];
				
				if (mod.mode === "appendArr") {
					const items = Array.isArray(mod.items) ? mod.items : [mod.items];
					resolved[prop] = [...resolved[prop], ...items];
				} 
				else if (mod.mode === "prependArr") {
					const items = Array.isArray(mod.items) ? mod.items : [mod.items];
					resolved[prop] = [...items, ...resolved[prop]];
				}
				else if (mod.mode === "replaceArr") {
					const items = Array.isArray(mod.items) ? mod.items : [mod.items];
					const toReplace = mod.replace;
					resolved[prop] = resolved[prop].map(item => 
						(item.name === toReplace) ? items[0] : item
					);
				}
				else if (mod.mode === "removeArr") {
					const toRemove = Array.isArray(mod.names) ? mod.names : [mod.names];
					resolved[prop] = resolved[prop].filter(item => !toRemove.includes(item.name));
				}
			});
		}
	}

	return resolved;
}

function applyReplaceTxt(obj, mod) {
	try {
		const escapedReplace = mod.replace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		let json = JSON.stringify(obj);
		const regex = new RegExp(escapedReplace, mod.flags || "g");
		json = json.replace(regex, mod.with);
		return JSON.parse(json);
	} catch (e) {
		return obj;
	}
}

router.get("/search", async (req, res, next) => {
	try {
		const { name, type } = req.query;
		const nameQuery = name?.toLowerCase() || "";
		const typeQuery = type?.toLowerCase() || "";
		if (!(await storage.exists(storage.BESTIARY_DIR))) return res.json([]);

		const index = await getBestiaryIndex();
		const results = [];

		for (const monster of index.values()) {
			const resolved = resolveMonster(monster, index);
			
			const matchesName = nameQuery ? resolved.name?.toLowerCase().includes(nameQuery) : true;
			const matchesType = typeQuery ? JSON.stringify(resolved.type || "").toLowerCase().includes(typeQuery) : true;

			if (matchesName && matchesType) {
				results.push(resolved);
			}
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
		const monsters = Array.isArray(data) ? data : (data.monster || data.monsters || data.results || []);
		
		const index = await getBestiaryIndex();
		const resolvedList = monsters.map(m => resolveMonster({ ...m, source: m.source || path.parse(filePath).name }, index));
		
		res.json(resolvedList);
	} catch (error) { next(error); }
});

module.exports = router;