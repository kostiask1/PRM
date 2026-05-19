import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";

import { idsEqual } from "../src/utils/id.js";
import { isJsonObject, isJsonString } from "../src/utils/json.js";
import {
	matchesMonsterSearch,
	getMonsterTypeString,
} from "../src/utils/bestiary.js";
import classNames from "../src/utils/classNames.js";
import { rollDiceFormula } from "../src/utils/dice.js";
import { extractContentTokens } from "../src/utils/contentTokens.js";
import {
	addUndoSnapshot,
	createDistinctRedoTransition,
	createDistinctUndoTransition,
	createRedoTransition,
	createUndoTransition,
} from "../src/utils/undoRedo.js";
import {
	normalizeConditionName,
	loadConditionsMap,
} from "../src/utils/conditions.js";
import {
	createEmptyNote as createModelEmptyNote,
	getNotesForRender,
	isNoteEmpty,
	sanitizeNotesForSave,
	upsertNoteById,
} from "../src/utils/noteUtils.js";
import {
	buildNavigationUrl,
	parseUrl,
	shouldOpenInNewTabFromEvent,
} from "../src/utils/navigation.js";
import { downloadBlob, downloadJsonFile } from "../src/utils/download.js";
import {
	createEncounterMonsterInstance,
	getMonsterBaseHp,
	hasMonsterHpFormula,
} from "../src/utils/encounters.js";
import {
	getSpellByName,
	getConditionByName,
	getDiseaseByName,
	getSenseByName,
	getSkillByName,
	getVariantRuleByName,
} from "../src/utils/referencePreview.js";
import {
	resolveSpellInput,
	resolveConditionInput,
	resolveDiseaseInput,
	resolveSenseInput,
	resolveSkillInput,
	resolveVariantRuleInput,
} from "../src/utils/referenceResolvers.js";
import {
	buildCampaignGraph,
	extractBracketMentions,
	normalizeGraphName,
} from "../src/utils/campaignGraph.js";
import CampaignViewModel from "../src/models/CampaignViewModel.js";
import SessionViewModel from "../src/models/SessionViewModel.js";
import MonsterStatBlockModel from "../src/models/MonsterStatBlockModel.js";
import SpellCardModel from "../src/models/SpellCardModel.js";
import LocationCardModel from "../src/models/LocationCardModel.js";
import {
	areHistoryStatesEqual,
	campaignHistoryPayload,
	cloneHistoryList,
	getCharacterDisplayName as getCampaignCharacterDisplayName,
	getLocationDisplayName as getCampaignLocationDisplayName,
	normalizeMentionName,
	replaceBracketedMentionNames,
	replaceMentionsInValue,
	sanitizeEntityForSave,
	sanitizeLoadedEntity,
} from "../src/features/campaign/campaignStateUtils.js";
import { IMAGE_GALLERY_CATEGORIES } from "../src/features/images/imageGalleryConfig.js";
import {
	findEntityByName,
	getEntityDisplayName,
	resolveEntityByName,
} from "../src/services/entities.js";
import { api } from "../src/api.js";

const require = createRequire(import.meta.url);
const storage = require("../server/storage.js");
const spellsRouter = require("../server/routes/spells.js");
const aiRouter = require("../server/routes/ai.js");
const aiService = require("../server/aiService.js");
const aiHistoryService = require("../server/aiHistoryService.js");
const aiPayloadSchemas = require("../server/aiPayloadSchemas.js");

const results = [];
const TEST_PREFIX = `autotest-${Date.now()}`;

function createEmptyNote() {
	return {
		id: Date.now(),
		title: "",
		text: "",
		collapsed: false,
	};
}

function appendTrailingEmptyNote(notes = []) {
	const next = [...notes];
	const last = next[next.length - 1];
	if (next.length === 0 || (last && (last.text?.trim() || last.title?.trim()))) {
		next.push(createEmptyNote());
	}
	return next;
}

function ensureAtLeastOneNote(notes = []) {
	return notes.length > 0 ? notes : [createEmptyNote()];
}

function makeTestSlug(name) {
	return `${TEST_PREFIX}-${name}-${Math.random().toString(36).slice(2, 10)}`;
}

async function cleanupTestData(slug) {
	await fs.rm(path.join(storage.IMAGES_DIR, slug), {
		recursive: true,
		force: true,
	});
	await fs.rm(storage.campaignDir(slug), { recursive: true, force: true });
}

async function withTestSlug(name, callback) {
	const slug = makeTestSlug(name);
	try {
		return await callback(slug);
	} finally {
		await cleanupTestData(slug);
	}
}

async function run(name, fn) {
	try {
		await fn();
		results.push({ name, ok: true });
		console.log(`PASS ${name}`);
	} catch (error) {
		results.push({ name, ok: false, error });
		console.error(`FAIL ${name}`);
		console.error(error);
	}
}

await run("idsEqual compares values by string representation", () => {
	assert.equal(idsEqual(1, "1"), true);
	assert.equal(idsEqual("abc", "abc"), true);
	assert.equal(idsEqual(null, "1"), false);
	assert.equal(idsEqual(undefined, undefined), false);
});

await run("JSON helpers validate object and string payloads", () => {
	assert.equal(isJsonObject('{"a":1}'), true);
	assert.equal(isJsonObject('"hello"'), false);
	assert.equal(isJsonObject("not-json"), false);
	assert.equal(isJsonString('"hello"'), true);
	assert.equal(isJsonString('{"a":1}'), false);
	assert.equal(isJsonString("not-json"), false);
});

await run("note helpers maintain trailing empty note slot", () => {
	const note = createEmptyNote();
	assert.equal(note.title, "");
	assert.equal(note.text, "");
	assert.equal(note.collapsed, false);
	assert.ok(note.id);

	const withContent = [{ ...note, title: "A" }];
	const appended = appendTrailingEmptyNote(withContent);
	assert.equal(appended.length, 2);
	assert.equal(appended[1].title, "");
	assert.equal(appendTrailingEmptyNote([createEmptyNote()]).length, 1);
	assert.equal(ensureAtLeastOneNote([]).length, 1);
});

await run("noteUtils renders virtual notes and sanitizes saved notes", () => {
	const emptyNote = createModelEmptyNote();
	assert.equal(isNoteEmpty(emptyNote), true);
	assert.equal(isNoteEmpty({ title: "Title", text: "" }), false);
	assert.equal(isNoteEmpty({ title: "Title", text: "" }, true), true);

	const withTitleOnly = [{ id: "title", title: "Title", text: "" }];
	const regularRender = getNotesForRender(withTitleOnly);
	assert.equal(regularRender.length, 2);
	assert.equal(regularRender[1]._isVirtual, true);

	const simplifiedRender = getNotesForRender(withTitleOnly, {
		simplifiedNotes: true,
	});
	assert.equal(simplifiedRender.length, 1);

	const updated = upsertNoteById([], "new", { text: "Body" });
	assert.deepEqual(updated, [
		{ id: "new", title: "", text: "Body", collapsed: false },
	]);

	const sanitized = sanitizeNotesForSave([
		{ id: "empty", title: "", text: "", collapsed: false, _isVirtual: true },
		{ id: "filled", title: "T", text: "", collapsed: true, _isVirtual: true },
	]);
	assert.deepEqual(sanitized, [
		{ id: "filled", title: "T", text: "", collapsed: true },
	]);
});

await run(
	"parseUrl supports campaign/session/encounter and static sections",
	() => {
		const originalWindow = global.window;
		try {
			global.window = { location: { pathname: "/campaign/test-c/session/s1" } };
			assert.deepEqual(parseUrl(), {
				campaign: "test-c",
				session: "s1",
				encounter: null,
			});
			global.window = {
				location: { pathname: "/campaign/test-c/session/s1/encounter/e1" },
			};
			assert.deepEqual(parseUrl(), {
				campaign: "test-c",
				session: "s1",
				encounter: "e1",
			});
			global.window = { location: { pathname: "/bestiary" } };
			assert.deepEqual(parseUrl(), {
				campaign: "bestiary",
				session: null,
				encounter: null,
			});
			global.window = { location: { pathname: "/spells" } };
			assert.deepEqual(parseUrl(), {
				campaign: "spells",
				session: null,
				encounter: null,
			});
		} finally {
			global.window = originalWindow;
		}
	},
);

