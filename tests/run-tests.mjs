import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

import { idsEqual } from "../src/utils/id.js";
import { isJsonObject, isJsonString } from "../src/utils/json.js";
import {
	matchesMonsterSearch,
	getMonsterTypeString,
} from "../src/utils/bestiary.js";
import classNames from "../src/utils/classNames.js";
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
} from "../src/utils/undoRedo.js";
import {
	normalizeConditionName,
	loadConditionsMap,
} from "../src/utils/conditions.js";
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
} from "../src/utils/mentionEditor.js";
import {
	buildNavigationUrl,
	parseUrl,
	shouldOpenInNewTabFromEvent,
} from "../src/utils/navigation.js";
import { downloadBlob, downloadJsonFile } from "../src/utils/download.js";
import {
	createEncounterMonsterInstance,
	ensureEncounterMonsterId,
	getMonsterBaseHp,
	hasMonsterHpFormula,
} from "../src/utils/encounters.js";
import {
	addSourceMonsterImageToDraft,
	getFirstChangedMonster,
	getFirstChangedMonsterName,
	isAiResponseVisibleForRoute,
	updateDraftResourceAfterValues,
} from "../src/utils/aiResponseHelpers.js";
import {
	compactEntityForEstimate,
	compactSessionForEstimate,
	buildAiGenerationRequest,
	createAiHistoryWorkflow,
	estimateTextTokens,
	estimateValueTokens,
	getEstimatedAiMode,
	getGeneratedEntityTypes,
	hasGeneratedCampaignChanges,
	sanitizeAiContextConfig,
} from "../src/features/ai/index.js";
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
import {
	getCampaignGraphNodeSize,
	layoutCampaignGraph,
	resolveCampaignGraphNodeCollision,
} from "../src/utils/campaignGraphLayout.js";
import CampaignViewModel from "../src/models/CampaignViewModel.js";
import SessionViewModel from "../src/models/SessionViewModel.js";
import MonsterStatBlockModel from "../src/models/MonsterStatBlockModel.js";
import SpellCardModel from "../src/models/SpellCardModel.js";
import LocationCardModel from "../src/models/LocationCardModel.js";
import {
	areHistoryStatesEqual,
	campaignHistoryPayload,
	cloneHistoryList,
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
import { campaignApi } from "../src/entities/campaign/index.js";
import { spellApi } from "../src/entities/spell/index.js";

const require = createRequire(import.meta.url);
const storage = require("../server/storage.js");
const spellsRouter = require("../server/routes/spells.js");
const backupsRouter = require("../server/routes/backups.js");
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
			storage.IMAGES_DIR,
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

await run("AI feature model estimates context and rebuilds retry workflows", () => {
	assert.equal(estimateTextTokens(""), 0);
	assert.ok(estimateTextTokens("Український текст") > 0);
	assert.equal(estimateValueTokens(null), 0);
	assert.ok(estimateValueTokens({ prompt: "Create a scene" }) > 0);

	assert.equal(
		compactEntityForEstimate({ name: "Ignored", _aiIgnored: true }),
		null,
	);
	assert.deepEqual(
		compactEntityForEstimate({
			firstName: "Iryna",
			lastName: "Stone",
			notes: [{ title: "Visible", text: "Text" }, { _aiIgnored: true }],
		}),
		{
			name: "Iryna Stone",
			description: "",
			motivation: "",
			trait: "",
			notes: [{ title: "Visible", text: "Text" }],
		},
	);
	assert.equal(
		compactSessionForEstimate({ notes: [{ _aiIgnored: true }] }).notes.length,
		0,
	);

	assert.equal(getEstimatedAiMode({ isBestiary: true }), "custom-monster");
	assert.equal(
		getEstimatedAiMode({ parseAIResponse: false, isEncounter: true }),
		"prompt",
	);
	assert.equal(
		getEstimatedAiMode({ parseAIResponse: true, isEncounter: true }),
		"encounter",
	);

	const workflow = createAiHistoryWorkflow(() => "Retry this request");
	const retryEntry = {
		type: "campaign",
		path: { campaign: "demo" },
		request: {
			options: {
				responseParsing: false,
				characterGeneration: true,
			},
		},
	};
	assert.equal(workflow.canRetryHistoryEntry(retryEntry), true);
	assert.deepEqual(workflow.buildRetryPayloadFromHistoryEntry(retryEntry), {
		type: "campaign",
		modelName: undefined,
		userInstructions: "Retry this request",
		path: { campaign: "demo" },
		sceneId: undefined,
		imageTarget: undefined,
		parseAIResponse: false,
		generateCharacters: true,
		generateNpcs: false,
		generateLocations: false,
		generateEncounters: false,
		generateCustomMonsters: false,
		contextConfig: null,
		language: undefined,
	});
	assert.deepEqual(getGeneratedEntityTypes({ npcs: [] }), ["npc"]);
	assert.equal(
		hasGeneratedCampaignChanges({ operations: [{ scope: "campaign" }] }),
		true,
	);

	const originalContext = {
		sessions: { first: { included: true, data: { scenes: ["heavy"] } } },
	};
	assert.deepEqual(sanitizeAiContextConfig(originalContext), {
		sessions: { first: { included: true } },
	});
	assert.ok(originalContext.sessions.first.data);

	const generationRequest = buildAiGenerationRequest({
		type: "scene",
		parseAIResponse: true,
		initialRoute: { campaign: "demo", session: "one" },
		userInstructions: "Continue",
		generateNpcs: true,
		generateEncounters: true,
		generateCustomMonsters: true,
		useContext: true,
		contextConfig: originalContext,
		currentLanguage: "uk",
	});
	assert.equal(generationRequest.requestType, "scene");
	assert.equal(generationRequest.shouldParseResponse, true);
	assert.equal(generationRequest.payload.generateNpcs, true);
	assert.equal(generationRequest.payload.generateEncounters, true);
	assert.equal(generationRequest.payload.generateCustomMonsters, true);
	assert.equal(generationRequest.payload.contextConfig.sessions.first.data, undefined);

	const imageRequest = buildAiGenerationRequest({
		type: "image",
		isBestiary: true,
		parseAIResponse: true,
	});
	assert.equal(imageRequest.requestType, "image");
	assert.equal(imageRequest.shouldParseResponse, false);
	assert.equal(imageRequest.payload.generateEncounters, false);
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

await run("CharacterCardModel derives fields and maintains notes", async () => {
	let CharacterCardModel;
	try {
		({ default: CharacterCardModel } =
			await import("../src/models/CharacterCardModel.js"));
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

await run("CardNoteModel shared helpers preserve entity note behavior", async () => {
	const { CardNoteModel } = await import("../src/models/cardNoteModelUtils.js");

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

await run("mention picker helper resolves selected and cancelled states", async () => {
	const { requestMentionSelection } = await import("../src/utils/mentionPicker.js");

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
		"src/components/modals/RulesReferenceModalContent.jsx",
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
	assert.match(rulesReferenceSource, /import MonsterStatBlock from "\.\.\/MonsterStatBlock\.jsx"/);
	assert.match(rulesReferenceSource, /import MonsterStatBlockModel from "\.\.\/\.\.\/models\/MonsterStatBlockModel\.js"/);
	assert.match(rulesReferenceSource, /id: "bestiary"/);
	assert.match(rulesReferenceSource, /bestiaryApi\.getBestiaryData\("all"\)/);
	assert.match(rulesReferenceSource, /spellApi\.getSpellData\("all"\)/);
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

await run("rules reference modal owns spells and bestiary navigation", async () => {
	const embeddedPropPattern = new RegExp("is" + "Embedded");
	const mainContentSource = await fs.readFile(
		"src/components/MainContent.jsx",
		"utf8",
	);
	const sidebarSource = await fs.readFile("src/components/Sidebar.jsx", "utf8");
	const bestiarySource = await fs.readFile(
		"src/widgets/bestiary-browser/ui/BestiaryBrowser.jsx",
		"utf8",
	);
	const bestiaryContentSource = await fs.readFile(
		"src/widgets/bestiary-browser/ui/BestiaryContent.jsx",
		"utf8",
	);
	const spellsSource = await fs.readFile("src/components/Spells.jsx", "utf8");
	const rulesReferenceSource = await fs.readFile(
		"src/components/modals/RulesReferenceModalContent.jsx",
		"utf8",
	);
	const rulesReferenceHostSource = await fs.readFile(
		"src/components/modals/RulesReferenceModalHost.jsx",
		"utf8",
	);
	const appActionsSource = await fs.readFile("src/actions/app.js", "utf8");
	const appStoreSource = await fs.readFile("src/store/appStore.js", "utf8");
	const aiAssistantSource = await fs.readFile(
		"src/components/ai/AiAssistantPanel.jsx",
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
	assert.doesNotMatch(rulesReferenceSource, /onActiveMonsterChange/);
	assert.match(rulesReferenceSource, /getCreatureReferenceName/);
	assert.match(rulesReferenceSource, /itemMatchesSelectedName/);
	assert.match(
		rulesReferenceHostSource,
		/handledRequestIdRef\.current = navigationRequest\.requestId;\s*if \(isOpen\) return;/,
	);
	assert.match(appStoreSource, /rulesReference:[\s\S]*history:[\s\S]*entries: \[\]/);
	assert.match(appActionsSource, /forceTab: Boolean\(options\.forceTab\)/);
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
	assert.equal(
		storage.aiResponsesPath("bestiary"),
		path.join(storage.DATA_DIR, "_aiResponses-bestiary.json"),
	);
	assert.equal(
		storage.aiResponsesPath("regular"),
		storage.campaignAiResponsesPath("regular"),
	);
});

await run(
	"storage writes JSON atomically and normalizes custom monsters",
	async () => {
		const atomicPath = path.join(
			storage.CAMPAIGNS_DIR,
			`${TEST_PREFIX}-atomic.json`,
		);
		try {
			await storage.writeJson(atomicPath, { title: "Проба", count: 1 });
			assert.deepEqual(await storage.readJson(atomicPath), {
				title: "Проба",
				count: 1,
			});

			const normalized = storage.normalizeCustomBestiaryMonster({
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
				await storage.ensureDir(
					path.join(storage.campaignDir(slug), "sessions"),
				);
				await storage.writeJson(storage.campaignMetaPath(slug), {
					id: `${slug}-id`,
					name: `Campaign ${slug}`,
					slug,
				});
			}

			await storage.writeJson(storage.sessionPath(targetSlug, "renamed.json"), {
				id: "session-1",
				name: "Old session",
				data: {
					npcs: [{ id: "npc-1", firstName: "Old", slug: "mira" }],
					locations: [{ id: "loc-1", name: "Old place", slug: "mill" }],
				},
			});
			await storage.writeEntity(targetSlug, "npc", "mira", {
				id: "npc-1",
				firstName: "Old",
				slug: "mira",
			});
			await storage.writeEntity(targetSlug, "locations", "mill", {
				id: "loc-1",
				name: "Old place",
				slug: "mill",
			});

			await storage.importCampaignPartialArchiveBundle(targetSlug, {
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

			const sessions = await storage.listSessions(targetSlug);
			assert.equal(sessions.length, 1);
			assert.equal(sessions[0].fileName, "renamed.json");
			assert.equal(sessions[0].name, "Imported session");
			assert.equal(
				await storage.exists(storage.sessionPath(targetSlug, "session.json")),
				false,
			);

			const session = await storage.readSession(targetSlug, "renamed.json");
			assert.equal(session.data.npcs.length, 1);
			assert.equal(session.data.npcs[0].firstName, "Imported");
			assert.equal(session.data.locations.length, 1);
			assert.equal(session.data.locations[0].name, "Imported place");

			const npcs = await storage.listEntities(targetSlug, "npc");
			assert.equal(npcs.length, 1);
			assert.equal(npcs[0].slug, "mira");
			assert.equal(npcs[0].firstName, "Imported");
			assert.equal(
				await storage.exists(
					path.join(storage.campaignDir(targetSlug), "npc", "mira-2"),
				),
				false,
			);

			const locations = await storage.listEntities(targetSlug, "locations");
			assert.equal(locations.length, 1);
			assert.equal(locations[0].slug, "mill");
			assert.equal(locations[0].name, "Imported place");
			assert.equal(
				await storage.exists(
					path.join(storage.campaignDir(targetSlug), "locations", "mill-2"),
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
				await storage.exists(
					path.join(storage.campaignDir(slug), "characters", "hero"),
				),
				false,
			);
			assert.equal(
				await storage.exists(
					path.join(storage.campaignDir(slug), "npc", "hero"),
				),
				true,
			);

			const npcs = await storage.listEntities(slug, "npc");
			assert.equal(npcs.length, 1);
			assert.equal(npcs[0].notes[0].text, "T");
		});
	},
);

await run(
	"storage updates bracketed entity mentions after rename",
	async () => {
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

			await storage.updateCampaignMentionReferences(
				slug,
				"Old Name",
				"New Name",
			);

			const meta = await storage.readCampaign(slug);
			const characters = await storage.listEntities(slug, "characters");
			const locations = await storage.listEntities(slug, "locations");
			const session = await storage.readSession(slug, "session.json");

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
		await storage.ensureDir(path.join(storage.campaignDir(slug), "sessions"));
		await storage.writeJson(storage.campaignMetaPath(slug), {
			id: "campaign-id",
			name: "Patch Campaign",
			description: "",
			notes: [],
		});
		await storage.writeJson(storage.sessionPath(slug, "session.json"), {
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
		const session = await storage.readSession(slug, "session.json");
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
		await storage.ensureDir(path.join(storage.campaignDir(slug), "sessions"));
		await storage.writeJson(storage.campaignMetaPath(slug), {
			id: "campaign-id",
			name: "Encounter Campaign",
			description: "",
			notes: [],
		});
		await storage.writeJson(storage.sessionPath(slug, "session.json"), {
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

		const session = await storage.readSession(slug, "session.json");
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
		await storage.ensureDir(path.join(storage.campaignDir(slug), "sessions"));
		await storage.writeJson(storage.campaignMetaPath(slug), {
			id: "campaign-id",
			name: "Encounter Campaign",
			description: "",
			notes: [],
		});
		await storage.writeJson(storage.sessionPath(slug, "session.json"), {
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

		const session = await storage.readSession(slug, "session.json");
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
			await storage.ensureDir(path.join(storage.campaignDir(slug), "sessions"));
			await storage.writeJson(storage.campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Encounter Campaign",
				description: "",
				notes: [],
			});
			await storage.writeJson(storage.sessionPath(slug, "session.json"), {
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

			const session = await storage.readSession(slug, "session.json");
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
			await storage.ensureDir(path.join(storage.campaignDir(slug), "sessions"));
			await storage.writeJson(storage.campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Dedupe Campaign",
				description: "",
				notes: [],
			});
			await storage.writeEntity(slug, "npc", "mira", {
				id: "campaign-npc-1",
				slug: "mira",
				firstName: "Mira",
				lastName: "",
				trait: "Campaign original.",
				notes: [],
			});
			await storage.writeEntity(slug, "locations", "old-mill", {
				id: "campaign-location-1",
				slug: "old-mill",
				name: "Old Mill",
				description: "Campaign location.",
				notes: [],
			});
			await storage.writeJson(storage.sessionPath(slug, "session.json"), {
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

			const session = await storage.readSession(slug, "session.json");
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
			assert.equal((await storage.listEntities(slug, "npc")).length, 0);
			assert.equal((await storage.listEntities(slug, "locations")).length, 0);
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
			await storage.ensureDir(path.join(storage.campaignDir(slug), "sessions"));
			await storage.writeJson(storage.campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Mixed Scope Campaign",
				description: "",
				notes: [],
			});
			await storage.writeJson(storage.sessionPath(slug, "session.json"), {
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

			const campaignNpcs = await storage.listEntities(slug, "npc");
			const session = await storage.readSession(slug, "session.json");
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
			await storage.ensureDir(path.join(storage.campaignDir(slug), "sessions"));
			await storage.writeJson(storage.campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Session Campaign Change",
				description: "Old premise.",
				notes: [],
			});
			await storage.writeJson(storage.sessionPath(slug, "session.json"), {
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

			const campaign = await storage.readCampaign(slug);
			const session = await storage.readSession(slug, "session.json");
			assert.equal(campaign.description, "New premise from session planning.");
			assert.equal(session.data.scenes.length, 1);
		});
	},
);

await run(
	"AI patch service keeps new campaign versions when creates duplicate session entities",
	async () => {
		await withTestSlug("ai-dedupe-campaign-entities", async (slug) => {
			await storage.ensureDir(path.join(storage.campaignDir(slug), "sessions"));
			await storage.writeJson(storage.campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Dedupe To Campaign",
				description: "",
				notes: [],
			});
			await storage.writeJson(storage.sessionPath(slug, "session.json"), {
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

			const session = await storage.readSession(slug, "session.json");
			const campaignNpcs = await storage.listEntities(slug, "npc");
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
			await storage.ensureDir(path.join(storage.campaignDir(slug), "sessions"));
			await storage.writeJson(storage.campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Move Created Campaign",
				description: "",
				notes: [],
			});
			await storage.writeJson(storage.sessionPath(slug, "session.json"), {
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

			const session = await storage.readSession(slug, "session.json");
			const campaignNpcs = await storage.listEntities(slug, "npc");
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
		await storage.writeJson(storage.campaignMetaPath(slug), {
			name: "AI Empty Scene",
			description: "",
			notes: [],
		});
		await storage.writeJson(storage.sessionPath(slug, "session.json"), {
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

		const session = await storage.readSession(slug, "session.json");
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

await run("storage keeps AI response history per campaign", async () => {
	await withTestSlug("ai-history-a", async (firstSlug) => {
		await withTestSlug("ai-history-b", async (secondSlug) => {
			const firstEntry = await storage.addAiResponse({
				text: "Відповідь для першої кампанії",
				path: { campaign: firstSlug, session: null, encounter: null },
			});
			const secondEntry = await storage.addAiResponse({
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

			const updatedFirst = await storage.updateAiResponse(
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
			const afterUpdate = await storage.readAiResponses(firstSlug);
			assert.equal(afterUpdate[0].changes.resources.length, 1);
			assert.equal(afterUpdate[0].changes.summary.modified, 1);
			assert.equal(
				await storage.updateAiResponse(firstSlug, "missing-response-id", {
					applyState: "undone",
				}),
				null,
			);
			assert.equal((await storage.readAiResponses(firstSlug)).length, 1);

			await storage.deleteAiResponse(secondSlug, secondEntry.id);
			assert.equal((await storage.readAiResponses(secondSlug)).length, 0);

			await storage.clearAiResponses(firstSlug);
			assert.equal((await storage.readAiResponses(firstSlug)).length, 0);
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
	"entity service resolves campaign entities by display names",
	async () => {
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
		const campaignViewSource = await fs.readFile(
			"src/components/CampaignView.jsx",
			"utf8",
		);
		const sessionViewSource = await fs.readFile(
			"src/components/SessionView.jsx",
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
			"src/utils/mentionEditor.js",
			"utf8",
		);
		const characterCardSource = await fs.readFile(
			"src/components/CharacterCard.jsx",
			"utf8",
		);
		const locationCardSource = await fs.readFile(
			"src/components/LocationCard.jsx",
			"utf8",
		);
		const graphSource = await fs.readFile(
			"src/components/campaign/CampaignNotesGraph.jsx",
			"utf8",
		);
		const campaignHookSource = await fs.readFile(
			"src/hooks/useCampaignView.js",
			"utf8",
		);
		const sessionHookSource = await fs.readFile(
			"src/hooks/useSessionView.js",
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
		const originalSearchSpells = spellApi.searchSpells;
		const originalGetConditions = spellApi.getConditions;
		const originalGetDiseases = spellApi.getDiseases;
		const originalGetVariantRules = spellApi.getVariantRules;
		const originalGetSkills = spellApi.getSkills;
		const originalGetSenses = spellApi.getSenses;
		let spellCalls = 0;
		let conditionCalls = 0;
		let diseaseCalls = 0;
		let variantRuleCalls = 0;
		let skillCalls = 0;
		let senseCalls = 0;

		spellApi.searchSpells = async (params = {}) => {
			spellCalls += 1;
			if (String(params.name || "").includes("magic missile")) {
				return [
					{ name: "Magic Missile|PHB", source: "PHB" },
					{ name: "Magic Missile|XPHB", source: "XPHB" },
				];
			}
			return [{ name: "Shield|PHB", source: "PHB" }];
		};

		spellApi.getConditions = async () => {
			conditionCalls += 1;
			if (conditionCalls === 1) {
				throw new Error("temporary");
			}
			return [
				{ name: "Prone", entries: ["..."] },
				{ name: "Blinded", entries: ["..."] },
			];
		};

		spellApi.getDiseases = async () => {
			diseaseCalls += 1;
			return [
				{ name: "Bluerot", entries: ["..."] },
				{ name: "Sight Rot", entries: ["..."] },
			];
		};

		spellApi.getVariantRules = async () => {
			variantRuleCalls += 1;
			return [
				{ name: "Advantage", entries: ["..."] },
				{ name: "Cone [Area of Effect]", entries: ["..."] },
			];
		};

		spellApi.getSkills = async () => {
			skillCalls += 1;
			return [
				{ name: "Medicine", ability: "wis", entries: ["..."] },
				{ name: "Perception", ability: "wis", entries: ["..."] },
			];
		};

		spellApi.getSenses = async () => {
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
			spellApi.searchSpells = originalSearchSpells;
			spellApi.getConditions = originalGetConditions;
			spellApi.getDiseases = originalGetDiseases;
			spellApi.getVariantRules = originalGetVariantRules;
			spellApi.getSkills = originalGetSkills;
			spellApi.getSenses = originalGetSenses;
		}
	},
);

await run("backups archive route sends gzip payload with dated filename", async () => {
	const originalListCampaignSlugs = storage.listCampaignSlugs;
	const originalExportCampaignArchiveBundle =
		storage.exportCampaignArchiveBundle;
	const layer = backupsRouter.stack.find(
		(item) => item.route?.path === "/export-all/archive",
	);
	assert.ok(layer);
	const handler = layer.route.stack[0].handle;

	storage.listCampaignSlugs = async () => ["alpha"];
	storage.exportCampaignArchiveBundle = async (slug) => ({
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
		storage.listCampaignSlugs = originalListCampaignSlugs;
		storage.exportCampaignArchiveBundle = originalExportCampaignArchiveBundle;
	}
});

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
	const layer = spellsRouter.stack.find(
		(item) => item.route?.path === "/diseases",
	);
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
	const layer = spellsRouter.stack.find(
		(item) => item.route?.path === "/skills",
	);
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
	const layer = spellsRouter.stack.find(
		(item) => item.route?.path === "/senses",
	);
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
		const emptyDir = storage.campaignImagesDir(slug, category, "empty");
		await storage.ensureDir(rootDir);
		await storage.ensureDir(nestedDir);
		await storage.ensureDir(emptyDir);
		await fs.writeFile(path.join(rootDir, "a.png"), "a", "utf8");
		await fs.writeFile(path.join(rootDir, "b.txt"), "b", "utf8");
		await fs.writeFile(path.join(nestedDir, "c.webp"), "c", "utf8");
		await fs.writeFile(path.join(emptyDir, "notes.txt"), "notes", "utf8");

		const rootImages = await storage.listImages(slug, category);
		assert.deepEqual(
			rootImages.map((item) => item.name),
			["a.png"],
		);
		assert.match(rootImages[0].url, /\/api\/images\//);
		assert.equal(rootImages[0].path, path.join(category, "", "a.png"));

		const subcategories = await storage.listSubcategories(slug, category);
		assert.deepEqual(subcategories, ["empty", "nested"]);
		const subcategoryMeta = await storage.listSubcategories(
			slug,
			category,
			"",
			{ includeMeta: true },
		);
		assert.deepEqual(subcategoryMeta, [
			{ name: "empty", hasFiles: false },
			{ name: "nested", hasFiles: true },
		]);
		const nestedImages = await storage.listImages(slug, category, "nested");
		assert.deepEqual(
			nestedImages.map((item) => item.name),
			["c.webp"],
		);
	});
});

await run("storage lists readonly official bestiary token assets", async () => {
	const rootAssets = await storage.listBestiaryTokenAssets();
	assert.ok(rootAssets.subcategories.includes("AATM"));
	assert.deepEqual(rootAssets.images, []);

	const sourceAssets = await storage.listBestiaryTokenAssets({
		subcategory: "AATM",
	});
	assert.ok(
		sourceAssets.images.some((item) => item.name === "Animated Coffin.webp"),
	);
	assert.equal(sourceAssets.images[0].readonly, true);
	assert.match(sourceAssets.images[0].url, /^\/api\/bestiary\/tokens\/AATM\//);

	const searchAssets = await storage.listBestiaryTokenAssets({
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
			const firstDir = storage.campaignImagesDir(
				firstSlug,
				"maps",
				"city/deep",
			);
			const secondDir = storage.campaignImagesDir(secondSlug, "props");
			await storage.ensureDir(firstDir);
			await storage.ensureDir(secondDir);
			await fs.writeFile(path.join(firstDir, "hidden-map.png"), "a", "utf8");
			await fs.writeFile(path.join(secondDir, "hidden-prop.webp"), "b", "utf8");

			const local = await storage.searchImageGalleryAssets({
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

			const global = await storage.searchImageGalleryAssets({
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

			const official = await storage.searchImageGalleryAssets({
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
			const imagesDir = storage.campaignImagesDir(
				oldSlug,
				category,
				subcategory,
			);
			await storage.ensureDir(imagesDir);
			await fs.writeFile(path.join(imagesDir, "hero.png"), "x", "utf8");

			const oldUrl = `/api/images/${encodeURIComponent(oldSlug)}/${encodeURIComponent(category)}/${subcategory}/hero.png`;
			const newUrl = `/api/images/${encodeURIComponent(newSlug)}/${encodeURIComponent(category)}/${subcategory}/hero.png`;

			await storage.ensureDir(path.join(storage.campaignDir(oldSlug), "sessions"));
			await storage.writeJson(storage.campaignMetaPath(oldSlug), {
				id: `${oldSlug}-id`,
				name: "Old Campaign",
				slug: oldSlug,
				imageUrl: oldUrl,
			});
			await storage.writeEntity(oldSlug, "characters", "hero", {
				id: "hero-1",
				firstName: "Hero",
				imageUrl: oldUrl,
			});
			await storage.writeJson(storage.sessionPath(oldSlug, "session.json"), {
				id: "session-1",
				name: "Session",
				data: { notes: [{ id: 1, text: oldUrl }] },
			});
			await storage.addAiResponse({
				id: "response-1",
				path: { campaign: oldSlug },
				createdAt: new Date().toISOString(),
				text: oldUrl,
			});

			await storage.renameCampaignData(oldSlug, newSlug);

			assert.equal(await storage.exists(storage.campaignDir(oldSlug)), false);
			assert.equal(await storage.exists(storage.campaignDir(newSlug)), true);
			assert.equal(await storage.exists(path.join(storage.IMAGES_DIR, oldSlug)), false);
			assert.equal(await storage.exists(path.join(storage.IMAGES_DIR, newSlug)), true);

			const meta = await storage.readCampaign(newSlug);
			assert.equal(meta.imageUrl, newUrl);
			const characters = await storage.listEntities(newSlug, "characters");
			assert.equal(characters[0].imageUrl, newUrl);
			const session = await storage.readSession(newSlug, "session.json");
			assert.equal(JSON.stringify(session).includes(newUrl), true);
			assert.equal(JSON.stringify(session).includes(oldUrl), false);
			const history = await storage.readAiResponses(newSlug);
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
