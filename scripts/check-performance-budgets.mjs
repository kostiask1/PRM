import fs from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { filterGlobalSearchIndex } from "../src/entities/campaign/model.js";
import { buildEncounterGridModel } from "../src/entities/encounter/model.js";
import { filterBestiaryMonsters } from "../src/features/bestiary/model.js";
import { filterSpells } from "../src/features/spells/model.js";

const BUDGETS = Object.freeze({
	bestiaryDetailedFilterMs: 200,
	spellsDetailedFilterMs: 50,
	globalSearch20kMs: 25,
	encounterGrid10kMs: 40,
});

function listFromBundle(bundle, keys) {
	if (Array.isArray(bundle)) return bundle;
	for (const key of keys) {
		if (Array.isArray(bundle?.[key])) return bundle[key];
	}
	return [];
}

function medianDuration(run, samples = 9) {
	for (let index = 0; index < 3; index += 1) run();
	const durations = [];
	for (let index = 0; index < samples; index += 1) {
		const startedAt = performance.now();
		run();
		durations.push(performance.now() - startedAt);
	}
	durations.sort((left, right) => left - right);
	return durations[Math.floor(durations.length / 2)];
}

function uniqueSources(records) {
	return [...new Set(records.map((record) => record?.source).filter(Boolean))];
}

function assertBudget(name, duration, budget, context) {
	if (duration <= budget) return;
	throw new Error(
		`${name} exceeded its ${budget}ms median budget: ${duration.toFixed(2)}ms (${context}).`,
	);
}

const [bestiaryBundle, spellsBundle] = await Promise.all([
	fs
		.readFile("database/bestiary/all.json", "utf8")
		.then(JSON.parse),
	fs.readFile("database/spells/all.json", "utf8").then(JSON.parse),
]);
const monsters = listFromBundle(bestiaryBundle, ["monster", "monsters"]);
const spells = listFromBundle(spellsBundle, ["spell", "spells"]);
const monsterSources = uniqueSources(monsters);
const spellSources = uniqueSources(spells);

const globalSearchFixture = Array.from({ length: 20_000 }, (_, index) => ({
	id: `result-${index}`,
	filter: ["notes", "scenes", "npc", "locations"][index % 4],
	searchText: `campaign record ${index} ordinary content`,
}));
const allGlobalSearchFilters = new Set([
	"notes",
	"scenes",
	"npc",
	"locations",
]);
const encounterFixture = Array.from({ length: 10_000 }, (_, index) => ({
	instanceId: `monster-${index}`,
	name: `Monster ${index % 500}`,
	source: "MM",
}));

const results = {
	bestiaryDetailedFilterMs: medianDuration(() =>
		filterBestiaryMonsters({
			monsters,
			selectedSources: monsterSources,
			search: "dragon",
			isDetailedSearch: true,
		}),
	),
	spellsDetailedFilterMs: medianDuration(() =>
		filterSpells({
			spells,
			selectedSources: spellSources,
			search: "fire",
			isDetailedSearch: true,
		}),
	),
	globalSearch20kMs: medianDuration(() =>
		filterGlobalSearchIndex(
			globalSearchFixture,
			allGlobalSearchFilters,
			"definitely-absent-query",
		),
	),
	encounterGrid10kMs: medianDuration(() =>
		buildEncounterGridModel(encounterFixture),
	),
};

assertBudget(
	"Bestiary detailed filter",
	results.bestiaryDetailedFilterMs,
	BUDGETS.bestiaryDetailedFilterMs,
	`${monsters.length} bundled monsters`,
);
assertBudget(
	"Spells detailed filter",
	results.spellsDetailedFilterMs,
	BUDGETS.spellsDetailedFilterMs,
	`${spells.length} bundled spells`,
);
assertBudget(
	"Global search",
	results.globalSearch20kMs,
	BUDGETS.globalSearch20kMs,
	"20,000 indexed records with no match",
);
assertBudget(
	"Encounter grid grouping",
	results.encounterGrid10kMs,
	BUDGETS.encounterGrid10kMs,
	"10,000 participants grouped into 500 stat blocks",
);

const cappedResults = filterGlobalSearchIndex(
	globalSearchFixture,
	allGlobalSearchFilters,
	"ordinary",
);
if (cappedResults.length !== 80) {
	throw new Error(
		`Global search render budget expected 80 results, received ${cappedResults.length}.`,
	);
}
const encounterModel = buildEncounterGridModel(encounterFixture);
if (encounterModel.gridMonsters.length !== 500) {
	throw new Error(
		`Encounter grouping expected 500 representative stat blocks, received ${encounterModel.gridMonsters.length}.`,
	);
}

console.log(
	JSON.stringify(
		{
			ok: true,
			fixtures: {
				monsters: monsters.length,
				spells: spells.length,
				globalSearchRecords: globalSearchFixture.length,
				encounterParticipants: encounterFixture.length,
			},
			budgetsMs: BUDGETS,
			medianMs: Object.fromEntries(
				Object.entries(results).map(([key, value]) => [
					key,
					Number(value.toFixed(2)),
				]),
			),
			renderCaps: {
				globalSearchResults: cappedResults.length,
				encounterRepresentatives:
					encounterModel.gridMonsters.length,
			},
		},
		null,
		2,
	),
);