await run(
	"navigation helpers support modifier tab-open and URL building",
	() => {
		assert.equal(shouldOpenInNewTabFromEvent({ ctrlKey: true }), true);
		assert.equal(shouldOpenInNewTabFromEvent({ metaKey: true }), true);
		assert.equal(
			shouldOpenInNewTabFromEvent({ ctrlKey: false, metaKey: false }),
			false,
		);
		assert.equal(shouldOpenInNewTabFromEvent(null), false);

		assert.equal(buildNavigationUrl(null), "/");
		assert.equal(buildNavigationUrl("bestiary"), "/bestiary");
		assert.equal(buildNavigationUrl("spells"), "/spells");
		assert.equal(
			buildNavigationUrl("camp", "sess 1", "enc-1"),
			"/campaign/camp/session/sess%201/encounter/enc-1",
		);
	},
);

await run("CampaignViewModel formats links and dates", () => {
	const model = new CampaignViewModel({
		slug: "my-campaign",
		name: "My Campaign",
		createdAt: "2026-01-01T00:00:00.000Z",
	});
	assert.equal(model.name, "My Campaign");
	assert.equal(
		model.buildSessionHref("session 1.json"),
		"/campaign/my-campaign/session/session%201.json",
	);
	assert.notEqual(model.createdAtLabel, "-");
	assert.equal(model.formatSessionUpdatedAt(""), "-");
});

await run("campaign graph builds nodes and mention edges", () => {
	assert.deepEqual(extractBracketMentions("Meet [Ім'я] and [ NPC  One ]."), [
		"Ім'я",
		"NPC One",
	]);
	assert.equal(normalizeGraphName("  NPC   One "), "npc one");

	const graph = buildCampaignGraph({
		campaign: { slug: "camp", name: "Кампанія" },
		description: "Основний сюжет про [Герой Один].",
		notes: [{ id: 1, title: "План", text: "Зустріч з [NPC Один]." }],
		characters: [
			{
				id: "hero",
				firstName: "Герой",
				lastName: "Один",
				motivation: "Шукає [Місто].",
			},
		],
		npcs: [{ id: "npc", firstName: "NPC", lastName: "Один" }],
		locations: [{ id: "city", name: "Місто" }],
		sessions: [{ fileName: "s1.json", name: "Сесія 1" }],
		sessionDetails: {
			"s1.json": {
				fileName: "s1.json",
				name: "Сесія 1",
				data: {
					result_text: "Бачили [Невідомий союзник].",
					npcs: [{ id: "session-npc", firstName: "Місцевий", lastName: "NPC" }],
					locations: [{ id: "session-location", name: "Підвал" }],
					notes: [
						{
							id: "session-note",
							text: "Перевірили [Підвал] з [Місцевий NPC].",
						},
					],
					scenes: [
						{
							id: "scene-1",
							texts: { summary: "[Герой Один] говорить з [NPC Один]." },
							notes: [{ id: "n1", text: "Поруч [Місто]." }],
						},
						{
							id: "scene-2",
							texts: { summary: "Далі йдуть до [Підвал]." },
						},
					],
				},
			},
		},
	});

	const nodeTypes = new Set(graph.nodes.map((node) => node.type));
	assert.equal(nodeTypes.has("campaign-note"), true);
	assert.equal(nodeTypes.has("character"), true);
	assert.equal(nodeTypes.has("npc"), true);
	assert.equal(nodeTypes.has("location"), true);
	assert.equal(nodeTypes.has("session"), true);
	assert.equal(nodeTypes.has("scene"), true);
	assert.equal(nodeTypes.has("scene-note"), true);
	assert.equal(nodeTypes.has("unresolved"), true);
	assert.equal(graph.edges.some((edge) => edge.relation === "mentions"), true);
	assert.equal(graph.edges.some((edge) => edge.relation === "related"), true);
	assert.equal(
		graph.edges.some(
			(edge) =>
				edge.relation === "mentions" &&
				edge.source === "campaign:camp" &&
				edge.target === "npc:npc",
		),
		true,
	);
	assert.equal(
		graph.edges.some(
			(edge) =>
				edge.relation === "mentions" &&
				edge.source === "session:s1.json" &&
				edge.target === "character:hero",
		),
		true,
	);
	assert.equal(
		graph.edges.some(
			(edge) =>
				edge.relation === "mentions" &&
				edge.source === "session:s1.json" &&
				edge.target === "location:city",
		),
		true,
	);
	assert.equal(
		graph.nodes.some(
			(node) =>
				node.id === "session-npc:s1.json:session-npc" && node.type === "npc",
		),
		true,
	);
	assert.equal(
		graph.nodes.some(
			(node) =>
				node.id === "session-location:s1.json:session-location" &&
				node.type === "location",
		),
		true,
	);
	assert.equal(
		graph.edges.some(
			(edge) =>
				edge.relation === "mentions" &&
				edge.source === "session-note:s1.json:session-note" &&
				edge.target === "session-npc:s1.json:session-npc",
		),
		true,
	);
	assert.equal(
		graph.edges.some(
			(edge) =>
				edge.relation === "mentions" &&
				edge.source === "session-note:s1.json:session-note" &&
				edge.target === "session-location:s1.json:session-location",
		),
		true,
	);
	assert.equal(
		graph.edges.some(
			(edge) =>
				edge.relation === "sequence" &&
				edge.source === "scene:s1.json:scene-1" &&
				edge.target === "scene:s1.json:scene-2",
		),
		true,
	);
	assert.equal(graph.stats.unresolved, 1);

	const simplifiedGraph = buildCampaignGraph({
		campaign: { slug: "camp", name: "Кампанія" },
		notes: [{ id: 1, title: "Прихований заголовок", text: "Текст нотатки." }],
		simplifiedNotes: true,
	});
	assert.equal(
		simplifiedGraph.nodes.find((node) => node.type === "campaign-note")?.label,
		"Текст нотатки.",
	);
});

await run("campaign state helpers sanitize entities and update mentions", () => {
	assert.deepEqual(
		sanitizeEntityForSave({ id: 1, name: "Hero", _draft: true }),
		{ id: 1, name: "Hero" },
	);
	assert.deepEqual(
		sanitizeEntityForSave({ id: 1, name: "Hero", _aiIgnored: true }),
		{ id: 1, name: "Hero", _aiIgnored: true },
	);
	assert.deepEqual(sanitizeLoadedEntity({ name: "Hero", _tmp: "x" }), {
		name: "Hero",
	});
	assert.equal(normalizeMentionName("  Old   Name "), "old name");
	assert.equal(
		replaceBracketedMentionNames(
			"Meet [ old   name ] and [Other].",
			"Old Name",
			"New Name",
		),
		"Meet [New Name] and [Other].",
	);
	assert.deepEqual(
		replaceMentionsInValue(
			{ text: "[Old Name]", list: ["No", "[ old name ]"] },
			"old name",
			"New Name",
		),
		{ text: "[New Name]", list: ["No", "[New Name]"] },
	);
	assert.equal(
		getCampaignCharacterDisplayName({ firstName: "Ім'я", lastName: "Прізвище" }),
		"Ім'я Прізвище",
	);
	assert.equal(getCampaignCharacterDisplayName({ name: "NPC" }), "NPC");
	assert.equal(getCampaignLocationDisplayName({ title: "Фракція" }), "Фракція");

	const history = cloneHistoryList([{ name: "A", _virtual: true }]);
	assert.deepEqual(history, [{ name: "A" }]);
	history[0].name = "Changed";
	assert.deepEqual(cloneHistoryList([{ name: "A" }]), [{ name: "A" }]);
	assert.equal(areHistoryStatesEqual([{ a: 1 }], [{ a: 1 }]), true);
	assert.deepEqual(
		campaignHistoryPayload({
			description: "Story",
			notes: [
				{ id: 1, title: "", text: "", collapsed: false },
				{ id: 2, title: "Plan", text: "", collapsed: false, _isVirtual: true },
			],
			completed: 1,
			completedAt: "2026-05-08",
		}),
		{
			description: "Story",
			notes: [{ id: 2, title: "Plan", text: "", collapsed: false }],
			completed: true,
			completedAt: "2026-05-08",
		},
	);
});

