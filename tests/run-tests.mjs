import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import {
	$applyNodeReplacement,
	$createParagraphNode,
	$getRoot,
	$getSelection,
	$isRangeSelection,
	COMMAND_PRIORITY_HIGH,
	KEY_DOWN_COMMAND,
	TextNode,
	createEditor,
} from "lexical";

import { idsEqual } from "../src/shared/lib/id.js";
import { isJsonObject, isJsonString } from "../src/shared/lib/json.js";
import {
	matchesMonsterSearch,
	getMonsterTypeString,
	MonsterStatBlockModel,
} from "../src/entities/bestiary/model.js";
import { bestiaryApi } from "../src/entities/bestiary/api.js";
import { archiveApi } from "../src/entities/archive/api.js";
import { rulesReferenceApi } from "../src/entities/rules-reference/api.js";
import { spellApi } from "../src/entities/spell/api.js";
import { settingsApi } from "../src/entities/settings/api.js";
import {
	httpClient,
	isAbortError,
} from "../src/shared/api/index.js";
import classNames from "../src/shared/lib/classNames.js";
import {
	getDiceProbabilityDistribution,
	rollDiceFormula,
} from "../src/utils/dice.js";
import { extractContentTokens } from "../src/utils/contentTokens.js";
import { preprocessTags } from "../src/utils/parserTags.js";
import {
	addUndoSnapshot,
	createDistinctRedoTransition,
	createDistinctUndoTransition,
	createRedoTransition,
	createUndoTransition,
	isHistoryShortcutEvent,
	shouldUseAppHistoryForEvent,
} from "../src/shared/lib/undoRedo.js";
import {
	normalizeConditionName,
	loadConditionsMap,
} from "../src/entities/rules-reference/model.js";
import {
	createEmptyNote as createModelEmptyNote,
	getNoteRenderKey,
	getNotesForRender,
	isNoteEmpty,
	isVirtualNoteId,
	sanitizeNotesForSave,
	upsertNoteById,
} from "../src/utils/noteUtils.js";
import {
	MENTION_BOUNDARY,
	createMentionBoundaryNode,
	handleSpaceAfterMention,
} from "../src/shared/lib/mentionEditor.js";
import {
	buildNavigationUrl,
	parseUrl,
	shouldOpenInNewTabFromEvent,
} from "../src/shared/lib/navigation.js";
import {
	downloadBlob,
	downloadJsonFile,
} from "../src/shared/lib/download.js";
import {
	buildEncounterGridModel,
	createEncounterMonsterInstance,
	ensureEncounterMonsterId,
	getMonsterBaseHp,
	hasMonsterHpFormula,
} from "../src/entities/encounter/model.js";
import {
	addSourceMonsterImageToDraft,
	getFirstChangedMonster,
	getFirstChangedMonsterName,
	isAiResponseVisibleForRoute,
	updateDraftResourceAfterValues,
} from "../src/entities/ai/model.js";
import {
	getSpellByName,
	getConditionByName,
	getDiseaseByName,
	getSenseByName,
	getSkillByName,
	getVariantRuleByName,
	resolveSpellInput,
	resolveConditionInput,
	resolveDiseaseInput,
	resolveSenseInput,
	resolveSkillInput,
	resolveVariantRuleInput,
} from "../src/features/reference-navigation/model.js";
import {
	buildCampaignGraph,
	extractBracketMentions,
	getCampaignGraphNodeSize,
	layoutCampaignGraph,
	normalizeGraphName,
	resolveCampaignGraphNodeCollision,
} from "../src/entities/campaign/graph.js";
import { SessionViewModel } from "../src/entities/session/model.js";
import { SpellCardModel } from "../src/entities/spell/model.js";
import {
	areHistoryStatesEqual,
	CardNoteModel,
	CampaignViewModel,
	campaignHistoryPayload,
	CharacterCardModel,
	cloneHistoryList,
	findEntityByName,
	filterGlobalSearchIndex,
	GLOBAL_SEARCH_RESULT_LIMIT,
	getEntityDisplayName,
	getLocationDisplayName as getCampaignLocationDisplayName,
	LocationCardModel,
	normalizeMentionName,
	replaceBracketedMentionNames,
	replaceMentionsInValue,
	sanitizeEntityForSave,
	sanitizeLoadedEntity,
} from "../src/entities/campaign/model.js";
import { filterBestiaryMonsters } from "../src/features/bestiary/model.js";
import { filterSpells } from "../src/features/spells/model.js";
import { IMAGE_GALLERY_CATEGORIES } from "../src/entities/image/model.js";
import {
	campaignApi,
	resolveEntityByName,
} from "../src/entities/campaign/api.js";
import { sessionApi } from "../src/entities/session/api.js";
import { mapWithConcurrency } from "../src/shared/lib/index.js";

const require = createRequire(import.meta.url);
const {
	ensureDir,
	exists,
	readJson,
	writeJson,
} = require("../server/infrastructure/jsonFileStore.js");
const {
	CAMPAIGNS_DIR,
	DATA_DIR,
	IMAGES_DIR,
	aiResponsesPath,
	campaignAiResponsesPath,
	campaignDir,
	campaignImagesDir,
	campaignMetaPath,
	campaignSlug,
	sanitizeName,
	sessionFileName,
	sessionPath,
} = require("../server/infrastructure/storagePaths.js");
const {
	createReferenceDataRepository,
} = require("../server/domains/reference/referenceDataRepository.js");
const {
	createBestiaryReferenceRepository,
} = require("../server/domains/bestiary/bestiaryReferenceRepository.js");
const {
	createCustomBestiaryRepository,
	normalizeCustomBestiaryMonster,
} = require("../server/domains/bestiary/customBestiaryRepository.js");
const {
	createSessionRepository,
	listSessions,
	makeDefaultSessionData,
	readSession,
} = require("../server/domains/session/sessionRepository.js");
const {
	validateSessionMutation,
	validateSessionReorder,
} = require("../server/domains/session/sessionRequestSchemas.js");
const {
	createCampaignRepository,
	readCampaign,
} = require("../server/domains/campaign/campaignRepository.js");
const campaignRepository = require("../server/domains/campaign/campaignRepository.js");
const {
	validateCampaignCreate,
	validateCampaignPatch,
	validateEntityMove,
	validateReorderRequest,
} = require("../server/domains/campaign/campaignRequestSchemas.js");
const {
	createEntityRepository,
	listEntities,
	moveEntity,
	updateCampaignMentionReferences,
	writeEntity,
} = require("../server/domains/entity/entityRepository.js");
const {
	createImageReferenceService,
} = require("../server/domains/image/imageReferenceService.js");
const {
	createImageAssetRepository,
	campaignHasImages,
	deleteImages,
	listImages,
	listSubcategories,
	moveImages,
	renameImage,
	renameSubcategory,
} = require("../server/domains/image/imageAssetRepository.js");
const {
	createImageGalleryReadService,
	listBestiaryTokenAssets,
	searchImageGalleryAssets,
} = require("../server/domains/image/imageGalleryReadService.js");
const {
	createCampaignLifecycleService,
	renameCampaignData,
} = require("../server/domains/campaign/campaignLifecycleService.js");
const archiveExportService = require("../server/domains/archive/archiveExportService.js");
const {
	createArchiveExportService,
} = archiveExportService;
const {
	createArchiveImportService,
	importCampaignPartialArchiveBundle,
} = require("../server/domains/archive/archiveImportService.js");
const {
	validateCampaignArchiveEnvelope,
	validateCampaignBundleCollection,
	validatePartialArchiveBundle,
} = require("../server/domains/archive/archiveRequestSchemas.js");
const archiveImportService = require("../server/domains/archive/archiveImportService.js");
const {
	RequestValidationError,
	assertValidRequest,
} = require("../server/http/requestValidation.js");
const {
	createAiApplyAggregateService,
} = require("../server/domains/ai/aiApplyAggregateService.js");
const {
	addAiResponse,
	clearAiResponses,
	createAiResponseRepository,
	deleteAiResponse,
	readAiResponses,
	updateAiResponse,
} = require("../server/domains/ai/aiResponseRepository.js");
const {
	dispatchAiOperations,
} = require("../server/domains/ai/aiOperationDispatcher.js");
const {
	createCustomMonsterPatchService,
} = require("../server/domains/ai/customMonsterPatchService.js");
const {
	createEncounterPatchService,
} = require("../server/domains/ai/encounterPatchService.js");
const {
	createCampaignEntityGateway,
} = require("../server/domains/ai/campaignEntityGateway.js");
const {
	createNotePatchService,
} = require("../server/domains/ai/notePatchService.js");
const {
	createAiContentNormalizer,
} = require("../server/domains/ai/aiContentNormalizer.js");
const {
	createEntityPatchService,
} = require("../server/domains/ai/entityPatchService.js");
const {
	createScenePatchService,
} = require("../server/domains/ai/scenePatchService.js");
const backupsRouter = require("../server/routes/backups.js");
const campaignsRouter = require("../server/routes/campaigns.js");
const sessionsRouter = require("../server/routes/sessions.js");
const aiRouter = require("../server/routes/ai.js");
const bestiaryRouter = require("../server/routes/bestiary.js");
const aiService = require("../server/aiService.js");
const aiHistoryService = require("../server/aiHistoryService.js");
const aiResponseHistoryService = require("../server/aiResponseHistoryService.js");
const aiPatchService = require("../server/aiPatchService.js");
const { buildAiChangeSummary } = require("../server/ai/aiChangeSummary.js");
const { AiHistoryWriter } = require("../server/ai/AiHistoryWriter.js");
const aiPayloadSchemas = require("../server/aiPayloadSchemas.js");
const {
	buildLocalEncounterMonsterSessionChange,
} = require("../server/ai/EncounterLocalMonsterAiFlow.js");

const results = [];
const TEST_PREFIX = `autotest-${Date.now()}`;
const TEST_FILTER = String(process.env.TEST_FILTER || "")
	.trim()
	.toLowerCase();

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
	if (
		next.length === 0 ||
		(last && (last.text?.trim() || last.title?.trim()))
	) {
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
	await fs.rm(path.join(IMAGES_DIR, slug), {
		recursive: true,
		force: true,
	});
	await fs.rm(campaignDir(slug), { recursive: true, force: true });
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
	if (TEST_FILTER && !name.toLowerCase().includes(TEST_FILTER)) return;
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
	assert.equal(isVirtualNoteId(regularRender[1].id), true);
	assert.equal(getNotesForRender(withTitleOnly)[1].id, regularRender[1].id);

	const simplifiedRender = getNotesForRender(withTitleOnly, {
		simplifiedNotes: true,
	});
	assert.equal(simplifiedRender.length, 1);

	const updated = upsertNoteById([], "new", { text: "Body" });
	assert.deepEqual(updated, [
		{ id: "new", title: "", text: "Body", collapsed: false },
	]);

	const materialized = upsertNoteById([], regularRender[1].id, {
		text: "[Mention]",
	});
	assert.equal(materialized.length, 1);
	assert.equal(isVirtualNoteId(materialized[0].id), false);
	assert.equal(materialized[0]._renderKey, regularRender[1].id);
	assert.equal(getNoteRenderKey(materialized[0]), regularRender[1].id);
	assert.equal(materialized[0].text, "[Mention]");

	const numericNote = { id: 42, title: "Existing", text: "" };
	const numericVirtualNote = getNotesForRender([numericNote])[1];
	const distinctMaterialized = upsertNoteById(
		[numericNote],
		numericVirtualNote.id,
		{ text: "New note" },
	);
	assert.notEqual(distinctMaterialized[1].id, numericNote.id);
	assert.equal(
		upsertNoteById(distinctMaterialized, distinctMaterialized[1].id, {
			text: "Updated note",
		})[1].text,
		"Updated note",
	);
	assert.equal(distinctMaterialized[0].text, "");

	const sanitized = sanitizeNotesForSave([
		{ id: "empty", title: "", text: "", collapsed: false, _isVirtual: true },
		{
			id: "filled",
			title: "T",
			text: "",
			collapsed: true,
			_isVirtual: true,
			_renderKey: "__virtual_note__:empty",
		},
	]);
	assert.deepEqual(sanitized, [
		{ id: "filled", title: "T", text: "", collapsed: true },
	]);
});

await run("mention editor inserts Space after a link in the active command", async () => {
	class TestMentionNode extends TextNode {
		static getType() {
			return "test-mention";
		}

		static clone(node) {
			return new TestMentionNode(node.__text, node.__key);
		}

		canInsertTextBefore() {
			return false;
		}

		canInsertTextAfter() {
			return false;
		}

		isTextEntity() {
			return true;
		}
	}

	const editor = createEditor({
		namespace: "mention-space-test",
		nodes: [TestMentionNode],
		onError: (error) => {
			throw error;
		},
	});
	const isMentionNode = (node) => node instanceof TestMentionNode;

	editor.update(
		() => {
			const mention = $applyNodeReplacement(
				new TestMentionNode("Link"),
			).setMode("token");
			const boundary = createMentionBoundaryNode();
			$getRoot().append($createParagraphNode().append(mention, boundary));
			boundary.select(1, 1);
		},
		{ discrete: true },
	);

	editor.registerCommand(
		KEY_DOWN_COMMAND,
		(event) => handleSpaceAfterMention(event, isMentionNode),
		COMMAND_PRIORITY_HIGH,
	);

	const spaceEvent = {
		key: " ",
		code: "Space",
		defaultPrevented: false,
		preventDefault() {
			this.defaultPrevented = true;
		},
	};
	assert.equal(editor.dispatchCommand(KEY_DOWN_COMMAND, spaceEvent), true);
	assert.equal(spaceEvent.defaultPrevented, true);
	await new Promise((resolve) => setTimeout(resolve, 0));

	let textAfterSpace = "";
	let selectionOffset = null;
	editor.getEditorState().read(() => {
		textAfterSpace = $getRoot().getTextContent();
		const selection = $getSelection();
		selectionOffset = $isRangeSelection(selection)
			? selection.anchor.offset
			: null;
	});
	assert.equal(
		textAfterSpace,
		`Link${MENTION_BOUNDARY} ${MENTION_BOUNDARY}`,
	);
	assert.equal(selectionOffset, 2);

	editor.update(
		() => {
			const selection = $getSelection();
			assert.equal($isRangeSelection(selection), true);
			selection.insertText("x");
		},
		{ discrete: true },
	);
	assert.equal(
		editor
			.getEditorState()
			.read(() => $getRoot().getTextContent())
			.replaceAll(MENTION_BOUNDARY, ""),
		"Link x",
	);
});

await run(
	"parseUrl supports campaign/session/encounter routes",
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
				campaign: null,
				session: null,
				encounter: null,
			});
			global.window = { location: { pathname: "/spells" } };
			assert.deepEqual(parseUrl(), {
				campaign: null,
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
		assert.equal(buildNavigationUrl("bestiary"), "/campaign/bestiary");
		assert.equal(buildNavigationUrl("spells"), "/campaign/spells");
		assert.equal(
			buildNavigationUrl("camp", "sess 1", "enc-1"),
			"/campaign/camp/session/sess%201/encounter/enc-1",
		);
	},
);

await run("CampaignViewModel formats links and creation date", () => {
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
});

await run("campaign graph has campaign entity ownership", async () => {
	for (const ownedPath of [
		"src/entities/campaign/graph.js",
		"src/entities/campaign/model/campaignGraph.js",
		"src/entities/campaign/model/campaignGraphLayout.js",
	]) {
		await fs.access(ownedPath);
	}
	for (const legacyPath of [
		"src/utils/campaignGraph.js",
		"src/utils/campaignGraphLayout.js",
	]) {
		await assert.rejects(
			fs.access(legacyPath),
			(error) => error.code === "ENOENT",
		);
	}

	const graphApiSource = await fs.readFile(
		"src/entities/campaign/graph.js",
		"utf8",
	);
	const campaignModelSource = await fs.readFile(
		"src/entities/campaign/model.js",
		"utf8",
	);
	const graphUiSource = await fs.readFile(
		"src/components/campaign/CampaignNotesGraph.jsx",
		"utf8",
	);
	assert.match(graphApiSource, /from "\.\/model\/campaignGraph\.js"/);
	assert.match(graphApiSource, /from "\.\/model\/campaignGraphLayout\.js"/);
	assert.doesNotMatch(campaignModelSource, /campaignGraph|d3-force/);
	assert.match(graphUiSource, /entities\/campaign\/graph\.js/);
	assert.doesNotMatch(graphUiSource, /utils\/campaignGraph/);

	const eslintSource = await fs.readFile("eslint.config.js", "utf8");
	assert.match(eslintSource, /\*\*\/utils\/campaignGraph\*/);
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
	assert.equal(
		graph.edges.some((edge) => edge.relation === "mentions"),
		true,
	);
	assert.equal(
		graph.edges.some((edge) => edge.relation === "related"),
		true,
	);
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

await run("campaign graph layout is deterministic, finite, and collision free", () => {
	const nodes = [
		{ id: "campaign:camp", type: "campaign" },
		{ id: "campaign-note:plan", type: "campaign-note" },
		{ id: "character:hero", type: "character" },
		{ id: "npc:guide", type: "npc" },
		{ id: "location:city", type: "location" },
		{ id: "session:s1", type: "session" },
		{ id: "scene:s1:one", type: "scene" },
	];
	const edges = [
		{
			id: "contains:campaign-note",
			source: "campaign:camp",
			target: "campaign-note:plan",
			relation: "contains",
		},
		{
			id: "contains:character",
			source: "campaign:camp",
			target: "character:hero",
			relation: "contains",
		},
		{
			id: "contains:session",
			source: "campaign:camp",
			target: "session:s1",
			relation: "contains",
		},
		{
			id: "contains:scene",
			source: "session:s1",
			target: "scene:s1:one",
			relation: "contains",
		},
		{
			id: "mentions:npc",
			source: "campaign-note:plan",
			target: "npc:guide",
			relation: "mentions",
		},
		{
			id: "related:location",
			source: "npc:guide",
			target: "location:city",
			relation: "related",
		},
	];

	const firstLayout = layoutCampaignGraph(nodes, edges);
	const secondLayout = layoutCampaignGraph(nodes, edges);
	assert.deepEqual(secondLayout, firstLayout);
	assert.deepEqual(firstLayout["campaign:camp"], { x: 0, y: 0 });
	assert.deepEqual(Object.keys(firstLayout).sort(), nodes.map((node) => node.id).sort());
	Object.values(firstLayout).forEach((position) => {
		assert.equal(Number.isFinite(position.x), true);
		assert.equal(Number.isFinite(position.y), true);
	});

	for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
		for (
			let rightIndex = leftIndex + 1;
			rightIndex < nodes.length;
			rightIndex += 1
		) {
			const leftNode = nodes[leftIndex];
			const rightNode = nodes[rightIndex];
			const leftPosition = firstLayout[leftNode.id];
			const rightPosition = firstLayout[rightNode.id];
			const leftSize = getCampaignGraphNodeSize(leftNode.type);
			const rightSize = getCampaignGraphNodeSize(rightNode.type);
			const overlaps =
				Math.abs(leftPosition.x - rightPosition.x) <
					(leftSize.width + rightSize.width) / 2 &&
				Math.abs(leftPosition.y - rightPosition.y) <
					(leftSize.height + rightSize.height) / 2;
			assert.equal(
				overlaps,
				false,
				`${leftNode.id} does not overlap ${rightNode.id}`,
			);
		}
	}

	const relationNodes = [nodes[0], nodes[1]];
	const containsLayout = layoutCampaignGraph(relationNodes, [
		{
			id: "relation",
			source: relationNodes[0].id,
			target: relationNodes[1].id,
			relation: "contains",
		},
	]);
	const mentionsLayout = layoutCampaignGraph(relationNodes, [
		{
			id: "relation",
			source: relationNodes[0].id,
			target: relationNodes[1].id,
			relation: "mentions",
		},
	]);
	const distanceBetween = (layout, leftId, rightId) =>
		Math.hypot(
			layout[leftId].x - layout[rightId].x,
			layout[leftId].y - layout[rightId].y,
		);
	assert.equal(
		distanceBetween(
			containsLayout,
			relationNodes[0].id,
			relationNodes[1].id,
		) <
			distanceBetween(
				mentionsLayout,
				relationNodes[0].id,
				relationNodes[1].id,
			),
		true,
	);
});

await run("campaign graph drag collision moves only the visible dragged node", () => {
	const flowNodes = [
		{
			id: "dragged",
			position: { x: 0, y: 0 },
			data: { graphNode: { type: "campaign-note" } },
		},
		{
			id: "peer",
			position: { x: 40, y: 0 },
			measured: { width: 420, height: 90 },
			data: { graphNode: { type: "npc" } },
		},
		{
			id: "hidden-peer",
			hidden: true,
			position: { x: 0, y: -500 },
			measured: { width: 1000, height: 1000 },
			data: { graphNode: { type: "location" } },
		},
	];
	const originalNodes = structuredClone(flowNodes);
	const resolved = resolveCampaignGraphNodeCollision(flowNodes, "dragged", 16);
	assert.deepEqual(flowNodes, originalNodes);
	assert.notDeepEqual(resolved, flowNodes[0].position);

	const draggedSize = getCampaignGraphNodeSize("campaign-note");
	const overlapsVisiblePeer =
		Math.abs(resolved.x - flowNodes[1].position.x) <
			(draggedSize.width + flowNodes[1].measured.width) / 2 + 16 &&
		Math.abs(resolved.y - flowNodes[1].position.y) <
			(draggedSize.height + flowNodes[1].measured.height) / 2 + 16;
	assert.equal(overlapsVisiblePeer, false);

	const hiddenOnlyNodes = [flowNodes[0], flowNodes[2]];
	assert.deepEqual(
		resolveCampaignGraphNodeCollision(hiddenOnlyNodes, "dragged", 16),
		flowNodes[0].position,
	);
});

await run(
	"campaign state helpers sanitize entities and update mentions",
	() => {
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
			getCampaignLocationDisplayName({ title: "Фракція" }),
			"Фракція",
		);

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
					{
						id: 2,
						title: "Plan",
						text: "",
						collapsed: false,
						_isVirtual: true,
					},
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
	},
);

