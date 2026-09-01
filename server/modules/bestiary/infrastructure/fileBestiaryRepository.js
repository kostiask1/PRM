const {
	createBestiaryRepositoryPort,
} = require("../application/ports/bestiaryRepository");
const fs = require("fs/promises");
const path = require("path");

function extractMonsters(data) {
	return Array.isArray(data)
		? data
		: data?.monster || data?.monsters || data?.results || [];
}

function createFileBestiaryRepository(storage) {
	return createBestiaryRepositoryPort({
		getIndex: () => storage.getBestiaryIndex(),
		readCustomMonsters: () => storage.readCustomBestiaryMonsters(),
		writeCustomMonsters: (monsters) =>
			storage.writeCustomBestiaryMonsters(monsters),
		readFavorites: () => storage.readFavorites(),
		writeFavorites: (favorites) => storage.writeFavorites(favorites),
		readAllMonsters: async () => {
			const filePath = path.join(storage.BESTIARY_DIR, "all.json");
			if (!(await storage.exists(filePath))) return { exists: false, monsters: [] };
			return {
				exists: true,
				monsters: extractMonsters(await storage.readJson(filePath)),
			};
		},
		listSourceFiles: async () => {
			if (!(await storage.exists(storage.BESTIARY_DIR))) return [];
			const entries = await fs.readdir(storage.BESTIARY_DIR, {
				withFileTypes: true,
			});
			return entries
				.filter((entry) => {
					const name = entry.name.toLowerCase();
					return (
						entry.isFile() &&
						name.endsWith(".json") &&
						!["all.json", "legendarygroups.json", "index.json"].includes(name)
					);
				})
				.map((entry) =>
					path.parse(entry.name).name.replace(/^bestiary-/i, ""),
				);
		},
		readLegendaryGroups: async () => {
			const filePath = path.join(storage.BESTIARY_DIR, "legendarygroups.json");
			if (!(await storage.exists(filePath))) return [];
			return (await storage.readJson(filePath)).legendaryGroup || [];
		},
		readSourceMonsters: async (source) => {
			const safeSource = path.basename(String(source || ""));
			const candidates = [
				path.join(storage.BESTIARY_DIR, `${safeSource}.json`),
				path.join(storage.BESTIARY_DIR, `bestiary-${safeSource}.json`),
			];
			for (const filePath of candidates) {
				if (!(await storage.exists(filePath))) continue;
				return {
					fileSource: path.parse(filePath).name.replace(/^bestiary-/i, ""),
					monsters: extractMonsters(await storage.readJson(filePath)),
				};
			}
			return null;
		},
	});
}

module.exports = { createFileBestiaryRepository };
