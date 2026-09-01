const path = require("path");
const {
	createReferenceRepositoryPort,
} = require("../application/ports/referenceRepository");

function getSpellRecords(data) {
	return Array.isArray(data)
		? data
		: data?.spell || data?.spells || data?.results || [];
}

function createFileReferenceRepository(storage) {
	const databaseDir = path.join(__dirname, "..", "..", "..", "..", "database");
	return createReferenceRepositoryPort({
		readSpellAggregate: async () => {
			const filePath = path.join(storage.SPELLS_DIR, "all.json");
			if (!(await storage.exists(filePath))) return { exists: false, spells: [] };
			return {
				exists: true,
				spells: getSpellRecords(await storage.readJson(filePath)),
			};
		},
		readSpellIndex: async () => {
			const filePath = path.join(storage.SPELLS_DIR, "index.json");
			return (await storage.exists(filePath))
				? storage.readJson(filePath)
				: null;
		},
		readSpellFile: async (fileName) => {
			const safeName = path.basename(String(fileName || ""));
			const filePath = path.join(storage.SPELLS_DIR, safeName);
			if (!(await storage.exists(filePath))) return [];
			return getSpellRecords(await storage.readJson(filePath));
		},
		readReferenceFile: async (fileName) => {
			const safeName = path.basename(String(fileName || ""));
			const filePath = path.join(databaseDir, safeName);
			return (await storage.exists(filePath))
				? storage.readJson(filePath)
				: null;
		},
	});
}

module.exports = { createFileReferenceRepository, getSpellRecords };