await run("AI helpers preserve numeric ids and ignored notes", () => {
	const { applyGeneratedScenes, mergeAiIgnoredNotes } = aiRouter.__test;
	const scenes = applyGeneratedScenes(
		[
			{
				id: 100,
				texts: { summary: "Old", goal: "", stakes: "", location: "" },
				notes: [],
				npcs: [],
			},
		],
		[
			{
				id: 100,
				texts: { summary: "New", goal: "", stakes: "", location: "" },
				notes: [],
				npcs: [],
			},
		],
		new Set(["100"]),
		new Map(),
	);
	assert.equal(scenes.length, 1);
	assert.equal(scenes[0].texts.summary, "New");

	const mergedNotes = mergeAiIgnoredNotes(
		[
			{ id: 1, title: "A", text: "A", collapsed: false },
			{
				id: 2,
				title: "Hidden",
				text: "Hidden",
				collapsed: false,
				_aiIgnored: true,
			},
			{ id: 3, title: "B", text: "B", collapsed: false },
		],
		[
			{ id: 1, title: "A2", text: "A2", collapsed: false },
			{ id: 3, title: "B2", text: "B2", collapsed: false },
		],
	);
	assert.deepEqual(
		mergedNotes.map((note) => note.id),
		[1, 2, 3],
	);
	assert.equal(mergedNotes[1]._aiIgnored, true);
});

await run(
	"AI session-scope filters exact campaign copies without dropping new namesakes",
	() => {
		const { filterGeneratedEntitiesOutsideScope } = aiRouter.__test;
		const campaignLocations = [
			{
				id: "campaign-city",
				slug: "city",
				name: "City",
				description: "Old city",
				notes: [{ id: "n1", title: "Hook", text: "Old hook", collapsed: false }],
			},
		];
		const getName = (entity) => String(entity.name || "").toLowerCase();

		assert.deepEqual(
			filterGeneratedEntitiesOutsideScope(
				[
					{
						name: "City",
						description: "Old city",
						notes: [{ title: "Hook", text: "Old hook" }],
					},
				],
				campaignLocations,
				[],
				getName,
				"locations",
			),
			[],
		);

		const newNamesake = filterGeneratedEntitiesOutsideScope(
			[{ name: "City", description: "New session district", notes: [] }],
			campaignLocations,
			[],
			getName,
			"locations",
		);
		assert.equal(newNamesake.length, 1);
		assert.equal(newNamesake[0].description, "New session district");
	},
);

await run("AI JSON fence cleanup preserves inner markdown fences", () => {
	const raw = [
		"```json",
		'{"notes":[{"text":"```js\\nconst x = 1;\\n```"}]}',
		"```",
	].join("\n");
	const cleaned = aiService.__test.stripOuterJsonFence(raw);
	assert.equal(
		cleaned,
		'{"notes":[{"text":"```js\\nconst x = 1;\\n```"}]}',
	);
	assert.deepEqual(JSON.parse(cleaned), {
		notes: [{ text: "```js\nconst x = 1;\n```" }],
	});
});

await run("AI payload schema validates generated entity contracts", () => {
	assert.equal(
		aiPayloadSchemas.validateAiGeneratedContent({
			npcs: [{ firstName: "Mira", trait: "Careful scout" }],
			locations: [{ name: "Old Gate", description: "A locked arch." }],
			scenes: [{ texts: { summary: "Ambush" }, notes: [] }],
			encounters: [{ name: "Gate Fight", monsters: [] }],
		}).valid,
		true,
	);

	const invalid = aiPayloadSchemas.validateAiGeneratedContent({
		npcs: "Mira",
		monsters: [{ spellcasting: {} }],
	});
	assert.equal(invalid.valid, false);
	assert.ok(invalid.errors.some((entry) => entry.path === "npcs"));
	assert.ok(
		invalid.errors.some((entry) => entry.path === "monsters[0].spellcasting"),
	);
});

await run("AI history service builds stable request snapshots", () => {
	const snapshot = aiHistoryService.buildAiRequestSnapshot({
		type: "custom-monster",
		modelName: "test-model",
		userInstructions: "Create a guardian",
		path: { campaign: "bestiary" },
		parseAIResponse: true,
		shouldParseAIResponse: true,
		generateEncounters: false,
		generateCustomMonsters: false,
		generateCharacters: false,
		generateNpcs: false,
		generateLocations: false,
		entityScope: "custom-bestiary",
		contextConfig: null,
		contextData: {},
		language: "uk",
	});
	assert.equal(snapshot.options.mode, "custom-monster");
	assert.match(snapshot.optionsSummary, /custom-monsters: off/);
	assert.equal(snapshot.contextSummary, "context: off");
});

await run("AI mention processing preserves existing entity links", () => {
	const { processGeneratedTextMentions } = aiRouter.__test;
	assert.equal(
		processGeneratedTextMentions("Meet [Session NPC] near Old Gate.", [
			"Old Gate",
		]),
		"Meet [Session NPC] near [Old Gate].",
	);
	assert.equal(
		processGeneratedTextMentions("Meet [ old gate ] again.", ["Old Gate"]),
		"Meet [Old Gate] again.",
	);
});

await run("SessionViewModel encounter lookup", () => {
	const model = new SessionViewModel({
		isSaving: true,
		data: {
			notes: [{ id: 1 }],
			scenes: [{ id: 2, encounterId: "enc-1" }],
			encounters: [{ id: "enc-1", name: "Fight" }],
		},
	});
	assert.equal(model.findEncounterName(model.scenes[0]), "Fight");
	assert.equal(model.findEncounterName({ encounterId: "missing" }), "Untitled");
});

await run("CharacterCardModel derives fields and maintains notes", async () => {
	let CharacterCardModel;
	try {
		({ default: CharacterCardModel } = await import(
			"../src/models/CharacterCardModel.js"
		));
	} catch (error) {
		if (
			error?.code === "ERR_MODULE_NOT_FOUND" ||
			String(error?.message || "").includes("appStore")
		) {
			console.log(
				"SKIP CharacterCardModel test in Node-only environment (appStore import).",
			);
			return;
		}
		throw error;
	}

	const model = new CharacterCardModel({
		firstName: "Ім'я",
		lastName: "Прізвище",
		level: "3",
		race: "Ельф",
		class: "Маг",
		notes: [],
	});
	assert.equal(model.displayName, "Ім'я");
	assert.equal(model.fullName, "Ім'я Прізвище");
	assert.equal(model.level, 3);
	assert.equal(model.notes.length, 1);
	const noteId = model.notes[0].id;
	assert.ok(
		model.withUpdatedNote(noteId, { title: "T" }).some((n) => n.title === "T"),
	);
	assert.equal(model.withDeletedNote(noteId).length, 1);
});

await run("LocationCardModel derives display data and preserves note slot", () => {
	const model = new LocationCardModel({
		id: "loc-1",
		name: "Місто",
		description:
			"Дуже довгий опис локації, який має бути скорочений для компактного відображення в картці без втрати стабільності моделі та коректного вигляду в інтерфейсі.",
		notes: [],
		imageUrl: "/image.png",
	});

	assert.equal(model.displayName, "Місто");
	assert.match(model.briefMeta, /\.\.\.$/);
	assert.equal(model.notes.length, 1);
	assert.equal(model.hasImage, true);
	assert.equal(model.withField("name", "Новий").name, "Новий");

	const notedModel = new LocationCardModel({
		notes: [{ id: "n1", title: "", text: "", collapsed: false }],
	});
	assert.ok(
		notedModel.withUpdatedNote("n1", { text: "Text" }).some((n) => n.text === "Text"),
	);
	assert.equal(notedModel.withDeletedNote("n1").length, 1);
	assert.equal(notedModel.toggleNoteCollapse("n1")[0].collapsed, true);
});

