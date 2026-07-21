const { sortByNameQuery } = require("../../../routes/searchUtils");

const SOURCE_PRIORITIES = new Map([
	["XPHB", 3],
	["XDMG", 3],
	["PHB", 2],
	["DMG", 2],
]);

function getSourcePriority(source) {
	return SOURCE_PRIORITIES.get(String(source || "").toUpperCase()) || 1;
}

function pickPreferredRecord(current, candidate) {
	if (!current) return candidate;
	return getSourcePriority(candidate.source) > getSourcePriority(current.source)
		? candidate
		: current;
}

function getReferenceItems(items) {
	return Array.isArray(items) ? items : [];
}

function getReferenceName(item) {
	return String(item?.name || "").trim();
}

function getExtraReferenceFields(item, extraFields) {
	return extraFields ? extraFields(item) : {};
}

function getTruthyReferenceField(item, key, fallback) {
	return item?.[key] || fallback;
}

function projectNamedReferenceRecord(item, name, kind, extraFields) {
	return {
		name,
		kind: getTruthyReferenceField(item, "kind", kind),
		source: getTruthyReferenceField(item, "source", null),
		page: getTruthyReferenceField(item, "page", null),
		...getExtraReferenceFields(item, extraFields),
		entries: getTruthyReferenceField(item, "entries", []),
	};
}

function addNamedReferenceRecord(byName, item, kind, extraFields) {
	const name = getReferenceName(item);
	if (!name) return;
	const candidate = projectNamedReferenceRecord(item, name, kind, extraFields);
	const key = name.toLowerCase();
	byName.set(key, pickPreferredRecord(byName.get(key), candidate));
}

function compareReferenceNames(left, right) {
	return left.name.localeCompare(right.name);
}

function normalizeNamedReferenceRecords(items, kind, extraFields) {
	const byName = new Map();
	for (const item of getReferenceItems(items)) {
		addNamedReferenceRecord(byName, item, kind, extraFields);
	}
	return Array.from(byName.values()).sort(compareReferenceNames);
}

function matchesSpellName(spell, nameQuery) {
	return nameQuery ? spell.name?.toLowerCase().includes(nameQuery) : true;
}

function matchesSpellLevel(spell, level) {
	return level !== undefined ? String(spell.level) === String(level) : true;
}

function matchesSpellSchool(spell, schoolQuery) {
	return schoolQuery ? spell.school?.toLowerCase() === schoolQuery : true;
}

function matchesSpellSearch(spell, criteria) {
	return [
		matchesSpellName(spell, criteria.nameQuery),
		matchesSpellLevel(spell, criteria.level),
		matchesSpellSchool(spell, criteria.schoolQuery),
	].every(Boolean);
}

function createSpellSearchCriteria(name, level, school) {
	return {
		nameQuery: String(name).toLowerCase(),
		level,
		schoolQuery: String(school).toLowerCase(),
	};
}

async function readIndexedSpellEntry(repository, [source, fileName]) {
	const spells = await repository.readSpellFile(fileName);
	return spells.map((spell) => ({ ...spell, source }));
}

async function readIndexedSpells(repository) {
	const index = await repository.readSpellIndex();
	if (!index) return [];
	const lists = await Promise.all(
		Object.entries(index).map((entry) =>
			readIndexedSpellEntry(repository, entry),
		),
	);
	return lists.flat();
}

async function getSearchableSpells(repository, aggregate) {
	return aggregate.exists ? aggregate.spells : readIndexedSpells(repository);
}

async function searchSpells(repository, { name = "", level, school = "" }) {
	const criteria = createSpellSearchCriteria(name, level, school);
	const aggregate = await repository.readSpellAggregate();
	const spells = await getSearchableSpells(repository, aggregate);
	const results = spells.filter((spell) => matchesSpellSearch(spell, criteria));
	sortByNameQuery(results, criteria.nameQuery);
	return results;
}

