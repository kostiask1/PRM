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

import { idsEqual } from "../src/shared/lib/index.js";
import { isJsonObject, isJsonString } from "../src/shared/lib/index.js";
import {
	matchesMonsterSearch,
	getMonsterTypeString,
} from "../src/entities/bestiary/index.js";
import { classNames } from "../src/shared/lib/index.js";
import {
	applyTheme,
	getNextTheme,
	getThemeToggleIcon,
	THEMES,
} from "../src/features/settings/index.js";
import {
	DEFAULT_IMAGE_PROMPT_BASE_PROMPT,
	GLOBAL_SETTINGS_SCOPE,
	buildCampaignIgnoreSourcesMap,
	buildPromptSettingsPayload,
	mergeContentSourceOptions,
	normalizeSavedIgnoreSources,
	normalizeSavedPromptSettings,
	normalizeSettingsCampaigns,
	resolveSettingsScope,
	setSettingsPromptForScope,
} from "../src/features/settings/model/settingsModal.ts";
import {
	getDiceProbabilityDistribution,
	rollDiceFormula,
} from "../src/shared/lib/index.js";
import {
	extractContentTokens,
	preprocessTags,
} from "../src/entities/reference/model.js";
import {
	addFallbackTaggedSource,
	getContentTokenRenderPlan,
	parseQuickrefName,
	stripNotesReferenceText,
} from "../src/features/rich-content/model.js";
import {
	filterBestiaryMonsters,
	getAiMonsterInstructionPlan,
	getBestiarySelectionPlan,
	getBestiarySourceCodes,
	getCreateBasedMonsterPlan,
	getCustomBestiaryUpdatePlan,
	getCustomRefreshSelection,
	getMonsterListFromResponse,
	getNextBestiarySortOrder,
	isSameMonsterIdentity,
	mergeImportedCustomMonsters,
	monsterMatchesReference,
	parseImportedCustomMonsters,
	parseBestiarySyncEvent,
	parseMonsterReference,
	preserveAiDraftResourceMetadata,
	sortBestiaryMonsters,
} from "../src/widgets/bestiary-browser/model.js";
import {
	getChangedFieldClass,
	getMonsterMutationKey,
	getMonsterSpellSlug,
	getMonsterSpellcastingEntries,
	getMonsterTokenSources,
	getSenseTextParts,
	getTokenDragPayload,
	getUploadedTokenUrl,
	groupMonsterSpellsByLevel,
	loadMonsterSpells,
	shouldShowMonsterTokenDropzone,
} from "../src/widgets/monster-stat-block/model.js";
import {
	filterSpells,
	findSpellByReference,
	getInitialSpellSelection,
	getNextSpellSortOrder,
	getSettingsIgnoreSources,
	getSpellClassOptions,
	getSpellItemKey,
	getSpellListIndex,
	getSpellSchoolOptions,
	getValidSourceFilter,
	normalizeSpellList,
	parseSpellReferenceKey,
	sortSpells,
	spellMatchesReferenceKey,
} from "../src/widgets/spells-browser/model.js";
import {
	REFERENCE_TAB_POLICIES,
	combineBestiaryLists,
	createReferenceSelection,
	findSelectedReferenceItem,
	getInitialTabId,
	getReferenceInlineTag,
	itemMatchesQuery,
} from "../src/widgets/rules-reference-modal/model.js";
import {
	addUndoSnapshot,
	createDistinctRedoTransition,
	createDistinctUndoTransition,
	createRedoTransition,
	createUndoTransition,
	isHistoryShortcutEvent,
	shouldUseAppHistoryForEvent,
} from "../src/shared/lib/index.js";
import {
	normalizeConditionName,
	loadConditionsMap,
} from "../src/entities/reference/model.js";
import {
	createEmptyNote as createModelEmptyNote,
	getNoteRenderKey,
	getNotesForRender,
	isNoteEmpty,
	isVirtualNoteId,
	sanitizeNotesForSave,
	upsertNoteById,
} from "../src/shared/lib/index.js";
import {
	MENTION_BOUNDARY,
	createMentionBoundaryNode,
	handleSpaceAfterMention,
} from "../src/features/editor/model.js";
import {
	applyInputBlockEdit,
	filterMentionEntities,
	getEditableShortcutAction,
	getInputShortcutAction,
	groupMentionEntities,
	insertInputTab,
	isRangeInsideSquareBrackets,
	normalizeEditableMarkdown,
	resolveInitialCursorPosition,
	toggleInputFormat,
	toggleInputMention,
} from "../src/features/editor/ui/editorPresentation.ts";
import {
	buildNavigationUrl,
	parseUrl,
	shouldOpenInNewTabFromEvent,
} from "../src/shared/lib/index.js";
import { downloadBlob, downloadJsonFile } from "../src/shared/lib/index.js";
import {
	createEncounterMonsterInstance,
	ensureEncounterMonsterId,
	getMonsterBaseHp,
	hasMonsterHpFormula,
} from "../src/entities/encounter/index.js";
import {
	calculateInitiativeStats,
	parseChallengeRating,
} from "../src/pages/encounter/model/encounterViewMetrics.ts";
import {
	getSessionEntityDisplayName,
	normalizeSessionEntity,
} from "../src/pages/session/model/sessionEntityModel.ts";
import {
	addSourceMonsterImageToDraft,
	buildDiffResources,
	getDiffResourceState,
	getFirstChangedMonster,
	getFirstChangedMonsterName,
	isAiResponseVisibleForRoute,
	updateDraftResourceAfterValues,
} from "../src/features/ai/index.js";
import {
	compactEntityForEstimate,
	compactSessionForEstimate,
	AI_GENERATION_STATUS,
	aiGenerationLifecycleReducer,
	buildAiGenerationRequest,
	buildAiHistoryRestorePlan,
	buildAiTokenEstimate,
	buildCustomMonsterImageTarget,
	buildNpcImageTarget,
	buildSceneImageTarget,
	createAiHistoryWorkflow,
	createAiHistoryCommandService,
	createInitialAiContextConfig,
	ensureContextListItems,
	estimateTextTokens,
	estimateValueTokens,
	getEstimatedAiMode,
	getGeneratedEntityTypes,
	getAttachedFileKey,
	getAttachedImageKey,
	getSupportedAiFileMimeType,
	getSupportedAiImageMimeType,
	getAiHistoryCampaign,
	getAiHistoryRestoreMode,
	getContextListConfig,
	hasGeneratedCampaignChanges,
	initialAiGenerationLifecycle,
	isAiGenerationPending,
	mergeLoadedAiSessionData,
	normalizeCustomMonsterCollection,
	sanitizeAiContextConfig,
	setAllContextListItems,
	upsertAiHistoryEntry,
	updateContextConfigValue,
	updateContextListIncluded,
	updateContextListItem,
} from "../src/features/ai/index.js";
import {
	getAiSceneContextConfig,
	getAiSessionContextConfig,
	getAiEncounterGenerationTogglePlan,
	getAvailableAiAttachmentSlots,
	getAiPromptTokenVisibility,
	getAiToolbarVisibility,
	hasAiResponseHistory,
	isAiApiKeySaveDisabled,
	mergeUniqueAiAttachments,
	prepareAiAttachmentSelection,
	removeAiAttachmentAt,
	shouldSubmitAiApiKey,
	shouldReportAiAttachmentSelectionError,
} from "../src/features/ai/ui/presentationModel.ts";
import {
	getSpellByName,
	getConditionByName,
	getDiseaseByName,
	getSenseByName,
	getSkillByName,
	getVariantRuleByName,
} from "../src/entities/reference/model.js";
import {
	resolveSpellInput,
	resolveConditionInput,
	resolveDiseaseInput,
	resolveSenseInput,
	resolveSkillInput,
	resolveVariantRuleInput,
} from "../src/entities/reference/model.js";
import {
	buildCampaignGraph,
	extractBracketMentions,
	normalizeGraphName,
} from "../src/pages/campaign/graph.js";
import {
	getCampaignGraphNodeSize,
	layoutCampaignGraph,
	resolveCampaignGraphNodeCollision,
} from "../src/pages/campaign/graph.js";
import { CampaignViewModel } from "../src/entities/campaign/index.js";
import { SessionViewModel } from "../src/entities/session/index.js";
import { MonsterStatBlockModel } from "../src/entities/bestiary/index.js";
import { SpellCardModel } from "../src/entities/spell/index.js";
import { LocationCardModel } from "../src/entities/campaign/index.js";
import {
	createCharacterDraft,
	createLocationDraft,
	getCampaignEntityFieldClass,
	getCampaignNoteHighlightFields,
	getCharacterCardPresentation,
	getCharacterDisplayName,
	getLocationCardPresentation,
	getLocationDisplayName,
	isCharacterDraftValid,
	isLocationDraftValid,
	setCampaignNoteAiIgnored,
} from "../src/widgets/campaign-entity-card/model.js";
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
	getImageAssetPreset,
	parseGalleryLocationFromImageUrl,
	resolveImageAssetLocation,
} from "../src/features/images/model/imageAssetField.ts";
import {
	getImageUploadFileName,
	getImageUploadSourceOptions,
	normalizeImageCampaigns,
	resolveImageUploadSource,
	splitImageFileName,
} from "../src/features/images/model/imageUpload.ts";
import {
	enterImageTargetSubfolder,
	getImageTargetParentPath,
	navigateImageTargetPath,
	normalizeImageTargetPath,
	normalizeSubcategoryNames,
} from "../src/features/images/model/imageTargetSettings.ts";
import {
	buildGalleryPresentationItems,
	deduplicateGalleryImages,
	getGalleryHistoryKeyDirection,
	getGalleryNavigationEntry,
	getGalleryPathEntry,
	recordGalleryNavigation,
} from "../src/features/images/model/imageGalleryPresentation.ts";
import {
	buildGalleryMovePayloads,
	getGalleryDragPlan,
	getGalleryDropPlan,
	getGallerySelectionPlan,
} from "../src/features/images/model/imageGalleryInteraction.ts";
import {
	loadGalleryImages,
	loadGallerySubcategoryData,
} from "../src/features/images/model/imageGalleryLoading.ts";
import {
	findEntityByName,
	getEntityDisplayName,
	resolveEntityByName,
} from "../src/entities/campaign/index.js";
import { campaignApi } from "../src/entities/campaign/index.js";
import { spellApi } from "../src/entities/spell/index.js";
import {
	buildCreateEntityPayload,
	createCampaignEntityClient,
	removeEntityById,
	replaceEntityById,
	withEntityOrder,
} from "../src/features/campaign-entity/index.js";
import {
	addScene as addSessionScene,
	createEmptyScene,
	removeScene as removeSessionScene,
	sceneRequiresDeleteConfirmation,
	toggleSceneNoteCollapse,
	updateSceneField,
	updateSceneNote,
} from "../src/features/session-editor/index.js";
import {
	buildEntityImageMap,
	synchronizeCustomMonsterParticipants,
} from "../src/features/encounter-editor/index.js";
import {
	buildEncounterTargetCampaignGroup,
	createEncounterTargetId,
	normalizeActiveEncounterCampaigns,
	normalizeEncounterSessionSummaries,
} from "../src/features/encounter-editor/model/addMonsterTargets.ts";
import {
	calculateTooltipPosition,
	cancelOtherTooltipTimeouts,
	closeAllTooltips,
	getActiveTooltipId,
	isAncestorTooltip,
	removeTooltipParent,
	removeTooltipTimeoutController,
	setActiveTooltip,
	setTooltipParent,
	setTooltipTimeoutController,
	subscribeActiveTooltip,
} from "../src/shared/ui/tooltipModel.ts";
import {
	BUTTON_SIZES,
	getButtonAppearance,
	normalizeButtonSize,
} from "../src/shared/ui/buttonModel.ts";
import { getListCardClickPlan } from "../src/shared/ui/listCardModel.ts";
import { splitSearchHighlight } from "../src/shared/ui/searchHighlightModel.ts";
import {
	calculateSelectDropdownStyle,
	createSelectChangeEvent,
	getSelectedOption,
	getSelectScrollTop,
} from "../src/shared/ui/selectModel.ts";
import {
	calculateMultiSelectDropdownStyle,
	getMultiSelectActiveScrollTarget,
	getMultiSelectOptionAction,
	getMultiSelectSelectionState,
	selectOnlyMultiSelectValue,
	toggleMultiSelectValue,
} from "../src/shared/ui/multiSelectModel.ts";
import {
	getDefaultDraggableItemKey,
	getDraggableReorderResult,
	hasReachedDragStartThreshold,
	haveSameDraggableItemOrder,
	reorderDraggableItems,
} from "../src/shared/ui/draggableListModel.ts";
import {
	getBulkCollapseAction,
	getNoteCardPresentation,
	isRealNote,
} from "../src/features/notes/model.ts";
import {
	createModalApi,
	formatModalStatusMessage,
	getModalCloseAction,
	getModalFocusTarget,
	getModalKeyboardPlan,
	resolveModalConfirmValue,
} from "../src/features/modal/model.ts";
import {
	getDiceResultId,
	getQuestionDiceRoll,
	getQuestionRollFormula,
	getQuestionSearchTarget,
	getStandardDiceFactors,
	normalizeQuestionSearch,
} from "../src/features/player-questions/model.ts";
import {
	addDieToFormula,
	createHistoryRollPayload,
	createRollDicePayload,
	formatDiceProbability,
	getCurrentDiceFormula,
	getDiceBreakdownLabel,
	getDiceProbabilityBarWidth,
	getFullDiceBreakdownString,
	getRechargeResultClass,
	getRechargeThreshold,
	isDicePanelShortcut,
	isPlayerQuestionsRollContext,
	isSingleDieRoll,
	normalizeDiceFormula,
	prependDiceHistory,
	readPendingDiceRoll,
} from "../src/features/dice/model.ts";
import { getMonsterAiEditPresentation } from "../src/features/ai-edit-monster/model.ts";
import {
	actionEntriesToText,
	actionFromText,
	addMonsterAction,
	applyRuleReferenceTag,
	calculateDiceAverage,
	isRulesReferenceShortcut,
	parseMonsterJson,
	parseSpeedText,
	prepareMonsterDraftForSave,
	removeMonsterAction,
	speedToText,
	updateCreatureBasicField,
} from "../src/features/edit-monster/model.ts";
import {
	buildTooltipTextParts,
	formatRulesTooltipText,
	loadRulesLinkPreview,
	resolveRulesLinkNavigation,
} from "../src/features/rules-reference/model/rulesLink.ts";

const require = createRequire(import.meta.url);
const storage = require("../server/storage.js");
const spellsRouter = require("../server/routes/spells.js");
const backupsRouter = require("../server/routes/backups.js");
const aiRouter = require("../server/routes/ai.js");
const bestiaryRouter = require("../server/routes/bestiary.js");
const aiService = require("../server/aiService.js");
const {
	buildPromptContext,
} = require("../server/modules/ai/application/buildPromptContext.js");
const {
	buildUserPrompt,
} = require("../server/modules/ai/application/buildUserPrompt.js");
const {
	buildSystemInstruction,
} = require("../server/modules/ai/application/buildSystemInstruction.js");
const {
	createGeminiGateway,
} = require("../server/modules/ai/infrastructure/geminiGateway.js");
const {
	buildFileParts,
} = require("../server/modules/ai/infrastructure/attachmentParts.js");
const {
	parseAiResponseText,
} = require("../server/modules/ai/application/parseAiResponse.js");
const {
	resolveAiRequest,
	selectAiModel,
} = require("../server/modules/ai/application/resolveAiRequest.js");
const {
	prepareGenerateAiRequest,
} = require("../server/modules/ai/application/prepareGenerateAiRequest.js");
const {
	createGenerateBestiaryImagePrompt,
} = require("../server/modules/ai/application/generateBestiaryImagePrompt.js");
const {
	createGenerateCustomMonster,
} = require("../server/modules/ai/application/generateCustomMonster.js");
const {
	createGenerateCampaignContent,
} = require("../server/modules/ai/application/generateCampaignContent.js");
const {
	createAppendConfiguredCampaignContext,
} = require("../server/modules/ai/application/campaignContext.js");
const {
	createAiHistoryRepositoryPort,
} = require("../server/modules/ai/application/ports/aiHistoryRepository.js");
const {
	createFileAiHistoryRepository,
} = require("../server/modules/ai/infrastructure/fileAiHistoryRepository.js");
const {
	createAiHistoryCommands,
} = require("../server/modules/ai/application/aiHistoryCommands.js");
const {
	createGenerateAiRequest,
} = require("../server/modules/ai/application/generateAiRequest.js");
const {
	createSaveGeminiApiKey,
} = require("../server/modules/ai/application/saveGeminiApiKey.js");
const {
	createEnvApiKeyStore,
	updateEnvValue,
} = require("../server/modules/ai/infrastructure/envApiKeyStore.js");
const {
	createCampaignEntityCommands,
} = require("../server/modules/campaign/application/campaignEntityCommands.js");
const {
	createCampaignCommands,
} = require("../server/modules/campaign/application/campaignCommands.js");
const {
	createBestiaryCommands,
} = require("../server/modules/bestiary/application/bestiaryCommands.js");
const {
	createSettingsCommands,
} = require("../server/modules/settings/application/settingsCommands.js");
const {
	createImageCommands,
	parseGalleryQuery,
} = require("../server/modules/images/application/imageCommands.js");
const {
	createReferenceCommands,
} = require("../server/modules/reference/application/referenceCommands.js");
const {
	createBackupCommands,
	parseArchivePayload,
} = require("../server/modules/backups/application/backupCommands.js");
const {
	createCampaignEntityScopeCommands,
} = require("../server/modules/campaign/application/campaignEntityScopeCommands.js");
const {
	createSceneEncounterCommand,
} = require("../server/modules/session/application/createSceneEncounter.js");
const {
	createUpdateEncounterCommand,
} = require("../server/modules/session/application/updateEncounter.js");
const {
	createAddEncounterMonsterCommand,
} = require("../server/modules/session/application/addEncounterMonster.js");
const {
	createSessionCommands,
} = require("../server/modules/session/application/sessionCommands.js");
const {
	createFileCampaignEntityRepository,
} = require("../server/modules/campaign/infrastructure/fileCampaignEntityRepository.js");
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

await run("editor presentation preserves mention grouping and cursor mapping", () => {
	const entities = [
		{ id: 1, type: "characters", firstName: "Ірина", lastName: "Коваль" },
		{ id: 2, type: "npc", name: "Вартовий" },
		{ id: 3, type: "locations", name: "Срібна гавань" },
	];
	assert.deepEqual(filterMentionEntities(entities, "коваль"), [entities[0]]);
	assert.deepEqual(
		groupMentionEntities(entities).map((group) => [group.key, group.items.length]),
		[
			["characters", 1],
			["npc", 1],
			["locations", 1],
		],
	);
	assert.equal(resolveInitialCursorPosition(99, "abc"), 3);
	assert.equal(
		resolveInitialCursorPosition(
			{ previewOffset: 1, previewToRaw: [0, 4, 8] },
			"abcdefghij",
		),
		4,
	);
	assert.equal(isRangeInsideSquareBrackets("before [link] after", 9, 11), true);
	assert.equal(normalizeEditableMarkdown("  one  \r\n two  ", "textarea"), "  one\n two");
});