await run("MonsterStatBlockModel formats combat data", () => {
	const model = new MonsterStatBlockModel({
		name: "Orc",
		source: "MM",
		size: ["M"],
		alignment: ["C", "E"],
		ac: [{ ac: 13, from: ["armor"] }],
		hp: { average: 15, formula: "2d8+6" },
		speed: {
			walk: 30,
			fly: { number: 60, condition: "(hover)" },
			canHover: true,
		},
		str: 16,
		dex: 12,
		con: 14,
		int: 8,
		wis: 11,
		cha: 10,
	});
	assert.equal(model.size, "Medium");
	assert.equal(model.alignment, "Chaotic Evil");
	assert.equal(model.ac.val, 13);
	assert.equal(model.hp.val, 15);
	assert.match(model.localTokenSrc, /\/api\/bestiary\/tokens\/MM\/Orc\.webp$/);
});

await run("SpellCardModel formats spell labels", () => {
	const model = new SpellCardModel({
		name: "Magic Missile|PHB",
		source: "PHB",
		classes: ["Sorcerer", "Wizard"],
		level: 1,
		school: "V",
		time: [{ number: 1, unit: "action" }],
		range: { type: "point", distance: { type: "feet", amount: 120 } },
		components: { v: true, s: true, m: "a bit of phosphorus" },
		duration: [{ type: "instant" }],
	});
	assert.equal(model.displayName, "Magic Missile");
	assert.equal(model.levelLabel, "1-й рівень");
	assert.match(model.rangeLabel, /120 фт/);
	assert.equal(model.durationLabel, "Миттєво");
	assert.equal(model.classesLabel, "Sorcerer, Wizard");
});

await run("content tokens parse hit and recharge tags safely", () => {
	const hitOnly = extractContentTokens("Claw. +6 до влучання.");
	assert.equal(hitOnly.length, 1);
	assert.equal(hitOnly[0].hit, "+6");
	assert.equal(hitOnly[0].hitSuffix, "");

	const hitWithEnglishSuffix = extractContentTokens("Claw. +6 to hit.");
	assert.equal(hitWithEnglishSuffix.length, 1);
	assert.equal(hitWithEnglishSuffix[0].hit, "+6");
	assert.equal(hitWithEnglishSuffix[0].hitSuffix.trim(), "to hit");

	const recharge = extractContentTokens("(Recharge 5-6) Breath.");
	assert.equal(recharge.length, 1);
	assert.equal(recharge[0].recharge, "(Recharge 5-6)");
	assert.equal(recharge.some((token) => token.hit === "-6"), false);
});

await run("undo redo helpers move snapshots between stacks", () => {
	const original = { value: 1, nested: { label: "one" } };
	const undoStack = addUndoSnapshot([], original);
	original.nested.label = "mutated";
	assert.equal(undoStack[0].nested.label, "one");

	const undo = createUndoTransition({
		undoStack,
		redoStack: [],
		current: { value: 2 },
	});
	assert.deepEqual(undo.target, { value: 1, nested: { label: "one" } });
	assert.equal(undo.undoStack.length, 0);
	assert.deepEqual(undo.redoStack, [{ value: 2 }]);

	const redo = createRedoTransition({
		undoStack: undo.undoStack,
		redoStack: undo.redoStack,
		current: undo.target,
	});
	assert.deepEqual(redo.target, { value: 2 });
	assert.deepEqual(redo.undoStack, [{ value: 1, nested: { label: "one" } }]);
	assert.equal(redo.redoStack.length, 0);
});

await run("undo redo helpers skip duplicate current snapshots", () => {
	const isEqual = (left, right) => left?.value === right?.value;
	const undo = createDistinctUndoTransition({
		undoStack: [{ value: 1 }, { value: 2 }, { value: 2 }],
		redoStack: [],
		current: { value: 2 },
		isEqual,
	});
	assert.deepEqual(undo.target, { value: 1 });
	assert.deepEqual(undo.undoStack, []);
	assert.deepEqual(undo.redoStack, [{ value: 2 }]);

	const redo = createDistinctRedoTransition({
		undoStack: [],
		redoStack: [{ value: 1 }, { value: 1 }, { value: 3 }],
		current: { value: 1 },
		isEqual,
	});
	assert.deepEqual(redo.target, { value: 3 });
	assert.deepEqual(redo.undoStack, [{ value: 1 }]);
	assert.deepEqual(redo.redoStack, []);
});

await run("download helpers create and revoke blob URL", () => {
	const originalURL = global.URL;
	const originalDocument = global.document;
	const originalBlob = global.Blob;

	let clicked = false;
	let revokedUrl = "";
	const anchor = {
		href: "",
		download: "",
		click() {
			clicked = true;
		},
	};

	global.URL = {
		createObjectURL(blob) {
			assert.ok(blob);
			return "blob:test";
		},
		revokeObjectURL(url) {
			revokedUrl = url;
		},
	};
	global.document = {
		createElement(tag) {
			assert.equal(tag, "a");
			return anchor;
		},
	};
	global.Blob = class BlobMock {
		constructor(parts, options) {
			this.parts = parts;
			this.type = options?.type;
		}
	};

	try {
		downloadBlob(new global.Blob(["x"], { type: "text/plain" }), "x.txt");
		assert.equal(anchor.href, "blob:test");
		assert.equal(anchor.download, "x.txt");
		assert.equal(clicked, true);
		assert.equal(revokedUrl, "blob:test");
		clicked = false;
		downloadJsonFile({ a: 1 }, "a.json");
		assert.equal(anchor.download, "a.json");
		assert.equal(clicked, true);
	} finally {
		global.URL = originalURL;
		global.document = originalDocument;
		global.Blob = originalBlob;
	}
});

await run("storage core helpers sanitize and build identifiers", () => {
	const dirty = '  test<>:"/\\|?*\u0001  name...  ';
	assert.equal(storage.sanitizeName(dirty), "test name");
	assert.match(storage.campaignSlug(" Моя Кампанія !!! "), /^[\p{L}\p{N}-]+$/u);
	assert.equal(
		storage.sessionFileName("Session <> Name").endsWith(".json"),
		true,
	);
	const id1 = storage.createId();
	const id2 = storage.createId();
	assert.notEqual(id1, id2);
	const session = storage.makeDefaultSessionData("My Session");
	assert.equal(session.name, "My Session");
	assert.equal("completed" in session, false);
	assert.equal(storage.campaignDir("../unsafe").includes(".."), false);
});

await run("encounter monster helpers use special HP and detect formulas", () => {
	assert.equal(
		getMonsterBaseHp({
			hp: { special: "80" },
		}),
		80,
	);
	assert.equal(
		createEncounterMonsterInstance({
			name: "Special HP Monster",
			hp: { special: "80" },
		}).hit_points,
		80,
	);
	assert.equal(hasMonsterHpFormula({ hp: { special: "80" } }), false);
	assert.equal(hasMonsterHpFormula({ hp: { formula: "12d8+24" } }), true);
	assert.equal(hasMonsterHpFormula({ hit_dice: "4d10+8" }), true);
});

await run("storage moveEntity transfers characters and preserves data", async () => {
	await withTestSlug("move-entity", async (slug) => {
		await storage.writeEntity(slug, "characters", "hero", {
			id: "hero-id",
			firstName: "Hero",
			lastName: "One",
			notes: [{ id: 1, title: "N", text: "T" }],
		});

		const moved = await storage.moveEntity(slug, "characters", "hero", "npc");

		assert.equal(moved.slug, "hero");
		assert.equal(moved.id, "hero-id");
		assert.equal(moved.firstName, "Hero");
		assert.equal(
			await storage.exists(path.join(storage.campaignDir(slug), "characters", "hero")),
			false,
		);
		assert.equal(
			await storage.exists(path.join(storage.campaignDir(slug), "npc", "hero")),
			true,
		);

		const npcs = await storage.listEntities(slug, "npc");
		assert.equal(npcs.length, 1);
		assert.equal(npcs[0].notes[0].text, "T");
	});
});

