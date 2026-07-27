const path = require("path");
const {
	exists,
	readJson,
} = require("../../infrastructure/jsonFileStore");
const {
	ROOT_DIR,
	SPELLS_DIR,
} = require("../../infrastructure/storagePaths");

function getSourcePriority(source) {
	const normalized = String(source || "").toUpperCase();
	if (normalized === "XPHB" || normalized === "XDMG") return 3;
	if (normalized === "PHB" || normalized === "DMG") return 2;
	return 1;
}

function pickPreferredRecord(current, candidate) {
	if (!current) return candidate;
	const currentPriority = getSourcePriority(current.source);
	const candidatePriority = getSourcePriority(candidate.source);
	if (candidatePriority !== currentPriority) {
		return candidatePriority > currentPriority ? candidate : current;
	}
	return current;
}

function getSpellRecords(data) {
	return Array.isArray(data)
		? data
		: data?.spell || data?.spells || data?.results || [];
}

function matchesSpellSearch(spell, { nameQuery, level, schoolQuery }) {
	return (
		(nameQuery ? spell.name?.toLowerCase().includes(nameQuery) : true) &&
		(level !== undefined ? String(spell.level) === String(level) : true) &&
		(schoolQuery ? spell.school?.toLowerCase() === schoolQuery : true)
	);
}

function normalizeNamedReferenceRecords(items, kind, extraFields) {
	const byName = new Map();

	for (const item of Array.isArray(items) ? items : []) {
		const name = String(item?.name || "").trim();
		if (!name) continue;
		const key = name.toLowerCase();
		const normalized = {
			name,
			kind: item?.kind || kind,
			source: item?.source || null,
			page: item?.page || null,
			...(extraFields ? extraFields(item) : {}),
			entries: item?.entries || [],
		};
		byName.set(key, pickPreferredRecord(byName.get(key), normalized));
	}

	return Array.from(byName.values()).sort((a, b) =>
		a.name.localeCompare(b.name),
	);
}

function createReferenceDataRepository(overrides = {}) {
	const dependencies = {
		databaseDir: path.join(ROOT_DIR, "database"),
		exists,
		readJson,
		spellsDir: SPELLS_DIR,
		...overrides,
	};

	function spellsPath(fileName) {
		return path.join(dependencies.spellsDir, fileName);
	}

	function databasePath(fileName) {
		return path.join(dependencies.databaseDir, fileName);
	}

	async function readSpellIndex() {
		const indexPath = spellsPath("index.json");
		if (!(await dependencies.exists(indexPath))) return null;
		return dependencies.readJson(indexPath);
	}

	async function searchSpells({ name = "", level, school = "" } = {}) {
		if (!(await dependencies.exists(dependencies.spellsDir))) return [];

		const search = {
			nameQuery: String(name || "").toLowerCase(),
			level,
			schoolQuery: String(school || "").toLowerCase(),
		};
		const allPath = spellsPath("all.json");
		if (await dependencies.exists(allPath)) {
			const data = await dependencies.readJson(allPath);
			return getSpellRecords(data).filter((spell) =>
				matchesSpellSearch(spell, search),
			);
		}

		const index = await readSpellIndex();
		if (!index) return [];
		const results = [];
		for (const [source, fileName] of Object.entries(index)) {
			const data = await dependencies.readJson(spellsPath(fileName));
			results.push(
				...getSpellRecords(data)
					.filter((spell) => matchesSpellSearch(spell, search))
					.map((spell) => ({ ...spell, source })),
			);
		}
		return results;
	}

	async function listSpellSources() {
		const allPath = spellsPath("all.json");
		if (await dependencies.exists(allPath)) {
			const data = await dependencies.readJson(allPath);
			return [
				...new Set(
					getSpellRecords(data)
						.map((spell) => spell.source)
						.filter(Boolean),
				),
			].sort((a, b) => a.localeCompare(b));
		}

		const index = await readSpellIndex();
		return index ? Object.keys(index) : [];
	}

	async function getSpellsBySource(sourceValue) {
		const sourceParam = String(sourceValue);
		const allPath = spellsPath("all.json");
		if (await dependencies.exists(allPath)) {
			const data = await dependencies.readJson(allPath);
			const spells = getSpellRecords(data);
			if (sourceParam.toLowerCase() === "all") return spells;
			const source = sourceParam.toUpperCase();
			return spells.filter(
				(spell) => spell.source?.toUpperCase() === source,
			);
		}

		const index = await dependencies.readJson(spellsPath("index.json"));
		const fileName = index[sourceParam];
		if (!fileName) return null;
		const data = await dependencies.readJson(spellsPath(fileName));
		return getSpellRecords(data).map((spell) => ({
			...spell,
			source: sourceParam,
		}));
	}

	async function readNamedReferenceRecords(
		fileName,
		listKey,
		kind,
		extraFields,
	) {
		const filePath = databasePath(fileName);
		if (!(await dependencies.exists(filePath))) return [];
		const data = await dependencies.readJson(filePath);
		return normalizeNamedReferenceRecords(
			Array.isArray(data?.[listKey]) ? data[listKey] : [],
			kind,
			extraFields,
		);
	}

	async function listConditions() {
		const filePath = databasePath("conditions.json");
		if (!(await dependencies.exists(filePath))) return [];
		const data = await dependencies.readJson(filePath);
		const conditions = Array.isArray(data?.condition) ? data.condition : [];
		const statuses = Array.isArray(data?.status) ? data.status : [];
		return normalizeNamedReferenceRecords(
			[
				...conditions.map((item) => ({ ...item, kind: "condition" })),
				...statuses.map((item) => ({ ...item, kind: "status" })),
			],
			"condition",
		);
	}

	async function listDiseases() {
		const diseasesPath = databasePath("diseases.json");
		const conditionsPath = databasePath("conditions.json");
		const hasDiseases = await dependencies.exists(diseasesPath);
		if (!hasDiseases && !(await dependencies.exists(conditionsPath))) return [];
		const data = await dependencies.readJson(
			hasDiseases ? diseasesPath : conditionsPath,
		);
		return normalizeNamedReferenceRecords(
			Array.isArray(data?.disease) ? data.disease : [],
			"disease",
			(item) => ({ type: item?.type || null }),
		);
	}

	return {
		getSpellsBySource,
		listConditions,
		listDiseases,
		listSenses: () =>
			readNamedReferenceRecords("senses.json", "sense", "sense"),
		listSkills: () =>
			readNamedReferenceRecords(
				"skills.json",
				"skill",
				"skill",
				(item) => ({ ability: item?.ability || null }),
			),
		listSpellSources,
		listVariantRules: () =>
			readNamedReferenceRecords(
				"variantrules.json",
				"variantrule",
				"variantrule",
				(item) => ({ ruleType: item?.ruleType || null }),
			),
		searchSpells,
	};
}

const referenceDataRepository = createReferenceDataRepository();

module.exports = {
	...referenceDataRepository,
	createReferenceDataRepository,
	getSpellRecords,
	normalizeNamedReferenceRecords,
};