await run("editor input policies preserve markdown shortcuts", () => {
	assert.deepEqual(
		getInputShortcutAction({
			ctrlKey: true,
			metaKey: false,
			key: "л",
			type: "textarea",
		}),
		{ kind: "mention" },
	);
	assert.deepEqual(insertInputTab("ab", 1, 1), {
		value: "a\tb",
		selectionStart: 2,
		selectionEnd: 2,
	});
	assert.deepEqual(toggleInputMention("name", 0, 4), {
		value: "[name]",
		selectionStart: 1,
		selectionEnd: 5,
	});
	assert.deepEqual(toggleInputFormat("word", 0, 4, "**"), {
		value: "**word**",
		selectionStart: 2,
		selectionEnd: 6,
	});
	assert.deepEqual(applyInputBlockEdit("one\ntwo", 0, 7, { kind: "quote" }), {
		value: "> one\n> two",
		selectionStart: 2,
		selectionEnd: 11,
	});
	assert.equal(
		getEditableShortcutAction({
			code: "BracketRight",
			ctrlKey: true,
			enableHistory: true,
			isDisabled: false,
			key: "]",
			metaKey: false,
			type: "textarea",
		}),
		"list",
	);
	assert.equal(
		getEditableShortcutAction({
			code: "KeyZ",
			ctrlKey: true,
			enableHistory: false,
			isDisabled: false,
			key: "z",
			metaKey: false,
			type: "textarea",
		}),
		"delegate",
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

await run("tooltip model coordinates nesting, timers, and viewport layout", () => {
	const below = calculateTooltipPosition(
		{ left: 100, top: 20, right: 140, bottom: 40, width: 40, height: 20 },
		{ left: 0, top: 0, right: 100, bottom: 30, width: 100, height: 30 },
		300,
		200,
	);
	assert.deepEqual(below, { top: 48, left: 70, ready: true });

	const aboveAndClamped = calculateTooltipPosition(
		{ left: 0, top: 150, right: 10, bottom: 170, width: 10, height: 20 },
		{ left: 0, top: 0, right: 100, bottom: 50, width: 100, height: 50 },
		300,
		180,
	);
	assert.deepEqual(aboveAndClamped, { top: 92, left: 8, ready: true });

	const observed = [];
	const unsubscribe = subscribeActiveTooltip((id) => observed.push(id));
	setTooltipParent("tooltip-child", "tooltip-root");
	assert.equal(isAncestorTooltip("tooltip-root", "tooltip-child"), true);
	assert.equal(isAncestorTooltip("tooltip-child", "tooltip-root"), false);

	const calls = { kept: 0, otherOpen: 0, otherClose: 0, otherClosed: 0 };
	setTooltipTimeoutController("tooltip-root", {
		cancelOpen: () => {
			calls.kept += 1;
		},
	});
	setTooltipTimeoutController("tooltip-child", {
		cancelOpen: () => {
			calls.otherOpen += 1;
		},
		cancelClose: () => {
			calls.otherClose += 1;
		},
		close: () => {
			calls.otherClosed += 1;
		},
	});
	setActiveTooltip("tooltip-child");
	cancelOtherTooltipTimeouts("tooltip-root");
	assert.deepEqual(calls, {
		kept: 0,
		otherOpen: 1,
		otherClose: 1,
		otherClosed: 0,
	});
	closeAllTooltips();
	assert.equal(getActiveTooltipId(), null);
	assert.deepEqual(observed, ["tooltip-child", null]);
	assert.deepEqual(calls, {
		kept: 1,
		otherOpen: 2,
		otherClose: 2,
		otherClosed: 1,
	});

	unsubscribe();
	removeTooltipParent("tooltip-child");
	removeTooltipTimeoutController("tooltip-root");
	removeTooltipTimeoutController("tooltip-child");
});

await run("button model preserves sizes, classes, and icon stroke rules", () => {
	assert.equal(normalizeButtonSize(), BUTTON_SIZES.MEDIUM);
	assert.equal(normalizeButtonSize("small"), BUTTON_SIZES.SMALL);
	assert.equal(normalizeButtonSize(BUTTON_SIZES.LARGE), BUTTON_SIZES.LARGE);
	assert.equal(normalizeButtonSize("invalid"), BUTTON_SIZES.MEDIUM);

	assert.deepEqual(
		getButtonAppearance({
			variant: "create",
			size: "small",
			disabled: true,
			className: "custom",
		}),
		{
			normalizedSize: BUTTON_SIZES.SMALL,
			className:
				"Button Button__create Button__sm is_disabled custom",
			strokeWidth: 2.5,
		},
	);
	assert.equal(
		getButtonAppearance({ variant: "primary" }).strokeWidth,
		2,
	);
});

await run("list cards and search highlighting preserve navigation decisions", () => {
	const plainEvent = { ctrlKey: false, metaKey: false, shiftKey: false };
	assert.deepEqual(getListCardClickPlan("/campaign/demo", true, plainEvent), {
		preventDefault: true,
		invokeOnClick: true,
	});
	assert.deepEqual(
		getListCardClickPlan("/campaign/demo", true, {
			...plainEvent,
			ctrlKey: true,
		}),
		{ preventDefault: false, invokeOnClick: false },
	);
	assert.deepEqual(getListCardClickPlan(undefined, true, plainEvent), {
		preventDefault: false,
		invokeOnClick: true,
	});
	assert.deepEqual(getListCardClickPlan("/campaign/demo", false, plainEvent), {
		preventDefault: true,
		invokeOnClick: false,
	});

	assert.equal(splitSearchHighlight(null, "demo"), null);
	assert.equal(splitSearchHighlight(42, ""), "42");
	assert.deepEqual(splitSearchHighlight("Fire [Bolt] fire", "fire"), [
		{ text: "", highlighted: false },
		{ text: "Fire", highlighted: true },
		{ text: " [Bolt] ", highlighted: false },
		{ text: "fire", highlighted: true },
		{ text: "", highlighted: false },
	]);
	assert.deepEqual(splitSearchHighlight("a+b A+B", "a+b"), [
		{ text: "", highlighted: false },
		{ text: "a+b", highlighted: true },
		{ text: " ", highlighted: false },
		{ text: "A+B", highlighted: true },
		{ text: "", highlighted: false },
	]);
});

await run("select model preserves fallback, event, placement, and scrolling", () => {
	const options = [
		{ value: "all", label: "All" },
		{ value: "custom", label: "Custom" },
	];
	assert.equal(getSelectedOption(options, "custom"), options[1]);
	assert.equal(getSelectedOption(options, "missing"), options[0]);
	assert.equal(getSelectedOption([], "missing"), undefined);
	assert.deepEqual(createSelectChangeEvent("custom"), {
		target: { value: "custom" },
	});

	assert.deepEqual(
		calculateSelectDropdownStyle(
			{ left: 20, top: 100, bottom: 140, width: 100 },
			{ width: 400, height: 600 },
			180,
		),
		{
			position: "fixed",
			left: 20,
			top: 144,
			width: 180,
			maxHeight: 300,
		},
	);
	assert.deepEqual(
		calculateSelectDropdownStyle(
			{ left: 350, top: 500, bottom: 540, width: 120 },
			{ width: 400, height: 600 },
			180,
		),
		{
			position: "fixed",
			left: 212,
			bottom: 104,
			width: 180,
			maxHeight: 300,
		},
	);

	assert.equal(
		getSelectScrollTop({
			optionTop: 20,
			optionHeight: 30,
			scrollTop: 80,
			viewportHeight: 100,
		}),
		20,
	);
	assert.equal(
		getSelectScrollTop({
			optionTop: 180,
			optionHeight: 30,
			scrollTop: 80,
			viewportHeight: 100,
		}),
		110,
	);
	assert.equal(
		getSelectScrollTop({
			optionTop: 100,
			optionHeight: 30,
			scrollTop: 80,
			viewportHeight: 100,
		}),
		80,
	);
});

await run("multi-select model preserves normalized selection and click modes", () => {
	const options = [
		{ value: "PHB", label: "Player's Handbook" },
		{ value: "DMG", label: "Dungeon Master's Guide" },
	];
	const selection = getMultiSelectSelectionState(options, ["PHB"]);
	assert.deepEqual([...selection.normalizedValues], ["PHB"]);
	assert.equal(selection.selectedCount, 1);
	assert.deepEqual(toggleMultiSelectValue(options, ["PHB"], "PHB"), []);
	assert.deepEqual(toggleMultiSelectValue(options, ["PHB"], "DMG"), [
		"PHB",
		"DMG",
	]);

	const equivalentValues = [
		{ value: 1, label: "Numeric" },
		{ value: "1", label: "String" },
	];
	assert.equal(
		getMultiSelectSelectionState(equivalentValues, [1]).selectedCount,
		2,
	);
	assert.deepEqual(selectOnlyMultiSelectValue(equivalentValues, 1), [1, "1"]);

	assert.deepEqual(
		getMultiSelectOptionAction({
			options,
			selectedValues: ["PHB"],
			optionValue: "DMG",
			mode: "single",
			hasOptionClickHandler: true,
		}),
		{ kind: "delegate", close: true },
	);
	assert.deepEqual(
		getMultiSelectOptionAction({
			options,
			selectedValues: ["PHB"],
			optionValue: "DMG",
			mode: "toggle",
			hasOptionClickHandler: false,
		}),
		{ kind: "change", close: false, values: ["PHB", "DMG"] },
	);
	assert.deepEqual(
		getMultiSelectOptionAction({
			options,
			selectedValues: ["PHB"],
			optionValue: "DMG",
			mode: "single",
			hasOptionClickHandler: false,
		}),
		{ kind: "change", close: true, values: ["DMG"] },
	);

	assert.equal(getMultiSelectActiveScrollTarget(undefined), "top");
	assert.equal(getMultiSelectActiveScrollTarget("all"), "top");
	assert.equal(getMultiSelectActiveScrollTarget(0), "top");
	assert.equal(getMultiSelectActiveScrollTarget("PHB"), "active");
	assert.deepEqual(
		calculateMultiSelectDropdownStyle(
			{ left: 20, top: 100, bottom: 140, width: 100 },
			{ width: 500, height: 800 },
			240,
		),
		{
			position: "fixed",
			left: 20,
			top: 144,
			width: 240,
			maxHeight: 340,
		},
	);
});

await run("draggable-list model preserves threshold, keys, and reorder rules", () => {
	assert.equal(getDefaultDraggableItemKey({ _renderKey: "render", id: 1 }, 9), "render");
	assert.equal(getDefaultDraggableItemKey({ _renderKey: null, id: 1 }, 9), 1);
	assert.equal(getDefaultDraggableItemKey({}, 9), 9);
	assert.equal(getDefaultDraggableItemKey("item", 9), 9);
	assert.equal(hasReachedDragStartThreshold(0, 0, 3, 4), true);
	assert.equal(hasReachedDragStartThreshold(0, 0, 2, 4), false);

	const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
	const keyExtractor = (item) => item.id;
	const reordered = reorderDraggableItems(items, 0, 2);
	assert.deepEqual(reordered.map((item) => item.id), ["b", "c", "a"]);
	assert.notEqual(reordered, items);
	assert.equal(reorderDraggableItems(items, 1, 1), items);
	assert.equal(reorderDraggableItems(items, -1, 1), items);
	assert.equal(haveSameDraggableItemOrder(items, [...items], keyExtractor), true);
	assert.equal(haveSameDraggableItemOrder(items, reordered, keyExtractor), false);

	assert.deepEqual(
		getDraggableReorderResult({
			originalItems: items,
			sourceIndex: 0,
			targetIndex: 2,
			visitedDifferentTarget: true,
			keyExtractor,
		}),
		{ items: reordered, hasReordered: true },
	);
	assert.equal(
		getDraggableReorderResult({
			originalItems: items,
			sourceIndex: 0,
			targetIndex: 0,
			visitedDifferentTarget: true,
			keyExtractor,
		}).hasReordered,
		false,
	);
});

await run("note presentation preserves collapse and virtual-item decisions", () => {
	assert.deepEqual(
		getNoteCardPresentation(
			{ id: "note", title: " Plan ", text: "Details", collapsed: true },
			false,
			true,
			4,
		),
		{
			canCollapse: true,
			isCollapsed: true,
			showClassicHeader: false,
			showSimplifiedActions: true,
			shortText: "Deta",
			hasTruncatedPreview: true,
		},
	);
	assert.deepEqual(
		getNoteCardPresentation(
			{ id: "last", title: "", text: "Text", collapsed: true },
			true,
			false,
		),
		{
			canCollapse: false,
			isCollapsed: false,
			showClassicHeader: true,
			showSimplifiedActions: false,
			shortText: "Text",
			hasTruncatedPreview: false,
		},
	);

	assert.equal(getBulkCollapseAction([]), null);
	assert.equal(
		getBulkCollapseAction([{ collapsed: false }, { _isVirtual: true }]),
		true,
	);
	assert.equal(
		getBulkCollapseAction([{ collapsed: true }, { collapsed: true }]),
		false,
	);
	assert.equal(isRealNote({ _isVirtual: true }), false);
	assert.equal(isRealNote({ _isVirtual: false }), true);
});

await run("modal model preserves API, focus, keyboard, and close contracts", async () => {
	assert.equal(
		formatModalStatusMessage("Failed", "403", "Status"),
		"[Status: 403] Failed",
	);
	assert.equal(formatModalStatusMessage("Failed", null, "Status"), "Failed");
	assert.equal(
		resolveModalConfirmValue({
			showInput: true,
			inputValue: "answer",
			checkboxValue: false,
		}),
		"answer",
	);
	assert.deepEqual(
		resolveModalConfirmValue({
			showInput: false,
			inputValue: "ignored",
			checkboxValue: true,
			getConfirmValue: (value, checked) => ({ value, checked }),
		}),
		{ value: true, checked: true },
	);

	assert.equal(getModalFocusTarget(true, true), null);
	assert.equal(getModalFocusTarget(false, true), "input");
	assert.equal(getModalFocusTarget(false, false), "confirm");
	assert.deepEqual(getModalKeyboardPlan("Escape", false, false), {
		preventDefault: false,
		action: "close",
	});
	assert.deepEqual(getModalKeyboardPlan("Enter", false, true), {
		preventDefault: true,
		action: null,
	});
	assert.deepEqual(getModalKeyboardPlan("Enter", false, false), {
		preventDefault: true,
		action: "confirm",
	});
	assert.deepEqual(getModalKeyboardPlan("Enter", true, false), {
		preventDefault: false,
		action: null,
	});
	assert.equal(getModalCloseAction(true, true), "blocked");
	assert.equal(getModalCloseAction(false, true), "cancel");
	assert.equal(getModalCloseAction(false, false), "confirm");

	let modalConfig = null;
	let statusLabelCalls = 0;
	const api = createModalApi(
		(value) => {
			modalConfig = value;
		},
		() => {
			statusLabelCalls += 1;
			return "Status";
		},
	);
	const alertPromise = api.alert("Error", "Failed");
	assert.equal(statusLabelCalls, 0);
	assert.equal(modalConfig.message, "Failed");
	assert.equal(modalConfig.onCancel, null);
	modalConfig.onConfirm("acknowledged");
	assert.equal(await alertPromise, "acknowledged");
	assert.equal(modalConfig, null);

	const confirmPromise = api.confirm("Confirm", "Continue?", "pending");
	assert.equal(statusLabelCalls, 1);
	assert.equal(modalConfig.message, "[Status: pending] Continue?");
	modalConfig.onCancel();
	assert.equal(await confirmPromise, null);
	assert.equal(modalConfig, null);
});

await run("player questions preserve dice formulas and result targeting", () => {
	assert.deepEqual(getStandardDiceFactors(80), [8, 10]);
	assert.equal(getQuestionRollFormula(80), "((1d8 - 1) * 10) + 1d10");
	assert.equal(getQuestionRollFormula(37), "1d37");
	assert.equal(normalizeQuestionSearch("question 120", 100), "100");
	assert.equal(normalizeQuestionSearch("none", 100), "");
	assert.equal(getQuestionSearchTarget("0", 100), 1);
	assert.equal(getQuestionSearchTarget("invalid", 100), null);

	const rolledResult = {
		resultId: 7,
		context: { type: "playerQuestions" },
		result: { total: "12" },
	};
	assert.equal(getDiceResultId(rolledResult), 7);
	assert.deepEqual(getQuestionDiceRoll(rolledResult, 100), {
		resultId: 7,
		questionId: 12,
	});
	assert.deepEqual(
		getQuestionDiceRoll(
			{ ...rolledResult, context: { type: "encounter" } },
			100,
		),
		{ resultId: 7, questionId: null },
	);
});

await run("dice presentation preserves roll payloads and probability labels", () => {
	assert.equal(normalizeDiceFormula("2d6 × 3"), "2d6 * 3");
	assert.equal(createRollDicePayload("1d20×2", null), "1d20*2");
	assert.deepEqual(createRollDicePayload("1d6×4", { type: "damage" }), {
		formula: "1d6*4",
		context: { type: "damage" },
	});
	assert.equal(createRollDicePayload("1d8", 0), "1d8");

	assert.equal(formatDiceProbability(0.2), "20.0%");
	assert.equal(formatDiceProbability(0.05), "5.00%");
	assert.equal(formatDiceProbability(0.00005), "0.005%");
	assert.equal(formatDiceProbability(0.000001), "<0.001%");
	assert.equal(formatDiceProbability(0), "0.000%");
	assert.equal(getDiceProbabilityBarWidth(0.25, 0.5), 50);
	assert.equal(getDiceProbabilityBarWidth(0.25, 0), 0);
});

await run("AI monster edit presentation preserves mode-specific copy", () => {
	const translate = (value) => `uk:${value}`;
	assert.deepEqual(getMonsterAiEditPresentation("edit", translate), {
		title: "uk:AI edit custom creature",
		targetLabel: "uk:Custom creature",
		placeholder: "uk:Describe what to change.",
		submitLabel: "uk:Apply AI edit",
	});
	assert.deepEqual(getMonsterAiEditPresentation("local-edit", translate), {
		title: "uk:AI edit encounter creature",
		targetLabel: "uk:Encounter creature",
		placeholder: "uk:Describe what to change for this encounter only.",
		submitLabel: "uk:Apply local AI edit",
	});
	assert.deepEqual(getMonsterAiEditPresentation("create-based", translate), {
		title: "uk:Create custom creature based on this",
		targetLabel: "uk:Source creature",
		placeholder:
			"uk:Describe what to create, or leave empty to let AI decide.",
		submitLabel: "uk:Create custom creature",
	});
});

await run("monster field editing preserves schema variants and rule insertion", () => {
	assert.equal(calculateDiceAverage("2d8 + 6"), 15);
	assert.equal(calculateDiceAverage("2d6 * 2"), 14);
	assert.equal(calculateDiceAverage("not dice"), undefined);
	assert.deepEqual(parseSpeedText("30 ft., fly 60 ft. (hover)"), {
		walk: 30,
		fly: 60,
		canHover: true,
	});
	assert.equal(
		speedToText({ walk: 30, fly: { number: 60 }, canHover: true }),
		"30 ft., fly 60 ft. (hover)",
	);

	const typedMonster = updateCreatureBasicField(
		{ name: "Мімік", type: { type: { choose: ["aberration"] }, tags: ["shapechanger"] } },
		"type",
		"construct/monstrosity",
	);
	assert.deepEqual(typedMonster.type, {
		type: { choose: ["construct", "monstrosity"] },
		tags: ["shapechanger"],
	});
	const hpMonster = updateCreatureBasicField(
		{ name: "Мімік", hp: { formula: "1d8", special: "legacy" } },
		"hpFormula",
		"4d8 + 12",
	);
	assert.deepEqual(hpMonster.hp, {
		formula: "4d8 + 12",
		special: "legacy",
		average: 30,
	});
	assert.equal(hpMonster.hit_points, 30);

	assert.equal(actionEntriesToText({ desc: "Old text" }), "Old text");
	assert.deepEqual(actionFromText({ desc: "Old text" }, "New text"), {
		desc: "New text",
	});
	let actionMonster = addMonsterAction({ name: "Мімік" }, "action");
	actionMonster = applyRuleReferenceTag(
		actionMonster,
		{
			type: "action",
			section: "action",
			index: 0,
			selectionStart: 0,
			selectionEnd: 0,
		},
		"{@spell Shield|XPHB}",
	);
	assert.equal(
		actionEntriesToText(actionMonster.action[0]),
		"{@spell Shield|XPHB}",
	);
	actionMonster = removeMonsterAction(actionMonster, "action", 0);
	assert.deepEqual(actionMonster.action, []);

	assert.equal(
		isRulesReferenceShortcut({ ctrlKey: true, key: "л" }),
		true,
	);
	assert.equal(isRulesReferenceShortcut({ metaKey: true, key: "k" }), true);
	assert.equal(isRulesReferenceShortcut({ ctrlKey: false, key: "k" }), false);
});

await run("monster field editing validates JSON and restores source on save", () => {
	assert.deepEqual(parseMonsterJson("[]"), {
		ok: false,
		reason: "not-object",
		message: "",
	});
	assert.equal(parseMonsterJson("{").reason, "invalid-json");
	const result = prepareMonsterDraftForSave({
		draft: { name: "Ignored" },
		jsonText: JSON.stringify({ name: "Оновлений", source: "WRONG" }),
		editMode: "json",
		source: "CUSTOM",
	});
	assert.deepEqual(result, {
		ok: true,
		monster: { name: "Оновлений", source: "CUSTOM" },
	});
	assert.deepEqual(
		prepareMonsterDraftForSave({
			draft: { name: "" },
			jsonText: "{}",
			editMode: "fields",
			source: "CUSTOM",
		}),
		{ ok: false, reason: "missing-name", message: "" },
	);
});

await run("rules links resolve typed navigation targets", async () => {
	const resolvers = {
		resolveSpell: async () => ({ name: "Shield", source: "XPHB" }),
		resolveCondition: async () => ({ name: "Blinded", entries: ["text"] }),
		resolveDisease: async () => ({ name: "Sight Rot" }),
		resolveVariantRule: async () => ({ name: "Flanking" }),
		resolveSkill: async () => ({ name: "Arcana" }),
		resolveSense: async () => ({ name: "Darkvision" }),
	};
	assert.deepEqual(
		await resolveRulesLinkNavigation("spell", "Shield", resolvers),
		{ tab: "spells", name: "Shield|XPHB" },
	);
	assert.deepEqual(
		await resolveRulesLinkNavigation(
			"creature",
			"Adult Red Dragon|MM|Dragon",
			resolvers,
		),
		{ tab: "bestiary", name: "Adult Red Dragon|MM" },
	);
	assert.deepEqual(
		await resolveRulesLinkNavigation("status", "Blinded", resolvers),
		{ tab: "conditions", name: "Blinded" },
	);
});

await run("rules link previews preserve creature and reference metadata", async () => {
	const loaders = {
		getSpell: async () => ({
			name: "fireball",
			source: "XPHB",
			level: 3,
			school: "V",
			entries: ["Flame"],
		}),
		getCreature: async () => ({
			name: "Мімік",
			source: "MM",
			type: { type: "monstrosity" },
			cr: { cr: "2" },
			ac: [{ ac: 12 }],
			hp: { special: "variable" },
		}),
		getCondition: async () => ({ name: "Blinded", entries: ["Cannot see"] }),
		getDisease: async () => ({ name: "Sight Rot", type: "Disease" }),
		getVariantRule: async () => ({ name: "Flanking" }),
		getSkill: async () => ({ name: "Arcana", ability: "int", entries: [] }),
		getSense: async () => ({ name: "Darkvision" }),
	};
	const formatters = {
		formatSource: (source) =>
			source === "MM" ? "Monster Manual" : String(source || ""),
		formatSpellMeta: (spell) => `${spell.level} - ${spell.school}`,
	};
	assert.deepEqual(
		await loadRulesLinkPreview("creature", "Мімік|MM", loaders, formatters),
		{
			kind: "creature",
			title: "Мімік",
			meta: "Monster Manual • monstrosity • CR 2",
			imageSrc: "/api/bestiary/tokens/MM/%D0%9C%D1%96%D0%BC%D1%96%D0%BA.webp",
			ac: 12,
			hp: "variable",
		},
	);
	assert.deepEqual(
		await loadRulesLinkPreview("skill", "Arcana", loaders, formatters),
		{
			kind: "reference",
			title: "Arcana",
			meta: "INT",
			entries: [],
		},
	);
});

await run("rules tooltip text produces stable interactive roll descriptors", () => {
	assert.equal(
		formatRulesTooltipText("{@spell fireball|PHB|Flame} and PB"),
		"Flame and PB",
	);
	const parts = buildTooltipTextParts(
		"Claw. {@hit 6} to hit, {@damage 2d6 + 3}, {@recharge 5}",
	);
	assert.deepEqual(
		parts.filter((part) => part.kind === "roll"),
		[
			{ kind: "roll", formula: "1d20+6", label: "+6 to hit" },
			{ kind: "roll", formula: "2d6+3", label: "2d6 + 3" },
			{
				kind: "roll",
				formula: "1d6",
				label: "(Recharge 5-6)",
				context: {
					type: "recharge",
					threshold: 5,
					label: "(Recharge 5-6)",
				},
			},
		],
	);
});

await run("dice calculator model preserves request, formula, and result policies", () => {
	assert.equal(
		isDicePanelShortcut({ ctrlKey: true, metaKey: false, key: "d" }),
		true,
	);
	assert.equal(
		isDicePanelShortcut({ ctrlKey: false, metaKey: true, key: "В" }),
		true,
	);
	assert.equal(
		isDicePanelShortcut({ ctrlKey: false, metaKey: false, key: "d" }),
		false,
	);

	assert.deepEqual(readPendingDiceRoll({ requestId: 4, data: "1d20" }), {
		requestId: 4,
		formula: "1d20",
		context: null,
	});
	assert.deepEqual(
		readPendingDiceRoll({
			requestId: 5,
			data: { value: "1d6", context: { type: "damage" } },
		}),
		{ requestId: 5, formula: "1d6", context: { type: "damage" } },
	);
	assert.deepEqual(readPendingDiceRoll({ requestId: 6, data: 12 }), {
		requestId: 6,
		formula: null,
		context: null,
	});
	assert.equal(readPendingDiceRoll({ requestId: 0, data: "1d4" }), null);
	assert.equal(isPlayerQuestionsRollContext({ type: "playerQuestions" }), true);
	assert.equal(isPlayerQuestionsRollContext({ type: "damage" }), false);

	assert.equal(addDieToFormula("", 6), "1d6");
	assert.equal(addDieToFormula("1d6", 6), "2d6");
	assert.equal(addDieToFormula("2d6+", 8), "2d6+1d8");
	assert.equal(addDieToFormula("1d20+5", 4), "1d20+5+1d4");

	const roll = {
		id: 1,
		formula: "1d6 + 2",
		breakdown: [
			{ val: 6, max: 6 },
			{ val: -2, max: null, dropped: true },
		],
		total: 4,
		average: 5,
		min: 3,
		max: 8,
		isCritical: false,
		context: { type: "recharge", threshold: 5 },
	};
	assert.equal(getFullDiceBreakdownString(roll.breakdown), "6 - [2]");
	assert.equal(getDiceBreakdownLabel(roll), "6 - [2]");
	assert.equal(getRechargeThreshold(roll), 5);
	assert.equal(getRechargeResultClass(roll), "dice_recharge_fail");
	assert.equal(getRechargeResultClass(roll, 5), "dice_recharge_success");
	assert.equal(isSingleDieRoll(roll), false);
	assert.equal(
		isSingleDieRoll({
			...roll,
			formula: "1d6",
			breakdown: [{ val: 6, max: 6 }],
		}),
		true,
	);
	assert.equal(getCurrentDiceFormula(" 2d8 ", roll), "2d8");
	assert.equal(getCurrentDiceFormula("", roll), roll.formula);
	assert.deepEqual(createHistoryRollPayload(roll), {
		formula: roll.formula,
		context: roll.context,
	});
	assert.deepEqual(prependDiceHistory([roll], { ...roll, id: 2 }, 1), [
		{ ...roll, id: 2 },
	]);
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

await run("AI prompt context filters ignored data and selected scene fields", () => {
	const context = buildPromptContext({
		campaign: { name: "Campaign", description: "Description" },
		session: {
			id: "current",
			name: "Current",
			data: { encounters: [] },
		},
		contextData: {
			campaign: {
				notes: [
					{ id: "visible", title: "Visible", text: "Text" },
					{ id: "hidden", text: "Secret", _aiIgnored: true },
				],
				npcs: [{ id: "npc", firstName: "Iryna", trait: "Brave" }],
			},
			sessions: [
				{
					slug: "session-1",
					name: "One",
					conf: {
						included: true,
						scenes: {
							scene: { included: true, summary: true, notes: false },
						},
					},
					data: {
						scenes: [
							{
								id: "scene",
								texts: { summary: "Summary", goal: "Hidden goal" },
								notes: [{ text: "Hidden note" }],
							},
						],
					},
				},
			],
		},
		entityTargetScope: "session",
		simplifiedNotesEnabled: true,
	});
	assert.deepEqual(context.campaign.notes, [
		{ id: "visible", text: "Text" },
	]);
	assert.equal(context.campaign.npcs[0].name, "Iryna");
	assert.equal(context.selectedSessions[0].scenes[0].summary, "Summary");
	assert.equal("goal" in context.selectedSessions[0].scenes[0], true);
	assert.equal("notes" in context.selectedSessions[0].scenes[0], false);
});

await run("AI user prompt preserves mode-specific scope and encounter rules", () => {
	const scenePrompt = buildUserPrompt({
		contextJson: { campaign: { name: "Demo" } },
		useKey: "scene",
		entityTargetScope: "mixed",
		encounterGenerationEnabled: true,
		userInstructions: "Create an ambush.",
	});
	assert.match(scenePrompt, /INPUT DATA \(JSON\)/);
	assert.match(scenePrompt, /\[Exact Entity Name\]/);
	assert.match(scenePrompt, /Never create orphan encounters/);
	assert.match(scenePrompt, /USER INSTRUCTIONS \(PRIORITY\): Create an ambush\./);

	const imagePrompt = buildUserPrompt({
		contextJson: {},
		useKey: "image",
		imageTarget: { type: "npc", name: "Iryna" },
		userInstructions: "Painterly.",
	});
	assert.match(imagePrompt, /IMAGE TARGET \(JSON\)/);
	assert.match(imagePrompt, /selected npc/);

	const encounterPrompt = buildUserPrompt({
		contextJson: {},
		useKey: "encounter",
		encounterId: "enc-1",
		customMonsterGenerationEnabled: true,
	});
	assert.match(encounterPrompt, /enc-1/);
	assert.match(encounterPrompt, /Custom monster creation is allowed/);
});

await run("AI system instruction composes mode contracts and generation toggles", () => {
	const instruction = buildSystemInstruction({
		useKey: "scene",
		responseLanguage: { label: "Ukrainian" },
		usesStructuredJsonContract: true,
		simplifiedNotesEnabled: true,
		effectiveParseAIResponse: true,
		npcGenerationEnabled: true,
		locationGenerationEnabled: false,
		encounterGenerationEnabled: true,
		customMonsterGenerationEnabled: false,
		characterGenerationEnabled: false,
		entityTargetScope: "mixed",
		globalBasePrompt: "Dark fantasy",
		campaignBasePrompt: "Low magic",
	});
	assert.match(instruction, /MANDATORY LANGUAGE RULE/);
	assert.match(instruction, /SIMPLIFIED NOTES MODE IS ENABLED/);
	assert.match(instruction, /Every created encounter MUST be paired/);
	assert.match(instruction, /Custom monster generation is disabled/);
	assert.match(instruction, /Character generation is disabled/);
	assert.match(instruction, /Location\/faction generation is disabled/);
	assert.match(instruction, /Never output "scope": "mixed"/);
	assert.match(instruction, /GLOBAL BASE PROMPT:\nDark fantasy/);
	assert.match(instruction, /CAMPAIGN BASE PROMPT:\nLow magic/);

	const imageInstruction = buildSystemInstruction({
		useKey: "image",
		responseLanguage: { label: "English" },
		imagePromptBasePrompt: "Oil painting",
	});
	assert.doesNotMatch(imageInstruction, /MANDATORY LANGUAGE RULE/);
	assert.match(imageInstruction, /IMAGE PROMPT BASE STYLE/);
	assert.match(imageInstruction, /Oil painting/);
});

await run("Gemini gateway owns SDK request shaping and refreshes changed keys", async () => {
	let apiKey = "first";
	const createdKeys = [];
	const modelConfigs = [];
	const requestPayloads = [];
	const gateway = createGeminiGateway({
		getApiKey: () => apiKey,
		createClient: (key) => {
			createdKeys.push(key);
			return {
				getGenerativeModel(config) {
					modelConfigs.push(config);
					return {
						async generateContent(payload) {
							requestPayloads.push(payload);
							return {
								response: Promise.resolve({ text: () => "generated" }),
							};
						},
					};
				},
			};
		},
	});
	const firstResult = await gateway.generateText({
		modelName: "gemini-test",
		systemInstruction: "System",
		useJsonResponse: true,
		userPrompt: "Prompt",
		attachmentParts: [{ inlineData: { data: "a", mimeType: "image/png" } }],
	});
	assert.equal(firstResult, "generated");
	assert.equal(modelConfigs[0].generationConfig.responseMimeType, "application/json");
	assert.deepEqual(requestPayloads[0][0], { text: "Prompt" });
	await gateway.generateText({
		modelName: "gemini-test",
		systemInstruction: "System",
		useJsonResponse: false,
		userPrompt: "Plain",
	});
	assert.equal(createdKeys.length, 1);
	assert.equal(requestPayloads[1], "Plain");
	apiKey = "second";
	await gateway.generateText({
		modelName: "gemini-test",
		systemInstruction: "System",
		userPrompt: "Changed key",
	});
	assert.deepEqual(createdKeys, ["first", "second"]);
});

await run("AI attachment infrastructure converts text and binary files", () => {
	const textData = Buffer.from("Session notes", "utf8").toString("base64");
	assert.deepEqual(
		buildFileParts([
			{ name: "notes.md", mimeType: "text/markdown", data: textData },
		]),
		[
			{
				text: "ATTACHED FILE: notes.md (text/markdown)\n\nSession notes",
			},
		],
	);
	const pdfData = Buffer.from("fake pdf", "utf8").toString("base64");
	const pdfParts = buildFileParts([
		{ name: "source.pdf", mimeType: "application/pdf", data: pdfData },
	]);
	assert.equal(pdfParts[0].text, "ATTACHED FILE: source.pdf (application/pdf)");
	assert.equal(pdfParts[1].inlineData.mimeType, "application/pdf");
	assert.equal(pdfParts[1].inlineData.data, pdfData);
});

await run("AI response parser handles plain parsed and invalid responses", () => {
	assert.equal(
		parseAiResponseText({ text: "Line one\\nLine two", shouldParse: false }),
		"Line one\nLine two",
	);
	assert.deepEqual(
		parseAiResponseText({
			text: 'Before {"notes":["One\\\\nTwo"]} after',
			shouldParse: true,
		}),
		{ notes: ["One\nTwo"] },
	);
	const parseErrors = [];
	assert.deepEqual(
		parseAiResponseText({
			text: "not json\\nraw",
			shouldParse: true,
			onParseError: (...args) => parseErrors.push(args),
		}),
		{
			error: "AI returned invalid JSON. Try again.",
			raw_response: "not json\nraw",
		},
	);
	assert.equal(parseErrors.length, 1);
});

await run("AI request resolution selects modes scopes and model fallbacks", () => {
	const scene = resolveAiRequest({
		type: "scene",
		session: { id: "session" },
		parseAIResponse: true,
		generateEncounters: true,
		generateCustomMonsters: true,
		entityScope: "mixed",
		language: "uk",
	});
	assert.equal(scene.useKey, "scene");
	assert.equal(scene.entityTargetScope, "mixed");
	assert.equal(scene.customMonsterGenerationEnabled, true);
	assert.equal(scene.responseLanguage.label, "Ukrainian");
	assert.equal(scene.usesStructuredJsonContract, true);

	const disabledEncounter = resolveAiRequest({
		type: "encounter",
		session: { id: "session" },
		encounterId: "encounter",
		parseAIResponse: true,
		generateEncounters: false,
		language: "en",
	});
	assert.equal(disabledEncounter.useKey, "prompt");
	assert.equal(disabledEncounter.effectiveParseAIResponse, false);
	assert.equal(disabledEncounter.entityTargetScope, "campaign");

	const customMonster = resolveAiRequest({
		type: "custom-monster",
		parseAIResponse: false,
		language: "English",
	});
	assert.equal(customMonster.useKey, "custom-monster");
	assert.equal(customMonster.effectiveParseAIResponse, true);
	assert.equal(
		selectAiModel(
			{
				models: [{ name: "gemini-selected" }],
				defaultModel: "gemini-default",
			},
			"models/gemini-selected",
		),
		"gemini-selected",
	);
	assert.equal(
		selectAiModel(
			{ models: [], defaultModel: "gemini-default" },
			"missing",
		),
		"gemini-default",
	);
});

await run("AI generation preparation resolves settings without HTTP or files", async () => {
	let settingsReads = 0;
	const prepared = await prepareGenerateAiRequest({
		payload: {
			type: "scene",
			path: { campaign: "demo", session: "session-1" },
			language: "UK",
			parseAIResponse: true,
			generateEncounters: true,
			generateCustomMonsters: true,
			generateLocations: false,
		},
		apiKeyConfigured: true,
		readSettings: async () => {
			settingsReads += 1;
			return {
				simplifiedNotes: true,
				autoApplyAiChanges: false,
				aiBasePrompt: "Global",
				imagePromptBasePrompt: "Image",
				campaignAiBasePrompts: { demo: "Campaign" },
			};
		},
	});
	assert.equal(settingsReads, 1);
	assert.equal(prepared.responseLanguage, "uk");
	assert.equal(prepared.entityTargetScope, "mixed");
	assert.equal(prepared.encounterGenerationEnabled, true);
	assert.equal(prepared.customMonsterGenerationEnabled, true);
	assert.equal(prepared.locationGenerationEnabled, false);
	assert.equal(prepared.autoApplyAiChanges, false);
	assert.equal(prepared.campaignBasePrompt, "Campaign");

	assert.deepEqual(
		await prepareGenerateAiRequest({
			payload: {},
			apiKeyConfigured: true,
			readSettings: async () => {
				throw new Error("settings must not be read");
			},
		}),
		{ error: { status: 400, message: "language is required." } },
	);
	assert.deepEqual(
		await prepareGenerateAiRequest({
			payload: { language: "en" },
			apiKeyConfigured: false,
			readSettings: async () => {
				throw new Error("settings must not be read");
			},
		}),
		{
			error: { status: 500, message: "GEMINI_API_KEY is not configured." },
		},
	);
});

await run("Bestiary image generation command runs without Express or Gemini", async () => {
	const generatedRequests = [];
	const savedEntries = [];
	const historyWriter = {
		buildRequestSnapshot: (request) => ({ snapshot: request }),
		cloneRetryPayload: (payload) => ({ retry: payload.type }),
		saveFailed: async () => {
			throw new Error("not expected");
		},
	};
	const command = createGenerateBestiaryImagePrompt({
		generateContent: async (request) => {
			generatedRequests.push(request);
			return "Portrait prompt";
		},
		addAiResponse: async (entry) => {
			savedEntries.push(entry);
			return { id: "history-1", ...entry };
		},
		historyWriter,
	});
	const payload = {
		type: "image",
		modelName: "gemini-test",
		userInstructions: "Paint Iryna",
		imageTarget: { type: "custom-monster", name: "Mavka" },
		attachedImages: [],
		attachedFiles: [],
	};
	const result = await command({
		payload,
		preparedRequest: {
			responseLanguage: "uk",
			simplifiedNotesEnabled: true,
			globalBasePrompt: "Global",
			imagePromptBasePrompt: "Painterly",
			campaignBasePrompt: "",
		},
		historyUserInstructions: "Paint Iryna",
	});
	assert.equal(result.status, 200);
	assert.equal(result.body.prompt, "Portrait prompt");
	assert.equal(generatedRequests[0].entityScope, "custom-bestiary");
	assert.equal(generatedRequests[0].parseAIResponse, false);
	assert.equal(savedEntries[0].path.campaign, "bestiary");

	const failedCommand = createGenerateBestiaryImagePrompt({
		generateContent: async () => ({ error: "failed" }),
		addAiResponse: async () => {
			throw new Error("not expected");
		},
		historyWriter: {
			...historyWriter,
			saveFailed: async () => ({ id: "failed-history" }),
		},
	});
	const failed = await failedCommand({
		payload,
		preparedRequest: {
			responseLanguage: "uk",
			simplifiedNotesEnabled: false,
		},
		historyUserInstructions: "Paint Iryna",
	});
	assert.equal(failed.status, 500);
	assert.equal(failed.body.aiResponse.id, "failed-history");
});

await run("Custom monster generation command normalizes context and selects draft flow", async () => {
	const generatedRequests = [];
	const flowCalls = [];
	let normalizedWrites = 0;
	const command = createGenerateCustomMonster({
		readCustomBestiary: async () => ({
			monster: [
				{ name: "Mavka", source: "HB", type: "fey", cr: "3" },
			],
		}),
		writeCustomBestiaryMonsters: async (monsters) => {
			normalizedWrites += 1;
			return monsters.map((monster) => ({ ...monster, id: "monster-1" }));
		},
		readCampaign: async () => null,
		readSession: async () => null,
		appendCampaignContext: async () => {},
		generateContent: async (request) => {
			generatedRequests.push(request);
			return {
				version: 2,
				operations: [
					{ op: "update", entity: "monster", patch: { cr: "4" } },
				],
			};
		},
		fillCurrentTargetIds: (content, target) => {
			content.operations[0].id = target.customMonsterTarget.id;
		},
		assertGeneratedContent: () => {},
		historyWriter: { saveFailed: async () => ({ id: "failed" }) },
		encounterLocalFlow: {
			isEnabled: () => false,
			createDraft: async () => {
				throw new Error("not expected");
			},
		},
		customMonsterFlow: {
			createDraft: async (input) => {
				flowCalls.push(input);
				return { status: 201, body: { draft: true } };
			},
		},
	});
	const result = await command({
		payload: {
			type: "custom-monster",
			modelName: "gemini-test",
			userInstructions: "Increase CR",
			customMonsterTarget: { id: "monster-1", name: "Mavka" },
			customMonsterMode: "edit",
		},
		preparedRequest: {
			requestPath: { campaign: "bestiary" },
			responseLanguage: "uk",
			simplifiedNotesEnabled: true,
		},
		historyUserInstructions: "Increase CR",
	});
	assert.equal(result.status, 201);
	assert.equal(normalizedWrites, 1);
	assert.equal(
		generatedRequests[0].contextData.customBestiary.selectedMonster.id,
		"monster-1",
	);
	assert.equal(generatedRequests[0].parseAIResponse, true);
	assert.equal(flowCalls[0].beforeCustomMonsters[0].id, "monster-1");
	assert.equal(flowCalls[0].generatedContent.operations[0].id, "monster-1");

	const failedCommand = createGenerateCustomMonster({
		readCustomBestiary: async () => ({ monster: [] }),
		writeCustomBestiaryMonsters: async () => [],
		readCampaign: async () => null,
		readSession: async () => null,
		appendCampaignContext: async () => {},
		generateContent: async () => ({ error: "invalid response" }),
		fillCurrentTargetIds: () => {},
		assertGeneratedContent: () => {},
		historyWriter: { saveFailed: async () => ({ id: "failed-history" }) },
		encounterLocalFlow: { isEnabled: () => false },
		customMonsterFlow: {},
	});
	const failed = await failedCommand({
		payload: { type: "custom-monster" },
		preparedRequest: {
			requestPath: { campaign: "bestiary" },
			responseLanguage: "uk",
		},
		historyUserInstructions: "",
	});
	assert.equal(failed.status, 500);
	assert.equal(failed.body.aiResponse.id, "failed-history");
});

await run("Campaign generation command builds context mentions and persistence input", async () => {
	const generatedRequests = [];
	const persisted = [];
	const command = createGenerateCampaignContent({
		readCampaign: async () => ({ name: "Demo", notes: [] }),
		readSession: async () => ({
			name: "Session One",
			data: { scenes: [], npcs: [], locations: [] },
		}),
		readCustomBestiary: async () => ({
			monster: [{ name: "Bog Warden" }],
		}),
		appendCampaignContext: async (context) => {
			context.campaign.npcs = [{ id: "npc-1", name: "Iryna" }];
		},
		filterSessionData: (data) => ({ ...data, filtered: true }),
		generateContent: async (request) => {
			generatedRequests.push(request);
			return {
				version: 2,
				operations: [
					{
						op: "update",
						entity: "scene",
						patch: { summary: "Iryna arrives" },
					},
				],
			};
		},
		fillCurrentTargetIds: (content) => {
			content.operations[0].id = "scene-1";
		},
		collectMentionCandidates: () => ["Iryna"],
		applyMentionsToGeneratedContent: (content) => {
			content.operations[0].patch.summary = "[Iryna] arrives";
		},
		assertGeneratedContent: () => {},
		historyWriter: { saveFailed: async () => ({ id: "failed" }) },
		campaignFlow: {
			persistGeneratedContent: async (input) => {
				persisted.push(input);
				return { status: 200, body: { applied: true } };
			},
		},
	});
	const payload = {
		type: "scene",
		modelName: "gemini-test",
		userInstructions: "Bring Iryna in",
		sceneId: "scene-1",
		parseAIResponse: true,
		contextConfig: { campaignNpcs: true },
	};
	const result = await command({
		payload,
		preparedRequest: {
			requestPath: {
				campaign: "demo",
				session: "session-1",
				encounter: null,
			},
			responseLanguage: "uk",
			shouldParseAIResponse: true,
			entityTargetScope: "mixed",
			characterGenerationEnabled: true,
			npcGenerationEnabled: true,
			locationGenerationEnabled: true,
			encounterGenerationEnabled: true,
			customMonsterGenerationEnabled: false,
			simplifiedNotesEnabled: false,
			autoApplyAiChanges: true,
		},
		historyUserInstructions: "Bring Iryna in",
	});
	assert.equal(result.status, 200);
	assert.equal(generatedRequests[0].contextData.currentSession.data.filtered, true);
	assert.deepEqual(generatedRequests[0].contextData.customBestiary, {
		monsterNames: ["Bog Warden"],
	});
	assert.equal(
		persisted[0].generatedContent.operations[0].patch.summary,
		"[Iryna] arrives",
	);
	assert.equal(persisted[0].entityTargetScope, "mixed");

	assert.deepEqual(
		await command({
			payload,
			preparedRequest: { requestPath: {} },
			historyUserInstructions: "",
		}),
		{ status: 400, body: { error: "path.campaign is required." } },
	);
});

await run("AI campaign context loader uses injected entity and session ports", async () => {
	const entityReads = [];
	const appendContext = createAppendConfiguredCampaignContext({
		listEntities: async (_campaign, type) => {
			entityReads.push(type);
			if (type === "npc") {
				return [
					{ id: "visible", name: "Visible" },
					{ id: "hidden", name: "Hidden", _aiIgnored: true },
				];
			}
			return [];
		},
		readSession: async () => ({
			name: "One",
			data: {
				notes: [{ text: "Visible" }, { text: "Hidden", _aiIgnored: true }],
				scenes: [],
			},
		}),
	});
	const target = { campaign: {}, sessions: [] };
	await appendContext(
		target,
		"demo",
		{ notes: [{ text: "Campaign" }] },
		{
			campaignNotes: true,
			campaignNpcs: true,
			sessions: { "session-1": { included: true, notes: true } },
		},
	);
	assert.deepEqual(entityReads, ["npc"]);
	assert.deepEqual(target.campaign.npcs, [
		{ id: "visible", name: "Visible" },
	]);
	assert.deepEqual(target.sessions[0].data.notes, [{ text: "Visible" }]);
});

await run("AI history repository port validates and maps filesystem storage", async () => {
	assert.throws(
		() => createAiHistoryRepositoryPort({}),
		/requires list\(\)/,
	);
	const calls = [];
	const repository = createFileAiHistoryRepository({
		readAiResponses: async (campaign) => {
			calls.push(["list", campaign]);
			return [];
		},
		getAiResponsesStorageStats: async (campaign) => {
			calls.push(["stats", campaign]);
			return { bytes: 0 };
		},
		getAiResponse: async (campaign, id) => {
			calls.push(["get", campaign, id]);
			return { id };
		},
		addAiResponse: async (entry) => {
			calls.push(["add", entry.id]);
			return entry;
		},
		updateAiResponse: async (campaign, id, patch) => {
			calls.push(["update", campaign, id, patch]);
			return { id, ...patch };
		},
		deleteAiResponse: async (campaign, id) => {
			calls.push(["delete", campaign, id]);
			return { ok: true };
		},
		clearAiResponses: async (campaign) => {
			calls.push(["clear", campaign]);
			return { ok: true };
		},
	});
	await repository.list("demo");
	await repository.stats("demo");
	await repository.get("demo", "one");
	await repository.add({ id: "two" });
	await repository.update("demo", "two", { text: "updated" });
	await repository.delete("demo", "two");
	await repository.clear("demo");
	assert.deepEqual(
		calls.map(([method]) => method),
		["list", "stats", "get", "add", "update", "delete", "clear"],
	);
	assert.equal(Object.isFrozen(repository), true);
});

await run("AI history commands edit drafts and delegate apply undo snapshots", async () => {
	const updates = [];
	const restores = [];
	const entries = new Map([
		[
			"draft",
			{
				id: "draft",
				applyState: "draft",
				changes: {
					resources: [
						{
							id: "resource-1",
							before: { id: "stable", nested: { id: "nested" } },
							after: { id: "stable", nested: { id: "nested" } },
						},
					],
				},
			},
		],
	]);
	const commands = createAiHistoryCommands({
		repository: {
			get: async (_campaign, id) => entries.get(id) || null,
			update: async (campaign, id, patch) => {
				updates.push([campaign, id, patch]);
				return { id, ...patch };
			},
		},
		restoreSnapshot: async (entry, side, options) => {
			restores.push([entry.id, side, options]);
			return { restored: side };
		},
		buildChangeSummary: (resources) => ({ count: resources.length }),
	});
	await commands.patchDraft({
		campaignSlug: "demo",
		id: "draft",
		resources: [
			{
				id: "resource-1",
				after: { id: "changed", nested: { id: "changed-nested", value: 1 } },
			},
		],
	});
	const patched = updates[0][2].changes.resources[0].after;
	assert.equal(patched.id, "stable");
	assert.equal(patched.nested.id, "nested");
	assert.equal(patched.nested.value, 1);
	assert.deepEqual(updates[0][2].changes.summary, { count: 1 });
	await commands.apply({
		campaignSlug: "demo",
		id: "draft",
		resourceIds: ["resource-1"],
	});
	await commands.undo({
		campaignSlug: "demo",
		id: "draft",
		resourceIds: ["resource-1"],
	});
	assert.deepEqual(restores, [
		["draft", "after", { resourceIds: ["resource-1"] }],
		["draft", "before", { resourceIds: ["resource-1"] }],
	]);
	await assert.rejects(
		commands.apply({ campaignSlug: "demo", id: "missing" }),
		(error) => error.status === 404 && error.message === "AI response not found.",
	);
	entries.set("applied", { id: "applied", applyState: "applied" });
	await assert.rejects(
		commands.patchDraft({ campaignSlug: "demo", id: "applied", resources: [] }),
		(error) => error.status === 400,
	);
});

await run("Top-level AI generation command selects workflows and records failures", async () => {
	const selected = [];
	const historyWriter = {
		getUserInstructions: () => "History instructions",
		saveFailed: async (_payload, error, status) => ({
			id: "failed",
			message: error.message,
			status,
		}),
	};
	const command = createGenerateAiRequest({
		prepareRequest: async ({ payload }) => ({
			isBestiaryImagePromptRequest: payload.type === "image",
		}),
		generateCustomMonster: async (input) => {
			selected.push(["monster", input.historyUserInstructions]);
			return { status: 201, body: {} };
		},
		generateBestiaryImagePrompt: async () => {
			selected.push(["image"]);
			return { status: 200, body: {} };
		},
		generateCampaignContent: async () => {
			selected.push(["campaign"]);
			return { status: 200, body: {} };
		},
		historyWriter,
		isApiKeyConfigured: () => true,
		readSettings: async () => ({}),
	});
	await command({ type: "custom-monster" });
	await command({ type: "image" });
	await command({ type: "scene" });
	assert.deepEqual(selected, [
		["monster", "History instructions"],
		["image"],
		["campaign"],
	]);
	const failedCommand = createGenerateAiRequest({
		prepareRequest: async () => {
			throw Object.assign(new Error("boom"), { status: 422 });
		},
		generateCustomMonster: async () => {},
		generateBestiaryImagePrompt: async () => {},
		generateCampaignContent: async () => {},
		historyWriter,
		isApiKeyConfigured: () => true,
		readSettings: async () => ({}),
	});
	assert.deepEqual(await failedCommand({ type: "scene" }), {
		status: 422,
		body: {
			error: "boom",
			aiResponse: { id: "failed", message: "boom", status: 422 },
		},
	});
});

await run("Gemini API key command validates and persists through infrastructure", async () => {
	assert.equal(updateEnvValue("A=1\n", "GEMINI_API_KEY", "key"), "A=1\nGEMINI_API_KEY=key\n");
	assert.equal(
		updateEnvValue("GEMINI_API_KEY=old\r\n", "GEMINI_API_KEY", "new"),
		"GEMINI_API_KEY=new\r\n",
	);
	let written = null;
	const environment = {};
	const store = createEnvApiKeyStore({
		filePath: ".env",
		fileSystem: {
			readFile: async () => "A=1\n",
			writeFile: async (...args) => {
				written = args;
			},
		},
		environment,
	});
	let cacheClears = 0;
	const save = createSaveGeminiApiKey({
		apiKeyStore: store,
		clearModelCache: () => {
			cacheClears += 1;
		},
	});
	assert.equal((await save(" ")).status, 400);
	assert.equal((await save("one\ntwo")).status, 400);
	assert.deepEqual(await save(" secret "), { status: 200, body: { ok: true } });
	assert.deepEqual(written, [".env", "A=1\nGEMINI_API_KEY=secret\n", "utf8"]);
	assert.equal(environment.GEMINI_API_KEY, "secret");
	assert.equal(cacheClears, 1);
});

await run("Campaign entity commands preserve ids defaults mentions and repository contract", async () => {
	const entities = new Map();
	const mentionUpdates = [];
	const repository = {
		list: async () => Array.from(entities.values()),
		read: async (_campaign, _type, slug) => entities.get(slug),
		write: async (_campaign, _type, slug, data) => {
			const saved = { ...data, slug };
			entities.set(slug, saved);
			return saved;
		},
		delete: async (_campaign, _type, slug) => entities.delete(slug),
		createId: () => "stable-id",
		sanitizeName: (name) => String(name || "").trim(),
		toSlug: (name) => String(name).toLowerCase().replace(/\s+/g, "-"),
		ensureUniqueSlug: async (_campaign, _type, slug) => slug,
		updateMentionReferences: async (...args) => mentionUpdates.push(args),
		move: async (...args) => ({ moved: args }),
	};
	const commands = createCampaignEntityCommands(repository);
	const created = await commands.create({
		campaignSlug: "demo",
		type: "npc",
		payload: { firstName: "Iryna", notes: [{ text: "Existing" }] },
	});
	assert.equal(created.id, "stable-id");
	assert.equal(created.slug, "iryna");
	assert.equal(created.level, 1);
	assert.deepEqual(created.notes, [{ text: "Existing" }]);
	const updated = await commands.update({
		campaignSlug: "demo",
		type: "npc",
		entitySlug: "iryna",
		payload: {
			id: "changed-id",
			slug: "changed-slug",
			firstName: "Ira",
			_updateMentionReferences: true,
			_mentionOldName: "Iryna",
		},
	});
	assert.equal(updated.id, "stable-id");
	assert.equal(updated.slug, "iryna");
	assert.deepEqual(mentionUpdates, [["demo", "Iryna", "Ira"]]);
	await commands.delete({
		campaignSlug: "demo",
		type: "npc",
		entitySlug: "iryna",
	});
	assert.equal(entities.size, 0);
	await commands.replaceAll({
		campaignSlug: "demo",
		type: "npc",
		entities: [
			{ slug: "first", firstName: "First" },
			{ slug: "second", firstName: "Second" },
		],
	});
	assert.equal(entities.get("first").order, 0);
	assert.equal(entities.get("second").order, 1);
	await commands.replaceAll({
		campaignSlug: "demo",
		type: "npc",
		entities: [{ slug: "second", firstName: "Second" }],
	});
	assert.equal(entities.has("first"), false);
	const moved = await commands.moveBetweenCharacterTypes({
		campaignSlug: "demo",
		type: "npc",
		entitySlug: "second",
		targetType: "characters",
	});
	assert.deepEqual(moved.moved, ["demo", "npc", "second", "characters"]);
	await assert.rejects(
		commands.moveBetweenCharacterTypes({
			campaignSlug: "demo",
			type: "locations",
			entitySlug: "second",
			targetType: "npc",
		}),
		(error) => error.status === 400,
	);
	await assert.rejects(
		commands.create({ campaignSlug: "demo", type: "unknown", payload: {} }),
		(error) => error.status === 400 && error.message === "Unknown entity type.",
	);

	const adapter = createFileCampaignEntityRepository({
		listEntities: async () => [],
		readEntity: async () => ({}),
		writeEntity: async () => ({}),
		deleteEntity: async () => {},
		createId: () => "id",
		sanitizeName: (name) => name,
		campaignSlug: (name) => name,
		ensureUniqueEntitySlug: async (_campaign, _type, slug) => slug,
		updateCampaignMentionReferences: async () => {},
		moveEntity: async () => ({}),
	});
	assert.equal(Object.isFrozen(adapter), true);
});

await run("Campaign entity scope commands preserve ids and compensate partial writes", async () => {
	const entities = new Map([
		["npc:guide", { id: "npc-1", slug: "guide", firstName: "Guide" }],
	]);
	let session = {
		id: "session-1",
		name: "Arrival",
		data: { npcs: [], locations: [] },
	};
	let failDelete = false;
	const repository = {
		readEntity: async (_campaign, type, slug) => entities.get(`${type}:${slug}`),
		writeEntity: async (_campaign, type, slug, entity) => {
			const saved = { ...entity, slug };
			entities.set(`${type}:${slug}`, saved);
			return saved;
		},
		deleteEntity: async (_campaign, type, slug) => {
			if (failDelete) throw new Error("delete failed");
			entities.delete(`${type}:${slug}`);
		},
		readSession: async () => structuredClone(session),
		writeSession: async (_campaign, _fileName, next) => {
			session = structuredClone(next);
			return next;
		},
		sanitizeName: (name) => String(name || "").trim(),
		toSlug: (name) => String(name).toLowerCase(),
		ensureUniqueSlug: async (_campaign, _type, slug) => slug,
	};
	const commands = createCampaignEntityScopeCommands(repository);
	const movedToSession = await commands.move({
		campaignSlug: "demo",
		fileName: "arrival",
		type: "npc",
		entitySlug: "guide",
		targetScope: "session",
	});
	assert.equal(movedToSession.entity.id, "npc-1");
	assert.equal(session.data.npcs[0].id, "npc-1");
	assert.equal(entities.has("npc:guide"), false);

	const movedToCampaign = await commands.move({
		campaignSlug: "demo",
		fileName: "arrival",
		type: "npc",
		entityId: "npc-1",
		targetScope: "campaign",
	});
	assert.equal(movedToCampaign.entity.id, "npc-1");
	assert.equal(entities.get("npc:guide").id, "npc-1");
	assert.deepEqual(session.data.npcs, []);

	entities.set("npc:scout", { id: "npc-2", slug: "scout", firstName: "Scout" });
	failDelete = true;
	await assert.rejects(
		commands.move({
			campaignSlug: "demo",
			fileName: "arrival",
			type: "npc",
			entitySlug: "scout",
			targetScope: "session",
		}),
		/delete failed/,
	);
	assert.deepEqual(session.data.npcs, []);
	assert.equal(entities.has("npc:scout"), true);
	await assert.rejects(
		commands.move({
			campaignSlug: "demo",
			fileName: "arrival",
			type: "characters",
			targetScope: "session",
		}),
		(error) => error.status === 400,
	);
});

await run("Campaign commands own lifecycle rename references and ordering", async () => {
	const campaigns = new Map();
	const renames = [];
	const removals = [];
	const repository = {
		metaExists: async (slug) => campaigns.has(slug),
		dataExists: async (slug) => campaigns.has(slug),
		list: async () => Array.from(campaigns.values()),
		read: async (slug) => structuredClone(campaigns.get(slug)),
		write: async (slug, campaign) => {
			campaigns.set(slug, structuredClone(campaign));
			return structuredClone(campaign);
		},
		initialize: async () => {},
		rename: async (oldSlug, nextSlug) => {
			renames.push([oldSlug, nextSlug]);
			campaigns.set(nextSlug, campaigns.get(oldSlug));
			campaigns.delete(oldSlug);
		},
		remove: async (...args) => {
			removals.push(args);
			campaigns.delete(args[0]);
		},
		hasImages: async (slug) => slug === "renamed",
		exportBundle: async (slug) => ({ slug }),
		sanitizeName: (name) => String(name || "").trim(),
		toSlug: (name) => String(name).toLowerCase().replace(/\s+/g, "-"),
		ensureUniqueSlug: async (slug) => slug,
		createId: () => "campaign-stable-id",
		replaceImageSlugReferences: (campaign, oldSlug, nextSlug) => ({
			...campaign,
			imageUrl: String(campaign.imageUrl || "").replace(oldSlug, nextSlug),
		}),
		normalizeSourceList: (sources) =>
			Array.from(new Set((sources || []).map((source) => source.toUpperCase()))),
	};
	const commands = createCampaignCommands(repository, {
		now: () => new Date("2031-04-05T06:07:08.000Z"),
		createNoteId: () => "note-id",
	});
	const created = await commands.create({ payload: { name: " Demo " } });
	assert.equal(created.id, "campaign-stable-id");
	assert.equal(created.slug, "demo");
	assert.equal(created.createdAt, "2031-04-05T06:07:08.000Z");
	assert.equal(created.notes[0].id, "note-id");
	campaigns.set("demo", { ...created, imageUrl: "/demo/maps/a.png" });
	const updated = await commands.update({
		slug: "demo",
		patch: {
			id: "changed",
			createdAt: "changed",
			name: "Renamed",
			ignoreSourcesList: ["phb", "PHB", "xge"],
		},
	});
	assert.equal(updated.id, "campaign-stable-id");
	assert.equal(updated.createdAt, "2031-04-05T06:07:08.000Z");
	assert.equal(updated.slug, "renamed");
	assert.equal(updated.imageUrl, "/renamed/maps/a.png");
	assert.deepEqual(updated.ignoreSourcesList, ["PHB", "XGE"]);
	assert.deepEqual(renames, [["demo", "renamed"]]);
	assert.deepEqual(await commands.getImageStatus({ slug: "renamed" }), {
		hasImages: true,
	});
	assert.deepEqual(await commands.export({ slug: "renamed" }), {
		slug: "renamed",
	});
	await commands.reorder({ orders: { renamed: 7, missing: 2 } });
	assert.equal(campaigns.get("renamed").order, 7);
	await commands.remove({ slug: "renamed", moveImagesToGeneral: true });
	assert.deepEqual(removals, [["renamed", { moveImagesToGeneral: true }]]);
	await assert.rejects(
		commands.update({ slug: "missing", patch: {} }),
		(error) => error.status === 404,
	);
	await assert.rejects(
		commands.create({ payload: { name: " " } }),
		(error) => error.status === 400,
	);
});

await run("Campaign entity frontend feature sanitizes create and delegates CRUD", async () => {
	const calls = [];
	const client = createCampaignEntityClient({
		createEntity: async (...args) => calls.push(["create", ...args]),
		updateEntity: async (...args) => calls.push(["update", ...args]),
		deleteEntity: async (...args) => calls.push(["delete", ...args]),
	});
	const payload = buildCreateEntityPayload(
		{ notes: [], level: 1 },
		{ id: "temp", slug: "temp", createdAt: "now", firstName: "Iryna", _draft: true },
	);
	assert.equal("_draft" in payload, false);
	await client.create("demo", "npc", payload);
	await client.update("demo", "npc", "iryna", { firstName: "Ira" });
	await client.delete("demo", "npc", "iryna");
	assert.deepEqual(calls, [
		[
			"create",
			"demo",
			"npc",
			{ notes: [], level: 1, firstName: "Iryna" },
		],
		["update", "demo", "npc", "iryna", { firstName: "Ira" }],
		["delete", "demo", "npc", "iryna"],
	]);
	const entities = [
		{ id: "one", name: "One" },
		{ id: "two", name: "Two" },
	];
	assert.deepEqual(replaceEntityById(entities, "two", { id: "two", name: "Updated" }), [
		entities[0],
		{ id: "two", name: "Updated" },
	]);
	assert.deepEqual(removeEntityById(entities, "one"), [entities[1]]);
	assert.deepEqual(withEntityOrder(entities), [
		{ ...entities[0], order: 0 },
		{ ...entities[1], order: 1 },
	]);
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

await run("AI diff expands session resources and preserves line metadata", () => {
	const resources = buildDiffResources(
		{
			id: "history-1",
			changes: {
				resources: [
					{
						id: "session:1",
						kind: "session",
						label: "Session",
						before: {
							id: "stable",
							name: "Before",
							data: { notes: [{ id: "note-1", text: "Old" }] },
						},
						after: {
							id: "stable",
							name: "After",
							data: { notes: [{ id: "note-1", text: "New" }] },
						},
					},
				],
			},
		},
		{ note: "Note" },
	);

	const nameDiff = resources.find((resource) => resource.id === "session:1:name");
	const noteDiff = resources.find(
		(resource) => resource.id === "session:1:notes/New",
	);
	assert.ok(nameDiff);
	assert.ok(noteDiff);
	assert.equal(nameDiff.parentResourceId, "session:1");
	assert.ok(nameDiff.lines.some((line) => line.type === "removed"));
	assert.ok(nameDiff.lines.some((line) => line.type === "added"));
	assert.equal(getDiffResourceState({ before: null, after: {} }), "Added");
	assert.equal(getDiffResourceState({ before: {}, after: null }), "Deleted");
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

await run("AI feature model estimates context and rebuilds retry workflows", async () => {
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

	const generating = aiGenerationLifecycleReducer(initialAiGenerationLifecycle, {
		type: "start-generation",
		requestId: 1,
	});
	assert.equal(generating.status, AI_GENERATION_STATUS.GENERATING);
	assert.equal(isAiGenerationPending(generating), true);
	assert.equal(
		aiGenerationLifecycleReducer(generating, {
			type: "cancel",
			requestId: 0,
		}),
		generating,
	);
	const succeeded = aiGenerationLifecycleReducer(generating, {
		type: "succeed",
		requestId: 1,
	});
	assert.equal(succeeded.status, AI_GENERATION_STATUS.SUCCEEDED);
	assert.equal(isAiGenerationPending(succeeded), false);
	const retrying = aiGenerationLifecycleReducer(succeeded, {
		type: "start-retry",
		requestId: 2,
	});
	assert.equal(retrying.status, AI_GENERATION_STATUS.RETRYING);
	assert.equal(
		aiGenerationLifecycleReducer(retrying, {
			type: "fail",
			requestId: 2,
		}).status,
		AI_GENERATION_STATUS.FAILED,
	);

	const oldHistoryEntry = { id: "one", text: "Old" };
	const newHistoryEntry = { id: "two", text: "New" };
	assert.deepEqual(
		upsertAiHistoryEntry([oldHistoryEntry, newHistoryEntry], {
			id: "one",
			text: "Updated",
		}),
		[{ id: "one", text: "Updated" }, newHistoryEntry],
	);
	assert.equal(
		getAiHistoryCampaign({ path: { campaign: "entry-campaign" } }, "fallback"),
		"entry-campaign",
	);
	assert.deepEqual(getAiHistoryRestoreMode("undo", ["resource-1"]), {
		isUndo: true,
		isPartial: true,
		operation: "undo",
	});

	const restoredEntry = {
		id: "history-1",
		path: { campaign: "demo", session: "session-1" },
		changes: {
			resources: [{ kind: "entity", type: "npc" }],
		},
	};
	const restorePlan = buildAiHistoryRestorePlan({
		result: {
			response: restoredEntry,
			updated: { data: { scenes: [] } },
		},
		fallbackEntry: null,
		selectedResponseId: "history-1",
		currentRoute: { campaign: "demo", session: "session-1" },
		isCampaign: false,
		isBestiary: false,
	});
	assert.deepEqual(restorePlan.historyUpdate, {
		type: "upsert",
		entry: restoredEntry,
	});
	assert.equal(restorePlan.updateSelection, true);
	assert.equal(restorePlan.applyDirectly, true);
	assert.equal(restorePlan.requestReload, false);
	assert.deepEqual(restorePlan.entityTypes, ["npc"]);

	const foreignRestorePlan = buildAiHistoryRestorePlan({
		result: {
			responses: [restoredEntry],
			updated: { data: { scenes: [] } },
		},
		fallbackEntry: restoredEntry,
		selectedResponseId: null,
		currentRoute: { campaign: "other", session: "session-1" },
		isCampaign: false,
		isBestiary: false,
	});
	assert.equal(foreignRestorePlan.historyUpdate.type, "replace");
	assert.equal(foreignRestorePlan.applyDirectly, false);
	assert.equal(foreignRestorePlan.requestReload, true);

	const commandCalls = [];
	const commandService = createAiHistoryCommandService({
		deleteAiResponse: async (...args) => {
			commandCalls.push(["delete", ...args]);
			return [];
		},
		clearAiResponses: async (...args) => {
			commandCalls.push(["clear", ...args]);
			return [];
		},
		applyAiResponse: async (...args) => {
			commandCalls.push(["apply", ...args]);
			return { response: restoredEntry };
		},
		undoAiResponse: async (...args) => {
			commandCalls.push(["undo", ...args]);
			return { response: restoredEntry };
		},
		updateAiResponse: async (...args) => {
			commandCalls.push(["save", ...args]);
			return restoredEntry;
		},
	});
	await commandService.deleteEntry("demo", "history-1");
	await commandService.clearHistory("demo");
	await commandService.restoreEntry("demo", "history-1", "apply", ["a"]);
	await commandService.restoreEntry("demo", "history-1", "undo", ["b"]);
	await commandService.saveDraft("demo", "history-1", [{ id: "a" }]);
	assert.deepEqual(commandCalls, [
		["delete", "demo", "history-1"],
		["clear", "demo"],
		["apply", "demo", "history-1", { resourceIds: ["a"] }],
		["undo", "demo", "history-1", { resourceIds: ["b"] }],
		["save", "demo", "history-1", { resources: [{ id: "a" }] }],
	]);

	assert.deepEqual(getContextListConfig(false), {
		included: false,
		items: {},
	});
	const initialContextList = { included: true, items: { existing: false } };
	assert.equal(
		ensureContextListItems(
			initialContextList,
			[{ id: "existing" }],
			(item) => item.id,
		),
		initialContextList,
	);
	assert.deepEqual(
		ensureContextListItems(
			initialContextList,
			[{ id: "existing" }, { id: "new" }],
			(item) => item.id,
		),
		{ included: true, items: { existing: false, new: true } },
	);
	const withSceneValue = updateContextConfigValue(
		{},
		["sessions", "session-1", "scenes", "scene-1", "summary"],
		false,
	);
	assert.deepEqual(withSceneValue.sessions["session-1"].scenes["scene-1"], {
		included: true,
		summary: false,
		goal: true,
		stakes: true,
		location: true,
		notes: true,
		encounter: true,
	});
	const withDisabledList = updateContextListIncluded(
		{},
		"campaignNpcs",
		false,
	);
	assert.equal(withDisabledList.campaignNpcs.included, false);
	const withSelectedNpc = updateContextListItem(
		withDisabledList,
		"campaignNpcs",
		"npc-1",
		true,
	);
	assert.equal(withSelectedNpc.campaignNpcs.items["npc-1"], true);
	const withAllNpcs = setAllContextListItems(
		withSelectedNpc,
		"campaignNpcs",
		[{ id: "npc-1" }, { id: "npc-2" }],
		(item) => item.id,
		false,
	);
	assert.deepEqual(withAllNpcs.campaignNpcs, {
		included: true,
		items: { "npc-1": false, "npc-2": false },
	});
	const initialSessionContext = createInitialAiContextConfig("session-1");
	assert.equal(initialSessionContext.sessions["session-1"].included, true);
	assert.equal(initialSessionContext.sessions["session-1"].result_text, true);
	const loadedSessionContext = mergeLoadedAiSessionData(initialSessionContext, [
		["session-1", initialSessionContext.sessions["session-1"], { name: "One" }],
	]);
	assert.deepEqual(loadedSessionContext.sessions["session-1"].data, {
		name: "One",
	});
	assert.equal(
		mergeLoadedAiSessionData(loadedSessionContext, [
			["session-1", {}, { name: "Replacement" }],
		]),
		loadedSessionContext,
	);
	const campaignEstimate = buildAiTokenEstimate({
		activeCampaignBasePrompt: "Campaign",
		attachedFiles: [{ name: "notes.md", sizeBytes: 8 }],
		attachedImages: [{ name: "map.png", url: "/map.png" }],
		characterContext: { included: true, items: { hidden: false } },
		charactersList: [
			{ id: "visible", name: "Visible" },
			{ id: "hidden", name: "Hidden" },
		],
		contextConfig: {
			campaignNotes: true,
			sessions: {},
		},
		currentLanguage: "uk",
		globalAiBasePrompt: "Global",
		isCampaign: true,
		locationContext: { included: true, items: {} },
		npcContext: { included: true, items: {} },
		parseAIResponse: true,
		sessionData: { name: "Campaign", notes: [] },
		useContext: true,
		getCharacterKey: (entity) => entity.id,
		getLocationKey: (entity) => entity.id,
	});
	assert.equal(campaignEstimate.imageTokens, 260);
	assert.equal(campaignEstimate.fileTokens, 2);
	assert.equal(campaignEstimate.total > campaignEstimate.imageTokens, true);
	const bestiaryEstimate = buildAiTokenEstimate({
		attachedFiles: [],
		attachedImages: [],
		contextConfig: { sessions: {} },
		isBestiary: true,
		getCharacterKey: () => "",
		getLocationKey: () => "",
	});
	assert.equal(bestiaryEstimate.total >= 2200, true);
	const monsterList = [{ name: "Mavka" }];
	assert.equal(normalizeCustomMonsterCollection({ monster: monsterList }), monsterList);
	assert.equal(
		normalizeCustomMonsterCollection({ monsters: monsterList }),
		monsterList,
	);
	assert.deepEqual(normalizeCustomMonsterCollection({ monster: null }), []);
	assert.deepEqual(
		buildNpcImageTarget(
			{
				id: "npc-1",
				race: "Human",
				notes: [{ title: "Visible", text: "Portrait details" }],
			},
			{ displayName: "Iryna", scope: "campaign" },
		),
		{
			type: "npc",
			id: "npc-1",
			name: "Iryna",
			race: "Human",
			class: "",
			level: "",
			description: "",
			motivation: "",
			trait: "",
			notes: ["Visible\nPortrait details"],
			scope: "campaign",
		},
	);
	assert.equal(
		getSupportedAiImageMimeType({ name: "portrait.WEBP", type: "" }),
		"image/webp",
	);
	assert.equal(
		getSupportedAiFileMimeType({ name: "notes.unknown", type: "text/plain" }),
		"text/plain",
	);
	assert.equal(
		getSupportedAiFileMimeType({ name: "payload.exe", type: "application/octet-stream" }),
		"",
	);
	assert.equal(
		getAttachedImageKey({ name: "map.png", sizeBytes: 42, url: "/map.png" }),
		"/map.png",
	);
	assert.equal(getAttachedFileKey({ name: "notes.md", sizeBytes: 8 }), "notes.md:8");
	const sceneImageTarget = buildSceneImageTarget(
		{
			id: "scene-1",
			encounterId: "encounter-1",
			_imagePromptEncounters: [
				{
					id: "encounter-1",
					name: "Ambush",
					monsters: [{ name: "Goblin" }],
				},
			],
		},
		{ title: "Forest road" },
	);
	assert.deepEqual(sceneImageTarget.encounter, {
		name: "Ambush",
		monsters: ["Goblin"],
	});
	const monsterImageTarget = buildCustomMonsterImageTarget({
		name: "Ash Drake",
		str: 18,
		action: [{ name: "Bite" }],
	});
	assert.equal(monsterImageTarget.source, "CUSTOM");
	assert.equal(monsterImageTarget.abilities.str, 18);
	assert.equal(monsterImageTarget.actions[0].name, "Bite");
});

await run("AI assistant delegates stable visual composition to feature UI", async () => {
	const panelSource = await fs.readFile(
		"src/widgets/ai-assistant/ui/AiAssistantPanel.jsx",
		"utf8",
	);
	const shellSource = await fs.readFile(
		"src/features/ai/ui/AiAssistantShell.tsx",
		"utf8",
	);
	const promptSource = await fs.readFile(
		"src/features/ai/ui/AiPromptComposer.tsx",
		"utf8",
	);
	const responseSource = await fs.readFile(
		"src/features/ai/ui/AiHistoryResponseDialog.tsx",
		"utf8",
	);
	const toolbarSource = await fs.readFile(
		"src/features/ai/ui/AiAssistantToolbar.tsx",
		"utf8",
	);
	const contextSource = await fs.readFile(
		"src/features/ai/ui/AiContextSettingsModal.tsx",
		"utf8",
	);

	assert.match(panelSource, /<AiAssistantShell/);
	assert.match(panelSource, /<AiPromptComposer/);
	assert.match(panelSource, /<AiHistoryResponseDialog/);
	assert.doesNotMatch(panelSource, /className="AiAssistant__prompt_area"/);
	assert.doesNotMatch(panelSource, /<AiResponseModal/);
	assert.match(shellSource, /className="AiAssistant__toggle"/);
	assert.match(promptSource, /className="AiAssistant__token_estimate"/);
	assert.match(responseSource, /onRestore\(entry, "apply"/);
	assert.match(toolbarSource, /showParsedGenerationOptions/);
	assert.match(contextSource, /CampaignEntityContext/);
	await assert.rejects(
		fs.access("src/components/ai/AiAssistantToolbar.jsx"),
		/ENOENT/,
	);
});

await run("AI attachment presentation preserves limits and validation", async () => {
	const imageKey = (attachment) =>
		attachment.url || `${attachment.name}:${attachment.sizeBytes}`;
	assert.equal(getAvailableAiAttachmentSlots(3, 4), 1);
	assert.equal(getAvailableAiAttachmentSlots(7, 4), 0);
	assert.deepEqual(
		mergeUniqueAiAttachments(
			[{ name: "map.png", sizeBytes: 10 }],
			[
				{ name: "map.png", sizeBytes: 10 },
				{ name: "token.png", sizeBytes: 20 },
			],
			imageKey,
			4,
		),
		[
			{ name: "map.png", sizeBytes: 10 },
			{ name: "token.png", sizeBytes: 20 },
		],
	);
	assert.deepEqual(removeAiAttachmentAt([{ name: "a" }, { name: "b" }], 0), [
		{ name: "b" },
	]);
	assert.equal(shouldReportAiAttachmentSelectionError(3, 2, 0), true);
	assert.equal(shouldReportAiAttachmentSelectionError(1, 2, 0), false);
	const selection = await prepareAiAttachmentSelection({
		availableSlots: 3,
		files: [
			{ name: "valid.png", size: 5, type: "image/png" },
			{ name: "large.png", size: 50, type: "image/png" },
			{ name: "broken.png", size: 5, type: "image/png" },
		],
		getMimeType: (file) => file.type,
		includePreview: true,
		maxBytes: 10,
		readBase64: async (file) => {
			if (file.name === "broken.png") throw new Error("read failed");
			return "YWJj";
		},
	});
	assert.deepEqual(selection.skippedNames, ["large.png", "broken.png"]);
	assert.equal(selection.attachments[0].previewUrl, "data:image/png;base64,YWJj");
});

await run("AI context presentation preserves session and scene defaults", () => {
	const context = createInitialAiContextConfig();
	assert.deepEqual(getAiSessionContextConfig(context, "session-1"), {
		included: false,
		notes: true,
		result_text: true,
		scenes: {},
	});
	assert.deepEqual(
		getAiSceneContextConfig(
			{ included: true, scenes: {} },
			"scene-1",
		),
		{
			included: true,
			summary: true,
			goal: true,
			stakes: true,
			location: true,
			notes: true,
			encounter: true,
		},
	);
});

await run("AI presentation policies preserve API key and prompt decisions", () => {
	assert.equal(isAiApiKeySaveDisabled("", false, false), true);
	assert.equal(isAiApiKeySaveDisabled("  ", false, false), true);
	assert.equal(isAiApiKeySaveDisabled("key", true, false), true);
	assert.equal(isAiApiKeySaveDisabled("key", false, true), true);
	assert.equal(isAiApiKeySaveDisabled("key", false, false), false);
	assert.equal(shouldSubmitAiApiKey("Enter"), true);
	assert.equal(shouldSubmitAiApiKey("Escape"), false);
	assert.deepEqual(
		getAiPromptTokenVisibility({ fileTokens: 0, imageTokens: 12 }),
		{ showFileTokens: false, showImageTokens: true },
	);
	assert.equal(hasAiResponseHistory([]), false);
	assert.equal(hasAiResponseHistory([{ id: 1 }]), true);
	assert.deepEqual(
		getAiToolbarVisibility({
			isBestiary: false,
			isCampaign: true,
			parseAIResponse: true,
		}),
		{ showCharacterGeneration: true, showParsedGenerationOptions: true },
	);
	assert.deepEqual(getAiEncounterGenerationTogglePlan(false), {
		generateCustomMonsters: null,
		generateEncounters: true,
	});
	assert.deepEqual(getAiEncounterGenerationTogglePlan(true), {
		generateCustomMonsters: false,
		generateEncounters: false,
	});
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

await run("Session editor mutations keep scenes notes and encounters consistent", () => {
	const empty = createEmptyScene("scene-1");
	let data = addSessionScene({ scenes: [], encounters: [] }, empty);
	data = updateSceneField(data, "scene-1", "title", "Gate");
	data = updateSceneField(data, "scene-1", "collapsed", true, true);
	data = updateSceneNote(data, "scene-1", "note-1", { text: "Clue" });
	data = toggleSceneNoteCollapse(data, "scene-1", "note-1");
	assert.equal(data.scenes[0].texts.title, "Gate");
	assert.equal(data.scenes[0].collapsed, true);
	assert.equal(data.scenes[0].notes[0].text, "Clue");
	assert.equal(data.scenes[0].notes[0].collapsed, true);
	assert.equal(sceneRequiresDeleteConfirmation(data.scenes[0]), true);

	data = {
		...data,
		scenes: [{ ...data.scenes[0], encounterId: "encounter-1" }],
		encounters: [
			{ id: "encounter-1", name: "Gate fight" },
			{ id: "encounter-2", name: "Keep" },
		],
	};
	data = removeSessionScene(data, "scene-1");
	assert.deepEqual(data.scenes, []);
	assert.deepEqual(data.encounters, [{ id: "encounter-2", name: "Keep" }]);
});

await run("Scene encounter command persists one linked encounter idempotently", async () => {
	let session = {
		id: "session-1",
		data: { scenes: [{ id: 7, texts: {} }], encounters: [] },
	};
	let writes = 0;
	const repository = {
		read: async () => structuredClone(session),
		write: async (_campaign, fileName, next) => {
			writes += 1;
			session = structuredClone(next);
			return { ...next, fileName };
		},
		createId: () => "encounter-stable-id",
	};
	const createSceneEncounter = createSceneEncounterCommand(repository);
	const created = await createSceneEncounter({
		campaignSlug: "demo",
		fileName: "arrival",
		sceneId: "7",
		name: "Gate fight",
	});
	assert.equal(created.created, true);
	assert.equal(created.encounter.id, "encounter-stable-id");
	assert.equal(session.data.scenes[0].encounterId, "encounter-stable-id");
	assert.deepEqual(session.data.encounters, [
		{ id: "encounter-stable-id", name: "Gate fight", monsters: [] },
	]);

	const existing = await createSceneEncounter({
		campaignSlug: "demo",
		fileName: "arrival",
		sceneId: 7,
		name: "Ignored duplicate",
	});
	assert.equal(existing.created, false);
	assert.equal(existing.encounter.id, "encounter-stable-id");
	assert.equal(writes, 1);
	const updateEncounter = createUpdateEncounterCommand(repository);
	const updated = await updateEncounter({
		campaignSlug: "demo",
		fileName: "arrival",
		encounterId: "encounter-stable-id",
		patch: { id: "changed", name: "Updated", monsters: [{ id: "monster-1" }] },
	});
	assert.equal(updated.encounter.id, "encounter-stable-id");
	assert.equal(updated.encounter.name, "Updated");
	assert.deepEqual(session.data.encounters[0].monsters, [{ id: "monster-1" }]);
	assert.equal(writes, 2);
	const addEncounterMonster = createAddEncounterMonsterCommand(repository);
	const added = await addEncounterMonster({
		campaignSlug: "demo",
		fileName: "arrival",
		encounterId: "encounter-stable-id",
		monster: { id: "monster-2", instanceId: "instance-2", name: "Goblin" },
	});
	assert.equal(added.encounter.id, "encounter-stable-id");
	assert.equal(added.monster.instanceId, "instance-2");
	assert.deepEqual(session.data.encounters[0].monsters, [
		{ id: "monster-1" },
		{ id: "monster-2", instanceId: "instance-2", name: "Goblin" },
	]);
	assert.equal(writes, 3);
	await assert.rejects(
		createSceneEncounter({
			campaignSlug: "demo",
			fileName: "arrival",
			sceneId: "missing",
			name: "Missing",
		}),
		(error) => error.status === 404,
	);
	await assert.rejects(
		updateEncounter({
			campaignSlug: "demo",
			fileName: "arrival",
			encounterId: "missing",
			patch: {},
		}),
		(error) => error.status === 404,
	);
	await assert.rejects(
		addEncounterMonster({
			campaignSlug: "demo",
			fileName: "arrival",
			encounterId: "missing",
			monster: { id: "monster-3" },
		}),
		(error) => error.status === 404,
	);
	await assert.rejects(
		addEncounterMonster({
			campaignSlug: "demo",
			fileName: "arrival",
			encounterId: "encounter-stable-id",
			monster: null,
		}),
		(error) => error.status === 400,
	);
});

await run("Session commands own CRUD rename reorder and stable ids", async () => {
	const files = new Map([
		[
			"existing",
			{ id: "session-existing", name: "Existing", order: 2, data: {} },
		],
	]);
	const repository = {
		exists: async (_campaign, fileName) => files.has(fileName),
		list: async () =>
			Array.from(files, ([fileName, session]) => ({
				id: session.id,
				name: session.name,
				order: session.order,
				fileName,
			})),
		read: async (_campaign, fileName) => structuredClone(files.get(fileName)),
		write: async (_campaign, fileName, session) => {
			files.set(fileName, structuredClone(session));
			return { ...structuredClone(session), fileName };
		},
		remove: async (_campaign, fileName) => files.delete(fileName),
		rename: async (_campaign, oldFileName, newFileName) => {
			files.set(newFileName, files.get(oldFileName));
			files.delete(oldFileName);
		},
		createId: () => "unused",
		sanitizeName: (name) => String(name || "").trim(),
		createDefault: (name) => ({ id: `id-${name}`, name, data: { scenes: [] } }),
		ensureUniqueFile: async (_campaign, name, ignored) =>
			name === "Renamed" && ignored === "existing" ? "renamed" : name.toLowerCase(),
	};
	const commands = createSessionCommands(repository, {
		now: () => new Date("2030-02-03T00:00:00.000Z"),
	});
	const created = await commands.create({ campaignSlug: "demo", payload: {} });
	assert.equal(created.name, "2030-02-03");
	assert.equal(created.order, 3);
	assert.equal(created.fileName, "2030-02-03");

	const updated = await commands.update({
		campaignSlug: "demo",
		fileName: "existing",
		patch: { id: "changed", name: " Renamed ", data: { scenes: [1] } },
	});
	assert.equal(updated.id, "session-existing");
	assert.equal(updated.fileName, "renamed");
	assert.equal(files.has("existing"), false);
	await commands.reorder({
		campaignSlug: "demo",
		orders: { renamed: 0, "2030-02-03": 1 },
	});
	assert.equal(files.get("renamed").order, 0);
	assert.equal(files.get("2030-02-03").order, 1);
	await commands.remove({ campaignSlug: "demo", fileName: "renamed" });
	assert.equal(files.has("renamed"), false);
	await assert.rejects(
		commands.get({ campaignSlug: "demo", fileName: "missing" }),
		(error) => error.status === 404,
	);
	await assert.rejects(
		commands.reorder({ campaignSlug: "demo", orders: null }),
		(error) => error.status === 400,
	);
});

await run("Settings commands delegate normalized repository reads and patches", async () => {
	let settings = { language: "uk", theme: "light" };
	const calls = [];
	const commands = createSettingsCommands({
		read: async () => structuredClone(settings),
		update: async (patch) => {
			calls.push(structuredClone(patch));
			settings = { ...settings, ...patch };
			return structuredClone(settings);
		},
	});
	assert.deepEqual(await commands.get(), settings);
	assert.deepEqual(
		await commands.update({ patch: { theme: "dark" } }),
		{ language: "uk", theme: "dark" },
	);
	await commands.update({ patch: ["invalid"] });
	assert.deepEqual(calls, [{ theme: "dark" }, {}]);
});

await run("Image commands parse gallery queries and delegate reference-safe mutations", async () => {
	const calls = [];
	const repository = Object.fromEntries(
		[
			"list",
			"stats",
			"listBestiaryTokens",
			"search",
			"listSubcategories",
			"createSubcategory",
			"renameImage",
			"renameSubcategory",
			"move",
			"delete",
		].map((method) => [
			method,
			async (...args) => {
				calls.push([method, ...args]);
				return method === "move" ? [{ oldUrl: "old", newUrl: "new" }] : [];
			},
		]),
	);
	const commands = createImageCommands(repository);
	assert.deepEqual(
		parseGalleryQuery(
			{
				categories: " maps, tokens, ",
				ignoreSources: " phb, xge ",
			},
			"general",
		),
		{
			source: "general",
			category: "",
			subcategory: "",
			categories: ["maps", "tokens"],
			ignoreSourcesList: ["phb", "xge"],
		},
	);
	await commands.stats({
		query: { source: "demo", categories: "maps,tokens" },
	});
	await commands.listBestiaryTokens({
		query: {
			subcategory: "MM",
			search: "dragon",
			recursive: "1",
			ignoreSources: "UA,HB",
		},
	});
	await commands.createSubcategory({
		slug: "demo",
		category: "maps",
		name: "dungeon",
	});
	assert.deepEqual(await commands.move({ items: ["a.png"], src: {}, dest: {} }), [
		{ oldUrl: "old", newUrl: "new" },
	]);
	assert.deepEqual(await commands.delete({ items: [], src: {} }), { ok: true });
	assert.deepEqual(calls[0], [
		"stats",
		{
			source: "demo",
			category: "",
			subcategory: "",
			categories: ["maps", "tokens"],
			ignoreSourcesList: [],
		},
	]);
	assert.deepEqual(calls[1], [
		"listBestiaryTokens",
		{
			subcategory: "MM",
			search: "dragon",
			recursive: true,
			ignoreSourcesList: ["UA", "HB"],
		},
	]);
	assert.deepEqual(calls[2], [
		"createSubcategory",
		{ slug: "demo", category: "maps", subcategory: "dungeon" },
	]);
});

await run("Encounter participant synchronization preserves combat-local identity and HP", () => {
	const official = { instanceId: "official", name: "Goblin", source: "MM" };
	const character = {
		instanceId: "character",
		name: "Hero",
		participantType: "character",
	};
	const custom = {
		instanceId: "custom-1",
		name: "Named Sentinel",
		originalBestiaryName: "Sentinel",
		source: "custom",
		currentHp: 18,
		hit_points: 30,
	};
	const result = synchronizeCustomMonsterParticipants(
		{ id: "enc", monsters: [official, character, custom] },
		{
			monster: [
				{
					name: "Sentinel",
					source: "",
					hp: { average: 12 },
					ac: [{ ac: 17 }],
					trait: [{ name: "Updated" }],
				},
			],
		},
	);
	assert.equal(result.changed, true);
	assert.equal(result.encounter.monsters[0], official);
	assert.equal(result.encounter.monsters[1], character);
	assert.equal(result.encounter.monsters[2].instanceId, "custom-1");
	assert.equal(result.encounter.monsters[2].name, "Named Sentinel");
	assert.equal(result.encounter.monsters[2].currentHp, 12);
	assert.equal(result.encounter.monsters[2].hit_points, 12);
	assert.equal(result.encounter.monsters[2].armor_class, 17);
	assert.equal(result.encounter.monsters[2].source, "CUSTOM");

	const images = buildEntityImageMap([
		{ firstName: "Iryna", lastName: "Vale", imageUrl: "/iryna.png" },
		{ name: "  Iryna   Vale ", imageUrl: "/duplicate.png" },
	]);
	assert.equal(images.get("iryna vale"), "/iryna.png");
});

await run("encounter add-monster targets normalize active campaign sessions", () => {
	const campaigns = normalizeActiveEncounterCampaigns([
		{ slug: "active", name: "Активна", completed: false },
		{ slug: "done", name: "Done", completed: true },
		{ slug: 1, name: "Invalid" },
	]);
	assert.deepEqual(campaigns.map((campaign) => campaign.slug), ["active"]);
	assert.deepEqual(
		normalizeEncounterSessionSummaries([
			{ fileName: "one.json", name: "One" },
			{ fileName: null, name: "Invalid" },
		]),
		[{ fileName: "one.json", name: "One" }],
	);

	const group = buildEncounterTargetCampaignGroup(campaigns[0], [
		{
			fileName: "one.json",
			name: "Session One",
			data: {
				encounters: [
					{ id: 7, name: "Bridge" },
					{ id: null, name: "Invalid" },
				],
			},
		},
		{ fileName: "empty.json", name: "Empty", data: { encounters: [] } },
	]);
	assert.equal(group.sessions.length, 1);
	assert.deepEqual(group.sessions[0].encounters, [{ id: 7, name: "Bridge" }]);
	assert.equal(createEncounterTargetId("active", "one.json", 7), "active:one.json:7");
});

await run("encounter initiative metrics support fractional and structured challenge ratings", () => {
	assert.equal(parseChallengeRating({ cr: "1/2" }), 0.5);
	assert.equal(parseChallengeRating({ cr: { cr: "4" } }), 4);
	assert.deepEqual(
		calculateInitiativeStats([
			{ dex: 14, cr: "1/2" },
			{ dexterity: 10, cr: { cr: "4" } },
		]),
		{ average: "11.5", max: "12.5", weightedAverage: "11.0" },
	);
});

await run("session entity normalization strips internal fields and preserves supported state", () => {
	const npc = normalizeSessionEntity("npc", {
		id: 7,
		name: "Ірина",
		_hidden: "remove",
		_aiIgnored: true,
		notes: [{ id: 1 }],
	});
	assert.equal(npc.id, 7);
	assert.equal(npc.firstName, "Ірина");
	assert.equal(npc._hidden, undefined);
	assert.equal(npc._aiIgnored, true);
	assert.deepEqual(npc.notes, [{ id: 1 }]);
	assert.equal(getSessionEntityDisplayName("npc", npc), "Ірина");

	const location = normalizeSessionEntity("locations", { title: "Брама" });
	assert.equal(location.name, "Брама");
	assert.equal(location.imageUrl, null);
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
		({ CharacterCardModel } =
			await import("../src/entities/campaign/index.js"));
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

await run("campaign entity card policies preserve collapse, identity, highlights, and drafts", () => {
	const notes = [
		{ id: "n1", title: "Таємниця", text: "Прихований хід", collapsed: false },
	];
	assert.deepEqual(
		getCharacterCardPresentation(
			{ firstName: "Ірина", notes, collapsed: true, isNotesCollapsed: true },
			notes,
			"card",
			true,
		),
		{
			hasNotesData: true,
			hasCardData: true,
			canCollapseCard: true,
			isCollapsed: true,
			isNotesCollapsed: true,
		},
	);
	assert.equal(
		getLocationCardPresentation({ name: "Брама", collapsed: true }, [], "modal", true).isCollapsed,
		false,
	);
	assert.equal(getCharacterDisplayName({ firstName: "Ірина", lastName: "Срібна" }), "Ірина Срібна");
	assert.equal(getLocationDisplayName({ title: "Стара вежа" }), "Стара вежа");
	const highlights = { fields: ["description"], notes: { n1: ["text"] } };
	assert.equal(getCampaignEntityFieldClass(highlights, "description"), "is_ai_changed_field");
	assert.deepEqual(getCampaignNoteHighlightFields(highlights, notes[0]), ["text"]);
	assert.equal(setCampaignNoteAiIgnored(notes, "n1", true)[0]._aiIgnored, true);

	const characterDraft = createCharacterDraft("npc", 100);
	assert.equal(characterDraft.id, "new-npc-100");
	assert.equal(characterDraft.notes[0].id, 101);
	assert.equal(isCharacterDraftValid(characterDraft), false);
	assert.equal(isCharacterDraftValid({ firstName: "  Лада  " }), true);
	const locationDraft = createLocationDraft(200);
	assert.equal(locationDraft.id, "new-locations-200");
	assert.equal(isLocationDraftValid(locationDraft), false);
	assert.equal(isLocationDraftValid({ name: "Міст" }), true);
});

await run("CardNoteModel shared helpers preserve entity note behavior", async () => {
	const { CardNoteModel } = await import("../src/entities/campaign/index.js");

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
	const { requestMentionSelection } = await import("../src/features/editor/model.js");

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
		"../src/features/entity-link/model.js"
	);
	const { getEntityIdentity } = await import(
		"../src/features/entity-link/model.js"
	);
	const { getEntityModalPresentation } = await import(
		"../src/features/entity-link/model.js"
	);

	assert.deepEqual(getEntityModalPresentation("locations"), {
		titleKind: "location",
		modalType: "location",
		className: "EntityLinkModal__location",
	});
	assert.deepEqual(getEntityModalPresentation("npc"), {
		titleKind: "npc",
		modalType: "character",
		className: "",
	});
	assert.deepEqual(getEntityModalPresentation("characters"), {
		titleKind: "character",
		modalType: "character",
		className: "",
	});

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

await run("Bestiary commands own custom monsters favorites and search", async () => {
	let monsters = [
		{
			id: "custom-1",
			name: "Sentinel",
			source: "CUSTOM",
			imageUrl: "/token.png",
			hp: { average: "12" },
		},
		{ id: "custom-2", name: "Other", source: "CUSTOM" },
	];
	let favorites = [{ name: "Sentinel", source: "custom" }];
	const repository = {
		getIndex: async () =>
			new Map([
				["goblin|mm", { name: "Goblin", source: "MM", type: "humanoid" }],
				["goblin boss|mm", { name: "Goblin Boss", source: "MM", type: "humanoid" }],
			]),
		readCustomMonsters: async () => structuredClone(monsters),
		writeCustomMonsters: async (next) => {
			monsters = structuredClone(next);
			return structuredClone(monsters);
		},
		readFavorites: async () => structuredClone(favorites),
		writeFavorites: async (next) => {
			favorites = structuredClone(next);
			return structuredClone(favorites);
		},
		readAllMonsters: async () => ({
			exists: true,
			monsters: [
				{ name: "Wolf", source: "MM" },
				{ name: "Mage", source: "XGE" },
			],
		}),
		listSourceFiles: async () => ["fallback"],
		readLegendaryGroups: async () => [
			{ name: "Base", source: "MM", lairActions: ["Base action"] },
			{
				name: "Child",
				source: "MM",
				_copy: {
					name: "Base",
					source: "MM",
					_mod: {
						lairActions: { mode: "appendArr", items: ["Child action"] },
					},
				},
			},
		],
		readSourceMonsters: async (source) =>
			source === "phb"
				? { fileSource: "phb", monsters: [{ name: "Guard" }] }
				: null,
	};
	const commands = createBestiaryCommands(repository);
	assert.deepEqual(
		(await commands.search({ name: "goblin", type: "human" })).map(
			(monster) => monster.name,
		),
		["Goblin", "Goblin Boss"],
	);
	assert.deepEqual(await commands.listSources(), ["CUSTOM", "MM", "XGE"]);
	assert.deepEqual(await commands.getSource({ source: "phb" }), [
		{ name: "Guard", source: "PHB" },
	]);
	assert.deepEqual(await commands.getSource({ source: "mm" }), [
		{ name: "Wolf", source: "MM" },
	]);
	const legendaryGroups = await commands.listLegendaryGroups();
	assert.deepEqual(legendaryGroups[1].lairActions, [
		"Base action",
		"Child action",
	]);
	assert.equal(Object.hasOwn(legendaryGroups[1], "_copy"), false);
	const renamed = await commands.updateCustom({
		identifier: "custom-1",
		payload: { monster: { id: "custom-1", name: "Guardian", hp: { average: "18" } } },
	});
	assert.equal(renamed.name, "Guardian");
	assert.equal(renamed.imageUrl, "/token.png");
	assert.equal(renamed.hp.average, "18");
	assert.deepEqual(favorites, [{ name: "Guardian", source: "CUSTOM" }]);
	await assert.rejects(
		commands.updateCustom({
			identifier: "Guardian",
			payload: { monster: { name: "Other" } },
		}),
		(error) => error.status === 409,
	);
	await commands.toggleFavorite({ name: "Guardian", source: "custom" });
	assert.deepEqual(favorites, []);
	await commands.toggleFavorite({ name: "Other", source: "custom" });
	assert.deepEqual(favorites, [{ name: "Other", source: "CUSTOM" }]);
	await commands.deleteCustom({ identifier: "custom-2" });
	assert.equal(monsters.some((monster) => monster.name === "Other"), false);
	assert.deepEqual(favorites, []);
	const replaced = await commands.replaceCustom({
		monsters: [{ name: "  New One " }, null, { name: " " }],
	});
	assert.deepEqual(replaced, [{ name: "New One", source: "CUSTOM" }]);
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

await run("spells browser policies preserve references, filters, sorting, and selection", () => {
	const spells = [
		{ name: "Вогняна куля", source: "PHB", level: 3, school: "V", classes: ["Wizard"], entries: ["полум'я"] },
		{ name: "Світло", source: "XPHB", level: 0, school: "E", classes: ["Cleric", "Wizard"] },
		{ name: "Щит", source: "PHB", level: 1, school: "A", classes: ["Wizard"] },
	];
	assert.deepEqual(parseSpellReferenceKey("Щит|PHB"), { name: "Щит", source: "PHB" });
	assert.equal(spellMatchesReferenceKey(spells[2], "Щит|PHB"), true);
	assert.equal(findSpellByReference(spells, "Щит|PHB"), spells[2]);
	assert.equal(getSpellListIndex(spells, spells[1]), 1);
	assert.equal(getSpellItemKey(spells[0]), "PHB:Вогняна куля");
	assert.deepEqual(getSpellClassOptions(spells), ["Cleric", "Wizard"]);
	assert.deepEqual(getSpellSchoolOptions(spells), ["A", "E", "V"]);
	assert.deepEqual(sortSpells(spells, "asc").map((spell) => spell.name), ["Світло", "Щит", "Вогняна куля"]);
	assert.equal(getNextSpellSortOrder("none"), "desc");
	assert.equal(getNextSpellSortOrder("desc"), "asc");
	assert.equal(getNextSpellSortOrder("asc"), "none");
	assert.deepEqual(
		filterSpells(spells, {
			search: "полум",
			detailedSearch: true,
			selectedLevel: "3",
			selectedClass: "Wizard",
			selectedSchool: "V",
			selectedSources: ["phb"],
			sourceFilter: "PHB",
		}, (spell, query) => JSON.stringify(spell).toLowerCase().includes(query)),
		[spells[0]],
	);
	assert.equal(getValidSourceFilter("XPHB", ["PHB"]), "all");
	assert.deepEqual(getSettingsIgnoreSources({ ignoreSourcesList: ["DMG", 4, "MM"] }), ["DMG", "MM"]);
	assert.deepEqual(normalizeSpellList([spells[0], null, { source: "PHB" }]), [spells[0]]);
	assert.deepEqual(getInitialSpellSelection([spells[2]], spells, "Світло|XPHB", null), { spell: spells[1], changed: true });
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
		"src/entities/reference/model/contentTokens.ts",
		"utf8",
	);
	const rendererSource = await fs.readFile(
		"src/features/rich-content/ui/RichContentRenderer.tsx",
		"utf8",
	);
	const presentationSource = await fs.readFile(
		"src/features/rich-content/model/richContentPresentation.ts",
		"utf8",
	);
	const rulesLinkSource = await fs.readFile(
		"src/features/rules-reference/ui/RulesLink.tsx",
		"utf8",
	);
	const rulesLinkModelSource = await fs.readFile(
		"src/features/rules-reference/model/rulesLink.ts",
		"utf8",
	);
	const rulesReferenceSource = (
		await Promise.all([
			"src/widgets/rules-reference-modal/ui/RulesReferenceModalContent.tsx",
			"src/widgets/rules-reference-modal/ui/RulesReferenceModalView.tsx",
			"src/widgets/rules-reference-modal/ui/RulesReferenceListItem.tsx",
			"src/widgets/rules-reference-modal/model/rulesReferenceModal.ts",
		].map((file) => fs.readFile(file, "utf8")))
	).join("\n");
	const monsterStatBlockSource = await fs.readFile(
		"src/widgets/monster-stat-block/ui/MonsterStatBlock.tsx",
		"utf8",
	);
	const rulesLinkCss = await fs.readFile(
		"src/assets/components/RulesLink.css",
		"utf8",
	);

	assert.match(contentTokensSource, /\{@dice\\s\+/);
	assert.match(contentTokensSource, /\{@creature\\s\+/);
	assert.match(rendererSource, /getContentTokenRenderPlan/);
	assert.match(rendererSource, /plan\.referenceType/);
	assert.match(presentationSource, /disableNonRechargeRolls/);
	assert.match(presentationSource, /const displayHit/);
	assert.match(presentationSource, /function addFallbackTaggedSource/);
	assert.match(presentationSource, /creatureSourceFallback/);
	assert.doesNotMatch(rendererSource, /onNavigate=\{options\.onRuleNavigate\}/);
	assert.doesNotMatch(rendererSource, /onRuleNavigate/);
	assert.match(monsterStatBlockSource, /creatureSourceFallback: source/);
	assert.match(monsterStatBlockSource, /referenceRenderOptions/);
	assert.match(monsterStatBlockSource, /renderActionName/);
	assert.match(monsterStatBlockSource, /disableNonRechargeRolls: true/);
	assert.doesNotMatch(monsterStatBlockSource, /<strong>\{renderContent\(action\.name\)\}\.<\/strong>/);
	assert.match(rulesLinkSource, /resolveRulesLinkNavigation/);
	assert.match(rulesLinkModelSource, /extractContentTokens/);
	assert.match(rulesLinkSource, /<RollDice/);
	assert.match(rulesLinkModelSource, /type:\s*"recharge"/);
	assert.match(rulesLinkSource, /requestRulesReferenceNavigation\(target\.tab, target\.name\)/);
	assert.match(rulesLinkModelSource, /function getCreatureReferenceName/);
	assert.doesNotMatch(rulesLinkSource, /onNavigate/);
	assert.doesNotMatch(rulesReferenceSource, /import Bestiary from/);
	assert.match(
		rulesReferenceSource,
		/import \{ MonsterStatBlock \} from "\.\.\/\.\.\/monster-stat-block\/index\.js"/,
	);
	assert.match(rulesReferenceSource, /bestiaryApi/);
	assert.match(rulesReferenceSource, /MonsterStatBlockModel/);
	assert.match(rulesReferenceSource, /id: "bestiary"/);
	assert.match(rulesReferenceSource, /bestiaryApi\.getBestiaryData\("all"\)/);
	assert.match(rulesReferenceSource, /spellApi\.getSpellData\("all"\)/);
	assert.doesNotMatch(rulesReferenceSource, /<Bestiary(?:\s|\/|>)/);
	assert.match(rulesReferenceSource, /<MonsterStatBlock/);
	assert.match(rulesReferenceSource, /Bestiary__item_token/);
	assert.match(rulesReferenceSource, /getCreatureReferenceMatchRank/);
	assert.doesNotMatch(rulesReferenceSource, new RegExp("is" + "Embedded"));
	assert.match(rulesReferenceSource, /renderRecursiveContent\(selectedItem\.entries/);
	assert.doesNotMatch(rulesReferenceSource, /onRuleNavigate/);
	assert.match(rulesLinkCss, /\.RulesLink__creature/);
});

await run("rich-content token plans preserve interactive rendering rules", () => {
	const token = (overrides = {}) => ({
		fullMatch: "raw",
		damageRoll: "",
		damageRemainder: "",
		hitSuffix: "",
		...overrides,
	});

	assert.deepEqual(
		getContentTokenRenderPlan(
			token({ fullMatch: "{@recharge 5}", recharge: "(Recharge 5-6)" }),
		),
		{
			kind: "roll",
			formula: "1d6",
			displayText: "(Recharge 5-6)",
			keyPrefix: "re",
			context: {
				type: "recharge",
				threshold: 5,
				label: "(Recharge 5-6)",
			},
		},
	);
	assert.deepEqual(
		getContentTokenRenderPlan(
			token({ fullMatch: "{@hit 7}", hit: "7", hitSuffix: " to hit" }),
			{ disableNonRechargeRolls: true },
		),
		{ kind: "text", text: "7 to hit", keyPrefix: "h" },
	);
	assert.deepEqual(
		getContentTokenRenderPlan(
			token({
				fullMatch: "{@creature goblin||Goblin}",
				creatureTag: "{@creature goblin||Goblin}",
				creatureValue: "goblin||Goblin",
			}),
			{ creatureSourceFallback: "MM" },
		),
		{
			kind: "reference",
			referenceType: "creature",
			keyPrefix: "c",
			name: "goblin|MM|Goblin",
			displayText: "Goblin",
		},
	);
	assert.equal(addFallbackTaggedSource("goblin||Goblin", "MM"), "goblin|MM|Goblin");
	assert.deepEqual(parseQuickrefName("cover||3||total cover"), {
		name: "Total Cover",
		displayText: "Total Cover",
	});
	assert.equal(
		stripNotesReferenceText('Текст (see the “Rule” in notes). Далі'),
		"Текст Далі",
	);
});

await run("parser renders item filter display names", () => {
	assert.equal(
		preprocessTags(
			"If you wear {@filter Light|items|type=Light Armor}, {@filter Medium|items|type=Medium Armor}, or {@filter Heavy|items|type=Heavy Armor} armor and lack training",
		),
		"If you wear Light, Medium, or Heavy armor and lack training",
	);
});

await run("monster stat block presentation policies normalize source variants", async () => {
	assert.equal(getChangedFieldClass({ fields: ["name", "опис"] }, ["опис"]), "is_ai_changed_field");
	assert.equal(getChangedFieldClass({ fields: ["name"] }, ["source"]), "");
	assert.deepEqual(getSenseTextParts("darkvision 60 ft., passive Perception"), [
		{ kind: "reference", name: "darkvision" },
		{ kind: "text", text: " 60 ft., passive Perception" },
	]);
	assert.equal(getMonsterSpellSlug("/api/spells/fireball/"), "fireball");
	assert.equal(getMonsterSpellSlug(null), "");

	const cache = new Map();
	let searches = 0;
	const searchSpells = async ({ name }) => {
		searches += 1;
		return name === "fireball"
			? [{ name: "Fireball", slug: "fireball", level_int: 3 }]
			: null;
	};
	assert.deepEqual(
		await loadMonsterSpells(
			["/api/spells/fireball", "", "/api/spells/missing"],
			searchSpells,
			cache,
		),
		[{ name: "Fireball", slug: "fireball", level_int: 3 }],
	);
	assert.deepEqual(await loadMonsterSpells(["/api/spells/fireball"], searchSpells, cache), [
		{ name: "Fireball", slug: "fireball", level_int: 3 },
	]);
	assert.equal(searches, 2);
	assert.deepEqual(groupMonsterSpellsByLevel([
		{ name: "Fireball", level_int: 3 },
		{ name: "Light", level: 0 },
	]), [
		{ level: "0", spells: [{ name: "Light", level: 0 }] },
		{ level: "3", spells: [{ name: "Fireball", level_int: 3 }] },
	]);

	assert.deepEqual(getMonsterSpellcastingEntries([{ name: "Innate", daily: { "1": ["fireball"] }, spells: { "3": { slots: 2, spells: ["fireball"] } } }]), [
		{ name: "Innate", headerEntries: undefined, footerEntries: undefined, will: undefined, daily: { "1": ["fireball"] }, spells: { "3": { slots: 2, spells: ["fireball"] } } },
	]);
	const monster = { id: "custom-1", name: "Вартовий", source: "CUSTOM", imageUrl: "/custom.webp" };
	assert.deepEqual(getMonsterTokenSources(monster, "", null, "/local.webp", "/external.webp"), {
		customTokenSrc: "/custom.webp",
		localSrc: "/custom.webp",
		externalSrc: "/custom.webp",
		isCustomMonster: true,
	});
	assert.equal(shouldShowMonsterTokenDropzone({ allowTokenUpload: true, hasImageError: false, isReplacingToken: false, localSrc: "", isCustomMonster: true, hasTokenImageChange: false }), true);
	assert.equal(shouldShowMonsterTokenDropzone({ allowTokenUpload: false, hasImageError: true, isReplacingToken: true, localSrc: "", isCustomMonster: true, hasTokenImageChange: true }), false);
	assert.equal(getUploadedTokenUrl({ url: "/next.webp" }), "/next.webp");
	assert.equal(getUploadedTokenUrl({ url: 3 }), "");
	assert.equal(getMonsterMutationKey(monster, "Вартовий"), "custom-1");
	assert.deepEqual(getTokenDragPayload("/external.webp", "Вартовий", "Guardian"), {
		uri: "/external.webp",
		html: '<img src="/external.webp" alt="Вартовий">',
		downloadUrl: "image/webp:Guardian.webp:/external.webp",
	});
});

await run("Bestiary browser policies preserve identity filtering and custom imports", () => {
	const goblin = { name: "Goblin", source: "MM", cr: "1/4" };
	const dragon = { name: "Дракон", source: "CUSTOM", cr: { cr: "5" } };
	const reference = parseMonsterReference("goblin|MM");

	assert.deepEqual(reference, { name: "goblin", source: "MM" });
	assert.equal(monsterMatchesReference(goblin, reference), true);
	assert.equal(
		isSameMonsterIdentity(dragon, { name: " дракон ", source: "custom" }),
		true,
	);
	assert.deepEqual(
		getMonsterListFromResponse({ monsters: [goblin, null, { source: "MM" }] }),
		[goblin],
	);
	assert.deepEqual(sortBestiaryMonsters([dragon, goblin], "asc"), [
		goblin,
		dragon,
	]);
	assert.deepEqual(
		filterBestiaryMonsters([goblin, dragon], {
			selectedSources: ["MM", "CUSTOM"],
			sourceFilter: "CUSTOM",
			onlyFavorites: true,
			favorites: [{ name: "Дракон", source: "custom" }],
			search: "дра",
			isDetailedSearch: false,
			matchesDetailedSearch: () => false,
			matchesSimpleSearch: (monster, search) =>
				monster.name.toLowerCase().includes(search),
		}),
		[dragon],
	);
	assert.equal(getNextBestiarySortOrder("none"), "desc");
	assert.equal(getNextBestiarySortOrder("desc"), "asc");
	assert.equal(getNextBestiarySortOrder("asc"), "none");
	assert.deepEqual(
		getBestiarySourceCodes(["MM", { source: "XPHB" }, null, { nope: true }]),
		["MM", "XPHB"],
	);
	assert.deepEqual(
		parseBestiarySyncEvent({
			version: 7,
			resource: "custom-bestiary",
			monsterName: "Дракон",
		}),
		{ version: 7, resource: "custom-bestiary", monsterName: "Дракон", monsterSource: undefined },
	);
	assert.equal(parseBestiarySyncEvent({ resource: "bestiary" }), null);
	assert.deepEqual(
		getBestiarySelectionPlan([goblin, dragon], [goblin, dragon], reference, null, true),
		{ monster: goblin, explicit: true },
	);

	const generated = { name: "Виверна", source: "CUSTOM" };
	const updatePlan = getCustomBestiaryUpdatePlan(
		{ monsters: [dragon, generated] },
		{ generated: { monsters: [{ ...generated, imageUrl: "/draft.png" }] } },
	);
	assert.equal(updatePlan.trackUndo, true);
	assert.equal(updatePlan.nextSelectedMonster, generated);
	assert.equal(
		getCustomRefreshSelection([dragon], { name: "Дракон", source: "CUSTOM" }, null),
		dragon,
	);
	assert.deepEqual(
		getAiMonsterInstructionPlan("create-based", "  сильніший  ", "Створи копію"),
		{ error: null, instructions: "Створи копію\n\nсильніший" },
	);
	assert.deepEqual(
		getCreateBasedMonsterPlan(
			[dragon],
			{ name: "Виверна", source: "MM" },
			{ name: "Виверна", source: "MM", imageUrl: "/token.webp" },
			"/fallback.webp",
		),
		{
			duplicate: false,
			normalizedName: "виверна",
			monster: { name: "Виверна", source: "CUSTOM", imageUrl: "/token.webp" },
		},
	);
	assert.deepEqual(
		preserveAiDraftResourceMetadata(
			[{ id: "monster-1", after: { name: "Виверна" } }],
			[{
				id: "monster-1",
				after: {
					name: "Виверна",
					imageUrl: "/token.webp",
					originalBestiaryName: "Wyvern",
				},
			}],
		),
		[{
			id: "monster-1",
			after: {
				name: "Виверна",
				imageUrl: "/token.webp",
				originalBestiaryName: "Wyvern",
			},
		}],
	);

	const imported = parseImportedCustomMonsters(
		JSON.stringify({ monster: [{ name: "  Дракон  ", source: "MM", hp: 42 }] }),
	);
	assert.deepEqual(imported, [
		{ name: "Дракон", source: "CUSTOM", hp: 42 },
	]);
	assert.deepEqual(
		mergeImportedCustomMonsters(
			[dragon, { name: "Огр", source: "CUSTOM" }],
			imported,
		),
		[imported[0], { name: "Огр", source: "CUSTOM" }],
	);
});

await run("rules reference modal policies preserve qualified identities and UTF-8 tags", () => {
	assert.equal(REFERENCE_TAB_POLICIES.length, 7);
	assert.equal(getInitialTabId("bestiary"), "bestiary");
	assert.equal(getInitialTabId("unknown"), "conditions");
	assert.deepEqual(
		combineBestiaryLists(
			{ monsters: [{ name: "Вовк", source: "MM" }] },
			{ results: [{ name: "Мавка", source: "CUSTOM" }] },
		).map((item) => item.name),
		["Вовк", "Мавка"],
	);
	assert.equal(
		getReferenceInlineTag("conditions", { name: "Отруєний" }),
		"{@condition Отруєний}",
	);
	assert.equal(
		getReferenceInlineTag("conditions", { name: "Захоплений", kind: "status" }),
		"{@status Захоплений}",
	);
	assert.equal(
		getReferenceInlineTag("spells", { name: "Вогняна куля", source: "PHB" }),
		"{@spell Вогняна куля|PHB}",
	);
	assert.equal(
		createReferenceSelection("bestiary", { name: "Дракон", source: "MM" }).tag,
		"{@creature Дракон|MM}",
	);
	const creatures = [
		{ name: "Дракон", source: "XMM" },
		{ name: "Дракон", source: "MM" },
	];
	assert.equal(findSelectedReferenceItem("bestiary", creatures, "Дракон|MM"), creatures[1]);
	assert.equal(findSelectedReferenceItem("bestiary", creatures, "Дракон"), creatures[0]);
	const diseasePolicy = REFERENCE_TAB_POLICIES.find((tab) => tab.id === "diseases");
	assert.equal(itemMatchesQuery(diseasePolicy, { name: "Сліпа гарячка", entries: ["лихоманка"] }, "лихоманка", true), true);
	assert.equal(itemMatchesQuery(diseasePolicy, { name: "Сліпа гарячка" }, "гаряч", false), true);
});

await run("rules reference modal owns spells and bestiary navigation", async () => {
	const embeddedPropPattern = new RegExp("is" + "Embedded");
	const mainContentSource = await fs.readFile(
		"src/app/routing/MainContent.jsx",
		"utf8",
	);
	const sidebarSource = await fs.readFile(
		"src/widgets/sidebar/ui/Sidebar.jsx",
		"utf8",
	);
	const bestiarySource = await fs.readFile(
		"src/widgets/bestiary-browser/ui/BestiaryBrowser.tsx",
		"utf8",
	);
	const bestiaryContentSource = await fs.readFile(
		"src/widgets/bestiary-browser/ui/BestiaryContent.tsx",
		"utf8",
	);
	const bestiaryModelSource = await fs.readFile(
		"src/widgets/bestiary-browser/model/bestiaryBrowser.ts",
		"utf8",
	);
	const spellsSource = await fs.readFile(
		"src/widgets/spells-browser/ui/SpellsBrowser.tsx",
		"utf8",
	);
	const rulesReferenceSource = (
		await Promise.all([
			"src/widgets/rules-reference-modal/ui/RulesReferenceModalContent.tsx",
			"src/widgets/rules-reference-modal/ui/RulesReferenceModalView.tsx",
			"src/widgets/rules-reference-modal/model/rulesReferenceModal.ts",
		].map((file) => fs.readFile(file, "utf8")))
	).join("\n");
	const rulesReferenceHostSource = await fs.readFile(
		"src/widgets/rules-reference-modal/ui/RulesReferenceModalHost.tsx",
		"utf8",
	);
	const appActionsSource = await fs.readFile(
		"src/shared/model/rulesReferenceActions.ts",
		"utf8",
	);
	const appStoreSource = [
		await fs.readFile("src/shared/model/appStore.ts", "utf8"),
		await fs.readFile("src/shared/model/workflowReducer.ts", "utf8"),
	].join("\n");
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
	assert.match(bestiaryModelSource, /normalizeMonsterName/);
	assert.match(bestiarySource, /ignoreSourcesList/);
	assert.match(bestiarySource, /selectedSources/);
	assert.match(bestiaryModelSource, /function findReferencedMonster/);
	assert.match(bestiarySource, /selectedMonsterRef\.current = plan\.monster/);
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
	assert.match(spellsSource, /getInitialSpellSelection\(displayedSpells, allSpells/);
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

await run("theme model normalizes document theme values", () => {
	assert.equal(getNextTheme(THEMES.LIGHT), THEMES.DARK);
	assert.equal(getNextTheme(THEMES.DARK), THEMES.LIGHT);
	assert.equal(getThemeToggleIcon(THEMES.LIGHT), "moon");
	assert.equal(getThemeToggleIcon(THEMES.DARK), "sun");

	const previousDocument = globalThis.document;
	const attributes = new Map();
	globalThis.document = {
		documentElement: {
			setAttribute: (name, value) => attributes.set(name, value),
		},
	};
	try {
		applyTheme(THEMES.DARK);
		assert.equal(attributes.get("data-theme"), "dark");
		applyTheme("unsupported");
		assert.equal(attributes.get("data-theme"), "light");
	} finally {
		if (previousDocument === undefined) delete globalThis.document;
		else globalThis.document = previousDocument;
	}
});

await run("settings modal model normalizes scopes, sources, and prompt saves", () => {
	const campaigns = normalizeSettingsCampaigns([
		{
			slug: "curse-of-strahd",
			name: "Прокляття Страда",
			ignoreSourcesList: ["mm", " MM ", "phb"],
		},
		{ slug: 42, name: "Invalid" },
	]);
	assert.equal(campaigns.length, 1);
	assert.deepEqual(buildCampaignIgnoreSourcesMap(campaigns), {
		"curse-of-strahd": ["MM", "PHB"],
	});
	assert.deepEqual(
		mergeContentSourceOptions(["MM", " phb ", null], ["PHB", "XPHB"]),
		["CUSTOM", "MM", "phb", "PHB", "XPHB"],
	);
	assert.equal(
		resolveSettingsScope("curse-of-strahd", null, campaigns),
		"curse-of-strahd",
	);
	assert.equal(
		resolveSettingsScope("missing", "curse-of-strahd", campaigns),
		"curse-of-strahd",
	);
	assert.equal(
		resolveSettingsScope(GLOBAL_SETTINGS_SCOPE, null, campaigns),
		GLOBAL_SETTINGS_SCOPE,
	);

	assert.deepEqual(setSettingsPromptForScope({}, "curse-of-strahd", "Dark"), {
		"curse-of-strahd": "Dark",
	});
	assert.deepEqual(
		buildPromptSettingsPayload({
			aiBasePrompt: "Concise",
			imagePromptBasePrompt: "Gothic",
			campaignAiBasePrompts: {
				"curse-of-strahd": "Political",
				empty: "   ",
			},
			campaignImagePromptBasePrompts: { "curse-of-strahd": "Fog" },
		}),
		{
			aiBasePrompt: "Concise",
			imagePromptBasePrompt: "Gothic",
			campaignAiBasePrompts: { "curse-of-strahd": "Political" },
			campaignImagePromptBasePrompts: { "curse-of-strahd": "Fog" },
		},
	);
	assert.deepEqual(normalizeSavedPromptSettings(null), {
		aiBasePrompt: "",
		imagePromptBasePrompt: DEFAULT_IMAGE_PROMPT_BASE_PROMPT,
		campaignAiBasePrompts: {},
		campaignImagePromptBasePrompts: {},
	});
	assert.deepEqual(
		normalizeSavedIgnoreSources({ ignoreSourcesList: [" phb", "PHB", "mm"] }),
		["MM", "PHB"],
	);
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
		"src/features/editor/ui/EditableField.tsx",
			"utf8",
		);
		const projectGuideSource = await fs.readFile(
			"src/app/routing/ProjectGuide.jsx",
			"utf8",
		);
		const mainContentSource = await fs.readFile(
			"src/app/routing/MainContent.jsx",
			"utf8",
		);
		const tooltipSource = await fs.readFile(
			"src/shared/ui/Tooltip.tsx",
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
			"src/features/notes/ui/NoteCard.tsx",
			"utf8",
		);
		const draggableListSource = await fs.readFile(
			"src/shared/ui/DraggableList.tsx",
			"utf8",
		);
		const aiIgnoredNoteListSource = await fs.readFile(
			"src/features/notes/ui/aiIgnoredNoteListProps.tsx",
			"utf8",
		);
		const mentionEditorSource = await fs.readFile(
			"src/features/editor/model/mentionEditor.ts",
			"utf8",
		);
		const characterCardSource = await fs.readFile(
			"src/widgets/campaign-entity-card/ui/CharacterCard.tsx",
			"utf8",
		);
		const locationCardSource = await fs.readFile(
			"src/widgets/campaign-entity-card/ui/LocationCard.tsx",
			"utf8",
		);
		const graphSource = await fs.readFile(
			"src/pages/campaign/ui/components/CampaignNotesGraph.jsx",
			"utf8",
		);
		const campaignHookSource = await fs.readFile(
			"src/pages/campaign/model/useCampaignView.ts",
			"utf8",
		);
		const sessionHookSource = await fs.readFile(
		"src/pages/session/model/useSessionView.ts",
			"utf8",
		);
		const sceneFieldsSource = await fs.readFile(
			"src/pages/session/ui/components/SceneCardFields.jsx",
			"utf8",
		);
		const mainContentCss = await fs.readFile(
			"src/assets/components/MainContent.css",
			"utf8",
		);
		const uk = JSON.parse(await fs.readFile("src/langs/uk.json", "utf8"));

		assert.match(
			editableFieldSource,
			/import \{ Button, Tooltip \} from "\.\.\/\.\.\/\.\.\/shared\/ui\/index\.js"/,
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
		assert.match(editableFieldSource, /shouldDelegateEditableHistory/);
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

await run("Backup commands own gzip payloads and import strategies", async () => {
	const calls = [];
	const repository = {
		listCampaignSlugs: async () => ["one", "two"],
		exportCampaignBundle: async (slug) => ({ meta: { slug } }),
		exportCampaignArchiveBundle: async (slug) => ({ meta: { slug } }),
		exportCampaignPartialArchiveBundle: async (slug, sections) => ({
			scope: "partial",
			slug,
			sections,
		}),
		importCampaignPartialArchiveBundle: async (...args) => {
			calls.push(["partial", ...args]);
			return { imported: true };
		},
		clearAllCampaignData: async () => calls.push(["clear"]),
		findCampaignSlugById: async (id) => (id === "existing-id" ? "existing" : null),
		importCampaignBundle: async (...args) => calls.push(["bundle", ...args]),
		importCampaignArchiveBundleWithStrategy: async (...args) =>
			calls.push(["archive", ...args]),
	};
	const commands = createBackupCommands(repository, {
		now: () => new Date("2032-06-07T08:09:10.000Z"),
	});
	const download = await commands.exportAllArchive();
	assert.equal(download.filename, "prm-full-backup-2032-06-07.prma.gz");
	const payload = parseArchivePayload(download.buffer);
	assert.equal(payload.scope, "all");
	assert.equal(payload.exportedAt, "2032-06-07T08:09:10.000Z");
	assert.equal(payload.campaigns.length, 2);

	await commands.importAll({
		payload: [
			{ meta: { id: "existing-id" } },
			{ meta: { id: "new-id" } },
		],
		strategy: "replace_by_id",
	});
	assert.deepEqual(calls.slice(0, 2), [
		[
			"bundle",
			{ meta: { id: "existing-id" } },
			{ forcedSlug: "existing", replaceExisting: true },
		],
		["bundle", { meta: { id: "new-id" } }],
	]);

	const archiveBuffer = zlib.gzipSync(
		Buffer.from(
			JSON.stringify({ campaigns: [{ meta: { id: "one" } }, { meta: { id: "two" } }] }),
			"utf8",
		),
	);
	const imported = await commands.importArchive({
		buffer: archiveBuffer,
		mode: "campaign",
		strategy: "wipe_and_replace",
	});
	assert.deepEqual(imported, { ok: true, imported: 1, strategy: "append" });
	assert.deepEqual(calls.at(-1), [
		"archive",
		{ meta: { id: "one" } },
		"append",
	]);
	await assert.rejects(
		commands.importArchive({ buffer: null }),
		(error) => error.status === 400,
	);
});

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

await run("Reference commands own spell search sources and named precedence", async () => {
	const referenceFiles = {
		"conditions.json": {
			condition: [
				{ name: "Blinded", source: "PHB", entries: ["old"] },
				{ name: "Blinded", source: "XPHB", entries: ["new"] },
			],
			status: [{ name: "Surprised", source: "PHB" }],
		},
		"diseases.json": {
			disease: [{ name: "Cackle Fever", source: "DMG", type: "disease" }],
		},
	};
	const commands = createReferenceCommands({
		readSpellAggregate: async () => ({
			exists: true,
			spells: [
				{ name: "Fire Bolt", level: 0, school: "V", source: "PHB" },
				{ name: "Fireball", level: 3, school: "V", source: "XPHB" },
			],
		}),
		readSpellIndex: async () => null,
		readSpellFile: async () => [],
		readReferenceFile: async (fileName) => referenceFiles[fileName] || null,
	});
	assert.deepEqual(
		(await commands.searchSpells({ name: "fire", school: "v" })).map(
			(spell) => spell.name,
		),
		["Fireball", "Fire Bolt"],
	);
	assert.deepEqual(await commands.listSpellSources(), ["PHB", "XPHB"]);
	const conditions = await commands.listConditions();
	assert.equal(conditions[0].name, "Blinded");
	assert.deepEqual(conditions[0].entries, ["new"]);
	assert.equal(conditions[1].kind, "status");
	assert.deepEqual(await commands.listDiseases(), [
		{
			name: "Cackle Fever",
			kind: "disease",
			source: "DMG",
			page: null,
			type: "disease",
			entries: [],
		},
	]);
	assert.deepEqual(await commands.getSpellSource({ source: "xphb" }), [
		{ name: "Fireball", level: 3, school: "V", source: "XPHB" },
	]);
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

await run("image asset locations preserve encoded paths and target presets", () => {
	assert.deepEqual(
		parseGalleryLocationFromImageUrl(
			"/api/images/кампанія/characters/герої/Ірина.png?size=small",
			"http://localhost:5173",
		),
		{
			source: "кампанія",
			category: "characters",
			subcategory: "герої",
		},
	);
	assert.equal(
		parseGalleryLocationFromImageUrl("/outside/images/token.png"),
		null,
	);
	assert.deepEqual(getImageAssetPreset("npc", "мій-світ"), {
		source: "мій-світ",
		category: "characters",
		subcategory: "npc",
	});
	assert.deepEqual(
		resolveImageAssetLocation({ target: "attachment" }),
		{
			source: "general",
			category: "attachments",
			subcategory: "",
		},
	);
});

await run("image upload policies preserve filenames, sources, and campaigns", () => {
	assert.deepEqual(splitImageFileName("портрет героя.webp"), {
		baseName: "портрет героя",
		extension: ".webp",
	});
	assert.deepEqual(splitImageFileName(".hidden"), {
		baseName: ".hidden",
		extension: "",
	});
	assert.equal(
		getImageUploadFileName("token.png", "  новий токен  "),
		"новий токен.png",
	);
	assert.equal(resolveImageUploadSource("", "кампанія"), "кампанія");
	assert.equal(resolveImageUploadSource(null, null), "general");
	const campaigns = normalizeImageCampaigns([
		{ slug: "curse", name: "Прокляття" },
		{ slug: "broken" },
		null,
	]);
	assert.deepEqual(campaigns, [{ slug: "curse", name: "Прокляття" }]);
	assert.deepEqual(getImageUploadSourceOptions(campaigns, "Загальні"), [
		{ id: "general", label: "Загальні", icon: "database" },
		{ id: "curse", label: "Прокляття", icon: "map" },
	]);
});

await run("image target policies normalize nested folder navigation", () => {
	assert.equal(normalizeImageTargetPath("//герої///союзники//"), "герої/союзники");
	assert.equal(
		enterImageTargetSubfolder("герої/союзники", "/маги/"),
		"герої/союзники/маги",
	);
	assert.equal(
		navigateImageTargetPath("герої/союзники/маги", 1),
		"герої/союзники",
	);
	assert.equal(navigateImageTargetPath("герої", -1), "");
	assert.equal(
		getImageTargetParentPath("герої/союзники/маги"),
		"герої/союзники",
	);
	assert.deepEqual(normalizeSubcategoryNames(["npc", { name: "ignored" }, ""]), [
		"npc",
	]);
});

await run("image gallery presentation preserves history and unique items", () => {
	const root = getGalleryPathEntry("general", "tokens", "");
	const nested = getGalleryPathEntry("general", "tokens", "герої");
	let history = recordGalleryNavigation({ entries: [], index: -1 }, root);
	history = recordGalleryNavigation(history, nested);
	assert.equal(recordGalleryNavigation(history, nested), history);
	assert.deepEqual(getGalleryNavigationEntry(history, -1), {
		entry: root,
		index: 0,
	});
	assert.equal(getGalleryNavigationEntry(history, 1), null);
	assert.equal(
		getGalleryHistoryKeyDirection({
			altKey: false,
			ctrlKey: false,
			key: "Backspace",
			metaKey: false,
			shiftKey: false,
		}),
		-1,
	);
	assert.equal(
		getGalleryHistoryKeyDirection({
			altKey: true,
			ctrlKey: false,
			key: "ArrowRight",
			metaKey: false,
			shiftKey: false,
		}),
		1,
	);
	const images = deduplicateGalleryImages(
		[
			{ name: "Ірина.png", url: "/api/images/general/tokens/Ірина.png" },
			{ name: "Ірина.png", url: "/api/images/general/tokens/Ірина.png" },
		],
		{ source: "general", category: "tokens", subcategory: "герої" },
	);
	assert.equal(images.length, 1);
	assert.deepEqual(
		buildGalleryPresentationItems(["npc"], images).map((item) => item.type),
		["sub", "image"],
	);
});

await run("image gallery interaction plans validate drops, moves, and selection", () => {
	const destination = { slug: "curse", category: "tokens", subcategory: "герої" };
	assert.deepEqual(
		getGalleryDropPlan({ dest: destination, hasFiles: false, jsonData: "broken" }),
		{ kind: "ignore" },
	);
	assert.deepEqual(
		getGalleryDropPlan({ dest: destination, hasFiles: true, jsonData: "" }),
		{ kind: "upload" },
	);
	const movePlan = getGalleryDropPlan({
		dest: destination,
		hasFiles: false,
		jsonData: JSON.stringify({
			items: ["Ірина.png"],
			src: { slug: "general", category: "tokens", subcategory: "npc" },
		}),
	});
	assert.equal(movePlan.kind, "move");
	assert.equal(movePlan.payload.items[0], "Ірина.png");
	assert.deepEqual(
		buildGalleryMovePayloads({
			dest: destination,
			imageGroups: [
				{ src: destination, items: ["same.png"] },
				{
					src: { slug: "general", category: "tokens", subcategory: "npc" },
					items: ["other.png"],
				},
			],
			safeSubs: ["маги"],
			src: { slug: "curse", category: "tokens", subcategory: "root" },
		}).map((payload) => payload.items),
		[["other.png"], ["маги"]],
	);
	const selection = getGallerySelectionPlan({
		allSubs: ["official", "custom"],
		filenames: new Set(),
		images: [{ name: "hero.png", url: "/hero.png" }],
		index: 2,
		isAdditive: false,
		isReadonlyImage: () => false,
		isReadonlySub: (name) => name === "official",
		isShift: true,
		lastIndex: 0,
		name: "hero.png",
		subfolders: new Set(),
		type: "image",
	});
	assert.deepEqual([...selection.subfolders], ["custom"]);
	assert.deepEqual([...selection.filenames], ["hero.png"]);
	assert.deepEqual(
		getGalleryDragPlan({
			item: { name: "hero.png", url: "/hero.png" },
			location: destination,
			getMovableSelection: () => ["hero.png", "ally.png"],
			selectedFilenames: new Set(["hero.png"]),
			selectedSubs: new Set(),
			type: "image",
			isReadonlyImage: () => false,
			isReadonlySub: () => false,
		}),
		{ items: ["hero.png", "ally.png"], src: destination },
	);
});

await run("image gallery loaders normalize metadata and official token paths", async () => {
	const api = {
		getSubcategories: async (_source, _category, subcategory) =>
			subcategory ? [] : [{ name: "герої", hasFiles: true }, "npc"],
		getBestiaryTokenAssets: async (subcategory, _search, _ignored, options) =>
			options?.recursive
				? {
						images: [
							{
								name: "Ірина.png",
								url: "/token.png",
								path: "tokens/MM/герої/Ірина.png",
								source: "MM",
							},
						],
					}
				: { images: [], subcategories: subcategory ? ["nested"] : ["MM"] },
		getImages: async () => [],
		searchImageGallery: async () => ({ images: [] }),
	};
	const subcategories = await loadGallerySubcategoryData({
		activeSearchQuery: "",
		api,
		category: "tokens",
		ignoreSourcesList: [],
		isGeneralTokens: true,
		selectedSub: "",
		selectedSource: "general",
	});
	assert.deepEqual(subcategories.dynamicSubs, ["герої", "npc", "MM"]);
	assert.equal(subcategories.subDetails.герої.hasFiles, true);
	const images = await loadGalleryImages({
		activeSearchQuery: "",
		api,
		categories: ["tokens"],
		category: "tokens",
		contentScope: "databaseTokens",
		ignoreSourcesList: [],
		isGeneralTokens: true,
		isScopedContent: true,
		normalizedSearchQuery: "",
		search: "ірина",
		selectedSub: "",
		selectedSource: "general",
	});
	assert.equal(images[0].subcategory, "герої");
	assert.equal(images[0].locationLabel, "database / tokens / герої");
	assert.equal(images[0].globalSearch, true);
});

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