function projectAggregateSpellSources(spells) {
	return [...new Set(spells.map((spell) => spell.source).filter(Boolean))].sort(
		(left, right) => left.localeCompare(right),
	);
}

async function listSpellSources(repository) {
	const aggregate = await repository.readSpellAggregate();
	if (aggregate.exists) return projectAggregateSpellSources(aggregate.spells);
	return Object.keys((await repository.readSpellIndex()) || {});
}

async function readNamedReferences(
	repository,
	fileName,
	listKey,
	kind,
	extraFields,
) {
	const data = await repository.readReferenceFile(fileName);
	return normalizeNamedReferenceRecords(data?.[listKey], kind, extraFields);
}

function getReferenceCollection(data, key) {
	return data?.[key] || [];
}

function tagReferenceKind(items, kind) {
	return items.map((item) => ({ ...item, kind }));
}

function getConditionReferenceItems(data) {
	return [
		...tagReferenceKind(getReferenceCollection(data, "condition"), "condition"),
		...tagReferenceKind(getReferenceCollection(data, "status"), "status"),
	];
}

async function listConditions(repository) {
	const data = await repository.readReferenceFile("conditions.json");
	return normalizeNamedReferenceRecords(
		getConditionReferenceItems(data),
		"condition",
	);
}

async function readDiseaseReferenceData(repository) {
	const diseases = await repository.readReferenceFile("diseases.json");
	return diseases || repository.readReferenceFile("conditions.json");
}

function projectDiseaseFields(item) {
	return { type: item?.type || null };
}

async function listDiseases(repository) {
	const data = await readDiseaseReferenceData(repository);
	return normalizeNamedReferenceRecords(
		data?.disease,
		"disease",
		projectDiseaseFields,
	);
}

function projectVariantRuleFields(item) {
	return { ruleType: item?.ruleType || null };
}

function projectSkillFields(item) {
	return { ability: item?.ability || null };
}

function matchesSpellSource(spell, normalizedSource) {
	return String(spell.source || "").toUpperCase() === normalizedSource;
}

function getAggregateSpellSource(spells, source) {
	const sourceText = String(source);
	if (sourceText.toLowerCase() === "all") return spells;
	const normalizedSource = sourceText.toUpperCase();
	return spells.filter((spell) => matchesSpellSource(spell, normalizedSource));
}

function createSourceNotFoundError() {
	const error = new Error("Source not found.");
	error.status = 404;
	return error;
}

async function readIndexedSpellSource(repository, source) {
	const index = (await repository.readSpellIndex()) || {};
	const fileName = index[source];
	if (!fileName) throw createSourceNotFoundError();
	const spells = await repository.readSpellFile(fileName);
	return spells.map((spell) => ({ ...spell, source }));
}

async function getSpellSource(repository, { source }) {
	const aggregate = await repository.readSpellAggregate();
	return aggregate.exists
		? getAggregateSpellSource(aggregate.spells, source)
		: readIndexedSpellSource(repository, source);
}

function createReferenceCommands(repository) {
	return {
		searchSpells: (query) => searchSpells(repository, query),
		listSpellSources: () => listSpellSources(repository),
		listConditions: () => listConditions(repository),
		listDiseases: () => listDiseases(repository),
		listVariantRules: () =>
			readNamedReferences(
				repository,
				"variantrules.json",
				"variantrule",
				"variantrule",
				projectVariantRuleFields,
			),
		listSkills: () =>
			readNamedReferences(
				repository,
				"skills.json",
				"skill",
				"skill",
				projectSkillFields,
			),
		listSenses: () =>
			readNamedReferences(repository, "senses.json", "sense", "sense"),
		getSpellSource: (query) => getSpellSource(repository, query),
	};
}

module.exports = {
	createReferenceCommands,
	getSourcePriority,
	normalizeNamedReferenceRecords,
	pickPreferredRecord,
};
