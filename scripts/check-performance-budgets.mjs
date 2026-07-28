import fs from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { matchesMonsterSearch } from "../src/entities/bestiary/index.js";
import { getEncounterGridProjection } from "../src/pages/encounter/model.js";
import { objectMatchesSearch } from "../src/shared/lib/index.js";
import { filterBestiaryMonsters } from "../src/widgets/bestiary-browser/model.js";
import {
	CAMPAIGN_SEARCH_FILTERS,
	CAMPAIGN_SEARCH_RESULT_LIMIT,
	filterCampaignSearchResults,
} from "../src/widgets/campaign-search/model.js";
import { filterSpells } from "../src/widgets/spells-browser/model.js";

const BUDGETS = Object.freeze({
	bestiaryDetailedFilterMs: 200,
	spellsDetailedFilterMs: 50,
	campaignSearch20kMs: 25,
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
	fs.readFile("database/bestiary/all.json", "utf8").then(JSON.parse),
	fs.readFile("database/spells/all.json", "utf8").then(JSON.parse),
]);
const monsters = listFromBundle(bestiaryBundle, ["monster", "monsters"]);
const spells = listFromBundle(spellsBundle, ["spell", "spells"]);
const monsterSources = uniqueSources(monsters);
const spellSources = uniqueSources(spells);

const campaignSearchFixture = Array.from({ length: 20_000 }, (_, index) => ({
	id: `result-${index}`,
	filter: CAMPAIGN_SEARCH_FILTERS[index % CAMPAIGN_SEARCH_FILTERS.length],
	title: `Record ${index}`,
	subtitle: "",
	text: "ordinary content",
	target: { campaignSlug: "performance" },
	searchText: `campaign record ${index} ordinary content`,
}));
const allCampaignSearchFilters = new Set(CAMPAIGN_SEARCH_FILTERS);
const encounterFixture = Array.from({ length: 10_000 }, (_, index) => ({
	instanceId: `monster-${index}`,
	name: `Monster ${index % 500}`,
	source: "MM",
}));

const results = {
	bestiaryDetailedFilterMs: medianDuration(() =>
		filterBestiaryMonsters(monsters, {
			selectedSources: monsterSources,
			sourceFilter: "all",
			onlyFavorites: false,
			favorites: [],
			search: "dragon",
			isDetailedSearch: true,
			matchesDetailedSearch: objectMatchesSearch,
			matchesSimpleSearch: matchesMonsterSearch,
		}),
	),
	spellsDetailedFilterMs: medianDuration(() =>
		filterSpells(
			spells,
			{
				selectedSources: spellSources,
				sourceFilter: "all",
				search: "fire",
				detailedSearch: true,
				selectedLevel: "all",
				selectedClass: "all",
				selectedSchool: "all",
			},
			objectMatchesSearch,
		),
	),
	campaignSearch20kMs: medianDuration(() =>
		filterCampaignSearchResults(
			campaignSearchFixture,
			"definitely-absent-query",
			allCampaignSearchFilters,
		),
	),
	encounterGrid10kMs: medianDuration(() =>
		getEncounterGridProjection(encounterFixture),
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
	"Campaign search",
	results.campaignSearch20kMs,
	BUDGETS.campaignSearch20kMs,
	"20,000 indexed records with no match",
);
assertBudget(
	"Encounter grid grouping",
	results.encounterGrid10kMs,
	BUDGETS.encounterGrid10kMs,
	"10,000 participants grouped into 500 stat blocks",
);

const cappedResults = filterCampaignSearchResults(
	campaignSearchFixture,
	"ordinary",
	allCampaignSearchFilters,
);
if (cappedResults.length !== CAMPAIGN_SEARCH_RESULT_LIMIT) {
	throw new Error(
		`Campaign search render budget expected ${CAMPAIGN_SEARCH_RESULT_LIMIT} results, received ${cappedResults.length}.`,
	);
}
const encounterProjection = getEncounterGridProjection(encounterFixture);
if (encounterProjection.monsters.length !== 500) {
	throw new Error(
		`Encounter grouping expected 500 representative stat blocks, received ${encounterProjection.monsters.length}.`,
	);
}

console.log(
	JSON.stringify(
		{
			ok: true,
			fixtures: {
				monsters: monsters.length,
				spells: spells.length,
				campaignSearchRecords: campaignSearchFixture.length,
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
				campaignSearchResults: cappedResults.length,
				encounterRepresentatives: encounterProjection.monsters.length,
			},
		},
		null,
		2,
	),
);