await run("AI patch helpers preserve numeric ids and ignored notes", () => {
	const mergedNotes = aiPatchService.mergeAiIgnoredNotes(
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

await run("AI operations schema validates patch contracts", () => {
	const valid = aiPayloadSchemas.validateAiGeneratedContent({
		version: 2,
		operations: [
			{
				op: "create",
				entity: "npc",
				scope: "session",
				clientId: "npc-1",
				data: { name: "Mira", trait: "Careful scout" },
			},
			{
				op: "update",
				entity: "scene",
				id: "scene-1",
				patch: { texts: { summary: "Ambush" } },
			},
			{
				op: "update",
				entity: "campaign",
				patch: { description: "Sharper premise" },
			},
			{
				op: "moveScope",
				entity: "npc",
				targetClientId: "npc-1",
				from: "campaign",
				to: "session",
			},
		],
	});
	assert.equal(valid.valid, true);

	const invalid = aiPayloadSchemas.validateAiGeneratedContent({
		version: 2,
		operations: [{ op: "update", entity: "npc", patch: { trait: "x" } }],
	});
	assert.equal(invalid.valid, false);
	assert.ok(invalid.errors.some((entry) => entry.path === "operations[0]"));

	const invalidMove = aiPayloadSchemas.validateAiGeneratedContent({
		version: 2,
		operations: [
			{ op: "moveScope", entity: "npc", from: "campaign", to: "session" },
		],
	});
	assert.equal(invalidMove.valid, false);
	assert.ok(invalidMove.errors.some((entry) => entry.path === "operations[0]"));

	const invalidMixedScope = aiPayloadSchemas.validateAiGeneratedContent(
		{
			version: 2,
			operations: [
				{
					op: "create",
					entity: "npc",
					data: { name: "No Scope", trait: "Ambiguous target." },
				},
			],
		},
		{ requireExplicitEntityScope: true },
	);
	assert.equal(invalidMixedScope.valid, false);
	assert.ok(
		invalidMixedScope.errors.some(
			(entry) => entry.path === "operations[0].scope",
		),
	);
});

await run("AI JSON fence cleanup preserves inner markdown fences", () => {
	const raw = [
		"```json",
		'{"notes":[{"text":"```js\\nconst x = 1;\\n```"}]}',
		"```",
	].join("\n");
	const cleaned = aiService.__test.stripOuterJsonFence(raw);
	assert.equal(cleaned, '{"notes":[{"text":"```js\\nconst x = 1;\\n```"}]}');
	assert.deepEqual(JSON.parse(cleaned), {
		notes: [{ text: "```js\nconst x = 1;\n```" }],
	});
});

await run("AI JSON extraction tolerates surrounding prose", () => {
	const raw = [
		"Ось JSON:",
		'{"version":2,"operations":[{"op":"create","entity":"scene","data":{"texts":{"summary":"A {brace} in text","goal":"Go","stakes":"Risk","location":"Road"}}}]}',
		"Готово.",
	].join("\n");
	const cleaned = aiService.__test.extractFirstJsonObject(raw);
	assert.deepEqual(JSON.parse(cleaned), {
		version: 2,
		operations: [
			{
				op: "create",
				entity: "scene",
				data: {
					texts: {
						summary: "A {brace} in text",
						goal: "Go",
						stakes: "Risk",
						location: "Road",
					},
				},
			},
		],
	});
});

await run("AI service resolves attached images for Gemini inline data", () => {
	const imageUrl = "/api/images/campaign-one/characters/portraits/hero.png";
	const resolved = aiService.__test.resolveLocalImageUrl(imageUrl);
	assert.equal(resolved.mimeType, "image/png");
	assert.equal(
		resolved.filePath,
		path.resolve(
			IMAGES_DIR,
			"campaign-one",
			"characters",
			"portraits",
			"hero.png",
		),
	);

	assert.equal(
		aiService.__test.resolveLocalImageUrl("/api/images/../bad/a.png"),
		null,
	);
	assert.equal(
		aiService.__test.resolveLocalImageUrl(
			"/api/images/campaign-one/%2e%2e/other/hero.png",
		),
		null,
	);
	assert.equal(
		aiService.__test.resolveLocalImageUrl("https://example.com/image.png"),
		null,
	);

	assert.deepEqual(
		aiService.__test.collectImageUrls([
			{ url: imageUrl },
			{ url: "/api/images/campaign-one/tokens/token.webp" },
		]),
		[imageUrl, "/api/images/campaign-one/tokens/token.webp"],
	);
});

await run("AI service accepts temporary attached image data", async () => {
	const imageData = Buffer.from("temporary image bytes", "utf8").toString(
		"base64",
	);
	const parts = await aiService.__test.buildImageParts([
		{
			name: "sketch.png",
			mimeType: "image/png",
			sizeBytes: 21,
			data: imageData,
			url: null,
		},
	]);

	assert.equal(parts.length, 1);
	assert.deepEqual(parts[0], {
		inlineData: {
			data: imageData,
			mimeType: "image/png",
		},
	});
});

await run("AI payload schema rejects legacy final-state payloads", () => {
	assert.equal(
		aiPayloadSchemas.validateAiGeneratedContent({
			version: 2,
			operations: [
				{
					op: "create",
					entity: "location",
					scope: "campaign",
					data: { name: "Old Gate", description: "A locked arch." },
				},
			],
		}).valid,
		true,
	);

	const invalid = aiPayloadSchemas.validateAiGeneratedContent({
		npcs: "Mira",
		monsters: [{ spellcasting: {} }],
	});
	assert.equal(invalid.valid, false);
	assert.ok(invalid.errors.some((entry) => entry.path === "version"));
	assert.ok(invalid.errors.some((entry) => entry.path === "operations"));
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

await run("AI history stores attached file names without file content", () => {
	const attachedFiles = [
		{
			name: "notes.md",
			mimeType: "text/markdown",
			sizeBytes: 12,
			data: Buffer.from("secret notes", "utf8").toString("base64"),
		},
	];
	const snapshot = aiHistoryService.buildAiRequestSnapshot({
		type: "prompt",
		userInstructions: "Read the file",
		path: { campaign: "demo" },
		attachedFiles,
		parseAIResponse: false,
		shouldParseAIResponse: false,
		contextConfig: null,
		contextData: {},
		language: "uk",
	});
	assert.deepEqual(snapshot.attachments.files, [{ name: "notes.md" }]);
	assert.equal(JSON.stringify(snapshot).includes("secret"), false);
	assert.equal(JSON.stringify(snapshot).includes(attachedFiles[0].data), false);

	const retryPayload = new AiHistoryWriter().cloneRetryPayload({
		attachedFiles,
	});
	assert.deepEqual(retryPayload.attachedFiles, [{ name: "notes.md" }]);
});

await run("AI history stores attached image names without file content", () => {
	const attachedImages = [
		{
			name: "sketch.png",
			mimeType: "image/png",
			sizeBytes: 21,
			data: Buffer.from("secret pixels", "utf8").toString("base64"),
			previewUrl: "data:image/png;base64,ignored",
		},
	];
	const snapshot = aiHistoryService.buildAiRequestSnapshot({
		type: "prompt",
		userInstructions: "Read the image",
		path: { campaign: "demo" },
		attachedImages,
		parseAIResponse: false,
		shouldParseAIResponse: false,
		contextConfig: null,
		contextData: {},
		language: "uk",
	});
	assert.deepEqual(snapshot.attachments.images, [{ name: "sketch.png" }]);
	assert.equal(JSON.stringify(snapshot).includes("secret"), false);
	assert.equal(JSON.stringify(snapshot).includes(attachedImages[0].data), false);

	const retryPayload = new AiHistoryWriter().cloneRetryPayload({
		attachedImages,
	});
	assert.deepEqual(retryPayload.attachedImages, [
		{
			name: "sketch.png",
			mimeType: "image/png",
			sizeBytes: 21,
			omittedData: true,
		},
	]);
});

await run(
	"AI history service builds per-monster custom bestiary changes",
	() => {
		const resources =
			aiResponseHistoryService.buildCustomMonsterChangeResources(
				[
					{ id: "old-id", name: "Old Beast", source: "CUSTOM", cr: "1" },
					{
						id: "changed-id",
						name: "Changed Beast",
						source: "CUSTOM",
						cr: "2",
					},
				],
				[
					{
						id: "changed-id",
						name: "Renamed Beast",
						source: "CUSTOM",
						cr: "3",
					},
					{ id: "new-id", name: "New Beast", source: "CUSTOM", cr: "4" },
				],
			);
		assert.deepEqual(
			resources.map((resource) => ({
				id: resource.id,
				kind: resource.kind,
				before: resource.before?.name || null,
				after: resource.after?.name || null,
			})),
			[
				{
					id: "custom-monster:new-id",
					kind: "custom-monster",
					before: null,
					after: "New Beast",
				},
				{
					id: "custom-monster:old-id",
					kind: "custom-monster",
					before: "Old Beast",
					after: null,
				},
				{
					id: "custom-monster:changed-id",
					kind: "custom-monster",
					before: "Changed Beast",
					after: "Renamed Beast",
				},
			],
		);
	},
);

await run("AI response helpers manage custom monster draft resources", () => {
	const entry = {
		id: "draft-1",
		changes: {
			resources: [
				{
					id: "custom-monster:old",
					kind: "custom-monster",
					before: { id: "old", name: "Old Beast", source: "CUSTOM" },
					after: { id: "old", name: "Old Beast", source: "CUSTOM", cr: "2" },
				},
				{
					id: "custom-monster:new",
					kind: "custom-monster",
					before: null,
					after: { id: "new", name: "New Beast", source: "CUSTOM" },
				},
			],
		},
	};

	assert.deepEqual(buildAiChangeSummary(entry.changes.resources), {
		added: 1,
		deleted: 0,
		modified: 1,
		total: 2,
	});
	assert.equal(getFirstChangedMonster(entry).name, "Old Beast");
	assert.equal(
		getFirstChangedMonsterName(entry, ["custom-monster:new"]),
		"New Beast",
	);

	const withToken = addSourceMonsterImageToDraft(entry, {
		name: "Wolf",
		source: "MM",
	});
	assert.equal(
		withToken.changes.resources[1].after.imageUrl,
		"/api/bestiary/tokens/MM/Wolf.webp",
	);
	assert.equal(
		withToken.changes.resources[1].after.originalBestiaryName,
		"Wolf",
	);

	const edited = updateDraftResourceAfterValues(withToken, [
		{
			id: "custom-monster:new",
			after: { id: "new", name: "Edited Beast", source: "CUSTOM" },
		},
	]);
	assert.equal(edited.changes.resources[1].after.name, "Edited Beast");
	assert.deepEqual(edited.changes.summary, {
		added: 1,
		deleted: 0,
		modified: 1,
		total: 2,
	});

	const encounterEntry = {
		path: {
			campaign: "camp",
			session: "session.json",
			encounter: "enc-1",
		},
	};
	assert.equal(
		isAiResponseVisibleForRoute(encounterEntry, {
			campaign: "camp",
			session: "session.json",
			encounter: "enc-1",
		}),
		true,
	);
	assert.equal(
		isAiResponseVisibleForRoute(encounterEntry, {
			campaign: "camp",
			session: "session.json",
			encounter: "enc-2",
		}),
		false,
	);
	assert.equal(
		isAiResponseVisibleForRoute(encounterEntry, {
			campaign: "camp",
			session: "session.json",
			encounter: null,
		}),
		false,
	);
	assert.equal(
		isAiResponseVisibleForRoute(
			{ path: { campaign: "bestiary" } },
			{ campaign: "camp" },
			{ isBestiary: false },
		),
		false,
	);
	assert.equal(
		isAiResponseVisibleForRoute(
			{ path: { campaign: "bestiary" } },
			{ campaign: "bestiary" },
			{ isBestiary: true },
		),
		true,
	);
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

await run("AI route fills ids for current selected targets", () => {
	const { fillCurrentTargetIds } = aiRouter.__test;
	const payload = {
		version: 2,
		operations: [
			{ op: "update", entity: "encounter", patch: { name: "Hard Fight" } },
			{
				op: "updateNote",
				entity: "scene",
				noteId: "note-1",
				patch: { text: "x" },
			},
			{ op: "delete", entity: "npc" },
		],
	};
	fillCurrentTargetIds(payload, {
		path: { encounter: "enc-1" },
		sceneId: "scene-1",
	});
	assert.equal(payload.operations[0].id, "enc-1");
	assert.equal(payload.operations[1].id, "scene-1");
	assert.equal(payload.operations[2].id, undefined);
});

await run("AI route treats custom monster image prompts as bestiary requests", () => {
	const {
		getGenerateRequestPath,
		isBestiaryImagePromptRequestPayload,
	} = aiRouter.__test;
	const payload = {
		type: "image",
		path: { campaign: null, session: null, encounter: null },
		imageTarget: { type: "custom-monster", name: "Кото-гусениця" },
	};

	assert.equal(isBestiaryImagePromptRequestPayload(payload), true);
	assert.deepEqual(getGenerateRequestPath(payload), {
		campaign: "bestiary",
		session: null,
		encounter: null,
	});
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

await run("CharacterCardModel derives fields and maintains notes", () => {
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
	assert.equal(model.notes.length, 0);
	const noteId = getNotesForRender(model.notes)[0].id;
	const updatedNotes = model.withUpdatedNote(noteId, { title: "T" });
	assert.equal(updatedNotes.length, 1);
	assert.equal(updatedNotes[0].title, "T");
	const updatedModel = new CharacterCardModel({ notes: updatedNotes });
	assert.equal(updatedModel.withDeletedNote(updatedNotes[0].id).length, 0);
});

await run(
	"LocationCardModel derives display data and uses a virtual note slot",
	() => {
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
		assert.equal(model.notes.length, 0);
		assert.equal(model.withField("name", "Новий").name, "Новий");

		const notedModel = new LocationCardModel({
			notes: [{ id: "n1", title: "", text: "", collapsed: false }],
		});
		assert.ok(
			notedModel
				.withUpdatedNote("n1", { text: "Text" })
				.some((n) => n.text === "Text"),
		);
		assert.equal(notedModel.withDeletedNote("n1").length, 0);
		assert.equal(notedModel.toggleNoteCollapse("n1")[0].collapsed, true);
	},
);

await run("CardNoteModel shared helpers preserve entity note behavior", () => {
	class TestCardModel extends CardNoteModel {
		constructor(entity) {
			super();
			this.testEntity = entity;
		}

		get entity() {
			return this.testEntity;
		}
	}

	const model = new TestCardModel({
		id: "entity-1",
		notes: [{ id: "note-1", title: "", text: "", collapsed: false }],
	});

	assert.equal(model.notes.length, 1);
	assert.equal(model.withField("name", "Updated").name, "Updated");
	assert.equal(model.withUpdatedNote("note-1", { text: "Body" })[0].text, "Body");
	assert.equal(model.toggleNoteCollapse("note-1")[0].collapsed, true);
	assert.equal(model.withDeletedNote("note-1").length, 0);

	const emptyModel = new TestCardModel({ id: "entity-2", notes: [] });
	const virtualNote = getNotesForRender(emptyModel.notes)[0];
	const materializedNotes = emptyModel.withUpdatedNote(virtualNote.id, {
		text: "First input",
	});
	assert.equal(materializedNotes.length, 1);
	assert.equal(materializedNotes[0].text, "First input");
});

await run(
	"campaign card entity views receive higher-layer image and settings dependencies",
	async () => {
		const characterViewSource = await fs.readFile(
			"src/entities/campaign/ui/CharacterCardView.jsx",
			"utf8",
		);
		const locationViewSource = await fs.readFile(
			"src/entities/campaign/ui/LocationCardView.jsx",
			"utf8",
		);
		const compositionSources = await Promise.all(
			[
				"src/components/CreateCharacterButton.jsx",
				"src/components/CreateLocationButton.jsx",
				"src/app/providers/CampaignEntityModalProvider.jsx",
				"src/pages/campaign/ui/CampaignPage.jsx",
				"src/pages/session/ui/SessionPage.jsx",
				"src/pages/encounter/ui/EncounterPage.jsx",
				"src/widgets/ai-assistant/ui/AiResponseModal.jsx",
			].map((filePath) => fs.readFile(filePath, "utf8")),
		);

		for (const source of [characterViewSource, locationViewSource]) {
			assert.match(source, /ImageAssetFieldComponent/);
			assert.match(source, /simplifiedNotesEnabled = false/);
			assert.doesNotMatch(source, /features\/images/);
			assert.doesNotMatch(source, /useAppSelector/);
		}
		for (const source of compositionSources) {
			assert.match(source, /from ".+entities\/campaign\/ui\.js"/);
			assert.match(source, /from ".+features\/images\/index\.js"/);
			assert.match(source, /ImageAssetFieldComponent=\{ImageAssetField\}/);
			assert.match(source, /simplifiedNotesEnabled/);
		}
		await assert.rejects(
			fs.access("src/components/CharacterCard.jsx"),
			(error) => error.code === "ENOENT",
		);
		await assert.rejects(
			fs.access("src/components/LocationCard.jsx"),
			(error) => error.code === "ENOENT",
		);
	},
);

await run(
	"app shell owns routing providers overlays and realtime bootstrap",
	async () => {
		const appSource = await fs.readFile("src/app/App.jsx", "utf8");
		const ownedPaths = [
			"src/app/router/MainContent.jsx",
			"src/app/router/ProjectGuide.jsx",
			"src/app/providers/CampaignEntityModalProvider.jsx",
			"src/app/services/realtimeSync.js",
			"src/app/ui/DiceCalculator.jsx",
			"src/app/ui/DiceProbabilityModalContent.jsx",
			"src/app/ui/MessageBox.jsx",
			"src/app/ui/RulesReferenceModalHost.jsx",
			"src/app/ui/Sidebar.jsx",
		];
		for (const filePath of ownedPaths) {
			await fs.access(filePath);
		}
		for (const legacyPath of [
			"src/components/MainContent.jsx",
			"src/components/ProjectGuide.jsx",
			"src/components/DiceCalculator.jsx",
			"src/components/DiceProbabilityModalContent.jsx",
			"src/components/Sidebar.jsx",
			"src/components/common/CampaignEntityModalProvider.jsx",
			"src/components/common/MessageBox.jsx",
			"src/components/modals/RulesReferenceModalHost.jsx",
			"src/services/realtimeSync.js",
		]) {
			await assert.rejects(
				fs.access(legacyPath),
				(error) => error.code === "ENOENT",
			);
		}
		assert.match(appSource, /from "\.\/router\/MainContent"/);
		assert.match(appSource, /from "\.\/providers\/CampaignEntityModalProvider"/);
		assert.match(appSource, /from "\.\/services\/realtimeSync"/);
		assert.match(appSource, /from "\.\/ui\/Sidebar"/);
	},
);

await run(
	"app owns configured state while lower layers use the shared store port",
	async () => {
		const appStoreSource = await fs.readFile(
			"src/app/store/appStore.js",
			"utf8",
		);
		const storePortSource = await fs.readFile(
			"src/shared/lib/appStorePort.js",
			"utf8",
		);
		const modalStateSource = await fs.readFile(
			"src/shared/model/modalState.js",
			"utf8",
		);
		const navigationStateSource = await fs.readFile(
			"src/shared/model/navigationState.js",
			"utf8",
		);

		assert.match(appStoreSource, /bindAppStore\(appStore\)/);
		assert.doesNotMatch(appStoreSource, /useSyncExternalStore/);
		assert.match(storePortSource, /useSyncExternalStore/);
		assert.match(storePortSource, /Application store has not been bound/);
		assert.doesNotMatch(storePortSource, /actions\/app|entities\/|features\//);
		assert.match(modalStateSource, /getAppStore\(\)\.dispatch/);
		assert.match(navigationStateSource, /getAppStore\(\)\.dispatch/);
		assert.doesNotMatch(modalStateSource, /src\/app|app\/store/);
		assert.doesNotMatch(navigationStateSource, /src\/app|app\/store/);
		const { appStore } = await import("../src/app/store/appStore.js");
		const { getAppStore } = await import("../src/shared/lib/index.js");
		const { setUiSettingsAction } = await import(
			"../src/entities/settings/model.js"
		);
		assert.equal(getAppStore(), appStore);
		const originalTheme = appStore.getState().ui.theme;
		const nextTheme = originalTheme === "dark" ? "light" : "dark";
		appStore.dispatch(setUiSettingsAction({ theme: nextTheme }));
		assert.equal(getAppStore().getState().ui.theme, nextTheme);
		appStore.dispatch(setUiSettingsAction({ theme: originalTheme }));
		await assert.rejects(
			fs.access("src/store/appStore.js"),
			(error) => error.code === "ENOENT",
		);
		for (const obsoletePath of [
			"src/actions/app.js",
			"src/services/applicationRuntime.js",
		]) {
			await assert.rejects(
				fs.access(obsoletePath),
				(error) => error.code === "ENOENT",
			);
		}
	},
);

await run(
	"shared lib owns dependency-free generic helpers",
	async () => {
		const helperNames = [
			"classNames",
			"deepSearch",
			"domNavigation",
			"download",
			"formatBytes",
			"id",
			"json",
			"undoRedo",
		];
		for (const helperName of helperNames) {
			await fs.access(`src/shared/lib/${helperName}.js`);
			await assert.rejects(
				fs.access(`src/utils/${helperName}.js`),
				(error) => error.code === "ENOENT",
			);
		}

		const sourceFiles = [
			"src/app/ui/Sidebar.jsx",
			"src/entities/session/model/SessionViewModel.js",
			"src/features/bestiary/ui/Bestiary.jsx",
			"src/pages/session/ui/SessionPage.jsx",
			"src/widgets/global-search/ui/GlobalSearchModal.jsx",
		];
		for (const sourceFile of sourceFiles) {
			const source = await fs.readFile(sourceFile, "utf8");
			assert.doesNotMatch(
				source,
				/utils\/(classNames|deepSearch|domNavigation|download|formatBytes|id|json|undoRedo)/,
			);
		}

		const eslintSource = await fs.readFile("eslint.config.js", "utf8");
		assert.match(eslintSource, /\*\*\/utils\/classNames\*/);
		assert.match(eslintSource, /legacy src\/utils ownership is closed/);
	},
);

await run(
	"shared config owns localization and theme",
	async () => {
		for (const ownedPath of [
			"src/shared/config/index.js",
			"src/shared/config/localization.js",
			"src/shared/config/theme.js",
		]) {
			await fs.access(ownedPath);
		}
		for (const legacyPath of [
			"src/services/localization.js",
			"src/services/uiSettings.js",
		]) {
			await assert.rejects(
				fs.access(legacyPath),
				(error) => error.code === "ENOENT",
			);
		}

		const configSource = await fs.readFile(
			"src/shared/config/index.js",
			"utf8",
		);
		const localizationSource = await fs.readFile(
			"src/shared/config/localization.js",
			"utf8",
		);
		assert.match(configSource, /from "\.\/localization\.js"/);
		assert.match(configSource, /from "\.\/theme\.js"/);
		assert.match(localizationSource, /import\.meta\.glob\("\.\.\/\.\.\/langs\/\*\.json"/);

		const { THEMES, applyTheme, lang } = await import(
			"../src/shared/config/index.js"
		);
		assert.deepEqual(THEMES, { LIGHT: "light", DARK: "dark" });
		assert.equal(applyTheme(THEMES.DARK), undefined);
		assert.equal(lang.t("Untranslated test phrase"), "Untranslated test phrase");

		const representativeConsumers = [
			"src/app/App.jsx",
			"src/entities/spell/model/spellMeta.js",
			"src/features/bestiary/ui/Bestiary.jsx",
			"src/shared/api/httpClient.js",
			"src/widgets/ai-assistant/ui/AiAssistantPanel.jsx",
		];
		for (const sourceFile of representativeConsumers) {
			const source = await fs.readFile(sourceFile, "utf8");
			assert.doesNotMatch(
				source,
				/services\/(localization|uiSettings)/,
			);
		}

		const eslintSource = await fs.readFile("eslint.config.js", "utf8");
		assert.match(eslintSource, /\*\*\/services\/localization\*/);
		assert.match(eslintSource, /shared\/config\/index\.js/);
	},
);

await run(
	"shared lib owns the generic debounce hook",
	async () => {
		const sharedHookPath = "src/shared/lib/useDebounce.js";
		await fs.access(sharedHookPath);
		await assert.rejects(
			fs.access("src/hooks/useDebounce.js"),
			(error) => error.code === "ENOENT",
		);

		const hookSource = await fs.readFile(sharedHookPath, "utf8");
		assert.match(hookSource, /useEffect, useState/);
		assert.match(hookSource, /delay <= 0/);
		assert.match(hookSource, /const timeoutId = setTimeout/);
		assert.match(hookSource, /return \(\) => clearTimeout\(timeoutId\)/);
		assert.match(hookSource, /\[delay, value\]/);

		for (const consumerPath of [
			"src/components/modals/PlayerQuestionsModalContent.jsx",
			"src/features/bestiary/ui/Bestiary.jsx",
			"src/features/images/model/useImageGallery.js",
			"src/features/spells/ui/Spells.jsx",
		]) {
			const source = await fs.readFile(consumerPath, "utf8");
			assert.match(source, /shared\/lib\/useDebounce\.js/);
			assert.doesNotMatch(source, /hooks\/useDebounce/);
		}

		const eslintSource = await fs.readFile("eslint.config.js", "utf8");
		assert.match(eslintSource, /\*\*\/hooks\/useDebounce\*/);
	},
);

await run("mention picker helper resolves selected and cancelled states", async () => {
	const { requestMentionSelection } = await import(
		"../src/shared/model/index.js"
	);

	let payload = null;
	const selectedPromise = requestMentionSelection((action) => {
		payload = action.payload;
	});
	payload.select("NPC Name");
	assert.deepEqual(await selectedPromise, {
		status: "selected",
		name: "NPC Name",
	});

	const cancelledPromise = requestMentionSelection((action) => {
		payload = action.payload;
	});
	payload.cancel();
	assert.deepEqual(await cancelledPromise, { status: "cancelled" });
});

await run(
	"shared interaction utilities own routing mentions and highlighting",
	async () => {
		const ownershipPairs = [
			["src/shared/lib/navigation.js", "src/utils/navigation.js"],
			["src/shared/lib/mentionEditor.js", "src/utils/mentionEditor.js"],
			[
				"src/shared/model/mentionPickerSelection.js",
				"src/utils/mentionPicker.js",
			],
			["src/shared/ui/searchHighlight.jsx", "src/utils/searchHighlight.jsx"],
		];
		for (const [ownedPath, legacyPath] of ownershipPairs) {
			await fs.access(ownedPath);
			await assert.rejects(
				fs.access(legacyPath),
				(error) => error.code === "ENOENT",
			);
		}

		const modelApiSource = await fs.readFile(
			"src/shared/model/index.js",
			"utf8",
		);
		const mentionSelectionSource = await fs.readFile(
			"src/shared/model/mentionPickerSelection.js",
			"utf8",
		);
		const highlightSource = await fs.readFile(
			"src/shared/ui/searchHighlight.jsx",
			"utf8",
		);
		assert.match(
			modelApiSource,
			/from "\.\/mentionPickerSelection\.js"/,
		);
		assert.match(
			mentionSelectionSource,
			/from "\.\/mentionPickerState\.js"/,
		);
		assert.match(highlightSource, /className="SearchHighlight"/);
		assert.match(highlightSource, /new RegExp\(.*"gi"\)/);

		for (const consumerPath of [
			"src/app/store/appStore.js",
			"src/components/form/EditableField.jsx",
			"src/features/bestiary/ui/BestiaryContent.jsx",
			"src/shared/model/navigationState.js",
			"src/widgets/global-search/ui/GlobalSearchModal.jsx",
		]) {
			const source = await fs.readFile(consumerPath, "utf8");
			assert.doesNotMatch(
				source,
				/utils\/(navigation|mentionEditor|mentionPicker|searchHighlight)/,
			);
		}

		const eslintSource = await fs.readFile("eslint.config.js", "utf8");
		assert.match(eslintSource, /\*\*\/utils\/navigation\*/);
		assert.match(eslintSource, /\*\*\/utils\/searchHighlight\*/);
		assert.match(
			eslintSource,
			/\*\*\/shared\/model\/mentionPickerSelection\*/,
		);
	},
);

await run("entity link modal helper resolves entities and avoids current modal", async () => {
	const { openEntityLinkModal } = await import(
		"../src/components/common/entityLinkModalUtils.js"
	);
	const { getEntityIdentity } = await import(
		"../src/components/common/EntityLinkIdentity.js"
	);

	const found = {
		entity: { id: "npc-1", firstName: "Mira", lastName: "" },
		type: "npc",
		scope: "campaign",
	};
	let modalState = null;
	await openEntityLinkModal({
		campaignSlug: "campaign",
		currentEntityIdentity: null,
		errorMessage: "test",
		modalState: null,
		name: "Mira",
		scopedEntityLinks: { resolveEntityByName: () => found },
		setModalState: (value) => {
			modalState = value;
		},
	});
	assert.deepEqual(modalState, { entity: found.entity, type: "npc" });

	modalState = null;
	await openEntityLinkModal({
		campaignSlug: "campaign",
		currentEntityIdentity: getEntityIdentity(found.entity, found.type, found.scope),
		errorMessage: "test",
		modalState: null,
		name: "Mira",
		scopedEntityLinks: { resolveEntityByName: () => found },
		setModalState: (value) => {
			modalState = value;
		},
	});
	assert.equal(modalState, null);
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

	const chooserModel = new MonsterStatBlockModel({
		type: {
			type: { choose: ["celestial", "fey", "fiend"] },
			tags: ["spirit"],
		},
	});
	assert.equal(chooserModel.typeLabel, "celestial/fey/fiend (spirit)");
});

await run("custom monster replacement preserves token image when renamed", () => {
	const { buildReplacementCustomMonster } = bestiaryRouter.__test;
	const replacement = buildReplacementCustomMonster(
		{
			id: "monster-1",
			name: "Old",
			source: "CUSTOM",
			imageUrl: "/api/images/general/tokens/old.png",
		},
		{
			id: "monster-1",
			name: "New",
			source: "CUSTOM",
			cr: "1",
		},
	);

	assert.equal(replacement.name, "New");
	assert.equal(replacement.imageUrl, "/api/images/general/tokens/old.png");
});

await run("SpellCardModel formats spell labels", () => {
	const spell = {
		name: "Magic Missile|PHB",
		source: "PHB",
		classes: ["Sorcerer", "Wizard"],
		level: 1,
		school: "V",
		time: [{ number: 1, unit: "action" }],
		range: { type: "point", distance: { type: "feet", amount: 120 } },
		components: { v: true, s: true, m: "a bit of phosphorus" },
		duration: [{ type: "instant" }],
	};
	const model = new SpellCardModel(spell, {
		language: "uk",
		translate: (value, variables = {}) => {
			if (value === "Evocation") return "Evocation (Втілення)";
			if (value === "Spell level {level}") return `${variables.level}-й рівень`;
			if (value === "ft.") return "фт.";
			if (value === "Instantaneous") return "Миттєво";
			return value;
		},
	});
	const englishModel = new SpellCardModel(spell, { language: "en" });
	assert.equal(model.displayName, "Magic Missile");
	assert.equal(model.sourceLabel, "PHB");
	assert.equal(model.levelLabel, "1-й рівень");
	assert.equal(model.schoolLabel, "Evocation (Втілення)");
	assert.equal(englishModel.schoolLabel, "Evocation");
	assert.match(model.rangeLabel, /120 фт/);
	assert.equal(model.durationLabel, "Миттєво");
	assert.equal(model.classesLabel, "Sorcerer, Wizard");

	const specialModel = new SpellCardModel(
		{
			name: "Creation",
			duration: [{ type: "special" }],
		},
		{
			language: "uk",
			translate: (value) => (value === "Special" ? "Особлива" : value),
		},
	);
	assert.equal(specialModel.durationLabel, "Особлива");

	const permanentModel = new SpellCardModel(
		{
			name: "Glyph of Warding",
			duration: [{ type: "permanent", ends: ["dispel", "trigger"] }],
		},
		{
			language: "uk",
			translate: (value) =>
				value === "Until dispelled or triggered"
					? "Доки не розвіяно або не спрацює"
					: value,
		},
	);
	assert.equal(
		permanentModel.durationLabel,
		"Доки не розвіяно або не спрацює",
	);
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

	const taggedHit = extractContentTokens("{@atk mw} {@hit 9} to hit.");
	assert.equal(taggedHit.length, 1);
	assert.equal(taggedHit[0].fullMatch, "{@hit 9} to hit");
	assert.equal(taggedHit[0].hit, "9");
	assert.equal(taggedHit[0].hitSuffix.trim(), "to hit");

	const recharge = extractContentTokens("(Recharge 5-6) Breath.");
	assert.equal(recharge.length, 1);
	assert.equal(recharge[0].recharge, "(Recharge 5-6)");
	assert.equal(
		recharge.some((token) => token.hit === "-6"),
		false,
	);
	assert.equal(
		preprocessTags("{@recharge 5-6} Breath."),
		"(Recharge 5-6) Breath.",
	);
	assert.equal(preprocessTags("{@recharge 5} Breath."), "(Recharge 5-6) Breath.");
	const taggedRecharge = extractContentTokens(
		"{@recharge 4}, {@recharge 5-6}, {@recharge}",
	);
	assert.deepEqual(
		taggedRecharge.map((token) => token.recharge),
		["(Recharge 4-6)", "(Recharge 5-6)", "(Recharge 6)"],
	);

	const damage = extractContentTokens("take 10 ({@damage 3d6}) fire damage.");
	assert.equal(damage.length, 1);
	assert.equal(damage[0].fullMatch, "{@damage 3d6}");
	assert.equal(damage[0].damageRoll, "3d6");
	assert.equal(damage[0].damageRemainder, "");

	const damageWithLevel = extractContentTokens(
		"{@h}{@damage 1d10 + 3 + summonSpellLevel}",
	);
	assert.equal(damageWithLevel.length, 1);
	assert.equal(
		damageWithLevel[0].fullMatch,
		"{@damage 1d10 + 3 + summonSpellLevel}",
	);
	assert.equal(damageWithLevel[0].damageRoll, "1d10 + 3");
	assert.equal(damageWithLevel[0].damageRemainder, " + summonSpellLevel");
	assert.equal(
		preprocessTags("{@h}{@damage 1d10 + 3 + summonSpellLevel}"),
		"Hit: 1d10 + 3 + summonSpellLevel",
	);

	const scaledSummonDamage = extractContentTokens(
		"equal to {@damage (summonSpellLevel - 4)d4 + 3|1d4 + 3}, {@damage (summonSpellLevel - 3)d6 + 3|2d6 + 3} + your spellcasting",
	);
	assert.equal(scaledSummonDamage.length, 2);
	assert.equal(scaledSummonDamage[0].damageRoll, "1d4 + 3");
	assert.equal(scaledSummonDamage[0].damageRemainder, "");
	assert.equal(scaledSummonDamage[0].damageLabel, "1d4 + 3");
	assert.equal(scaledSummonDamage[1].damageRoll, "2d6 + 3");
	assert.equal(scaledSummonDamage[1].damageRemainder, "");
	assert.equal(scaledSummonDamage[1].damageLabel, "2d6 + 3");
	assert.equal(
		preprocessTags(
			"equal to {@damage (summonSpellLevel - 4)d4 + 3|1d4 + 3}, {@damage (summonSpellLevel - 3)d6 + 3|2d6 + 3} + your spellcasting",
		),
		"equal to 1d4 + 3, 2d6 + 3 + your spellcasting",
	);

	const dynamicSummonDamage = extractContentTokens(
		"{@damage (summonSpellLevel - 3)d12 + 3}",
	);
	assert.equal(dynamicSummonDamage.length, 1);
	assert.equal(dynamicSummonDamage[0].damageRoll, "");
	assert.equal(
		dynamicSummonDamage[0].damageRemainder,
		"(summonSpellLevel - 3)d12 + 3",
	);

	const quickref = extractContentTokens(
		"{@quickref Vision and Light||2||heavily obscured}",
	);
	assert.equal(quickref.length, 1);
	assert.equal(
		quickref[0].quickrefValue,
		"Vision and Light||2||heavily obscured",
	);

	const diceTag = extractContentTokens("{@dice 1d10}");
	assert.equal(diceTag.length, 1);
	assert.equal(diceTag[0].fullMatch, "{@dice 1d10}");
	assert.equal(diceTag[0].diceFormula, "1d10");
	assert.equal(diceTag[0].roll, undefined);

	const creatureTag = extractContentTokens(
		"{@creature Wereraven|VRGR} and {@creature Loup Garou|VRGR}",
	);
	assert.equal(creatureTag.length, 2);
	assert.equal(creatureTag[0].creatureValue, "Wereraven|VRGR");
	assert.equal(creatureTag[1].creatureValue, "Loup Garou|VRGR");

	const itemTag = extractContentTokens("{@item +2 Dagger}.");
	assert.equal(itemTag.length, 1);
	assert.equal(itemTag[0].fullMatch, "{@item +2 Dagger}");
	assert.equal(itemTag[0].displayValue, "+2 Dagger");
	assert.equal(itemTag[0].hit, undefined);
	assert.equal(itemTag[0].roll, undefined);
});

await run("parser renders quickref display labels", () => {
	assert.equal(
		preprocessTags("{@quickref Vision and Light||2||heavily obscured}"),
		"heavily obscured",
	);
	assert.equal(
		preprocessTags("{@quickref difficult terrain||3}"),
		"difficult terrain",
	);
	assert.equal(
		preprocessTags("{@quickref Cover||3||Total cover} blocks the sphere."),
		"Total cover blocks the sphere.",
	);
	assert.equal(preprocessTags("{@chance 25} chance"), "25% chance");
	assert.equal(
		preprocessTags("{@chance 50|50 percent|50% summoning chance} chance"),
		"50 percent chance",
	);
	assert.equal(
		preprocessTags("{@chance 25|||No answer!|Answer} chance"),
		"25% chance",
	);
});

await run("parser renders dice and creature tags as interactive components", async () => {
	const contentTokensSource = await fs.readFile(
		"src/utils/contentTokens.js",
		"utf8",
	);
	const rendererSource = await fs.readFile(
		"src/renderers/contentRenderer.jsx",
		"utf8",
	);
	const rulesLinkSource = await fs.readFile(
		"src/components/common/RulesLink.jsx",
		"utf8",
	);
	const rulesReferenceSource = await fs.readFile(
		"src/widgets/rules-reference/ui/RulesReferenceModalContent.jsx",
		"utf8",
	);
	const monsterStatBlockSource = await fs.readFile(
		"src/components/MonsterStatBlock.jsx",
		"utf8",
	);
	const rulesLinkCss = await fs.readFile(
		"src/assets/components/RulesLink.css",
		"utf8",
	);

	assert.match(contentTokensSource, /\{@dice\\s\+/);
	assert.match(contentTokensSource, /\{@creature\\s\+/);
	assert.match(rendererSource, /diceTag/);
	assert.match(rendererSource, /type="creature"/);
	assert.match(rendererSource, /disableNonRechargeRolls/);
	assert.match(rendererSource, /const displayHit/);
	assert.match(rendererSource, /function addFallbackTaggedSource/);
	assert.match(rendererSource, /creatureSourceFallback/);
	assert.match(rendererSource, /name=\{creatureReferenceName\}/);
	assert.doesNotMatch(rendererSource, /onNavigate=\{options\.onRuleNavigate\}/);
	assert.doesNotMatch(rendererSource, /onRuleNavigate/);
	assert.match(monsterStatBlockSource, /creatureSourceFallback: monster\.source/);
	assert.match(monsterStatBlockSource, /referenceRenderOptions/);
	assert.match(monsterStatBlockSource, /renderActionName/);
	assert.match(monsterStatBlockSource, /disableNonRechargeRolls: true/);
	assert.doesNotMatch(monsterStatBlockSource, /<strong>\{renderContent\(action\.name\)\}\.<\/strong>/);
	assert.match(rulesLinkSource, /const openCreature = \(\) =>/);
	assert.match(rulesLinkSource, /CONTENT_TOKEN_REGEX/);
	assert.match(rulesLinkSource, /tokenFromContentMatch/);
	assert.match(rulesLinkSource, /<RollDice/);
	assert.match(rulesLinkSource, /type: "recharge"/);
	assert.match(
		rulesLinkSource,
		/requestRulesReferenceNavigation\("bestiary", getCreatureReferenceName\(creature\)\)/,
	);
	assert.match(rulesLinkSource, /function getCreatureReferenceName/);
	assert.doesNotMatch(rulesLinkSource, /onNavigate/);
	assert.doesNotMatch(rulesReferenceSource, /import Bestiary from/);
	assert.match(
		rulesReferenceSource,
		/import MonsterStatBlock from "\.\.\/\.\.\/\.\.\/components\/MonsterStatBlock\.jsx"/,
	);
	assert.match(
		rulesReferenceSource,
		/from "\.\.\/\.\.\/\.\.\/entities\/bestiary\/model\.js"/,
	);
	assert.match(rulesReferenceSource, /id: "bestiary"/);
	assert.match(rulesReferenceSource, /bestiaryApi\.getData\("all"\)/);
	assert.match(rulesReferenceSource, /spellApi\.getData\("all"\)/);
	assert.doesNotMatch(rulesReferenceSource, /<Bestiary/);
	assert.match(rulesReferenceSource, /<MonsterStatBlock/);
	assert.match(rulesReferenceSource, /Bestiary__item_token/);
	assert.match(rulesReferenceSource, /normalizeCreatureReferenceName/);
	assert.doesNotMatch(rulesReferenceSource, new RegExp("is" + "Embedded"));
	assert.match(rulesReferenceSource, /renderRecursiveContent\(selectedItem\.entries/);
	assert.doesNotMatch(rulesReferenceSource, /onRuleNavigate/);
	assert.match(rulesLinkCss, /\.RulesLink__creature/);
});

await run("parser renders item filter display names", () => {
	assert.equal(
		preprocessTags(
			"If you wear {@filter Light|items|type=Light Armor}, {@filter Medium|items|type=Medium Armor}, or {@filter Heavy|items|type=Heavy Armor} armor and lack training",
		),
		"If you wear Light, Medium, or Heavy armor and lack training",
	);
});

await run("rules reference modal owns spells and lightweight bestiary navigation", async () => {
	const embeddedPropPattern = new RegExp("is" + "Embedded");
	const mainContentSource = await fs.readFile(
		"src/app/router/MainContent.jsx",
		"utf8",
	);
	const sidebarSource = await fs.readFile("src/app/ui/Sidebar.jsx", "utf8");
	const bestiarySource = await fs.readFile(
		"src/features/bestiary/ui/Bestiary.jsx",
		"utf8",
	);
	const bestiaryContentSource = await fs.readFile(
		"src/features/bestiary/ui/BestiaryContent.jsx",
		"utf8",
	);
	const spellsSource = await fs.readFile(
		"src/features/spells/ui/Spells.jsx",
		"utf8",
	);
	const rulesReferenceSource = await fs.readFile(
		"src/widgets/rules-reference/ui/RulesReferenceModalContent.jsx",
		"utf8",
	);
	const rulesReferenceHostSource = await fs.readFile(
		"src/app/ui/RulesReferenceModalHost.jsx",
		"utf8",
	);
	const rulesReferenceStateSource = await fs.readFile(
		"src/features/reference-navigation/model/rulesReferenceAppState.js",
		"utf8",
	);
	const appStoreSource = await fs.readFile(
		"src/app/store/appStore.js",
		"utf8",
	);
	const aiAssistantSource = await fs.readFile(
		"src/widgets/ai-assistant/ui/AiAssistantPanel.jsx",
		"utf8",
	);

	assert.doesNotMatch(mainContentSource, /path="\/bestiary"/);
	assert.doesNotMatch(mainContentSource, /path="\/spells"/);
	assert.doesNotMatch(mainContentSource, /import Bestiary from/);
	assert.doesNotMatch(mainContentSource, /import Spells from/);
	assert.match(sidebarSource, /handleOpenRulesReference\("bestiary", \{ forceTab: true \}\)/);
	assert.match(sidebarSource, /handleOpenRulesReference\("spells", \{ forceTab: true \}\)/);
	assert.doesNotMatch(sidebarSource, /onSelectCampaign\("bestiary"\)/);
	assert.doesNotMatch(sidebarSource, /onSelectCampaign\("spells"\)/);
	assert.match(bestiarySource, /initialSelectedName = ""/);
	assert.match(bestiarySource, /hideSearchInput = false/);
	assert.match(bestiarySource, /pendingSyncSelectionRef/);
	assert.match(bestiarySource, /syncEvent\.monsterName/);
	assert.match(bestiarySource, /shouldAutoSelectMonsterRef\.current = false/);
	assert.match(bestiarySource, /referenceName.*toLowerCase/s);
	assert.match(bestiarySource, /ignoreSourcesList/);
	assert.match(bestiarySource, /selectedSources/);
	assert.match(bestiarySource, /displayedMonsters\.find[\s\S]*allMonsters\.find/);
	assert.match(bestiarySource, /selectedMonsterRef\.current = targetMonster/);
	assert.doesNotMatch(bestiarySource, /setSelectedSource/);
	assert.doesNotMatch(bestiarySource, /normalizeSourceSelection\(initialMonsterReference\.source\)/);
	assert.doesNotMatch(bestiarySource, embeddedPropPattern);
	assert.doesNotMatch(bestiarySource, /useSearchParams/);
	assert.doesNotMatch(bestiarySource, /next\.set\("monster"/);
	assert.doesNotMatch(bestiarySource, /next\.set\("m_source"/);
	assert.match(bestiaryContentSource, /onSelectMonster/);
	assert.match(bestiaryContentSource, /showAddToEncounterPicker=\{Boolean\(onAddMonster\)\}/);
	assert.doesNotMatch(spellsSource, embeddedPropPattern);
	assert.doesNotMatch(spellsSource, /useSearchParams/);
	assert.doesNotMatch(spellsSource, /next\.set\("spell"/);
	assert.doesNotMatch(spellsSource, /next\.set\("s_source"/);
	assert.match(spellsSource, /findSpellByName\(displayedSpells, initialSelectedName\) \|\|/);
	assert.match(spellsSource, /findSpellByName\(allSpells, initialSelectedName\)/);
	assert.match(rulesReferenceSource, /EMBEDDED_BROWSER_TAB_IDS/);
	assert.match(rulesReferenceSource, /recordEmbeddedReferenceSelection/);
	assert.match(rulesReferenceSource, /recordNavigation\(tabId, name\)/);
	assert.match(rulesReferenceSource, /recordRulesReferenceHistoryEntry/);
	assert.match(rulesReferenceSource, /setRulesReferenceHistoryIndex/);
	assert.match(rulesReferenceSource, /applyTabOnlyNavigation/);
	assert.match(rulesReferenceSource, /navigationRequest\.forceTab/);
	assert.match(rulesReferenceSource, /if \(initialName\) \{/);
	assert.doesNotMatch(rulesReferenceSource, /setNavigationHistory/);
	assert.match(rulesReferenceSource, /onActiveSpellChange/);
	assert.match(rulesReferenceSource, /activeTab\.id === "bestiary"/);
	assert.match(rulesReferenceSource, /getCreatureReferenceName/);
	assert.match(rulesReferenceSource, /itemMatchesSelectedName/);
	assert.match(
		rulesReferenceHostSource,
		/handledRequestIdRef\.current = navigationRequest\.requestId;\s*if \(isOpen\) return;/,
	);
	assert.match(appStoreSource, /rulesReference:[\s\S]*history:[\s\S]*entries: \[\]/);
	assert.match(
		rulesReferenceStateSource,
		/forceTab: Boolean\(options\.forceTab\)/,
	);
	assert.match(appStoreSource, /RECORD_RULES_REFERENCE_HISTORY_ENTRY/);
	assert.match(appStoreSource, /SET_RULES_REFERENCE_HISTORY_INDEX/);
	assert.match(aiAssistantSource, /aiHistoryCampaign = isBestiary \? "bestiary"/);
	assert.match(
		aiAssistantSource,
		/campaign: isBestiary \? "bestiary" : navigation\.activeCampaignSlug/,
	);
	assert.match(aiAssistantSource, /resource: "custom-bestiary"/);
	assert.match(aiAssistantSource, /monsterName:/);
});

await run(
	"reference domain APIs forward cancellation options",
	async () => {
		const originalRequest = httpClient.request;
		const controller = new AbortController();
		const calls = [];
		httpClient.request = async (requestPath, options = {}) => {
			calls.push({ requestPath, options });
			return [];
		};

		try {
			await bestiaryApi.getSources({ signal: controller.signal });
			await bestiaryApi.getData("all", {
				signal: controller.signal,
			});
			await bestiaryApi.getCustomData({
				signal: controller.signal,
				headers: { "X-Test": "custom" },
			});
			await bestiaryApi.getFavorites({
				signal: controller.signal,
			});
			await spellApi.getSources({ signal: controller.signal });
			await spellApi.getData("all", {
				signal: controller.signal,
			});
			await spellApi.search(
				{ name: "shield" },
				{ signal: controller.signal },
			);
			await rulesReferenceApi.getConditions({
				signal: controller.signal,
			});

			assert.equal(calls.length, 8);
			assert.equal(
				calls.every(
					(call) => call.options.signal === controller.signal,
				),
				true,
			);
			const customCall = calls.find((call) =>
				call.requestPath.startsWith("/bestiary/custom?"),
			);
			assert.equal(customCall.options.cache, "no-store");
			assert.equal(
				customCall.options.headers["Cache-Control"],
				"no-cache",
			);
			assert.equal(customCall.options.headers["X-Test"], "custom");
			assert.equal(
				calls.find((call) =>
					call.requestPath.startsWith("/spells/search?"),
				).options.signal,
				controller.signal,
			);
			assert.equal(isAbortError({ name: "AbortError" }), true);
			assert.equal(isAbortError(new Error("failure")), false);
		} finally {
			httpClient.request = originalRequest;
		}
	},
);

await run(
	"settings and archive APIs replace the legacy frontend facade",
	async () => {
		const originalRequest = httpClient.request;
		const originalRequestBlob = httpClient.requestBlob;
		const calls = [];
		httpClient.request = async (requestPath, options = {}) => {
			calls.push({ kind: "json", requestPath, options });
			return { ok: true };
		};
		httpClient.requestBlob = async (requestPath, options = {}) => {
			calls.push({ kind: "blob", requestPath, options });
			return new Blob([]);
		};

		try {
			await settingsApi.get();
			await settingsApi.update({ theme: "dark" });
			await archiveApi.exportAll();
			await archiveApi.exportAllArchive();
			await archiveApi.importAll([], "replace_by_id");
			await archiveApi.importArchive(
				new Blob(["{}"], { type: "application/json" }),
				"campaign",
				"append",
			);

			assert.deepEqual(
				calls.map((call) => call.requestPath),
				[
					"/settings",
					"/settings",
					"/export-all",
					"/export-all/archive",
					"/import-all?strategy=replace_by_id",
					"/import-archive?mode=campaign&strategy=append",
				],
			);
			assert.equal(calls[1].options.method, "PATCH");
			assert.equal(calls[3].kind, "blob");
			assert.equal(calls[4].options.method, "POST");
			assert.ok(calls[5].options.body instanceof FormData);
			await assert.rejects(
				fs.access("src/api.js"),
				(error) => error.code === "ENOENT",
			);
		} finally {
			httpClient.request = originalRequest;
			httpClient.requestBlob = originalRequestBlob;
		}
	},
);

await run(
	"backend regression setup imports owning modules without a compatibility facade",
	async () => {
		const regressionSource = await fs.readFile("tests/run-tests.mjs", "utf8");
		for (const modulePath of [
			"server/infrastructure/jsonFileStore.js",
			"server/infrastructure/storagePaths.js",
			"server/domains/ai/aiResponseRepository.js",
			"server/domains/archive/archiveImportService.js",
			"server/domains/campaign/campaignRepository.js",
			"server/domains/entity/entityRepository.js",
			"server/domains/image/imageAssetRepository.js",
			"server/domains/session/sessionRepository.js",
		]) {
			assert.match(regressionSource, new RegExp(modulePath.replaceAll("/", "\\/")));
		}
		assert.doesNotMatch(
			regressionSource,
			/require\("\.\/support\/backendTestFacade\.js"\)/,
		);
		await assert.rejects(
			fs.access("tests/support/backendTestFacade.js"),
			(error) => error.code === "ENOENT",
		);
	},
);

await run(
	"global search read APIs forward cancellation and cap session concurrency",
	async () => {
		const originalRequest = httpClient.request;
		const controller = new AbortController();
		const calls = [];
		httpClient.request = async (requestPath, options = {}) => {
			calls.push({ requestPath, options });
			return [];
		};

		try {
			await campaignApi.getEntities(
				"alpha",
				"npc",
				{ signal: controller.signal },
			);
			await sessionApi.listSessions("alpha", {
				signal: controller.signal,
			});
			await sessionApi.getSession(
				"alpha",
				"one.json",
				{ signal: controller.signal },
			);
			assert.equal(
				calls.every(
					(call) => call.options.signal === controller.signal,
				),
				true,
			);
		} finally {
			httpClient.request = originalRequest;
		}

		let active = 0;
		let maxActive = 0;
		const completed = await mapWithConcurrency(
			[0, 1, 2, 3, 4, 5],
			2,
			async (value) => {
				active += 1;
				maxActive = Math.max(maxActive, active);
				await new Promise((resolve) => setTimeout(resolve, 1));
				active -= 1;
				return value * 2;
			},
		);
		assert.equal(maxActive, 2);
		assert.deepEqual(completed, [0, 2, 4, 6, 8, 10]);
	},
);

await run(
	"global search is widget-owned and aborts its request fan-out",
	async () => {
		const source = await fs.readFile(
			"src/widgets/global-search/ui/GlobalSearchModal.jsx",
			"utf8",
		);
		const campaignPageSource = await fs.readFile(
			"src/pages/campaign/ui/CampaignPage.jsx",
			"utf8",
		);
		const sessionPageSource = await fs.readFile(
			"src/pages/session/ui/SessionPage.jsx",
			"utf8",
		);

		assert.match(source, /const controller = new AbortController\(\)/);
		assert.match(source, /SESSION_LOAD_CONCURRENCY = 6/);
		assert.match(source, /mapWithConcurrency\(/);
		assert.match(source, /return \(\) => controller\.abort\(\)/);
		assert.match(source, /controller\.signal\.aborted/);
		assert.match(
			campaignPageSource,
			/from "\.\.\/\.\.\/\.\.\/widgets\/global-search\/index\.js"/,
		);
		assert.match(
			sessionPageSource,
			/from "\.\.\/\.\.\/\.\.\/widgets\/global-search\/index\.js"/,
		);
		await assert.rejects(
			fs.access("src/components/campaign/GlobalSearchModal.jsx"),
			(error) => error.code === "ENOENT",
		);
	},
);

await run(
	"large reference views abort loads and guard stale responses",
	async () => {
		const bestiarySource = await fs.readFile(
			"src/features/bestiary/ui/Bestiary.jsx",
			"utf8",
		);
		const spellsSource = await fs.readFile(
			"src/features/spells/ui/Spells.jsx",
			"utf8",
		);
		const rulesReferenceSource = await fs.readFile(
			"src/widgets/rules-reference/ui/RulesReferenceModalContent.jsx",
			"utf8",
		);

		assert.match(bestiarySource, /bestiaryApi\.getData\("all", options\)/);
		assert.match(
			bestiarySource,
			/bestiaryApi\.getCustomData\(options\)/,
		);
		assert.match(bestiarySource, /controller\.signal\.aborted/);
		assert.match(bestiarySource, /return \(\) => controller\.abort\(\)/);
		assert.match(spellsSource, /spellApi\.getData\("all", \{/);
		assert.match(spellsSource, /controller\.signal\.aborted/);
		assert.match(spellsSource, /return \(\) => controller\.abort\(\)/);
		assert.match(
			rulesReferenceSource,
			/tab\.load\(\{ signal: controller\.signal \}\)/,
		);
		assert.match(rulesReferenceSource, /requestControllersRef/);
		assert.match(rulesReferenceSource, /controller\.abort\(\)/);
		assert.match(rulesReferenceSource, /isAbortError\(error\)/);
	},
);

await run(
	"performance query models preserve filters and render budgets",
	() => {
		const monsters = [
			{ name: "Red Dragon", source: "MM", type: "dragon" },
			{ name: "Goblin", source: "MM", type: "humanoid" },
			{ name: "Clockwork", source: "HB", type: "construct" },
		];
		assert.deepEqual(
			filterBestiaryMonsters({
				monsters,
				selectedSources: ["MM"],
				favorites: [{ name: "Red Dragon", source: "mm" }],
				onlyFavorites: true,
				search: "dragon",
			}),
			[monsters[0]],
		);

		const spells = [
			{
				name: "Fireball",
				source: "PHB",
				level: 3,
				school: "V",
				classes: ["Wizard"],
			},
			{
				name: "Shield",
				source: "PHB",
				level: 1,
				school: "A",
				classes: ["Wizard"],
			},
		];
		assert.deepEqual(
			filterSpells({
				spells,
				selectedSources: ["PHB"],
				search: "fire",
				selectedLevel: "3",
				selectedClass: "Wizard",
				selectedSchool: "V",
			}),
			[spells[0]],
		);

		const searchIndex = Array.from(
			{ length: GLOBAL_SEARCH_RESULT_LIMIT + 20 },
			(_, index) => ({
				id: index,
				filter: "notes",
				searchText: `dragon note ${index}`,
			}),
		);
		assert.equal(
			filterGlobalSearchIndex(
				searchIndex,
				new Set(["notes"]),
				"dragon",
			).length,
			GLOBAL_SEARCH_RESULT_LIMIT,
		);

		const gridModel = buildEncounterGridModel([
			{ instanceId: "goblin-1", name: "Goblin", source: "MM" },
			{ instanceId: "goblin-2", name: "Goblin", source: "MM" },
			{
				instanceId: "local-goblin",
				name: "Goblin",
				source: "MM",
				_localOverride: true,
			},
			{ instanceId: "hero", participantType: "character" },
		]);
		assert.deepEqual(
			gridModel.gridMonsters.map((monster) => monster.instanceId),
			["goblin-1", "local-goblin"],
		);
		assert.equal(
			gridModel.gridRepresentativeByInstanceId.get("goblin-2"),
			"goblin-1",
		);
	},
);

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

await run("undo redo helpers detect app-level editor shortcuts", () => {
	assert.equal(isHistoryShortcutEvent({ ctrlKey: true, code: "KeyZ" }), true);
	assert.equal(isHistoryShortcutEvent({ metaKey: true, code: "KeyY" }), true);
	assert.equal(isHistoryShortcutEvent({ ctrlKey: true, code: "KeyB" }), false);

	const appHistoryTarget = {
		closest(selector) {
			return selector === "[data-app-history-shortcuts='true']";
		},
	};
	const plainTarget = { closest: () => null };
	assert.equal(shouldUseAppHistoryForEvent({ target: appHistoryTarget }), true);
	assert.equal(shouldUseAppHistoryForEvent({ target: plainTarget }), false);
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
	assert.equal(sanitizeName(dirty), "test name");
	assert.match(campaignSlug(" Моя Кампанія !!! "), /^[\p{L}\p{N}-]+$/u);
	assert.equal(
		sessionFileName("Session <> Name").endsWith(".json"),
		true,
	);
	const id1 = crypto.randomUUID();
	const id2 = crypto.randomUUID();
	assert.notEqual(id1, id2);
	const session = makeDefaultSessionData("My Session");
	assert.equal(session.name, "My Session");
	assert.equal("completed" in session, false);
	assert.equal(campaignDir("../unsafe").includes(".."), false);
	assert.equal(
		aiResponsesPath("bestiary"),
		path.join(DATA_DIR, "_aiResponses-bestiary.json"),
	);
	assert.equal(
		aiResponsesPath("regular"),
		campaignAiResponsesPath("regular"),
	);
});

await run(
	"storage writes JSON atomically and normalizes custom monsters",
	async () => {
		const atomicPath = path.join(
			CAMPAIGNS_DIR,
			`${TEST_PREFIX}-atomic.json`,
		);
		try {
			await writeJson(atomicPath, { title: "Проба", count: 1 });
			assert.deepEqual(await readJson(atomicPath), {
				title: "Проба",
				count: 1,
			});

			const normalized = normalizeCustomBestiaryMonster({
				name: "[Glass Knight]",
				source: "OTHER",
				hp: { formula: "3d8 + 6", average: 1 },
				spellcasting: {
					name: "Spellcasting",
					spells: { 1: ["{@spell Shield|XPHB}"] },
				},
				action: ["{@atk mw} {@hit 6} to hit."],
			});
			assert.equal(normalized.name, "Glass Knight");
			assert.equal(typeof normalized.id, "string");
			assert.ok(normalized.id.length > 0);
			assert.equal(normalized.source, "CUSTOM");
			assert.equal(normalized.hp.average, 19);
			assert.equal(Array.isArray(normalized.spellcasting), true);
			assert.deepEqual(normalized.action[0], {
				name: "",
				entries: ["{@atk mw} {@hit 6} to hit."],
			});
		} finally {
			await fs.rm(atomicPath, { force: true });
		}
	},
);

await run(
	"partial campaign import replaces existing sessions and entities",
	async () => {
		const sourceSlug = makeTestSlug("partial-source");
		const targetSlug = makeTestSlug("partial-target");
		try {
			for (const slug of [sourceSlug, targetSlug]) {
				await ensureDir(
					path.join(campaignDir(slug), "sessions"),
				);
				await writeJson(campaignMetaPath(slug), {
					id: `${slug}-id`,
					name: `Campaign ${slug}`,
					slug,
				});
			}

			await writeJson(sessionPath(targetSlug, "renamed.json"), {
				id: "session-1",
				name: "Old session",
				data: {
					npcs: [{ id: "npc-1", firstName: "Old", slug: "mira" }],
					locations: [{ id: "loc-1", name: "Old place", slug: "mill" }],
				},
			});
			await writeEntity(targetSlug, "npc", "mira", {
				id: "npc-1",
				firstName: "Old",
				slug: "mira",
			});
			await writeEntity(targetSlug, "locations", "mill", {
				id: "loc-1",
				name: "Old place",
				slug: "mill",
			});

			await importCampaignPartialArchiveBundle(targetSlug, {
				sections: ["sessions", "npc", "locations"],
				bundle: {
					meta: { slug: sourceSlug, name: "Source" },
					sessions: [
						{
							fileName: "session.json",
							content: {
								id: "session-1",
								name: "Imported session",
								data: {
									npcs: [{ id: "npc-1", firstName: "Imported", slug: "mira" }],
									locations: [
										{ id: "loc-1", name: "Imported place", slug: "mill" },
									],
								},
							},
						},
					],
					entities: {
						npc: [
							{
								id: "npc-1",
								firstName: "Imported",
								slug: "mira",
							},
						],
						locations: [
							{
								id: "loc-1",
								name: "Imported place",
								slug: "mill",
							},
						],
					},
				},
			});

			const sessions = await listSessions(targetSlug);
			assert.equal(sessions.length, 1);
			assert.equal(sessions[0].fileName, "renamed.json");
			assert.equal(sessions[0].name, "Imported session");
			assert.equal(
				await exists(sessionPath(targetSlug, "session.json")),
				false,
			);

			const session = await readSession(targetSlug, "renamed.json");
			assert.equal(session.data.npcs.length, 1);
			assert.equal(session.data.npcs[0].firstName, "Imported");
			assert.equal(session.data.locations.length, 1);
			assert.equal(session.data.locations[0].name, "Imported place");

			const npcs = await listEntities(targetSlug, "npc");
			assert.equal(npcs.length, 1);
			assert.equal(npcs[0].slug, "mira");
			assert.equal(npcs[0].firstName, "Imported");
			assert.equal(
				await exists(
					path.join(campaignDir(targetSlug), "npc", "mira-2"),
				),
				false,
			);

			const locations = await listEntities(targetSlug, "locations");
			assert.equal(locations.length, 1);
			assert.equal(locations[0].slug, "mill");
			assert.equal(locations[0].name, "Imported place");
			assert.equal(
				await exists(
					path.join(campaignDir(targetSlug), "locations", "mill-2"),
				),
				false,
			);
		} finally {
			await cleanupTestData(sourceSlug);
			await cleanupTestData(targetSlug);
		}
	},
);

await run(
	"encounter monster helpers use special HP and detect formulas",
	() => {
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
		const generatedIdMonster = createEncounterMonsterInstance({
			name: "No Id Monster",
			hp: { average: 12 },
		});
		assert.ok(generatedIdMonster.id);
		assert.equal(
			createEncounterMonsterInstance({
				id: "existing-id",
				name: "Existing Id Monster",
				hp: { average: 12 },
			}).id,
			"existing-id",
		);
		assert.ok(ensureEncounterMonsterId({ name: "Imported" }).id);
		assert.equal(
			ensureEncounterMonsterId({ id: "imported-id", name: "Imported" }).id,
			"imported-id",
		);
		assert.equal(hasMonsterHpFormula({ hp: { special: "80" } }), false);
		assert.equal(hasMonsterHpFormula({ hp: { formula: "12d8+24" } }), true);
		assert.equal(hasMonsterHpFormula({ hit_dice: "4d10+8" }), true);
	},
);

await run("local encounter AI monster edits preserve source", () => {
	const beforeSession = {
		fileName: "session.json",
		data: {
			encounters: [
				{
					id: "enc-1",
					monsters: [
						{
							id: "orc-id",
							instanceId: "inst-1",
							name: "Orc Brute",
							originalBestiaryName: "Orc",
							source: "MM",
							currentHp: 15,
							hit_points: 15,
						},
					],
				},
			],
		},
	};
	const change = buildLocalEncounterMonsterSessionChange({
		campaignSlug: "camp",
		sessionFile: "session.json",
		encounterId: "enc-1",
		targetInstanceId: "inst-1",
		beforeSession,
		nextMonster: {
			id: "orc-id",
			name: "Orc Brute",
			source: "CUSTOM",
			hp: { average: 30, formula: "4d8+12" },
		},
	});
	const editedMonster = change.after.data.encounters[0].monsters[0];

	assert.equal(editedMonster.source, "MM");
	assert.equal(editedMonster.originalBestiaryName, "Orc");
	assert.equal(editedMonster._localOverride, true);
	assert.equal(editedMonster.hit_points, 30);
});

await run(
	"storage moveEntity transfers characters and preserves data",
	async () => {
		await withTestSlug("move-entity", async (slug) => {
			await writeEntity(slug, "characters", "hero", {
				id: "hero-id",
				firstName: "Hero",
				lastName: "One",
				notes: [{ id: 1, title: "N", text: "T" }],
			});

			const moved = await moveEntity(slug, "characters", "hero", "npc");

			assert.equal(moved.slug, "hero");
			assert.equal(moved.id, "hero-id");
			assert.equal(moved.firstName, "Hero");
			assert.equal(
				await exists(
					path.join(campaignDir(slug), "characters", "hero"),
				),
				false,
			);
			assert.equal(
				await exists(
					path.join(campaignDir(slug), "npc", "hero"),
				),
				true,
			);

			const npcs = await listEntities(slug, "npc");
			assert.equal(npcs.length, 1);
			assert.equal(npcs[0].notes[0].text, "T");
		});
	},
);

await run(
	"storage updates bracketed entity mentions after rename",
	async () => {
		await withTestSlug("rename-mentions", async (slug) => {
			await ensureDir(path.join(campaignDir(slug), "sessions"));
			await writeJson(campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Mentions",
				description: "Meet [Old Name] in the city.",
			});
			await writeEntity(slug, "characters", "hero", {
				id: "hero-id",
				firstName: "New",
				lastName: "Name",
				motivation: "Formerly [Old Name].",
			});
			await writeEntity(slug, "locations", "city", {
				id: "city-id",
				name: "City",
				description: "Rumors mention [ old   name ].",
			});
			await writeJson(sessionPath(slug, "session.json"), {
				id: "session-id",
				name: "Session",
				data: {
					scenes: [{ summary: "[Old Name] arrives." }],
				},
			});

			await updateCampaignMentionReferences(
				slug,
				"Old Name",
				"New Name",
			);

			const meta = await readCampaign(slug);
			const characters = await listEntities(slug, "characters");
			const locations = await listEntities(slug, "locations");
			const session = await readSession(slug, "session.json");

			assert.equal(meta.description, "Meet [New Name] in the city.");
			assert.equal(characters[0].motivation, "Formerly [New Name].");
			assert.equal(locations[0].description, "Rumors mention [New Name].");
			assert.equal(session.data.scenes[0].summary, "[New Name] arrives.");
		});
	},
);

await run("5etools updater downloads missing tokens for new monsters", async () => {
	const source = await fs.readFile("scripts/update-5etools-data.mjs", "utf8");

	assert.match(source, /const IMG_REPO = "5etools-img"/);
	assert.match(
		source,
		/const BESTIARY_TOKENS_DIR = path\.join\(BESTIARY_DIR, "tokens"\)/,
	);
	assert.match(source, /function getRemoteTokenUrl\(monster\)/);
	assert.match(
		source,
		/raw\.githubusercontent\.com\/\$\{IMG_OWNER\}\/\$\{IMG_REPO\}/,
	);
	assert.match(source, /\/bestiary\/\$\{encodeURIComponent\(source\)\}/);
	assert.match(source, /async function downloadMissingNewBestiaryTokens/);
	assert.match(source, /function getNewMonsters\(currentKeys, monsters = \[\]\)/);
	assert.match(source, /collectCurrentBestiaryMonsterKeys\(\)/);
	assert.match(source, /collectMonstersFromJsonFiles\(tmpBestiaryDir\)/);
	assert.match(source, /downloadMissingNewBestiaryTokens\(newMonsters\)/);
	assert.match(
		source,
		/New monsters: \$\{newMonsters\.length\}; tokens downloaded:/,
	);
});

await run("5etools materializer preserves copied monster names", async () => {
	const tempRoot = path.join(
		process.cwd(),
		`.tmp-materialize-test-${Date.now()}-${Math.random()
			.toString(36)
			.slice(2, 8)}`,
	);
	const tempBestiaryDir = path.join(tempRoot, "database", "bestiary");

	try {
		await fs.mkdir(tempBestiaryDir, { recursive: true });
		await fs.mkdir(path.join(tempRoot, "scripts"), { recursive: true });
		await fs.cp(
			path.join(process.cwd(), "scripts", "materialize-bestiary-copies.mjs"),
			path.join(tempRoot, "scripts", "materialize-bestiary-copies.mjs"),
		);
		await fs.cp(path.join(process.cwd(), "shared"), path.join(tempRoot, "shared"), {
			recursive: true,
		});

		await fs.writeFile(
			path.join(tempBestiaryDir, "bestiary-mm.json"),
			`${JSON.stringify(
				{
					monster: [
						{
							name: "Tribal Warrior",
							source: "MM",
							type: "humanoid",
							trait: [{ name: "Brave", entries: ["A tribal warrior acts."] }],
						},
						{
							name: "Vampire",
							source: "MM",
							type: "undead",
							trait: [{ name: "Vampire Weaknesses", entries: ["The vampire waits."] }],
						},
						{
							name: "Wraith",
							source: "MM",
							type: "undead",
							trait: [{ name: "Incorporeal", entries: ["The wraith moves."] }],
						},
					],
				},
				null,
				2,
			)}\n`,
			"utf8",
		);
		await fs.writeFile(
			path.join(tempBestiaryDir, "bestiary-copies.json"),
			`${JSON.stringify(
				{
					monster: [
						{
							name: "Tribal Warrior Spore Servant",
							source: "IDRotF",
							_copy: {
								name: "Tribal Warrior",
								source: "MM",
								_mod: {
									"*": [
										{
											mode: "replaceTxt",
											replace: "tribal warrior",
											with: "spore servant",
											flags: "i",
										},
									],
								},
							},
						},
						{
							name: "Ctenmiir the Vampire",
							source: "LLK",
							_copy: {
								name: "Vampire",
								source: "MM",
								_mod: {
									"*": {
										mode: "replaceTxt",
										replace: "the vampire",
										with: "Ctenmiir",
										flags: "i",
									},
								},
							},
						},
						{
							name: "Mormesk the Wraith",
							source: "PaBTSO",
							_copy: {
								name: "Wraith",
								source: "MM",
								_mod: {
									"*": {
										mode: "replaceTxt",
										replace: "the wraith",
										with: "Mormesk",
										flags: "i",
									},
								},
							},
						},
					],
				},
				null,
				2,
			)}\n`,
			"utf8",
		);

		const result = spawnSync(
			process.execPath,
			[path.join("scripts", "materialize-bestiary-copies.mjs")],
			{ cwd: tempRoot, encoding: "utf8" },
		);
		assert.equal(result.status, 0, result.stderr || result.stdout);

		const materialized = JSON.parse(
			await fs.readFile(path.join(tempBestiaryDir, "bestiary-copies.json"), "utf8"),
		).monster;
		assert.deepEqual(
			materialized.map((monster) => monster.name),
			[
				"Tribal Warrior Spore Servant",
				"Ctenmiir the Vampire",
				"Mormesk the Wraith",
			],
		);
		assert.equal(materialized.some((monster) => monster._copy), false);
	} finally {
		await fs.rm(tempRoot, { recursive: true, force: true });
	}
});

await run("AI patch service applies targeted session operations", async () => {
	await withTestSlug("ai-patch-session", async (slug) => {
		await ensureDir(path.join(campaignDir(slug), "sessions"));
		await writeJson(campaignMetaPath(slug), {
			id: "campaign-id",
			name: "Patch Campaign",
			description: "",
			notes: [],
		});
		await writeJson(sessionPath(slug, "session.json"), {
			id: "session-id",
			name: "Session",
			data: {
				npcs: [
					{
						id: "npc-1",
						firstName: "Old",
						lastName: "Scout",
						trait: "Quiet.",
						notes: [],
					},
				],
				locations: [],
				scenes: [
					{
						id: "scene-1",
						texts: { summary: "Old scene", goal: "", stakes: "", location: "" },
						notes: [],
						npcs: [],
					},
				],
				encounters: [],
				notes: [],
			},
		});

		const result = await aiPatchService.applyAiOperations({
			payload: {
				version: 2,
				operations: [
					{
						op: "update",
						entity: "npc",
						scope: "session",
						id: "npc-1",
						patch: { trait: "Alert and impatient." },
					},
					{
						op: "create",
						entity: "location",
						scope: "session",
						clientId: "loc-1",
						data: { name: "Hidden Cellar", description: "Cold stone room." },
					},
					{
						op: "appendNote",
						entity: "scene",
						id: "scene-1",
						note: { title: "Combat", text: "Use falling shelves." },
					},
					{
						op: "appendNote",
						entity: "session",
						note: { title: "Prep", text: "Keep pressure on the party." },
					},
					{
						op: "create",
						entity: "scene",
						clientId: "scene-new",
						data: {
							texts: {
								summary: "New scene",
								goal: "Find the hidden ledger.",
								stakes: "The cult escapes if the party hesitates.",
								location: "Hidden Cellar",
							},
						},
					},
					{
						op: "appendNote",
						entity: "scene",
						targetClientId: "scene-new",
						note: { title: "Hook", text: "Fresh clue." },
					},
				],
			},
			campaignSlug: slug,
			sessionFile: "session.json",
			entityScope: "session",
			permissions: {
				allowCharacters: true,
				allowNpcs: true,
				allowLocations: true,
				allowEncounters: false,
			},
		});

		assert.equal(result.updated.fileName, "session.json");
		const session = await readSession(slug, "session.json");
		assert.equal(session.data.npcs.length, 1);
		assert.equal(session.data.npcs[0].trait, "Alert and impatient.");
		assert.equal(session.data.locations.length, 1);
		assert.equal(session.data.locations[0].name, "Hidden Cellar");
		assert.equal(session.data.notes[0].title, "Prep");
		assert.equal(session.data.notes[0].text, "Keep pressure on the party.");
		assert.equal(session.data.scenes[0].notes[0].text, "Use falling shelves.");
		assert.equal(session.data.scenes[1].texts.summary, "New scene");
		assert.equal(session.data.scenes[1].texts.goal, "Find the hidden ledger.");
		assert.equal(
			session.data.scenes[1].texts.stakes,
			"The cult escapes if the party hesitates.",
		);
		assert.equal(session.data.scenes[1].texts.location, "Hidden Cellar");
		assert.equal(session.data.scenes[1].notes[0].text, "Fresh clue.");
	});
});

await run("AI patch service skips orphan encounter creates", async () => {
	await withTestSlug("ai-orphan-encounter", async (slug) => {
		await ensureDir(path.join(campaignDir(slug), "sessions"));
		await writeJson(campaignMetaPath(slug), {
			id: "campaign-id",
			name: "Encounter Campaign",
			description: "",
			notes: [],
		});
		await writeJson(sessionPath(slug, "session.json"), {
			id: "session-id",
			name: "Session",
			data: { scenes: [], encounters: [], notes: [], npcs: [], locations: [] },
		});

		const result = await aiPatchService.applyAiOperations({
			payload: {
				version: 2,
				operations: [
					{
						op: "create",
						entity: "encounter",
						clientId: "enc-1",
						data: {
							name: "Unlinked Fight",
							monsters: [{ monsterName: "Goblin" }],
						},
					},
				],
			},
			campaignSlug: slug,
			sessionFile: "session.json",
			entityScope: "session",
			permissions: { allowEncounters: true },
		});

		const session = await readSession(slug, "session.json");
		assert.equal(session.data.encounters.length, 0);
		assert.equal(result.updated, null);
		assert.ok(
			result.warnings.some((warning) =>
				warning.includes('without matching scene encounterClientId "enc-1"'),
			),
		);
	});
});

await run("AI patch service links created encounters to scenes", async () => {
	await withTestSlug("ai-linked-encounter", async (slug) => {
		await ensureDir(path.join(campaignDir(slug), "sessions"));
		await writeJson(campaignMetaPath(slug), {
			id: "campaign-id",
			name: "Encounter Campaign",
			description: "",
			notes: [],
		});
		await writeJson(sessionPath(slug, "session.json"), {
			id: "session-id",
			name: "Session",
			data: { scenes: [], encounters: [], notes: [], npcs: [], locations: [] },
		});

		await aiPatchService.applyAiOperations({
			payload: {
				version: 2,
				operations: [
					{
						op: "create",
						entity: "scene",
						clientId: "scene-1",
						data: {
							texts: {
								summary: "The ambush begins.",
								goal: "Break through the attackers.",
								stakes: "The prisoner is carried away.",
								location: "Forest road",
							},
							encounterClientId: "enc-1",
						},
					},
					{
						op: "create",
						entity: "encounter",
						clientId: "enc-1",
						data: {
							name: "Road Ambush",
							monsters: [{ monsterName: "Goblin" }],
						},
					},
				],
			},
			campaignSlug: slug,
			sessionFile: "session.json",
			entityScope: "session",
			permissions: { allowEncounters: true },
		});

		const session = await readSession(slug, "session.json");
		assert.equal(session.data.encounters.length, 1);
		assert.equal(session.data.scenes.length, 1);
		assert.equal(
			session.data.scenes[0].encounterId,
			session.data.encounters[0].id,
		);
	});
});

await run(
	"AI patch service removes created encounters when scene link is not applied",
	async () => {
		await withTestSlug("ai-unapplied-encounter-link", async (slug) => {
			await ensureDir(path.join(campaignDir(slug), "sessions"));
			await writeJson(campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Encounter Campaign",
				description: "",
				notes: [],
			});
			await writeJson(sessionPath(slug, "session.json"), {
				id: "session-id",
				name: "Session",
				data: {
					scenes: [],
					encounters: [],
					notes: [],
					npcs: [],
					locations: [],
				},
			});

			const result = await aiPatchService.applyAiOperations({
				payload: {
					version: 2,
					operations: [
						{
							op: "update",
							entity: "scene",
							id: "missing-scene",
							patch: { encounterClientId: "enc-1" },
						},
						{
							op: "create",
							entity: "encounter",
							clientId: "enc-1",
							data: {
								name: "Lost Fight",
								monsters: [{ monsterName: "Goblin" }],
							},
						},
					],
				},
				campaignSlug: slug,
				sessionFile: "session.json",
				entityScope: "session",
				permissions: { allowEncounters: true },
			});

			const session = await readSession(slug, "session.json");
			assert.equal(session.data.encounters.length, 0);
			assert.ok(
				result.warnings.some((warning) =>
					warning.includes("without a final scene link"),
				),
			);
		});
	},
);

await run(
	"AI patch service keeps new session versions when creates duplicate campaign entities",
	async () => {
		await withTestSlug("ai-dedupe-session-entities", async (slug) => {
			await ensureDir(path.join(campaignDir(slug), "sessions"));
			await writeJson(campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Dedupe Campaign",
				description: "",
				notes: [],
			});
			await writeEntity(slug, "npc", "mira", {
				id: "campaign-npc-1",
				slug: "mira",
				firstName: "Mira",
				lastName: "",
				trait: "Campaign original.",
				notes: [],
			});
			await writeEntity(slug, "locations", "old-mill", {
				id: "campaign-location-1",
				slug: "old-mill",
				name: "Old Mill",
				description: "Campaign location.",
				notes: [],
			});
			await writeJson(sessionPath(slug, "session.json"), {
				id: "session-id",
				name: "Session",
				data: {
					scenes: [],
					encounters: [],
					notes: [],
					npcs: [],
					locations: [],
				},
			});

			const result = await aiPatchService.applyAiOperations({
				payload: {
					version: 2,
					operations: [
						{
							op: "create",
							entity: "npc",
							scope: "session",
							clientId: "npc-copy",
							data: { name: "Mira", trait: "Copied text." },
						},
						{
							op: "create",
							entity: "location",
							scope: "session",
							clientId: "location-copy",
							data: { name: "Old Mill", description: "Copied text." },
						},
						{
							op: "create",
							entity: "scene",
							data: {
								texts: {
									summary: "Meet [Mira] near [Old Mill].",
									goal: "Get the warning.",
									stakes: "[Mira] leaves if delayed.",
									location: "[Old Mill]",
								},
							},
						},
					],
				},
				campaignSlug: slug,
				sessionFile: "session.json",
				entityScope: "session",
				permissions: {
					allowCharacters: true,
					allowNpcs: true,
					allowLocations: true,
					allowEncounters: false,
				},
			});

			const session = await readSession(slug, "session.json");
			assert.equal(session.data.npcs.length, 1);
			assert.equal(session.data.npcs[0].id, "campaign-npc-1");
			assert.equal(session.data.npcs[0].trait, "Copied text.");
			assert.equal(session.data.locations.length, 1);
			assert.equal(session.data.locations[0].id, "campaign-location-1");
			assert.equal(session.data.locations[0].description, "Copied text.");
			assert.equal(session.data.scenes.length, 1);
			assert.equal(
				session.data.scenes[0].texts.summary,
				"Meet [Mira] near [Old Mill].",
			);
			assert.equal((await listEntities(slug, "npc")).length, 0);
			assert.equal((await listEntities(slug, "locations")).length, 0);
			assert.ok(
				result.warnings.some((warning) =>
					warning.includes("Moved duplicate campaign npc to session"),
				),
			);
			assert.ok(
				result.warnings.some((warning) =>
					warning.includes("Moved duplicate campaign locations to session"),
				),
			);
		});
	},
);

await run(
	"AI patch service applies mixed campaign and session entity scopes",
	async () => {
		await withTestSlug("ai-mixed-entity-scopes", async (slug) => {
			await ensureDir(path.join(campaignDir(slug), "sessions"));
			await writeJson(campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Mixed Scope Campaign",
				description: "",
				notes: [],
			});
			await writeJson(sessionPath(slug, "session.json"), {
				id: "session-id",
				name: "Session",
				data: {
					scenes: [],
					encounters: [],
					notes: [],
					npcs: [],
					locations: [],
				},
			});

			await aiPatchService.applyAiOperations({
				payload: {
					version: 2,
					operations: [
						{
							op: "create",
							entity: "npc",
							scope: "campaign",
							data: {
								name: "Recurring Patron",
								trait: "Returns across the campaign.",
							},
						},
						{
							op: "create",
							entity: "location",
							scope: "session",
							data: {
								name: "Collapsed Shrine",
								description: "A temporary stop for this session.",
							},
						},
					],
				},
				campaignSlug: slug,
				sessionFile: "session.json",
				entityScope: "mixed",
				permissions: {
					allowCharacters: true,
					allowNpcs: true,
					allowLocations: true,
					allowEncounters: false,
				},
			});

			const campaignNpcs = await listEntities(slug, "npc");
			const session = await readSession(slug, "session.json");
			assert.equal(campaignNpcs.length, 1);
			assert.equal(campaignNpcs[0].firstName, "Recurring");
			assert.equal(campaignNpcs[0].lastName, "Patron");
			assert.equal(session.data.locations.length, 1);
			assert.equal(session.data.locations[0].name, "Collapsed Shrine");
			assert.equal(session.data.npcs.length, 0);
		});
	},
);

await run(
	"AI patch service saves campaign changes from session AI operations",
	async () => {
		await withTestSlug("ai-session-campaign-change", async (slug) => {
			await ensureDir(path.join(campaignDir(slug), "sessions"));
			await writeJson(campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Session Campaign Change",
				description: "Old premise.",
				notes: [],
			});
			await writeJson(sessionPath(slug, "session.json"), {
				id: "session-id",
				name: "Session",
				data: {
					scenes: [],
					encounters: [],
					notes: [],
					npcs: [],
					locations: [],
				},
			});

			await aiPatchService.applyAiOperations({
				payload: {
					version: 2,
					operations: [
						{
							op: "update",
							entity: "campaign",
							patch: { description: "New premise from session planning." },
						},
						{
							op: "create",
							entity: "scene",
							data: {
								texts: {
									summary: "A focused opening scene.",
									goal: "Find the witness.",
									stakes: "The trail goes cold.",
									location: "Market Gate",
								},
							},
						},
					],
				},
				campaignSlug: slug,
				sessionFile: "session.json",
				entityScope: "mixed",
				permissions: {
					allowCharacters: true,
					allowNpcs: true,
					allowLocations: true,
					allowEncounters: false,
				},
			});

			const campaign = await readCampaign(slug);
			const session = await readSession(slug, "session.json");
			assert.equal(campaign.description, "New premise from session planning.");
			assert.equal(session.data.scenes.length, 1);
		});
	},
);

await run(
	"AI patch service keeps new campaign versions when creates duplicate session entities",
	async () => {
		await withTestSlug("ai-dedupe-campaign-entities", async (slug) => {
			await ensureDir(path.join(campaignDir(slug), "sessions"));
			await writeJson(campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Dedupe To Campaign",
				description: "",
				notes: [],
			});
			await writeJson(sessionPath(slug, "session.json"), {
				id: "session-id",
				name: "Session",
				data: {
					scenes: [],
					encounters: [],
					notes: [],
					npcs: [
						{
							id: "session-npc-1",
							slug: "mira",
							firstName: "Mira",
							lastName: "",
							trait: "Session version.",
							notes: [],
						},
					],
					locations: [],
				},
			});

			await aiPatchService.applyAiOperations({
				payload: {
					version: 2,
					operations: [
						{
							op: "create",
							entity: "npc",
							scope: "campaign",
							data: { name: "Mira", trait: "Campaign replacement." },
						},
					],
				},
				campaignSlug: slug,
				sessionFile: "session.json",
				entityScope: "mixed",
				permissions: {
					allowCharacters: true,
					allowNpcs: true,
					allowLocations: true,
					allowEncounters: false,
				},
			});

			const session = await readSession(slug, "session.json");
			const campaignNpcs = await listEntities(slug, "npc");
			assert.equal(session.data.npcs.length, 0);
			assert.equal(campaignNpcs.length, 1);
			assert.equal(campaignNpcs[0].id, "session-npc-1");
			assert.equal(campaignNpcs[0].trait, "Campaign replacement.");
		});
	},
);

await run(
	"AI patch service moves campaign-created session entities by targetClientId",
	async () => {
		await withTestSlug("ai-move-created-session-entity", async (slug) => {
			await ensureDir(path.join(campaignDir(slug), "sessions"));
			await writeJson(campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Move Created Campaign",
				description: "",
				notes: [],
			});
			await writeJson(sessionPath(slug, "session.json"), {
				id: "session-id",
				name: "Session",
				data: {
					scenes: [],
					encounters: [],
					notes: [],
					npcs: [
						{
							id: "old-session-npc",
							slug: "gate-informant",
							firstName: "Gate",
							lastName: "Informant",
							trait: "Old session duplicate.",
							notes: [],
						},
					],
					locations: [],
				},
			});

			await aiPatchService.applyAiOperations({
				payload: {
					version: 2,
					operations: [
						{
							op: "create",
							entity: "npc",
							scope: "campaign",
							clientId: "session-only-npc",
							data: { name: "Gate Informant", trait: "Nervous." },
						},
						{
							op: "moveScope",
							entity: "npc",
							targetClientId: "session-only-npc",
							from: "campaign",
							to: "session",
						},
					],
				},
				campaignSlug: slug,
				sessionFile: "session.json",
				entityScope: "session",
				permissions: {
					allowCharacters: true,
					allowNpcs: true,
					allowLocations: true,
					allowEncounters: false,
				},
			});

			const session = await readSession(slug, "session.json");
			const campaignNpcs = await listEntities(slug, "npc");
			assert.equal(campaignNpcs.length, 0);
			assert.equal(session.data.npcs.length, 1);
			assert.equal(session.data.npcs[0].id, "old-session-npc");
			assert.equal(session.data.npcs[0].firstName, "Gate");
			assert.equal(session.data.npcs[0].lastName, "Informant");
			assert.equal(session.data.npcs[0].trait, "Nervous.");
		});
	},
);

await run("AI patch service skips only fully empty scene creates", async () => {
	await withTestSlug("ai-empty-scene", async (slug) => {
		await writeJson(campaignMetaPath(slug), {
			name: "AI Empty Scene",
			description: "",
			notes: [],
		});
		await writeJson(sessionPath(slug, "session.json"), {
			id: "session-id",
			name: "Session",
			data: { scenes: [], encounters: [], notes: [], npcs: [], locations: [] },
		});

		const result = await aiPatchService.applyAiOperations({
			payload: {
				version: 2,
				operations: [
					{
						op: "create",
						entity: "scene",
						clientId: "partial-scene",
						data: { texts: { summary: "Only a summary" } },
					},
					{
						op: "create",
						entity: "scene",
						clientId: "empty-scene",
						data: {},
					},
				],
			},
			campaignSlug: slug,
			sessionFile: "session.json",
			entityScope: "session",
			permissions: {
				allowCharacters: true,
				allowNpcs: true,
				allowLocations: true,
				allowEncounters: false,
			},
		});

		const session = await readSession(slug, "session.json");
		assert.equal(session.data.scenes.length, 1);
		assert.equal(session.data.scenes[0].texts.summary, "Only a summary");
		assert.equal(session.data.scenes[0].texts.goal, "");
		assert.equal(session.data.scenes[0].texts.stakes, "");
		assert.equal(session.data.scenes[0].texts.location, "");
		assert.ok(
			result.warnings.some((warning) =>
				warning.includes("Skipped empty scene create"),
			),
		);
	});
});

await run(
	"AI response repository migrates legacy Bestiary history to canonical storage once",
	async () => {
		const canonicalPath = "ai/bestiary/canonical.json";
		const legacyPath = "campaigns/bestiary/_aiResponses.json";
		const legacyPayload = {
			responses: [
				{
					id: "older",
					text: "Стара відповідь",
					createdAt: "2026-01-01T00:00:00.000Z",
				},
				{
					id: "newer",
					text: "Нова відповідь",
					createdAt: "2026-02-01T00:00:00.000Z",
				},
			],
		};
		const files = new Map([[legacyPath, structuredClone(legacyPayload)]]);
		let legacyReads = 0;
		let canonicalWrites = 0;
		const repository = createAiResponseRepository({
			aiResponsesPath: () => canonicalPath,
			campaignAiResponsesPath: () => legacyPath,
			createId: () => "generated-id",
			exists: async (filePath) => files.has(filePath),
			getFileSize: async (filePath) =>
				filePath === canonicalPath && files.has(filePath) ? 321 : 0,
			readJson: async (filePath) => {
				if (filePath === legacyPath) legacyReads += 1;
				return structuredClone(files.get(filePath));
			},
			writeJson: async (filePath, value) => {
				if (filePath === canonicalPath) canonicalWrites += 1;
				files.set(filePath, structuredClone(value));
			},
		});

		const [firstRead, concurrentRead] = await Promise.all([
			repository.readAiResponses("bestiary"),
			repository.readAiResponses("bestiary"),
		]);
		assert.deepEqual(
			firstRead.map((entry) => entry.id),
			["newer", "older"],
		);
		assert.deepEqual(concurrentRead, firstRead);
		assert.equal(legacyReads, 1);
		assert.equal(canonicalWrites, 1);
		assert.deepEqual(
			files.get(canonicalPath).map((entry) => entry.id),
			["newer", "older"],
		);

		files.set(legacyPath, {
			responses: [
				{
					id: "legacy-only",
					text: "Не повинна замінити canonical history",
					createdAt: "2026-03-01T00:00:00.000Z",
				},
			],
		});
		const canonicalRead = await repository.readAiResponses("bestiary");
		assert.deepEqual(
			canonicalRead.map((entry) => entry.id),
			["newer", "older"],
		);
		assert.equal(legacyReads, 1);
		assert.equal(canonicalWrites, 1);
		assert.deepEqual(await repository.getAiResponsesStorageStats("bestiary"), {
			bytes: 321,
		});
	},
);

await run(
	"AI response repository preserves legacy history when migration write fails and retries",
	async () => {
		const canonicalPath = "ai/bestiary/canonical.json";
		const legacyPath = "campaigns/bestiary/_aiResponses.json";
		const legacyPayload = [
			{
				id: "legacy-entry",
				text: "Збережена відповідь",
				createdAt: "2026-01-01T00:00:00.000Z",
			},
		];
		const files = new Map([[legacyPath, structuredClone(legacyPayload)]]);
		let failCanonicalWrite = true;
		let legacyReads = 0;
		let canonicalWrites = 0;
		const repository = createAiResponseRepository({
			aiResponsesPath: () => canonicalPath,
			campaignAiResponsesPath: () => legacyPath,
			exists: async (filePath) => files.has(filePath),
			getFileSize: async () => 0,
			readJson: async (filePath) => {
				if (filePath === legacyPath) legacyReads += 1;
				return structuredClone(files.get(filePath));
			},
			writeJson: async (filePath, value) => {
				canonicalWrites += 1;
				if (failCanonicalWrite) {
					throw new Error("temporary write failure");
				}
				files.set(filePath, structuredClone(value));
			},
		});

		const availableDuringFailure =
			await repository.readAiResponses("bestiary");
		assert.deepEqual(
			availableDuringFailure.map((entry) => entry.id),
			["legacy-entry"],
		);
		assert.equal(files.has(canonicalPath), false);
		assert.deepEqual(files.get(legacyPath), legacyPayload);

		failCanonicalWrite = false;
		const migrated = await repository.readAiResponses("bestiary");
		assert.deepEqual(
			migrated.map((entry) => entry.id),
			["legacy-entry"],
		);
		assert.equal(files.has(canonicalPath), true);
		assert.deepEqual(files.get(legacyPath), legacyPayload);
		assert.equal(legacyReads, 2);
		assert.equal(canonicalWrites, 2);

		await repository.readAiResponses("bestiary");
		assert.equal(legacyReads, 2);
		assert.equal(canonicalWrites, 2);
	},
);

await run("storage keeps AI response history per campaign", async () => {
	await withTestSlug("ai-history-a", async (firstSlug) => {
		await withTestSlug("ai-history-b", async (secondSlug) => {
			const firstEntry = await addAiResponse({
				text: "Відповідь для першої кампанії",
				path: { campaign: firstSlug, session: null, encounter: null },
			});
			const secondEntry = await addAiResponse({
				text: "Відповідь для другої кампанії",
				path: { campaign: secondSlug, session: null, encounter: null },
			});

			const firstHistory = await readAiResponses(firstSlug);
			const secondHistory = await readAiResponses(secondSlug);

			assert.equal(firstHistory.length, 1);
			assert.equal(secondHistory.length, 1);
			assert.equal(firstHistory[0].path.campaign, firstSlug);
			assert.equal(secondHistory[0].path.campaign, secondSlug);
			assert.equal(firstHistory[0].text.includes("першої"), true);
			assert.equal(secondHistory[0].text.includes("другої"), true);

			const updatedFirst = await updateAiResponse(
				firstSlug,
				firstEntry.id,
				{
					applyState: "applied",
					changes: {
						resources: [
							{
								id: "campaign:test",
								kind: "campaign",
								label: "test",
								before: { name: "Before" },
								after: { name: "After" },
							},
						],
						summary: { modified: 1, total: 1 },
					},
				},
			);
			assert.equal(updatedFirst.applyState, "applied");
			const afterUpdate = await readAiResponses(firstSlug);
			assert.equal(afterUpdate[0].changes.resources.length, 1);
			assert.equal(afterUpdate[0].changes.summary.modified, 1);
			assert.equal(
				await updateAiResponse(firstSlug, "missing-response-id", {
					applyState: "undone",
				}),
				null,
			);
			assert.equal((await readAiResponses(firstSlug)).length, 1);

			await deleteAiResponse(secondSlug, secondEntry.id);
			assert.equal((await readAiResponses(secondSlug)).length, 0);

			await clearAiResponses(firstSlug);
			assert.equal((await readAiResponses(firstSlug)).length, 0);
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

await run(
	"image gallery categories expose stable ids and protected folders",
	() => {
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
			IMAGE_GALLERY_CATEGORIES.find((category) => category.id === "tokens")
				?.subs,
			["npc", "players"],
		);
		assert.deepEqual(
			IMAGE_GALLERY_CATEGORIES.find((category) => category.id === "characters")
				?.subs,
			["npc", "players"],
		);
	},
);

await run(
	"campaign entity APIs resolve entities by display names",
	async () => {
		for (const ownedPath of [
			"src/entities/campaign/model/entityIdentity.js",
			"src/entities/campaign/api/resolveEntityByName.js",
		]) {
			await fs.access(ownedPath);
		}
		await assert.rejects(
			fs.access("src/services/entities.js"),
			(error) => error.code === "ENOENT",
		);
		const campaignModelSource = await fs.readFile(
			"src/entities/campaign/model.js",
			"utf8",
		);
		const campaignApiSource = await fs.readFile(
			"src/entities/campaign/api.js",
			"utf8",
		);
		assert.match(campaignModelSource, /from "\.\/model\/entityIdentity\.js"/);
		assert.match(campaignApiSource, /from "\.\/api\/resolveEntityByName\.js"/);

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

		const originalGetEntities = campaignApi.getEntities;
		const calls = [];
		campaignApi.getEntities = async (slug, type) => {
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
			campaignApi.getEntities = originalGetEntities;
		}

		const eslintSource = await fs.readFile("eslint.config.js", "utf8");
		assert.match(eslintSource, /\*\*\/services\/entities\*/);
	},
);

await run(
	"EditableField, Tooltip, and ProjectGuide keep tooltip behavior",
	async () => {
		const editableFieldSource = await fs.readFile(
			"src/components/form/EditableField.jsx",
			"utf8",
		);
		const projectGuideSource = await fs.readFile(
			"src/app/router/ProjectGuide.jsx",
			"utf8",
		);
		const mainContentSource = await fs.readFile(
			"src/app/router/MainContent.jsx",
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
		const campaignViewSource = await fs.readFile(
			"src/pages/campaign/ui/CampaignPage.jsx",
			"utf8",
		);
		const sessionViewSource = await fs.readFile(
			"src/pages/session/ui/SessionPage.jsx",
			"utf8",
		);
		const noteCardSource = await fs.readFile(
			"src/components/common/NoteCard.jsx",
			"utf8",
		);
		const draggableListSource = await fs.readFile(
			"src/components/common/DraggableList.jsx",
			"utf8",
		);
		const aiIgnoredNoteListSource = await fs.readFile(
			"src/components/common/aiIgnoredNoteListProps.jsx",
			"utf8",
		);
		const mentionEditorSource = await fs.readFile(
			"src/shared/lib/mentionEditor.js",
			"utf8",
		);
		const characterCardSource = await fs.readFile(
			"src/entities/campaign/ui/CharacterCardView.jsx",
			"utf8",
		);
		const locationCardSource = await fs.readFile(
			"src/entities/campaign/ui/LocationCardView.jsx",
			"utf8",
		);
		const graphSource = await fs.readFile(
			"src/components/campaign/CampaignNotesGraph.jsx",
			"utf8",
		);
		const campaignHookSource = await fs.readFile(
			"src/features/campaign/model/useCampaignView.js",
			"utf8",
		);
		const sessionHookSource = await fs.readFile(
			"src/features/session/model/useSessionView.js",
			"utf8",
		);
		const sceneFieldsSource = await fs.readFile(
			"src/components/session/SceneCardFields.jsx",
			"utf8",
		);
		const mainContentCss = await fs.readFile(
			"src/assets/components/MainContent.css",
			"utf8",
		);
		const uk = JSON.parse(await fs.readFile("src/langs/uk.json", "utf8"));

		assert.match(
			editableFieldSource,
			/import Tooltip from "\.\.\/common\/Tooltip"/,
		);
		assert.equal(editableFieldSource.includes("HotkeysTooltipContent"), false);
		assert.equal(editableFieldSource.includes("Ctrl+B — Bold"), false);
		assert.match(
			mainContentSource,
			/import ProjectGuide from "\.\/ProjectGuide"/,
		);
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
		assert.equal(editableFieldSource.includes('paragraph.push("")'), false);
		assert.match(editableFieldSource, /LexicalComposer/);
		assert.match(editableFieldSource, /MarkdownShortcutPlugin/);
		assert.match(editableFieldSource, /\$readMarkdownValue/);
		assert.match(editableFieldSource, /MentionNode extends TextNode/);
		assert.equal(editableFieldSource.includes("$replaceMentionWithText"), false);
		assert.match(editableFieldSource, /requestMentionSelection\(dispatch\)/);
		assert.match(mentionEditorSource, /offset <= MENTION_BOUNDARY\.length/);
		assert.match(editableFieldSource, /handleSpaceAfterMention/);
		assert.equal(editableFieldSource.includes("let insertedSpace = false"), false);
		assert.equal(
			editableFieldSource.includes("let insertedFromSelection = false"),
			false,
		);
		assert.match(editableFieldSource, /enableHistory = true/);
		assert.match(editableFieldSource, /\{enableHistory && <HistoryPlugin \/>}/);
		assert.match(editableFieldSource, /data-app-history-shortcuts/);
		assert.match(editableFieldSource, /HISTORY_SHORTCUT_CODES/);
		assert.match(campaignHookSource, /shouldUseAppHistoryForEvent/);
		assert.match(sessionHookSource, /shouldUseAppHistoryForEvent/);
		assert.match(noteCardSource, /enableHistory = true/);
		assert.match(noteCardSource, /enableHistory=\{enableHistory\}/);
		assert.match(noteCardSource, /key="content"/);
		assert.match(noteCardSource, /key="title"/);
		assert.match(draggableListSource, /<Fragment key="item-content">/);
		assert.match(aiIgnoredNoteListSource, /getNoteRenderKey\(note, index\)/);
		assert.match(characterCardSource, /enableHistory = true/);
		assert.match(characterCardSource, /enableHistory=\{enableHistory\}/);
		assert.match(locationCardSource, /enableHistory = true/);
		assert.match(locationCardSource, /enableHistory=\{enableHistory\}/);
		assert.match(sceneFieldsSource, /enableHistory = true/);
		assert.match(sceneFieldsSource, /enableHistory=\{enableHistory\}/);
		assert.match(campaignViewSource, /enableHistory=\{false\}/);
		assert.match(sessionViewSource, /enableHistory=\{false\}/);
		assert.match(graphSource, /enableHistory=\{false\}/);
		assert.equal(editableFieldSource.includes("mention.title ="), false);
		assert.equal(editableFieldSource.includes("title={typeof title"), false);
		assert.equal(
			editableFieldCss.includes(".EditableField__mention:hover::after"),
			false,
		);
		assert.equal(
			editableFieldCss.includes(".EditableField__hotkeysTooltip"),
			false,
		);
		assert.match(mainContentCss, /\.ProjectGuide__hotkeys/);

		assert.match(tooltipSource, /anchorElement = null/);
		assert.match(tooltipSource, /anchorElement \|\| triggerRef\.current/);
		assert.match(tooltipSource, /const tooltipId = tooltipIdRef\.current/);
		assert.match(tooltipSource, /triggerActiveRef/);
		assert.match(
			tooltipSource,
			/!triggerActiveRef\.current[\s\S]*isOpen[\s\S]*disabled[\s\S]*!hasContent/,
		);
		assert.match(tooltipSource, /isDraggableListDragging\(\)/);
	},
);

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

await run("rollDiceFormula supports multiplication and parentheses", () => {
	const originalRandom = Math.random;
	const originalNow = Date.now;
	let idx = 0;
	const randomValues = [0.5, 0.99];

	Math.random = () => randomValues[idx++];
	Date.now = () => 67890;

	try {
		const result = rollDiceFormula("((1d6 - 1) * 100) + 1d100");
		assert.equal(result.id, 67890);
		assert.equal(result.formula, "((1d6 - 1) * 100) + 1d100");
		assert.equal(result.total, 400);
		assert.equal(result.expressionBreakdown, "(4 - 1) * 100 + 100");
		assert.equal(result.min, 1);
		assert.equal(result.max, 600);
		assert.equal(result.average, 300);
		assert.equal(result.isCritical, false);
		assert.equal(result.breakdown.filter((entry) => entry.max).length, 2);
	} finally {
		Math.random = originalRandom;
		Date.now = originalNow;
	}
});

await run("dice probability distribution supports dice formulas", () => {
	const basic = getDiceProbabilityDistribution("2d6+1");
	assert.equal(basic.min, 3);
	assert.equal(basic.max, 13);
	assert.equal(basic.average, 8);
	assert.equal(basic.outcomes.length, 11);
	assert.ok(
		Math.abs(
			basic.outcomes.find((outcome) => outcome.value === 8).probability -
				6 / 36,
		) < 0.0000001,
	);

	const keepHighest = getDiceProbabilityDistribution("3d6h2");
	assert.equal(keepHighest.min, 2);
	assert.equal(keepHighest.max, 12);
	assert.ok(
		keepHighest.outcomes.find((outcome) => outcome.value === 12).probability >
			0,
	);
});

await run(
	"conditions and reference resolvers use normalized keys and cache",
	async () => {
		const originalSearchSpells = spellApi.search;
		const originalGetConditions = rulesReferenceApi.getConditions;
		const originalGetDiseases = rulesReferenceApi.getDiseases;
		const originalGetVariantRules = rulesReferenceApi.getVariantRules;
		const originalGetSkills = rulesReferenceApi.getSkills;
		const originalGetSenses = rulesReferenceApi.getSenses;
		let spellCalls = 0;
		let conditionCalls = 0;
		let diseaseCalls = 0;
		let variantRuleCalls = 0;
		let skillCalls = 0;
		let senseCalls = 0;

		spellApi.search = async (params = {}) => {
			spellCalls += 1;
			if (String(params.name || "").includes("magic missile")) {
				return [
					{ name: "Magic Missile|PHB", source: "PHB" },
					{ name: "Magic Missile|XPHB", source: "XPHB" },
				];
			}
			return [{ name: "Shield|PHB", source: "PHB" }];
		};

		rulesReferenceApi.getConditions = async () => {
			conditionCalls += 1;
			if (conditionCalls === 1) {
				throw new Error("temporary");
			}
			return [
				{ name: "Prone", entries: ["..."] },
				{ name: "Blinded", entries: ["..."] },
			];
		};

		rulesReferenceApi.getDiseases = async () => {
			diseaseCalls += 1;
			return [
				{ name: "Bluerot", entries: ["..."] },
				{ name: "Sight Rot", entries: ["..."] },
			];
		};

		rulesReferenceApi.getVariantRules = async () => {
			variantRuleCalls += 1;
			return [
				{ name: "Advantage", entries: ["..."] },
				{ name: "Cone [Area of Effect]", entries: ["..."] },
			];
		};

		rulesReferenceApi.getSkills = async () => {
			skillCalls += 1;
			return [
				{ name: "Medicine", ability: "wis", entries: ["..."] },
				{ name: "Perception", ability: "wis", entries: ["..."] },
			];
		};

		rulesReferenceApi.getSenses = async () => {
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
				(
					await resolveDiseaseInput({
						name: "Manual Disease",
						entries: ["text"],
					})
				).name,
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
				(
					await resolveVariantRuleInput({
						name: "Manual Rule",
						entries: ["text"],
					})
				).name,
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

			assert.equal(
				(await getSenseByName(" darkvision|XPHB ")).name,
				"Darkvision",
			);
			assert.equal(senseCalls, 1);
			assert.equal((await resolveSenseInput("Truesight")).name, "Truesight");
			assert.equal(
				(await resolveSenseInput({ name: "Manual Sense", entries: ["text"] }))
					.name,
				"Manual Sense",
			);
			assert.equal(await resolveSenseInput({ foo: "bar" }), null);
		} finally {
			spellApi.search = originalSearchSpells;
			rulesReferenceApi.getConditions = originalGetConditions;
			rulesReferenceApi.getDiseases = originalGetDiseases;
			rulesReferenceApi.getVariantRules = originalGetVariantRules;
			rulesReferenceApi.getSkills = originalGetSkills;
			rulesReferenceApi.getSenses = originalGetSenses;
		}
	},
);

await run("backups archive route sends gzip payload with dated filename", async () => {
	const originalListCampaignSlugs = campaignRepository.listCampaignSlugs;
	const originalExportCampaignArchiveBundle =
		archiveExportService.exportCampaignArchiveBundle;
	const layer = backupsRouter.stack.find(
		(item) => item.route?.path === "/export-all/archive",
	);
	assert.ok(layer);
	const handler = layer.route.stack[0].handle;

	campaignRepository.listCampaignSlugs = async () => ["alpha"];
	archiveExportService.exportCampaignArchiveBundle = async (slug) => ({
		meta: { slug, name: "Alpha" },
	});

	try {
		const headers = {};
		let sentBuffer = null;
		await handler(
			{},
			{
				setHeader(name, value) {
					headers[name] = value;
				},
				send(value) {
					sentBuffer = value;
				},
			},
			(error) => {
				throw error;
			},
		);

		assert.equal(headers["Content-Type"], "application/gzip");
		assert.match(
			headers["Content-Disposition"],
			/filename="prm-full-backup-\d{4}-\d{2}-\d{2}\.prma\.gz"/,
		);
		const payload = JSON.parse(zlib.gunzipSync(sentBuffer).toString("utf8"));
		assert.equal(payload.version, 2);
		assert.equal(payload.scope, "all");
		assert.deepEqual(payload.campaigns, [
			{ meta: { slug: "alpha", name: "Alpha" } },
		]);
	} finally {
		campaignRepository.listCampaignSlugs = originalListCampaignSlugs;
		archiveExportService.exportCampaignArchiveBundle =
			originalExportCampaignArchiveBundle;
	}
});

await run("archive request schemas reject unsafe import payloads", () => {
	const campaignBundle = {
		meta: { id: "campaign-id", name: "Alpha" },
		sessions: [],
		entities: { characters: [], npc: [], locations: [] },
		aiResponses: [],
	};
	const archiveBundle = { bundle: campaignBundle, images: [] };
	const archiveEnvelope = { version: 2, campaigns: [archiveBundle] };

	assert.equal(
		assertValidRequest(
			campaignBundle,
			validateCampaignBundleCollection,
		),
		campaignBundle,
	);
	assert.equal(
		assertValidRequest(
			archiveEnvelope,
			validateCampaignArchiveEnvelope,
		),
		archiveEnvelope,
	);
	assert.throws(
		() =>
			assertValidRequest([], validateCampaignBundleCollection),
		(error) =>
			error instanceof RequestValidationError &&
			error.status === 400 &&
			error.code === "INVALID_REQUEST" &&
			error.details[0]?.code === "min_items",
	);
	assert.throws(
		() =>
			assertValidRequest(
				{ meta: {}, sessions: "not-an-array" },
				validateCampaignBundleCollection,
			),
		(error) =>
			error instanceof RequestValidationError &&
			error.details.some(
				(issue) => issue.path === "body.meta.name",
			) &&
			error.details.some(
				(issue) => issue.path === "body.sessions",
			),
	);
	assert.throws(
		() =>
			assertValidRequest(
				{
					bundle: campaignBundle,
					sections: ["unknown"],
					images: [],
				},
				validatePartialArchiveBundle,
			),
		(error) =>
			error instanceof RequestValidationError &&
			error.details[0]?.code === "invalid_enum",
	);
});

await run(
	"backup import validation runs before destructive replacement",
	async () => {
		const importAllRoute = backupsRouter.stack.find(
			(item) => item.route?.path === "/import-all",
		);
		assert.ok(importAllRoute);
		assert.equal(importAllRoute.route.stack.length, 2);

		const originalClearAllCampaignData =
			archiveImportService.clearAllCampaignData;
		let clearCalls = 0;
		archiveImportService.clearAllCampaignData = async () => {
			clearCalls += 1;
		};

		try {
			let validationError = null;
			importAllRoute.route.stack[0].handle(
				{
					body: [],
					query: { strategy: "wipe_and_replace" },
				},
				{},
				(error) => {
					validationError = error || null;
				},
			);

			assert.ok(validationError instanceof RequestValidationError);
			assert.equal(validationError.code, "INVALID_REQUEST");
			assert.equal(clearCalls, 0);

			const importArchiveRoute = backupsRouter.stack.find(
				(item) => item.route?.path === "/import-archive",
			);
			assert.ok(importArchiveRoute);
			const handler = importArchiveRoute.route.stack.at(-1).handle;
			let archiveError = null;
			await handler(
				{
					file: { buffer: Buffer.from("not-json", "utf8") },
					query: { strategy: "wipe_and_replace" },
				},
				{},
				(error) => {
					archiveError = error;
				},
			);
			assert.ok(archiveError instanceof RequestValidationError);
			assert.equal(
				archiveError.details[0]?.code,
				"invalid_archive",
			);
			assert.equal(clearCalls, 0);
		} finally {
			archiveImportService.clearAllCampaignData =
				originalClearAllCampaignData;
		}
	},
);

await run(
	"campaign and session mutation schemas protect identity and ordering",
	() => {
		assert.deepEqual(validateCampaignCreate({ name: "Alpha" }), []);
		assert.deepEqual(validateCampaignPatch({ completed: true }), []);
		assert.deepEqual(validateEntityMove({ targetType: "npc" }), []);
		assert.deepEqual(
			validateReorderRequest({ orders: { alpha: 0, beta: 1 } }),
			[],
		);
		assert.deepEqual(validateSessionMutation({}), []);
		assert.deepEqual(
			validateSessionMutation({
				name: "Session",
				data: { scenes: [] },
			}),
			[],
		);
		assert.deepEqual(
			validateSessionReorder({
				orders: { "session.json": 0 },
			}),
			[],
		);

		assert.equal(
			validateCampaignCreate({})[0]?.path,
			"body.name",
		);
		assert.equal(
			validateCampaignPatch({ name: " " })[0]?.code,
			"invalid_string",
		);
		assert.equal(
			validateEntityMove({ targetType: "locations" })[0]?.code,
			"invalid_enum",
		);
		assert.equal(
			validateReorderRequest({ orders: { alpha: -1 } })[0]?.code,
			"invalid_order",
		);
		assert.equal(
			validateSessionMutation({ data: [] })[0]?.path,
			"body.data",
		);
		assert.equal(
			validateSessionReorder({ orders: { "session.json": 1.5 } })[0]
				?.code,
			"invalid_order",
		);
	},
);

await run(
	"campaign and session routes validate before mutation handlers",
	() => {
		const campaignCreateRoute = campaignsRouter.stack.find(
			(layer) =>
				layer.route?.path === "/" &&
				layer.route.methods.post,
		);
		const campaignMoveRoute = campaignsRouter.stack.find(
			(layer) =>
				layer.route?.path ===
				"/:slug/entities/:type/:entitySlug/move",
		);
		const campaignReorderRoute = campaignsRouter.stack.find(
			(layer) => layer.route?.path === "/reorder",
		);
		const sessionPatchRoute = sessionsRouter.stack.find(
			(layer) =>
				layer.route?.path === "/:fileName" &&
				layer.route.methods.patch,
		);
		const sessionReorderRoute = sessionsRouter.stack.find(
			(layer) => layer.route?.path === "/reorder",
		);

		for (const route of [
			campaignCreateRoute,
			campaignMoveRoute,
			campaignReorderRoute,
			sessionPatchRoute,
			sessionReorderRoute,
		]) {
			assert.ok(route);
			assert.equal(route.route.stack.length, 2);
		}

		const invalidRequests = [
			[campaignCreateRoute, {}],
			[campaignMoveRoute, { targetType: "locations" }],
			[campaignReorderRoute, { orders: { alpha: -1 } }],
			[sessionPatchRoute, { data: [] }],
			[sessionReorderRoute, { orders: null }],
		];
		for (const [route, body] of invalidRequests) {
			let validationError = null;
			route.route.stack[0].handle(
				{ body },
				{},
				(error) => {
					validationError = error || null;
				},
			);
			assert.ok(validationError instanceof RequestValidationError);
			assert.equal(validationError.code, "INVALID_REQUEST");
		}
	},
);

await run(
	"AI scene patch service links encounters and removes created orphans",
	() => {
		let nextSceneId = 0;
		const service = createScenePatchService({
			createId: () => `scene-${++nextSceneId}`,
		});
		const state = {
			sessionData: {
				data: {
					scenes: [],
					encounters: [
						{ id: "encounter-1" },
						{ id: "encounter-orphan" },
					],
				},
			},
			clientIdMap: new Map(),
			permissions: { allowEncounters: true },
			warnings: [],
			pendingSceneEncounterLinks: [],
			createdEncounterIds: new Set([
				"encounter-1",
				"encounter-orphan",
			]),
		};
		const operations = [
			{
				entity: "scene",
				op: "create",
				clientId: "scene-client",
				data: {
					texts: { summary: "Opening" },
					encounterClientId: "encounter-client",
				},
			},
		];

		assert.deepEqual(
			[
				...service.collectSceneEncounterClientIds(
					operations,
				),
			],
			["encounter-client"],
		);
		const created = service.applySceneOperation(
			state,
			operations[0],
			{},
		);
		assert.equal(created.saved.id, "scene-1");
		assert.equal(
			state.clientIdMap.get("scene-client").id,
			"scene-1",
		);
		state.clientIdMap.set("encounter-client", {
			entity: "encounter",
			id: "encounter-1",
		});

		assert.equal(service.finalizeSceneEncounterLinks(state), true);
		assert.equal(created.saved.encounterId, "encounter-1");
		assert.deepEqual(
			state.sessionData.data.encounters.map(
				(encounter) => encounter.id,
			),
			["encounter-1"],
		);
		assert.ok(
			state.warnings.some((warning) =>
				warning.includes("without a final scene link"),
			),
		);
	},
);

await run(
	"AI scene patch service preserves content and encounter permissions",
	() => {
		const service = createScenePatchService({
			createId: () => "scene-created",
		});
		const hiddenNote = {
			id: "hidden-note",
			title: "Hidden",
			text: "Hidden",
			_aiIgnored: true,
		};
		const existing = {
			id: "scene-existing",
			texts: {
				summary: "Old",
				goal: "Keep",
				stakes: "",
				location: "",
			},
			notes: [
				{
					id: "visible-note",
					title: "Visible",
					text: "Old",
				},
				hiddenNote,
			],
			npcs: [],
			encounterId: "encounter-existing",
		};
		const state = {
			sessionData: {
				data: {
					scenes: [existing],
					encounters: [],
				},
			},
			clientIdMap: new Map(),
			permissions: { allowEncounters: false },
			warnings: [],
			pendingSceneEncounterLinks: [],
			createdEncounterIds: new Set(),
		};

		const updated = service.applySceneOperation(
			state,
			{
				entity: "scene",
				op: "update",
				id: "scene-existing",
				patch: {
					texts: { summary: "Updated" },
					notes: [
						{
							id: "visible-note",
							title: "Visible",
							text: "Updated",
						},
					],
					encounterId: "encounter-forbidden",
				},
			},
			{},
		);
		assert.equal(updated.saved.texts.summary, "Updated");
		assert.equal(updated.saved.texts.goal, "Keep");
		assert.equal(
			updated.saved.encounterId,
			"encounter-existing",
		);
		assert.deepEqual(
			updated.saved.notes.map((note) => note.id),
			["visible-note", "hidden-note"],
		);
		assert.equal(updated.saved.notes[1], hiddenNote);

		const partial = service.applySceneOperation(
			state,
			{
				entity: "scene",
				op: "create",
				data: { texts: { summary: "Only summary" } },
			},
			{},
		);
		const empty = service.applySceneOperation(
			state,
			{
				entity: "scene",
				op: "create",
				data: {},
			},
			{},
		);
		assert.equal(partial.saved.texts.summary, "Only summary");
		assert.equal(empty, null);
		assert.ok(
			state.warnings.includes("Skipped empty scene create."),
		);
	},
);

await run(
	"AI content normalizer preserves ignored notes and stable note ids",
	() => {
		let nextId = 0;
		const normalizer = createAiContentNormalizer({
			createId: () => `generated-${++nextId}`,
			normalizeNoteValue: (note, { simplifiedNotes }) => ({
				id: note.id || `note-${++nextId}`,
				title: simplifiedNotes ? "" : note.title || "",
				text: note.text || "",
				collapsed: Boolean(note.collapsed),
			}),
		});
		const hidden = {
			id: 2,
			title: "Hidden",
			text: "Hidden",
			_aiIgnored: true,
		};
		const result = normalizer.normalizeCharacter(
			{
				name: "New Name",
				notes: [{ id: 1, title: "Visible", text: "Updated" }],
			},
			{
				id: "character-1",
				firstName: "Old",
				lastName: "Name",
				notes: [
					{ id: 1, title: "Visible", text: "Old" },
					hidden,
				],
			},
			{ simplifiedNotes: true },
		);

		assert.equal(result.id, "character-1");
		assert.equal(result.firstName, "New");
		assert.equal(result.lastName, "Name");
		assert.deepEqual(
			result.notes.map((note) => note.id),
			[1, 2],
		);
		assert.equal(result.notes[0].title, "");
		assert.equal(result.notes[1], hidden);
	},
);

await run(
	"AI entity patch service preserves duplicates, mentions, permissions, and scope",
	async () => {
		const campaignEntities = {
			npc: [
				{
					id: "campaign-npc",
					slug: "guide",
					firstName: "Guide",
					lastName: "",
				},
			],
			locations: [
				{
					id: "location-1",
					slug: "old-town",
					name: "Old Town",
				},
			],
			characters: [],
		};
		const deletes = [];
		const mentionUpdates = [];
		const entityGateway = {
			readCampaignEntityList: async (_campaignSlug, type) =>
				campaignEntities[type] || [],
			writeCampaignEntity: async (
				_campaignSlug,
				type,
				payload,
				existing,
			) => {
				const saved = {
					...payload,
					slug:
						existing?.slug ||
						payload.slug ||
						`${type}-new`,
				};
				const list = campaignEntities[type];
				const index = existing ? list.indexOf(existing) : -1;
				if (index >= 0) list[index] = saved;
				else list.push(saved);
				return saved;
			},
		};
		const repository = {
			deleteEntity: async (_campaignSlug, type, slug) => {
				deletes.push([type, slug]);
				campaignEntities[type] = campaignEntities[type].filter(
					(entity) => entity.slug !== slug,
				);
			},
			updateCampaignMentionReferences: async (
				_campaignSlug,
				oldName,
				newName,
			) => mentionUpdates.push([oldName, newName]),
		};
		const normalizer = {
			normalizeCharacter: (raw, existing) => ({
				...(existing || {}),
				...raw,
				id: existing?.id || raw.id,
				firstName:
					raw.firstName ||
					raw.name ||
					existing?.firstName ||
					"",
				lastName: raw.lastName ?? existing?.lastName ?? "",
			}),
			normalizeLocation: (raw, existing) => ({
				...(existing || {}),
				...raw,
				id: existing?.id || raw.id,
				name: raw.name || existing?.name || "",
			}),
		};
		const service = createEntityPatchService({
			createId: () => "generated-id",
			createSlug: (name) =>
				String(name).toLowerCase().replaceAll(" ", "-"),
			entityGateway,
			normalizer,
			repository,
		});
		const state = {
			campaignSlug: "alpha",
			sessionData: { data: { npcs: [], locations: [] } },
			clientIdMap: new Map(),
			defaultEntityScope: "session",
			permissions: {
				allowCharacters: true,
				allowNpcs: true,
				allowLocations: true,
			},
			warnings: [],
		};

		const duplicateResult = await service.applyEntityOperation(
			state,
			{
				entity: "npc",
				op: "create",
				scope: "session",
				clientId: "npc-client",
				data: {
					firstName: "Guide",
					description: "New version",
				},
			},
			{},
		);
		assert.equal(duplicateResult.saved.id, "campaign-npc");
		assert.equal(state.sessionData.data.npcs.length, 1);
		assert.equal(state.sessionData.data.npcs[0].slug, "guide");
		assert.equal(
			state.clientIdMap.get("npc-client").id,
			"campaign-npc",
		);
		assert.deepEqual(deletes[0], ["npc", "guide"]);
		assert.ok(
			state.warnings.some((warning) =>
				warning.includes("Moved duplicate campaign npc to session"),
			),
		);

		const updateResult = await service.applyEntityOperation(
			state,
			{
				entity: "location",
				op: "update",
				scope: "campaign",
				id: "location-1",
				patch: { name: "New Town" },
			},
			{},
		);
		assert.equal(updateResult.saved.id, "location-1");
		assert.equal(updateResult.saved.slug, "old-town");
		assert.deepEqual(mentionUpdates, [["Old Town", "New Town"]]);

		const moveResult = await service.applyEntityOperation(
			state,
			{
				entity: "location",
				op: "moveScope",
				id: "location-1",
				from: "campaign",
				to: "session",
			},
			{},
		);
		assert.equal(moveResult.moved, true);
		assert.equal(moveResult.saved.id, "location-1");
		assert.equal(state.sessionData.data.locations[0].slug, "old-town");
		assert.ok(
			deletes.some(
				([type, slug]) =>
					type === "locations" && slug === "old-town",
			),
		);

		state.permissions.allowNpcs = false;
		const denied = await service.applyEntityOperation(
			state,
			{
				entity: "npc",
				op: "create",
				scope: "campaign",
				data: { firstName: "Blocked" },
			},
			{},
		);
		assert.equal(denied, null);
		assert.ok(
			state.warnings.some((warning) =>
				warning.includes("disabled npc"),
			),
		);
	},
);

await run(
	"campaign entity gateway preserves slugs while saving AI entities",
	async () => {
		const writes = [];
		const gateway = createCampaignEntityGateway({
			createSlug: (name) => String(name).toLowerCase(),
			repository: {
				listEntities: async () => [{ id: "entity-1" }],
				ensureUniqueEntitySlug: async (_campaign, _type, slug) =>
					`${slug}-unique`,
				writeEntity: async (...args) => {
					writes.push(args);
					return args[3];
				},
			},
		});

		assert.equal(
			(await gateway.readCampaignEntityList("alpha", "npc"))[0].id,
			"entity-1",
		);
		const created = await gateway.writeCampaignEntity(
			"alpha",
			"npc",
			{ firstName: "Guide" },
		);
		assert.equal(created.slug, "guide-unique");

		const updated = await gateway.writeCampaignEntity(
			"alpha",
			"npc",
			{ firstName: "Renamed" },
			{ slug: "stable-slug" },
		);
		assert.equal(updated.slug, "stable-slug");
		assert.equal(writes.length, 2);
	},
);

await run(
	"AI note patch service resolves aggregate and scoped entity targets",
	async () => {
		const writes = [];
		const location = {
			id: "location-1",
			slug: "town",
			name: "Town",
			notes: [],
		};
		const service = createNotePatchService({
			createId: () => "note-new",
			entityGateway: {
				readCampaignEntityList: async (_campaignSlug, type) =>
					type === "locations" ? [location] : [],
				writeCampaignEntity: async (...args) => {
					writes.push(args);
					return { ...args[2] };
				},
			},
		});
		const state = {
			campaignSlug: "alpha",
			campaignMeta: { notes: [] },
			sessionData: {
				data: {
					notes: [{ id: 1, title: "Old", text: "Old" }],
					scenes: [{ id: "scene-1", notes: [] }],
					npcs: [{ id: "npc-1", firstName: "Guide", notes: [] }],
				},
			},
			clientIdMap: new Map(),
			defaultEntityScope: "session",
			campaignEntityCache: new Map(),
		};

		await service.applyNoteOperation(
			state,
			{ entity: "campaign", op: "appendNote", note: "Campaign" },
			{},
		);
		await service.applyNoteOperation(
			state,
			{
				entity: "session",
				op: "updateNote",
				noteId: 1,
				patch: { text: "Updated" },
			},
			{},
		);
		await service.applyNoteOperation(
			state,
			{
				entity: "scene",
				op: "appendNote",
				id: "scene-1",
				note: "Scene",
			},
			{},
		);
		await service.applyNoteOperation(
			state,
			{
				entity: "npc",
				op: "appendNote",
				id: "npc-1",
				scope: "session",
				note: "NPC",
			},
			{},
		);
		await service.applyNoteOperation(
			state,
			{
				entity: "location",
				op: "appendNote",
				id: "location-1",
				scope: "campaign",
				note: { title: "Hidden", text: "Town" },
			},
			{ simplifiedNotes: true },
		);

		assert.equal(state.campaignMeta.notes[0].text, "Campaign");
		assert.equal(state.sessionData.data.notes[0].id, 1);
		assert.equal(state.sessionData.data.notes[0].text, "Updated");
		assert.equal(
			state.sessionData.data.scenes[0].notes[0].text,
			"Scene",
		);
		assert.equal(
			state.sessionData.data.npcs[0].notes[0].text,
			"NPC",
		);
		assert.equal(location.notes[0].title, "");
		assert.equal(writes.length, 1);
		assert.equal(writes[0][1], "locations");

		const deleted = await service.applyNoteOperation(
			state,
			{
				entity: "location",
				op: "deleteNote",
				id: "location-1",
				noteId: "note-new",
				scope: "campaign",
			},
			{},
		);
		assert.equal(deleted.id, "note-new");
		assert.equal(location.notes.length, 0);
		assert.equal(writes.length, 2);
	},
);

await run(
	"AI apply aggregate service isolates loading and persistence",
	async () => {
		const writes = [];
		const service = createAiApplyAggregateService({
			readCampaign: async (slug) => ({ slug, name: "Campaign" }),
			readSession: async () => ({ id: "session-id", data: {} }),
			writeAggregateJson: async (filePath, value) =>
				writes.push([filePath, value]),
			getCampaignMetaPath: (slug) => `campaign/${slug}/meta`,
			getSessionPath: (slug, fileName) =>
				`campaign/${slug}/session/${fileName}`,
		});

		const aggregate = await service.loadApplyAggregate({
			campaignSlug: "alpha",
			sessionFile: "one.json",
		});
		const updated = await service.persistApplyAggregate({
			campaignSlug: "alpha",
			sessionFile: "one.json",
			...aggregate,
			campaignMetaChanged: true,
			sessionDataChanged: true,
			hasAppliedChanges: true,
		});

		assert.equal(aggregate.campaignMeta.slug, "alpha");
		assert.equal(aggregate.sessionData.id, "session-id");
		assert.deepEqual(
			writes.map(([filePath]) => filePath),
			["campaign/alpha/meta", "campaign/alpha/session/one.json"],
		);
		assert.equal(updated.fileName, "one.json");

		const bestiaryUpdate = await service.persistApplyAggregate({
			campaignMeta: null,
			sessionData: null,
			customBestiaryChange: {
				hasChanges: true,
				after: [{ id: "monster-id" }],
			},
		});
		assert.equal(bestiaryUpdate.monsters[0].id, "monster-id");
	},
);

await run(
	"AI operation dispatcher routes operations and tracks dirty aggregates",
	async () => {
		const calls = [];
		const state = {
			defaultEntityScope: "session",
			clientIdMap: new Map(),
		};
		const recordAsync = async (name, result) => {
			calls.push(name);
			return result;
		};
		const result = await dispatchAiOperations({
			operations: [
				{ entity: "monster", op: "create" },
				{ entity: "campaign", op: "update" },
				{ entity: "scene", op: "update" },
				{ entity: "encounter", op: "create" },
				{ entity: "npc", op: "appendNote" },
				{ entity: "location", op: "moveScope" },
			],
			state,
			normalizerOptions: {},
			text: (value) => String(value || ""),
			isCustomMonsterOperation: (operation) =>
				operation.entity === "monster",
			entityTypeFromOperation: (entity) =>
				entity === "npc"
					? "npc"
					: entity === "location"
						? "locations"
						: null,
			operationScope: () => "session",
			applyNoteOperation: () => recordAsync("note", {}),
			applyCampaignOperation: () => {
				calls.push("campaign");
				return {};
			},
			applySceneOperation: () => {
				calls.push("scene");
				return {};
			},
			applyEncounterOperation: () => recordAsync("encounter", {}),
			applyEntityOperation: () =>
				recordAsync("entity", { moved: true }),
		});

		assert.deepEqual(calls, [
			"campaign",
			"scene",
			"encounter",
			"note",
			"entity",
		]);
		assert.equal(result.hasAppliedChanges, true);
		assert.equal(result.campaignMetaChanged, true);
		assert.equal(result.sessionDataChanged, true);
	},
);

await run(
	"custom-monster patch service applies operations through its repository",
	async () => {
		let saved = [];
		const service = createCustomMonsterPatchService({
			repository: {
				readCustomBestiaryMonsters: async () => [
					{ id: "monster-1", name: "Old" },
				],
				writeCustomBestiaryMonsters: async (monsters) => {
					saved = structuredClone(monsters);
					return saved;
				},
			},
			normalizeMonster: (monster) => ({
				...monster,
				id: monster.id || "monster-2",
			}),
		});

		const result = await service.applyCustomMonsterOperations([
			{
				entity: "custom-monster",
				op: "update",
				id: "monster-1",
				patch: { name: "Updated" },
			},
			{
				entity: "monster",
				op: "create",
				data: { name: "Created" },
			},
		]);

		assert.equal(result.hasChanges, true);
		assert.equal(result.changedMonsters.length, 2);
		assert.deepEqual(
			saved.map((monster) => monster.name),
			["Updated", "Created"],
		);
	},
);

await run(
	"encounter patch service resolves monsters and preserves link contracts",
	async () => {
		const service = createEncounterPatchService({
			getBestiaryIndex: async () =>
				new Map([
					[
						"goblin|mm",
						{
							id: "goblin-mm",
							name: "Goblin",
							source: "MM",
							hp: { average: 7 },
							ac: [{ ac: 15 }],
						},
					],
				]),
			createId: () => "encounter-1",
			createInstanceId: () => "instance-1",
		});
		const state = {
			sessionData: { data: {} },
			clientIdMap: new Map(),
			permissions: {},
			warnings: [],
			linkedEncounterClientIds: new Set(["encounter-client"]),
			createdEncounterIds: new Set(),
		};

		const result = await service.applyEncounterOperation(state, {
			entity: "encounter",
			op: "create",
			clientId: "encounter-client",
			data: {
				name: "Ambush",
				monsters: [{ name: "Goblin" }],
			},
		});

		assert.equal(result.saved.id, "encounter-1");
		assert.equal(result.saved.monsters[0].currentHp, 7);
		assert.equal(result.saved.monsters[0].armor_class, 15);
		assert.equal(
			state.clientIdMap.get("encounter-client").id,
			"encounter-1",
		);
	},
);

await run(
	"archive export service composes full and selected campaign bundles",
	async () => {
		const service = createArchiveExportService({
			exists: async () => true,
			imagesDir: "images",
			listEntities: async (_slug, type) => [
				{ id: `${type}-id`, slug: `${type}-one` },
			],
			listSessions: async () => [{ fileName: "one.json" }],
			readAiResponses: async () => [{ id: "response-id" }],
			readCampaign: async (slug) => ({ id: "campaign-id", slug, name: "A" }),
			readDir: async () => [
				{
					name: "token.png",
					isDirectory: () => false,
					isFile: () => true,
				},
			],
			readFile: async () => Buffer.from("image"),
			readSession: async () => ({ id: "session-id", name: "One" }),
		});

		const full = await service.exportCampaignArchiveBundle("alpha");
		assert.equal(full.bundle.sessions[0].content.id, "session-id");
		assert.equal(full.bundle.entities.characters[0].id, "characters-id");
		assert.equal(full.images[0].base64, Buffer.from("image").toString("base64"));

		const partial = await service.exportCampaignPartialArchiveBundle(
			"alpha",
			["sessions", "npc", "images", "sessions", "unknown"],
		);
		assert.deepEqual(partial.sections, ["sessions", "npc", "images"]);
		assert.equal(partial.bundle.entities.locations, undefined);
		assert.equal(partial.images.length, 1);
	},
);

await run(
	"archive import service restores aggregates and confines image paths",
	async () => {
		const jsonFiles = new Map();
		const entities = [];
		const aiWrites = [];
		const imageWrites = [];
		const normalize = (value) => String(value).replaceAll("\\", "/");
		const service = createArchiveImportService({
			campaignDir: (slug) => `campaign/${slug}`,
			campaignMetaPath: (slug) => `campaign/${slug}/_campaign.json`,
			campaignSlug: (name) => name.toLowerCase().replace(/\s+/g, "-"),
			campaignsDir: "campaign",
			createId: () => "new-response-id",
			deleteCampaignData: async () => {},
			ensureDir: async () => {},
			ensureUniqueCampaignSlug: async () => "imported",
			ensureUniqueEntitySlug: async (_slug, _type, entitySlug) =>
				entitySlug,
			ensureUniqueSessionFile: async () => "one.json",
			exists: async () => false,
			imagesDir: "images",
			listCampaignSlugs: async () => [],
			listSessions: async () => [],
			now: () => new Date("2026-04-05T06:07:08.000Z"),
			readAiResponses: async () => [],
			readJson: async (filePath) => jsonFiles.get(normalize(filePath)),
			remove: async () => {},
			replaceImageSlugReferences: (value, oldSlug, newSlug) =>
				JSON.parse(
					JSON.stringify(value).replaceAll(
						`/api/images/${oldSlug}/`,
						`/api/images/${newSlug}/`,
					),
				),
			sanitizeName: (name) => String(name || "").trim(),
			sessionFileName: (name) => `${name}.json`,
			sessionPath: (slug, fileName) => `session/${slug}/${fileName}`,
			todayString: () => "2026-04-05",
			writeAiResponses: async (slug, values) =>
				aiWrites.push([slug, values]),
			writeEntity: async (...args) => entities.push(args),
			writeFile: async (filePath, value) =>
				imageWrites.push([normalize(filePath), value]),
			writeJson: async (filePath, value) =>
				jsonFiles.set(normalize(filePath), structuredClone(value)),
		});

		const meta = await service.importCampaignBundle({
			meta: {
				id: "campaign-id",
				slug: "source",
				name: "Imported",
				imageUrl: "/api/images/source/tokens/a.png",
			},
			sessions: [{ content: { id: "session-id" } }],
			entities: {
				npc: [{ id: "npc-id", slug: "npc-one" }],
			},
			aiResponses: [{ id: "old-response", path: { campaign: "source" } }],
		});
		assert.equal(meta.slug, "imported");
		assert.match(meta.imageUrl, /\/imported\//);
		assert.equal(
			jsonFiles.get("session/imported/one.json").id,
			"session-id",
		);
		assert.equal(entities[0][3].id, "npc-id");
		assert.equal(aiWrites[0][1][0].path.campaign, "imported");

		await service.restoreCampaignImagesFromArchive("imported", [
			{ relativePath: "tokens/a.png", base64: Buffer.from("a").toString("base64") },
			{ relativePath: "../outside.png", base64: Buffer.from("x").toString("base64") },
		]);
		assert.equal(imageWrites.length, 1);
		assert.match(imageWrites[0][0], /images\/imported\/tokens\/a\.png$/);
	},
);

await run(
	"image gallery read service combines user and official token assets",
	async () => {
		const directory = (name) => ({
			name,
			isDirectory: () => true,
			isFile: () => false,
		});
		const file = (name) => ({
			name,
			isDirectory: () => false,
			isFile: () => true,
		});
		const entries = new Map([
			["images", [directory("general")]],
			["images/general", [directory("tokens")]],
			["images/general/tokens", [file("hero.png")]],
			["tokens", [directory("MM"), file("goblin.png")]],
			["tokens/MM", [file("dragon.png")]],
		]);
		const normalize = (value) => String(value).replaceAll("\\", "/");
		const service = createImageGalleryReadService({
			bestiaryTokensDir: "tokens",
			encodeUrlPathSegments: (...parts) =>
				parts.flatMap((part) => String(part).split("/")).join("/"),
			exists: async (filePath) => entries.has(normalize(filePath)),
			getDirectorySize: async (filePath) => normalize(filePath).length,
			getFileSize: async () => 5,
			imagesDir: "images",
			normalizePathSegments: (value) =>
				String(value || "")
					.split(/[\\/]+/)
					.filter(Boolean),
			normalizeSourceList: (sources) =>
				sources.map((source) => source.toUpperCase()),
			readDir: async (filePath) => entries.get(normalize(filePath)) || [],
		});

		const result = await service.searchImageGalleryAssets({
			source: "general",
			category: "tokens",
		});
		assert.deepEqual(
			result.images.map((image) => image.name).sort(),
			["goblin.png", "hero.png"],
		);
		const ignored = await service.listBestiaryTokenAssets({
			ignoreSourcesList: ["mm"],
		});
		assert.deepEqual(ignored.subcategories, []);
		const stats = await service.getImageGalleryStorageStats({
			source: "general",
			category: "tokens",
		});
		assert.equal(stats.categoryBytes, "images/general/tokens".length);
	},
);

await run(
	"image asset repository lists and renames files with reference updates",
	async () => {
		const files = new Set([
			"images/alpha/tokens",
			"images/alpha/tokens/old.png",
		]);
		const replacements = [];
		const repository = createImageAssetRepository({
			campaignImagesDir: (slug, category, subcategory = "") =>
				["images", slug, category, subcategory].filter(Boolean).join("/"),
			ensureDir: async () => {},
			exists: async (filePath) =>
				files.has(String(filePath).replaceAll("\\", "/")),
			getFileSize: async () => 42,
			imagesDir: "images",
			readDir: async () => [
				{
					name: "old.png",
					isFile: () => true,
					isDirectory: () => false,
				},
			],
			renameWithRetry: async (from, to) => {
				files.delete(String(from).replaceAll("\\", "/"));
				files.add(String(to).replaceAll("\\", "/"));
			},
			updateAllImageReferences: async (items) =>
				replacements.push(...items),
		});

		const listed = await repository.listImages("alpha", "tokens");
		assert.equal(listed[0].sizeBytes, 42);
		const renamed = await repository.renameImage(
			"alpha",
			"tokens",
			"",
			"old.png",
			"new.png",
		);
		assert.equal(files.has("images/alpha/tokens/new.png"), true);
		assert.deepEqual(replacements, [renamed]);
	},
);

await run(
	"image reference service updates every persisted aggregate",
	async () => {
		const oldUrl = "/api/images/alpha/tokens/old.png";
		const newUrl = "/api/images/general/tokens/new.png";
		const files = new Map([
			["meta/alpha", { imageUrl: oldUrl }],
			["session/alpha/one.json", { data: { text: oldUrl } }],
			["ai/alpha", [{ attachments: [{ url: oldUrl }] }]],
		]);
		const entities = {
			characters: [{ slug: "hero", imageUrl: oldUrl }],
			npc: [],
			locations: [],
		};
		const service = createImageReferenceService({
			campaignAiResponsesPath: (slug) => `ai/${slug}`,
			campaignMetaPath: (slug) => `meta/${slug}`,
			exists: async (filePath) => files.has(filePath),
			listCampaignSlugs: async () => ["alpha"],
			listEntities: async (_slug, type) => entities[type],
			listSessions: async () => [{ fileName: "one.json" }],
			readJson: async (filePath) => structuredClone(files.get(filePath)),
			sessionPath: (slug, fileName) => `session/${slug}/${fileName}`,
			writeEntity: async (_slug, type, _entitySlug, entity) => {
				entities[type] = [structuredClone(entity)];
			},
			writeJson: async (filePath, value) =>
				files.set(filePath, structuredClone(value)),
		});

		await service.updateAllImageReferences([{ oldUrl, newUrl }]);
		assert.equal(files.get("meta/alpha").imageUrl, newUrl);
		assert.equal(entities.characters[0].imageUrl, newUrl);
		assert.equal(files.get("session/alpha/one.json").data.text, newUrl);

		await service.updateCampaignImageSlugReferences("alpha", "renamed");
		assert.match(files.get("meta/alpha").imageUrl, /\/general\//);
		assert.match(
			files.get("ai/alpha")[0].attachments[0].url,
			/\/renamed\//,
		);
	},
);

await run(
	"campaign lifecycle service coordinates campaign and image rename",
	async () => {
		const renames = [];
		const referenceUpdates = [];
		const service = createCampaignLifecycleService({
			campaignDir: (slug) => `campaign/${slug}`,
			deleteCampaignImages: async (slug) =>
				referenceUpdates.push(["delete-images", slug]),
			exists: async (filePath) => filePath === "images/old",
			imagesDir: "images",
			moveCampaignImagesToGeneral: async (slug) =>
				referenceUpdates.push(["move-images", slug]),
			removeCampaignDirectory: async (directoryPath) =>
				referenceUpdates.push(["delete-campaign", directoryPath]),
			renameWithRetry: async (from, to) => renames.push([from, to]),
			updateCampaignImageSlugReferences: async (oldSlug, newSlug) =>
				referenceUpdates.push([oldSlug, newSlug]),
		});

		await service.renameCampaignData("old", "new");
		assert.deepEqual(renames, [
			["campaign/old", "campaign/new"],
			["images/old", "images/new"],
		]);
		assert.deepEqual(referenceUpdates, [["old", "new"]]);

		await service.deleteCampaignData("new", { moveImagesToGeneral: true });
		assert.deepEqual(referenceUpdates.slice(1), [
			["move-images", "new"],
			["delete-campaign", "campaign/new"],
		]);
	},
);

await run(
	"campaign repository owns creation, listing, and reorder",
	async () => {
		const files = new Map();
		const repository = createCampaignRepository({
			campaignDir: (slug) => `campaign/${slug}`,
			campaignMetaPath: (slug) => `campaign/${slug}/_campaign.json`,
			campaignSlug: (name) => name.toLowerCase().replace(/\s+/g, "-"),
			campaignsDir: "campaign",
			createId: () => "campaign-id",
			ensureDir: async () => {},
			exists: async (filePath) => files.has(filePath),
			imagesDir: "images",
			listSessions: async () => [{ fileName: "one.json" }],
			now: () => new Date("2026-03-04T05:06:07.000Z"),
			readDir: async () => [
				{
					name: "my-campaign",
					isDirectory: () => true,
					isSymbolicLink: () => false,
				},
			],
			readJson: async (filePath) => structuredClone(files.get(filePath)),
			sanitizeName: (name) => String(name || "").trim(),
			writeJson: async (filePath, value) =>
				files.set(filePath, structuredClone(value)),
		});

		const campaign = await repository.createCampaign({
			name: "My Campaign",
		});
		assert.equal(campaign.id, "campaign-id");
		assert.equal(campaign.slug, "my-campaign");
		assert.equal(campaign.notes[0].id, 1772600767000);

		const listed = await repository.listCampaignsDetailed();
		assert.equal(listed[0].sessionCount, 1);
		await repository.reorderCampaigns({ "my-campaign": 4 });
		assert.equal(
			files.get("campaign/my-campaign/_campaign.json").order,
			4,
		);
	},
);

await run(
	"entity repository preserves IDs and updates cross-aggregate mentions",
	async () => {
		const files = new Map([
			["meta/alpha", { notes: [{ text: "Meet [Old Name]." }] }],
			[
				"session/alpha/one.json",
				{ id: "session-id", data: { text: "[Old Name]" } },
			],
		]);
		const normalize = (value) => String(value).replaceAll("\\", "/");
		const repository = createEntityRepository({
			campaignDir: (slug) => `campaign/${slug}`,
			campaignMetaPath: (slug) => `meta/${slug}`,
			campaignSlug: (name) => name.toLowerCase().replace(/\s+/g, "-"),
			createId: () => "entity-id",
			ensureDir: async () => {},
			exists: async (filePath) => files.has(normalize(filePath)),
			listSessions: async () => [{ fileName: "one.json" }],
			readDir: async (directoryPath) => {
				const prefix = `${normalize(directoryPath)}/`;
				return [...files.keys()]
					.filter(
						(filePath) =>
							filePath.startsWith(prefix) &&
							filePath.endsWith("/info.json"),
					)
					.map((filePath) => filePath.slice(prefix.length).split("/")[0])
					.filter((slug, index, all) => all.indexOf(slug) === index)
					.map((name) => ({ name, isDirectory: () => true }));
			},
			readJson: async (filePath) =>
				structuredClone(files.get(normalize(filePath))),
			sanitizeName: (name) => String(name || "").trim(),
			sessionPath: (slug, fileName) => `session/${slug}/${fileName}`,
			writeJson: async (filePath, value) =>
				files.set(normalize(filePath), structuredClone(value)),
		});

		const created = await repository.createEntity("alpha", "npc", {
			firstName: "Old",
			lastName: "Name",
		});
		const updated = await repository.updateEntity(
			"alpha",
			"npc",
			created.slug,
			{
				firstName: "New",
				lastName: "Name",
				id: "cannot-change",
				_updateMentionReferences: true,
			},
		);
		assert.equal(updated.id, "entity-id");
		assert.equal(files.get("meta/alpha").notes[0].text, "Meet [New Name].");
		assert.equal(
			files.get("session/alpha/one.json").data.text,
			"[New Name]",
		);
	},
);

await run(
	"session repository owns create, rename, reorder, and delete",
	async () => {
		const files = new Map([
			[
				"sessions/alpha/First.json",
				{
					id: "first-id",
					name: "First",
					order: 2,
					createdAt: "2026-01-01T00:00:00.000Z",
					data: {},
				},
			],
		]);
		const repository = createSessionRepository({
			campaignDir: (slug) => `campaigns/${slug}`,
			createId: () => "new-id",
			ensureDir: async () => {},
			exists: async (filePath) => files.has(filePath),
			now: () => new Date("2026-02-03T04:05:06.000Z"),
			readDir: async () =>
				[...files.keys()].map((filePath) => ({
					name: filePath.split("/").at(-1),
					isFile: () => true,
					isSymbolicLink: () => false,
				})),
			readJson: async (filePath) => structuredClone(files.get(filePath)),
			removeFile: async (filePath) => files.delete(filePath),
			renameWithRetry: async (from, to) => {
				files.set(to, files.get(from));
				files.delete(from);
			},
			sanitizeName: (name) => String(name || "").trim(),
			sessionFileName: (name) => `${name}.json`,
			sessionPath: (slug, fileName) => `sessions/${slug}/${fileName}`,
			todayString: () => "2026-02-03",
			writeJson: async (filePath, value) =>
				files.set(filePath, structuredClone(value)),
		});

		const created = await repository.createSession("alpha", {
			name: "Second",
			data: { scenes: [] },
		});
		assert.equal(created.id, "new-id");
		assert.equal(created.order, 3);
		assert.equal(created.fileName, "Second.json");

		const renamed = await repository.updateSession(
			"alpha",
			"Second.json",
			{ name: "Renamed", id: "cannot-change" },
		);
		assert.equal(renamed.id, "new-id");
		assert.equal(renamed.fileName, "Renamed.json");
		assert.equal(files.has("sessions/alpha/Second.json"), false);

		await repository.reorderSessions("alpha", { "Renamed.json": 0 });
		assert.equal(files.get("sessions/alpha/Renamed.json").order, 0);
		await repository.deleteSession("alpha", "Renamed.json");
		assert.equal(files.has("sessions/alpha/Renamed.json"), false);
	},
);

await run(
	"reference repository searches and filters bundled spells",
	async () => {
		const spells = [
			{ name: "Fire Bolt", level: 0, school: "V", source: "PHB" },
			{ name: "Fireball", level: 3, school: "V", source: "XPHB" },
			{ name: "Cure Wounds", level: 1, school: "A", source: "PHB" },
		];
		const repository = createReferenceDataRepository({
			databaseDir: "database",
			spellsDir: "spells",
			exists: async (filePath) =>
				filePath === "spells" || filePath.endsWith("all.json"),
			readJson: async () => ({ spell: spells }),
		});

		assert.deepEqual(
			(await repository.searchSpells({ name: "fire", school: "v" })).map(
				(spell) => spell.name,
			),
			["Fire Bolt", "Fireball"],
		);
		assert.deepEqual(await repository.listSpellSources(), ["PHB", "XPHB"]);
		assert.deepEqual(
			(await repository.getSpellsBySource("phb")).map((spell) => spell.name),
			["Fire Bolt", "Cure Wounds"],
		);
	},
);

await run(
	"custom Bestiary repository normalizes monsters, IDs, and favorites",
	async () => {
		const files = new Map();
		let nextId = 1;
		const repository = createCustomBestiaryRepository({
			addMonstersToIndex: (index, monsters, fallbackSource) => {
				for (const monster of monsters) {
					index.set(`${monster.name}|${fallbackSource}`, monster);
				}
			},
			buildMonsterIndex: async () =>
				new Map([["Goblin|MM", { name: "Goblin", source: "MM" }]]),
			calculateDiceFormulaAverage: () => 7,
			createId: () => `generated-${nextId++}`,
			customBestiaryPath: "custom.json",
			exists: async (filePath) => files.has(filePath),
			favoritesPath: "favorites.json",
			readJson: async (filePath) => structuredClone(files.get(filePath)),
			stripMentionBrackets: (value) => value,
			writeJson: async (filePath, value) =>
				files.set(filePath, structuredClone(value)),
		});

		const monsters = await repository.writeCustomBestiaryMonsters([
			{
				id: "same",
				name: "Zed",
				hp: { formula: "2d6" },
				action: ["Hit"],
				spellcasting: { name: "Magic" },
			},
			{ id: "same", title: "Alpha" },
		]);
		assert.deepEqual(
			monsters.map((monster) => monster.name),
			["Alpha", "Zed"],
		);
		assert.equal(new Set(monsters.map((monster) => monster.id)).size, 2);
		const zed = monsters.find((monster) => monster.name === "Zed");
		assert.equal(zed.hp.average, 7);
		assert.equal(Array.isArray(zed.spellcasting), true);
		assert.deepEqual(zed.action[0].entries, ["Hit"]);

		await repository.writeFavorites([{ name: "Zed", source: "CUSTOM" }]);
		assert.equal((await repository.readFavorites())[0].name, "Zed");
		const index = await repository.getBestiaryIndex();
		assert.equal(index.has("Goblin|MM"), true);
		assert.equal(index.has("Zed|CUSTOM"), true);
	},
);

await run(
	"bestiary reference repository normalizes official records",
	async () => {
		const repository = createBestiaryReferenceRepository({
			bestiaryDir: "bestiary",
			exists: async (filePath) => filePath.endsWith("all.json"),
			readJson: async () => ({
				monster: [
					{ name: "Goblin", source: "mm" },
					{ name: "Mage", source: "MM" },
				],
			}),
		});

		const index = await repository.buildMonsterIndex();
		assert.equal(index.get("goblin|MM").source, "MM");
		assert.deepEqual(
			new Set(await repository.listSources()),
			new Set(["mm", "MM"]),
		);
		assert.deepEqual(
			(await repository.getMonstersBySource("mm")).map(
				(monster) => monster.name,
			),
			["Goblin", "Mage"],
		);
	},
);

await run(
	"reference repository merges condition kinds and prefers newer sources",
	async () => {
		const repository = createReferenceDataRepository({
			exists: async () => true,
			readJson: async () => ({
				condition: [
					{ name: "Blinded", source: "PHB", page: 1, entries: ["old"] },
					{ name: "Blinded", source: "XPHB", page: 2, entries: ["new"] },
				],
				status: [
					{
						name: "Concentration",
						source: "PHB",
						page: 3,
						entries: ["status"],
					},
				],
			}),
		});
		const records = await repository.listConditions();
		assert.equal(records.length, 2);
		assert.deepEqual(
			records.map((item) => item.name),
			["Blinded", "Concentration"],
		);
		const blinded = records.find((item) => item.name === "Blinded");
		const concentration = records.find(
			(item) => item.name === "Concentration",
		);
		assert.equal(blinded.kind, "condition");
		assert.equal(blinded.source, "XPHB");
		assert.deepEqual(blinded.entries, ["new"]);
		assert.equal(concentration.kind, "status");
		assert.equal(concentration.source, "PHB");
	},
);

await run("reference repository returns deduped disease list", async () => {
	const repository = createReferenceDataRepository({
		exists: async () => true,
		readJson: async () => ({
			disease: [
				{ name: "Sight Rot", source: "DMG", page: 257, entries: ["old"] },
				{ name: "Sight Rot", source: "XDMG", page: 61, entries: ["new"] },
				{ name: "Bluerot", source: "GoS", page: 234, entries: ["blue"] },
			],
		}),
	});
	const records = await repository.listDiseases();
	assert.deepEqual(
		records.map((item) => item.name),
		["Bluerot", "Sight Rot"],
	);
	const sightRot = records.find((item) => item.name === "Sight Rot");
	assert.equal(sightRot.kind, "disease");
	assert.equal(sightRot.source, "XDMG");
	assert.deepEqual(sightRot.entries, ["new"]);
});

await run("reference repository returns variant rule list", async () => {
	const repository = createReferenceDataRepository({
		exists: async () => true,
		readJson: async () => ({
			variantrule: [
				{ name: "Advantage", entries: ["adv"] },
				{ name: "Cone [Area of Effect]", entries: ["cone"] },
			],
		}),
	});
	const records = await repository.listVariantRules();
	assert.deepEqual(
		records.map((item) => item.name),
		["Advantage", "Cone [Area of Effect]"],
	);
	assert.equal(records[0].kind, "variantrule");
	assert.deepEqual(records[0].entries, ["adv"]);
});

await run("reference repository returns skill list", async () => {
	const repository = createReferenceDataRepository({
		exists: async () => true,
		readJson: async () => ({
			skill: [
				{ name: "Medicine", ability: "wis", entries: ["med"] },
				{ name: "Arcana", ability: "int", entries: ["arc"] },
			],
		}),
	});
	const records = await repository.listSkills();
	assert.deepEqual(
		records.map((item) => item.name),
		["Arcana", "Medicine"],
	);
	assert.equal(records[0].kind, "skill");
	assert.equal(records[0].ability, "int");
	assert.deepEqual(records[0].entries, ["arc"]);
});

await run("reference repository returns sense list", async () => {
	const repository = createReferenceDataRepository({
		exists: async () => true,
		readJson: async () => ({
			sense: [
				{ name: "Darkvision", source: "PHB", entries: ["old"] },
				{ name: "Darkvision", source: "XPHB", entries: ["new"] },
				{ name: "Blindsight", source: "PHB", entries: ["blind"] },
			],
		}),
	});
	const records = await repository.listSenses();
	assert.deepEqual(
		records.map((item) => item.name),
		["Blindsight", "Darkvision"],
	);
	const darkvision = records.find((item) => item.name === "Darkvision");
	assert.equal(darkvision.kind, "sense");
	assert.equal(darkvision.source, "XPHB");
	assert.deepEqual(darkvision.entries, ["new"]);
});

await run("storage image listing and subcategory discovery", async () => {
	await withTestSlug("images-list", async (slug) => {
		const category = "characters";
		const rootDir = campaignImagesDir(slug, category);
		const nestedDir = campaignImagesDir(slug, category, "nested");
		const emptyDir = campaignImagesDir(slug, category, "empty");
		await ensureDir(rootDir);
		await ensureDir(nestedDir);
		await ensureDir(emptyDir);
		await fs.writeFile(path.join(rootDir, "a.png"), "a", "utf8");
		await fs.writeFile(path.join(rootDir, "b.txt"), "b", "utf8");
		await fs.writeFile(path.join(nestedDir, "c.webp"), "c", "utf8");
		await fs.writeFile(path.join(emptyDir, "notes.txt"), "notes", "utf8");

		const rootImages = await listImages(slug, category);
		assert.deepEqual(
			rootImages.map((item) => item.name),
			["a.png"],
		);
		assert.match(rootImages[0].url, /\/api\/images\//);
		assert.equal(rootImages[0].path, path.join(category, "", "a.png"));

		const subcategories = await listSubcategories(slug, category);
		assert.deepEqual(subcategories, ["empty", "nested"]);
		const subcategoryMeta = await listSubcategories(
			slug,
			category,
			"",
			{ includeMeta: true },
		);
		assert.deepEqual(subcategoryMeta, [
			{ name: "empty", hasFiles: false },
			{ name: "nested", hasFiles: true },
		]);
		const nestedImages = await listImages(slug, category, "nested");
		assert.deepEqual(
			nestedImages.map((item) => item.name),
			["c.webp"],
		);
	});
});

await run("storage lists readonly official bestiary token assets", async () => {
	const rootAssets = await listBestiaryTokenAssets();
	assert.ok(rootAssets.subcategories.includes("AATM"));
	assert.deepEqual(rootAssets.images, []);

	const sourceAssets = await listBestiaryTokenAssets({
		subcategory: "AATM",
	});
	assert.ok(
		sourceAssets.images.some((item) => item.name === "Animated Coffin.webp"),
	);
	assert.equal(sourceAssets.images[0].readonly, true);
	assert.match(sourceAssets.images[0].url, /^\/api\/bestiary\/tokens\/AATM\//);

	const searchAssets = await listBestiaryTokenAssets({
		search: "animated coffin",
	});
	assert.ok(
		searchAssets.images.some(
			(item) =>
				item.name === "Animated Coffin.webp" &&
				item.displayName === "Animated Coffin (AATM)",
		),
	);
});

await run("storage searches image gallery locally and globally", async () => {
	await withTestSlug("images-search-a", async (firstSlug) => {
		await withTestSlug("images-search-b", async (secondSlug) => {
			const firstDir = campaignImagesDir(
				firstSlug,
				"maps",
				"city/deep",
			);
			const secondDir = campaignImagesDir(secondSlug, "props");
			await ensureDir(firstDir);
			await ensureDir(secondDir);
			await fs.writeFile(path.join(firstDir, "hidden-map.png"), "a", "utf8");
			await fs.writeFile(path.join(secondDir, "hidden-prop.webp"), "b", "utf8");

			const local = await searchImageGalleryAssets({
				search: "hidden",
				source: firstSlug,
				category: "maps",
				subcategory: "city",
			});
			assert.deepEqual(
				local.images.map((item) => item.name),
				["hidden-map.png"],
			);
			assert.equal(local.images[0].subcategory, "city/deep");

			const global = await searchImageGalleryAssets({
				search: "hidden",
				categories: IMAGE_GALLERY_CATEGORIES.map((category) => category.id),
			});
			assert.ok(
				global.images.some(
					(item) =>
						item.source === firstSlug &&
						item.category === "maps" &&
						item.subcategory === "city/deep",
				),
			);
			assert.ok(
				global.images.some(
					(item) => item.source === secondSlug && item.category === "props",
				),
			);

			const official = await searchImageGalleryAssets({
				search: "animated coffin",
				categories: IMAGE_GALLERY_CATEGORIES.map((category) => category.id),
			});
			const officialImage = official.images.find((item) => item.readonly);
			assert.ok(officialImage);
			assert.equal(officialImage.source, "general");
			assert.equal(officialImage.assetSource, "bestiary");
			assert.equal(officialImage.category, "tokens");
			assert.equal(officialImage.subcategory, "AATM");
		});
	});
});

await run("storage detects campaign images recursively", async () => {
	await withTestSlug("campaign-has-images", async (slug) => {
		const category = "attachments";
		const nestedDir = campaignImagesDir(slug, category, "notes/nested");

		assert.equal(await campaignHasImages(slug), false);

		await ensureDir(nestedDir);
		assert.equal(await campaignHasImages(slug), false);

		await fs.writeFile(path.join(nestedDir, "map.png"), "x", "utf8");
		assert.equal(await campaignHasImages(slug), true);
	});
});

await run("storage renameImage handles success and collisions", async () => {
	await withTestSlug("rename-image", async (slug) => {
		const category = "attachments";
		const subcategory = "folder";
		const dir = campaignImagesDir(slug, category, subcategory);
		await ensureDir(dir);
		await fs.writeFile(path.join(dir, "old.png"), "x", "utf8");
		await fs.writeFile(path.join(dir, "existing.png"), "y", "utf8");

		const result = await renameImage(
			slug,
			category,
			subcategory,
			"old.png",
			"new.png",
		);
		assert.match(result.oldUrl, /old\.png$/);
		assert.match(result.newUrl, /new\.png$/);
		assert.equal(await exists(path.join(dir, "new.png")), true);
		assert.equal(await exists(path.join(dir, "old.png")), false);

		await assert.rejects(() =>
			renameImage(slug, category, subcategory, "missing.png", "x.png"),
		);
		await assert.rejects(() =>
			renameImage(
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
		const srcDir = campaignImagesDir(slug, category, srcSubcategory);
		await ensureDir(path.join(srcDir, "pack", "nested"));
		await fs.writeFile(path.join(srcDir, "a.png"), "a", "utf8");
		await fs.writeFile(
			path.join(srcDir, "pack", "nested", "b.png"),
			"b",
			"utf8",
		);

		const results = await moveImages(
			["a.png", "pack"],
			{ slug, category, subcategory: srcSubcategory },
			{ slug, category, subcategory: destSubcategory },
		);

		assert.equal(results.length, 2);
		assert.equal(await exists(path.join(srcDir, "a.png")), false);
		assert.equal(await exists(path.join(srcDir, "pack")), false);
		assert.equal(
			await exists(
				path.join(
					campaignImagesDir(slug, category, destSubcategory),
					"a.png",
				),
			),
			true,
		);
		assert.equal(
			await exists(
				path.join(
					campaignImagesDir(slug, category, destSubcategory),
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
			const baseDir = campaignImagesDir(
				slug,
				category,
				baseSubcategory,
			);
			await ensureDir(path.join(baseDir, "dropme", "nested"));
			await ensureDir(path.join(baseDir, "extractme", "inner"));
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

			await deleteImages(
				["dropme"],
				{ slug, category, subcategory: baseSubcategory },
				{ extractFolderContents: false },
			);
			assert.equal(await exists(path.join(baseDir, "dropme")), false);

			await deleteImages(
				["extractme"],
				{ slug, category, subcategory: baseSubcategory },
				{ extractFolderContents: true },
			);
			assert.equal(
				await exists(path.join(baseDir, "extractme")),
				false,
			);
			assert.equal(await exists(path.join(baseDir, "b.png")), true);
			assert.equal(
				await exists(path.join(baseDir, "inner", "c.png")),
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
			const root = campaignImagesDir(slug, category);
			await ensureDir(path.join(root, "old"));
			await ensureDir(path.join(root, "taken"));

			await assert.rejects(() =>
				renameSubcategory(slug, category, "missing", "target"),
			);
			await assert.rejects(() =>
				renameSubcategory(slug, category, "old", "taken"),
			);

			await renameSubcategory(slug, category, "old", "renamed");
			assert.equal(await exists(path.join(root, "renamed")), true);
			assert.equal(await exists(path.join(root, "old")), false);
		});
	},
);

await run(
	"storage updates campaign entities and session references after rename",
	async () => {
		await withTestSlug("ref-update", async (slug) => {
			const category = "characters";
			const subcategory = "players";
			const imagesDir = campaignImagesDir(slug, category, subcategory);
			await ensureDir(imagesDir);
			await fs.writeFile(path.join(imagesDir, "old.png"), "x", "utf8");

			const oldUrl = `/api/images/${encodeURIComponent(slug)}/${encodeURIComponent(category)}/${subcategory}/old.png`;
			const expectedNewUrl = `/api/images/${encodeURIComponent(slug)}/${encodeURIComponent(category)}/${subcategory}/new.png`;

			await ensureDir(path.join(campaignDir(slug), "sessions"));
			await writeJson(campaignMetaPath(slug), {
				id: `${slug}-id`,
				name: "Test Campaign",
				slug,
				imageUrl: oldUrl,
			});
			await writeEntity(slug, "characters", "hero", {
				id: "hero-1",
				firstName: "Hero",
				lastName: "One",
				level: 1,
				race: "Human",
				class: "Fighter",
				imageUrl: oldUrl,
			});
			await writeEntity(slug, "locations", "city", {
				id: "city-1",
				name: "City",
				description: "A test location",
				imageUrl: oldUrl,
			});

			const sessionFile = "session.json";
			await writeJson(sessionPath(slug, sessionFile), {
				id: "s1",
				name: "Session 1",
				createdAt: new Date().toISOString(),
				order: 0,
				data: {
					notes: [
						{ id: 1, title: "", text: `image ${oldUrl}`, collapsed: false },
					],
				},
			});

			await renameImage(
				slug,
				category,
				subcategory,
				"old.png",
				"new.png",
			);

			const meta = await readCampaign(slug);
			assert.equal(meta.imageUrl, expectedNewUrl);
			const entities = await listEntities(slug, "characters");
			assert.equal(entities[0].imageUrl, expectedNewUrl);
			const locations = await listEntities(slug, "locations");
			assert.equal(locations[0].imageUrl, expectedNewUrl);
			const session = await readSession(slug, sessionFile);
			assert.equal(JSON.stringify(session).includes(expectedNewUrl), true);
			assert.equal(JSON.stringify(session).includes(oldUrl), false);
		});
	},
);

await run(
	"storage renames campaign data and image folders together",
	async () => {
		const oldSlug = makeTestSlug("rename-campaign-old");
		const newSlug = makeTestSlug("rename-campaign-new");
		try {
			await cleanupTestData(oldSlug);
			await cleanupTestData(newSlug);

			const category = "characters";
			const subcategory = "players";
			const imagesDir = campaignImagesDir(
				oldSlug,
				category,
				subcategory,
			);
			await ensureDir(imagesDir);
			await fs.writeFile(path.join(imagesDir, "hero.png"), "x", "utf8");

			const oldUrl = `/api/images/${encodeURIComponent(oldSlug)}/${encodeURIComponent(category)}/${subcategory}/hero.png`;
			const newUrl = `/api/images/${encodeURIComponent(newSlug)}/${encodeURIComponent(category)}/${subcategory}/hero.png`;

			await ensureDir(path.join(campaignDir(oldSlug), "sessions"));
			await writeJson(campaignMetaPath(oldSlug), {
				id: `${oldSlug}-id`,
				name: "Old Campaign",
				slug: oldSlug,
				imageUrl: oldUrl,
			});
			await writeEntity(oldSlug, "characters", "hero", {
				id: "hero-1",
				firstName: "Hero",
				imageUrl: oldUrl,
			});
			await writeJson(sessionPath(oldSlug, "session.json"), {
				id: "session-1",
				name: "Session",
				data: { notes: [{ id: 1, text: oldUrl }] },
			});
			await addAiResponse({
				id: "response-1",
				path: { campaign: oldSlug },
				createdAt: new Date().toISOString(),
				text: oldUrl,
			});

			await renameCampaignData(oldSlug, newSlug);

			assert.equal(await exists(campaignDir(oldSlug)), false);
			assert.equal(await exists(campaignDir(newSlug)), true);
			assert.equal(await exists(path.join(IMAGES_DIR, oldSlug)), false);
			assert.equal(await exists(path.join(IMAGES_DIR, newSlug)), true);

			const meta = await readCampaign(newSlug);
			assert.equal(meta.imageUrl, newUrl);
			const characters = await listEntities(newSlug, "characters");
			assert.equal(characters[0].imageUrl, newUrl);
			const session = await readSession(newSlug, "session.json");
			assert.equal(JSON.stringify(session).includes(newUrl), true);
			assert.equal(JSON.stringify(session).includes(oldUrl), false);
			const history = await readAiResponses(newSlug);
			assert.equal(JSON.stringify(history).includes(newUrl), true);
			assert.equal(JSON.stringify(history).includes(oldUrl), false);
		} finally {
			await cleanupTestData(oldSlug);
			await cleanupTestData(newSlug);
		}
	},
);

const failed = results.filter((r) => !r.ok);
console.log(
	`\nTotal: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`,
);

if (failed.length > 0) {
	process.exitCode = 1;
}