await run("storage updates bracketed entity mentions after rename", async () => {
	await withTestSlug("rename-mentions", async (slug) => {
		await storage.ensureDir(path.join(storage.campaignDir(slug), "sessions"));
		await storage.writeJson(storage.campaignMetaPath(slug), {
			id: "campaign-id",
			name: "Mentions",
			description: "Meet [Old Name] in the city.",
		});
		await storage.writeEntity(slug, "characters", "hero", {
			id: "hero-id",
			firstName: "New",
			lastName: "Name",
			motivation: "Formerly [Old Name].",
		});
		await storage.writeEntity(slug, "locations", "city", {
			id: "city-id",
			name: "City",
			description: "Rumors mention [ old   name ].",
		});
		await storage.writeJson(storage.sessionPath(slug, "session.json"), {
			id: "session-id",
			name: "Session",
			data: {
				scenes: [{ summary: "[Old Name] arrives." }],
			},
		});

		await storage.updateCampaignMentionReferences(slug, "Old Name", "New Name");

		const meta = await storage.readCampaign(slug);
		const characters = await storage.listEntities(slug, "characters");
		const locations = await storage.listEntities(slug, "locations");
		const session = await storage.readSession(slug, "session.json");

		assert.equal(meta.description, "Meet [New Name] in the city.");
		assert.equal(characters[0].motivation, "Formerly [New Name].");
		assert.equal(locations[0].description, "Rumors mention [New Name].");
		assert.equal(session.data.scenes[0].summary, "[New Name] arrives.");
	});
});

await run("storage keeps AI response history per campaign", async () => {
	await withTestSlug("ai-history-a", async (firstSlug) => {
		await withTestSlug("ai-history-b", async (secondSlug) => {
			await storage.addAiResponse({
				text: "Відповідь для першої кампанії",
				path: { campaign: firstSlug, session: null, encounter: null },
			});
			await storage.addAiResponse({
				text: "Відповідь для другої кампанії",
				path: { campaign: secondSlug, session: null, encounter: null },
			});

			const firstHistory = await storage.readAiResponses(firstSlug);
			const secondHistory = await storage.readAiResponses(secondSlug);

			assert.equal(firstHistory.length, 1);
			assert.equal(secondHistory.length, 1);
			assert.equal(firstHistory[0].path.campaign, firstSlug);
			assert.equal(secondHistory[0].path.campaign, secondSlug);
			assert.equal(firstHistory[0].text.includes("першої"), true);
			assert.equal(secondHistory[0].text.includes("другої"), true);
		});
	});
});

await run("classNames merges strings arrays objects and falsy values", () => {
	assert.equal(classNames("a", "b"), "a b");
	assert.equal(
		classNames("a", ["b", null, ["c", 1]], { d: true, e: false }),
		"a b c 1 d",
	);
	assert.equal(classNames(null, false, 0, "", { test: 1, hidden: 0 }), "test");
});

await run("image gallery categories expose stable ids and protected folders", () => {
	const ids = IMAGE_GALLERY_CATEGORIES.map((category) => category.id);
	assert.deepEqual(ids, [
		"maps",
		"scenes",
		"tokens",
		"characters",
		"props",
		"notes",
		"attachments",
	]);
	assert.equal(new Set(ids).size, ids.length);
	assert.deepEqual(
		IMAGE_GALLERY_CATEGORIES.find((category) => category.id === "tokens")?.subs,
		["npc", "players"],
	);
	assert.deepEqual(
		IMAGE_GALLERY_CATEGORIES.find((category) => category.id === "characters")
			?.subs,
		["npc", "players"],
	);
});

await run("entity service resolves campaign entities by display names", async () => {
	const entities = [
		{
			type: "characters",
			entity: { firstName: "Hero", lastName: "One" },
		},
		{
			type: "locations",
			entity: { name: "Old Town" },
		},
	];
	assert.equal(findEntityByName(entities, "hero")?.type, "characters");
	assert.equal(findEntityByName(entities, "One")?.type, "characters");
	assert.equal(findEntityByName(entities, "hero one")?.type, "characters");
	assert.equal(findEntityByName(entities, "old town")?.type, "locations");
	assert.equal(findEntityByName(entities, "")?.type, undefined);
	assert.equal(
		getEntityDisplayName({ firstName: "Ім'я", lastName: "Прізвище" }, "npc"),
		"Ім'я Прізвище",
	);
	assert.equal(
		getEntityDisplayName({ name: "Локація" }, "locations"),
		"Локація",
	);
	assert.equal(await resolveEntityByName("", "Hero"), null);

	const originalGetEntities = api.getEntities;
	const calls = [];
	api.getEntities = async (slug, type) => {
		calls.push([slug, type]);
		if (type === "characters") {
			return [{ firstName: "Hero", lastName: "One" }];
		}
		if (type === "npc") {
			throw new Error("npc list unavailable");
		}
		return [{ name: "Old Town" }];
	};

	try {
		const character = await resolveEntityByName("camp", "hero one");
		assert.equal(character?.type, "characters");
		assert.equal(character?.entity.firstName, "Hero");

		const location = await resolveEntityByName("camp", "old town");
		assert.equal(location?.type, "locations");
		assert.deepEqual(calls.map(([, type]) => type).slice(0, 3), [
			"characters",
			"npc",
			"locations",
		]);
	} finally {
		api.getEntities = originalGetEntities;
	}
});

