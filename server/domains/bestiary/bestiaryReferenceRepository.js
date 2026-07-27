const fs = require("fs/promises");
const path = require("path");
const {
	exists,
	readJson,
} = require("../../infrastructure/jsonFileStore");
const { BESTIARY_DIR } = require("../../infrastructure/storagePaths");

function normalizeSource(source) {
	return String(source || "")
		.trim()
		.toUpperCase();
}

function getMonsterRecords(data) {
	return Array.isArray(data)
		? data
		: data?.monster || data?.monsters || data?.results || [];
}

function addMonstersToIndex(index, monsters, fallbackSource = "") {
	for (const monster of monsters) {
		if (!monster?.name) continue;
		const source = normalizeSource(monster.source || fallbackSource);
		const key = `${monster.name.trim().toLowerCase()}|${source}`;
		index.set(key, { ...monster, source });
	}
}

function createBestiaryReferenceRepository(overrides = {}) {
	const dependencies = {
		bestiaryDir: BESTIARY_DIR,
		exists,
		readDir: fs.readdir,
		readJson,
		...overrides,
	};

	function bestiaryPath(fileName) {
		return path.join(dependencies.bestiaryDir, fileName);
	}

	async function listDataFiles() {
		if (!(await dependencies.exists(dependencies.bestiaryDir))) return [];
		const entries = await dependencies.readDir(dependencies.bestiaryDir, {
			withFileTypes: true,
		});
		return entries.filter((entry) => {
			const name = entry.name.toLowerCase();
			return (
				entry.isFile() &&
				name.endsWith(".json") &&
				name !== "all.json" &&
				name !== "index.json" &&
				name !== "legendarygroups.json"
			);
		});
	}

	async function readAllMonsters() {
		const allPath = bestiaryPath("all.json");
		if (!(await dependencies.exists(allPath))) return [];
		const data = await dependencies.readJson(allPath);
		return getMonsterRecords(data).map((monster) => ({
			...monster,
			source: normalizeSource(monster.source),
		}));
	}

	async function buildMonsterIndex() {
		const index = new Map();
		const allPath = bestiaryPath("all.json");
		if (await dependencies.exists(allPath)) {
			addMonstersToIndex(
				index,
				getMonsterRecords(await dependencies.readJson(allPath)),
			);
			return index;
		}

		for (const file of await listDataFiles()) {
			const data = await dependencies.readJson(bestiaryPath(file.name));
			const source =
				data?._meta?.sources?.[0]?.json ||
				path.parse(file.name).name.replace(/^bestiary-/i, "");
			addMonstersToIndex(index, getMonsterRecords(data), source);
		}
		return index;
	}

	async function listSources() {
		const allPath = bestiaryPath("all.json");
		if (await dependencies.exists(allPath)) {
			const data = await dependencies.readJson(allPath);
			return [
				...new Set(
					getMonsterRecords(data)
						.map((monster) => monster.source)
						.filter(Boolean),
				),
			].sort((a, b) => a.localeCompare(b));
		}
		const files = await listDataFiles();
		return files.map((file) =>
			path.parse(file.name).name.replace(/^bestiary-/i, ""),
		);
	}

	async function readLegendaryGroups() {
		const filePath = bestiaryPath("legendarygroups.json");
		if (!(await dependencies.exists(filePath))) return [];
		const data = await dependencies.readJson(filePath);
		return Array.isArray(data?.legendaryGroup) ? data.legendaryGroup : [];
	}

	async function getMonstersBySource(sourceValue) {
		const sourceParam = String(sourceValue);
		if (sourceParam.toLowerCase() === "all") return readAllMonsters();

		const safeSource = path.basename(sourceParam);
		let filePath = bestiaryPath(`${safeSource}.json`);
		if (!(await dependencies.exists(filePath))) {
			const prefixedPath = bestiaryPath(`bestiary-${safeSource}.json`);
			if (await dependencies.exists(prefixedPath)) filePath = prefixedPath;
		}

		if (await dependencies.exists(filePath)) {
			const data = await dependencies.readJson(filePath);
			const fallbackSource = path
				.parse(filePath)
				.name.replace(/^bestiary-/i, "");
			return getMonsterRecords(data).map((monster) => ({
				...monster,
				source: normalizeSource(monster.source || fallbackSource),
			}));
		}

		const allPath = bestiaryPath("all.json");
		if (!(await dependencies.exists(allPath))) return null;
		const source = normalizeSource(sourceParam);
		return getMonsterRecords(await dependencies.readJson(allPath))
			.filter((monster) => normalizeSource(monster.source) === source)
			.map((monster) => ({
				...monster,
				source: normalizeSource(monster.source),
			}));
	}

	return {
		buildMonsterIndex,
		getMonstersBySource,
		listSources,
		readAllMonsters,
		readLegendaryGroups,
	};
}

const bestiaryReferenceRepository = createBestiaryReferenceRepository();

module.exports = {
	...bestiaryReferenceRepository,
	addMonstersToIndex,
	createBestiaryReferenceRepository,
	getMonsterRecords,
	normalizeSource,
};
