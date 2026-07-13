const { sortByNameQuery } = require("../../../routes/searchUtils");

function getSourcePriority(source) {
	const normalized = String(source || "").toUpperCase();
	if (normalized === "XPHB" || normalized === "XDMG") return 3;
	if (normalized === "PHB" || normalized === "DMG") return 2;
	return 1;
}

function pickPreferredRecord(current, candidate) {
	if (!current) return candidate;
	return getSourcePriority(candidate.source) > getSourcePriority(current.source)
		? candidate
		: current;
}

function normalizeNamedReferenceRecords(items, kind, extraFields) {
	const byName = new Map();
	for (const item of Array.isArray(items) ? items : []) {
		const name = String(item?.name || "").trim();
		if (!name) continue;
		const normalized = {
			name,
			kind: item?.kind || kind,
			source: item?.source || null,
			page: item?.page || null,
			...(extraFields ? extraFields(item) : {}),
			entries: item?.entries || [],
		};
		const key = name.toLowerCase();
		byName.set(key, pickPreferredRecord(byName.get(key), normalized));
	}
	return Array.from(byName.values()).sort((left, right) =>
		left.name.localeCompare(right.name),
	);
}

function matchesSpellSearch(spell, { nameQuery, level, schoolQuery }) {
	return (
		(nameQuery ? spell.name?.toLowerCase().includes(nameQuery) : true) &&
		(level !== undefined ? String(spell.level) === String(level) : true) &&
		(schoolQuery ? spell.school?.toLowerCase() === schoolQuery : true)
	);
}

function createReferenceCommands(repository) {
	async function readIndexedSpells() {
		const index = await repository.readSpellIndex();
		if (!index) return [];
		const lists = await Promise.all(
			Object.entries(index).map(async ([source, fileName]) =>
				(await repository.readSpellFile(fileName)).map((spell) => ({
					...spell,
					source,
				})),
			),
		);
		return lists.flat();
	}

	async function named(fileName, listKey, kind, extraFields) {
		const data = await repository.readReferenceFile(fileName);
		return normalizeNamedReferenceRecords(data?.[listKey], kind, extraFields);
	}

	return {
		async searchSpells({ name = "", level, school = "" }) {
			const nameQuery = String(name).toLowerCase();
			const schoolQuery = String(school).toLowerCase();
			const aggregate = await repository.readSpellAggregate();
			const spells = aggregate.exists ? aggregate.spells : await readIndexedSpells();
			const results = spells.filter((spell) =>
				matchesSpellSearch(spell, { nameQuery, level, schoolQuery }),
			);
			sortByNameQuery(results, nameQuery);
			return results;
		},

		async listSpellSources() {
			const aggregate = await repository.readSpellAggregate();
			if (aggregate.exists) {
				return [...new Set(aggregate.spells.map((spell) => spell.source).filter(Boolean))]
					.sort((left, right) => left.localeCompare(right));
			}
			return Object.keys((await repository.readSpellIndex()) || {});
		},

		async listConditions() {
			const data = await repository.readReferenceFile("conditions.json");
			return normalizeNamedReferenceRecords(
				[
					...(data?.condition || []).map((item) => ({ ...item, kind: "condition" })),
					...(data?.status || []).map((item) => ({ ...item, kind: "status" })),
				],
				"condition",
			);
		},

		async listDiseases() {
			const data =
				(await repository.readReferenceFile("diseases.json")) ||
				(await repository.readReferenceFile("conditions.json"));
			return normalizeNamedReferenceRecords(
				data?.disease,
				"disease",
				(item) => ({ type: item?.type || null }),
			);
		},

		listVariantRules() {
			return named(
				"variantrules.json",
				"variantrule",
				"variantrule",
				(item) => ({ ruleType: item?.ruleType || null }),
			);
		},
		listSkills() {
			return named("skills.json", "skill", "skill", (item) => ({
				ability: item?.ability || null,
			}));
		},
		listSenses() {
			return named("senses.json", "sense", "sense");
		},

		async getSpellSource({ source }) {
			const aggregate = await repository.readSpellAggregate();
			if (aggregate.exists) {
				if (String(source).toLowerCase() === "all") return aggregate.spells;
				const normalized = String(source).toUpperCase();
				return aggregate.spells.filter(
					(spell) => String(spell.source || "").toUpperCase() === normalized,
				);
			}
			const index = (await repository.readSpellIndex()) || {};
			const fileName = index[source];
			if (!fileName) {
				const error = new Error("Source not found.");
				error.status = 404;
				throw error;
			}
			return (await repository.readSpellFile(fileName)).map((spell) => ({
				...spell,
				source,
			}));
		},
	};
}

module.exports = {
	createReferenceCommands,
	getSourcePriority,
	normalizeNamedReferenceRecords,
	pickPreferredRecord,
};