await run("EditableField, Tooltip, and ProjectGuide keep tooltip behavior", async () => {
	const editableFieldSource = await fs.readFile(
		"src/components/form/EditableField.jsx",
		"utf8",
	);
	const projectGuideSource = await fs.readFile(
		"src/components/ProjectGuide.jsx",
		"utf8",
	);
	const mainContentSource = await fs.readFile(
		"src/components/MainContent.jsx",
		"utf8",
	);
	const tooltipSource = await fs.readFile(
		"src/components/common/Tooltip.jsx",
		"utf8",
	);
	const editableFieldCss = await fs.readFile(
		"src/assets/components/EditableField.css",
		"utf8",
	);
	const mainContentCss = await fs.readFile(
		"src/assets/components/MainContent.css",
		"utf8",
	);
	const uk = JSON.parse(await fs.readFile("src/langs/uk.json", "utf8"));

	assert.match(editableFieldSource, /import Tooltip from "\.\.\/common\/Tooltip"/);
	assert.equal(editableFieldSource.includes("HotkeysTooltipContent"), false);
	assert.equal(editableFieldSource.includes("Ctrl+B — Bold"), false);
	assert.match(mainContentSource, /import ProjectGuide from "\.\/ProjectGuide"/);
	assert.match(mainContentSource, /<ProjectGuide \/>/);
	assert.match(projectGuideSource, /const HOTKEYS = \[/);
	assert.match(projectGuideSource, /className="ProjectGuide__hotkeys"/);
	for (const key of [
		"Hotkeys:",
		"Ctrl+K — Add character/NPC/location link",
		"Ctrl+B — Bold",
		"Ctrl+I — Italic",
		"Ctrl+] — List",
		"Ctrl+[ — Remove list",
		"Ctrl+1-6 — Headings",
		"Ctrl+Q — Quote",
		"Ctrl+click to open entity",
	]) {
		assert.equal(typeof uk[key], "string", `${key} is translated`);
	}

	assert.match(editableFieldSource, /data-mention-tooltip/);
	assert.match(editableFieldSource, /onMouseMove=\{handleMouseMove\}/);
	assert.match(editableFieldSource, /anchorElement=\{tooltipAnchor\}/);
	assert.equal(editableFieldSource.includes("replace(/\\n{3,}/g"), false);
	assert.match(editableFieldSource, /paragraph\.push\(""\)/);
	assert.match(editableFieldSource, /normalized\.endsWith\("\\n"\)/);
	assert.equal(editableFieldSource.includes("mention.title ="), false);
	assert.equal(editableFieldSource.includes("title={typeof title"), false);
	assert.equal(editableFieldCss.includes(".EditableField__mention:hover::after"), false);
	assert.equal(editableFieldCss.includes(".EditableField__hotkeysTooltip"), false);
	assert.match(mainContentCss, /\.ProjectGuide__hotkeys/);

	assert.match(tooltipSource, /anchorElement = null/);
	assert.match(tooltipSource, /anchorElement \|\| triggerRef\.current/);
	assert.match(tooltipSource, /const tooltipId = tooltipIdRef\.current/);
	assert.match(tooltipSource, /triggerActiveRef/);
	assert.match(tooltipSource, /!triggerActiveRef\.current \|\| isOpen \|\| disabled \|\| !hasContent/);
});

await run("bestiary search helpers match by name, type and tags", () => {
	const dragon = {
		name: "Young Red Dragon",
		type: {
			type: "dragon",
			tags: ["fire", "chromatic"],
		},
	};
	const chooser = {
		name: "Shifter Beast",
		type: {
			type: { choose: ["fiend", "undead"] },
			tags: ["shapechanger"],
		},
	};

	assert.equal(getMonsterTypeString("beast"), "beast");
	assert.equal(getMonsterTypeString({ type: "dragon" }), "dragon");
	assert.equal(
		getMonsterTypeString({ type: { choose: ["fiend", "undead"] } }),
		"fiend/undead",
	);
	assert.equal(matchesMonsterSearch(dragon, ""), true);
	assert.equal(matchesMonsterSearch(dragon, "red"), true);
	assert.equal(matchesMonsterSearch(dragon, "dragon"), true);
	assert.equal(matchesMonsterSearch(dragon, "chromatic"), true);
	assert.equal(matchesMonsterSearch(dragon, "construct"), false);
	assert.equal(matchesMonsterSearch(chooser, "undead"), true);
	assert.equal(matchesMonsterSearch(chooser, "shapechanger"), true);
});

await run(
	"rollDiceFormula computes deterministic totals keep suffix and critical",
	() => {
		const originalRandom = Math.random;
		const originalNow = Date.now;
		let idx = 0;
		const randomValues = [0, 0.5, 0, 0, 0.5, 0.99];

		Math.random = () => randomValues[idx++];
		Date.now = () => 12345;

		try {
			const basic = rollDiceFormula("2d6 + 3 - 1");
			assert.equal(basic.id, 12345);
			assert.equal(basic.formula, "2d6 + 2");
			assert.equal(basic.total, 7);
			assert.equal(basic.average, 9);
			assert.equal(basic.isCritical, false);
			assert.equal(basic.breakdown.length, 4);

			const critical = rollDiceFormula("1d20+5");
			assert.equal(critical.isCritical, true);
			assert.equal(critical.total, 1);
			assert.equal(critical.formula, "1d20 + 5");

			const keepHighest = rollDiceFormula("3d6h2");
			assert.equal(keepHighest.total, 10);
			assert.equal(keepHighest.average, 7);
			assert.equal(
				keepHighest.breakdown.filter((entry) => entry.dropped).length,
				1,
			);

			assert.equal(rollDiceFormula(""), null);
			const unknown = rollDiceFormula("abc");
			assert.equal(unknown.total, 0);
			assert.equal(unknown.formula, "");
		} finally {
			Math.random = originalRandom;
			Date.now = originalNow;
		}
	},
);

await run(
	"conditions and reference resolvers use normalized keys and cache",
	async () => {
		const originalSearchSpells = api.searchSpells;
		const originalGetConditions = api.getConditions;
		const originalGetDiseases = api.getDiseases;
		const originalGetVariantRules = api.getVariantRules;
		const originalGetSkills = api.getSkills;
		const originalGetSenses = api.getSenses;
		let spellCalls = 0;
		let conditionCalls = 0;
		let diseaseCalls = 0;
		let variantRuleCalls = 0;
		let skillCalls = 0;
		let senseCalls = 0;

		api.searchSpells = async (params = {}) => {
			spellCalls += 1;
			if (String(params.name || "").includes("magic missile")) {
				return [
					{ name: "Magic Missile|PHB", source: "PHB" },
					{ name: "Magic Missile|XPHB", source: "XPHB" },
				];
			}
			return [{ name: "Shield|PHB", source: "PHB" }];
		};

		api.getConditions = async () => {
			conditionCalls += 1;
			if (conditionCalls === 1) {
				throw new Error("temporary");
			}
			return [
				{ name: "Prone", entries: ["..."] },
				{ name: "Blinded", entries: ["..."] },
			];
		};

		api.getDiseases = async () => {
			diseaseCalls += 1;
			return [
				{ name: "Bluerot", entries: ["..."] },
				{ name: "Sight Rot", entries: ["..."] },
			];
		};

		api.getVariantRules = async () => {
			variantRuleCalls += 1;
			return [
				{ name: "Advantage", entries: ["..."] },
				{ name: "Cone [Area of Effect]", entries: ["..."] },
			];
		};

		api.getSkills = async () => {
			skillCalls += 1;
			return [
				{ name: "Medicine", ability: "wis", entries: ["..."] },
				{ name: "Perception", ability: "wis", entries: ["..."] },
			];
		};

		api.getSenses = async () => {
			senseCalls += 1;
			return [
				{ name: "Darkvision", entries: ["..."] },
				{ name: "Truesight", entries: ["..."] },
			];
		};

		try {
			assert.equal(normalizeConditionName("  BLINDED "), "blinded");
			await assert.rejects(() => loadConditionsMap(), /temporary/);

			const conditionMap = await loadConditionsMap();
			assert.equal(conditionCalls, 2);
			assert.equal(conditionMap.get("prone")?.name, "Prone");
			const sameMap = await loadConditionsMap();
			assert.equal(sameMap, conditionMap);
			assert.equal(conditionCalls, 2);

			const spell = await getSpellByName(" Magic Missile ");
			assert.equal(spell?.name, "Magic Missile|PHB");
			const sameSpell = await getSpellByName("magic missile|xphb");
			assert.equal(sameSpell?.name, "Magic Missile|PHB");
			assert.equal(spellCalls, 1);

			assert.equal(
				(await resolveSpellInput({ name: "Manual Spell" })).name,
				"Manual Spell",
			);
			assert.equal((await resolveSpellInput("Shield")).name, "Shield|PHB");
			assert.equal(await resolveSpellInput(""), null);
			assert.equal(await resolveSpellInput(123), null);

			assert.equal((await getConditionByName(" prone ")).name, "Prone");
			assert.equal(
				(await resolveConditionInput({ name: "Stunned", entries: ["text"] }))
					.name,
				"Stunned",
			);
			assert.equal((await resolveConditionInput("Prone")).name, "Prone");
			assert.equal(await resolveConditionInput({ foo: "bar" }), null);

			assert.equal((await getDiseaseByName(" bluerot|GoS ")).name, "Bluerot");
			assert.equal(conditionCalls, 2);
			assert.equal(diseaseCalls, 1);
			assert.equal((await resolveDiseaseInput("Sight Rot")).name, "Sight Rot");
			assert.equal(
				(await resolveDiseaseInput({ name: "Manual Disease", entries: ["text"] }))
					.name,
				"Manual Disease",
			);
			assert.equal(await resolveDiseaseInput({ foo: "bar" }), null);

			assert.equal(
				(await getVariantRuleByName(" cone [area of effect]|XPHB ")).name,
				"Cone [Area of Effect]",
			);
			assert.equal(variantRuleCalls, 1);
			assert.equal(
				(await resolveVariantRuleInput("Advantage")).name,
				"Advantage",
			);
			assert.equal(
				(await resolveVariantRuleInput({ name: "Manual Rule", entries: ["text"] }))
					.name,
				"Manual Rule",
			);
			assert.equal(await resolveVariantRuleInput({ foo: "bar" }), null);

			assert.equal((await getSkillByName(" medicine|XPHB ")).name, "Medicine");
			assert.equal(skillCalls, 1);
			assert.equal((await resolveSkillInput("Perception")).name, "Perception");
			assert.equal(
				(await resolveSkillInput({ name: "Manual Skill", entries: ["text"] }))
					.name,
				"Manual Skill",
			);
			assert.equal(await resolveSkillInput({ foo: "bar" }), null);

			assert.equal((await getSenseByName(" darkvision|XPHB ")).name, "Darkvision");
			assert.equal(senseCalls, 1);
			assert.equal((await resolveSenseInput("Truesight")).name, "Truesight");
			assert.equal(
				(await resolveSenseInput({ name: "Manual Sense", entries: ["text"] }))
					.name,
				"Manual Sense",
			);
			assert.equal(await resolveSenseInput({ foo: "bar" }), null);
		} finally {
			api.searchSpells = originalSearchSpells;
			api.getConditions = originalGetConditions;
			api.getDiseases = originalGetDiseases;
			api.getVariantRules = originalGetVariantRules;
			api.getSkills = originalGetSkills;
			api.getSenses = originalGetSenses;
		}
	},
);

await run(
	"spells conditions route merges kinds and prefers newer sources",
	async () => {
		const originalExists = storage.exists;
		const originalReadJson = storage.readJson;
		const layer = spellsRouter.stack.find(
			(item) => item.route?.path === "/conditions",
		);
		assert.ok(layer);
		const handler = layer.route.stack[0].handle;

		storage.exists = async () => true;
		storage.readJson = async () => ({
			condition: [
				{ name: "Blinded", source: "PHB", page: 1, entries: ["old"] },
				{ name: "Blinded", source: "XPHB", page: 2, entries: ["new"] },
			],
			status: [
				{ name: "Concentration", source: "PHB", page: 3, entries: ["status"] },
			],
		});

		try {
			let jsonPayload = null;
			await handler(
				{},
				{
					json(value) {
						jsonPayload = value;
						return value;
					},
				},
				(error) => {
					throw error;
				},
			);

			assert.ok(Array.isArray(jsonPayload));
			assert.equal(jsonPayload.length, 2);
			assert.deepEqual(
				jsonPayload.map((item) => item.name),
				["Blinded", "Concentration"],
			);

			const blinded = jsonPayload.find((item) => item.name === "Blinded");
			const concentration = jsonPayload.find(
				(item) => item.name === "Concentration",
			);
			assert.equal(blinded.kind, "condition");
			assert.equal(blinded.source, "XPHB");
			assert.deepEqual(blinded.entries, ["new"]);
			assert.equal(concentration.kind, "status");
			assert.equal(concentration.source, "PHB");
		} finally {
			storage.exists = originalExists;
			storage.readJson = originalReadJson;
		}
	},
);

await run("spells diseases route returns deduped disease list", async () => {
	const originalExists = storage.exists;
	const originalReadJson = storage.readJson;
	const layer = spellsRouter.stack.find((item) => item.route?.path === "/diseases");
	assert.ok(layer);
	const handler = layer.route.stack[0].handle;

	storage.exists = async () => true;
	storage.readJson = async () => ({
		disease: [
			{ name: "Sight Rot", source: "DMG", page: 257, entries: ["old"] },
			{ name: "Sight Rot", source: "XDMG", page: 61, entries: ["new"] },
			{ name: "Bluerot", source: "GoS", page: 234, entries: ["blue"] },
		],
	});

	try {
		let jsonPayload = null;
		await handler(
			{},
			{
				json(value) {
					jsonPayload = value;
					return value;
				},
			},
			(error) => {
				throw error;
			},
		);

		assert.ok(Array.isArray(jsonPayload));
		assert.deepEqual(
			jsonPayload.map((item) => item.name),
			["Bluerot", "Sight Rot"],
		);

		const sightRot = jsonPayload.find((item) => item.name === "Sight Rot");
		assert.equal(sightRot.kind, "disease");
		assert.equal(sightRot.source, "XDMG");
		assert.deepEqual(sightRot.entries, ["new"]);
	} finally {
		storage.exists = originalExists;
		storage.readJson = originalReadJson;
	}
});

await run("spells variant rules route returns rule list", async () => {
	const originalExists = storage.exists;
	const originalReadJson = storage.readJson;
	const layer = spellsRouter.stack.find(
		(item) => item.route?.path === "/variantrules",
	);
	assert.ok(layer);
	const handler = layer.route.stack[0].handle;

	storage.exists = async () => true;
	storage.readJson = async () => ({
		variantrule: [
			{ name: "Advantage", entries: ["adv"] },
			{ name: "Cone [Area of Effect]", entries: ["cone"] },
		],
	});

	try {
		let jsonPayload = null;
		await handler(
			{},
			{
				json(value) {
					jsonPayload = value;
					return value;
				},
			},
			(error) => {
				throw error;
			},
		);

		assert.ok(Array.isArray(jsonPayload));
		assert.deepEqual(
			jsonPayload.map((item) => item.name),
			["Advantage", "Cone [Area of Effect]"],
		);
		assert.equal(jsonPayload[0].kind, "variantrule");
		assert.deepEqual(jsonPayload[0].entries, ["adv"]);
	} finally {
		storage.exists = originalExists;
		storage.readJson = originalReadJson;
	}
});

await run("spells skills route returns skill list", async () => {
	const originalExists = storage.exists;
	const originalReadJson = storage.readJson;
	const layer = spellsRouter.stack.find((item) => item.route?.path === "/skills");
	assert.ok(layer);
	const handler = layer.route.stack[0].handle;

	storage.exists = async () => true;
	storage.readJson = async () => ({
		skill: [
			{ name: "Medicine", ability: "wis", entries: ["med"] },
			{ name: "Arcana", ability: "int", entries: ["arc"] },
		],
	});

	try {
		let jsonPayload = null;
		await handler(
			{},
			{
				json(value) {
					jsonPayload = value;
					return value;
				},
			},
			(error) => {
				throw error;
			},
		);

		assert.ok(Array.isArray(jsonPayload));
		assert.deepEqual(
			jsonPayload.map((item) => item.name),
			["Arcana", "Medicine"],
		);
		assert.equal(jsonPayload[0].kind, "skill");
		assert.equal(jsonPayload[0].ability, "int");
		assert.deepEqual(jsonPayload[0].entries, ["arc"]);
	} finally {
		storage.exists = originalExists;
		storage.readJson = originalReadJson;
	}
});

await run("spells senses route returns sense list", async () => {
	const originalExists = storage.exists;
	const originalReadJson = storage.readJson;
	const layer = spellsRouter.stack.find((item) => item.route?.path === "/senses");
	assert.ok(layer);
	const handler = layer.route.stack[0].handle;

	storage.exists = async () => true;
	storage.readJson = async () => ({
		sense: [
			{ name: "Darkvision", source: "PHB", entries: ["old"] },
			{ name: "Darkvision", source: "XPHB", entries: ["new"] },
			{ name: "Blindsight", source: "PHB", entries: ["blind"] },
		],
	});

	try {
		let jsonPayload = null;
		await handler(
			{},
			{
				json(value) {
					jsonPayload = value;
					return value;
				},
			},
			(error) => {
				throw error;
			},
		);

		assert.ok(Array.isArray(jsonPayload));
		assert.deepEqual(
			jsonPayload.map((item) => item.name),
			["Blindsight", "Darkvision"],
		);

		const darkvision = jsonPayload.find((item) => item.name === "Darkvision");
		assert.equal(darkvision.kind, "sense");
		assert.equal(darkvision.source, "XPHB");
		assert.deepEqual(darkvision.entries, ["new"]);
	} finally {
		storage.exists = originalExists;
		storage.readJson = originalReadJson;
	}
});

await run("storage image listing and subcategory discovery", async () => {
	await withTestSlug("images-list", async (slug) => {
		const category = "characters";
		const rootDir = storage.campaignImagesDir(slug, category);
		const nestedDir = storage.campaignImagesDir(slug, category, "nested");
		await storage.ensureDir(rootDir);
		await storage.ensureDir(nestedDir);
		await fs.writeFile(path.join(rootDir, "a.png"), "a", "utf8");
		await fs.writeFile(path.join(rootDir, "b.txt"), "b", "utf8");
		await fs.writeFile(path.join(nestedDir, "c.webp"), "c", "utf8");

		const rootImages = await storage.listImages(slug, category);
		assert.deepEqual(
			rootImages.map((item) => item.name),
			["a.png"],
		);
		assert.match(rootImages[0].url, /\/api\/images\//);
		assert.equal(rootImages[0].path, path.join(category, "", "a.png"));

		const subcategories = await storage.listSubcategories(slug, category);
		assert.deepEqual(subcategories, ["nested"]);
		const nestedImages = await storage.listImages(slug, category, "nested");
		assert.deepEqual(
			nestedImages.map((item) => item.name),
			["c.webp"],
		);
	});
});

await run("storage detects campaign images recursively", async () => {
	await withTestSlug("campaign-has-images", async (slug) => {
		const category = "attachments";
		const nestedDir = storage.campaignImagesDir(slug, category, "notes/nested");

		assert.equal(await storage.campaignHasImages(slug), false);

		await storage.ensureDir(nestedDir);
		assert.equal(await storage.campaignHasImages(slug), false);

		await fs.writeFile(path.join(nestedDir, "map.png"), "x", "utf8");
		assert.equal(await storage.campaignHasImages(slug), true);
	});
});

await run("storage renameImage handles success and collisions", async () => {
	await withTestSlug("rename-image", async (slug) => {
		const category = "attachments";
		const subcategory = "folder";
		const dir = storage.campaignImagesDir(slug, category, subcategory);
		await storage.ensureDir(dir);
		await fs.writeFile(path.join(dir, "old.png"), "x", "utf8");
		await fs.writeFile(path.join(dir, "existing.png"), "y", "utf8");

		const result = await storage.renameImage(
			slug,
			category,
			subcategory,
			"old.png",
			"new.png",
		);
		assert.match(result.oldUrl, /old\.png$/);
		assert.match(result.newUrl, /new\.png$/);
		assert.equal(await storage.exists(path.join(dir, "new.png")), true);
		assert.equal(await storage.exists(path.join(dir, "old.png")), false);

		await assert.rejects(() =>
			storage.renameImage(slug, category, subcategory, "missing.png", "x.png"),
		);
		await assert.rejects(() =>
			storage.renameImage(
				slug,
				category,
				subcategory,
				"new.png",
				"existing.png",
			),
		);
	});
});

await run("storage moveImages moves files and directories", async () => {
	await withTestSlug("move-images", async (slug) => {
		const category = "characters";
		const srcSubcategory = "src";
		const destSubcategory = "dest";
		const srcDir = storage.campaignImagesDir(slug, category, srcSubcategory);
		await storage.ensureDir(path.join(srcDir, "pack", "nested"));
		await fs.writeFile(path.join(srcDir, "a.png"), "a", "utf8");
		await fs.writeFile(
			path.join(srcDir, "pack", "nested", "b.png"),
			"b",
			"utf8",
		);

		const results = await storage.moveImages(
			["a.png", "pack"],
			{ slug, category, subcategory: srcSubcategory },
			{ slug, category, subcategory: destSubcategory },
		);

		assert.equal(results.length, 2);
		assert.equal(await storage.exists(path.join(srcDir, "a.png")), false);
		assert.equal(await storage.exists(path.join(srcDir, "pack")), false);
		assert.equal(
			await storage.exists(
				path.join(
					storage.campaignImagesDir(slug, category, destSubcategory),
					"a.png",
				),
			),
			true,
		);
		assert.equal(
			await storage.exists(
				path.join(
					storage.campaignImagesDir(slug, category, destSubcategory),
					"pack",
					"nested",
					"b.png",
				),
			),
			true,
		);
	});
});

await run(
	"storage deleteImages removes folders or extracts contents",
	async () => {
		await withTestSlug("delete-images", async (slug) => {
			const category = "tokens";
			const baseSubcategory = "root";
			const baseDir = storage.campaignImagesDir(
				slug,
				category,
				baseSubcategory,
			);
			await storage.ensureDir(path.join(baseDir, "dropme", "nested"));
			await storage.ensureDir(path.join(baseDir, "extractme", "inner"));
			await fs.writeFile(
				path.join(baseDir, "dropme", "nested", "a.png"),
				"a",
				"utf8",
			);
			await fs.writeFile(path.join(baseDir, "extractme", "b.png"), "b", "utf8");
			await fs.writeFile(
				path.join(baseDir, "extractme", "inner", "c.png"),
				"c",
				"utf8",
			);

			await storage.deleteImages(
				["dropme"],
				{ slug, category, subcategory: baseSubcategory },
				{ extractFolderContents: false },
			);
			assert.equal(await storage.exists(path.join(baseDir, "dropme")), false);

			await storage.deleteImages(
				["extractme"],
				{ slug, category, subcategory: baseSubcategory },
				{ extractFolderContents: true },
			);
			assert.equal(
				await storage.exists(path.join(baseDir, "extractme")),
				false,
			);
			assert.equal(await storage.exists(path.join(baseDir, "b.png")), true);
			assert.equal(
				await storage.exists(path.join(baseDir, "inner", "c.png")),
				true,
			);
		});
	},
);

await run(
	"storage renameSubcategory validates source and destination",
	async () => {
		await withTestSlug("rename-subcategory", async (slug) => {
			const category = "attachments";
			const root = storage.campaignImagesDir(slug, category);
			await storage.ensureDir(path.join(root, "old"));
			await storage.ensureDir(path.join(root, "taken"));

			await assert.rejects(() =>
				storage.renameSubcategory(slug, category, "missing", "target"),
			);
			await assert.rejects(() =>
				storage.renameSubcategory(slug, category, "old", "taken"),
			);

			await storage.renameSubcategory(slug, category, "old", "renamed");
			assert.equal(await storage.exists(path.join(root, "renamed")), true);
			assert.equal(await storage.exists(path.join(root, "old")), false);
		});
	},
);

await run(
	"storage updates campaign entities and session references after rename",
	async () => {
		await withTestSlug("ref-update", async (slug) => {
			const category = "characters";
			const subcategory = "players";
			const imagesDir = storage.campaignImagesDir(slug, category, subcategory);
			await storage.ensureDir(imagesDir);
			await fs.writeFile(path.join(imagesDir, "old.png"), "x", "utf8");

			const oldUrl = `/api/images/${encodeURIComponent(slug)}/${encodeURIComponent(category)}/${subcategory}/old.png`;
			const expectedNewUrl = `/api/images/${encodeURIComponent(slug)}/${encodeURIComponent(category)}/${subcategory}/new.png`;

			await storage.ensureDir(path.join(storage.campaignDir(slug), "sessions"));
			await storage.writeJson(storage.campaignMetaPath(slug), {
				id: `${slug}-id`,
				name: "Test Campaign",
				slug,
				imageUrl: oldUrl,
			});
			await storage.writeEntity(slug, "characters", "hero", {
				id: "hero-1",
				firstName: "Hero",
				lastName: "One",
				level: 1,
				race: "Human",
				class: "Fighter",
				imageUrl: oldUrl,
			});
			await storage.writeEntity(slug, "locations", "city", {
				id: "city-1",
				name: "City",
				description: "A test location",
				imageUrl: oldUrl,
			});

			const sessionFile = "session.json";
			await storage.writeJson(storage.sessionPath(slug, sessionFile), {
				id: "s1",
				name: "Session 1",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				order: 0,
				data: {
					notes: [
						{ id: 1, title: "", text: `image ${oldUrl}`, collapsed: false },
					],
				},
			});

			await storage.renameImage(
				slug,
				category,
				subcategory,
				"old.png",
				"new.png",
			);

			const meta = await storage.readCampaign(slug);
			assert.equal(meta.imageUrl, expectedNewUrl);
			const entities = await storage.listEntities(slug, "characters");
			assert.equal(entities[0].imageUrl, expectedNewUrl);
			const locations = await storage.listEntities(slug, "locations");
			assert.equal(locations[0].imageUrl, expectedNewUrl);
			const session = await storage.readSession(slug, sessionFile);
			assert.equal(JSON.stringify(session).includes(expectedNewUrl), true);
			assert.equal(JSON.stringify(session).includes(oldUrl), false);
		});
	},
);

const failed = results.filter((r) => !r.ok);
console.log(
	`\nTotal: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`,
);

if (failed.length > 0) {
	process.exitCode = 1;
}
