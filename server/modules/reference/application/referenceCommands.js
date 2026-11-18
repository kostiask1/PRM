const {
	sortByNameQuery,
} = require("../../search/application/searchResults");

const SOURCE_PRIORITIES = new Map([
	["XPHB", 3],
	["XDMG", 3],
	["PHB", 2],
	["DMG", 2],
]);
const PARSER_ACTION_INTERACTIONS = new Set(["direct", "form", "reference"]);

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
	const sources = Array.isArray(item?.sources) ? item.sources : undefined;
	const versions = Array.isArray(item?.versions) ? item.versions : undefined;
	return {
		name,
		kind: getTruthyReferenceField(item, "kind", kind),
		source: getTruthyReferenceField(item, "source", null),
		...(sources ? { sources } : {}),
		...(versions ? { versions } : {}),
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
	if ([
		matchesSpellName(spell, criteria.nameQuery),
		matchesSpellLevel(spell, criteria.level),
		matchesSpellSchool(spell, criteria.schoolQuery),
	].every(Boolean)) {
		return true;
	}
	if (Array.isArray(spell.versions)) {
		return spell.versions.some((v) => [
			matchesSpellName(spell, criteria.nameQuery),
			matchesSpellLevel(v, criteria.level),
			matchesSpellSchool(v, criteria.schoolQuery),
		].every(Boolean));
	}
	return false;
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
	const sources = new Set();
	for (const spell of spells) {
		if (spell.source) sources.add(spell.source);
		if (Array.isArray(spell.sources)) {
			for (const s of spell.sources) {
				if (s) sources.add(s);
			}
		}
		if (Array.isArray(spell.versions)) {
			for (const v of spell.versions) {
				if (v?.source) sources.add(v.source);
			}
		}
	}
	return [...sources].sort((left, right) => left.localeCompare(right));
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

function isParserActionRecord(item) {
	return Boolean(
		item &&
			typeof item === "object" &&
			!Array.isArray(item) &&
			typeof item.type === "string" &&
			item.type.trim() &&
			PARSER_ACTION_INTERACTIONS.has(item.interaction) &&
			typeof item.template === "string" &&
			item.template.trim() &&
			typeof item.description === "string" &&
			item.description.trim(),
	);
}

async function listParserActions(repository) {
	const data = await repository.readReferenceFile("parser-actions.json");
	const actions = Array.isArray(data?.actions) ? data.actions : [];
	return actions.filter(isParserActionRecord);
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
	if (String(spell.source || "").toUpperCase() === normalizedSource) return true;
	if (Array.isArray(spell.sources)) {
		return spell.sources.some((s) => String(s || "").toUpperCase() === normalizedSource);
	}
	if (Array.isArray(spell.versions)) {
		return spell.versions.some((v) => String(v?.source || "").toUpperCase() === normalizedSource);
	}
	return false;
}

function getAggregateSpellSource(spells, source) {
	const sourceText = String(source);
	if (sourceText.toLowerCase() === "all") return spells;
	const normalizedSource = sourceText.toUpperCase();
	const results = [];
	for (const spell of spells) {
		if (Array.isArray(spell.versions)) {
			const version = spell.versions.find((v) => String(v?.source || "").toUpperCase() === normalizedSource);
			if (version) {
				results.push({ ...spell, ...version, source: version.source || spell.source });
				continue;
			}
		}
		if (matchesSpellSource(spell, normalizedSource)) {
			results.push(spell);
		}
	}
	return results;
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
		listParserActions: () => listParserActions(repository),
		getSpellSource: (query) => getSpellSource(repository, query),
	};
}

module.exports = {
	createReferenceCommands,
	getSourcePriority,
	normalizeNamedReferenceRecords,
	pickPreferredRecord,
};
