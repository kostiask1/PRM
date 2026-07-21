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
	SHOW_MESSAGE_BOX,
	SET_UI_SETTINGS,
	closeMentionPickerAction,
	closeModalAction,
	hideMessageBox,
	normalizeUiSettingsPatch,
	openMentionPickerAction,
	openModalAction,
	publishDiceResultAction,
	refreshEntitiesAction,
	recordRulesReferenceHistoryEntryAction,
	requestCampaignsReloadAction,
	requestDiceRollAction,
	requestRulesReferenceNavigationAction,
	setActiveCampaignAction,
	setActiveEncounterAction,
	setActiveSessionAction,
	setCampaignsAction,
	setNavigationAction,
	setRulesReferenceHistoryIndexAction,
	setRulesReferenceModalOpenAction,
	setUiSettingsAction,
} from "../src/shared/model/actions.js";
import { reduceWorkflowState } from "../src/shared/model/workflowReducer.ts";
import { reduceNavigationState } from "../src/shared/model/navigationStateReducer.ts";
import {
	matchesMonsterSearch,
	getMonsterTypeString,
} from "../src/entities/bestiary/index.js";
import {
	executeCampaignHashNavigationPlan,
	filterCampaignSessions,
	getCampaignCharacterDropRequest,
	getCampaignEntityAiIgnoredUpdate,
	getCampaignEntityRenderKey,
	getCampaignHashNavigationPlan,
	getCampaignHashTarget,
	getCampaignKeyboardAction,
	getCampaignNotesCollapsePatch,
	getCampaignNotesSectionPresentation,
	getCampaignNotesViewModePlan,
	getCampaignPageCampaign,
	getCampaignSectionState,
	hasCampaignNoteContent,
	isCampaignEditableTarget,
	normalizeCampaignCardNotes,
} from "../src/pages/campaign/model/campaignPagePresentation.ts";
import {
	DEFAULT_CAMPAIGN_GRAPH_FILTERS,
	executeCampaignGraphOpenTarget,
	findCampaignGraphEditableNote,
	formatCampaignGraphSourceField,
	getCampaignGraphConnectionPresentation,
	getCampaignGraphDetailTextPresentation,
	getCampaignGraphEdgeHandles,
	getCampaignGraphEdgeOpacity,
	getCampaignGraphEdgePresentation,
	getCampaignGraphFlowNodePresentation,
	getCampaignGraphFlowProjectionPlan,
	getCampaignGraphMiniMapBounds,
	getCampaignGraphMiniMapNodeSize,
	getCampaignGraphNodeCardPresentation,
	getCampaignGraphNodeTopologyKey,
	getCampaignGraphNoteSaveRequest,
	getCampaignGraphOpenTarget,
	getVisibleCampaignGraph,
	resolveNewCampaignGraphNodeCollisions,
	shouldActivateCampaignGraphDetailText,
	shouldFitCampaignGraphTopology,
} from "../src/pages/campaign/model/campaignGraphPresentation.ts";
import {
	applyCampaignGraphCampaignNoteSave,
	applyCampaignGraphSessionNoteSave,
	executeCampaignGraphSessionNoteSave,
	getCampaignGraphNoteSavePlan,
} from "../src/pages/campaign/model/campaignGraphNoteSave.ts";
import {
	executeCampaignAiEntityReload,
	executeCampaignDelete,
	executeCampaignImageCheck,
	executeCampaignRename,
	executeCampaignSessionCreation,
	executeCampaignSyncPlan,
	getCampaignAiUpdatePlan,
	getCampaignDeleteConfirmationConfig,
	getCampaignRenameErrorMessage,
	getCampaignRenamePlan,
	getCampaignSessionCreationErrorMessage,
	getCampaignSessionCreationPlan,
	getCampaignSyncPlan,
	getCampaignViewEntities,
	getCampaignViewStateProjection,
} from "../src/pages/campaign/model/campaignViewOrchestration.ts";
import {
	createDefaultPartialArchiveSelection,
	getOrderedPartialArchiveSections,
	togglePartialArchiveSection,
} from "../src/pages/campaign/model/partialArchiveSelection.ts";
import {
	executeSessionSave,
	normalizeSessionSavePolicy,
	shouldNotifySessionRename,
} from "../src/features/session-editor/model/sessionPersistence.ts";
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
	resolveSelectedPromptSettings,
	resolveSelectedSourceSettings,
	resolveSettingsScope,
	setCampaignIgnoreSourcesForScope,
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
	enrichMonstersWithLegendaryGroups,
	executeAiDraftRestore,
	executeAiMonsterEditRequest,
	executeBestiaryFieldEditSave,
	executeBestiarySelectedSourcesSave,
	executeBestiarySyncEventPlan,
	filterBestiaryMonsters,
	getAiDraftRestoreResultPlan,
	getAiDraftRestoreStartPlan,
	getAiMonsterEditErrorMessage,
	getAiMonsterEditStartPlan,
	getAiMonsterGenerationResultPlan,
	getAiMonsterInstructionPlan,
	getBestiaryDetailPresentation,
	getBestiaryFieldEditStartPlan,
	getBestiaryInitialSelectionScrollPlan,
	getBestiaryMonsterRowPresentation,
	getBestiarySelectionPlan,
	getBestiarySourceCodes,
	getBestiarySyncEventPlan,
	getCreateBasedMonsterPlan,
	getCustomMonsterDeleteStartPlan,
	getCustomBestiaryUpdatePlan,
	getCustomRefreshSelection,
	getMonsterListFromResponse,
	getNextBestiarySortOrder,
	isSameMonsterIdentity,
	mergeImportedCustomMonsters,
	monsterMatchesReference,
	parseImportedCustomMonsters,
	parseBestiarySyncEvent,
	parseMonsterCr,
	parseMonsterReference,
	preserveAiDraftResourceMetadata,
	removeDeletedCustomMonsterFavorite,
	replaceDeletedCustomMonsterList,
	shouldClearAiMonsterEditController,
	sortBestiaryMonsters,
} from "../src/widgets/bestiary-browser/model.js";
import {
	executeMonsterAction,
	executeMonsterTokenUpload,
	getChangedFieldClass,
	getMonsterMetadataPresentation,
	getMonsterMutationKey,
	getMonsterNameRowPresentation,
	getMonsterSpellSlug,
	getMonsterSpellcastingEntries,
	getMonsterSpellcastingEntryPresentation,
	getMonsterTokenSources,
	getMonsterTokenSectionPresentation,
	getSenseTextParts,
	getTokenDragPayload,
	getUploadedTokenUrl,
	groupMonsterSpellsByLevel,
	loadMonsterSpells,
	shouldShowMonsterTokenDropzone,
} from "../src/widgets/monster-stat-block/model.js";
import {
	executeSpellInsertAction,
	filterSpells,
	findSpellByReference,
	getInitialSpellSelection,
	getInitialSpellScrollPlan,
	getNextSpellSortOrder,
	getSettingsIgnoreSources,
	getSpellClassOptions,
	getSpellItemKey,
	getSpellListIndex,
	getSpellListItemPresentation,
	getSpellSchoolOptions,
	getValidSourceFilter,
	normalizeSpellList,
	parseSpellReferenceKey,
	sortSpells,
	spellMatchesReferenceKey,
} from "../src/widgets/spells-browser/model.js";
import {
	REFERENCE_TAB_POLICIES,
	applyLoadedReferenceSelection,
	applyReferenceTabOnlySelection,
	applyReferenceSelectionReconciliationPlan,
	combineBestiaryLists,
	createReferenceSelection,
	executeReferenceInitialNavigationPlan,
	executeReferenceTabSelectionPlan,
	findSelectedReferenceItem,
	getCreatureReferenceMatchRank,
	getCreatureReferenceName,
	getInitialTabId,
	getReferenceHistoryAvailability,
	getReferenceInitialNavigationPlan,
	getReferenceInlineTag,
	getReferenceKeyboardPlan,
	getReferenceLoadErrorMessage,
	getReferenceModalHostPlan,
	getReferenceNavigationRequestPlan,
	getReferenceScrollPlan,
	getReferenceSelectionReconciliationPlan,
	getReferenceTabSelectionPlan,
	getReferenceTabsToLoad,
	getSpellReferenceName,
	itemMatchesSelectedName,
	itemMatchesQuery,
	normalizeReferenceList,
} from "../src/widgets/rules-reference-modal/model.js";
import {
	buildSidebarCampaignOrder,
	getSidebarCampaignSelection,
	getSidebarClassName,
	getSidebarErrorMessage,
	groupSidebarCampaigns,
	isSidebarToggleKey,
	mergeSidebarCampaignGroup,
} from "../src/widgets/sidebar/model.js";
import {
	buildAiImagePromptGenerationPlan,
	createAiAssistantPresentation,
	executeAiAssistantHistoryRestorePlan,
	getAiAssistantContextProjection,
	getAiAssistantHistoryView,
	getAiAssistantPromptPlaceholder,
	getAiAssistantRouteState,
	getAiAssistantTitle,
	getAiHistoryDeleteConfirmation,
	getAiHistoryErrorMessage,
	getAiHistoryRestoreConfirmation,
	getAiImagePromptCollections,
	getCustomMonsterPromptDescription,
	getImagePromptItemKey,
	getImagePromptPickerState,
	getImagePromptTargetTitle,
	getScenePromptDescription,
	getScenePromptItemKey,
} from "../src/widgets/ai-assistant/model.js";
import {
	buildCardHighlightFields as buildAiResponseCardHighlightFields,
	findDraftResourceForPreview,
	getEditedResourceAfterFromParent,
	getEncounterParticipantEntries as getAiResponseEncounterParticipantEntries,
	getPreviewCardType as getAiResponsePreviewCardType,
	parseSnapshotText as parseAiResponseSnapshotText,
	updateDraftResourceCollection,
} from "../src/widgets/ai-response-modal/model.js";
import {
	CAMPAIGN_SEARCH_FILTERS,
	buildCampaignSearchIndex,
	buildCampaignSearchSnippet,
	campaignSearchValueToText,
	executeCampaignSearchIndexLoad,
	filterCampaignSearchResults,
	getCampaignSearchErrorMessage,
	getCampaignSearchHighlightTerms,
	loadCampaignSearchIndex,
	toggleCampaignSearchFilter,
} from "../src/widgets/campaign-search/model.js";
import {
	getCampaignEntityModalCardPlan,
	getCampaignEntityRenamePlan,
	isCampaignModalEntity,
	sanitizeCampaignModalEntity,
	shouldRenderCampaignEntityModal,
} from "../src/widgets/campaign-entity-modal/model.js";
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
	getMentionBeforeCollapsedSelection,
	handleSpaceAfterMention,
	isMentionBoundaryPosition,
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
	applyEncounterDiceHpResult,
	applyEncounterGeneratedMonsterResult,
	applyEncounterMonsterRestoreResult,
	createEmptyEncounterCharacterDraft,
	executeEncounterAiRestoreRequest,
	executeEncounterHistoryAction,
	executeEncounterNavigationAction,
	executeEncounterParticipantSelection,
	executeEncounterPlayerCreation,
	executeEncounterDiceProcessing,
	executeEncounterLoadPlan,
	executeEncounterMonsterDropPlan,
	executeEncounterUpdatePlan,
	getEncounterGridMonsterKey,
	getEncounterGridProjection,
	getEncounterAddCharacterPlan,
	getEncounterHistoryAction,
	getEncounterLoadPlan,
	getEncounterMonsterDropPlan,
	getEncounterMonsterRowStats,
	getEncounterNavigationAction,
	getEncounterParticipantSelectionPlan,
	getEncounterRenamePlan,
	getEncounterSessionEncounters,
	getEncounterUpdatePlan,
	getAvailableEncounterCharacters,
	isEncounterEditableTarget,
	parseEncounterImport,
	replaceEncounterMonsterFromAi,
	resolveEncounterHpInputValue,
	shouldReloadEncounterFromSync,
} from "../src/pages/encounter/model/encounterPagePresentation.ts";
import {
	getSessionEntityDisplayName,
	normalizeSessionEntity,
} from "../src/pages/session/model/sessionEntityModel.ts";
import {
	executeSessionRenamePlan,
	getSceneNotesWithCollapsedState,
	getSessionEncounterLinks,
	getSessionKeyboardAction,
	getSessionPageData,
	getSessionRenamePlan,
	getSessionSceneNotesPresentation,
	getSessionScopeImportCopy,
	getSessionScopeImportPresentation,
	getSessionSyncAction,
	hasSessionNoteContent,
	isSessionEditableTarget,
	normalizeSessionPageSession,
} from "../src/pages/session/model/sessionPagePresentation.ts";
import {
	addSourceMonsterImageToDraft,
	buildDiffResources,
	getDiffResourceState,
	getFirstChangedMonster,
	getFirstChangedMonsterName,
	getHistoryChangeSummary,
	isAiResponseVisibleForRoute,
	updateDraftResourceAfterValues,
} from "../src/features/ai/index.js";
import {
	compactEntityForEstimate,
	compactSessionForEstimate,
	AI_GENERATION_STATUS,
	aiGenerationLifecycleReducer,
	buildAiGeneratedResultPlan,
	buildAiGenerationRequestAttachments,
	buildAiGenerationRequestOptions,
	buildAiGenerationRequestTarget,
	buildAiGenerationRequest,
	buildAiHistoryRestorePlan,
	canApplyRestoredAiDataDirectly,
	buildAiTokenEstimate,
	buildAiTokenEstimateContext,
	buildAiUpdatedDataPlan,
	buildCustomMonsterImageTarget,
	buildLocationImageTarget,
	buildNpcImageTarget,
	buildSceneImageTarget,
	createAiHistoryWorkflow,
	createAiHistoryCommandService,
	createTransientAiHistoryEntry,
	createInitialAiContextConfig,
	ensureContextListItems,
	executeAiGeneratedResultPlan,
	executeAiGeneration,
	executeAiHistoryRetry,
	executeAiUpdatedDataPlan,
	estimateTextTokens,
	estimateValueTokens,
	estimateAiAttachmentTokens,
	getEstimatedAiMode,
	getAiCharacterContextKey,
	getAiGenerationRequestContext,
	getImageTargetNotes,
	getAiLocationContextKey,
	getSceneImageTargetEncounter,
	formatAiGenerationFailureAlert,
	getGeneratedEntityTypes,
	getAttachedFileKey,
	getAttachedImageKey,
	getSupportedAiFileMimeType,
	getSupportedAiImageMimeType,
	getAiHistoryCampaign,
	getAiHistoryRetryFailure,
	getAiHistoryRestoreMode,
	getAiRestoredDataKind,
	getAiRestoreRouteKind,
	getContextListConfig,
	hasGeneratedCampaignChanges,
	initialAiGenerationLifecycle,
	isAiGenerationPending,
	mergeLoadedAiSessionData,
	normalizeCustomMonsterCollection,
	resolveAiGenerationRequestPolicy,
	saveGeminiApiKeyAndRefreshModels,
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
	getAiEncounterGenerationActionsView,
	getAiEncounterGenerationTogglePlan,
	getAiEntityGenerationActionsView,
	getAiAttachmentControlsView,
	getAvailableAiAttachmentSlots,
	getAiPromptTokenVisibility,
	getAiResponseHistoryRowView,
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
	getCampaignGraphFlowNodeSize,
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
	getImageAssetFieldContextMenuPlan,
	getImageAssetFieldPresentation,
	getImageAssetFieldSelectionUrl,
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
	getGalleryFolderPresentation,
	getGalleryFolderSubcategory,
	getGlobalGalleryResultNavigationPlan,
	getGalleryColumnCount,
	getGalleryImageKey,
	getGalleryHistoryKeyDirection,
	getGalleryHistoryKeyboardPlan,
	getGalleryNavigationEntry,
	getGalleryPathEntry,
	getGallerySearchPresentation,
	getGalleryStatsAndActionsPresentation,
	recordGalleryNavigation,
} from "../src/features/images/model/imageGalleryPresentation.ts";
import {
	buildGalleryBulkDeletePayloads,
	buildGalleryMovePayloads,
	createGalleryBulkDeleteConfirmation,
	getGalleryBulkDeleteConfirmationPlan,
	getGalleryBulkDeleteSummary,
	getGalleryEscapePlan,
	getGalleryFolderDragOverPlan,
	getGalleryFolderDropTarget,
	getGalleryFolderRenameName,
	getGalleryGridDragOverPlan,
	getGalleryGridDropPlan,
	getGalleryGridDropTarget,
	getGalleryDragPlan,
	getGalleryDropPlan,
	getGalleryKeyboardPlan,
	getGallerySelectionPlan,
	getGallerySubcategoryRenamePlan,
	normalizeGalleryBulkDeleteConfirmation,
} from "../src/features/images/model/imageGalleryInteraction.ts";
import {
	getScopedGallerySearchQuery,
	hasNonEmptyGalleryFolders,
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
	buildCampaignToSessionScopeMovePlan,
	buildSessionToCampaignScopeMovePlan,
	createCampaignEntityClient,
	executeEntityScopeMove,
	removeEntityById,
	removeMovedCampaignEntityFromImport,
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
	executeEncounterOpen,
	getEncounterCreationFileName,
	getEncounterOpenPlan,
	requireEncounterCreationResult,
} from "../src/features/encounter-editor/model/encounterCreation.ts";
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
	getMultiSelectLabel,
	getMultiSelectOptionAction,
	getMultiSelectOptionPresentation,
	getMultiSelectSelectionState,
	selectOnlyMultiSelectValue,
	toggleMultiSelectValue,
} from "../src/shared/ui/multiSelectModel.ts";
import {
	applyDraggableFinishPlan,
	getDefaultDraggableItemKey,
	getDraggableFinishPlan,
	getDraggableReorderResult,
	hasReachedDragStartThreshold,
	haveSameDraggableItemOrder,
	reorderDraggableItems,
} from "../src/shared/ui/draggableListModel.ts";
import {
	getBulkCollapseAction,
	getNoteCardPresentation,
	isNoteCardFieldHighlighted,
	isRealNote,
	shouldExpandNoteFromCardClick,
} from "../src/features/notes/model.ts";
import {
	createModalApi,
	executeModalClose,
	executeModalKeyboardPlan,
	formatModalStatusMessage,
	getModalCloseAction,
	getModalFocusTarget,
	getModalKeyboardPlan,
	getModalPresentationPlan,
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
import {
	applyMonsterAiDraftSaveResult,
	buildMonsterAiRequestPayload,
	executeMonsterAiRequest,
	executeMonsterFieldSavePlan,
	getMonsterAiDraftSavePlan,
	getMonsterAiEditPresentation,
	getMonsterAiGenerationPlan,
	getMonsterAiRestoreRequestPlan,
	getMonsterFieldEditPlan,
	getMonsterFieldSavePlan,
	persistMonsterFieldSavePlan,
} from "../src/features/ai-edit-monster/model.ts";
import {
	buildAppMentionOptions,
	getAppErrorMessage,
	getAppSettingsProjection,
	getCampaignCompletionPlan,
	hasValidMentionPickerCallbacks,
	isEditableAppTarget,
} from "../src/app/model/appShellPresentation.ts";
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
const mentionProcessing = require("../server/modules/ai/application/mentionProcessing.js");
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
	systemInstructions,
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

await run("UI settings actions apply declarative field normalization", () => {
	const normalized = normalizeUiSettingsPatch({
		theme: "dark",
		encounterViewMode: "invalid",
		encounterGridColumns: "9",
		simplifiedNotes: "false",
		aiBasePrompt: 0,
		imagePromptBasePrompt: " Зображення ",
		campaignAiBasePrompts: { demo: "Кампанія", empty: false },
		campaignImagePromptBasePrompts: ["invalid"],
		ignoreSourcesList: [" phb ", "PHB", "dmg", "", null],
		autoApplyAiChanges: false,
		useSearchDebounce: 0,
		unknownSetting: "ignored",
	});
	assert.deepEqual(normalized, {
		theme: "dark",
		encounterViewMode: "single",
		encounterGridColumns: 4,
		simplifiedNotes: true,
		aiBasePrompt: "",
		imagePromptBasePrompt: " Зображення ",
		campaignAiBasePrompts: { demo: "Кампанія", empty: "" },
		campaignImagePromptBasePrompts: {},
		ignoreSourcesList: ["DMG", "PHB"],
		autoApplyAiChanges: false,
		useSearchDebounce: true,
	});
	assert.deepEqual(normalizeUiSettingsPatch(null), {});
	assert.equal(
		normalizeUiSettingsPatch({ encounterGridColumns: "invalid" })
			.encounterGridColumns,
		2,
	);
	assert.equal(
		normalizeUiSettingsPatch({ encounterGridColumns: 0 }).encounterGridColumns,
		1,
	);

	const inherited = Object.create({ theme: "dark" });
	inherited.aiBasePrompt = "Власне поле";
	assert.deepEqual(normalizeUiSettingsPatch(inherited), {
		aiBasePrompt: "Власне поле",
	});
	assert.deepEqual(setUiSettingsAction({ theme: "unexpected" }), {
		type: SET_UI_SETTINGS,
		payload: { theme: "light" },
	});
});

await run("workflow reducers preserve domain transitions and state identity", () => {
	const baseState = {
		modal: { requestId: null, config: null },
		entityRefreshVersion: 0,
		mentionPickerRequest: null,
		dice: { rollRequest: null, rolledResult: { resultId: 0 } },
		messageBox: null,
		navigation: {
			activeCampaignSlug: null,
			activeSessionFileName: null,
			activeEncounterId: null,
		},
		active: { campaign: null, session: null, encounter: null },
		campaigns: { items: [], reloadVersion: 0 },
		localization: { language: "uk", availableLanguages: ["uk"] },
		ui: {},
		sync: { version: 0, event: null },
		rulesReference: {
			isOpen: false,
			navigationRequest: null,
			history: { entries: [], index: -1 },
		},
	};
	assert.equal(
		reduceWorkflowState(baseState, setUiSettingsAction({ theme: "dark" })),
		undefined,
	);

	const modalConfig = { title: "Українське вікно" };
	const openedModal = reduceWorkflowState(
		baseState,
		openModalAction(41, modalConfig),
	);
	assert.deepEqual(openedModal.modal, { requestId: 41, config: modalConfig });
	assert.equal(openedModal.dice, baseState.dice);
	assert.deepEqual(reduceWorkflowState(openedModal, closeModalAction()).modal, {
		requestId: null,
		config: null,
	});

	const pickerAction = openMentionPickerAction({
		select: () => {},
		cancel: () => {},
	});
	const pickerState = reduceWorkflowState(baseState, pickerAction);
	assert.equal(pickerState.mentionPickerRequest, pickerAction.payload);
	assert.equal(
		reduceWorkflowState(pickerState, closeMentionPickerAction())
			.mentionPickerRequest,
		null,
	);

	const rollAction = requestDiceRollAction({ formula: "1d20" });
	const rollState = reduceWorkflowState(baseState, rollAction);
	assert.equal(rollState.dice.rollRequest, rollAction.payload);
	assert.equal(rollState.dice.rolledResult, baseState.dice.rolledResult);
	const resultAction = publishDiceResultAction(17, { target: "Ірина" });
	const resultState = reduceWorkflowState(rollState, resultAction);
	assert.equal(resultState.dice.rolledResult, resultAction.payload);
	assert.equal(resultState.dice.rollRequest, rollAction.payload);

	const messagePayload = { title: "Увага", message: "Перевірка" };
	const messageState = reduceWorkflowState(baseState, {
		type: SHOW_MESSAGE_BOX,
		payload: messagePayload,
	});
	assert.equal(messageState.messageBox, messagePayload);
	assert.equal(
		reduceWorkflowState(messageState, hideMessageBox()).messageBox,
		null,
	);

	const navigationAction = requestRulesReferenceNavigationAction(
		"spells",
		"Вогняна куля",
		{ forceTab: true },
	);
	const navigationState = reduceWorkflowState(baseState, navigationAction);
	assert.equal(
		navigationState.rulesReference.navigationRequest,
		navigationAction.payload,
	);
	assert.equal(
		navigationState.rulesReference.history,
		baseState.rulesReference.history,
	);
	const openRulesState = reduceWorkflowState(
		navigationState,
		setRulesReferenceModalOpenAction(true),
	);
	assert.equal(openRulesState.rulesReference.isOpen, true);

	const invalidHistoryAction = recordRulesReferenceHistoryEntryAction("", "");
	assert.equal(
		reduceWorkflowState(baseState, invalidHistoryAction),
		baseState,
	);
	const firstHistoryAction = recordRulesReferenceHistoryEntryAction(
		"spells",
		"Вогняна куля",
	);
	const firstHistoryState = reduceWorkflowState(baseState, firstHistoryAction);
	assert.deepEqual(firstHistoryState.rulesReference.history, {
		entries: [{ tabId: "spells", name: "Вогняна куля" }],
		index: 0,
	});
	assert.equal(
		reduceWorkflowState(firstHistoryState, firstHistoryAction),
		firstHistoryState,
	);
	const branchedState = {
		...firstHistoryState,
		rulesReference: {
			...firstHistoryState.rulesReference,
			history: {
				entries: [
					{ tabId: "spells", name: "Перше" },
					{ tabId: "bestiary", name: "Друге" },
				],
				index: 0,
			},
		},
	};
	const replacedBranch = reduceWorkflowState(
		branchedState,
		recordRulesReferenceHistoryEntryAction("conditions", "Засліплення"),
	);
	assert.deepEqual(replacedBranch.rulesReference.history, {
		entries: [
			{ tabId: "spells", name: "Перше" },
			{ tabId: "conditions", name: "Засліплення" },
		],
		index: 1,
	});
	assert.equal(
		reduceWorkflowState(
			replacedBranch,
			setRulesReferenceHistoryIndexAction(99),
		),
		replacedBranch,
	);
	assert.equal(
		reduceWorkflowState(baseState, setRulesReferenceHistoryIndexAction(1)),
		baseState,
	);
	const rewoundState = reduceWorkflowState(
		replacedBranch,
		setRulesReferenceHistoryIndexAction(Number.NaN),
	);
	assert.equal(rewoundState.rulesReference.history.index, 0);
});

await run("navigation reducers preserve route identity and clear stale resources", () => {
	const campaign = { slug: "прокляття-страда", name: "Прокляття Страда" };
	const nextCampaign = { slug: "долина", name: "Долина" };
	const session = { fileName: "сесія-1.json", name: "Сесія 1" };
	const encounter = { id: 42, name: "Засідка" };
	const campaigns = [campaign, nextCampaign];
	const baseState = {
		modal: { requestId: null, config: null },
		entityRefreshVersion: 3,
		mentionPickerRequest: null,
		dice: { rollRequest: null, rolledResult: null },
		messageBox: null,
		navigation: {
			activeCampaignSlug: "прокляття-страда",
			activeSessionFileName: "сесія-1.json",
			activeEncounterId: "42",
		},
		active: { campaign, session, encounter },
		campaigns: { items: campaigns, reloadVersion: 5 },
		localization: { language: "uk", availableLanguages: ["uk", "en"] },
		ui: {},
		sync: { version: 0, event: null },
		rulesReference: {
			isOpen: false,
			navigationRequest: null,
			history: { entries: [], index: -1 },
		},
	};

	assert.equal(
		reduceNavigationState(baseState, setUiSettingsAction({ theme: "dark" })),
		undefined,
	);
	assert.equal(
		reduceNavigationState(
			baseState,
			setNavigationAction({
				activeCampaignSlug: "прокляття-страда",
				activeSessionFileName: "сесія-1.json",
				activeEncounterId: "42",
			}),
		),
		baseState,
	);

	const changedSessionRoute = reduceNavigationState(
		baseState,
		setNavigationAction({ activeSessionFileName: "сесія-2.json" }),
	);
	assert.equal(changedSessionRoute.active.campaign, campaign);
	assert.equal(changedSessionRoute.active.session, null);
	assert.equal(changedSessionRoute.active.encounter, encounter);
	assert.equal(changedSessionRoute.campaigns, baseState.campaigns);
	assert.equal(changedSessionRoute.ui, baseState.ui);

	const changedCampaignRoute = reduceNavigationState(
		baseState,
		setNavigationAction({ activeCampaignSlug: "долина" }),
	);
	assert.equal(changedCampaignRoute.active.campaign, nextCampaign);
	assert.equal(changedCampaignRoute.active.session, null);
	assert.equal(changedCampaignRoute.active.encounter, null);
	assert.equal(
		changedCampaignRoute.navigation.activeSessionFileName,
		"сесія-1.json",
	);

	const replacementCampaign = {
		slug: "прокляття-страда",
		name: "Оновлена кампанія",
	};
	const replacedCampaigns = reduceNavigationState(
		baseState,
		setCampaignsAction([replacementCampaign, nextCampaign]),
	);
	assert.equal(replacedCampaigns.active.campaign, replacementCampaign);
	assert.equal(replacedCampaigns.active.session, session);
	assert.equal(replacedCampaigns.active.encounter, encounter);
	assert.equal(replacedCampaigns.navigation, baseState.navigation);
	assert.equal(
		reduceNavigationState(baseState, setCampaignsAction(campaigns)),
		baseState,
	);

	const removedCampaigns = reduceNavigationState(
		baseState,
		setCampaignsAction([]),
	);
	assert.deepEqual(removedCampaigns.active, {
		campaign: null,
		session: null,
		encounter: null,
	});
	assert.equal(removedCampaigns.campaigns.reloadVersion, 5);

	assert.equal(
		reduceNavigationState(baseState, setActiveCampaignAction(campaign)),
		baseState,
	);
	assert.deepEqual(
		reduceNavigationState(baseState, setActiveCampaignAction(null)).active,
		{ campaign: null, session: null, encounter: null },
	);
	assert.equal(
		reduceNavigationState(baseState, setActiveSessionAction(session)),
		baseState,
	);
	assert.deepEqual(
		reduceNavigationState(baseState, setActiveSessionAction(null)).active,
		{ campaign, session: null, encounter: null },
	);
	assert.equal(
		reduceNavigationState(baseState, setActiveEncounterAction(encounter)),
		baseState,
	);

	const refreshed = reduceNavigationState(baseState, refreshEntitiesAction());
	assert.equal(refreshed.entityRefreshVersion, 4);
	assert.equal(refreshed.navigation, baseState.navigation);
	assert.equal(refreshed.active, baseState.active);
	const reloadRequested = reduceNavigationState(
		baseState,
		requestCampaignsReloadAction(),
	);
	assert.equal(reloadRequested.campaigns.reloadVersion, 6);
	assert.equal(reloadRequested.campaigns.items, campaigns);
	assert.equal(reloadRequested.active, baseState.active);
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
	assert.equal(isMentionBoundaryPosition(`${MENTION_BOUNDARY}tail`, 0), true);
	assert.equal(isMentionBoundaryPosition(`${MENTION_BOUNDARY}tail`, 1), true);
	assert.equal(isMentionBoundaryPosition(`${MENTION_BOUNDARY}tail`, 2), false);
	assert.equal(isMentionBoundaryPosition("plain", 0), false);

	const getSelectedMentionText = (setupSelection) => {
		let selectedMentionText = null;
		editor.update(
			() => {
				const root = $getRoot();
				root.clear();
				const mention = $applyNodeReplacement(
					new TestMentionNode("Link"),
				).setMode("token");
				const boundary = createMentionBoundaryNode("tail");
				const paragraph = $createParagraphNode().append(mention, boundary);
				root.append(paragraph);
				setupSelection({ boundary, mention, paragraph });
				selectedMentionText =
					getMentionBeforeCollapsedSelection($getSelection(), isMentionNode)
						?.getTextContent() || null;
			},
			{ discrete: true },
		);
		return selectedMentionText;
	};

	assert.equal(
		getSelectedMentionText(({ mention }) => mention.select(1, 1)),
		null,
		"a MentionNode anchor is accepted only at its end",
	);
	assert.equal(
		getSelectedMentionText(({ mention }) => mention.select(4, 4)),
		"Link",
	);
	assert.equal(
		getSelectedMentionText(({ boundary }) => boundary.select(0, 0)),
		"Link",
	);
	assert.equal(
		getSelectedMentionText(({ boundary }) => boundary.select(1, 1)),
		"Link",
	);
	assert.equal(
		getSelectedMentionText(({ boundary }) => boundary.select(2, 2)),
		null,
	);
	assert.equal(
		getSelectedMentionText(({ boundary }) => {
			boundary.setTextContent("plain");
			boundary.select(0, 0);
		}),
		"Link",
		"the start of an ordinary following text node remains a valid boundary",
	);
	assert.equal(
		getSelectedMentionText(({ boundary, paragraph }) => {
			paragraph.clear();
			paragraph.append(boundary);
			boundary.select(0, 0);
		}),
		null,
		"a boundary without a previous MentionNode is rejected",
	);
	assert.equal(
		getSelectedMentionText(({ paragraph }) => paragraph.select(1, 1)),
		"Link",
	);
	assert.equal(
		getSelectedMentionText(({ paragraph }) => paragraph.select(0, 0)),
		null,
	);
	assert.equal(
		getSelectedMentionText(({ boundary }) => boundary.select(0, 1)),
		null,
		"expanded selections are not mention insertion points",
	);
	assert.equal(getMentionBeforeCollapsedSelection(null, isMentionNode), null);

	editor.update(
		() => {
			$getRoot().clear();
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

await run("app shell policies normalize settings, mentions, and campaign completion", () => {
	assert.equal(isEditableAppTarget({ tagName: "INPUT" }), true);
	assert.equal(isEditableAppTarget({ isContentEditable: true }), true);
	assert.equal(isEditableAppTarget({ tagName: "BUTTON" }), false);
	assert.equal(
		hasValidMentionPickerCallbacks({ select() {}, cancel() {} }),
		true,
	);
	assert.equal(hasValidMentionPickerCallbacks({ select() {} }), false);
	const projection = getAppSettingsProjection({
		language: "uk",
		theme: "dark",
		encounterGridColumns: 3,
		unknownSetting: "ignored",
	});
	assert.equal(projection.language, "uk");
	assert.equal(projection.ui.theme, "dark");
	assert.equal(projection.ui.encounterGridColumns, 3);
	assert.equal("unknownSetting" in projection.ui, false);

	assert.deepEqual(
		buildAppMentionOptions(
			{
				characters: [{ id: 2, firstName: " Ірина ", lastName: " Світанок " }],
				npc: [{ slug: "zhrec", name: "Жрець" }, { name: " " }],
				locations: [{ id: "kyiv", title: "Київ" }],
			},
			"uk",
		).map(({ id, type, name }) => ({ id, type, name })),
		[
			{ id: "zhrec", type: "npc", name: "Жрець" },
			{ id: 2, type: "characters", name: "Ірина Світанок" },
			{ id: "kyiv", type: "locations", name: "Київ" },
		],
	);

	const now = new Date("2026-07-20T09:00:00.000Z");
	const completion = getCampaignCompletionPlan(
		{
			slug: "кампанія",
			name: "Кампанія",
			completed: false,
			completedAt: "2026-07-18T09:00:00.000Z",
		},
		now,
		(date) => date.toISOString().slice(0, 10),
	);
	assert.equal(completion.completed, true);
	assert.equal(completion.previousDateLabel, "2026-07-18");
	assert.equal(completion.requiresDateConfirmation, true);
	assert.equal(completion.nextCompletedAt, now.toISOString());
	assert.equal(getAppErrorMessage({ message: "unsafe" }, "Невідомо"), "Невідомо");
	assert.equal(getAppErrorMessage(new Error("Помилка"), "Невідомо"), "Помилка");
});

await run("campaign page presentation narrows routes, sessions, and card notes", () => {
	assert.equal(getCampaignPageCampaign(null), null);
	assert.deepEqual(getCampaignPageCampaign({ slug: "ніч", name: "Нічна варта" }), {
		slug: "ніч",
		name: "Нічна варта",
	});
	assert.deepEqual(
		filterCampaignSessions(
			[
				{ name: "Вступ", fileName: "session-1.json" },
				{ name: "Таємниця" },
				{ name: "Фінал", fileName: "session-3.json" },
			],
			"фін",
		),
		[{ name: "Фінал", fileName: "session-3.json" }],
	);
	assert.equal(hasCampaignNoteContent([{ title: "", text: "  " }]), false);
	assert.equal(hasCampaignNoteContent([{ title: "Нотатка" }]), true);
	assert.deepEqual(
		getCampaignSectionState({
			description: "",
			notes: [{ id: 1, title: "Нотатка" }],
			characters: [],
			npcs: [{ id: "npc-1" }],
			locations: [],
			isDescriptionCollapsed: true,
			isNotesCollapsed: true,
			isCharactersCollapsed: true,
			isNpcsCollapsed: true,
			isLocationsCollapsed: true,
		}),
		{
			hasDescriptionData: false,
			hasNotesData: true,
			hasCharactersData: false,
			hasNpcsData: true,
			hasLocationsData: false,
			isDescriptionCollapsed: false,
			isNotesCollapsed: true,
			isCharactersCollapsed: false,
			isNpcsCollapsed: true,
			isLocationsCollapsed: false,
		},
	);
	assert.deepEqual(
		getCampaignNotesSectionPresentation({
			hasData: true,
			isCollapsed: false,
			viewMode: "list",
		}),
		{
			canToggleCollapse: true,
			isListVisible: true,
			isGraphVisible: false,
			showBulkCollapse: true,
			listButtonVariant: "primary",
			graphButtonVariant: "ghost",
		},
	);
	assert.deepEqual(
		getCampaignNotesSectionPresentation({
			hasData: true,
			isCollapsed: true,
			viewMode: "graph",
		}),
		{
			canToggleCollapse: true,
			isListVisible: false,
			isGraphVisible: false,
			showBulkCollapse: false,
			listButtonVariant: "ghost",
			graphButtonVariant: "primary",
		},
	);
	assert.equal(
		getCampaignNotesSectionPresentation({
			hasData: false,
			isCollapsed: false,
			viewMode: "list",
		}).isListVisible,
		true,
	);
	assert.deepEqual(getCampaignNotesCollapsePatch(true, false), {
		isNotesCollapsed: true,
	});
	assert.deepEqual(getCampaignNotesCollapsePatch(true, true), {
		isNotesCollapsed: false,
	});
	assert.equal(getCampaignNotesCollapsePatch(false, true), null);
	assert.deepEqual(getCampaignNotesViewModePlan("graph", true), {
		viewMode: "graph",
		collapsePatch: { isNotesCollapsed: false },
	});
	assert.deepEqual(getCampaignNotesViewModePlan("list", false), {
		viewMode: "list",
		collapsePatch: null,
	});
	assert.deepEqual(normalizeCampaignCardNotes([{ id: 1, title: "НПС" }]), [
		{ id: 1, title: "НПС", text: "", collapsed: false },
	]);
	assert.equal(getCampaignEntityRenderKey({ slug: "вартовий" }, 2), "вартовий");
	assert.equal(getCampaignHashTarget("#campaign-location-1"), "locations");
	assert.equal(
		getCampaignHashTarget("#campaign-npc-1/campaign-note-2"),
		"notes",
	);
	assert.equal(getCampaignHashTarget("#campaign-character-1/campaign-npc-2"), "characters");
	assert.equal(getCampaignHashTarget({ toString: () => "#campaign-npc-7" }), "npc");
	assert.equal(getCampaignHashTarget(0), null);
	const hashPlan = getCampaignHashNavigationPlan({
		hash: "#campaign-note-1",
		collapsed: { notes: true, characters: false, npc: false, locations: false },
	});
	assert.deepEqual(hashPlan, {
		target: "notes",
		shouldUseListView: true,
		sectionToExpand: "notes",
	});
	assert.deepEqual(
		getCampaignHashNavigationPlan({
			hash: "#campaign-location-1",
			collapsed: { notes: false, characters: false, npc: false, locations: false },
		}),
		{ target: "locations", shouldUseListView: false, sectionToExpand: null },
	);
	assert.deepEqual(
		getCampaignHashNavigationPlan({
			hash: "#other",
			collapsed: { notes: true, characters: true, npc: true, locations: true },
		}),
		{ target: null, shouldUseListView: false, sectionToExpand: null },
	);
	const hashEffects = [];
	executeCampaignHashNavigationPlan(hashPlan, {
		useListView: () => hashEffects.push("list"),
		expandSection: (target) => hashEffects.push(`expand:${target}`),
	});
	assert.deepEqual(hashEffects, ["list", "expand:notes"]);
	executeCampaignHashNavigationPlan(
		{ target: "npc", shouldUseListView: false, sectionToExpand: null },
		{
			useListView: () => hashEffects.push("unexpected-list"),
			expandSection: () => hashEffects.push("unexpected-expand"),
		},
	);
	assert.deepEqual(hashEffects, ["list", "expand:notes"]);

	const npcEntity = { id: 0, firstName: "Вартова", _aiIgnored: false };
	const locationEntity = { id: "0", name: "Брама" };
	const npcUpdate = getCampaignEntityAiIgnoredUpdate(
		"npc",
		0,
		true,
		[npcEntity],
		[locationEntity],
	);
	assert.deepEqual(npcUpdate, {
		kind: "npc",
		entityId: 0,
		entity: { id: 0, firstName: "Вартова", _aiIgnored: true },
	});
	assert.notEqual(npcUpdate.entity, npcEntity);
	assert.equal(npcEntity._aiIgnored, false);
	assert.deepEqual(
		getCampaignEntityAiIgnoredUpdate("locations", "0", false, [npcEntity], [locationEntity]),
		{
			kind: "locations",
			entityId: "0",
			entity: { id: "0", name: "Брама", _aiIgnored: false },
		},
	);
	assert.deepEqual(
		getCampaignEntityAiIgnoredUpdate("npc", "0", true, [npcEntity], [locationEntity]),
		{ kind: "none" },
	);
	assert.deepEqual(
		getCampaignEntityAiIgnoredUpdate("npc", undefined, true, [npcEntity], [locationEntity]),
		{ kind: "none" },
	);
	assert.deepEqual(
		getCampaignCharacterDropRequest(
			{ kind: "campaign-character", sourceType: "npc", id: 7 },
			"characters",
		),
		{ sourceType: "npc", targetType: "characters", id: 7 },
	);
	assert.equal(
		getCampaignCharacterDropRequest(
			{ kind: "campaign-character", sourceType: "location", id: 7 },
			"npc",
		),
		null,
	);
	assert.deepEqual(
		getCampaignCharacterDropRequest(
			{ kind: "campaign-character", sourceType: "characters", id: "" },
			"characters",
		),
		{ sourceType: "characters", targetType: "characters", id: "" },
	);
	assert.deepEqual(
		getCampaignCharacterDropRequest(
			{ kind: "campaign-character", sourceType: "npc", id: 0 },
			"npc",
		),
		{ sourceType: "npc", targetType: "npc", id: 0 },
	);
	for (const id of [Number.NaN, Number.POSITIVE_INFINITY]) {
		const request = getCampaignCharacterDropRequest(
			{ kind: "campaign-character", sourceType: "npc", id },
			"characters",
		);
		assert.equal(request.sourceType, "npc");
		assert.equal(request.targetType, "characters");
		assert.ok(Object.is(request.id, id));
	}
	for (const [payload, targetType] of [
		[null, "npc"],
		[undefined, "npc"],
		[{ sourceType: "npc", id: 1 }, "characters"],
		[{ kind: "other", sourceType: "npc", id: 1 }, "characters"],
		[{ kind: "campaign-character", sourceType: "NPC", id: 1 }, "characters"],
		[{ kind: "campaign-character", sourceType: "npc", id: 1 }, "Characters"],
		[{ kind: "campaign-character", sourceType: "npc", id: null }, "characters"],
		[{ kind: "campaign-character", sourceType: "npc", id: false }, "characters"],
		[{ kind: "campaign-character", sourceType: "npc", id: {} }, "characters"],
	]) {
		assert.equal(getCampaignCharacterDropRequest(payload, targetType), null);
	}
	assert.equal(isCampaignEditableTarget({ tagName: "INPUT" }), true);
	assert.equal(isCampaignEditableTarget({ tagName: "TEXTAREA" }), true);
	assert.equal(isCampaignEditableTarget({ isContentEditable: true }), true);
	assert.equal(isCampaignEditableTarget({ isContentEditable: "false" }), true);
	assert.equal(isCampaignEditableTarget({ tagName: "BUTTON" }), false);
	assert.equal(isCampaignEditableTarget({ tagName: "input" }), false);
	assert.equal(isCampaignEditableTarget(null), false);
	assert.equal(
		getCampaignKeyboardAction({
			code: "KeyZ",
			shiftKey: false,
			isHistoryShortcut: true,
			shouldUseAppHistory: false,
			isEditableTarget: true,
		}),
		"none",
	);
	assert.equal(
		getCampaignKeyboardAction({
			code: "KeyZ",
			shiftKey: false,
			isHistoryShortcut: true,
			shouldUseAppHistory: true,
			isEditableTarget: true,
		}),
		"undo",
	);
	assert.equal(
		getCampaignKeyboardAction({
			code: "KeyZ",
			shiftKey: true,
			isHistoryShortcut: true,
			shouldUseAppHistory: true,
			isEditableTarget: true,
		}),
		"redo",
	);
	assert.equal(
		getCampaignKeyboardAction({
			code: "KeyY",
			shiftKey: false,
			isHistoryShortcut: true,
			shouldUseAppHistory: false,
			isEditableTarget: false,
		}),
		"redo",
	);
	assert.equal(
		getCampaignKeyboardAction({
			code: "KeyZ",
			shiftKey: false,
			isHistoryShortcut: false,
			shouldUseAppHistory: false,
			isEditableTarget: false,
		}),
		"none",
	);
	assert.equal(
		getCampaignKeyboardAction({
			code: "KeyX",
			shiftKey: false,
			isHistoryShortcut: true,
			shouldUseAppHistory: false,
			isEditableTarget: false,
		}),
		"none",
	);
	const keyboardCases = [
		{
			input: {
				code: "KeyZ",
				shiftKey: false,
				isHistoryShortcut: true,
				shouldUseAppHistory: false,
				isEditableTarget: false,
			},
			action: "undo",
		},
		{
			input: {
				code: "KeyY",
				shiftKey: true,
				isHistoryShortcut: true,
				shouldUseAppHistory: false,
				isEditableTarget: false,
			},
			action: "redo",
		},
		{
			input: {
				code: "KeyY",
				shiftKey: false,
				isHistoryShortcut: true,
				shouldUseAppHistory: false,
				isEditableTarget: true,
			},
			action: "none",
		},
		{
			input: {
				code: "KeyY",
				shiftKey: false,
				isHistoryShortcut: true,
				shouldUseAppHistory: true,
				isEditableTarget: true,
			},
			action: "redo",
		},
		{
			input: {
				code: "keyz",
				shiftKey: true,
				isHistoryShortcut: true,
				shouldUseAppHistory: true,
				isEditableTarget: false,
			},
			action: "none",
		},
		{
			input: {
				code: "KeyY",
				shiftKey: false,
				isHistoryShortcut: false,
				shouldUseAppHistory: true,
				isEditableTarget: false,
			},
			action: "none",
		},
	];
	for (const { input, action } of keyboardCases) {
		assert.equal(getCampaignKeyboardAction(input), action);
	}
});

await run("partial campaign archive selection is typed, immutable, and ordered", () => {
	const initial = createDefaultPartialArchiveSelection();
	const withoutNpc = togglePartialArchiveSection(initial, "npc");
	const restored = togglePartialArchiveSection(withoutNpc, "npc");

	assert.equal(initial.has("npc"), true);
	assert.equal(withoutNpc.has("npc"), false);
	assert.deepEqual(getOrderedPartialArchiveSections(restored), [
		"sessions",
		"npc",
		"locations",
		"images",
		"aiHistory",
	]);
});

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
	assert.deepEqual(extractBracketMentions(null), []);
	assert.deepEqual(extractBracketMentions(17), []);
	assert.deepEqual(extractBracketMentions("Без дужок"), []);
	assert.deepEqual(
		extractBracketMentions("[] [   ] [ Один   Два ] [Один   Два] [Рядок\nдалі]"),
		["Один Два", "Один Два"],
	);
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
		sessions: [
			{ fileName: "s1.json", name: "Сесія 1" },
			{ name: "Сесія без файла" },
		],
		sessionDetails: {
			"s1.json": {
				id: "session-detail-1",
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
						{ id: "virtual-session-note", _isVirtual: true, text: "Чернетка" },
						{ id: "empty-session-note", title: "", text: "" },
					],
					scenes: [
						{
							id: "scene-1",
							texts: { summary: "[Герой Один] говорить з [NPC Один]." },
							notes: [
								{ id: "n1", text: "Поруч [Місто]." },
								{ id: "virtual-scene-note", _isVirtual: true, text: "Чернетка" },
								{ id: "empty-scene-note", title: "", text: "" },
							],
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
	const sessionNode = graph.nodes.find((node) => node.id === "session:s1.json");
	assert.equal(sessionNode?.sourceId, "session-detail-1");
	assert.deepEqual(sessionNode?.meta, { fileName: "s1.json" });
	assert.equal(
		graph.nodes.find((node) => node.id === "session:session-1")?.label,
		"Сесія без файла",
	);
	assert.deepEqual(
		graph.nodes.find(
			(node) => node.id === "session-npc:s1.json:session-npc",
		)?.meta,
		{
			fileName: "s1.json",
			parentId: "session:s1.json",
			scope: "session",
			sourceSlug: undefined,
		},
	);
	assert.deepEqual(
		graph.nodes.find(
			(node) => node.id === "session-location:s1.json:session-location",
		)?.meta,
		{
			fileName: "s1.json",
			parentId: "session:s1.json",
			scope: "session",
			sourceSlug: undefined,
		},
	);
	assert.deepEqual(
		graph.nodes.find(
			(node) => node.id === "session-note:s1.json:session-note",
		)?.meta,
		{
			fileName: "s1.json",
			parentId: "session:s1.json",
			isSimplifiedNote: false,
		},
	);
	assert.deepEqual(
		graph.nodes.find((node) => node.id === "scene-note:s1.json:scene-1:n1")
			?.meta,
		{
			fileName: "s1.json",
			sceneId: "scene-1",
			sceneNumber: 1,
			parentId: "scene:s1.json:scene-1",
			isSimplifiedNote: false,
		},
	);
	assert.equal(
		graph.nodes.some((node) => String(node.id).includes("virtual-")),
		false,
	);
	assert.equal(
		graph.nodes.some((node) => String(node.id).includes("empty-")),
		false,
	);
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
	const sequenceEdge = graph.edges.find(
		(edge) =>
			edge.relation === "sequence" &&
			edge.source === "scene:s1.json:scene-1" &&
			edge.target === "scene:s1.json:scene-2",
	);
	assert.ok(sequenceEdge);
	assert.deepEqual(sequenceEdge.sources, [
		{ type: "session", label: "Сесія 1", field: "scenes" },
	]);
	assert.equal(graph.stats.unresolved, 1);

	const simplifiedGraph = buildCampaignGraph({
		campaign: { slug: "camp", name: "Кампанія" },
		notes: [{ id: 1, title: "Прихований заголовок", text: "Текст нотатки." }],
		sessions: [{ fileName: "simple.json", name: "Спрощена сесія" }],
		sessionDetails: {
			"simple.json": {
				data: {
					notes: [
						{ id: "simple-session-note", title: "Заголовок", text: "Текст сесії." },
					],
					scenes: [
						{
							id: "simple-scene",
							notes: [
								{ id: "simple-scene-note", title: "Сцена", text: "Текст сцени." },
							],
						},
					],
				},
			},
		},
		simplifiedNotes: true,
	});
	assert.equal(
		simplifiedGraph.nodes.find((node) => node.type === "campaign-note")?.label,
		"Текст нотатки.",
	);
	assert.equal(
		simplifiedGraph.nodes.find((node) => node.type === "session-note")?.label,
		"Текст сесії.",
	);
	assert.equal(
		simplifiedGraph.nodes.find((node) => node.type === "scene-note")?.label,
		"Текст сцени.",
	);
});

await run("campaign graph scene projection preserves text identity and mention scope", () => {
	const graph = buildCampaignGraph({
		campaign: { slug: "scene-projection", name: "Проєкція" },
		sessions: [{ fileName: "projection.json", name: "Сесія" }],
		sessionDetails: {
			"projection.json": {
				data: {
					scenes: [{
						description: "[Не індексувати поза texts]",
						texts: {
							summary: "Коротко [Ціль у texts]",
							goal: "Знайти браму",
							location: "Старий ліс",
							stakes: "Висока ціна",
							extra: "Додаткова деталь",
						},
						notes: [{ id: "note", text: "Нотатка сцени" }],
					}],
				},
			},
		},
	});
	const scene = graph.nodes.find((node) => node.id === "scene:projection.json:0");
	assert.equal(scene?.label, "Сесія: Scene 1");
	assert.equal(scene?.summary, "Коротко [Ціль у texts] Знайти браму Старий ліс Висока ціна");
	assert.equal(
		scene?.detailText,
		"Коротко [Ціль у texts]\n\nЗнайти браму\n\nСтарий ліс\n\nВисока ціна\n\nДодаткова деталь",
	);
	assert.deepEqual(scene?.aliases, ["Scene 1", "Сесія Scene 1"]);
	assert.deepEqual(scene?.meta, {
		fileName: "projection.json",
		parentId: "session:projection.json",
		sceneNumber: 1,
	});
	assert.equal(graph.nodes.some((node) => node.label === "Ціль у texts"), true);
	assert.equal(graph.nodes.some((node) => node.label === "Не індексувати поза texts"), false);
	assert.equal(
		graph.nodes.some((node) => node.id === "scene-note:projection.json:0:note"),
		true,
	);
});

await run("campaign graph recursive text collection preserves paths and ignored keys", () => {
	const graph = buildCampaignGraph({
		campaign: { slug: "recursive-text", name: "Рекурсія" },
		characters: [{
			id: "hero",
			name: "Героїня",
			profile: {
				public: ["[Видимий зв'язок]", { deep: "[Глибокий зв'язок]" }, 17, true, null],
				_private: "[Приватний зв'язок]",
				imageUrl: "[Зображення]",
				blank: "   ",
			},
		}],
	});
	for (const label of ["Видимий зв'язок", "Глибокий зв'язок"]) {
		assert.equal(graph.nodes.some((node) => node.label === label), true);
	}
	for (const label of ["Приватний зв'язок", "Зображення"]) {
		assert.equal(graph.nodes.some((node) => node.label === label), false);
	}
	const visibleEdge = graph.edges.find((edge) =>
		edge.relation === "mentions" &&
		graph.nodes.some((node) => node.id === edge.target && node.label === "Видимий зв'язок")
	);
	const deepEdge = graph.edges.find((edge) =>
		edge.relation === "mentions" &&
		graph.nodes.some((node) => node.id === edge.target && node.label === "Глибокий зв'язок")
	);
	assert.equal(visibleEdge?.sources[0]?.field, "character.profile.public[0]");
	assert.equal(deepEdge?.sources[0]?.field, "character.profile.public[1].deep");
});

await run("campaign graph registry preserves first nodes canonical edges and degrees", () => {
	const graph = buildCampaignGraph({
		campaign: { slug: "registry", name: "Реєстр" },
		description: "[Зета] зустрічає [Альфа] і знову [Зета].",
		notes: [{ id: "note", text: "[Альфа] відповідає [Зета]." }],
		characters: [
			{ id: "duplicate", firstName: "Перша", description: "Перший опис" },
			{ id: "duplicate", firstName: "Друга", description: "Другий опис" },
			{ id: "fallback", firstName: "   ", name: 0, title: "Титул" },
		],
	});
	const duplicateNodes = graph.nodes.filter((node) => node.id === "character:duplicate");
	assert.equal(duplicateNodes.length, 1);
	assert.equal(duplicateNodes[0].label, "Перша");
	assert.equal(duplicateNodes[0].detailText, "Перший опис");
	assert.equal(graph.nodes.find((node) => node.id === "character:fallback")?.label, "Титул");
	assert.equal(graph.nodes.filter((node) => node.type === "unresolved").length, 2);

	const alpha = graph.nodes.find((node) => node.label === "Альфа");
	const zeta = graph.nodes.find((node) => node.label === "Зета");
	assert.ok(alpha);
	assert.ok(zeta);
	const related = graph.edges.find((edge) => edge.relation === "related");
	assert.deepEqual([related?.source, related?.target], [alpha.id, zeta.id].sort());
	assert.equal(related?.count, 2);
	assert.deepEqual(related?.sources.map((source) => source.type), ["campaign", "campaign-note"]);
	assert.equal(graph.edges.filter((edge) => edge.relation === "related").length, 1);
	assert.equal(alpha.degree, 3);
	assert.equal(zeta.degree, 3);
	assert.equal(graph.stats.unresolved, 2);
	assert.equal(graph.stats.nodes, graph.nodes.length);
	assert.equal(graph.stats.edges, graph.edges.length);
});

await run("campaign graph notes preserve eligibility label modes and fallback", () => {
	const regular = buildCampaignGraph({
		campaign: { slug: "note-labels", name: "Нотатки" },
		notes: [
			{ id: "title", title: "  Заголовок  ", text: "Текст" },
			{ id: "markdown", text: "```прихований код```" },
			{ id: "virtual", _isVirtual: true, text: "Чернетка" },
			{ id: "empty", title: "  ", text: "\n" },
		],
	});
	assert.equal(regular.nodes.find((node) => node.id === "campaign-note:title")?.label, "Заголовок");
	assert.equal(regular.nodes.find((node) => node.id === "campaign-note:markdown")?.label, "Note 2");
	assert.equal(regular.nodes.some((node) => node.id === "campaign-note:virtual"), false);
	assert.equal(regular.nodes.some((node) => node.id === "campaign-note:empty"), false);

	const simplified = buildCampaignGraph({
		campaign: { slug: "simple-note", name: "Спрощення" },
		notes: [{ id: "simple", title: "Не показувати", text: "**Видимий текст**" }],
		simplifiedNotes: true,
	});
	const simplifiedNote = simplified.nodes.find((node) => node.id === "campaign-note:simple");
	assert.equal(simplifiedNote?.label, "Видимий текст");
	assert.deepEqual(simplifiedNote?.aliases, []);
	assert.equal(simplifiedNote?.meta.isSimplifiedNote, true);
});

await run("campaign graph session detail preserves participant note and scene order", () => {
	const graph = buildCampaignGraph({
		campaign: { slug: "session-order", name: "Порядок" },
		sessions: [{ fileName: "ordered.json", name: "Сесія" }],
		sessionDetails: {
			"ordered.json": {
				data: {
					npcs: [{ id: "npc", name: "NPC" }],
					locations: [{ id: "location", name: "Локація" }],
					notes: [{ id: "note", text: "Нотатка" }],
					scenes: [{ id: "scene", texts: { summary: "Сцена" } }],
				},
			},
		},
	});
	const orderedIds = [
		"session:ordered.json",
		"session-npc:ordered.json:npc",
		"session-location:ordered.json:location",
		"session-note:ordered.json:note",
		"scene:ordered.json:scene",
	];
	assert.deepEqual(
		orderedIds.map((id) => graph.nodes.findIndex((node) => node.id === id)),
		[1, 2, 3, 4, 5],
	);
	assert.equal(graph.edges.find((edge) => edge.source === "session:ordered.json" && edge.target === "scene:ordered.json:scene")?.sources[0]?.field, "scenes");
});

await run("campaign graph session detail lookup preserves record map and array sources", () => {
	const detail = (id, marker) => ({
		id,
		fileName: "lookup.json",
		data: { result_text: marker },
	});
	const buildWithDetails = (sessionDetails) => buildCampaignGraph({
		campaign: { slug: "lookup", name: "Пошук" },
		sessions: [{ fileName: "lookup.json", name: "Список" }],
		sessionDetails,
	});
	const recordGraph = buildWithDetails({ "lookup.json": detail("record-id", "Record marker") });
	const mapGraph = buildWithDetails(new Map([["lookup.json", detail("map-id", "Map marker")]]));
	const arrayGraph = buildWithDetails([
		{ fileName: "other.json", id: "other" },
		detail("array-first", "Array first marker"),
		detail("array-second", "Array second marker"),
	]);
	assert.equal(recordGraph.nodes.find((node) => node.type === "session")?.sourceId, "record-id");
	assert.equal(mapGraph.nodes.find((node) => node.type === "session")?.sourceId, "map-id");
	assert.equal(arrayGraph.nodes.find((node) => node.type === "session")?.sourceId, "array-first");
	assert.equal(arrayGraph.nodes.some((node) => node.searchText.includes("array second marker")), false);
	assert.equal(buildWithDetails(new Map()).nodes.find((node) => node.type === "session")?.sourceId, undefined);
});

await run("campaign graph flow-node projection preserves positions visibility and collisions", () => {
	const graphNode = {
		id: "session:one",
		type: "session",
		label: "Сесія",
		meta: {},
		searchText: "сесія",
		degree: 0,
	};
	const currentPosition = { x: 40, y: 50 };
	const presentation = getCampaignGraphFlowNodePresentation({
		graphNode,
		currentNode: { id: graphNode.id, position: currentPosition },
		layoutPosition: { x: 400, y: 500 },
		selectedNodeId: graphNode.id,
		focusedNodeId: "another",
		connectedIds: new Set(["another"]),
		visibleNodeIds: new Set(),
		canSaveNote: false,
		colors: { session: "#123456" },
		typeLabels: { session: "Sessions" },
	});
	assert.equal(presentation.position, currentPosition);
	assert.deepEqual(presentation.size, getCampaignGraphNodeSize("session"));
	assert.deepEqual({
		color: presentation.color,
		typeLabelKey: presentation.typeLabelKey,
		isSelected: presentation.isSelected,
		isMuted: presentation.isMuted,
		canOpen: presentation.canOpen,
		hidden: presentation.hidden,
		className: presentation.className,
	}, {
		color: "#123456",
		typeLabelKey: "Sessions",
		isSelected: true,
		isMuted: true,
		canOpen: true,
		hidden: true,
		className: "is_session",
	});
	assert.deepEqual(getCampaignGraphFlowNodePresentation({
		graphNode: { ...graphNode, id: "unknown", type: "unknown" },
		layoutPosition: { x: 8, y: 9 },
		selectedNodeId: null,
		focusedNodeId: null,
		connectedIds: new Set(),
		visibleNodeIds: new Set(["unknown"]),
		canSaveNote: false,
		colors: {},
		typeLabels: {},
	}).position, { x: 8, y: 9 });

	const nodes = [
		{ id: "existing", position: { x: 40, y: 0 }, measured: { width: 420, height: 90 }, data: { graphNode: { type: "npc" } } },
		{ id: "new", position: { x: 0, y: 0 }, data: { graphNode: { type: "campaign-note" } } },
	];
	const originalNodes = structuredClone(nodes);
	assert.equal(resolveNewCampaignGraphNodeCollisions(nodes, new Set(), true), nodes);
	const resolved = resolveNewCampaignGraphNodeCollisions(nodes, new Set(["existing"]), false);
	assert.deepEqual(nodes, originalNodes);
	assert.equal(resolved[0], nodes[0]);
	assert.notDeepEqual(resolved[1].position, nodes[1].position);
	assert.equal(resolveNewCampaignGraphNodeCollisions(nodes, new Set(["existing", "new"]), false), nodes);
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
	assert.equal(
		getMultiSelectLabel({
			selectedCount: 1,
			optionCount: 2,
			labelOverride: "Джерела",
			placeholder: "Оберіть",
			allSelectedLabel: "Усі",
			noneSelectedLabel: "Жодного",
		}),
		"Джерела",
	);
	assert.equal(
		getMultiSelectLabel({
			selectedCount: 2,
			optionCount: 2,
			labelOverride: "",
			placeholder: "Оберіть",
			allSelectedLabel: "Усі",
			noneSelectedLabel: "Жодного",
		}),
		"Усі",
	);
	assert.equal(
		getMultiSelectLabel({
			selectedCount: 0,
			optionCount: 2,
			labelOverride: "",
			placeholder: "Оберіть",
			allSelectedLabel: "Усі",
			noneSelectedLabel: "Жодного",
		}),
		"Жодного",
	);
	assert.equal(
		getMultiSelectLabel({
			selectedCount: 1,
			optionCount: 2,
			labelOverride: "",
			placeholder: "Оберіть",
			allSelectedLabel: "Усі",
			noneSelectedLabel: "Жодного",
		}),
		"1 / 2",
	);
	assert.deepEqual(
		getMultiSelectOptionPresentation("PHB", selection, "PHB"),
		{ optionKey: "PHB", isSelected: true, isActive: true },
	);
	assert.deepEqual(
		getMultiSelectOptionPresentation("DMG", selection, "all"),
		{ optionKey: "DMG", isSelected: false, isActive: false },
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

	assert.deepEqual(
		getDraggableFinishPlan({
			originalItems: items,
			sourceIndex: 0,
			targetIndex: 2,
			visitedDifferentTarget: true,
			keyExtractor,
			payload: { entityId: "істота" },
			clientX: 24,
			clientY: 42,
			sourceListId: "список",
		}),
		{
			items: reordered,
			hasReordered: true,
			dropDetail: {
				payload: { entityId: "істота" },
				clientX: 24,
				clientY: 42,
				sourceListId: "список",
			},
		},
	);
	assert.deepEqual(
		getDraggableFinishPlan({
			originalItems: items,
			sourceIndex: 0,
			targetIndex: 0,
			visitedDifferentTarget: true,
			keyExtractor,
			payload: 0,
			clientX: 1,
			clientY: 2,
			sourceListId: "list",
		}),
		{ items, hasReordered: false, dropDetail: null },
	);
	assert.deepEqual(
		getDraggableFinishPlan({
			originalItems: items,
			sourceIndex: 0,
			targetIndex: 0,
			visitedDifferentTarget: false,
			keyExtractor,
			payload: "external",
			clientX: 3,
			clientY: 4,
			sourceListId: "list",
		}),
		{
			items,
			hasReordered: false,
			dropDetail: {
				payload: "external",
				clientX: 3,
				clientY: 4,
				sourceListId: "list",
			},
		},
	);

	const callbackOrder = [];
	const finishPlan = getDraggableFinishPlan({
		originalItems: items,
		sourceIndex: 0,
		targetIndex: 2,
		visitedDifferentTarget: true,
		keyExtractor,
		payload: "entity",
		clientX: 5,
		clientY: 6,
		sourceListId: "list",
	});
	applyDraggableFinishPlan(finishPlan, {
		onReorder: (nextItems) => callbackOrder.push(["reorder", nextItems]),
		onCustomDrop: (detail) => callbackOrder.push(["custom", detail]),
		onDrop: (nextItems) => callbackOrder.push(["drop", nextItems]),
	});
	assert.deepEqual(callbackOrder.map(([name]) => name), [
		"reorder",
		"custom",
		"drop",
	]);

	const externalOnlyOrder = [];
	applyDraggableFinishPlan(
		{
			items,
			hasReordered: false,
			dropDetail: {
				payload: "entity",
				clientX: 5,
				clientY: 6,
				sourceListId: "list",
			},
		},
		{
			onReorder: () => externalOnlyOrder.push("reorder"),
			onCustomDrop: () => externalOnlyOrder.push("custom"),
			onDrop: () => externalOnlyOrder.push("drop"),
		},
	);
	assert.deepEqual(externalOnlyOrder, ["custom"]);
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
	const collapsedPresentation = getNoteCardPresentation(
		{ id: "collapsed", title: "План", text: "", collapsed: true },
		false,
		true,
	);
	assert.equal(
		shouldExpandNoteFromCardClick(collapsedPresentation, true),
		true,
	);
	assert.equal(
		shouldExpandNoteFromCardClick(collapsedPresentation, false),
		false,
	);
	assert.equal(
		shouldExpandNoteFromCardClick(
			{ canCollapse: true, isCollapsed: false },
			true,
		),
		false,
	);
	assert.equal(
		shouldExpandNoteFromCardClick(
			{ canCollapse: false, isCollapsed: true },
			true,
		),
		false,
	);
	assert.equal(isNoteCardFieldHighlighted(["title"], "title"), true);
	assert.equal(isNoteCardFieldHighlighted(["title"], "text"), false);
	assert.equal(isNoteCardFieldHighlighted(undefined, "text"), false);

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
	assert.deepEqual(
		getModalPresentationPlan({
			showFooter: true,
			hasCancelHandler: false,
			type: "error",
			hasConfirmLabel: false,
		}),
		{
			showFooter: true,
			showCancel: false,
			confirmVariant: "danger",
			confirmLabelKind: "ok",
		},
	);
	assert.deepEqual(
		getModalPresentationPlan({
			showFooter: false,
			hasCancelHandler: true,
			type: "confirm",
			hasConfirmLabel: true,
		}),
		{
			showFooter: false,
			showCancel: true,
			confirmVariant: "primary",
			confirmLabelKind: "custom",
		},
	);
	assert.equal(
		getModalPresentationPlan({
			showFooter: true,
			hasCancelHandler: true,
			hasConfirmLabel: false,
		}).confirmLabelKind,
		"confirm",
	);

	const closeEvents = [];
	assert.equal(
		executeModalClose({
			cancelDisabled: true,
			onCancel: () => closeEvents.push("cancel"),
			onConfirm: () => closeEvents.push("confirm"),
			blurActiveElement: () => closeEvents.push("blur"),
		}),
		"blocked",
	);
	assert.deepEqual(closeEvents, []);
	assert.equal(
		executeModalClose({
			cancelDisabled: false,
			onCancel: () => closeEvents.push("cancel"),
			onConfirm: () => closeEvents.push("confirm"),
			blurActiveElement: () => closeEvents.push("blur"),
		}),
		"cancel",
	);
	assert.deepEqual(closeEvents, ["blur", "cancel"]);
	closeEvents.length = 0;
	assert.equal(
		executeModalClose({
			cancelDisabled: false,
			onCancel: null,
			onConfirm: () => closeEvents.push("confirm"),
			blurActiveElement: () => closeEvents.push("blur"),
		}),
		"confirm",
	);
	assert.deepEqual(closeEvents, ["blur", "confirm"]);

	const keyboardEvents = [];
	executeModalKeyboardPlan(
		{ preventDefault: true, action: "confirm" },
		{
			preventDefault: () => keyboardEvents.push("prevent"),
			onClose: () => keyboardEvents.push("close"),
			onConfirm: () => keyboardEvents.push("confirm"),
		},
	);
	assert.deepEqual(keyboardEvents, ["prevent", "confirm"]);
	keyboardEvents.length = 0;
	executeModalKeyboardPlan(
		{ preventDefault: false, action: "close" },
		{
			preventDefault: () => keyboardEvents.push("prevent"),
			onClose: () => keyboardEvents.push("close"),
			onConfirm: () => keyboardEvents.push("confirm"),
		},
	);
	assert.deepEqual(keyboardEvents, ["close"]);
	keyboardEvents.length = 0;
	executeModalKeyboardPlan(
		{ preventDefault: true, action: null },
		{
			preventDefault: () => keyboardEvents.push("prevent"),
			onClose: () => keyboardEvents.push("close"),
			onConfirm: () => keyboardEvents.push("confirm"),
		},
	);
	assert.deepEqual(keyboardEvents, ["prevent"]);

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
	assert.equal(getQuestionDiceRoll(null, 100), null);
	assert.equal(getQuestionDiceRoll({ ...rolledResult, resultId: 0 }, 100), null);
	assert.deepEqual(
		getQuestionDiceRoll(
			{ ...rolledResult, resultId: { id: "кидок" }, result: { total: 1 } },
			1,
		),
		{ resultId: { id: "кидок" }, questionId: 1 },
	);
	assert.deepEqual(
		getQuestionDiceRoll(
			{ ...rolledResult, context: { type: "encounter" } },
			100,
		),
		{ resultId: 7, questionId: null },
	);
	assert.deepEqual(
		getQuestionDiceRoll({ ...rolledResult, result: { total: "1.5" } }, 100),
		{ resultId: 7, questionId: null },
	);
	assert.deepEqual(
		getQuestionDiceRoll({ ...rolledResult, result: { total: 101 } }, 100),
		{ resultId: 7, questionId: null },
	);
	assert.deepEqual(
		getQuestionDiceRoll({ ...rolledResult, result: "invalid" }, 100),
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

await run("AI monster encounter workflows preserve identity and persistence ownership", async () => {
	const localPlan = getMonsterFieldSavePlan(
		"local-edit",
		{ instanceId: "вовк-1", id: "wolf", participantType: "monster" },
		{ name: "Крижаний вовк", hit_points: 18 },
	);
	assert.deepEqual(localPlan, {
		kind: "local",
		instanceId: "вовк-1",
		monster: {
			name: "Крижаний вовк",
			hit_points: 18,
			instanceId: "вовк-1",
			id: "wolf",
			participantType: "monster",
		},
	});

	const createPlan = getMonsterFieldSavePlan(
		"create-based",
		{ instanceId: "вовк-1", name: "Вовк" },
		{ name: " Крижаний вовк ", hit_points: 18 },
	);
	assert.equal(createPlan.kind, "persistent");
	assert.equal(createPlan.normalizedName, "крижаний вовк");
	const saved = await persistMonsterFieldSavePlan(
		createPlan,
		{
			getCustomBestiaryData: async () => [{ name: "Вартовий", source: "CUSTOM" }],
			updateCustomBestiaryMonster: async () => null,
			replaceCustomBestiaryMonsters: async (monsters) => monsters,
		},
		"duplicate",
	);
	assert.equal(saved.name, " Крижаний вовк ");
	assert.equal(saved.source, "CUSTOM");

	const generationPlan = getMonsterAiGenerationPlan(
		"local-edit",
		"Додай морозний укус",
		{ instanceId: "вовк-1", name: "Вовк" },
		(value) => value,
	);
	const payload = buildMonsterAiRequestPayload({
		plan: generationPlan,
		modelName: "gemini-test",
		campaignSlug: "кампанія",
		sessionId: "сесія.json",
		encounterId: "бій-1",
		monster: { instanceId: "вовк-1", name: "Вовк" },
		targetInstanceId: null,
		language: "uk",
	});
	assert.equal(payload.historyMode, "encounter");
	assert.equal(payload.targetInstanceId, "вовк-1");
	assert.equal(payload.customMonsterMode, "create-based");
});

await run("encounter AI result lifecycles preserve callback order, failures, and UTF-8", async () => {
	const events = [];
	applyEncounterGeneratedMonsterResult(
		{ updated: { monsters: [{ name: "Крижаний вовк", hit_points: 18 }] } },
		{ instanceId: "вовк-1", name: "Вовк" },
		"global",
		"вовк-1",
		{
			onDraftMode: (mode) => events.push(["draft-mode", mode]),
			onDraftEntry: (entry) => events.push(["draft-entry", entry]),
			onMonsterUpdate: (id, monster) => events.push(["monster", id, monster.name]),
		},
	);
	assert.deepEqual(events, [["monster", "вовк-1", "Крижаний вовк"]]);

	const localEntry = { id: "історія-1", changes: { resources: [] } };
	applyEncounterMonsterRestoreResult(
		{ response: localEntry, updated: { data: { encounters: [] } } },
		{ id: "fallback", changes: { resources: [] } },
		"local",
		"apply",
		undefined,
		"вовк-1",
		{
			onEntry: (entry) => events.push(["entry", entry.id]),
			onLocalUpdate: () => events.push(["local-update"]),
			onMonsterUpdate: () => events.push(["unexpected-monster"]),
		},
	);
	assert.deepEqual(events.slice(-2), [["entry", "історія-1"], ["local-update"]]);

	const abortEvents = [];
	const abortError = new Error("Скасовано");
	abortError.name = "AbortError";
	await executeMonsterAiRequest(new AbortController(), {
		request: async () => { throw abortError; },
		onResult: () => abortEvents.push("result"),
		onError: (message) => abortEvents.push(message),
		onComplete: () => abortEvents.push("complete"),
	});
	assert.deepEqual(abortEvents, ["complete"]);

	const restoreEvents = [];
	const restoreError = new Error("Не вдалося відновити істоту");
	await executeEncounterAiRestoreRequest({
		request: async () => { throw restoreError; },
		onResult: () => restoreEvents.push("result"),
		onError: (error) => restoreEvents.push(error.message),
		onComplete: () => restoreEvents.push("complete"),
	});
	assert.deepEqual(restoreEvents, ["Не вдалося відновити істоту", "complete"]);
});

await run("AI monster edit plans preserve draft scopes, edit identity, and save ordering", async () => {
	assert.deepEqual(
		getMonsterFieldEditPlan("image-prompt", { instanceId: "вовк-1" }, "Істота"),
		{ kind: "none" },
	);
	const editPlan = getMonsterFieldEditPlan(
		"create-based",
		{ instanceId: "вовк-1", name: "", source: "MM" },
		"Істота",
	);
	assert.equal(editPlan.kind, "edit");
	assert.equal(editPlan.original.instanceId, "вовк-1");
	assert.deepEqual(editPlan.monster, {
		instanceId: "вовк-1",
		name: "Істота",
		source: "CUSTOM",
	});

	const resources = [{ id: "ресурс-1", after: { name: "Крижаний вовк" } }];
	assert.equal(getMonsterAiDraftSavePlan(0, "local", "кампанія", resources), null);
	const localDraftPlan = getMonsterAiDraftSavePlan(7, "local", "кампанія", resources);
	assert.deepEqual(localDraftPlan, {
		scope: "кампанія",
		entryId: 7,
		resources,
		acceptEmptyResult: true,
	});
	const draftEntries = [];
	assert.equal(applyMonsterAiDraftSaveResult(localDraftPlan, null, (entry) => draftEntries.push(entry)), null);
	assert.deepEqual(draftEntries, [null]);
	assert.equal(getMonsterAiDraftSavePlan(null, "global", "кампанія", resources), null);
	assert.deepEqual(
		getMonsterAiRestoreRequestPlan(7, false, "global", "кампанія", "undo", ["ресурс-1"]),
		{ scope: "bestiary", entryId: 7, action: "undo", resourceIds: ["ресурс-1"] },
	);
	assert.equal(getMonsterAiRestoreRequestPlan(7, true, "global", "кампанія", "apply"), null);

	const saveEvents = [];
	await executeMonsterFieldSavePlan(
		{
			kind: "local",
			instanceId: "вовк-1",
			monster: { instanceId: "вовк-1", name: "Крижаний вовк" },
		},
		{},
		"Дублікат",
		{
			onLocal: (id, monster) => saveEvents.push(["local", id, monster.name]),
			onPersistent: () => saveEvents.push(["persistent"]),
			onRefresh: () => saveEvents.push(["refresh"]),
			onClose: () => saveEvents.push(["close"]),
			onError: () => saveEvents.push(["error"]),
		},
	);
	assert.deepEqual(saveEvents, [["local", "вовк-1", "Крижаний вовк"], ["close"]]);
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
			draft: { name: "Ignored" },
			jsonText: JSON.stringify({ name: 42 }),
			editMode: "json",
			source: "CUSTOM",
		}),
		{ ok: true, monster: { name: "42", source: "CUSTOM" } },
	);
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
	assert.deepEqual(
		getCampaignGraphFlowNodeSize({
			type: "campaign-note",
			measured: { width: 210, height: -1 },
			width: 220,
			height: "84px",
			style: { width: 230, height: 90 },
		}),
		{ width: 210, height: 84 },
	);
	assert.deepEqual(
		getCampaignGraphFlowNodeSize({
			measured: { width: Number.POSITIVE_INFINITY, height: 0 },
			width: -10,
			height: Number.NaN,
			style: { width: "220.5px", height: "72.25rem" },
			data: { graphNode: { type: "location" } },
		}),
		{ width: 220.5, height: 72.25 },
	);
	assert.deepEqual(
		getCampaignGraphFlowNodeSize({
			width: 0,
			height: "invalid",
			data: { graphNode: { type: "location" } },
		}),
		{ width: 190, height: 68 },
	);
	assert.deepEqual(
		getCampaignGraphFlowNodeSize({
			type: "unknown",
			data: { graphNode: { type: "campaign" } },
		}),
		{ width: 176, height: 64 },
	);

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

	assert.deepEqual(layoutCampaignGraph(null, null), {});
	const normalizedNodes = [
		{ id: 0, type: "campaign" },
		{ id: "npc", type: "npc" },
		{ id: null, type: "location" },
	];
	const disconnectedLayout = layoutCampaignGraph(normalizedNodes, []);
	assert.deepEqual(Object.keys(disconnectedLayout).sort(), ["0", "npc"]);
	assert.deepEqual(disconnectedLayout["0"], { x: 0, y: 0 });
	assert.deepEqual(
		layoutCampaignGraph(normalizedNodes, [
			{ id: "self", source: "npc", target: "npc", relation: "contains" },
			{ id: "missing", source: "npc", target: "missing", relation: "mentions" },
		]),
		disconnectedLayout,
	);
	assert.deepEqual(
		layoutCampaignGraph(normalizedNodes, [
			{ id: "edge", source: { id: 0 }, target: { id: "npc" }, relation: "contains" },
		]),
		layoutCampaignGraph(normalizedNodes, [
			{ id: "edge", source: "0", target: "npc", relation: "contains" },
		]),
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
	assert.deepEqual(resolveCampaignGraphNodeCollision(null, "missing"), { x: 0, y: 0 });
	assert.deepEqual(
		resolveCampaignGraphNodeCollision([
			{ id: "hidden", hidden: true, position: { x: 5, y: Number.POSITIVE_INFINITY } },
		], "hidden"),
		{ x: 5, y: 0 },
	);
	assert.deepEqual(
		resolveCampaignGraphNodeCollision(flowNodes, "dragged", -5),
		resolveCampaignGraphNodeCollision(flowNodes, "dragged", 0),
	);
	assert.deepEqual(
		resolveCampaignGraphNodeCollision(flowNodes, "dragged", Number.NaN),
		resolveCampaignGraphNodeCollision(flowNodes, "dragged", 16),
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

await run(
	"AI ignored-note merge preserves identity anchors collisions and malformed inputs",
	() => {
		const visibleA = { id: "a", title: "Оновлена A" };
		const visibleB = { id: "b", title: "Оновлена B" };
		const visibleNotes = [visibleA, visibleB];
		assert.strictEqual(
			aiPatchService.mergeAiIgnoredNotes([{ id: "a" }], visibleNotes),
			visibleNotes,
		);
		assert.strictEqual(
			aiPatchService.mergeAiIgnoredNotes(null, visibleNotes),
			visibleNotes,
		);

		const hiddenBefore = {
			id: "hidden-before",
			title: "Прихована до",
			_aiIgnored: true,
		};
		const hiddenMiddleOne = {
			id: "hidden-middle-1",
			title: "Перша прихована",
			_aiIgnored: true,
		};
		const hiddenMiddleTwo = {
			id: "hidden-middle-2",
			title: "Друга прихована",
			_aiIgnored: true,
		};
		const hiddenAfter = {
			id: "hidden-after",
			title: "Прихована після",
			_aiIgnored: true,
		};
		const anchoredExisting = [
			hiddenBefore,
			{ id: "a" },
			hiddenMiddleOne,
			hiddenMiddleTwo,
			{ id: "b" },
			hiddenAfter,
		];
		const anchoredSnapshot = structuredClone(anchoredExisting);
		const visibleSnapshot = structuredClone(visibleNotes);
		const anchored = aiPatchService.mergeAiIgnoredNotes(
			anchoredExisting,
			visibleNotes,
		);
		assert.deepEqual(anchored, [
			hiddenBefore,
			visibleA,
			hiddenMiddleOne,
			hiddenMiddleTwo,
			visibleB,
			hiddenAfter,
		]);
		assert.strictEqual(anchored[1], visibleA);
		assert.strictEqual(anchored[4], visibleB);
		assert.deepEqual(anchoredExisting, anchoredSnapshot);
		assert.deepEqual(visibleNotes, visibleSnapshot);

		const hiddenNumeric = { id: 0, title: "Нуль", _aiIgnored: true };
		const hiddenDuplicateOne = {
			id: "duplicate",
			title: "Дублікат 1",
			_aiIgnored: true,
		};
		const hiddenDuplicateTwo = {
			id: "duplicate",
			title: "Дублікат 2",
			_aiIgnored: true,
		};
		const hiddenEmptyId = {
			id: "   ",
			title: "Порожній ID",
			_aiIgnored: true,
		};
		const collisionResult = aiPatchService.mergeAiIgnoredNotes(
			[
				{ id: "anchor" },
				hiddenNumeric,
				hiddenDuplicateOne,
				hiddenDuplicateTwo,
				hiddenEmptyId,
			],
			[
				{ id: "anchor" },
				{ id: "0", title: "AI collision" },
				{ id: "duplicate", title: "AI collision" },
				{ id: "", title: "Empty ID remains visible" },
				{ id: "keep" },
			],
		);
		assert.deepEqual(
			collisionResult.map((note) => note.id),
			["anchor", 0, "duplicate", "duplicate", "   ", "", "keep"],
		);
		assert.strictEqual(collisionResult[1], hiddenNumeric);
		assert.strictEqual(collisionResult[2], hiddenDuplicateOne);
		assert.strictEqual(collisionResult[3], hiddenDuplicateTwo);
		assert.strictEqual(collisionResult[4], hiddenEmptyId);

		const fallbackOne = { id: "fallback-1", _aiIgnored: true };
		const fallbackTwo = { id: "fallback-2", _aiIgnored: true };
		assert.deepEqual(
			aiPatchService.mergeAiIgnoredNotes(
				[
					{ id: "missing-before" },
					fallbackOne,
					fallbackTwo,
					{ id: "missing-after" },
				],
				[{ id: "survivor" }],
			),
			[{ id: "survivor" }, fallbackOne, fallbackTwo],
		);
		assert.deepEqual(
			aiPatchService.mergeAiIgnoredNotes([hiddenBefore], null),
			[hiddenBefore],
		);
		assert.deepEqual(
			aiPatchService.mergeAiIgnoredNotes([hiddenBefore], { bad: true }),
			[hiddenBefore],
		);
	},
);

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

await run(
	"AI system instruction policies preserve section order modes and exclusions",
	() => {
		const assertSectionOrder = (instruction, markers) => {
			let previousIndex = -1;
			for (const marker of markers) {
				const index = instruction.indexOf(marker);
				assert.ok(index > previousIndex, `${marker} must follow prior sections`);
				previousIndex = index;
			}
		};
		const sceneInstruction = buildSystemInstruction({
			useKey: "scene",
			responseLanguage: { label: "Українська" },
			usesStructuredJsonContract: true,
			simplifiedNotesEnabled: true,
			effectiveParseAIResponse: true,
			npcGenerationEnabled: true,
			locationGenerationEnabled: true,
			encounterGenerationEnabled: true,
			customMonsterGenerationEnabled: true,
			characterGenerationEnabled: true,
			entityTargetScope: "mixed",
			globalBasePrompt: "  Темне фентезі  ",
			campaignBasePrompt: "  Низька магія  ",
		});
		assertSectionOrder(sceneInstruction, [
			"MANDATORY LANGUAGE RULE",
			"NAME LANGUAGE RULE",
			"CHARACTER LEVEL CONTRACT",
			"APP MARKDOWN FORMAT CONTRACT",
			"PARSED JSON RESPONSE CONTRACT",
			"OPERATION TARGET IDENTITY RULE",
			"SIMPLIFIED NOTES MODE IS ENABLED",
			"APP ENTITY MENTION RULE",
			"GENERATED NPC DETAIL RULE",
			"GENERATED LOCATION DETAIL RULE",
			"SCENE COMBAT MECHANICS RULE",
			"ENCOUNTER-SCENE LINK RULE",
			"SCENE DATA CONTRACT",
			"SESSION NOTES CONTRACT",
			"ENTITY GENERATION TOGGLES ARE ADDITIVE",
			"Encounter generation is enabled",
			"Custom monster generation is enabled, but official",
			"Character generation is enabled",
			"NPC generation is enabled",
			"Location/faction generation is enabled",
			"ENTITY SCOPE: This session request may create both",
			"SESSION ENTITY SCOPE DECISION RULE",
			"SESSION/CAMPAIGN ENTITY OUTPUT RULE",
			"USER BASE PROMPTS",
		]);
		assert.match(sceneInstruction, /GLOBAL BASE PROMPT:\nТемне фентезі/);
		assert.match(sceneInstruction, /CAMPAIGN BASE PROMPT:\nНизька магія/);
		assert.doesNotMatch(sceneInstruction, /Encounter generation is disabled/);

		const disabledScene = buildSystemInstruction({
			useKey: "scene",
			responseLanguage: { label: "Ukrainian" },
			usesStructuredJsonContract: false,
			effectiveParseAIResponse: false,
			npcGenerationEnabled: false,
			locationGenerationEnabled: false,
			encounterGenerationEnabled: false,
			characterGenerationEnabled: false,
			entityTargetScope: "session",
		});
		assert.match(disabledScene, /Encounter generation is disabled/);
		assert.match(disabledScene, /Character generation is disabled/);
		assert.match(disabledScene, /NPC generation is disabled/);
		assert.match(disabledScene, /Location\/faction generation is disabled/);
		assert.match(
			disabledScene,
			/ENTITY SCOPE: "npc" and "location" operations are session-scoped/,
		);
		assert.doesNotMatch(disabledScene, /PARSED JSON RESPONSE CONTRACT/);
		assert.doesNotMatch(disabledScene, /GENERATED NPC DETAIL RULE/);
		assert.doesNotMatch(disabledScene, /SCENE DATA CONTRACT/);
		assert.doesNotMatch(disabledScene, /SESSION ENTITY SCOPE DECISION RULE/);

		const campaignScopedScene = buildSystemInstruction({
			useKey: "scene",
			responseLanguage: { label: "Ukrainian" },
			effectiveParseAIResponse: true,
			entityTargetScope: "campaign",
		});
		assert.match(
			campaignScopedScene,
			/ENTITY SCOPE: "npc" and "location" operations are campaign-scoped/,
		);
		assert.doesNotMatch(
			campaignScopedScene,
			/SESSION ENTITY SCOPE DECISION RULE/,
		);

		const customMonsterInstruction = buildSystemInstruction({
			useKey: "custom-monster",
			responseLanguage: { label: "Українська" },
			usesStructuredJsonContract: true,
			simplifiedNotesEnabled: true,
		});
		assert.match(customMonsterInstruction, /CUSTOM MONSTER TEXT RULE/);
		assert.match(customMonsterInstruction, /SIMPLIFIED NOTES MODE IS ENABLED/);
		assert.doesNotMatch(customMonsterInstruction, /APP ENTITY MENTION RULE/);

		const encounterEnabled = buildSystemInstruction({
			useKey: "encounter",
			responseLanguage: { label: "English" },
			customMonsterGenerationEnabled: true,
		});
		const encounterDisabled = buildSystemInstruction({
			useKey: "encounter",
			responseLanguage: { label: "English" },
			customMonsterGenerationEnabled: false,
		});
		assert.match(
			encounterEnabled,
			/Custom monster generation is enabled for this encounter/,
		);
		assert.doesNotMatch(encounterEnabled, /Custom monster generation is disabled/);
		assert.match(encounterDisabled, /Custom monster generation is disabled/);
		assert.doesNotMatch(
			encounterDisabled,
			/Custom monster generation is enabled for this encounter/,
		);

		const promptInstruction = buildSystemInstruction({
			useKey: "prompt",
			responseLanguage: { label: "Українська" },
			globalBasePrompt: "",
			campaignBasePrompt: "  Київська кампанія  ",
		});
		assert.ok(promptInstruction.startsWith(systemInstructions.prompt));
		assertSectionOrder(promptInstruction, [
			"MANDATORY LANGUAGE RULE",
			"IMAGE PROMPT LANGUAGE EXCEPTION",
			"USER BASE PROMPTS",
		]);
		assert.match(promptInstruction, /GLOBAL BASE PROMPT:\n\(none\)/);
		assert.match(
			promptInstruction,
			/CAMPAIGN BASE PROMPT:\nКиївська кампанія/,
		);

		const imageInstruction = buildSystemInstruction({
			useKey: "image",
			globalBasePrompt: "  Загальний стиль  ",
			imagePromptBasePrompt: "  Oil painting  ",
		});
		assert.ok(imageInstruction.startsWith(systemInstructions.image));
		assertSectionOrder(imageInstruction, [
			"USER BASE PROMPTS",
			"IMAGE PROMPT BASE STYLE",
			"Oil painting",
		]);
		assert.doesNotMatch(imageInstruction, /MANDATORY LANGUAGE RULE/);

		const fallbackInstruction = buildSystemInstruction({
			useKey: "unknown-mode",
			responseLanguage: { label: "Українська" },
		});
		assert.ok(fallbackInstruction.startsWith(systemInstructions.prompt));
		assert.match(fallbackInstruction, /MANDATORY LANGUAGE RULE/);
		assert.doesNotMatch(fallbackInstruction, /IMAGE PROMPT LANGUAGE EXCEPTION/);
	},
);

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

await run("Campaign entity scope movement plans preserve identity and execution order", async () => {
	const campaignEntity = { id: 0, slug: "провідник", firstName: "Провідник" };
	const campaignPlan = buildCampaignToSessionScopeMovePlan(
		{ fileName: "arrival" },
		"npc",
		campaignEntity,
	);
	assert.deepEqual(campaignPlan, {
		operation: "move-to-session",
		targetScope: "session",
		type: "npc",
		entity: campaignEntity,
		entityId: 0,
		entitySlug: "провідник",
		fileName: "arrival",
	});
	assert.equal(
		buildCampaignToSessionScopeMovePlan(
			{ fileName: "arrival" },
			"npc",
			{ id: "missing-slug" },
		),
		null,
	);
	assert.equal(
		buildCampaignToSessionScopeMovePlan(null, "npc", campaignEntity),
		null,
	);

	const location = { id: 7, slug: "tower", name: "Вежа" };
	const sessionPlan = buildSessionToCampaignScopeMovePlan(
		{
			fileName: "arrival",
			data: {
				npcs: [{ id: 7, slug: "wrong-list" }],
				locations: [location],
			},
		},
		"locations",
		"7",
	);
	assert.equal(sessionPlan?.entity, location);
	assert.equal(sessionPlan?.entityId, "7");
	assert.equal(sessionPlan?.operation, "move-to-campaign");
	assert.equal(
		buildSessionToCampaignScopeMovePlan(
			{ fileName: "arrival", data: { npcs: "invalid" } },
			"npc",
			"missing",
		),
		null,
	);

	const cancelledCalls = [];
	assert.deepEqual(
		await executeEntityScopeMove(campaignPlan, {
			campaignSlug: "demo",
			confirmMove: async (...args) => {
				cancelledCalls.push(["confirm", ...args]);
				return false;
			},
			flushPendingSave: async () => {
				cancelledCalls.push(["flush"]);
			},
			api: {
				moveEntityScope: async () => {
					cancelledCalls.push(["api"]);
				},
			},
		}),
		{ status: "cancelled" },
	);
	assert.deepEqual(cancelledCalls, [
		["confirm", "session", "npc", campaignEntity],
	]);

	const executionCalls = [];
	const movedSession = { name: "Arrival", fileName: "saved-arrival" };
	const movedResult = { entity: campaignEntity, session: movedSession };
	const movedOutcome = await executeEntityScopeMove(campaignPlan, {
		campaignSlug: "demo",
		confirmMove: async () => {
			executionCalls.push("confirm");
			return true;
		},
		flushPendingSave: async (options) => {
			executionCalls.push(["flush", options]);
			return { fileName: "saved-arrival" };
		},
		api: {
			moveEntityScope: async (...args) => {
				executionCalls.push(["api", ...args]);
				return movedResult;
			},
		},
	});
	assert.deepEqual(movedOutcome, { status: "moved", result: movedResult });
	assert.deepEqual(executionCalls, [
		"confirm",
		["flush", { throwOnError: true }],
		[
			"api",
			"demo",
			"saved-arrival",
			"npc",
			0,
			{ entitySlug: "провідник", targetScope: "session" },
		],
	]);

	const failed = new Error("save failed");
	const failedOutcome = await executeEntityScopeMove(sessionPlan, {
		campaignSlug: "demo",
		confirmMove: () => true,
		flushPendingSave: async () => {
			throw failed;
		},
		api: { moveEntityScope: async () => movedResult },
	});
	assert.deepEqual(failedOutcome, { status: "failed", error: failed });

	const campaignDirectionCalls = [];
	const campaignDirectionOutcome = await executeEntityScopeMove(sessionPlan, {
		campaignSlug: "demo",
		confirmMove: () => true,
		api: {
			moveEntityScope: async (...args) => {
				campaignDirectionCalls.push(args);
				return movedResult;
			},
		},
	});
	assert.equal(campaignDirectionOutcome.status, "moved");
	assert.deepEqual(campaignDirectionCalls, [
		["demo", "arrival", "locations", "7", { targetScope: "campaign" }],
	]);
	const malformedOutcome = await executeEntityScopeMove(campaignPlan, {
		campaignSlug: "demo",
		confirmMove: () => true,
		api: { moveEntityScope: async () => ({ entity: campaignEntity }) },
	});
	assert.equal(malformedOutcome.status, "failed");
	assert.match(malformedOutcome.error.message, /returned no session/);

	const modal = {
		type: "npc",
		items: [campaignEntity, { slug: "other" }],
		isLoading: false,
	};
	const nextModal = removeMovedCampaignEntityFromImport(modal, "провідник");
	assert.deepEqual(nextModal?.items, [{ slug: "other" }]);
	assert.equal(modal.items.length, 2);
	assert.equal(removeMovedCampaignEntityFromImport(null, "провідник"), null);
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

await run("AI history change summaries preserve counters and resource fallback", () => {
	assert.equal(getHistoryChangeSummary(null), "");
	assert.equal(getHistoryChangeSummary({ id: "empty" }), "");
	assert.equal(
		getHistoryChangeSummary({
			id: "counts",
			changes: {
				summary: { added: 2, deleted: 1, modified: 3, total: 6 },
			},
		}, (value) => (value === "Changes" ? "Зміни" : value)),
		"Зміни: +2 -1 ~3",
	);
	assert.equal(
		getHistoryChangeSummary({
			id: "total-only",
			changes: { summary: { total: 4 } },
		}),
		"Changes: 4",
	);
	assert.equal(
		getHistoryChangeSummary({
			id: "resource-fallback",
			changes: {
				summary: { added: 0, deleted: 0, modified: 0, total: 0 },
				resources: [
					{ id: "custom-monster:same", kind: "custom-monster" },
					{ id: "custom-monster:same", kind: "session" },
				],
			},
		}),
		"Changes: 2",
	);
	assert.equal(
		getHistoryChangeSummary({
			id: "invalid-total",
			changes: {
				summary: { modified: 1, total: "not-a-number" },
				resources: [{ id: "session:1", kind: "session" }],
			},
		}),
		"Changes: ~1",
	);
	assert.equal(
		getHistoryChangeSummary({
			id: "counts-without-total",
			changes: { summary: { added: 2, total: 0 } },
		}),
		"",
	);
	assert.equal(
		getHistoryChangeSummary({
			id: "numeric-coercion",
			changes: { summary: { added: "2", total: "3" } },
		}),
		"Changes: +2",
	);
	assert.equal(
		getHistoryChangeSummary({
			id: "negative-total",
			changes: { summary: { total: -2 } },
		}),
		"Changes: -2",
	);
});

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
	assert.equal(getFirstChangedMonster(null), null);
	assert.equal(getFirstChangedMonsterName(entry, []), null);
	assert.equal(
		getFirstChangedMonsterName({
			changes: {
				resources: [
					{
						id: "custom-monster:fallback",
						kind: "custom-monster",
						name: "Resource Beast",
						before: { name: "Before Beast" },
						after: { name: "" },
					},
				],
			},
		}),
		"Before Beast",
	);
	assert.equal(
		getFirstChangedMonsterName({
			changes: {
				resources: [
					{
						id: "custom-monster:invalid-name",
						kind: "custom-monster",
						name: "Resource Beast",
						before: { name: "Before Beast" },
						after: { name: 42 },
					},
				],
			},
		}),
		null,
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
	assert.strictEqual(addSourceMonsterImageToDraft(entry, null), entry);
	assert.strictEqual(
		addSourceMonsterImageToDraft(entry, { name: "Wolf" }),
		entry,
	);
	const explicitTokenEntry = {
		id: "direct-token",
		changes: {
			summary: { added: 7, deleted: 0, modified: 0, total: 7 },
			resources: [
				{
					id: "custom-monster:direct",
					kind: "custom-monster",
					before: null,
					after: { name: "Примарний вовк", source: "CUSTOM" },
				},
			],
		},
	};
	const withExplicitToken = addSourceMonsterImageToDraft(explicitTokenEntry, {
		name: "Source Wolf",
		imageUrl: "/images/custom/source-wolf.png",
	});
	assert.equal(
		withExplicitToken.changes.resources[0].after.imageUrl,
		"/images/custom/source-wolf.png",
	);
	assert.strictEqual(
		withExplicitToken.changes.summary,
		explicitTokenEntry.changes.summary,
	);
	const encodedToken = addSourceMonsterImageToDraft(explicitTokenEntry, {
		name: "Fallback Wolf",
		originalBestiaryName: "Dire Wolf",
		source: " M M ",
	});
	assert.equal(
		encodedToken.changes.resources[0].after.imageUrl,
		"/api/bestiary/tokens/M%20M/Dire%20Wolf.webp",
	);
	const existingTokenEntry = {
		id: "existing-token",
		changes: {
			resources: [
				{
					id: "custom-monster:existing-token",
					kind: "custom-monster",
					before: null,
					after: { name: "Existing", imageUrl: "/existing.png" },
				},
				{
					id: "custom-monster:modified",
					kind: "custom-monster",
					before: { name: "Modified" },
					after: { name: "Modified" },
				},
			],
		},
	};
	assert.strictEqual(
		addSourceMonsterImageToDraft(existingTokenEntry, {
			name: "Wolf",
			source: "MM",
		}),
		existingTokenEntry,
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
	assert.equal(
		getDiffResourceState(
			{ before: {}, after: {} },
			{ modified: "Змінено" },
		),
		"Змінено",
	);

	const identityResources = buildDiffResources({
		id: "history-identity",
		changes: {
			resources: [
				{
					id: "session:identity",
					kind: "session",
					label: "Session",
					before: {
						name: "Identity",
						status: "draft",
						data: {
							npcs: [
								{ id: 0, firstName: "Старе ім’я" },
								{ id: "deleted", firstName: "Видалений" },
							],
							weather: "rain",
						},
					},
					after: {
						name: "Identity",
						status: "ready",
						data: {
							npcs: [
								{ id: 0, firstName: "Нове ім’я" },
								{ id: "added", firstName: "Доданий" },
							],
							weather: "sun",
						},
					},
				},
				{
					id: "bestiary:custom",
					kind: "custom-bestiary",
					label: "Bestiary",
					before: [{ id: 0, name: "Старий звір" }],
					after: [
						{ id: 0, name: "Новий звір" },
						{ id: "new", name: "Доданий звір" },
					],
				},
			],
		},
	});
	assert.deepEqual(
		identityResources.map((resource) => resource.id),
		[
			"session:identity:npcs/Нове ім’я",
			"session:identity:npcs/Видалений",
			"session:identity:npcs/Доданий",
			"session:identity:data.weather",
			"session:identity:status",
			"bestiary:custom:monsters/Новий звір",
			"bestiary:custom:monsters/Доданий звір",
		],
	);
	assert.deepEqual(
		identityResources.slice(0, 3).map((resource) => resource.listIndex),
		[0, null, 1],
	);
	assert.ok(
		identityResources.every(
			(resource) =>
				resource.parentResourceId ===
				(resource.id.startsWith("session:")
					? "session:identity"
					: "bestiary:custom"),
		),
	);

	const orderedResources = buildDiffResources(
		{
			id: "history-ordered",
			changes: {
				resources: [
					{
						id: "session:ordered",
						kind: "session",
						label: "Ordered session",
						before: {
							status: undefined,
							data: {
								npcs: [{ id: "removed", firstName: "Видалений" }],
							},
						},
						after: {
							name: "Нова назва",
							status: "ready",
							data: {
								result_text: "Новий підсумок",
								notes: [{ id: "note", title: "", text: "" }],
								npcs: [],
								locations: [{ id: "location", title: "  Брама  " }],
								scenes: [
									{ id: "scene", texts: { summary: "  Прибуття  " } },
								],
								encounters: [{ id: "encounter", name: "" }],
								weather: "sun",
							},
						},
					},
					{
						id: "bestiary:deleted",
						kind: "custom-bestiary",
						label: "Bestiary",
						before: [{ id: "removed", name: "Зниклий звір" }],
						after: [],
					},
				],
			},
		},
		{
			note: "Нотатка",
			encounter: "Енкаунтер",
			creature: "Істота",
		},
	);
	assert.deepEqual(
		orderedResources.map((resource) => resource.id),
		[
			"session:ordered:name",
			"session:ordered:summary",
			"session:ordered:notes/Нотатка",
			"session:ordered:npcs/Видалений",
			"session:ordered:locations/Брама",
			"session:ordered:scenes/Прибуття",
			"session:ordered:encounters/Енкаунтер",
			"session:ordered:data.weather",
			"session:ordered:status",
			"bestiary:deleted:monsters/Зниклий звір",
		],
	);
	assert.deepEqual(
		orderedResources.map((resource) => resource.listIndex ?? null),
		[null, null, 0, null, 0, 0, 0, null, null, null],
	);
	assert.equal(orderedResources[0].before, null);
	assert.equal(orderedResources[1].before, null);
	assert.equal(orderedResources[7].before, null);
	assert.equal(orderedResources[8].before, null);
	assert.equal(orderedResources.at(-1).after, null);
	assert.ok(
		orderedResources.every((resource) =>
			resource.id.startsWith("bestiary:")
				? resource.parentResourceId === "bestiary:deleted"
				: resource.parentResourceId === "session:ordered",
		),
	);

	const unchangedResource = {
		id: "session:unchanged",
		kind: "session",
		label: "Unchanged",
		before: { name: "Без змін", data: { notes: [] } },
		after: { name: "Без змін", data: { notes: [] } },
	};
	const unchanged = buildDiffResources({
		id: "history-unchanged",
		changes: { resources: [unchangedResource] },
	});
	assert.equal(unchanged.length, 1);
	assert.equal(unchanged[0].id, "session:unchanged");
	assert.equal(unchanged[0].parentResourceId, undefined);
	assert.deepEqual(unchanged[0].fieldSummary, []);
	assert.ok(unchanged[0].lines.every((line) => line.type === "context"));

	const getGenericLineDiff = (before, after) =>
		buildDiffResources({
			id: "history-line-diff",
			changes: {
				resources: [
					{
						id: "entity:line-diff",
						kind: "entity",
						before,
						after,
					},
				],
			},
		})[0].lines;
	const unicodeReplacementLines = getGenericLineDiff(
		{ text: "Старий рядок" },
		{ text: "Новий рядок" },
	);
	assert.deepEqual(
		unicodeReplacementLines.map((line) => [
			line.type,
			line.oldNumber,
			line.newNumber,
			line.text,
		]),
		[
			["context", 1, 1, "{"],
			["removed", 2, null, '  "text": "Старий рядок"'],
			["added", null, 2, '  "text": "Новий рядок"'],
			["context", 3, 3, "}"],
		],
	);
	assert.deepEqual(
		getGenericLineDiff({ b: "Спільний" }, { a: "Новий", b: "Спільний" })
			.map((line) => line.type),
		["context", "added", "context", "context"],
	);
	assert.deepEqual(
		getGenericLineDiff({ a: "Старий", b: "Спільний" }, { b: "Спільний" })
			.map((line) => line.type),
		["context", "removed", "context", "context"],
	);

	const largeBefore = Array.from({ length: 450 }, (_, index) => `old-${index}`);
	const largeAfter = Array.from({ length: 450 }, (_, index) => `new-${index}`);
	const [largeDiff] = buildDiffResources({
		id: "history-large",
		changes: {
			resources: [
				{
					id: "generic:large",
					kind: "entity",
					before: largeBefore,
					after: largeAfter,
				},
			],
		},
	});
	const firstAddedLine = largeDiff.lines.findIndex(
		(line) => line.type === "added",
	);
	assert.ok(firstAddedLine > 0);
	assert.ok(
		largeDiff.lines.slice(0, firstAddedLine).every(
			(line) => line.type === "removed" && line.newNumber === null,
		),
	);
	assert.ok(
		largeDiff.lines.slice(firstAddedLine).every(
			(line) => line.type === "added" && line.oldNumber === null,
		),
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
	const generated = {
		operations: [{
			entity: "npc",
			id: "Old Gate",
			data: {
				name: "Old Gate",
				description: "Meet Old Gate.",
				notes: [{ text: "Return to Old Gate." }],
				unknown: "Old Gate",
			},
		}],
	};
	assert.equal(mentionProcessing.applyMentionsToGeneratedContent(generated, ["Old Gate"]), generated);
	assert.deepEqual(generated.operations[0].data, {
		name: "Old Gate",
		description: "Meet [Old Gate].",
		notes: [{ text: "Return to [Old Gate]." }],
		unknown: "Old Gate",
	});
	assert.equal(mentionProcessing.applyMentionsToGeneratedContent(null, ["Old Gate"]), null);
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
		compactEntityForEstimate({
			firstName: "",
			first_name: "Марія",
			lastName: "",
			last_name: "Коваль",
			name: "Ignored fallback",
		}).name,
		"Марія Коваль",
	);
	assert.equal(
		compactEntityForEstimate({ name: "", title: "Архіваріус" }).name,
		"Архіваріус",
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
	const tokenEstimateBase = {
		contextConfig: { campaignNotes: true, sessions: {} },
		getCharacterKey: (entity) => entity.id,
		getLocationKey: (entity) => entity.id,
	};
	assert.deepEqual(
		buildAiTokenEstimateContext({
			...tokenEstimateBase,
			isBestiary: true,
		}),
		{},
	);
	assert.deepEqual(
		buildAiTokenEstimateContext({
			...tokenEstimateBase,
			isCampaign: true,
			sessionName: "Fallback campaign",
			sessionData: {
				name: "Кампанія",
				description: "Опис",
				notes: [
					{ title: "Видима", text: "Нотатка" },
					{ title: "Прихована", _aiIgnored: true },
				],
				characters: [
					{ id: "hero", first_name: "Ірина", last_name: "Камінь" },
				],
			},
			charactersList: [{ id: "fallback", name: "Fallback" }],
			useContext: true,
		}),
		{
			campaign: {
				name: "Кампанія",
				description: "Опис",
				notes: [{ title: "Видима", text: "Нотатка" }],
				characters: [
					{
						name: "Ірина Камінь",
						description: "",
						motivation: "",
						trait: "",
						notes: [],
					},
				],
				npcs: [],
				locations: [],
			},
		},
	);
	assert.deepEqual(
		buildAiTokenEstimateContext({
			...tokenEstimateBase,
			isCampaign: true,
			sessionName: "Fallback campaign",
			sessionData: {
				name: "",
				description: "Опис без контексту",
				notes: [{ title: "Не включати" }],
				characters: [{ id: "session-character", name: "Не включати" }],
			},
			charactersList: [{ id: "fallback-character", name: "Не включати" }],
			useContext: false,
		}),
		{
			campaign: {
				name: "Fallback campaign",
				description: "Опис без контексту",
			},
		},
	);
	const fallbackCampaignContext = buildAiTokenEstimateContext({
		...tokenEstimateBase,
		contextConfig: { campaignNotes: false, sessions: {} },
		isCampaign: true,
		sessionData: { name: "Кампанія без колекцій" },
		charactersList: [{ id: "hero", name: "Fallback hero" }],
		npcsList: [
			{ id: "kept", name: "Visible NPC" },
			{ id: "hidden", name: "Hidden NPC" },
		],
		locationsList: [{ id: "place", title: "Fallback place" }],
		characterContext: { included: false, items: { hero: true } },
		npcContext: { included: true, items: { hidden: false } },
		locationContext: { included: true, items: { place: false } },
		useContext: true,
	});
	assert.equal(
		Object.hasOwn(fallbackCampaignContext.campaign, "notes"),
		false,
	);
	assert.deepEqual(fallbackCampaignContext.campaign.characters, []);
	assert.deepEqual(
		fallbackCampaignContext.campaign.npcs.map((npc) => npc.name),
		["Visible NPC"],
	);
	assert.deepEqual(fallbackCampaignContext.campaign.locations, []);
	const emptySessionCollections = buildAiTokenEstimateContext({
		...tokenEstimateBase,
		isCampaign: true,
		sessionData: { characters: [], npcs: [], locations: [] },
		charactersList: [{ id: "fallback", name: "Fallback" }],
		npcsList: [{ id: "fallback", name: "Fallback" }],
		locationsList: [{ id: "fallback", name: "Fallback" }],
		useContext: true,
	});
	assert.deepEqual(emptySessionCollections.campaign.characters, []);
	assert.deepEqual(emptySessionCollections.campaign.npcs, []);
	assert.deepEqual(emptySessionCollections.campaign.locations, []);

	assert.deepEqual(
		buildAiTokenEstimateContext({
			...tokenEstimateBase,
			campaignContext: {
				description: "Світ",
				notes: [{ title: "Кампанійна нотатка", text: "Текст" }],
			},
			contextConfig: {
				campaignNotes: true,
				sessions: {
					selected: {
						included: true,
						data: {
							result_text: "Підсумок",
							notes: [{ title: "Сесійна нотатка", text: "Текст" }],
						},
					},
					excluded: {
						included: false,
						data: { result_text: "Не включати" },
					},
				},
			},
			parseAIResponse: true,
			sessionData: { result_text: "Поточна сесія" },
			useContext: true,
		}),
		{
			campaign: {
				description: "Світ",
				notes: [{ title: "Кампанійна нотатка", text: "Текст" }],
				characters: [],
				npcs: [],
				locations: [],
			},
			currentSession: {
				notes: [],
				result: "Поточна сесія",
				scenes: [],
				npcs: [],
				locations: [],
			},
			selectedSessions: [
				{
					slug: "selected",
					data: {
						notes: [{ title: "Сесійна нотатка", text: "Текст" }],
						result: "Підсумок",
						scenes: [],
						npcs: [],
						locations: [],
					},
				},
			],
		},
	);
	const encounterData = { id: "encounter-1", name: "Засідка" };
	assert.deepEqual(
		buildAiTokenEstimateContext({
			...tokenEstimateBase,
			campaignContext: { description: "Світ" },
			isEncounter: true,
			sessionData: encounterData,
		}),
		{
			campaign: { description: "Світ" },
			currentEncounter: encounterData,
		},
	);
	assert.deepEqual(
		estimateAiAttachmentTokens({
			attachedImages: [{ name: "one" }, { name: "two" }],
			attachedFiles: [
				{ name: "one", sizeBytes: 1 },
				{ name: "two", sizeBytes: 4 },
				{ name: "invalid", sizeBytes: Number.NaN },
			],
		}),
		{ imageTokens: 520, fileTokens: 2 },
	);

	const workflow = createAiHistoryWorkflow(() => "Retry this request");
	const retryEntry = {
		id: "retry-1",
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
	assert.deepEqual(
		workflow.buildRetryPlan(retryEntry, {
			isBestiary: true,
			historyCampaign: "fallback",
		}),
		{
			entryId: "retry-1",
			retryPayload: workflow.buildRetryPayloadFromHistoryEntry(retryEntry),
			requestType: "campaign",
			shouldParseResponse: false,
			deleteFailedEntry: null,
		},
	);
	assert.equal(
		workflow.buildRetryPlan(retryEntry, { isLoading: true }),
		null,
	);
	const failedRetryEntry = {
		id: "failed-1",
		status: "failed",
		path: { campaign: "буря" },
		retryPayload: {
			type: "image",
			parseAIResponse: true,
			userInstructions: "Повтори",
		},
	};
	const failedRetryPlan = workflow.buildRetryPlan(failedRetryEntry, {
		isBestiary: true,
		historyCampaign: "fallback",
	});
	assert.deepEqual(failedRetryPlan, {
		entryId: "failed-1",
		retryPayload: failedRetryEntry.retryPayload,
		requestType: "image",
		shouldParseResponse: false,
		deleteFailedEntry: { campaign: "буря", id: "failed-1" },
	});

	const retryEvents = [];
	const retrySuccess = await executeAiHistoryRetry({
		plan: failedRetryPlan,
		signal: new AbortController().signal,
		deleteAiResponse: async (campaign, id) => {
			retryEvents.push(["delete", campaign, id]);
			return [{ id: "remaining" }];
		},
		generateAi: async (payload) => {
			retryEvents.push(["generate", payload.userInstructions]);
			return { prompt: "Готово" };
		},
		onFailedEntryDeleted: (responses) =>
			retryEvents.push(["deleted", responses.map((entry) => entry.id)]),
		onSucceeded: (data) => retryEvents.push(["succeeded", data.prompt]),
	});
	assert.deepEqual(retrySuccess, {
		status: "succeeded",
		data: { prompt: "Готово" },
	});
	assert.deepEqual(retryEvents, [
		["delete", "буря", "failed-1"],
		["deleted", ["remaining"]],
		["generate", "Повтори"],
		["succeeded", "Готово"],
	]);
	const nullableDeleteEvents = [];
	assert.deepEqual(
		await executeAiHistoryRetry({
			plan: failedRetryPlan,
			signal: new AbortController().signal,
			deleteAiResponse: async () => null,
			generateAi: async (_payload, { signal }) => {
				nullableDeleteEvents.push(["signal", signal.aborted]);
				return null;
			},
			onFailedEntryDeleted: (responses) =>
				nullableDeleteEvents.push(["deleted", responses]),
			onSucceeded: (data) => nullableDeleteEvents.push(["succeeded", data]),
		}),
		{ status: "succeeded", data: null },
	);
	assert.deepEqual(nullableDeleteEvents, [
		["deleted", []],
		["signal", false],
		["succeeded", null],
	]);
	const successCallbackError = new Error("Result delegation failed");
	const delegatedFailures = [];
	const delegatedFailure = await executeAiHistoryRetry({
		plan: { ...failedRetryPlan, deleteFailedEntry: null },
		signal: new AbortController().signal,
		deleteAiResponse: async () => {
			throw new Error("Must not delete");
		},
		generateAi: async () => ({ prompt: "Generated" }),
		onSucceeded: () => {
			throw successCallbackError;
		},
		onFailed: (error) => delegatedFailures.push(error),
	});
	assert.equal(delegatedFailure.status, "failed");
	assert.strictEqual(delegatedFailure.error, successCallbackError);
	assert.deepEqual(delegatedFailures, [successCallbackError]);
	let cancelledCallbackCount = 0;
	assert.deepEqual(
		await executeAiHistoryRetry({
			plan: failedRetryPlan,
			signal: new AbortController().signal,
			deleteAiResponse: async () => {
				const error = new Error("Cancelled");
				error.name = "AbortError";
				throw error;
			},
			generateAi: async () => {
				throw new Error("Must not run");
			},
			onCancelled: () => {
				cancelledCallbackCount += 1;
			},
		}),
		{ status: "cancelled" },
	);
	assert.equal(cancelledCallbackCount, 1);
	const failedCallbackMessages = [];
	const retryFailure = await executeAiHistoryRetry({
		plan: { ...failedRetryPlan, deleteFailedEntry: null },
		signal: new AbortController().signal,
		deleteAiResponse: async () => [],
		generateAi: async () => {
			throw Object.assign(new Error("Помилка генерації"), {
				status: 502,
			});
		},
		onFailed: (error) => failedCallbackMessages.push(error.message),
	});
	assert.equal(retryFailure.status, "failed");
	assert.equal(retryFailure.error.message, "Помилка генерації");
	assert.deepEqual(failedCallbackMessages, ["Помилка генерації"]);
	assert.deepEqual(
		getAiHistoryRetryFailure(
			{
				message: "Помилка генерації",
				status: 502,
				data: { aiResponse: { id: "failed-history", text: "Збережено" } },
			},
			"Статус",
		),
		{
			historyEntry: { id: "failed-history", text: "Збережено" },
			message: "Помилка генерації",
			status: 502,
			alertMessage: "[Статус: 502] Помилка генерації",
		},
	);
	assert.deepEqual(getAiHistoryRetryFailure("invalid", "Статус"), {
		historyEntry: null,
		message: "",
		status: null,
		alertMessage: "",
	});
	assert.deepEqual(getGeneratedEntityTypes({ npcs: [] }), ["npc"]);
	assert.deepEqual(
		getGeneratedEntityTypes({ characters: [], npcs: [], locations: [] }),
		["characters", "npc", "locations"],
	);
	const generatedTypeHistoryEntry = {
		changes: {
			resources: [
				{ kind: "entity", type: "locations" },
				{ kind: "entity", type: "npc" },
				{ kind: "entity", type: "locations" },
				{ kind: "campaign", type: "characters" },
			],
		},
	};
	assert.deepEqual(
		getGeneratedEntityTypes(null, generatedTypeHistoryEntry),
		["locations", "npc"],
	);
	assert.deepEqual(
		getGeneratedEntityTypes(
			{ characters: "invalid", npcs: {}, locations: null },
			generatedTypeHistoryEntry,
		),
		["locations", "npc"],
	);
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
	const generationRoute = { campaign: "demo", session: "one" };
	const generationImageTarget = { type: "scene", id: "scene-1" };
	const generationImages = [{ name: "мапа.png", url: "/map.png" }];
	const generationFiles = [{ name: "нотатки.md", sizeBytes: 12 }];
	assert.deepEqual(
		resolveAiGenerationRequestPolicy({
			initialRoute: generationRoute,
			isBestiary: true,
		}),
		{ requestType: "custom-monster", shouldParseResponse: true },
	);
	assert.deepEqual(
		resolveAiGenerationRequestPolicy({
			type: "image",
			initialRoute: generationRoute,
			isBestiary: true,
			forceParseAIResponse: true,
		}),
		{ requestType: "image", shouldParseResponse: false },
	);
	assert.deepEqual(
		resolveAiGenerationRequestPolicy({
			type: "scene",
			initialRoute: generationRoute,
			parseAIResponse: true,
			forceParseAIResponse: false,
		}),
		{ requestType: "scene", shouldParseResponse: false },
	);
	const scenePolicy = resolveAiGenerationRequestPolicy({
		type: "scene",
		initialRoute: generationRoute,
		parseAIResponse: true,
	});
	assert.deepEqual(
		buildAiGenerationRequestOptions(
			{
				type: "scene",
				initialRoute: generationRoute,
				generateCharacters: false,
				generateNpcs: true,
				generateLocations: false,
				generateEncounters: true,
				generateCustomMonsters: true,
			},
			scenePolicy,
		),
		{
			generateCharacters: false,
			generateNpcs: true,
			generateLocations: false,
			generateEncounters: true,
			generateCustomMonsters: true,
		},
	);
	const imagePolicy = resolveAiGenerationRequestPolicy({
		type: "image",
		initialRoute: generationRoute,
	});
	assert.deepEqual(
		buildAiGenerationRequestOptions(
			{
				type: "image",
				initialRoute: generationRoute,
				generateEncounters: true,
				generateCustomMonsters: true,
			},
			imagePolicy,
		),
		{
			generateCharacters: true,
			generateNpcs: true,
			generateLocations: true,
			generateEncounters: false,
			generateCustomMonsters: false,
		},
	);
	assert.equal(
		getAiGenerationRequestContext({
			initialRoute: generationRoute,
			useContext: true,
			contextConfig: originalContext,
		}).sessions.first.data,
		undefined,
	);
	assert.equal(
		getAiGenerationRequestContext({
			initialRoute: generationRoute,
			isBestiary: true,
			useContext: true,
			contextConfig: originalContext,
		}),
		null,
	);
	assert.deepEqual(
		buildAiGenerationRequestTarget({
			initialRoute: generationRoute,
			targetSceneId: 7,
			imageTarget: generationImageTarget,
		}),
		{
			path: generationRoute,
			sceneId: 7,
			imageTarget: generationImageTarget,
		},
	);
	const attachmentProjection = buildAiGenerationRequestAttachments({
		initialRoute: generationRoute,
		attachedImages: generationImages,
		attachedFiles: generationFiles,
	});
	assert.equal(attachmentProjection.attachedImages, generationImages);
	assert.equal(attachmentProjection.attachedFiles, generationFiles);

	const generationRequest = buildAiGenerationRequest({
		type: "scene",
		parseAIResponse: true,
		initialRoute: generationRoute,
		userInstructions: "Continue",
		userInstructionsOverride: "",
		selectedModel: "",
		targetSceneId: 7,
		imageTarget: generationImageTarget,
		attachedImages: generationImages,
		attachedFiles: generationFiles,
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
	assert.equal(generationRequest.payload.path, generationRoute);
	assert.equal(generationRequest.payload.imageTarget, generationImageTarget);
	assert.equal(generationRequest.payload.attachedImages, generationImages);
	assert.equal(generationRequest.payload.attachedFiles, generationFiles);
	assert.equal(generationRequest.payload.userInstructions, "");
	assert.equal(generationRequest.payload.modelName, undefined);
	assert.equal(generationRequest.payload.sceneId, 7);

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
	assert.equal(generating.requestId, 1);
	assert.equal(isAiGenerationPending(generating), true);
	assert.equal(isAiGenerationPending(null), false);
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
	assert.equal(succeeded.requestId, null);
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
	const replacedGeneration = aiGenerationLifecycleReducer(retrying, {
		type: "start-generation",
		requestId: 3,
	});
	assert.deepEqual(replacedGeneration, {
		status: AI_GENERATION_STATUS.GENERATING,
		requestId: 3,
	});
	const cancelled = aiGenerationLifecycleReducer(replacedGeneration, {
		type: "cancel",
		requestId: 3,
	});
	assert.deepEqual(cancelled, {
		status: AI_GENERATION_STATUS.CANCELLED,
		requestId: null,
	});
	assert.strictEqual(
		aiGenerationLifecycleReducer(cancelled, { type: "reset" }),
		initialAiGenerationLifecycle,
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
	assert.equal(getAiRestoredDataKind(null), "invalid");
	assert.equal(getAiRestoredDataKind([]), "invalid");
	assert.equal(getAiRestoredDataKind({ data: [] }), "invalid");
	assert.equal(getAiRestoredDataKind({ monsters: {} }), "invalid");
	assert.equal(getAiRestoredDataKind({ data: { scenes: [] } }), "session");
	assert.equal(getAiRestoredDataKind({ monsters: [] }), "bestiary");
	assert.equal(
		getAiRestoreRouteKind({
			isBestiary: true,
			isCampaign: true,
			currentRoute: { encounter: 1 },
		}),
		"bestiary",
	);
	assert.equal(getAiRestoreRouteKind({ isCampaign: true }), "campaign");
	assert.equal(
		getAiRestoreRouteKind({ currentRoute: { encounter: 0 } }),
		"encounter",
	);
	assert.equal(getAiRestoreRouteKind({}), "session");

	const directRestoreCases = [
		{
			name: "same Bestiary",
			options: {
				updated: { monsters: [] },
				entryPath: { campaign: "bestiary" },
				currentRoute: { campaign: "bestiary" },
				isBestiary: true,
			},
			expected: true,
		},
		{
			name: "foreign Bestiary",
			options: {
				updated: { monsters: [] },
				entryPath: { campaign: "other" },
				currentRoute: { campaign: "bestiary" },
				isBestiary: true,
			},
			expected: false,
		},
		{
			name: "Bestiary payload on campaign",
			options: {
				updated: { monsters: [] },
				entryPath: { campaign: "demo" },
				currentRoute: { campaign: "demo" },
				isCampaign: true,
			},
			expected: false,
		},
		{
			name: "same campaign",
			options: {
				updated: { title: "Оновлена кампанія" },
				entryPath: { campaign: "demo" },
				currentRoute: { campaign: "demo" },
				isCampaign: true,
			},
			expected: true,
		},
		{
			name: "session history on campaign",
			options: {
				updated: { title: "Wrong shape" },
				entryPath: { campaign: "demo", session: "arrival" },
				currentRoute: { campaign: "demo" },
				isCampaign: true,
			},
			expected: false,
		},
		{
			name: "same session",
			options: {
				updated: { data: { scenes: [] } },
				entryPath: { campaign: "demo", session: "arrival" },
				currentRoute: { campaign: "demo", session: "arrival" },
			},
			expected: true,
		},
		{
			name: "foreign session",
			options: {
				updated: { data: { scenes: [] } },
				entryPath: { campaign: "demo", session: "other" },
				currentRoute: { campaign: "demo", session: "arrival" },
			},
			expected: false,
		},
		{
			name: "same zero-valued numeric encounter",
			options: {
				updated: { data: { encounters: [] } },
				entryPath: {
					campaign: "demo",
					session: "arrival",
					encounter: 0,
				},
				currentRoute: {
					campaign: "demo",
					session: "arrival",
					encounter: "0",
				},
			},
			expected: true,
		},
		{
			name: "session history inside encounter route",
			options: {
				updated: { data: { scenes: [] } },
				entryPath: { campaign: "demo", session: "arrival" },
				currentRoute: {
					campaign: "demo",
					session: "arrival",
					encounter: "7",
				},
			},
			expected: true,
		},
		{
			name: "foreign encounter",
			options: {
				updated: { data: { encounters: [] } },
				entryPath: {
					campaign: "demo",
					session: "arrival",
					encounter: "7",
				},
				currentRoute: {
					campaign: "demo",
					session: "arrival",
					encounter: "8",
				},
			},
			expected: false,
		},
		{
			name: "encounter history on session route",
			options: {
				updated: { data: { encounters: [] } },
				entryPath: {
					campaign: "demo",
					session: "arrival",
					encounter: "7",
				},
				currentRoute: { campaign: "demo", session: "arrival" },
			},
			expected: false,
		},
	];
	for (const testCase of directRestoreCases) {
		assert.equal(
			canApplyRestoredAiDataDirectly(testCase.options),
			testCase.expected,
			testCase.name,
		);
	}

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

	const restoreEffectCalls = [];
	executeAiAssistantHistoryRestorePlan(restorePlan, {
		onHistoryReplace: (responses) =>
			restoreEffectCalls.push(["replace", responses]),
		onHistoryUpsert: (entry) => restoreEffectCalls.push(["upsert", entry]),
		onHistoryChanged: () => restoreEffectCalls.push(["history-changed"]),
		onSelectionUpdate: (entry) =>
			restoreEffectCalls.push(["selection", entry]),
		onApplyUpdatedData: (updated, options) =>
			restoreEffectCalls.push(["apply", updated, options]),
		onRequestReload: (entityTypes) =>
			restoreEffectCalls.push(["reload", entityTypes]),
	});
	assert.deepEqual(restoreEffectCalls, [
		["upsert", restoredEntry],
		["history-changed"],
		["selection", restoredEntry],
		[
			"apply",
			{ data: { scenes: [] } },
			{
				entityTypes: ["npc"],
				historyEntry: restoredEntry,
				trackUndo: false,
			},
		],
	]);

	const foreignRestoreEffectCalls = [];
	executeAiAssistantHistoryRestorePlan(foreignRestorePlan, {
		onHistoryReplace: (responses) =>
			foreignRestoreEffectCalls.push(["replace", responses]),
		onHistoryUpsert: (entry) =>
			foreignRestoreEffectCalls.push(["upsert", entry]),
		onHistoryChanged: () =>
			foreignRestoreEffectCalls.push(["history-changed"]),
		onSelectionUpdate: (entry) =>
			foreignRestoreEffectCalls.push(["selection", entry]),
		onApplyUpdatedData: (updated, options) =>
			foreignRestoreEffectCalls.push(["apply", updated, options]),
		onRequestReload: (entityTypes) =>
			foreignRestoreEffectCalls.push(["reload", entityTypes]),
	});
	assert.deepEqual(foreignRestoreEffectCalls, [
		["replace", [restoredEntry]],
		["history-changed"],
		["reload", ["npc"]],
	]);

	const commandCalls = [];
	let applyRestoreResult = { response: restoredEntry };
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
			return applyRestoreResult;
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
	applyRestoreResult = null;
	await assert.rejects(
		() => commandService.restoreEntry("demo", "history-1", "apply"),
		/AI restore response was empty/,
	);
	assert.deepEqual(commandCalls.at(-1), [
		"apply",
		"demo",
		"history-1",
		{ resourceIds: undefined },
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
	const malformedContextList = { included: false, items: [] };
	const normalizedMalformedContextList = ensureContextListItems(
		malformedContextList,
		[],
		(item) => item.id,
	);
	assert.notEqual(normalizedMalformedContextList, malformedContextList);
	assert.deepEqual(normalizedMalformedContextList, {
		included: false,
		items: {},
	});
	assert.deepEqual(
		ensureContextListItems({ items: { existing: false } }, [], (item) => item.id),
		{ included: true, items: { existing: false } },
	);
	assert.deepEqual(
		ensureContextListItems(
			false,
			[{ id: "" }, { id: "new" }, { id: "new" }],
			(item) => item.id,
		),
		{ included: false, items: { new: true } },
	);
	const emptyPathContext = { sessions: { existing: true } };
	assert.strictEqual(
		updateContextConfigValue(emptyPathContext, [], false),
		emptyPathContext,
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
	const existingSceneContext = {
		sessions: {
			"session-1": {
				scenes: {
					"scene-1": { included: false, custom: "Зберегти" },
				},
			},
		},
		unrelated: { enabled: true },
	};
	const updatedExistingSceneContext = updateContextConfigValue(
		existingSceneContext,
		["sessions", "session-1", "scenes", "scene-1", "summary"],
		false,
	);
	assert.deepEqual(
		updatedExistingSceneContext.sessions["session-1"].scenes["scene-1"],
		{ included: false, custom: "Зберегти", summary: false },
	);
	assert.equal(
		existingSceneContext.sessions["session-1"].scenes["scene-1"].summary,
		undefined,
	);
	assert.notEqual(updatedExistingSceneContext.unrelated, existingSceneContext.unrelated);
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
	const existingLoadedSession = {
		included: true,
		notes: false,
		data: { name: "Already loaded" },
	};
	const multiSessionContext = {
		...createInitialAiContextConfig(),
		sessions: {
			pending: { included: true, notes: false },
			loaded: existingLoadedSession,
		},
	};
	const mergedMultiSessionContext = mergeLoadedAiSessionData(
		multiSessionContext,
		[
			[
				"pending",
				{ included: false, notes: true },
				{ name: "Завантажена сесія" },
			],
			["loaded", { included: false }, { name: "Must not replace" }],
		],
	);
	assert.notEqual(mergedMultiSessionContext, multiSessionContext);
	assert.deepEqual(mergedMultiSessionContext.sessions.pending, {
		included: true,
		notes: false,
		data: { name: "Завантажена сесія" },
	});
	assert.strictEqual(
		mergedMultiSessionContext.sessions.loaded,
		existingLoadedSession,
	);
	const duplicateSessionContext = mergeLoadedAiSessionData(
		{ ...createInitialAiContextConfig(), sessions: null },
		[
			["duplicate", { included: false }, {}],
			["duplicate", { included: true }, { name: "Second" }],
		],
	);
	assert.deepEqual(duplicateSessionContext.sessions.duplicate, {
		included: false,
		data: {},
	});
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
	assert.equal(normalizeCustomMonsterCollection(monsterList), monsterList);
	const emptyMonsterList = [];
	assert.equal(
		normalizeCustomMonsterCollection({ monster: emptyMonsterList }),
		emptyMonsterList,
	);
	const fallbackMonsterList = [{ name: "Лісовик" }];
	assert.equal(
		normalizeCustomMonsterCollection({
			monster: null,
			monsters: fallbackMonsterList,
		}),
		fallbackMonsterList,
	);
	assert.equal(
		normalizeCustomMonsterCollection({
			monster: monsterList,
			monsters: fallbackMonsterList,
		}),
		monsterList,
	);
	const mixedMonsterList = [
		{ name: "Мавка" },
		null,
		"not-a-monster",
		() => null,
		[{ name: "Nested" }],
		{ name: "Вовкулака" },
	];
	const normalizedMixedMonsters = normalizeCustomMonsterCollection({
		monster: mixedMonsterList,
	});
	assert.notEqual(normalizedMixedMonsters, mixedMonsterList);
	assert.deepEqual(normalizedMixedMonsters, [
		{ name: "Мавка" },
		{ name: "Вовкулака" },
	]);
	assert.deepEqual(normalizeCustomMonsterCollection({ monster: null }), []);
	assert.deepEqual(normalizeCustomMonsterCollection(null), []);
	assert.deepEqual(normalizeCustomMonsterCollection("not-a-collection"), []);
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
	assert.deepEqual(
		buildNpcImageTarget(
			{
				slug: "npc-slug",
				level: 0,
				notes: [
					{ title: "Приховано", text: "Не включати", _aiIgnored: true },
					"Коротка примітка",
				],
			},
			{ displayName: "Нульовий рівень", scope: "session" },
		),
		{
			type: "npc",
			id: "npc-slug",
			name: "Нульовий рівень",
			race: "",
			class: "",
			level: 0,
			description: "",
			motivation: "",
			trait: "",
			notes: ["Коротка примітка"],
			scope: "session",
		},
	);
	assert.deepEqual(
		buildLocationImageTarget(
			{ slug: "location-slug", description: "Стародавній храм" },
			{ displayName: "Храм", scope: "campaign" },
		),
		{
			type: "location",
			id: "location-slug",
			name: "Храм",
			description: "Стародавній храм",
			notes: [],
			scope: "campaign",
		},
	);
	assert.equal(
		getImageTargetNotes({
			notes: Array.from({ length: 10 }, (_, index) => `Note ${index}`),
		}).length,
		8,
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
	assert.equal(
		getAttachedImageKey({ name: "карта.png", sizeBytes: 42, url: "" }),
		"карта.png:42",
	);
	assert.equal(getAttachedImageKey({ name: "map.png", url: " " }), " ");
	assert.equal(getAttachedImageKey(null), ":");
	assert.equal(getAttachedFileKey({ name: "empty.txt", sizeBytes: 0 }), "empty.txt:");
	assert.equal(getAttachedFileKey({ name: "odd.txt", sizeBytes: -1 }), "odd.txt:-1");
	assert.equal(
		getAttachedImageKey({ name: "safe.png", sizeBytes: 7, url: 123 }),
		"safe.png:7",
	);
	assert.equal(
		getAttachedFileKey({ name: "notes.md", sizeBytes: 8, url: "/ignored" }),
		"notes.md:8",
	);
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
	const indexedEncounter = { id: 7, name: "Indexed", monsters: null };
	assert.equal(
		getSceneImageTargetEncounter({
			encounterIndex: 0,
			_imagePromptEncounters: [indexedEncounter],
		}),
		indexedEncounter,
	);
	assert.equal(
		getSceneImageTargetEncounter({
			encounterId: "7",
			_imagePromptEncounters: [indexedEncounter],
		}),
		indexedEncounter,
	);
	assert.deepEqual(
		buildSceneImageTarget(
			{
				id: "scene-indexed",
				encounterIndex: 0,
				_imagePromptEncounters: [indexedEncounter],
				npcs: "invalid",
			},
			{ title: "Indexed scene" },
		),
		{
			type: "scene",
			id: "scene-indexed",
			name: "Indexed scene",
			sessionName: "",
			sessionFileName: "",
			texts: {},
			notes: [],
			npcs: [],
			encounter: { name: "Indexed", monsters: [] },
		},
	);
	const monsterImageTarget = buildCustomMonsterImageTarget({
		name: "Ash Drake",
		str: 18,
		action: [{ name: "Bite" }],
	});
	assert.equal(monsterImageTarget.source, "CUSTOM");
	assert.equal(monsterImageTarget.abilities.str, 18);
	assert.equal(monsterImageTarget.actions[0].name, "Bite");
	const legacyMonsterImageTarget = buildCustomMonsterImageTarget({
		name: "Лісовик",
		desc: "Старий дух",
		str: 0,
		source: "",
	});
	assert.equal(legacyMonsterImageTarget.description, "Старий дух");
	assert.equal(legacyMonsterImageTarget.source, "CUSTOM");
	assert.equal(legacyMonsterImageTarget.abilities.str, 0);
});

await run("AI mention candidates preserve source, configuration, operation, and UTF-8 rules", () => {
	const candidates = mentionProcessing.collectMentionCandidates(
		{
			characters: [{ firstName: "Олена", lastName: "Коваль" }],
			npcs: [{ name: "Гнат" }],
			locations: [{ title: "Долина" }],
			scenes: [{ npcs: [{ name: "Генерований NPC" }, { name: "Я" }] }],
			operations: [
				{
					entity: "character",
					data: { firstName: "Data", lastName: "Hero" },
					patch: { name: "Patch ignored" },
				},
				{ entity: "npcs", patch: { name: "Patch NPC" } },
				{ entity: "factions", data: { title: "Орден" } },
				{ entity: "scene", patch: { npcs: [{ name: "Операційний NPC" }] } },
				{ entity: "unknown", data: { name: "Ігнорувати" } },
				null,
			],
		},
		{
			campaign: {
				characters: [{ first_name: "Олена", last_name: "Коваль" }],
				npcs: [{ title: "Мандрівник" }],
				locations: [{ name: "Стара Брама" }],
			},
			currentSession: {
				data: {
					npcs: [{ firstName: "Ірина", lastName: "Стоун" }],
					locations: [{ name: "Порт" }],
					scenes: [{ npcs: [{ name: "Сценовий NPC" }] }],
				},
			},
			sessions: [
				{ conf: { included: false }, data: { npcs: [{ name: "Виключений" }] } },
				{
					conf: { included: true, scenes: { "scene-1": { included: true }, "scene-2": { included: false } } },
					data: {
						npcs: [{ name: "Тарас" }],
						locations: [{ name: "Вежа" }],
						scenes: [
							{ id: "scene-1", npcs: [{ name: "Роман" }] },
							{ id: "scene-2", npcs: [{ name: "Прихований" }] },
						],
					},
				},
				{ conf: { included: true, scenes: {} }, data: { scenes: [{ npcs: [{ name: "Без фільтра" }] }] } },
			],
		},
	);
	for (const expected of [
		"Олена Коваль",
		"Мандрівник",
		"Стара Брама",
		"Ірина Стоун",
		"Порт",
		"Сценовий NPC",
		"Тарас",
		"Вежа",
		"Роман",
		"Без фільтра",
		"Гнат",
		"Долина",
		"Генерований NPC",
		"Data Hero",
		"Patch NPC",
		"Орден",
		"Операційний NPC",
	]) assert.ok(candidates.includes(expected), expected);
	assert.equal(candidates.filter((name) => name === "Олена Коваль").length, 1);
	for (const omitted of ["Я", "Patch ignored", "Ігнорувати", "Виключений", "Прихований"]) {
		assert.equal(candidates.includes(omitted), false, omitted);
	}
	assert.deepEqual(
		mentionProcessing.collectMentionCandidates(
			{ operations: {}, scenes: [{ npcs: {} }] },
			{ campaign: null, currentSession: { data: { scenes: {} } }, sessions: {} },
		),
		[],
	);
});

await run("AI context identity policies preserve stable scoped entity keys", () => {
	assert.equal(
		getAiCharacterContextKey({
			slug: " герой ",
			id: 17,
			firstName: "Ірина",
		}),
		"герой",
	);
	assert.equal(
		getAiCharacterContextKey({ id: 0, name: "Нульовий герой" }),
		"0",
	);
	assert.equal(
		getAiCharacterContextKey({
			firstName: "   ",
			first_name: " Ірина ",
			last_name: " Штормова ",
		}),
		"Ірина Штормова",
	);
	assert.equal(
		getAiCharacterContextKey({ title: " Архіварка " }),
		"Архіварка",
	);
	assert.equal(getAiCharacterContextKey({}), "");
	assert.equal(
		getAiLocationContextKey({ slug: " порт ", id: 9, name: "Причал" }),
		"порт",
	);
	assert.equal(getAiLocationContextKey({ id: 0, name: "Нульова точка" }), "0");
	assert.equal(getAiLocationContextKey({ title: "Не location fallback" }), "");

	const characterContext = ensureContextListItems(
		{ included: true, items: {} },
		[{ id: 1, name: "Спільне ім'я" }],
		getAiCharacterContextKey,
	);
	const npcContext = ensureContextListItems(
		{ included: true, items: {} },
		[{ id: 1, name: "Інший scope" }],
		getAiCharacterContextKey,
	);
	assert.deepEqual(characterContext.items, { "1": true });
	assert.deepEqual(npcContext.items, { "1": true });
});

await run("campaign graph presentation preserves labels, visibility, and open targets", () => {
	const translate = (value) => value;
	assert.equal(
		formatCampaignGraphSourceField(
			{ type: "scene-note", field: "scenes[0].note.text" },
			translate,
		),
		"Scene note text",
	);
	assert.deepEqual(
		getCampaignGraphEdgeHandles({ x: 0, y: 0 }, { x: -20, y: 2 }),
		{ sourceHandle: "source-left", targetHandle: "target-right" },
	);
	assert.deepEqual(
		getCampaignGraphEdgePresentation(
			{
				id: "sequence",
				source: "one",
				target: "two",
				relation: "sequence",
				count: 2,
				sources: [],
			},
			"one",
		),
		{
			isFocused: true,
			type: "default",
			animated: false,
			isMuted: false,
			strokeDasharray: "10 7",
			hasSequenceMarker: true,
			label: "2",
		},
	);
	assert.deepEqual(
		getCampaignGraphNoteSaveRequest(
			{
				id: "note",
				type: "scene-note",
				label: "Нотатка",
				meta: { fileName: "session.json", sceneId: { invalid: true } },
				sourceId: "note-1",
			},
			{ title: "Зміна" },
		),
		{
			nodeType: "scene-note",
			fileName: "session.json",
			sceneId: undefined,
			noteId: "note-1",
			updates: { title: "Зміна" },
		},
	);

	const graph = {
		nodes: [
			{ id: "campaign", type: "campaign", label: "Кампанія", meta: {}, searchText: "кампанія", degree: 1 },
			{ id: "npc", type: "npc", label: "Вартовий", meta: {}, searchText: "вартовий", degree: 1, sourceId: "npc-1" },
		],
		edges: [
			{ id: "edge", source: "campaign", target: "npc", relation: "mentions", count: 1, sources: [] },
		],
		stats: { nodes: 2, edges: 1, unresolved: 0 },
	};
	const visible = getVisibleCampaignGraph(
		graph,
		DEFAULT_CAMPAIGN_GRAPH_FILTERS,
		"вартовий",
	);
	assert.deepEqual(visible.nodes.map((node) => node.id), ["campaign", "npc"]);
	assert.deepEqual(
		getCampaignGraphOpenTarget({
			node: graph.nodes[1],
			characters: [],
			npcs: [{ id: "npc-1", firstName: "Вартовий" }],
			locations: [],
			notes: [],
			sessionDetails: {},
			canSaveNote: true,
		}),
		{
			kind: "entity",
			entity: { id: "npc-1", firstName: "Вартовий" },
			entityType: "npc",
		},
	);
	assert.deepEqual(
		getCampaignGraphMiniMapNodeSize({
			type: "location",
			data: { graphNode: { type: "npc" } },
			measured: { width: 0, height: 75 },
			width: "123.5px",
			height: -5,
			style: { width: 400, height: "81.25rem" },
		}),
		{ width: 123.5, height: 75 },
	);
	assert.deepEqual(
		getCampaignGraphMiniMapNodeSize({
			type: "location",
			data: { graphNode: { type: "npc" } },
			measured: { width: Number.NaN, height: 0 },
			width: -1,
			height: "invalid",
			style: { width: 0, height: -3 },
		}),
		getCampaignGraphNodeSize("location"),
	);
	assert.deepEqual(
		getCampaignGraphMiniMapBounds([
			{ id: "one", type: "npc", position: { x: 0, y: 0 }, style: { width: 100, height: 50 } },
		]),
		{ x: -55.5, y: -37, width: 111, height: 74 },
	);
});

await run("campaign graph presentation contracts preserve edge focus and opacity", () => {
	const edge = (relation, count = 1) => ({
		id: `${relation}-${count}`,
		source: "one",
		target: "two",
		relation,
		count,
		sources: [],
	});
	assert.deepEqual(getCampaignGraphEdgePresentation(edge("contains"), null), {
		isFocused: true,
		type: "smoothstep",
		animated: false,
		isMuted: false,
		strokeDasharray: undefined,
		hasSequenceMarker: false,
		label: undefined,
	});
	assert.deepEqual(getCampaignGraphEdgePresentation(edge("mentions", 3), "one"), {
		isFocused: true,
		type: "default",
		animated: true,
		isMuted: false,
		strokeDasharray: undefined,
		hasSequenceMarker: false,
		label: "3",
	});
	assert.deepEqual(getCampaignGraphEdgePresentation(edge("related", 2), "other"), {
		isFocused: false,
		type: "default",
		animated: false,
		isMuted: true,
		strokeDasharray: "7 6",
		hasSequenceMarker: false,
		label: undefined,
	});
	assert.deepEqual(
		["contains", "sequence", "mentions"].map((relation) =>
			getCampaignGraphEdgeOpacity(edge(relation), true, false)),
		[0.16, 0.35, 0.32],
	);
	assert.equal(getCampaignGraphEdgeOpacity(edge("contains"), true, true), 0.55);
	assert.equal(getCampaignGraphEdgeOpacity(edge("mentions"), true, true), 0.9);
	assert.equal(getCampaignGraphEdgeOpacity(edge("sequence"), false, true), 0.07);
});

await run("campaign graph presentation contracts preserve note and entity targets", () => {
	const campaignNote = { id: 0, title: "Кампанія" };
	const sessionNote = { id: "session-note", title: "Сесія" };
	const sceneNote = { id: 7, title: "Сцена" };
	const sessionNpc = { id: "npc-1", firstName: "Сесійний NPC" };
	const sessionLocation = { slug: "cellar", name: "Підвал" };
	const sessionDetails = {
		"session.json": {
			data: {
				notes: [sessionNote],
				npcs: [sessionNpc],
				locations: [sessionLocation],
				scenes: [{ id: "scene-1", notes: [sceneNote] }],
			},
		},
	};
	const node = (type, sourceId, meta = {}) => ({
		id: `${type}:${String(sourceId)}`,
		type,
		label: type,
		sourceId,
		meta,
	});
	const campaignNode = node("campaign-note", "0");
	const sessionNode = node("session-note", "session-note", { fileName: "session.json" });
	const sceneNode = node("scene-note", "7", { fileName: "session.json", sceneId: "scene-1" });
	assert.equal(findCampaignGraphEditableNote(campaignNode, [campaignNote], sessionDetails), campaignNote);
	assert.equal(findCampaignGraphEditableNote(sessionNode, [], sessionDetails), sessionNote);
	assert.equal(findCampaignGraphEditableNote(sceneNode, [], sessionDetails), sceneNote);
	assert.equal(findCampaignGraphEditableNote(node("npc", "npc-1"), [], sessionDetails), null);

	const baseInput = {
		characters: [],
		npcs: [],
		locations: [],
		notes: [campaignNote],
		sessionDetails,
		canSaveNote: true,
	};
	assert.deepEqual(getCampaignGraphOpenTarget({
		...baseInput,
		node: node("session", "session", { fileName: "session.json" }),
	}), { kind: "session", fileName: "session.json" });
	assert.deepEqual(getCampaignGraphOpenTarget({ ...baseInput, node: campaignNode }), {
		kind: "note",
		note: campaignNote,
	});
	assert.deepEqual(getCampaignGraphOpenTarget({
		...baseInput,
		node: node("npc", "npc-1", { scope: "session", fileName: "session.json" }),
	}), { kind: "entity", entity: sessionNpc, entityType: "npc" });
	assert.deepEqual(getCampaignGraphOpenTarget({
		...baseInput,
		node: { ...node("location", "missing", { scope: "session", fileName: "session.json" }), sourceSlug: "cellar" },
	}), { kind: "entity", entity: sessionLocation, entityType: "locations" });
	assert.deepEqual(getCampaignGraphOpenTarget({ ...baseInput, node: campaignNode, canSaveNote: false }), {
		kind: "none",
	});
	assert.deepEqual(getCampaignGraphOpenTarget({ ...baseInput, node: node("npc", "missing") }), {
		kind: "none",
	});
});

await run("campaign graph presentation contracts validate note save requests", () => {
	const updates = { title: "Зміна" };
	const node = (type, sourceId, meta = {}) => ({ id: "note", type, label: "Нотатка", sourceId, meta });
	assert.equal(getCampaignGraphNoteSaveRequest(node("npc", "npc-1"), updates), null);
	assert.equal(getCampaignGraphNoteSaveRequest(node("campaign-note", null), updates), null);
	const request = getCampaignGraphNoteSaveRequest(
		node("scene-note", 0, { fileName: "session.json", sceneId: 7 }),
		updates,
	);
	assert.deepEqual(request, {
		nodeType: "scene-note",
		fileName: "session.json",
		sceneId: 7,
		noteId: 0,
		updates,
	});
	assert.equal(request.updates, updates);
});

await run("campaign graph UI policies preserve text, node-card, and fit decisions", () => {
	assert.deepEqual(getCampaignGraphDetailTextPresentation("  [Герой]  ", true), {
		text: "  [Герой]  ",
		isVisible: true,
		className: "CampaignNotesGraph__detailText is_clickable",
		role: "button",
		tabIndex: 0,
	});
	assert.deepEqual(getCampaignGraphDetailTextPresentation(0, false), {
		text: "",
		isVisible: false,
		className: "CampaignNotesGraph__detailText",
		role: undefined,
		tabIndex: undefined,
	});
	assert.equal(shouldActivateCampaignGraphDetailText(true, "pointer"), true);
	assert.equal(shouldActivateCampaignGraphDetailText(true, "pointer", true), false);
	assert.equal(shouldActivateCampaignGraphDetailText(true, "Enter"), true);
	assert.equal(shouldActivateCampaignGraphDetailText(true, " "), true);
	assert.equal(shouldActivateCampaignGraphDetailText(true, "Escape"), false);
	assert.equal(shouldActivateCampaignGraphDetailText(false, "Enter"), false);

	const graphNode = {
		id: "npc",
		type: "npc",
		label: "Вартовий",
		summary: "Біля брами",
		degree: 2,
		meta: {},
	};
	assert.deepEqual(getCampaignGraphNodeCardPresentation(graphNode, false, true, true, true), {
		className: "CampaignNotesGraph__nodeCard is_npc is_selected is_muted",
		showSummary: true,
		showDegree: true,
		showOpen: true,
	});
	assert.deepEqual(
		getCampaignGraphNodeCardPresentation({ ...graphNode, summary: "", degree: 0 }, false, false, false, false),
		{
			className: "CampaignNotesGraph__nodeCard is_npc",
			showSummary: false,
			showDegree: false,
			showOpen: false,
		},
	);

	const fitInput = {
		hasFlowInstance: true,
		flowNodeCount: 2,
		graphNodeCount: 2,
		flowNodeTopologyKey: "same",
		nodeTopologyKey: "same",
		hasManualPositions: false,
		hasFittedTopology: false,
	};
	assert.equal(shouldFitCampaignGraphTopology(fitInput), true);
	for (const invalid of [
		{ hasFlowInstance: false },
		{ flowNodeCount: 0, graphNodeCount: 0 },
		{ graphNodeCount: 3 },
		{ flowNodeTopologyKey: "other" },
		{ hasManualPositions: true },
		{ hasFittedTopology: true },
	]) {
		assert.equal(shouldFitCampaignGraphTopology({ ...fitInput, ...invalid }), false);
	}
});

await run("campaign graph UI policies preserve topology, projection, and target routing", () => {
	assert.equal(
		getCampaignGraphNodeTopologyKey([
			{ id: "two", type: "npc", data: { graphNode: { type: "scene" } } },
			{ id: "one", type: "campaign" },
		]),
		"one:campaign|two:scene",
	);
	assert.equal(
		getCampaignGraphNodeTopologyKey([{ id: "one", type: "npc", data: null }]),
		"one:npc",
	);

	const stableProjection = getCampaignGraphFlowProjectionPlan(
		["one", "two"],
		["two", "one"],
		true,
		false,
	);
	assert.equal(stableProjection.shouldUseFreshLayout, false);
	assert.deepEqual([...stableProjection.currentNodeIds], ["one", "two"]);
	assert.equal(
		getCampaignGraphFlowProjectionPlan(["one"], ["one"], false, false).shouldUseFreshLayout,
		true,
	);
	assert.equal(
		getCampaignGraphFlowProjectionPlan([], [], true, false).shouldUseFreshLayout,
		true,
	);
	assert.equal(
		getCampaignGraphFlowProjectionPlan(["one"], ["two"], true, false).shouldUseFreshLayout,
		true,
	);
	assert.equal(
		getCampaignGraphFlowProjectionPlan(["one"], ["two"], true, true).shouldUseFreshLayout,
		false,
	);

	const npc = { id: "npc", type: "npc", label: "Вартовий", meta: {} };
	const session = {
		id: "session",
		type: "session",
		label: "Сесія",
		meta: { fileName: "session.json" },
	};
	const nodeById = new Map([[npc.id, npc], [session.id, session]]);
	const edge = {
		id: "edge",
		source: "npc",
		target: "session",
		relation: "mentions",
		count: 3,
		sources: [],
	};
	const sessionConnection = getCampaignGraphConnectionPresentation(
		edge,
		"npc",
		nodeById,
		"Mentions",
		"Scene text",
	);
	assert.deepEqual(sessionConnection, {
		node: session,
		metaText: "Mentions (3) · Scene text",
		action: { kind: "session", fileName: "session.json" },
	});
	assert.equal(sessionConnection.node, session);
	assert.deepEqual(
		getCampaignGraphConnectionPresentation(edge, "session", nodeById, "Mentions", ""),
		{ node: npc, metaText: "Mentions (3)", action: { kind: "select", nodeId: "npc" } },
	);
	assert.equal(
		getCampaignGraphConnectionPresentation(edge, "npc", new Map(), "Mentions", ""),
		null,
	);

	const routed = [];
	const handlers = {
		session: (fileName) => routed.push(["session", fileName]),
		entity: (entity, entityType) => routed.push(["entity", entity, entityType]),
		note: (note) => routed.push(["note", note]),
		none: () => routed.push(["none"]),
	};
	const note = { id: "note", title: "Нотатка" };
	executeCampaignGraphOpenTarget({ kind: "session", fileName: "session.json" }, handlers);
	executeCampaignGraphOpenTarget({ kind: "entity", entity: npc, entityType: "npc" }, handlers);
	executeCampaignGraphOpenTarget({ kind: "note", note }, handlers);
	executeCampaignGraphOpenTarget({ kind: "none" }, handlers);
	assert.deepEqual(routed, [
		["session", "session.json"],
		["entity", npc, "npc"],
		["note", note],
		["none"],
	]);
});

await run("campaign view orchestration preserves state, sync, delete, and AI flows", async () => {
	const notes = [{ id: "note-1", text: "Український текст" }];
	const entities = [{ id: "hero-1", name: "Герой" }];
	const projection = getCampaignViewStateProjection({
		description: "Опис",
		notes,
		isDescriptionCollapsed: true,
		isNotesCollapsed: false,
	});
	assert.equal(projection.description, "Опис");
	assert.equal(projection.notes, notes);
	assert.equal(projection.isDescriptionCollapsed, true);
	assert.equal(projection.isNotesCollapsed, false);
	assert.deepEqual(getCampaignViewStateProjection({}), {
		description: "",
		notes: [],
		isDescriptionCollapsed: false,
		isNotesCollapsed: false,
		isCharactersCollapsed: false,
		isNpcsCollapsed: false,
		isLocationsCollapsed: false,
	});
	assert.equal(getCampaignViewEntities(entities), entities);
	assert.deepEqual(getCampaignViewEntities(null), []);

	assert.deepEqual(getCampaignSyncPlan(null, "кампанія"), {
		reloadEntities: false,
		reloadSessions: false,
	});
	assert.deepEqual(
		getCampaignSyncPlan(
			{ version: 1, campaignSlug: "інша", resource: "ai" },
			"кампанія",
		),
		{ reloadEntities: false, reloadSessions: false },
	);
	const syncExpectations = new Map([
		["entities", [true, false]],
		["images", [true, false]],
		["sessions", [false, true]],
		["ai", [true, true]],
		["import", [true, true]],
		["unknown", [false, false]],
	]);
	for (const [resource, [reloadEntities, reloadSessions]] of syncExpectations) {
		assert.deepEqual(
			getCampaignSyncPlan({ version: 1, resource }, "кампанія"),
			{ reloadEntities, reloadSessions },
		);
	}
	const syncCalls = [];
	executeCampaignSyncPlan(
		{ reloadEntities: true, reloadSessions: true },
		{
			reloadEntities: () => syncCalls.push("entities"),
			reloadSessions: () => syncCalls.push("sessions"),
		},
	);
	assert.deepEqual(syncCalls, ["entities", "sessions"]);

	const imageErrors = [];
	assert.equal(
		await executeCampaignImageCheck({
			campaignSlug: "кампанія",
			checkImages: async (slug) => ({ hasImages: slug === "кампанія" }),
			onError: (error) => imageErrors.push(error),
		}),
		true,
	);
	const imageFailure = new Error("image check failed");
	assert.equal(
		await executeCampaignImageCheck({
			campaignSlug: "кампанія",
			checkImages: async () => { throw imageFailure; },
			onError: (error) => imageErrors.push(error),
		}),
		true,
	);
	assert.deepEqual(imageErrors, [imageFailure]);

	const translations = [];
	const translate = (key) => {
		translations.push(key);
		return `t:${key}`;
	};
	const withImages = getCampaignDeleteConfirmationConfig(true, translate);
	assert.equal(withImages.checkboxDefaultChecked, true);
	assert.deepEqual(withImages.getConfirmValue(null, false), {
		confirmed: true,
		moveImagesToGeneral: false,
	});
	const withoutImages = getCampaignDeleteConfirmationConfig(false, translate);
	assert.equal(withoutImages.checkboxLabel, undefined);
	assert.deepEqual(withoutImages.getConfirmValue(), {
		confirmed: true,
		moveImagesToGeneral: false,
	});
	assert.equal(translations.length, 5);
	const deleteCalls = [];
	assert.equal(
		await executeCampaignDelete({
			campaignSlug: "кампанія",
			hasCampaignImages: true,
			confirmation: { confirmed: true, moveImagesToGeneral: true },
			deleteCampaign: async (...args) => deleteCalls.push(["delete", ...args]),
			onDeleted: () => deleteCalls.push(["deleted"]),
			onError: (error) => deleteCalls.push(["error", error]),
		}),
		"deleted",
	);
	assert.deepEqual(deleteCalls, [
		["delete", "кампанія", { moveImagesToGeneral: true }],
		["deleted"],
	]);
	assert.equal(
		await executeCampaignDelete({
			campaignSlug: "кампанія",
			hasCampaignImages: false,
			confirmation: null,
			deleteCampaign: async () => { throw new Error("must not run"); },
			onDeleted: () => { throw new Error("must not run"); },
			onError: () => { throw new Error("must not run"); },
		}),
		"cancelled",
	);

	const defaultAiPlan = getCampaignAiUpdatePlan({ description: "", notes }, {});
	assert.deepEqual(defaultAiPlan.campaignState, { description: "", notes });
	assert.deepEqual(defaultAiPlan.entityTypes, ["characters", "npc", "locations"]);
	const explicitTypes = [];
	assert.equal(getCampaignAiUpdatePlan(null, { entityTypes: explicitTypes }).entityTypes, explicitTypes);
	const aiCalls = [];
	assert.equal(
		await executeCampaignAiEntityReload({
			campaignSlug: "кампанія",
			entityTypes: ["characters", "locations"],
			getEntities: async (slug, type) => {
				aiCalls.push(["get", slug, type]);
				return type === "characters" ? entities : null;
			},
			normalizeEntity: (entity) => ({ ...entity, normalized: true }),
			setEntities: {
				characters: (value) => aiCalls.push(["set", "characters", value]),
				npc: (value) => aiCalls.push(["set", "npc", value]),
				locations: (value) => aiCalls.push(["set", "locations", value]),
			},
			onError: (error) => aiCalls.push(["error", error]),
		}),
		"reloaded",
	);
	assert.deepEqual(aiCalls.filter(([kind]) => kind === "set"), [
		["set", "characters", [{ id: "hero-1", name: "Герой", normalized: true }]],
		["set", "locations", []],
	]);
	assert.equal(
		await executeCampaignAiEntityReload({
			campaignSlug: "кампанія",
			entityTypes: [],
			getEntities: async () => { throw new Error("must not run"); },
			normalizeEntity: (entity) => entity,
			setEntities: {},
			onError: () => { throw new Error("must not run"); },
		}),
		"skipped",
	);
});

await run("campaign create-session and rename orchestration preserves exact workflows", async () => {
	assert.deepEqual(getCampaignSessionCreationPlan(null), { kind: "cancelled" });
	assert.deepEqual(getCampaignSessionCreationPlan(undefined), {
		kind: "create",
		name: "",
	});
	assert.deepEqual(getCampaignSessionCreationPlan(0), {
		kind: "create",
		name: "",
	});
	assert.deepEqual(getCampaignSessionCreationPlan("  Сесія  "), {
		kind: "create",
		name: "  Сесія  ",
	});

	const createdSession = {
		id: "session-1",
		fileName: "перша-сесія.json",
		name: "Перша сесія",
	};
	const sessionCalls = [];
	assert.equal(
		await executeCampaignSessionCreation({
			campaignSlug: "кампанія",
			plan: { kind: "create", name: "Перша сесія" },
			createSession: async (...args) => {
				sessionCalls.push(["create", ...args]);
				return createdSession;
			},
			onCreated: (session) => sessionCalls.push(["created", session]),
			onError: (error) => sessionCalls.push(["error", error]),
		}),
		"created",
	);
	assert.deepEqual(sessionCalls, [
		["create", "кампанія", "Перша сесія"],
		["created", createdSession],
	]);
	assert.equal(
		await executeCampaignSessionCreation({
			campaignSlug: "кампанія",
			plan: { kind: "cancelled" },
			createSession: async () => { throw new Error("must not run"); },
			onCreated: () => { throw new Error("must not run"); },
			onError: () => { throw new Error("must not run"); },
		}),
		"cancelled",
	);
	const missingSessionErrors = [];
	assert.equal(
		await executeCampaignSessionCreation({
			campaignSlug: "кампанія",
			plan: { kind: "create", name: "" },
			createSession: async () => null,
			onCreated: () => { throw new Error("must not run"); },
			onError: (error) => missingSessionErrors.push(error),
		}),
		"failed",
	);
	assert.equal(missingSessionErrors[0].message, "Session creation returned no session");

	assert.deepEqual(getCampaignRenamePlan(null, "Стара"), { kind: "cancelled" });
	assert.deepEqual(getCampaignRenamePlan("", "Стара"), { kind: "cancelled" });
	assert.deepEqual(getCampaignRenamePlan("Стара", "Стара"), {
		kind: "cancelled",
	});
	assert.deepEqual(getCampaignRenamePlan("  Нова  ", "Стара"), {
		kind: "rename",
		name: "  Нова  ",
	});
	const renamedCampaign = { id: "campaign-1", slug: "нова", name: "Нова" };
	const renameCalls = [];
	assert.equal(
		await executeCampaignRename({
			campaignSlug: "стара",
			plan: { kind: "rename", name: "Нова" },
			renameCampaign: async (...args) => {
				renameCalls.push(["rename", ...args]);
				return renamedCampaign;
			},
			onRenamed: (campaign) => renameCalls.push(["renamed", campaign]),
			onError: (error) => renameCalls.push(["error", error]),
		}),
		"renamed",
	);
	assert.deepEqual(renameCalls, [
		["rename", "стара", { name: "Нова" }],
		["renamed", renamedCampaign],
	]);
	assert.equal(
		await executeCampaignRename({
			campaignSlug: "стара",
			plan: { kind: "cancelled" },
			renameCampaign: async () => { throw new Error("must not run"); },
			onRenamed: () => { throw new Error("must not run"); },
			onError: () => { throw new Error("must not run"); },
		}),
		"cancelled",
	);
	const missingCampaignErrors = [];
	assert.equal(
		await executeCampaignRename({
			campaignSlug: "стара",
			plan: { kind: "rename", name: "Нова" },
			renameCampaign: async () => null,
			onRenamed: () => { throw new Error("must not run"); },
			onError: (error) => missingCampaignErrors.push(error),
		}),
		"failed",
	);
	assert.equal(missingCampaignErrors[0].message, "Campaign rename returned no campaign");
	const renameFailure = new Error("rename failed");
	const renameErrors = [];
	assert.equal(
		await executeCampaignRename({
			campaignSlug: "стара",
			plan: { kind: "rename", name: "Нова" },
			renameCampaign: async () => { throw renameFailure; },
			onRenamed: () => { throw new Error("must not run"); },
			onError: (error) => renameErrors.push(error),
		}),
		"failed",
	);
	assert.deepEqual(renameErrors, [renameFailure]);

	const statusError = Object.assign(new Error("Недоступно"), { status: 503 });
	const translate = (key, variables) => variables?.error
		? `${key}:${variables.error}`
		: `t:${key}`;
	assert.equal(
		getCampaignSessionCreationErrorMessage(statusError, translate),
		"[t:Status: 503] Недоступно",
	);
	assert.equal(
		getCampaignSessionCreationErrorMessage("Помилка", translate),
		"Помилка",
	);
	assert.equal(
		getCampaignRenameErrorMessage(renameFailure, translate),
		"Failed to rename campaign: {error}:rename failed",
	);
});

await run("campaign graph note saves plan immutable optimistic updates", async () => {
	const updateIdentity = { text: "Точна зміна" };
	const identityPlan = getCampaignGraphNoteSavePlan({
		nodeType: "session-note",
		fileName: "session.json",
		noteId: 0,
		updates: updateIdentity,
	});
	assert.equal(identityPlan.updates, updateIdentity);
	assert.deepEqual(
		getCampaignGraphNoteSavePlan({ nodeType: "campaign-note", noteId: false, updates: {} }),
		{ kind: "none" },
	);
	assert.deepEqual(
		getCampaignGraphNoteSavePlan({ nodeType: "campaign-note", noteId: "note", updates: null }),
		{ kind: "none" },
	);
	assert.deepEqual(
		getCampaignGraphNoteSavePlan({
			nodeType: "scene-note",
			fileName: "session.json",
			noteId: "note",
			updates: {},
		}),
		{ kind: "none" },
	);
	assert.deepEqual(
		getCampaignGraphNoteSavePlan({
			nodeType: "unexpected-note",
			fileName: "session.json",
			sceneId: 0,
			noteId: "note",
			updates: updateIdentity,
		}),
		{
			kind: "scene-note",
			fileName: "session.json",
			sceneId: 0,
			noteId: "note",
			updates: updateIdentity,
		},
	);
	const campaignPlan = getCampaignGraphNoteSavePlan({
		nodeType: "campaign-note",
		noteId: 0,
		updates: { title: "Нульова нотатка" },
	});
	assert.deepEqual(campaignPlan, {
		kind: "campaign-note",
		noteId: 0,
		updates: { title: "Нульова нотатка" },
	});
	assert.deepEqual(
		getCampaignGraphNoteSavePlan({
			nodeType: "session-note",
			noteId: "note-1",
			updates: { text: "Зміна" },
		}),
		{ kind: "none" },
	);
	assert.deepEqual(
		getCampaignGraphNoteSavePlan({
			nodeType: "scene-note",
			fileName: "session.json",
			sceneId: 0,
			noteId: "note-1",
			updates: { text: "Сцена" },
		}),
		{
			kind: "scene-note",
			fileName: "session.json",
			sceneId: 0,
			noteId: "note-1",
			updates: { text: "Сцена" },
		},
	);
	assert.deepEqual(
		getCampaignGraphNoteSavePlan({
			nodeType: "campaign-note",
			noteId: "note-1",
			updates: [],
		}),
		{ kind: "none" },
	);

	const campaignNotes = [{ id: 0, title: "До" }];
	const updatedCampaignNotes = applyCampaignGraphCampaignNoteSave(
		campaignNotes,
		campaignPlan,
	);
	assert.deepEqual(updatedCampaignNotes, [{ id: 0, title: "Нульова нотатка" }]);
	assert.deepEqual(campaignNotes, [{ id: 0, title: "До" }]);

	const session = {
		fileName: "session.json",
		name: "Сесія",
		data: {
			marker: "preserved",
			notes: [{ id: "1", text: "До" }],
			scenes: [
				{ id: "0", notes: [{ id: 2, text: "Старий текст" }] },
				{ id: "other", notes: [{ id: "keep", text: "Без змін" }] },
			],
		},
	};
	const sessionPlan = getCampaignGraphNoteSavePlan({
		nodeType: "session-note",
		fileName: "session.json",
		noteId: 1,
		updates: { text: "Новий текст" },
	});
	assert.notEqual(sessionPlan.kind, "none");
	assert.notEqual(sessionPlan.kind, "campaign-note");
	const updatedSession = applyCampaignGraphSessionNoteSave(session, sessionPlan);
	assert.equal(updatedSession.data.marker, "preserved");
	assert.deepEqual(updatedSession.data.notes, [{ id: "1", text: "Новий текст" }]);
	assert.deepEqual(session.data.notes, [{ id: "1", text: "До" }]);

	const scenePlan = getCampaignGraphNoteSavePlan({
		nodeType: "scene-note",
		fileName: "session.json",
		sceneId: 0,
		noteId: "2",
		updates: { text: "Оновлена сцена" },
	});
	assert.equal(scenePlan.kind, "scene-note");
	const updatedSceneSession = applyCampaignGraphSessionNoteSave(session, scenePlan);
	assert.deepEqual(updatedSceneSession.data.scenes[0].notes, [
		{ id: 2, text: "Оновлена сцена" },
	]);
	assert.equal(updatedSceneSession.data.scenes[1], session.data.scenes[1]);
	assert.deepEqual(session.data.scenes[0].notes, [
		{ id: 2, text: "Старий текст" },
	]);

	const events = [];
	const savedOutcome = await executeCampaignGraphSessionNoteSave({
		campaignSlug: "кампанія",
		plan: scenePlan,
		currentSession: session,
		onLocalUpdate: (fileName, nextSession) => {
			events.push(["local", fileName, nextSession]);
		},
		updateSession: async (campaignSlug, fileName, payload) => {
			events.push(["api", campaignSlug, fileName, payload]);
			return null;
		},
		onError: (error) => events.push(["error", error]),
	});
	assert.equal(savedOutcome, "saved");
	assert.equal(events[0][0], "local");
	assert.deepEqual(events[1], [
		"api",
		"кампанія",
		"session.json",
		{ data: events[0][2].data },
	]);

	let missingCalled = false;
	assert.equal(
		await executeCampaignGraphSessionNoteSave({
			campaignSlug: "кампанія",
			plan: scenePlan,
			currentSession: null,
			updateSession: async () => {
				missingCalled = true;
				return null;
			},
			onLocalUpdate: () => {
				missingCalled = true;
			},
			onError: () => {
				missingCalled = true;
			},
		}),
		"missing-session",
	);
	assert.equal(missingCalled, false);

	const failure = new Error("Не вдалося зберегти");
	const failureEvents = [];
	assert.equal(
		await executeCampaignGraphSessionNoteSave({
			campaignSlug: "кампанія",
			plan: scenePlan,
			currentSession: session,
			onLocalUpdate: () => failureEvents.push("local"),
			updateSession: async () => {
				failureEvents.push("api");
				throw failure;
			},
			onError: (error) => failureEvents.push(error),
		}),
		"failed",
	);
	assert.deepEqual(failureEvents, ["local", "api", failure]);
});

await run("AI generation result plans preserve prompt draft and update behavior", () => {
	assert.deepEqual(
		createTransientAiHistoryEntry("Prompt", () => 1000, () => 0.5),
		{
			id: "1000-i",
			text: "Prompt",
			createdAt: "1970-01-01T00:00:01.000Z",
		},
	);
	assert.deepEqual(
		buildAiGeneratedResultPlan({
			data: null,
			requestType: null,
			shouldParseResponse: false,
			isBestiary: false,
			isCampaign: false,
			isEncounter: false,
		}),
		{ kind: "none" },
	);

	const promptEntry = { id: "prompt-1", text: "Generated prompt" };
	assert.deepEqual(
		buildAiGeneratedResultPlan({
			data: { prompt: "Generated prompt" },
			requestType: "image",
			shouldParseResponse: false,
			isBestiary: false,
			isCampaign: true,
			isEncounter: false,
			createPromptHistoryEntry: (prompt) => ({ ...promptEntry, text: prompt }),
		}),
		{ kind: "prompt", historyEntry: promptEntry },
	);
	const precedenceEntry = { id: "precedence-1", text: "Stored prompt" };
	assert.deepEqual(
		buildAiGeneratedResultPlan({
			data: {
				prompt: "Highest priority",
				draft: true,
				updated: { name: "Must not apply" },
				aiResponse: precedenceEntry,
			},
			requestType: "campaign",
			shouldParseResponse: true,
			isBestiary: false,
			isCampaign: true,
			isEncounter: false,
		}),
		{ kind: "prompt", historyEntry: precedenceEntry },
	);

	const draftEntry = { id: "draft-1", text: "Draft" };
	assert.deepEqual(
		buildAiGeneratedResultPlan({
			data: { draft: true, aiResponse: draftEntry },
			requestType: "scene",
			shouldParseResponse: true,
			isBestiary: false,
			isCampaign: false,
			isEncounter: false,
		}),
		{
			kind: "draft",
			historyEntry: draftEntry,
			notification: "draft-created",
			closeAuxiliaryDialogs: true,
		},
	);

	const campaignPlan = buildAiGeneratedResultPlan({
		data: {
			updated: { name: "Updated campaign" },
			generated: { npcs: [] },
			aiResponse: { id: "applied-1" },
		},
		requestType: "custom-monster",
		shouldParseResponse: false,
		isBestiary: false,
		isCampaign: true,
		isEncounter: false,
		clearPromptOnApplied: false,
	});
	assert.equal(campaignPlan.kind, "updated");
	assert.equal(campaignPlan.applyDirectly, true);
	assert.equal(campaignPlan.requestCampaignReload, false);
	assert.equal(campaignPlan.clearPrompt, false);
	assert.equal(campaignPlan.refreshEntities, false);
	assert.deepEqual(campaignPlan.entityTypes, ["npc"]);
	assert.equal(campaignPlan.notification, "custom-creatures-saved");
	const executionEvents = [];
	executeAiGeneratedResultPlan({
		plan: campaignPlan,
		onHistoryEntry: (entry) => executionEvents.push(["history", entry.id]),
		onShowPrompt: (entry) => executionEvents.push(["prompt", entry.id]),
		onNotification: (notification) =>
			executionEvents.push(["notification", notification]),
		onApplyUpdated: (plan) => executionEvents.push(["apply", plan.updated.name]),
		onCampaignReload: () => executionEvents.push(["reload"]),
		onClearPrompt: () => executionEvents.push(["clear"]),
		onRefreshEntities: () => executionEvents.push(["refresh"]),
		onCloseAuxiliaryDialogs: () => executionEvents.push(["close-auxiliary"]),
		onCloseAssistantDialogs: () => executionEvents.push(["close-all"]),
	});
	assert.deepEqual(executionEvents, [
		["history", "applied-1"],
		["apply", "Updated campaign"],
		["notification", "custom-creatures-saved"],
	]);

	const sessionPlan = buildAiGeneratedResultPlan({
		data: {
			updated: { data: { scenes: [] } },
			generated: { operations: [{ op: "update", entity: "campaign" }] },
		},
		requestType: "session",
		shouldParseResponse: true,
		isBestiary: false,
		isCampaign: false,
		isEncounter: false,
	});
	assert.equal(sessionPlan.kind, "updated");
	assert.equal(sessionPlan.applyDirectly, true);
	assert.equal(sessionPlan.requestCampaignReload, true);
	assert.equal(sessionPlan.closeAssistantDialogs, true);
	assert.equal(sessionPlan.notification, "changes-applied");

	const mismatchedPlan = buildAiGeneratedResultPlan({
		data: { updated: { data: { scenes: [] } } },
		requestType: "session",
		shouldParseResponse: false,
		isBestiary: false,
		isCampaign: true,
		isEncounter: false,
	});
	assert.equal(mismatchedPlan.kind, "updated");
	assert.equal(mismatchedPlan.applyDirectly, false);
	assert.equal(mismatchedPlan.requestCampaignReload, true);

	assert.deepEqual(
		buildAiGeneratedResultPlan({
			data: { updated: "invalid" },
			requestType: null,
			shouldParseResponse: false,
			isBestiary: false,
			isCampaign: false,
			isEncounter: false,
		}),
		{ kind: "none" },
	);

	const reloadEntry = {
		id: "reload-1",
		changes: {
			resources: [{ kind: "entity", type: "locations" }],
		},
	};
	const fullReloadPlan = buildAiGeneratedResultPlan({
		data: {
			updated: { data: { scenes: [] } },
			generated: [],
			aiResponse: reloadEntry,
		},
		requestType: "session",
		shouldParseResponse: true,
		isBestiary: false,
		isCampaign: true,
		isEncounter: false,
	});
	assert.equal(fullReloadPlan.kind, "updated");
	assert.equal(fullReloadPlan.generated, null);
	assert.equal(fullReloadPlan.applyDirectly, false);
	assert.equal(fullReloadPlan.requestCampaignReload, true);
	assert.equal(fullReloadPlan.clearPrompt, true);
	assert.equal(fullReloadPlan.refreshEntities, true);
	assert.equal(fullReloadPlan.closeAssistantDialogs, true);
	assert.deepEqual(fullReloadPlan.entityTypes, ["locations"]);
	const fullReloadEvents = [];
	executeAiGeneratedResultPlan({
		plan: fullReloadPlan,
		onHistoryEntry: (entry) => fullReloadEvents.push(["history", entry.id]),
		onShowPrompt: (entry) => fullReloadEvents.push(["prompt", entry.id]),
		onNotification: (notification) =>
			fullReloadEvents.push(["notification", notification]),
		onApplyUpdated: () => fullReloadEvents.push(["apply"]),
		onCampaignReload: () => fullReloadEvents.push(["reload"]),
		onClearPrompt: () => fullReloadEvents.push(["clear"]),
		onRefreshEntities: () => fullReloadEvents.push(["refresh"]),
		onCloseAuxiliaryDialogs: () => fullReloadEvents.push(["close-auxiliary"]),
		onCloseAssistantDialogs: () => fullReloadEvents.push(["close-all"]),
	});
	assert.deepEqual(fullReloadEvents, [
		["history", "reload-1"],
		["reload"],
		["clear"],
		["notification", "changes-applied"],
		["refresh"],
		["close-all"],
	]);

	const promptExecutionEvents = [];
	executeAiGeneratedResultPlan({
		plan: { kind: "prompt", historyEntry: promptEntry },
		onHistoryEntry: (entry) => promptExecutionEvents.push(["history", entry.id]),
		onShowPrompt: (entry) => promptExecutionEvents.push(["prompt", entry.id]),
		onNotification: () => promptExecutionEvents.push(["notification"]),
		onApplyUpdated: () => promptExecutionEvents.push(["apply"]),
		onCampaignReload: () => promptExecutionEvents.push(["reload"]),
		onClearPrompt: () => promptExecutionEvents.push(["clear"]),
		onRefreshEntities: () => promptExecutionEvents.push(["refresh"]),
		onCloseAuxiliaryDialogs: () => promptExecutionEvents.push(["close-auxiliary"]),
		onCloseAssistantDialogs: () => promptExecutionEvents.push(["close-all"]),
	});
	assert.deepEqual(promptExecutionEvents, [
		["history", "prompt-1"],
		["prompt", "prompt-1"],
	]);
	const draftExecutionEvents = [];
	executeAiGeneratedResultPlan({
		plan: {
			kind: "draft",
			historyEntry: draftEntry,
			notification: "draft-created",
			closeAuxiliaryDialogs: true,
		},
		onHistoryEntry: (entry) => draftExecutionEvents.push(["history", entry.id]),
		onShowPrompt: (entry) => draftExecutionEvents.push(["prompt", entry.id]),
		onNotification: (notification) =>
			draftExecutionEvents.push(["notification", notification]),
		onApplyUpdated: () => draftExecutionEvents.push(["apply"]),
		onCampaignReload: () => draftExecutionEvents.push(["reload"]),
		onClearPrompt: () => draftExecutionEvents.push(["clear"]),
		onRefreshEntities: () => draftExecutionEvents.push(["refresh"]),
		onCloseAuxiliaryDialogs: () =>
			draftExecutionEvents.push(["close-auxiliary"]),
		onCloseAssistantDialogs: () => draftExecutionEvents.push(["close-all"]),
	});
	assert.deepEqual(draftExecutionEvents, [
		["history", "draft-1"],
		["prompt", "draft-1"],
		["notification", "draft-created"],
		["close-auxiliary"],
	]);
});

await run("AI generation execution classifies success cancellation and failures", async () => {
	const signal = new AbortController().signal;
	const noGenerationCallbacks = {
		onSucceeded: () => {},
		onCancelled: () => {},
		onFailedHistoryEntry: () => {},
		onApiKeyMissing: () => {},
		onFailed: () => {},
	};
	const successEvents = [];
	assert.deepEqual(
		await executeAiGeneration({
			payload: { type: "scene" },
			signal,
			generateAi: async (payload, options) => {
				successEvents.push(["generate", payload.type, options.signal === signal]);
				return { prompt: "Ready" };
			},
			...noGenerationCallbacks,
			onSucceeded: (data) => successEvents.push(["success", data.prompt]),
		}),
		{ status: "succeeded", data: { prompt: "Ready" } },
	);
	assert.deepEqual(successEvents, [
		["generate", "scene", true],
		["success", "Ready"],
	]);

	let cancelCount = 0;
	assert.deepEqual(
		await executeAiGeneration({
			payload: {},
			signal,
			generateAi: async () => {
				throw Object.assign(new Error("Cancelled"), { name: "AbortError" });
			},
			...noGenerationCallbacks,
			onCancelled: () => {
				cancelCount += 1;
			},
		}),
		{ status: "cancelled" },
	);
	assert.equal(cancelCount, 1);

	const apiKeyEvents = [];
	const apiKeyError = Object.assign(new Error("Missing GEMINI_API_KEY"), {
		data: { aiResponse: { id: "failed-key", status: "failed" } },
	});
	assert.deepEqual(
		await executeAiGeneration({
			payload: {},
			signal,
			generateAi: async () => {
				throw apiKeyError;
			},
			...noGenerationCallbacks,
			onFailedHistoryEntry: (entry) => apiKeyEvents.push(["history", entry.id]),
			onApiKeyMissing: () => apiKeyEvents.push(["api-key"]),
			onFailed: () => apiKeyEvents.push(["failed"]),
		}),
		{ status: "api-key-missing" },
	);
	assert.deepEqual(apiKeyEvents, [["history", "failed-key"], ["api-key"]]);

	let capturedFailure = null;
	const serviceError = Object.assign(new Error("Unavailable"), { status: 503 });
	const failureOutcome = await executeAiGeneration({
		payload: {},
		signal,
		generateAi: async () => {
			throw serviceError;
		},
		...noGenerationCallbacks,
		onFailed: (failure) => {
			capturedFailure = failure;
		},
	});
	assert.equal(failureOutcome.status, "failed");
	assert.equal(capturedFailure.message, "Unavailable");
	assert.equal(capturedFailure.status, 503);
	assert.equal(
		formatAiGenerationFailureAlert(capturedFailure, "Status"),
		"[Status: 503] Unavailable",
	);
});

await run("AI updated data plans target bestiary session campaign and reload flows", () => {
	const bestiaryPlan = buildAiUpdatedDataPlan({
		updated: { monsters: [] },
		generated: { monsters: [{ name: "Ash Drake" }] },
		isBestiary: true,
		isCampaign: false,
		isEncounter: false,
	});
	assert.equal(bestiaryPlan.applied, true);
	assert.deepEqual(bestiaryPlan.syncEvent, {
		resource: "custom-bestiary",
		monsterName: "Ash Drake",
		monsterSource: "CUSTOM",
	});
	assert.equal(bestiaryPlan.refreshEntities, true);
	assert.equal(bestiaryPlan.requestCampaignReload, false);

	const sessionPlan = buildAiUpdatedDataPlan({
		updated: {
			file_name: "session-2",
			data: {
				encounters: [
					{ id: 3, name: "Ambush" },
					{ id: 4, name: "Other" },
				],
			},
		},
		entityTypes: ["npc"],
		isBestiary: false,
		isCampaign: false,
		isEncounter: true,
		encounterId: "3",
		fallbackSessionFileName: "fallback",
	});
	assert.equal(sessionPlan.applied, true);
	assert.equal(sessionPlan.activeSession.file_name, "session-2");
	assert.equal(sessionPlan.activeEncounter.name, "Ambush");
	assert.deepEqual(sessionPlan.syncEvent, { sessionFileName: "session-2" });
	assert.equal(sessionPlan.refreshEntities, true);

	const campaignPlan = buildAiUpdatedDataPlan({
		updated: { name: "Renamed" },
		activeCampaign: { id: "campaign-1", name: "Old" },
		entityTypes: [],
		isBestiary: false,
		isCampaign: true,
		isEncounter: false,
	});
	assert.deepEqual(campaignPlan.activeCampaign, {
		id: "campaign-1",
		name: "Renamed",
	});
	assert.equal(campaignPlan.refreshEntities, false);

	const reloadPlan = buildAiUpdatedDataPlan({
		updated: { name: "Foreign campaign" },
		entityTypes: ["locations", null],
		isBestiary: false,
		isCampaign: false,
		isEncounter: false,
	});
	assert.equal(reloadPlan.applied, false);
	assert.equal(reloadPlan.requestCampaignReload, true);
	assert.equal(reloadPlan.refreshEntities, true);
	assert.equal(
		buildAiUpdatedDataPlan({
			updated: [],
			isBestiary: false,
			isCampaign: false,
			isEncounter: false,
		}),
		null,
	);

	const events = [];
	assert.equal(
		executeAiUpdatedDataPlan({
			plan: sessionPlan,
			onSetActiveCampaign: () => events.push("campaign"),
			onSetActiveSession: () => events.push("session"),
			onSetActiveEncounter: () => events.push("encounter"),
			onRequestCampaignReload: () => events.push("reload"),
			onPublishSyncEvent: () => events.push("sync"),
			onRefreshEntities: () => events.push("entities"),
		}),
		true,
	);
	assert.deepEqual(events, [
		"session",
		"encounter",
		"reload",
		"sync",
		"entities",
	]);
});

await run("AI assistant delegates stable visual composition to feature UI", async () => {
	const panelSource = await fs.readFile(
		"src/widgets/ai-assistant/ui/AiAssistantPanel.tsx",
		"utf8",
	);
	const panelViewSource = await fs.readFile(
		"src/widgets/ai-assistant/ui/AiAssistantPanelView.tsx",
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

	assert.match(panelSource, /<AiAssistantPanelView/);
	assert.match(panelViewSource, /<AiAssistantShell/);
	assert.match(panelViewSource, /<AiPromptComposer/);
	assert.match(panelViewSource, /<AiHistoryResponseDialog/);
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
	assert.deepEqual(
		getAiAttachmentControlsView({
			attachedFileCount: 4,
			attachedImageCount: 3,
			campaignSlug: "кампанія",
			disabled: false,
			maximum: 4,
		}),
		{
			fileActionDisabled: true,
			gallerySource: "кампанія",
			showImageActions: true,
		},
	);
	assert.deepEqual(
		getAiAttachmentControlsView({
			attachedFileCount: 0,
			attachedImageCount: 4,
			campaignSlug: "",
			disabled: true,
			maximum: 4,
		}),
		{
			fileActionDisabled: true,
			gallerySource: "general",
			showImageActions: false,
		},
	);
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

await run("AI response history rows preserve labels and retry visibility", () => {
	const entry = {
		id: "history-рядок",
		createdAt: "2026-07-20T10:30:00.000Z",
	};
	const calls = [];
	assert.deepEqual(
		getAiResponseHistoryRowView({
			entry,
			currentLanguage: "uk",
			fallbackTitle: "Відповідь ШІ",
			canRetry: (candidate) => {
				calls.push(["retry", candidate]);
				return true;
			},
			formatResponseDate: (createdAt, language) => {
				calls.push(["date", createdAt, language]);
				return "20 липня";
			},
			getTitle: (candidate) => {
				calls.push(["title", candidate]);
				return "";
			},
			getSummary: (candidate) => {
				calls.push(["summary", candidate]);
				return "Зміни: +1";
			},
			getStateLabel: (candidate) => {
				calls.push(["state", candidate]);
				return "Застосовано";
			},
		}),
		{
			changeSummary: "Зміни: +1",
			dateLabel: "20 липня",
			showRetry: true,
			stateLabel: "Застосовано",
			title: "Відповідь ШІ",
		},
	);
	assert.deepEqual(calls, [
		["summary", entry],
		["date", entry.createdAt, "uk"],
		["retry", entry],
		["state", entry],
		["title", entry],
	]);
	assert.equal(
		getAiResponseHistoryRowView({
			entry,
			fallbackTitle: "Fallback",
			formatResponseDate: () => "date",
			getTitle: () => "Explicit title",
			getSummary: () => "",
			getStateLabel: () => "",
		}).showRetry,
		false,
	);
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

await run("AI API key workflow persists once and retries model discovery", async () => {
	const savedKeys = [];
	const waits = [];
	let listAttempts = 0;
	const result = await saveGeminiApiKeyAndRefreshModels({
		apiKey: "  gemini-secret  ",
		saveApiKey: async (apiKey) => savedKeys.push(apiKey),
		listAiModels: async () => {
			listAttempts += 1;
			if (listAttempts < 3) throw new Error("Моделі ще оновлюються");
			return {
				models: [
					{ name: "gemini-fast", displayName: "Gemini Fast" },
					{ name: "gemini-pro", displayName: "Gemini Pro" },
				],
				defaultModel: "gemini-pro",
				source: "gemini",
			};
		},
		wait: async (delayMs) => waits.push(delayMs),
	});

	assert.deepEqual(savedKeys, ["gemini-secret"]);
	assert.equal(listAttempts, 3);
	assert.deepEqual(waits, [500, 500]);
	assert.deepEqual(result, {
		status: "saved",
		modelSelection: {
			models: [
				{ name: "gemini-fast", displayName: "Gemini Fast" },
				{ name: "gemini-pro", displayName: "Gemini Pro" },
			],
			selectedModel: "gemini-pro",
		},
	});

	let missingKeySaveCalls = 0;
	assert.deepEqual(
		await saveGeminiApiKeyAndRefreshModels({
			apiKey: "   ",
			saveApiKey: async () => {
				missingKeySaveCalls += 1;
			},
		}),
		{ status: "missing-key" },
	);
	assert.equal(missingKeySaveCalls, 0);

	const refreshErrors = [];
	let failedRefreshAttempts = 0;
	const nonFatalRefreshResult = await saveGeminiApiKeyAndRefreshModels({
		apiKey: "key",
		saveApiKey: async () => {},
		listAiModels: async () => {
			failedRefreshAttempts += 1;
			throw new Error("Немає моделей");
		},
		wait: async () => {},
		refreshAttempts: 2,
		onRefreshError: (error) => refreshErrors.push(error.message),
	});
	assert.equal(failedRefreshAttempts, 2);
	assert.deepEqual(refreshErrors, ["Немає моделей"]);
	assert.deepEqual(nonFatalRefreshResult, {
		status: "saved",
		modelSelection: null,
	});

	let nullRefreshAttempts = 0;
	assert.deepEqual(
		await saveGeminiApiKeyAndRefreshModels({
			apiKey: "key",
			saveApiKey: async () => {},
			listAiModels: async () => {
				nullRefreshAttempts += 1;
				return null;
			},
			wait: async () => {
				throw new Error("Null result must not retry");
			},
		}),
		{ status: "saved", modelSelection: null },
	);
	assert.equal(nullRefreshAttempts, 1);

	await assert.rejects(
		saveGeminiApiKeyAndRefreshModels({
			apiKey: "key",
			saveApiKey: async () => {
				throw new Error("Не вдалося зберегти");
			},
			listAiModels: async () => {
				throw new Error("Must not run");
			},
		}),
		/Не вдалося зберегти/,
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
	assert.deepEqual(
		getAiEntityGenerationActionsView({
			isEncounter: false,
			showCharacterGeneration: true,
			showParsedGenerationOptions: true,
		}),
		{ showActions: true, showCharacterAction: true },
	);
	assert.deepEqual(
		getAiEntityGenerationActionsView({
			isEncounter: true,
			showCharacterGeneration: true,
			showParsedGenerationOptions: true,
		}),
		{ showActions: false, showCharacterAction: false },
	);
	assert.deepEqual(
		getAiEntityGenerationActionsView({
			isEncounter: false,
			showCharacterGeneration: false,
			showParsedGenerationOptions: true,
		}),
		{ showActions: true, showCharacterAction: false },
	);
	assert.deepEqual(
		getAiEncounterGenerationActionsView({
			isCampaign: true,
			isCustomMonsterGenerationVisible: true,
			isEncounter: false,
			showParsedGenerationOptions: true,
		}),
		{
			encounterTitleKind: "scenes",
			showActions: true,
			showCreateCustomCreatureAction: false,
			showCustomMonsterAction: true,
			showEncounterAction: false,
		},
	);
	assert.deepEqual(
		getAiEncounterGenerationActionsView({
			isCampaign: false,
			isCustomMonsterGenerationVisible: false,
			isEncounter: true,
			showParsedGenerationOptions: true,
		}),
		{
			encounterTitleKind: "current",
			showActions: true,
			showCreateCustomCreatureAction: true,
			showCustomMonsterAction: false,
			showEncounterAction: true,
		},
	);
	assert.equal(
		getAiEncounterGenerationActionsView({
			isCampaign: false,
			isCustomMonsterGenerationVisible: true,
			isEncounter: true,
			showParsedGenerationOptions: false,
		}).showActions,
		false,
	);
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

await run("session persistence policies preserve UI, rename, and error ownership", async () => {
	assert.deepEqual(normalizeSessionSavePolicy(), {
		throwOnError: false,
		updateUi: true,
	});
	assert.deepEqual(
		normalizeSessionSavePolicy({ throwOnError: true, updateUi: false }),
		{ throwOnError: true, updateUi: false },
	);
	assert.equal(
		shouldNotifySessionRename(
			{ id: "session-1", fileName: "нова-сесія.json" },
			"стара-сесія.json",
			true,
		),
		true,
	);
	assert.equal(
		shouldNotifySessionRename(
			{ id: "session-1", fileName: "нова-сесія.json" },
			"стара-сесія.json",
			false,
		),
		false,
	);

	const session = { id: "session-1", name: "Нічна варта", data: {} };
	const saved = { ...session, fileName: "нічна-варта.json" };
	const successEvents = [];
	const result = await executeSessionSave({
		campaignSlug: "кампанія",
		sessionId: "чернетка.json",
		session,
		policy: normalizeSessionSavePolicy(),
		updateSession: async (...args) => {
			successEvents.push(["api", ...args]);
			return saved;
		},
		setSaving: (isSaving) => successEvents.push(["saving", isSaving]),
		onSessionRenamed: (renamed) =>
			successEvents.push(["rename", renamed.fileName]),
		onSaveError: (error) => successEvents.push(["error", error]),
	});
	assert.equal(result, saved);
	assert.deepEqual(successEvents, [
		["saving", true],
		["api", "кампанія", "чернетка.json", session],
		["rename", "нічна-варта.json"],
		["saving", false],
	]);

	const backgroundEvents = [];
	await executeSessionSave({
		campaignSlug: "кампанія",
		sessionId: "чернетка.json",
		session,
		policy: normalizeSessionSavePolicy({ updateUi: false }),
		updateSession: async () => saved,
		setSaving: (isSaving) => backgroundEvents.push(["saving", isSaving]),
		onSessionRenamed: () => backgroundEvents.push(["rename"]),
	});
	assert.deepEqual(backgroundEvents, []);

	const saveError = new Error("Не вдалося зберегти сесію");
	const failureEvents = [];
	assert.equal(
		await executeSessionSave({
			campaignSlug: "кампанія",
			sessionId: "чернетка.json",
			session,
			policy: normalizeSessionSavePolicy(),
			updateSession: async () => {
				throw saveError;
			},
			setSaving: (isSaving) => failureEvents.push(["saving", isSaving]),
			onSaveError: (error) => failureEvents.push(["error", error]),
		}),
		null,
	);
	assert.deepEqual(failureEvents, [
		["saving", true],
		["error", saveError],
		["saving", false],
	]);
	await assert.rejects(
		executeSessionSave({
			campaignSlug: "кампанія",
			sessionId: "чернетка.json",
			session,
			policy: normalizeSessionSavePolicy({ throwOnError: true }),
			updateSession: async () => {
				throw saveError;
			},
		}),
		(error) => error === saveError,
	);
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

await run("encounter creation policies preserve links, flushes, and result identity", async () => {
	const firstScene = { id: 7, encounterId: null };
	const linkedScene = { id: "linked", encounterId: 0 };
	const session = {
		fileName: "сесія.json",
		data: { scenes: [firstScene, linkedScene] },
	};
	assert.deepEqual(
		getEncounterOpenPlan({
			session,
			sessionId: "fallback.json",
			scene: linkedScene,
			openInNewTab: true,
		}),
		{
			kind: "navigate",
			encounterId: 0,
			navigation: { fileName: "сесія.json", openInNewTab: true },
		},
	);
	assert.deepEqual(
		getEncounterOpenPlan({
			session,
			sessionId: "fallback.json",
			scene: { id: "7" },
		}),
		{
			kind: "create",
			scene: { id: "7" },
			sceneIndex: 0,
			openInNewTab: false,
		},
	);
	assert.deepEqual(
		getEncounterOpenPlan({
			session,
			sessionId: "fallback.json",
			scene: { id: "missing" },
		}),
		{ kind: "none" },
	);
	assert.deepEqual(
		getEncounterOpenPlan({
			session: null,
			sessionId: "fallback.json",
			scene: firstScene,
		}),
		{ kind: "none" },
	);
	assert.equal(
		getEncounterCreationFileName(
			{ name: "Saved", fileName: "saved.json" },
			session,
			"fallback.json",
		),
		"saved.json",
	);
	assert.equal(
		getEncounterCreationFileName(null, { data: {} }, "fallback.json"),
		"fallback.json",
	);
	assert.deepEqual(
		requireEncounterCreationResult({
			session: { name: "Оновлена сесія" },
			encounter: { id: "enc-1" },
		}),
		{ session: { name: "Оновлена сесія" }, encounterId: "enc-1" },
	);
	assert.throws(
		() =>
			requireEncounterCreationResult({
				session: { name: "Broken" },
				encounter: { id: null },
			}),
		/Encounter creation returned an incomplete result/,
	);

	const existingCalls = [];
	await executeEncounterOpen({
		campaignSlug: "кампанія",
		session,
		sessionId: "fallback.json",
		scene: linkedScene,
		openInNewTab: true,
		flushPendingSave: async () => {
			existingCalls.push("flush");
			return null;
		},
		requestEncounterName: () => {
			existingCalls.push("name");
			return "Unused";
		},
		createSceneEncounter: async () => {
			existingCalls.push("create");
			return null;
		},
		setSession: () => existingCalls.push("set"),
		navigateToEncounter: (id, options) =>
			existingCalls.push(["navigate", id, options]),
	});
	assert.deepEqual(existingCalls, [
		[
			"navigate",
			0,
			{ fileName: "сесія.json", openInNewTab: true },
		],
	]);

	const cancelledCalls = [];
	await executeEncounterOpen({
		campaignSlug: "кампанія",
		session,
		sessionId: "fallback.json",
		scene: firstScene,
		flushPendingSave: async () => {
			cancelledCalls.push("flush");
			return null;
		},
		requestEncounterName: () => null,
		createSceneEncounter: async () => null,
		setSession: () => cancelledCalls.push("set"),
		navigateToEncounter: () => cancelledCalls.push("navigate"),
	});
	assert.deepEqual(cancelledCalls, []);

	const createdCalls = [];
	const createdSession = { name: "Оновлена сесія", fileName: "saved.json" };
	await executeEncounterOpen({
		campaignSlug: "кампанія",
		session,
		sessionId: "fallback.json",
		scene: firstScene,
		openInNewTab: true,
		flushPendingSave: async (options) => {
			createdCalls.push(["flush", options]);
			return { name: "Flushed", fileName: "flushed.json" };
		},
		requestEncounterName: (sceneValue, sceneIndex) => {
			createdCalls.push(["name", sceneValue.id, sceneIndex]);
			return "Засідка";
		},
		createSceneEncounter: async (...args) => {
			createdCalls.push(["create", ...args]);
			return { session: createdSession, encounter: { id: "enc-2" } };
		},
		setSession: (value) => createdCalls.push(["set", value]),
		navigateToEncounter: (id, options) =>
			createdCalls.push(["navigate", id, options]),
	});
	assert.deepEqual(createdCalls, [
		["name", 7, 0],
		["flush", { throwOnError: true }],
		["create", "кампанія", "flushed.json", 7, "Засідка"],
		["set", createdSession],
		[
			"navigate",
			"enc-2",
			{ fileName: "flushed.json", openInNewTab: true },
		],
	]);

	const errors = [];
	await executeEncounterOpen({
		campaignSlug: "кампанія",
		session,
		sessionId: "fallback.json",
		scene: firstScene,
		flushPendingSave: async () => null,
		requestEncounterName: () => "Нова зустріч",
		createSceneEncounter: async () => ({ session: {}, encounter: {} }),
		setSession: () => errors.push("set"),
		navigateToEncounter: () => errors.push("navigate"),
		onError: (error) => errors.push(error),
	});
	assert.equal(errors.length, 1);
	assert.match(errors[0].message, /incomplete result/);
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

await run("encounter page policies preserve grid, keyboard, HP, sync, and AI updates", () => {
	assert.equal(
		getEncounterGridMonsterKey({
			instanceId: "goblin-1",
			name: " Гоблін ",
			source: "MM",
		}),
		"гоблін|mm",
	);
	assert.equal(
		getEncounterGridMonsterKey({
			instanceId: "local-1",
			name: "Гоблін",
			_localOverride: true,
		}),
		"local:local-1",
	);
	assert.equal(resolveEncounterHpInputValue("- 7", 20), 13);
	assert.equal(resolveEncounterHpInputValue("+5", 20), 25);
	assert.equal(
		getEncounterNavigationAction({
			key: "Escape",
			code: "Escape",
			shiftKey: false,
			isEditableTarget: false,
			isHistoryShortcut: false,
			shouldUseAppHistory: false,
			showBestiary: true,
		}),
		"close-bestiary",
	);
	assert.equal(
		getEncounterHistoryAction({
			key: "z",
			code: "KeyZ",
			shiftKey: true,
			isEditableTarget: true,
			isHistoryShortcut: true,
			shouldUseAppHistory: true,
			showBestiary: false,
		}),
		"redo",
	);
	assert.equal(
		shouldReloadEncounterFromSync(
			{
				version: 3,
				campaignSlug: "кампанія",
				sessionFileName: "сесія.json",
				resource: "sessions",
			},
			"кампанія",
			"сесія.json",
			false,
		),
		true,
	);
	const encounter = {
		id: "encounter-1",
		name: "Засідка",
		monsters: [
			{
				instanceId: "goblin-1",
				name: "Гоблін",
				source: "CUSTOM",
				hit_points: 12,
				currentHp: 8,
			},
		],
	};
	const replacedMonster = replaceEncounterMonsterFromAi(
			encounter,
			"goblin-1",
			{ name: "Ватажок", hit_points: 20, currentHp: 20 },
			{ localOverride: true },
		).monsters[0];
	assert.equal(typeof replacedMonster.id, "string");
	assert.ok(replacedMonster.id);
	assert.deepEqual(
		{ ...replacedMonster, id: "generated" },
		{
			id: "generated",
			name: "Ватажок",
			hit_points: 20,
			currentHp: 8,
			instanceId: "goblin-1",
			source: "CUSTOM",
			originalBestiaryName: "Ватажок",
			_localOverride: true,
		},
	);
	assert.deepEqual(
		applyEncounterDiceHpResult({
			result: { total: 17 },
			context: {
				kind: "encounter_hp",
				campaignSlug: "кампанія",
				sessionId: "сесія.json",
				encounterId: "encounter-1",
				instanceId: "goblin-1",
			},
			campaignSlug: "кампанія",
			sessionId: "сесія.json",
			encounterId: "encounter-1",
			encounter,
		}),
		{
			encounter: {
				...encounter,
				monsters: [
					{
						...encounter.monsters[0],
						hit_points: 17,
						currentHp: 17,
					},
				],
			},
			preferredId: "goblin-1",
		},
	);
	const draft = createEmptyEncounterCharacterDraft(100);
	assert.equal(draft.id, "new-character-100");
	assert.equal(draft.notes?.[0]?.id, 101);
});

await run("encounter page composition plans preserve selection, deduplication, and creation order", async () => {
	const participants = [
		{ instanceId: "вовк-1", name: "Вовк", source: "MM" },
		{ instanceId: "вовк-2", name: "Вовк", source: "MM" },
		{ instanceId: "герой-1", id: "герой", originalCharacterId: "герой", participantType: "character", firstName: "Олена" },
	];
	const projection = getEncounterGridProjection(participants);
	assert.deepEqual(projection.monsters.map((monster) => monster.instanceId), ["вовк-1"]);
	assert.equal(projection.representativeByInstanceId.get("вовк-2"), "вовк-1");
	assert.deepEqual(
		getAvailableEncounterCharacters(participants, [
			{ id: "герой", firstName: "Олена" },
			{ id: "чарівник", firstName: "Мирослав" },
			{ firstName: "Без ID" },
		]).map((character) => character.firstName),
		["Мирослав", "Без ID"],
	);

	const selectionEvents = [];
	executeEncounterParticipantSelection(
		getEncounterParticipantSelectionPlan(participants[0], undefined, "grid"),
		{
			onOpenCharacter: () => selectionEvents.push("open"),
			onSelect: (participant) => selectionEvents.push(["select", participant.instanceId]),
			onFocus: (id) => selectionEvents.push(["focus", id]),
		},
	);
	executeEncounterParticipantSelection(
		getEncounterParticipantSelectionPlan(participants[2], "герой-1", "single"),
		{
			onOpenCharacter: (character) => selectionEvents.push(["open", character.firstName]),
			onSelect: () => selectionEvents.push("unexpected-select"),
			onFocus: () => selectionEvents.push("unexpected-focus"),
		},
	);
	assert.deepEqual(selectionEvents, [
		["select", "вовк-1"],
		["focus", "вовк-1"],
		["open", "Олена"],
	]);
	const shortcutEvents = [];
	executeEncounterNavigationAction("close-bestiary", {
		onHandled: () => shortcutEvents.push("handled-navigation"),
		onCloseBestiary: () => shortcutEvents.push("close"),
		onBack: () => shortcutEvents.push("back"),
	});
	executeEncounterHistoryAction("redo", {
		onHandled: () => shortcutEvents.push("handled-history"),
		onUndo: () => shortcutEvents.push("undo"),
		onRedo: () => shortcutEvents.push("redo"),
	});
	assert.deepEqual(shortcutEvents, ["handled-navigation", "close", "handled-history", "redo"]);

	const sourceEncounter = { id: "бій-1", name: "Засідка", monsters: participants.slice(0, 2) };
	const addPlan = getEncounterAddCharacterPlan(sourceEncounter, { id: "чарівник", firstName: "Мирослав" });
	assert.equal(addPlan.encounter.monsters.length, 3);
	assert.equal(addPlan.displayName, "Мирослав");
	assert.equal(addPlan.preferredId, addPlan.participant.instanceId);
	assert.equal(getEncounterAddCharacterPlan(null, { firstName: "Ніхто" }), null);
	assert.deepEqual(getEncounterRenamePlan(sourceEncounter, "Нова засідка"), {
		encounter: { ...sourceEncounter, name: "Нова засідка" },
	});
	assert.equal(getEncounterRenamePlan(sourceEncounter, sourceEncounter.name), null);

	const creationEvents = [];
	const created = { id: "чарівник", firstName: "Мирослав" };
	await executeEncounterPlayerCreation({
		request: async () => created,
		onRefresh: () => creationEvents.push("refresh"),
		onAdd: (character) => creationEvents.push(["add", character.firstName]),
		onReset: () => creationEvents.push("reset"),
		onError: () => creationEvents.push("error"),
		onComplete: () => creationEvents.push("complete"),
	});
	assert.deepEqual(creationEvents, ["refresh", ["add", "Мирослав"], "reset", "complete"]);

	const emptyEvents = [];
	await executeEncounterPlayerCreation({
		request: async () => null,
		onRefresh: () => emptyEvents.push("refresh"),
		onAdd: () => emptyEvents.push("add"),
		onReset: () => emptyEvents.push("reset"),
		onError: (error) => emptyEvents.push(error.message),
		onComplete: () => emptyEvents.push("complete"),
	});
	assert.deepEqual(emptyEvents, ["refresh", "Entity creation returned no result", "complete"]);
});

await run("encounter model orchestration preserves load, import, dice, and drop flows", () => {
	assert.equal(isEncounterEditableTarget({ tagName: "INPUT" }), true);
	assert.equal(isEncounterEditableTarget({ tagName: "TEXTAREA" }), true);
	assert.equal(isEncounterEditableTarget({ tagName: "input" }), false);
	assert.equal(isEncounterEditableTarget({ isContentEditable: 1 }), true);
	assert.equal(isEncounterEditableTarget(null), false);
	const keyboardBase = {
		key: "z",
		code: "KeyZ",
		shiftKey: false,
		isEditableTarget: false,
		isHistoryShortcut: true,
		shouldUseAppHistory: false,
		showBestiary: false,
	};
	assert.equal(getEncounterHistoryAction(keyboardBase), "undo");
	assert.equal(getEncounterHistoryAction({ ...keyboardBase, shiftKey: true }), "redo");
	assert.equal(getEncounterHistoryAction({ ...keyboardBase, code: "KeyY" }), "redo");
	assert.equal(getEncounterHistoryAction({ ...keyboardBase, code: "KeyX" }), "none");
	assert.equal(
		getEncounterHistoryAction({ ...keyboardBase, isEditableTarget: true }),
		"none",
	);
	assert.equal(
		getEncounterHistoryAction({
			...keyboardBase,
			isEditableTarget: true,
			shouldUseAppHistory: true,
		}),
		"undo",
	);

	const zeroEncounter = {
		id: 0,
		name: "Нульова сутичка",
		monsters: [{ instanceId: "monster-0", name: "Вартовий" }],
	};
	const session = { data: { encounters: [zeroEncounter] } };
	assert.equal(getEncounterSessionEncounters(session)[0], zeroEncounter);
	assert.deepEqual(getEncounterSessionEncounters(null), []);
	assert.deepEqual(getEncounterLoadPlan({}, "missing", 2, false), {
		kind: "retry",
		retries: 1,
		resetHistory: false,
	});
	assert.deepEqual(getEncounterLoadPlan({}, "missing", 0, true), {
		kind: "not-found",
	});
	const loadedPlan = getEncounterLoadPlan(session, "0", 3, true);
	assert.equal(loadedPlan.kind, "loaded");
	assert.equal(loadedPlan.encounter, zeroEncounter);
	assert.equal(loadedPlan.selectedInstance, zeroEncounter.monsters[0]);
	const loadCalls = [];
	executeEncounterLoadPlan(loadedPlan, {
		onRetry: (...args) => loadCalls.push(["retry", ...args]),
		onNotFound: () => loadCalls.push(["not-found"]),
		onLoaded: (...args) => loadCalls.push(["loaded", ...args]),
	});
	assert.deepEqual(loadCalls, [[
		"loaded",
		zeroEncounter,
		zeroEncounter.monsters[0],
		true,
	]]);
	executeEncounterLoadPlan(
		{ kind: "retry", retries: 0, resetHistory: false },
		{
			onRetry: (...args) => loadCalls.push(["retry", ...args]),
			onNotFound: () => loadCalls.push(["not-found"]),
			onLoaded: (...args) => loadCalls.push(["loaded", ...args]),
		},
	);
	executeEncounterLoadPlan(
		{ kind: "not-found" },
		{
			onRetry: (...args) => loadCalls.push(["retry", ...args]),
			onNotFound: () => loadCalls.push(["not-found"]),
			onLoaded: (...args) => loadCalls.push(["loaded", ...args]),
		},
	);
	assert.deepEqual(loadCalls.slice(1), [["retry", 0, false], ["not-found"]]);

	const sourceEncounter = {
		id: "encounter-1",
		name: "Стара назва",
		monsters: [{ instanceId: "old", name: "Старий" }],
	};
	assert.throws(
		() => parseEncounterImport(null, sourceEncounter, {
			invalidFileMessage: "Невірний файл",
			missingMonstersMessage: "Немає монстрів",
		}),
		/Невірний файл/,
	);
	assert.throws(
		() => parseEncounterImport("{}", sourceEncounter, {
			invalidFileMessage: "Невірний файл",
			missingMonstersMessage: "Немає монстрів",
		}),
		/Немає монстрів/,
	);
	let now = 100;
	const imported = parseEncounterImport(
		JSON.stringify({ name: "Імпортована", monsters: [{ name: "Гоблін" }] }),
		sourceEncounter,
		{
			invalidFileMessage: "Невірний файл",
			missingMonstersMessage: "Немає монстрів",
			now: () => now++,
			random: () => 0.456,
		},
	);
	assert.equal(imported.name, "Імпортована");
	assert.equal(imported.monsters[0].instanceId, "inst-100-0-456");
	assert.equal(sourceEncounter.monsters[0].instanceId, "old");

	const diceCalls = [];
	const diceInput = {
		resultId: "roll-1",
		processedResultId: null,
		result: { total: 0 },
		context: {
			kind: "encounter_hp",
			campaignSlug: "кампанія",
			sessionId: "0",
			encounterId: "encounter-1",
			instanceId: "old",
		},
		campaignSlug: "кампанія",
		sessionId: "0",
		encounterId: "encounter-1",
		encounter: sourceEncounter,
	};
	assert.equal(
		executeEncounterDiceProcessing(diceInput, {
			onProcessed: (id) => diceCalls.push(["processed", id]),
			onUpdate: (update) => diceCalls.push(["update", update]),
		}),
		"applied",
	);
	assert.equal(diceCalls[0][0], "processed");
	assert.equal(diceCalls[1][1].encounter.monsters[0].currentHp, 1);
	assert.equal(
		executeEncounterDiceProcessing(
			{ ...diceInput, resultId: 0 },
			{
				onProcessed: () => { throw new Error("must not run"); },
				onUpdate: () => { throw new Error("must not run"); },
			},
		),
		"ignored",
	);
	assert.equal(
		executeEncounterDiceProcessing(
			{ ...diceInput, processedResultId: "roll-1" },
			{
				onProcessed: () => { throw new Error("must not run"); },
				onUpdate: () => { throw new Error("must not run"); },
			},
		),
		"ignored",
	);
	const invalidDiceCalls = [];
	assert.equal(
		executeEncounterDiceProcessing(
			{ ...diceInput, resultId: "roll-2", context: { ...diceInput.context, kind: "other" } },
			{
				onProcessed: (id) => invalidDiceCalls.push(["processed", id]),
				onUpdate: (update) => invalidDiceCalls.push(["update", update]),
			},
		),
		"processed",
	);
	assert.deepEqual(invalidDiceCalls, [["processed", "roll-2"]]);

	const reordered = { ...sourceEncounter, monsters: [...sourceEncounter.monsters].reverse() };
	assert.deepEqual(
		getEncounterMonsterDropPlan({
			nextMonsters: null,
			currentEncounter: null,
			reorderStart: sourceEncounter,
			isUpdatingHistory: false,
		}),
		{ kind: "none" },
	);
	const dropPlan = getEncounterMonsterDropPlan({
		nextMonsters: reordered.monsters,
		currentEncounter: sourceEncounter,
		reorderStart: { ...sourceEncounter, monsters: [] },
		isUpdatingHistory: false,
	});
	assert.equal(dropPlan.kind, "persist");
	assert.deepEqual(dropPlan.undoSnapshot.monsters, []);
	const dropCalls = [];
	executeEncounterMonsterDropPlan(dropPlan, {
		clearReorderStart: () => dropCalls.push(["clear"]),
		recordUndo: (snapshot) => dropCalls.push(["undo", snapshot]),
		persist: (value) => dropCalls.push(["persist", value]),
	});
	assert.deepEqual(dropCalls.map(([kind]) => kind), ["clear", "undo", "persist"]);
	const noHistoryPlan = getEncounterMonsterDropPlan({
		nextMonsters: sourceEncounter.monsters,
		currentEncounter: sourceEncounter,
		reorderStart: sourceEncounter,
		isUpdatingHistory: false,
	});
	assert.equal(noHistoryPlan.kind, "persist");
	assert.equal(noHistoryPlan.undoSnapshot, null);

	assert.deepEqual(getEncounterUpdatePlan(null, sourceEncounter), { kind: "none" });
	const updatePlan = getEncounterUpdatePlan(
		{ id: "encounter-1", name: "", monsters: null },
		sourceEncounter,
		{},
		false,
	);
	assert.equal(updatePlan.kind, "update");
	assert.equal(updatePlan.encounter.name, "Стара назва");
	assert.deepEqual(updatePlan.encounter.monsters, []);
	assert.equal(updatePlan.undoSnapshot, sourceEncounter);
	assert.equal(updatePlan.persist, true);
	assert.equal(updatePlan.saveDebounceMs, 0);
	assert.equal(updatePlan.preferredId, null);
	const silentUpdatePlan = getEncounterUpdatePlan(
		{ ...sourceEncounter, name: "Нова" },
		sourceEncounter,
		{
			pushUndo: false,
			persist: false,
			saveDebounceMs: 500,
			preferredId: "old",
		},
		false,
	);
	assert.equal(silentUpdatePlan.kind, "update");
	assert.equal(silentUpdatePlan.undoSnapshot, null);
	assert.equal(silentUpdatePlan.persist, false);
	assert.equal(silentUpdatePlan.saveDebounceMs, 500);
	assert.equal(silentUpdatePlan.preferredId, "old");
	const updateCalls = [];
	executeEncounterUpdatePlan(updatePlan, {
		recordUndo: (snapshot) => updateCalls.push(["undo", snapshot]),
		setEncounter: (value) => updateCalls.push(["set", value]),
		syncSelected: (...args) => updateCalls.push(["sync", ...args]),
		persist: (...args) => updateCalls.push(["persist", ...args]),
	});
	assert.deepEqual(updateCalls.map(([kind]) => kind), [
		"undo",
		"set",
		"sync",
		"persist",
	]);
	const silentUpdateCalls = [];
	executeEncounterUpdatePlan(silentUpdatePlan, {
		recordUndo: (snapshot) => silentUpdateCalls.push(["undo", snapshot]),
		setEncounter: (value) => silentUpdateCalls.push(["set", value]),
		syncSelected: (...args) => silentUpdateCalls.push(["sync", ...args]),
		persist: (...args) => silentUpdateCalls.push(["persist", ...args]),
	});
	assert.deepEqual(silentUpdateCalls.map(([kind]) => kind), ["set", "sync"]);

	assert.deepEqual(
		getEncounterMonsterRowStats({ armor_class: 0, hit_points: "21" }),
		{ ac: "0", maxHp: 21 },
	);
	assert.equal(
		getEncounterNavigationAction({
			...keyboardBase,
			key: "Escape",
			isEditableTarget: true,
			showBestiary: true,
		}),
		"close-bestiary",
	);
	assert.equal(
		getEncounterNavigationAction({
			...keyboardBase,
			key: "Backspace",
			isEditableTarget: true,
		}),
		"none",
	);
	assert.equal(
		getEncounterNavigationAction({ ...keyboardBase, key: "Backspace" }),
		"back",
	);
	for (const resource of ["sessions", "ai", "import"]) {
		assert.equal(
			shouldReloadEncounterFromSync(
				{ version: 1, sessionFileName: 0, resource },
				"кампанія",
				"0",
				false,
			),
			true,
		);
	}
	assert.equal(
		shouldReloadEncounterFromSync(
			{ version: 1, resource: "images" },
			"кампанія",
			"0",
			false,
		),
		false,
	);
	assert.equal(
		shouldReloadEncounterFromSync(
			{ version: 1, resource: "sessions" },
			"кампанія",
			"0",
			true,
		),
		false,
	);
	assert.equal(
		applyEncounterDiceHpResult({
			...diceInput,
			context: { ...diceInput.context, instanceId: "missing" },
		}),
		null,
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
	assert.deepEqual(npc.notes, [
		{ id: 1, title: "", text: "", collapsed: false },
	]);
	assert.equal(getSessionEntityDisplayName("npc", npc), "Ірина");
	assert.equal(
		getSessionEntityDisplayName("npc", {
			firstName: "  ",
			lastName: " ",
			name: "Запасне ім'я",
		}),
		"Запасне ім'я",
	);
	assert.equal(
		getSessionEntityDisplayName("npc", {
			firstName: " Марко ",
			lastName: " Вовк ",
			name: "Запасне ім'я",
		}),
		"Марко   Вовк",
	);
	assert.equal(
		getSessionEntityDisplayName("locations", {
			name: "   ",
			title: "Не використовується після truthy name",
		}),
		"",
	);
	assert.equal(getSessionEntityDisplayName("locations", {}, "Без назви"), "Без назви");

	const location = normalizeSessionEntity("locations", { title: "Брама" });
	assert.equal(location.name, "Брама");
	assert.equal(location.imageUrl, null);
	const malformed = normalizeSessionEntity("npc", {
		id: { unsafe: true },
		notes: "invalid",
		imageUrl: 42,
	});
	assert.match(String(malformed.id), /^session-npc-/);
	assert.deepEqual(malformed.notes, []);
	assert.equal(malformed.imageUrl, null);
	assert.equal(normalizeSessionEntity("npc", { id: 0 }).id, 0);
	assert.equal(normalizeSessionEntity("npc", { id: "npc-0" }).id, "npc-0");
	assert.match(
		String(normalizeSessionEntity("locations", { id: "" }).id),
		/^session-locations-/,
	);
	assert.match(
		String(normalizeSessionEntity("npc", { id: Number.POSITIVE_INFINITY }).id),
		/^session-npc-/,
	);
});

await run("session page policies preserve keyboard, sync, and presentation behavior", () => {
	assert.equal(isSessionEditableTarget({ tagName: "INPUT" }), true);
	assert.equal(isSessionEditableTarget({ tagName: "TEXTAREA" }), true);
	assert.equal(isSessionEditableTarget({ tagName: "input" }), false);
	assert.equal(isSessionEditableTarget({ isContentEditable: "yes" }), true);
	assert.equal(isSessionEditableTarget(null), false);
	assert.equal(
		getSessionKeyboardAction({
			key: "Escape",
			code: "Escape",
			shiftKey: false,
			isHistoryShortcut: false,
			shouldUseAppHistory: false,
			isEditableTarget: false,
		}),
		"back",
	);
	assert.equal(
		getSessionKeyboardAction({
			key: "z",
			code: "KeyZ",
			shiftKey: true,
			isHistoryShortcut: true,
			shouldUseAppHistory: true,
			isEditableTarget: true,
		}),
		"redo",
	);
	assert.equal(
		getSessionSyncAction(
			{
				version: 2,
				campaignSlug: "кампанія",
				sessionFileName: "сесія.json",
				resource: "ai",
			},
			"кампанія",
			"сесія.json",
			true,
		),
		"discard-and-reload",
	);
	assert.equal(
		getSessionSyncAction(
			{ version: 2, campaignSlug: "інша", resource: "sessions" },
			"кампанія",
			"сесія.json",
			false,
		),
		"ignore",
	);
	for (const resource of ["sessions", "import", "entities", "images"]) {
		assert.equal(
			getSessionSyncAction(
				{ version: 1, resource },
				"кампанія",
				"сесія.json",
				false,
			),
			"reload",
		);
		assert.equal(
			getSessionSyncAction(
				{ version: 1, resource },
				"кампанія",
				"сесія.json",
				true,
			),
			"ignore",
		);
	}
	assert.equal(
		getSessionSyncAction(
			{ version: 1, sessionFileName: 0, resource: "sessions" },
			"кампанія",
			"0",
			false,
		),
		"reload",
	);
	assert.equal(
		getSessionSyncAction(
			{ version: 0, resource: "ai" },
			"кампанія",
			"сесія.json",
			false,
		),
		"ignore",
	);
	assert.equal(
		getSessionSyncAction(
			{ version: 1, resource: "unknown" },
			"кампанія",
			"сесія.json",
			false,
		),
		"ignore",
	);
	assert.equal(hasSessionNoteContent([{ id: 1, text: " Нотатка " }]), true);
	assert.equal(hasSessionNoteContent([{ id: 1, title: " ", text: "" }]), false);
	assert.deepEqual(
		getSessionEncounterLinks(
			[
				{ id: 1, encounterId: "battle" },
				{ id: 2, encounterId: "battle" },
			],
			[{ id: "battle", name: "Засідка" }],
			"Без назви",
		),
		[{ id: "battle", name: "Засідка", sceneNumber: 1 }],
	);
	assert.deepEqual(
		getSessionScopeImportCopy("locations", (value) => value),
		{
			title: "Choose location/faction to move into this session",
			emptyText: "No campaign locations/factions available.",
		},
	);
	assert.deepEqual(
		getSessionScopeImportPresentation(null, (value) => value),
		{ type: "npc", copy: null },
	);
	assert.deepEqual(
		getSessionScopeImportPresentation(
			{ type: "locations" },
			(value) => `t:${value}`,
		),
		{
			type: "locations",
			copy: {
				title: "t:Choose location/faction to move into this session",
				emptyText: "t:No campaign locations/factions available.",
			},
		},
	);
	const sessionData = { notes: [{ id: 1, text: "Текст" }] };
	assert.equal(getSessionPageData({ data: sessionData }), sessionData);
	assert.deepEqual(getSessionPageData(null), {});
	const sessionWithoutData = { id: "session-identity", name: "Без даних" };
	assert.equal(normalizeSessionPageSession(sessionWithoutData), sessionWithoutData);
	const rawSession = {
		id: "session-normalized",
		marker: "preserved",
		data: {
			result_text: "Підсумок",
			notes: null,
			scenes: [{ id: 0, notes: null, isNotesCollapsed: "yes", texts: {} }],
			npcs: [{ id: 0, name: "Нульовий NPC" }],
			locations: [{ id: "location-1", title: "Брама" }],
		},
	};
	const normalizedSession = normalizeSessionPageSession(rawSession);
	assert.notEqual(normalizedSession, rawSession);
	assert.equal(normalizedSession.marker, "preserved");
	assert.equal(normalizedSession.data.result_text, "Підсумок");
	assert.deepEqual(normalizedSession.data.notes, []);
	assert.deepEqual(normalizedSession.data.scenes[0].notes, []);
	assert.equal(normalizedSession.data.scenes[0].isNotesCollapsed, true);
	assert.equal(normalizedSession.data.npcs[0].id, 0);
	assert.equal(normalizedSession.data.locations[0].name, "Брама");
	assert.equal(rawSession.data.notes, null);

	assert.deepEqual(getSessionRenamePlan(null, "Стара"), { kind: "cancelled" });
	assert.deepEqual(getSessionRenamePlan("", "Стара"), { kind: "cancelled" });
	assert.deepEqual(getSessionRenamePlan("Стара", "Стара"), {
		kind: "cancelled",
	});
	assert.deepEqual(getSessionRenamePlan("  Нова  ", "Стара"), {
		kind: "rename",
		name: "  Нова  ",
	});
	const renameCalls = [];
	assert.equal(
		executeSessionRenamePlan(
			{ kind: "rename", name: "Нова" },
			(name) => renameCalls.push(name),
		),
		"renamed",
	);
	assert.deepEqual(renameCalls, ["Нова"]);
	assert.equal(
		executeSessionRenamePlan(
			{ kind: "cancelled" },
			() => { throw new Error("must not run"); },
		),
		"cancelled",
	);

	const emptySceneNotes = getSessionSceneNotesPresentation([], true, false);
	assert.equal(emptySceneNotes.hasData, false);
	assert.equal(emptySceneNotes.isCollapsed, false);
	assert.equal(emptySceneNotes.showBulkAction, false);
	assert.equal(emptySceneNotes.showList, true);
	assert.equal(emptySceneNotes.renderableNotes.at(-1)._isVirtual, true);
	const openSceneNotes = getSessionSceneNotesPresentation(
		[{ id: 1, title: "План", collapsed: false }],
		false,
		false,
	);
	assert.equal(openSceneNotes.bulkActionShouldCollapse, true);
	assert.equal(openSceneNotes.bulkActionTitleKey, "Collapse all items");
	assert.equal(openSceneNotes.bulkActionLabelKey, "Collapse all");
	assert.equal(openSceneNotes.showBulkAction, true);
	const collapsedSceneNotes = getSessionSceneNotesPresentation(
		[{ id: 1, title: "План", collapsed: true }],
		true,
		true,
	);
	assert.equal(collapsedSceneNotes.isCollapsed, true);
	assert.equal(collapsedSceneNotes.showList, false);
	assert.equal(collapsedSceneNotes.showBulkAction, false);
	assert.equal(collapsedSceneNotes.bulkActionShouldCollapse, false);
	assert.equal(collapsedSceneNotes.bulkActionTitleKey, "Expand all items");
	assert.deepEqual(
		getSceneNotesWithCollapsedState([{ id: 1, title: "План" }], true),
		[{ id: 1, title: "План", collapsed: true }],
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

await run("entity link modal helper resolves scoped identity and avoids recursion", async () => {
	const {
		buildEntityLinkModalTargetPlan,
		getEntityIdentity,
		getEntityModalPresentation,
		isSameEntityIdentity,
		openEntityLinkModal,
	} = await import(
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
		entity: { id: 0, firstName: "Міра", lastName: "", _scope: "session" },
		type: "npc",
		scope: "campaign",
	};
	const foundIdentity = getEntityIdentity(found.entity, found.type, found.scope);
	assert.deepEqual(foundIdentity, {
		scope: "campaign",
		type: "npc",
		id: "0",
		slug: "",
		name: "міра",
	});
	assert.equal(
		isSameEntityIdentity(foundIdentity, { ...foundIdentity, id: "0" }),
		true,
	);
	assert.equal(
		isSameEntityIdentity(foundIdentity, { ...foundIdentity, type: "characters" }),
		false,
	);
	assert.equal(
		isSameEntityIdentity(foundIdentity, { ...foundIdentity, scope: "session" }),
		false,
	);
	assert.equal(
		isSameEntityIdentity(
			{ ...foundIdentity, id: "one", slug: "shared" },
			{ ...foundIdentity, id: "two", slug: "shared" },
		),
		true,
	);
	assert.equal(
		isSameEntityIdentity(
			{ ...foundIdentity, id: "one", slug: "one" },
			{ ...foundIdentity, id: "two", slug: "two" },
		),
		true,
		"matching normalized names remain the final compatibility fallback",
	);
	assert.equal(
		isSameEntityIdentity(
			{ ...foundIdentity, id: "one", slug: "one", name: "one" },
			{ ...foundIdentity, id: "two", slug: "two", name: "two" },
		),
		false,
	);

	assert.deepEqual(
		buildEntityLinkModalTargetPlan({
			found: null,
			currentEntityIdentity: null,
			modalState: null,
		}),
		{ status: "ignored", reason: "not-found" },
	);
	assert.deepEqual(
		buildEntityLinkModalTargetPlan({
			found,
			currentEntityIdentity: foundIdentity,
			modalState: null,
		}),
		{ status: "ignored", reason: "same-entity" },
	);
	assert.deepEqual(
		buildEntityLinkModalTargetPlan({
			found,
			currentEntityIdentity: null,
			modalState: found,
		}),
		{ status: "ignored", reason: "same-entity" },
	);
	assert.deepEqual(
		buildEntityLinkModalTargetPlan({
			found,
			currentEntityIdentity: null,
			modalState: null,
		}),
		{
			status: "open",
			modalState: {
				entity: found.entity,
				type: "npc",
				scope: "campaign",
			},
		},
	);

	let modalState = null;
	await openEntityLinkModal({
		campaignSlug: "campaign",
		currentEntityIdentity: null,
		errorMessage: "test",
		modalState: null,
		name: "Міра",
		scopedEntityLinks: { resolveEntityByName: async () => found },
		setModalState: (value) => {
			modalState = value;
		},
	});
	assert.deepEqual(modalState, {
		entity: found.entity,
		type: "npc",
		scope: "campaign",
	});

	modalState = null;
	await openEntityLinkModal({
		campaignSlug: "campaign",
		currentEntityIdentity: foundIdentity,
		errorMessage: "test",
		modalState: null,
		name: "Міра",
		scopedEntityLinks: { resolveEntityByName: () => found },
		setModalState: (value) => {
			modalState = value;
		},
	});
	assert.equal(modalState, null);

	let resolverCalled = false;
	await openEntityLinkModal({
		campaignSlug: null,
		currentEntityIdentity: null,
		errorMessage: "test",
		modalState: null,
		name: "Міра",
		scopedEntityLinks: {
			resolveEntityByName: () => {
				resolverCalled = true;
				return found;
			},
		},
		setModalState: () => {
			throw new Error("must not open without campaign context");
		},
	});
	assert.equal(resolverCalled, false);
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
	assert.equal(chooserModel.formatDamageProperty("fire"), "fire");
	assert.equal(chooserModel.formatDamageProperty(null), null);
	assert.equal(chooserModel.formatDamageProperty(42), null);
	assert.equal(
		chooserModel.formatDamageProperty([
			"cold",
			{
				resist: ["fire", "lightning"],
				preNote: "from nonmagical attacks",
				note: "while grounded",
			},
			{ resist: "", immune: "poison" },
		]),
		"cold, from nonmagical attacks fire, lightning while grounded, poison",
	);
	assert.equal(
		chooserModel.formatDamageProperty([
			{ resist: [], immune: ["fire"], preNote: "from", note: "attacks" },
		]),
		"from  attacks",
	);
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
	assert.deepEqual(
		getInitialSpellSelection([spells[2]], spells, "Щит|PHB", spells[0]),
		{ spell: spells[2], changed: true },
	);
	assert.deepEqual(
		getInitialSpellSelection([spells[0]], spells, "Немає|PHB", null),
		{ spell: spells[0], changed: true },
	);
	assert.deepEqual(
		getInitialSpellSelection([spells[0]], spells, "Немає|PHB", spells[1]),
		{ spell: spells[1], changed: false },
	);

	assert.equal(
		getInitialSpellScrollPlan(spells, "Світло|XPHB", spells[1], false, ""),
		null,
	);
	assert.equal(getInitialSpellScrollPlan(spells, "", spells[1], true, ""), null);
	assert.equal(
		getInitialSpellScrollPlan(spells, "Світло|PHB", spells[1], true, ""),
		null,
	);
	assert.equal(
		getInitialSpellScrollPlan(
			[spells[0], spells[2]],
			"Світло|XPHB",
			spells[1],
			true,
			"",
		),
		null,
	);
	assert.deepEqual(
		getInitialSpellScrollPlan(
			spells,
			"Світло|XPHB",
			spells[1],
			true,
			"",
		),
		{ scrollKey: "XPHB:Світло", selectedIndex: 1 },
	);
	assert.equal(
		getInitialSpellScrollPlan(
			spells,
			"Світло",
			spells[1],
			true,
			"XPHB:Світло",
		),
		null,
	);

	const rowSpell = {
		name: "вогняна КУЛЯ|PHB",
		source: "PHB",
		level: 0,
		school: "V",
		classes: ["Wizard", 4, "", "Друїд"],
	};
	const rowCalls = [];
	const rowPresentation = getSpellListItemPresentation(rowSpell, {
		selected: false,
		capitalizeName: (name) => {
			rowCalls.push(["capitalize", name]);
			return `CAP:${name}`;
		},
		resolveSourceName: (source) => {
			rowCalls.push(["source", source]);
			return "Player's Handbook";
		},
		translate: (template, variables) => {
			rowCalls.push(["translate", template, variables]);
			return template === "Cantrip" ? "Замовляння" : "unexpected";
		},
	});
	assert.deepEqual(rowPresentation, {
		itemKey: "PHB:вогняна КУЛЯ|PHB",
		displayName: "CAP:вогняна КУЛЯ",
		levelLabel: "Замовляння",
		schoolName: "Evocation",
		showSchool: true,
		classesLabel: "Wizard, , Друїд",
		showClasses: true,
		source: "PHB",
		sourceFullName: "Player's Handbook",
		showSource: true,
		disableSourceTooltip: false,
		active: false,
		nextSelection: rowSpell,
	});
	assert.equal(rowPresentation.nextSelection, rowSpell);
	assert.deepEqual(rowCalls, [
		["source", "PHB"],
		["capitalize", "вогняна КУЛЯ"],
		["translate", "Cantrip", undefined],
	]);
	const selectedRow = getSpellListItemPresentation(
		{ name: "Без джерела", school: "v" },
		{
			selected: true,
			capitalizeName: (name) => name,
			resolveSourceName: () => "",
			translate: (template, variables) => `${template}:${String(variables?.level)}`,
		},
	);
	assert.deepEqual(selectedRow, {
		itemKey: ":Без джерела",
		displayName: "Без джерела",
		levelLabel: "{level}-level:undefined",
		schoolName: "",
		showSchool: false,
		classesLabel: "",
		showClasses: false,
		source: "",
		sourceFullName: "",
		showSource: false,
		disableSourceTooltip: true,
		active: true,
		nextSelection: null,
	});
	const whitespaceSourceRow = getSpellListItemPresentation(
		{ name: "Пробіл", source: "   ", level: 1 },
		{
			selected: false,
			capitalizeName: (name) => name,
			resolveSourceName: () => "",
			translate: () => "1-й рівень",
		},
	);
	assert.equal(whitespaceSourceRow.showSource, true);
	assert.equal(whitespaceSourceRow.disableSourceTooltip, true);

	const insertedSpells = [];
	executeSpellInsertAction((spell) => insertedSpells.push(spell), rowSpell);
	executeSpellInsertAction(null, spells[0]);
	assert.deepEqual(insertedSpells, [rowSpell]);
	assert.equal(insertedSpells[0], rowSpell);
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
	assert.match(rulesReferenceSource, /renderRecursiveContent\(item\.entries/);
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
	const spellHeader = [];
	const spellWill = [];
	const spellFooter = ["Кінець"];
	const dailySpell = ["misty step"];
	const cantrips = ["light"];
	const leveledSpells = ["fireball"];
	const spellcastingPresentation = getMonsterSpellcastingEntryPresentation({
		name: "Чарування",
		headerEntries: spellHeader,
		will: spellWill,
		daily: { "1/day": dailySpell },
		spells: {
			"0": { slots: 0, spells: cantrips },
			"3": { slots: 2, spells: leveledSpells },
		},
		footerEntries: spellFooter,
	});
	assert.equal(spellcastingPresentation.headerEntries, spellHeader);
	assert.equal(spellcastingPresentation.willLine.values, spellWill);
	assert.equal(spellcastingPresentation.footerEntries, spellFooter);
	assert.deepEqual(spellcastingPresentation.dailyLines, [
		{ key: "1/day", label: "1/day each", values: dailySpell },
	]);
	assert.deepEqual(spellcastingPresentation.spellLines, [
		{ key: "0", label: "Cantrips", values: cantrips },
		{ key: "3", label: "Level 3 (2 slots)", values: leveledSpells },
	]);
	assert.deepEqual(
		getMonsterSpellcastingEntryPresentation({ name: "Порожнє" }),
		{
			headerEntries: null,
			willLine: null,
			dailyLines: [],
			spellLines: [],
			footerEntries: null,
		},
	);
	assert.equal(
		getMonsterSpellcastingEntryPresentation({
			name: "Дивне",
			spells: { "-1": { slots: -1, spells: [] } },
		}).spellLines[0].label,
		"Level -1 (-1 slots)",
	);
	const monster = { id: "custom-1", name: "Вартовий", source: "CUSTOM", imageUrl: "/custom.webp" };
	assert.deepEqual(getMonsterMetadataPresentation(monster, "MM"), {
		originalName: "",
		showOriginalName: false,
		showSource: true,
	});
	assert.deepEqual(
		getMonsterMetadataPresentation(
			{ ...monster, originalBestiaryName: "Guardian" },
			"",
		),
		{
			originalName: "Guardian",
			showOriginalName: true,
			showSource: false,
		},
	);
	assert.deepEqual(
		getMonsterMetadataPresentation(
			{ ...monster, originalBestiaryName: "Вартовий" },
			"   ",
		),
		{
			originalName: "",
			showOriginalName: false,
			showSource: true,
		},
	);
	assert.equal(
		getMonsterMetadataPresentation(
			{ ...monster, originalBestiaryName: 42 },
			"",
		).showOriginalName,
		false,
	);
	assert.deepEqual(getMonsterTokenSources(monster, "", null, "/local.webp", "/external.webp"), {
		customTokenSrc: "/custom.webp",
		localSrc: "/custom.webp",
		externalSrc: "/custom.webp",
		isCustomMonster: true,
	});
	assert.deepEqual(
		getMonsterTokenSources(
			{ name: "Тінь", source: " custom ", imageUrl: 42 },
			"",
			"/override.webp",
			"/local.webp",
			"/external.webp",
		),
		{
			customTokenSrc: "",
			localSrc: "/override.webp",
			externalSrc: "/override.webp",
			isCustomMonster: false,
		},
	);
	assert.deepEqual(
		getMonsterTokenSources(
			{ name: "Тінь", source: "custom", imageUrl: "/monster.webp" },
			"  /explicit.webp  ",
			null,
			"/local.webp",
			"/external.webp",
		),
		{
			customTokenSrc: "  /explicit.webp  ",
			localSrc: "  /explicit.webp  ",
			externalSrc: "  /explicit.webp  ",
			isCustomMonster: true,
		},
	);
	assert.deepEqual(
		getMonsterTokenSources(
			{ name: "Тінь", source: null, imageUrl: "" },
			"",
			null,
			"/local-only.webp",
			"/external-only.webp",
		),
		{
			customTokenSrc: "",
			localSrc: "/local-only.webp",
			externalSrc: "/external-only.webp",
			isCustomMonster: false,
		},
	);
	assert.equal(shouldShowMonsterTokenDropzone({ allowTokenUpload: true, hasImageError: false, isReplacingToken: false, localSrc: "", isCustomMonster: true, hasTokenImageChange: false }), true);
	assert.equal(shouldShowMonsterTokenDropzone({ allowTokenUpload: false, hasImageError: true, isReplacingToken: true, localSrc: "", isCustomMonster: true, hasTokenImageChange: true }), false);
	const disabledVisibilityReads = [];
	assert.equal(
		shouldShowMonsterTokenDropzone(
			new Proxy(
				{ allowTokenUpload: false },
				{
					get(target, property) {
						disabledVisibilityReads.push(property);
						return target[property];
					},
				},
			),
		),
		false,
	);
	assert.deepEqual(disabledVisibilityReads, ["allowTokenUpload"]);
	const replacementVisibilityReads = [];
	assert.equal(
		shouldShowMonsterTokenDropzone(
			new Proxy(
				{
					allowTokenUpload: true,
					isCustomMonster: true,
					isReplacingToken: true,
				},
				{
					get(target, property) {
						replacementVisibilityReads.push(property);
						return target[property];
					},
				},
			),
		),
		true,
	);
	assert.deepEqual(replacementVisibilityReads, [
		"allowTokenUpload",
		"isCustomMonster",
		"isReplacingToken",
	]);
	assert.equal(getUploadedTokenUrl({ url: "/next.webp" }), "/next.webp");
	assert.equal(getUploadedTokenUrl({ url: 3 }), "");
	assert.equal(getMonsterMutationKey(monster, "Вартовий"), "custom-1");
	assert.deepEqual(getTokenDragPayload("/external.webp", "Вартовий", "Guardian"), {
		uri: "/external.webp",
		html: '<img src="/external.webp" alt="Вартовий">',
		downloadUrl: "image/webp:Guardian.webp:/external.webp",
	});

	assert.deepEqual(
		getMonsterTokenSectionPresentation({
			showDropzone: true,
			hasImageError: false,
			allowTokenUpload: false,
			customTokenSrc: "/український-токен.webp",
			isCustomMonster: false,
			hasTokenImageChange: false,
		}),
		{
			mode: "dropzone",
			showCancelReplace: true,
			showReplaceAction: false,
		},
	);
	assert.deepEqual(
		getMonsterTokenSectionPresentation({
			showDropzone: true,
			hasImageError: true,
			allowTokenUpload: true,
			customTokenSrc: "/token.webp",
			isCustomMonster: true,
			hasTokenImageChange: true,
		}),
		{
			mode: "dropzone",
			showCancelReplace: false,
			showReplaceAction: false,
		},
	);
	assert.deepEqual(
		getMonsterTokenSectionPresentation({
			showDropzone: false,
			hasImageError: false,
			allowTokenUpload: true,
			customTokenSrc: "",
			isCustomMonster: false,
			hasTokenImageChange: true,
		}),
		{
			mode: "image",
			showCancelReplace: false,
			showReplaceAction: true,
		},
	);
	assert.deepEqual(
		getMonsterTokenSectionPresentation({
			showDropzone: false,
			hasImageError: true,
			allowTokenUpload: true,
			customTokenSrc: "/token.webp",
			isCustomMonster: true,
			hasTokenImageChange: true,
		}),
		{
			mode: "skeleton",
			showCancelReplace: false,
			showReplaceAction: false,
		},
	);
	assert.equal(
		getMonsterTokenSectionPresentation({
			showDropzone: false,
			hasImageError: false,
			allowTokenUpload: true,
			customTokenSrc: "",
			isCustomMonster: true,
			hasTokenImageChange: false,
		}).showReplaceAction,
		true,
	);
	assert.equal(
		getMonsterTokenSectionPresentation({
			showDropzone: false,
			hasImageError: false,
			allowTokenUpload: true,
			customTokenSrc: "",
			isCustomMonster: false,
			hasTokenImageChange: false,
		}).showReplaceAction,
		false,
	);

	assert.deepEqual(
		getMonsterNameRowPresentation({
			name: "Мавка",
			hasNameAction: true,
			showFavoriteAction: true,
			isFavorite: true,
			hasAiAction: true,
			hasFieldEditAction: true,
			hasDeleteAction: true,
			showAddToEncounterAction: true,
		}),
		{
			name: "Мавка",
			useNameAction: true,
			showFavoriteAction: true,
			favoriteTitle: "Remove from favorites",
			favoriteActive: true,
			showAiAction: true,
			showFieldEditAction: true,
			showDeleteAction: true,
			showAddToEncounterAction: true,
		},
	);
	assert.deepEqual(
		getMonsterNameRowPresentation({
			name: 0,
			hasNameAction: false,
			showFavoriteAction: false,
			isFavorite: false,
			hasAiAction: false,
			hasFieldEditAction: false,
			hasDeleteAction: false,
			showAddToEncounterAction: false,
		}),
		{
			name: "0",
			useNameAction: false,
			showFavoriteAction: false,
			favoriteTitle: "Add to favorites",
			favoriteActive: false,
			showAiAction: false,
			showFieldEditAction: false,
			showDeleteAction: false,
			showAddToEncounterAction: false,
		},
	);
	const actionCalls = [];
	executeMonsterAction((receivedMonster) => actionCalls.push(receivedMonster), monster);
	executeMonsterAction(null, { name: "Не викликати" });
	assert.deepEqual(actionCalls, [monster]);
	assert.equal(actionCalls[0], monster);

	const skippedUploadReads = [];
	assert.deepEqual(
		await executeMonsterTokenUpload(
			new Proxy(
				{ result: { url: "" } },
				{
					get(target, property) {
						skippedUploadReads.push(property);
						return target[property];
					},
				},
			),
		),
		{ status: "skipped" },
	);
	assert.deepEqual(skippedUploadReads, ["result"]);

	const injectedUploadEvents = [];
	const injectedUploadOutcome = await executeMonsterTokenUpload({
		result: { url: "/нова-мавка.webp" },
		monster,
		effectiveName: "Вартовий",
		onTokenImageChange: (receivedMonster, imageUrl) =>
			injectedUploadEvents.push(["injected", receivedMonster, imageUrl]),
		persist: async () => assert.fail("injected upload must not persist"),
		onTokenUrl: (imageUrl) => injectedUploadEvents.push(["url", imageUrl]),
		onImageError: (hasError) => injectedUploadEvents.push(["error", hasError]),
		onReplacing: (isReplacing) =>
			injectedUploadEvents.push(["replacing", isReplacing]),
		onPersistenceError: (error) =>
			assert.fail(`injected upload must not report persistence: ${error}`),
	});
	assert.deepEqual(injectedUploadOutcome, {
		status: "succeeded",
		mode: "injected",
		imageUrl: "/нова-мавка.webp",
	});
	assert.deepEqual(injectedUploadEvents, [
		["url", "/нова-мавка.webp"],
		["error", false],
		["injected", monster, "/нова-мавка.webp"],
		["replacing", false],
	]);
	assert.equal(injectedUploadEvents[2][1], monster);

	const persistedUploadEvents = [];
	const persistedUploadOutcome = await executeMonsterTokenUpload({
		result: { url: "/temporary.webp" },
		monster,
		effectiveName: "Fallback name",
		persist: async (mutationKey, payload) => {
			persistedUploadEvents.push(["persist", mutationKey, payload]);
			return { ...monster, imageUrl: "/canonical.webp" };
		},
		onTokenUrl: (imageUrl) => persistedUploadEvents.push(["url", imageUrl]),
		onImageError: (hasError) => persistedUploadEvents.push(["error", hasError]),
		onReplacing: (isReplacing) =>
			persistedUploadEvents.push(["replacing", isReplacing]),
		onPersistenceError: (error) =>
			assert.fail(`unexpected persistence error: ${error}`),
	});
	assert.deepEqual(persistedUploadOutcome, {
		status: "succeeded",
		mode: "persisted",
		imageUrl: "/canonical.webp",
	});
	assert.deepEqual(persistedUploadEvents, [
		["url", "/temporary.webp"],
		["error", false],
		["persist", "custom-1", { imageUrl: "/temporary.webp" }],
		["url", "/canonical.webp"],
		["replacing", false],
	]);
	const fallbackUploadUrls = [];
	assert.deepEqual(
		await executeMonsterTokenUpload({
			result: { url: "/fallback.webp" },
			monster,
			effectiveName: "Вартовий",
			persist: async () => ({ ...monster, imageUrl: 0 }),
			onTokenUrl: (imageUrl) => fallbackUploadUrls.push(imageUrl),
			onImageError: () => {},
			onReplacing: () => {},
			onPersistenceError: (error) =>
				assert.fail(`unexpected fallback persistence error: ${error}`),
		}),
		{
			status: "succeeded",
			mode: "persisted",
			imageUrl: "/fallback.webp",
		},
	);
	assert.deepEqual(fallbackUploadUrls, ["/fallback.webp", "/fallback.webp"]);

	const persistenceError = new Error("save failed");
	const failedUploadEvents = [];
	const failedUploadOutcome = await executeMonsterTokenUpload({
		result: { url: "/unsaved.webp" },
		monster,
		effectiveName: "Вартовий",
		persist: async () => {
			failedUploadEvents.push(["persist"]);
			throw persistenceError;
		},
		onTokenUrl: (imageUrl) => failedUploadEvents.push(["url", imageUrl]),
		onImageError: (hasError) => failedUploadEvents.push(["error", hasError]),
		onReplacing: () => assert.fail("failed upload must retain replacing state"),
		onPersistenceError: (error) => failedUploadEvents.push(["failure", error]),
	});
	assert.deepEqual(failedUploadOutcome, {
		status: "failed",
		error: persistenceError,
		imageUrl: "/unsaved.webp",
	});
	assert.deepEqual(failedUploadEvents, [
		["url", "/unsaved.webp"],
		["error", false],
		["persist"],
		["failure", persistenceError],
	]);

	const injectedError = new Error("injected callback failed");
	const injectedFailureEvents = [];
	await assert.rejects(
		executeMonsterTokenUpload({
			result: { url: "/injected-failure.webp" },
			monster,
			effectiveName: "Вартовий",
			onTokenImageChange: () => {
				injectedFailureEvents.push("injected");
				throw injectedError;
			},
			persist: async () => assert.fail("failed injected callback must not persist"),
			onTokenUrl: () => injectedFailureEvents.push("url"),
			onImageError: () => injectedFailureEvents.push("image-error"),
			onReplacing: () => injectedFailureEvents.push("replacing"),
			onPersistenceError: () => injectedFailureEvents.push("persistence-error"),
		}),
		(error) => error === injectedError,
	);
	assert.deepEqual(injectedFailureEvents, ["url", "image-error", "injected"]);
});

await run("Bestiary browser policies preserve identity filtering and custom imports", async () => {
	const goblin = { name: "Goblin", source: "MM", cr: "1/4" };
	const dragon = { name: "Дракон", source: "CUSTOM", cr: { cr: "5" } };
	const reference = parseMonsterReference("goblin|MM");
	let tokenResolutionCount = 0;
	const resolveToken = (monster) => {
		tokenResolutionCount += 1;
		return `/tokens/${monster.source}/${monster.name}.webp`;
	};

	assert.deepEqual(
		getBestiaryFieldEditStartPlan(null, "Істота", resolveToken),
		{ kind: "skip" },
	);
	assert.deepEqual(
		getBestiaryFieldEditStartPlan(
			{ name: "", source: "MM" },
			"Істота",
			resolveToken,
		),
		{ kind: "skip" },
	);
	const customEditPlan = getBestiaryFieldEditStartPlan(
		{ ...dragon, source: " custom " },
		"Істота",
		resolveToken,
	);
	assert.equal(customEditPlan.kind, "ready");
	assert.equal(customEditPlan.mode, "edit");
	assert.equal(customEditPlan.originalMonster, customEditPlan.draftMonster);
	assert.equal(tokenResolutionCount, 0);
	const officialWithImage = {
		...goblin,
		imageUrl: "  /явний-токен.webp  ",
	};
	const explicitImagePlan = getBestiaryFieldEditStartPlan(
		officialWithImage,
		"Істота",
		resolveToken,
	);
	assert.equal(explicitImagePlan.kind, "ready");
	assert.equal(explicitImagePlan.mode, "create-based");
	assert.equal(explicitImagePlan.originalMonster, officialWithImage);
	assert.notEqual(explicitImagePlan.draftMonster, officialWithImage);
	assert.deepEqual(explicitImagePlan.draftMonster, {
		...officialWithImage,
		source: "CUSTOM",
	});
	assert.equal(tokenResolutionCount, 0);
	const fallbackImagePlan = getBestiaryFieldEditStartPlan(
		{ ...goblin, imageUrl: "" },
		"Істота",
		resolveToken,
	);
	assert.equal(fallbackImagePlan.kind, "ready");
	assert.equal(fallbackImagePlan.draftMonster.imageUrl, "/tokens/MM/Goblin.webp");
	assert.equal(tokenResolutionCount, 1);
	const skippedFieldSaveReads = [];
	const skippedFieldSaveOptions = new Proxy(
		{ editingMonster: null },
		{
			get(target, property) {
				skippedFieldSaveReads.push(property);
				if (property !== "editingMonster") {
					throw new Error(`Skipped save read unexpected dependency: ${String(property)}`);
				}
				return target[property];
			},
		},
	);
	assert.deepEqual(
		await executeBestiaryFieldEditSave(skippedFieldSaveOptions),
		{ status: "skipped" },
	);
	assert.deepEqual(skippedFieldSaveReads, ["editingMonster"]);
	assert.deepEqual(
		await executeBestiaryFieldEditSave({
			draftMonster: dragon,
			editingMonster: { name: "", source: "CUSTOM" },
			mode: "edit",
			createBased: async () => {
				throw new Error("Nameless save must not create");
			},
			update: async () => {
				throw new Error("Nameless save must not update");
			},
			onApplied: () => {
				throw new Error("Nameless save must not apply");
			},
			onClose: () => {
				throw new Error("Nameless save must not close");
			},
			onError: () => {
				throw new Error("Nameless save must not report an error");
			},
		}),
		{ status: "skipped" },
	);

	const fieldSaveDraft = { name: "Нова мавка", source: "CUSTOM" };
	const createdFieldMonster = { name: "Нова мавка", source: "CUSTOM", id: "new-1" };
	const createFieldSaveEvents = [];
	const createFieldSaveOutcome = await executeBestiaryFieldEditSave({
		draftMonster: fieldSaveDraft,
		editingMonster: goblin,
		mode: "create-based",
		createBased: async (draftMonster) => {
			assert.equal(draftMonster, fieldSaveDraft);
			createFieldSaveEvents.push("create");
			return createdFieldMonster;
		},
		update: async () => {
			throw new Error("Create-based save must not update");
		},
		onApplied: (previousName, updatedMonster) => {
			assert.equal(previousName, "");
			assert.equal(updatedMonster, createdFieldMonster);
			createFieldSaveEvents.push("apply");
		},
		onClose: () => createFieldSaveEvents.push("close"),
		onError: () => createFieldSaveEvents.push("error"),
	});
	assert.deepEqual(createFieldSaveOutcome, {
		status: "succeeded",
		updatedMonster: createdFieldMonster,
	});
	assert.deepEqual(createFieldSaveEvents, ["create", "apply", "close"]);

	const editingFieldMonster = { name: "  Стара мавка  ", source: "CUSTOM" };
	const updatedFieldMonster = { name: "Мавка", source: "CUSTOM", id: "old-1" };
	const updateFieldSaveEvents = [];
	const updateFieldSaveOutcome = await executeBestiaryFieldEditSave({
		draftMonster: fieldSaveDraft,
		editingMonster: editingFieldMonster,
		mode: "edit",
		createBased: async () => {
			throw new Error("Edit save must not create");
		},
		update: async (draftMonster, editingMonster) => {
			assert.equal(draftMonster, fieldSaveDraft);
			assert.equal(editingMonster, editingFieldMonster);
			updateFieldSaveEvents.push("update");
			return updatedFieldMonster;
		},
		onApplied: (previousName, updatedMonster) => {
			assert.equal(previousName, "  Стара мавка  ");
			assert.equal(updatedMonster, updatedFieldMonster);
			updateFieldSaveEvents.push("apply");
		},
		onClose: () => updateFieldSaveEvents.push("close"),
		onError: () => updateFieldSaveEvents.push("error"),
	});
	assert.deepEqual(updateFieldSaveOutcome, {
		status: "succeeded",
		updatedMonster: updatedFieldMonster,
	});
	assert.deepEqual(updateFieldSaveEvents, ["update", "apply", "close"]);

	const transportFieldSaveError = new Error("Помилка збереження");
	const transportFailureEvents = [];
	const transportFailureOutcome = await executeBestiaryFieldEditSave({
		draftMonster: fieldSaveDraft,
		editingMonster: editingFieldMonster,
		mode: "edit",
		createBased: async () => createdFieldMonster,
		update: async () => {
			transportFailureEvents.push("update");
			throw transportFieldSaveError;
		},
		onApplied: () => transportFailureEvents.push("apply"),
		onClose: () => transportFailureEvents.push("close"),
		onError: (error) => {
			assert.equal(error, transportFieldSaveError);
			transportFailureEvents.push("error");
		},
	});
	assert.deepEqual(transportFailureOutcome, {
		status: "failed",
		error: transportFieldSaveError,
	});
	assert.deepEqual(transportFailureEvents, ["update", "error"]);

	const applyFieldSaveError = new Error("Помилка застосування");
	const applyFailureEvents = [];
	const applyFailureOutcome = await executeBestiaryFieldEditSave({
		draftMonster: fieldSaveDraft,
		editingMonster: editingFieldMonster,
		mode: "edit",
		createBased: async () => createdFieldMonster,
		update: async () => {
			applyFailureEvents.push("update");
			return updatedFieldMonster;
		},
		onApplied: () => {
			applyFailureEvents.push("apply");
			throw applyFieldSaveError;
		},
		onClose: () => applyFailureEvents.push("close"),
		onError: (error) => {
			assert.equal(error, applyFieldSaveError);
			applyFailureEvents.push("error");
		},
	});
	assert.deepEqual(applyFailureOutcome, {
		status: "failed",
		error: applyFieldSaveError,
	});
	assert.deepEqual(applyFailureEvents, ["update", "apply", "error"]);

	const closeFieldSaveError = new Error("Помилка закриття");
	const closeFailureEvents = [];
	const closeFailureOutcome = await executeBestiaryFieldEditSave({
		draftMonster: fieldSaveDraft,
		editingMonster: editingFieldMonster,
		mode: "edit",
		createBased: async () => createdFieldMonster,
		update: async () => {
			closeFailureEvents.push("update");
			return updatedFieldMonster;
		},
		onApplied: () => closeFailureEvents.push("apply"),
		onClose: () => {
			closeFailureEvents.push("close");
			throw closeFieldSaveError;
		},
		onError: (error) => {
			assert.equal(error, closeFieldSaveError);
			closeFailureEvents.push("error");
		},
	});
	assert.deepEqual(closeFailureOutcome, {
		status: "failed",
		error: closeFieldSaveError,
	});
	assert.deepEqual(closeFailureEvents, ["update", "apply", "close", "error"]);

	const sourceFilterOptions = ["MM", "XPHB", "CUSTOM"];
	const nextSelectedSources = ["MM", "CUSTOM"];
	const requestedIgnoreSources = ["XPHB"];
	const createSelectedSourcesSaveOptions = (events, overrides = {}) => ({
		filterSourceOptions: sourceFilterOptions,
		nextSelectedSources,
		activeCampaignSlug: null,
		getIgnoreSourcesList: (filterOptions, selectedSources) => {
			assert.equal(filterOptions, sourceFilterOptions);
			assert.equal(selectedSources, nextSelectedSources);
			events.push("derive");
			return requestedIgnoreSources;
		},
		onEnableAutoSelection: () => events.push("enable-auto-selection"),
		updateCampaign: async () => {
			throw new Error("Global source save must not update a campaign");
		},
		listCampaigns: async () => {
			throw new Error("Global source save must not list campaigns");
		},
		onCampaigns: () => {
			throw new Error("Global source save must not dispatch campaigns");
		},
		updateSettings: async () => {
			throw new Error("Selected-source test must provide settings transport");
		},
		onUiIgnoreSources: () => events.push("ui-sources"),
		onLogError: () => events.push("log-error"),
		onError: () => events.push("alert-error"),
		...overrides,
	});

	const campaignSourceSaveEvents = [];
	const campaignListIdentity = [{ slug: "кампанія", name: "Кампанія" }];
	const campaignSourceSaveOutcome = await executeBestiarySelectedSourcesSave(
		createSelectedSourcesSaveOptions(campaignSourceSaveEvents, {
			activeCampaignSlug: "  кампанія  ",
			updateCampaign: async (slug, payload) => {
				assert.equal(slug, "  кампанія  ");
				assert.equal(payload.ignoreSourcesList, requestedIgnoreSources);
				campaignSourceSaveEvents.push("update-campaign");
			},
			listCampaigns: async () => {
				campaignSourceSaveEvents.push("list-campaigns");
				return campaignListIdentity;
			},
			onCampaigns: (campaigns) => {
				assert.equal(campaigns, campaignListIdentity);
				campaignSourceSaveEvents.push("dispatch-campaigns");
			},
			updateSettings: async () => {
				throw new Error("Campaign source save must not update global settings");
			},
			onUiIgnoreSources: () => {
				throw new Error("Campaign source save must not dispatch UI settings");
			},
		}),
	);
	assert.deepEqual(campaignSourceSaveOutcome, {
		status: "succeeded",
		scope: "campaign",
		ignoreSourcesList: requestedIgnoreSources,
	});
	assert.equal(campaignSourceSaveOutcome.ignoreSourcesList, requestedIgnoreSources);
	assert.deepEqual(campaignSourceSaveEvents, [
		"derive",
		"enable-auto-selection",
		"update-campaign",
		"list-campaigns",
		"dispatch-campaigns",
	]);

	const nullableCampaignEvents = [];
	let nullableCampaignFallback = null;
	await executeBestiarySelectedSourcesSave(
		createSelectedSourcesSaveOptions(nullableCampaignEvents, {
			activeCampaignSlug: "кампанія",
			updateCampaign: async () => nullableCampaignEvents.push("update-campaign"),
			listCampaigns: async () => null,
			onCampaigns: (campaigns) => {
				nullableCampaignFallback = campaigns;
				nullableCampaignEvents.push("dispatch-campaigns");
			},
		}),
	);
	assert.deepEqual(nullableCampaignFallback, []);

	const globalSourceSaveEvents = [];
	const savedIgnoreSourcesIdentity = ["UA", 7];
	let receivedUiIgnoreSources = null;
	const globalSourceSaveOutcome = await executeBestiarySelectedSourcesSave(
		createSelectedSourcesSaveOptions(globalSourceSaveEvents, {
			updateSettings: async (payload) => {
				assert.equal(payload.ignoreSourcesList, requestedIgnoreSources);
				globalSourceSaveEvents.push("update-settings");
				return { ignoreSourcesList: savedIgnoreSourcesIdentity };
			},
			onUiIgnoreSources: (ignoreSourcesList) => {
				receivedUiIgnoreSources = ignoreSourcesList;
				globalSourceSaveEvents.push("dispatch-ui-settings");
			},
		}),
	);
	assert.deepEqual(globalSourceSaveOutcome, {
		status: "succeeded",
		scope: "global",
		ignoreSourcesList: requestedIgnoreSources,
	});
	assert.equal(receivedUiIgnoreSources, savedIgnoreSourcesIdentity);
	assert.deepEqual(globalSourceSaveEvents, [
		"derive",
		"enable-auto-selection",
		"update-settings",
		"dispatch-ui-settings",
	]);

	const globalFallbackEvents = [];
	let globalFallbackIdentity = null;
	await executeBestiarySelectedSourcesSave(
		createSelectedSourcesSaveOptions(globalFallbackEvents, {
			updateSettings: async () => ({ ignoreSourcesList: "XPHB" }),
			onUiIgnoreSources: (ignoreSourcesList) => {
				globalFallbackIdentity = ignoreSourcesList;
			},
		}),
	);
	assert.equal(globalFallbackIdentity, requestedIgnoreSources);

	const selectedSourcesSaveError = new Error("Не вдалося зберегти джерела");
	const sourceSaveFailureEvents = [];
	const sourceSaveFailureOutcome = await executeBestiarySelectedSourcesSave(
		createSelectedSourcesSaveOptions(sourceSaveFailureEvents, {
			updateSettings: async () => {
				sourceSaveFailureEvents.push("update-settings");
				throw selectedSourcesSaveError;
			},
			onUiIgnoreSources: () => sourceSaveFailureEvents.push("dispatch-ui-settings"),
			onLogError: (error) => {
				assert.equal(error, selectedSourcesSaveError);
				sourceSaveFailureEvents.push("log-error");
			},
			onError: (error) => {
				assert.equal(error, selectedSourcesSaveError);
				sourceSaveFailureEvents.push("alert-error");
			},
		}),
	);
	assert.deepEqual(sourceSaveFailureOutcome, {
		status: "failed",
		error: selectedSourcesSaveError,
		ignoreSourcesList: requestedIgnoreSources,
	});
	assert.deepEqual(sourceSaveFailureEvents, [
		"derive",
		"enable-auto-selection",
		"update-settings",
		"log-error",
		"alert-error",
	]);

	const campaignDispatchError = new Error("Не вдалося оновити store");
	const campaignDispatchFailureEvents = [];
	const campaignDispatchFailureOutcome = await executeBestiarySelectedSourcesSave(
		createSelectedSourcesSaveOptions(campaignDispatchFailureEvents, {
			activeCampaignSlug: "кампанія",
			updateCampaign: async () =>
				campaignDispatchFailureEvents.push("update-campaign"),
			listCampaigns: async () => {
				campaignDispatchFailureEvents.push("list-campaigns");
				return campaignListIdentity;
			},
			onCampaigns: () => {
				campaignDispatchFailureEvents.push("dispatch-campaigns");
				throw campaignDispatchError;
			},
			onLogError: (error) => {
				assert.equal(error, campaignDispatchError);
				campaignDispatchFailureEvents.push("log-error");
			},
			onError: (error) => {
				assert.equal(error, campaignDispatchError);
				campaignDispatchFailureEvents.push("alert-error");
			},
		}),
	);
	assert.equal(campaignDispatchFailureOutcome.status, "failed");
	assert.deepEqual(campaignDispatchFailureEvents, [
		"derive",
		"enable-auto-selection",
		"update-campaign",
		"list-campaigns",
		"dispatch-campaigns",
		"log-error",
		"alert-error",
	]);

	const deriveSelectedSourcesError = new Error("Помилка побудови списку");
	const deriveFailureEvents = [];
	await assert.rejects(
		executeBestiarySelectedSourcesSave(
			createSelectedSourcesSaveOptions(deriveFailureEvents, {
				getIgnoreSourcesList: () => {
					deriveFailureEvents.push("derive");
					throw deriveSelectedSourcesError;
				},
			}),
		),
		(error) => error === deriveSelectedSourcesError,
	);
	assert.deepEqual(deriveFailureEvents, ["derive"]);
	assert.deepEqual(
		getCustomMonsterDeleteStartPlan({ name: "Goblin", source: "MM" }),
		{ kind: "skip" },
	);
	assert.deepEqual(
		getCustomMonsterDeleteStartPlan({ name: "", source: "CUSTOM" }),
		{ kind: "skip" },
	);
	assert.deepEqual(
		getCustomMonsterDeleteStartPlan({ name: "  Дракон  ", source: " custom " }),
		{ kind: "ready", monsterName: "  Дракон  " },
	);
	const legendaryMonster = {
		name: "Давній дракон",
		source: "XMM",
		legendaryGroup: { name: "  Двір дракона ", source: " mm " },
		lairActions: ["старе лігво"],
		regionalEffects: ["старий регіон"],
	};
	const fallbackLegendaryMonster = {
		name: "Числове джерело",
		source: 7,
		legendaryGroup: { name: 9, source: false },
	};
	const emptyOverrideMonster = {
		name: "Не використовується",
		source: "MM",
		legendaryGroup: { name: "", source: "" },
		lairActions: ["буде стерто"],
	};
	const unmatchedLegendaryMonster = {
		name: "Без групи",
		source: null,
		legendaryGroup: [],
	};
	const dragonGroup = {
		name: "двір дракона",
		source: "MM",
		lairActions: ["нове лігво"],
		regionalEffects: ["новий регіон"],
	};
	const numericSourceGroup = {
		name: "числове джерело",
		source: "7",
		lairActions: ["числове лігво"],
	};
	const emptyIdentityGroup = { name: 9, source: false };
	const legendaryInput = [
		legendaryMonster,
		fallbackLegendaryMonster,
		emptyOverrideMonster,
		unmatchedLegendaryMonster,
	];
	const enrichedLegendaryMonsters = enrichMonstersWithLegendaryGroups(
		legendaryInput,
		[dragonGroup, numericSourceGroup, emptyIdentityGroup],
	);
	assert.notEqual(enrichedLegendaryMonsters, legendaryInput);
	assert.notEqual(enrichedLegendaryMonsters[0], legendaryMonster);
	assert.deepEqual(enrichedLegendaryMonsters[0], {
		...legendaryMonster,
		lairActions: dragonGroup.lairActions,
		regionalEffects: dragonGroup.regionalEffects,
	});
	assert.deepEqual(enrichedLegendaryMonsters[1], {
		...fallbackLegendaryMonster,
		lairActions: numericSourceGroup.lairActions,
		regionalEffects: undefined,
	});
	assert.deepEqual(enrichedLegendaryMonsters[2], {
		...emptyOverrideMonster,
		lairActions: undefined,
		regionalEffects: undefined,
	});
	assert.equal(enrichedLegendaryMonsters[3], unmatchedLegendaryMonster);
	assert.deepEqual(legendaryInput, [
		legendaryMonster,
		fallbackLegendaryMonster,
		emptyOverrideMonster,
		unmatchedLegendaryMonster,
	]);
	const updatedCustomMonster = { name: "Виверна", source: "CUSTOM" };
	assert.deepEqual(
		replaceDeletedCustomMonsterList(
			[goblin, dragon, { name: "Ведмідь", source: " custom " }],
			[updatedCustomMonster],
		),
		[goblin, updatedCustomMonster],
	);
	assert.deepEqual(
		replaceDeletedCustomMonsterList([goblin, dragon], null),
		[goblin],
	);
	const retainedOfficialFavorite = { name: "Дракон", source: "MM" };
	const retainedCaseVariant = { name: "дракон", source: "CUSTOM" };
	assert.deepEqual(
		removeDeletedCustomMonsterFavorite(
			[
				{ name: "Дракон", source: " custom " },
				retainedOfficialFavorite,
				retainedCaseVariant,
			],
			"Дракон",
		),
		[retainedOfficialFavorite, retainedCaseVariant],
	);

	assert.deepEqual(reference, { name: "goblin", source: "MM" });
	assert.equal(monsterMatchesReference(goblin, reference), true);
	assert.equal(monsterMatchesReference(goblin, null), false);
	assert.equal(monsterMatchesReference(null, { name: "", source: "" }), true);
	assert.equal(
		monsterMatchesReference(
			{
				name: " Мавка ",
				get source() {
					throw new Error("Wildcard reference must not read monster source");
				},
			},
			{ name: "мавка", source: "   " },
		),
		true,
	);
	const referenceMismatchReads = [];
	assert.equal(
		monsterMatchesReference(
			{
				name: "Мавка",
				get source() {
					referenceMismatchReads.push("monster-source");
					return "CUSTOM";
				},
			},
			{
				name: "Лісовик",
				get source() {
					referenceMismatchReads.push("reference-source");
					return "CUSTOM";
				},
			},
		),
		false,
	);
	assert.deepEqual(referenceMismatchReads, []);
	assert.equal(
		monsterMatchesReference(
			{ name: "Числова істота", source: 7 },
			{ name: " числова ІСТОТА ", source: " 7 " },
		),
		true,
	);
	assert.equal(
		monsterMatchesReference(
			{ name: "Числова істота", source: 7 },
			{ name: "Числова істота", source: "8" },
		),
		false,
	);
	assert.equal(
		isSameMonsterIdentity(dragon, { name: " дракон ", source: "custom" }),
		true,
	);
	for (const [left, right] of [
		[null, null],
		[undefined, dragon],
		[{ name: "", source: "CUSTOM" }, { name: "", source: "CUSTOM" }],
		[{ name: "   ", source: "CUSTOM" }, { name: "   ", source: "CUSTOM" }],
		[dragon, { name: "Інший", source: "CUSTOM" }],
		[dragon, { name: "Дракон", source: "MM" }],
	]) {
		assert.equal(isSameMonsterIdentity(left, right), false);
	}
	const sourcelessIdentity = { name: "Без джерела" };
	assert.equal(
		isSameMonsterIdentity(sourcelessIdentity, {
			name: " без ДЖЕРЕЛА ",
			source: "",
		}),
		true,
	);
	const numericIdentity = { name: "Числова істота", source: 7 };
	const normalizedNumericIdentity = {
		name: " числова ІСТОТА ",
		source: " 7 ",
	};
	assert.equal(
		isSameMonsterIdentity(numericIdentity, normalizedNumericIdentity),
		true,
	);
	assert.equal(
		isSameMonsterIdentity(normalizedNumericIdentity, numericIdentity),
		true,
	);
	const identityReadOrder = [];
	const emptyIdentityLeft = {
		get name() {
			identityReadOrder.push("left-name");
			return "";
		},
		get source() {
			identityReadOrder.push("left-source");
			return "CUSTOM";
		},
	};
	const emptyIdentityRight = {
		get name() {
			identityReadOrder.push("right-name");
			return "";
		},
		get source() {
			identityReadOrder.push("right-source");
			return "CUSTOM";
		},
	};
	assert.equal(isSameMonsterIdentity(emptyIdentityLeft, emptyIdentityRight), false);
	assert.deepEqual(identityReadOrder, ["left-name", "right-name"]);
	assert.deepEqual(
		getMonsterListFromResponse({ monsters: [goblin, null, { source: "MM" }] }),
		[goblin],
	);
	assert.deepEqual(sortBestiaryMonsters([dragon, goblin], "asc"), [
		goblin,
		dragon,
	]);
	assert.equal(parseMonsterCr({ name: "Число", cr: 3 }), 3);
	assert.equal(
		parseMonsterCr({ name: "Структурований", cr: { cr: "1/8" } }),
		0.125,
	);
	assert.equal(parseMonsterCr({ name: "Десятковий", cr: "2.5xyz" }), 2.5);
	assert.equal(parseMonsterCr({ name: "Порожній", cr: null }), 0);
	assert.equal(parseMonsterCr({ name: "Нуль знаменника", cr: "4/0" }), 0);
	assert.equal(parseMonsterCr({ name: "Зайва частина", cr: "3/2/9" }), 1.5);
	assert.equal(
		Number.isNaN(parseMonsterCr({ name: "Невалідний чисельник", cr: "x/2" })),
		true,
	);
	assert.equal(
		Number.isNaN(parseMonsterCr({ name: "NaN", cr: Number.NaN })),
		true,
	);
	assert.equal(
		parseMonsterCr({ name: "Infinity", cr: Number.POSITIVE_INFINITY }),
		Number.POSITIVE_INFINITY,
	);
	const invalidCr = { name: "Невідомий", cr: "unknown" };
	const halfCr = { name: "Половина", cr: "1/2" };
	const oneCrB = { name: "Бета", cr: 1 };
	const oneCrA = { name: "Альфа", cr: { cr: "1" } };
	const twoCr = { name: "Два", cr: 2 };
	const crSortInput = [oneCrB, twoCr, invalidCr, oneCrA, halfCr];
	const noneSorted = sortBestiaryMonsters(crSortInput, "none");
	assert.notEqual(noneSorted, crSortInput);
	assert.deepEqual(noneSorted, crSortInput);
	assert.equal(noneSorted[0], oneCrB);
	assert.deepEqual(sortBestiaryMonsters(crSortInput, "asc"), [
		invalidCr,
		halfCr,
		oneCrA,
		oneCrB,
		twoCr,
	]);
	assert.deepEqual(sortBestiaryMonsters(crSortInput, "desc"), [
		twoCr,
		oneCrA,
		oneCrB,
		halfCr,
		invalidCr,
	]);
	assert.deepEqual(crSortInput, [oneCrB, twoCr, invalidCr, oneCrA, halfCr]);
	const filterSearch = "  ДРА  ";
	const filterCalls = [];
	const favoriteBear = { name: "Ведмідь", source: " custom " };
	const filterInput = [goblin, dragon, favoriteBear];
	const detailedFiltered = filterBestiaryMonsters(filterInput, {
		selectedSources: [" mm ", " custom "],
		sourceFilter: "all",
		onlyFavorites: true,
		favorites: [
			{ name: " дракон ", source: "CUSTOM" },
			{ name: "ВЕДМІДЬ", source: "custom" },
		],
		search: filterSearch,
		isDetailedSearch: true,
		matchesDetailedSearch: (monster, search) => {
			filterCalls.push(["detailed", monster, search]);
			return true;
		},
		matchesSimpleSearch: (monster, search) => {
			filterCalls.push(["simple", monster, search]);
			return false;
		},
	});
	assert.deepEqual(detailedFiltered, [dragon, favoriteBear]);
	assert.equal(detailedFiltered[0], dragon);
	assert.equal(detailedFiltered[1], favoriteBear);
	assert.deepEqual(filterCalls, [
		["detailed", dragon, filterSearch],
		["detailed", favoriteBear, filterSearch],
	]);
	assert.deepEqual(filterInput, [goblin, dragon, favoriteBear]);
	let emptySelectionMatcherCalls = 0;
	assert.deepEqual(
		filterBestiaryMonsters([dragon], {
			selectedSources: [],
			sourceFilter: "all",
			onlyFavorites: false,
			favorites: [],
			search: "Дракон",
			isDetailedSearch: false,
			matchesDetailedSearch: () => false,
			matchesSimpleSearch: () => {
				emptySelectionMatcherCalls += 1;
				return true;
			},
		}),
		[],
	);
	assert.equal(emptySelectionMatcherCalls, 0);
	assert.deepEqual(
		filterBestiaryMonsters([dragon], {
			selectedSources: ["CUSTOM"],
			sourceFilter: "ALL",
			onlyFavorites: false,
			favorites: [],
			search: "",
			isDetailedSearch: false,
			matchesDetailedSearch: () => false,
			matchesSimpleSearch: () => true,
		}),
		[],
	);
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
	for (const invalidSourceRoot of [null, {}, "MM", 7, () => {}]) {
		assert.deepEqual(getBestiarySourceCodes(invalidSourceRoot), []);
	}
	assert.deepEqual(
		getBestiarySourceCodes([
			"MM",
			"",
			"  ",
			"MM",
			{ value: "XPHB", source: "ignored" },
			{ value: null, source: "UA" },
			{ value: 0, source: "blocked" },
			{ value: false, id: "blocked" },
			{ value: "", source: "blocked" },
			{ value: undefined, source: null, id: "ID" },
			{ source: undefined, id: null, name: "ІМ'Я" },
			{ source: {}, id: "blocked" },
			null,
			[],
		]),
		["MM", "  ", "MM", "XPHB", "UA", "ID", "ІМ'Я"],
	);
	assert.deepEqual(
		parseBestiarySyncEvent({
			version: 7,
			resource: "custom-bestiary",
			monsterName: "Дракон",
		}),
		{ version: 7, resource: "custom-bestiary", monsterName: "Дракон", monsterSource: undefined },
	);
	for (const malformedRoot of [null, [], "event", 7, () => {}]) {
		assert.equal(parseBestiarySyncEvent(malformedRoot), null);
	}
	for (const invalidResource of [undefined, null, 0, {}, []]) {
		assert.equal(
			parseBestiarySyncEvent({ version: 1, resource: invalidResource }),
			null,
		);
	}
	for (const invalidVersion of [undefined, null, true, 1n, {}, []]) {
		assert.equal(
			parseBestiarySyncEvent({
				version: invalidVersion,
				resource: "bestiary",
			}),
			null,
		);
	}
	assert.deepEqual(
		parseBestiarySyncEvent({
			version: "",
			resource: "",
			monsterName: "",
			monsterSource: "",
		}),
		{ version: "", resource: "", monsterName: "", monsterSource: "" },
	);
	assert.deepEqual(
		parseBestiarySyncEvent({
			version: 0,
			resource: " bestiary ",
			monsterName: null,
			monsterSource: 17,
		}),
		{
			version: 0,
			resource: " bestiary ",
			monsterName: undefined,
			monsterSource: undefined,
		},
	);
	const nanVersionEvent = parseBestiarySyncEvent({
		version: Number.NaN,
		resource: "bestiary",
	});
	assert.equal(Number.isNaN(nanVersionEvent.version), true);
	assert.equal(nanVersionEvent.resource, "bestiary");
	assert.equal(
		parseBestiarySyncEvent({
			version: Number.POSITIVE_INFINITY,
			resource: "ai",
		}).version,
		Number.POSITIVE_INFINITY,
	);
	assert.equal(getBestiarySyncEventPlan(null), null);
	assert.equal(
		getBestiarySyncEventPlan({ version: 0, resource: "bestiary" }),
		null,
	);
	assert.equal(
		getBestiarySyncEventPlan({ version: "", resource: "bestiary" }),
		null,
	);
	assert.equal(
		getBestiarySyncEventPlan({ version: Number.NaN, resource: "bestiary" }),
		null,
	);
	assert.equal(
		getBestiarySyncEventPlan({ version: 1, resource: "BESTIARY" }),
		null,
	);
	assert.deepEqual(
		getBestiarySyncEventPlan({
			version: "0",
			resource: "bestiary",
			monsterName: "Ігнорована Мавка",
		}),
		{
			pendingSelection: null,
			refreshFavorites: true,
			reloadMonsters: false,
			suppressAutoSelection: false,
		},
	);
	assert.deepEqual(
		getBestiarySyncEventPlan({
			version: 2,
			resource: "custom-bestiary",
		}),
		{
			pendingSelection: null,
			refreshFavorites: true,
			reloadMonsters: true,
			suppressAutoSelection: false,
		},
	);
	assert.deepEqual(
		getBestiarySyncEventPlan({
			version: 3,
			resource: "custom-bestiary",
			monsterName: "Мавка",
			monsterSource: "",
		}),
		{
			pendingSelection: { name: "Мавка", source: "CUSTOM" },
			refreshFavorites: true,
			reloadMonsters: true,
			suppressAutoSelection: true,
		},
	);
	const nullSyncExecutionReads = [];
	const nullSyncExecutionOptions = new Proxy(
		{ plan: null },
		{
			get(target, property) {
				nullSyncExecutionReads.push(property);
				if (property !== "plan") {
					throw new Error(`Null plan read unexpected dependency: ${String(property)}`);
				}
				return target[property];
			},
		},
	);
	assert.equal(executeBestiarySyncEventPlan(nullSyncExecutionOptions), null);
	assert.deepEqual(nullSyncExecutionReads, ["plan"]);

	const syncExecutionPlan = getBestiarySyncEventPlan({
		version: 5,
		resource: "custom-bestiary",
		monsterName: "Мавка",
		monsterSource: "CUSTOM",
	});
	const pendingSyncSelection = syncExecutionPlan.pendingSelection;
	const syncExecutionEvents = [];
	let resolveSyncFavorites;
	let appliedSyncFavorites = null;
	let reloadToken = 7;
	const pendingFavorites = new Promise((resolve) => {
		resolveSyncFavorites = resolve;
	});
	const syncExecution = executeBestiarySyncEventPlan({
		plan: syncExecutionPlan,
		refreshFavorites: () => {
			syncExecutionEvents.push("refresh-start");
			return pendingFavorites;
		},
		onFavorites: (favorites) => {
			appliedSyncFavorites = favorites;
			syncExecutionEvents.push("favorites");
		},
		onRefreshError: () => syncExecutionEvents.push("refresh-error"),
		onPendingSelection: (selection) => {
			assert.equal(selection, pendingSyncSelection);
			syncExecutionEvents.push("pending-selection");
		},
		onSuppressAutoSelection: () =>
			syncExecutionEvents.push("suppress-auto-selection"),
		onReloadMonsters: () => {
			reloadToken += 1;
			syncExecutionEvents.push("reload");
		},
	});
	assert.deepEqual(syncExecutionEvents, [
		"refresh-start",
		"pending-selection",
		"suppress-auto-selection",
		"reload",
	]);
	assert.equal(reloadToken, 8);
	resolveSyncFavorites(null);
	await syncExecution.favoritesRefresh;
	assert.deepEqual(syncExecutionEvents, [
		"refresh-start",
		"pending-selection",
		"suppress-auto-selection",
		"reload",
		"favorites",
	]);
	assert.deepEqual(appliedSyncFavorites, []);
	const officialSyncPlan = getBestiarySyncEventPlan({
		version: 6,
		resource: "bestiary",
	});
	const favoriteIdentity = [{ name: "Мавка", source: "CUSTOM" }];
	let receivedFavoriteIdentity = null;
	const officialSyncExecution = executeBestiarySyncEventPlan({
		plan: officialSyncPlan,
		refreshFavorites: async () => favoriteIdentity,
		onFavorites: (favorites) => {
			receivedFavoriteIdentity = favorites;
		},
		onRefreshError: () => {
			throw new Error("Successful favorites refresh must not report an error");
		},
		onPendingSelection: () => {
			throw new Error("Official sync must not select a pending monster");
		},
		onSuppressAutoSelection: () => {
			throw new Error("Official sync must not suppress auto-selection");
		},
		onReloadMonsters: () => {
			throw new Error("Official sync must not reload monsters");
		},
	});
	await officialSyncExecution.favoritesRefresh;
	assert.equal(receivedFavoriteIdentity, favoriteIdentity);

	const syncRefreshError = new Error("Не вдалося оновити обране");
	const failedSyncEvents = [];
	let reportedSyncRefreshError = null;
	const failedSyncExecution = executeBestiarySyncEventPlan({
		plan: syncExecutionPlan,
		refreshFavorites: () => {
			failedSyncEvents.push("refresh-start");
			return Promise.reject(syncRefreshError);
		},
		onFavorites: () => failedSyncEvents.push("favorites"),
		onRefreshError: (error) => {
			reportedSyncRefreshError = error;
			failedSyncEvents.push("refresh-error");
		},
		onPendingSelection: () => failedSyncEvents.push("pending-selection"),
		onSuppressAutoSelection: () =>
			failedSyncEvents.push("suppress-auto-selection"),
		onReloadMonsters: () => failedSyncEvents.push("reload"),
	});
	assert.deepEqual(failedSyncEvents, [
		"refresh-start",
		"pending-selection",
		"suppress-auto-selection",
		"reload",
	]);
	await failedSyncExecution.favoritesRefresh;
	assert.equal(reportedSyncRefreshError, syncRefreshError);
	assert.deepEqual(failedSyncEvents, [
		"refresh-start",
		"pending-selection",
		"suppress-auto-selection",
		"reload",
		"refresh-error",
	]);
	assert.deepEqual(
		getBestiarySyncEventPlan({
			version: 4,
			resource: "ai",
			monsterName: "  ",
			monsterSource: " custom-source ",
		}),
		{
			pendingSelection: { name: "  ", source: " custom-source " },
			refreshFavorites: true,
			reloadMonsters: true,
			suppressAutoSelection: true,
		},
	);
	assert.deepEqual(
		getBestiarySelectionPlan([goblin, dragon], [goblin, dragon], reference, null, true),
		{ monster: goblin, explicit: true },
	);
	const officialRow = getBestiaryMonsterRowPresentation(
		goblin,
		null,
		[],
		false,
		false,
		"/tokens/goblin.webp",
	);
	assert.deepEqual(officialRow, {
		crDisplay: "1/4",
		favoriteTitleKey: "Add to favorites",
		isCustom: false,
		isFavorite: false,
		isSelected: false,
		nextSelection: goblin,
		primaryAction: null,
		primaryTitleKey: null,
		tokenSrc: "/tokens/goblin.webp",
	});
	assert.equal(officialRow.nextSelection, goblin);
	const selectedFavoriteRow = getBestiaryMonsterRowPresentation(
		goblin,
		{ name: " goblin ", source: "mm" },
		[{ name: "GOBLIN", source: "mm" }],
		true,
		true,
		"/tokens/goblin.webp",
	);
	assert.equal(selectedFavoriteRow.isSelected, true);
	assert.equal(selectedFavoriteRow.nextSelection, null);
	assert.equal(selectedFavoriteRow.isFavorite, true);
	assert.equal(selectedFavoriteRow.favoriteTitleKey, "Remove from favorites");
	assert.equal(selectedFavoriteRow.primaryAction, "select");
	assert.equal(selectedFavoriteRow.primaryTitleKey, "Insert");
	const addOnlyRow = getBestiaryMonsterRowPresentation(
		goblin,
		null,
		[],
		false,
		true,
		"/tokens/goblin.webp",
	);
	assert.equal(addOnlyRow.primaryAction, "add");
	assert.equal(addOnlyRow.primaryTitleKey, "Add to encounter");
	const customEmptyImageRow = getBestiaryMonsterRowPresentation(
		{ ...dragon, imageUrl: "", cr: 0 },
		null,
		[],
		false,
		false,
		"/tokens/dragon.webp",
	);
	assert.equal(customEmptyImageRow.isCustom, true);
	assert.equal(customEmptyImageRow.tokenSrc, "");
	assert.equal(customEmptyImageRow.crDisplay, "--");
	const normalizedCustomFallbackRow = getBestiaryMonsterRowPresentation(
		{ ...dragon, source: " custom ", imageUrl: 0, cr: "" },
		null,
		[],
		false,
		false,
		"/tokens/normalized-custom.webp",
	);
	assert.equal(normalizedCustomFallbackRow.isCustom, true);
	assert.equal(
		normalizedCustomFallbackRow.tokenSrc,
		"/tokens/normalized-custom.webp",
	);
	assert.equal(normalizedCustomFallbackRow.crDisplay, "--");
	assert.equal(
		getBestiaryMonsterRowPresentation(
			{ ...dragon, imageUrl: null },
			null,
			[],
			false,
			false,
			"/tokens/dragon.webp",
		).tokenSrc,
		"/tokens/dragon.webp",
	);
	let detailTitleResolutionCount = 0;
	const getDetailAddTitle = () => {
		detailTitleResolutionCount += 1;
		return "Додати до енкаунтера";
	};
	assert.equal(
		getBestiaryDetailPresentation(
			null,
			[],
			null,
			null,
			null,
			getDetailAddTitle,
		),
		null,
	);
	assert.equal(detailTitleResolutionCount, 0);
	const officialDetail = getBestiaryDetailPresentation(
		goblin,
		[{ name: " goblin ", source: "mm" }],
		null,
		null,
		() => {},
		getDetailAddTitle,
	);
	assert.equal(detailTitleResolutionCount, 0);
	assert.deepEqual(officialDetail, {
		monster: goblin,
		favoriteActive: true,
		insertAction: undefined,
		addAction: undefined,
		addTitle: undefined,
		showAddToEncounterPicker: false,
		deleteAction: undefined,
	});
	const detailCalls = [];
	const selectDetailMonster = (monster) => detailCalls.push(["select", monster]);
	const addDetailMonster = (monster) => detailCalls.push(["add", monster]);
	const deleteDetailMonster = (monster) => detailCalls.push(["delete", monster]);
	const customDetail = getBestiaryDetailPresentation(
		dragon,
		[],
		selectDetailMonster,
		addDetailMonster,
		deleteDetailMonster,
		getDetailAddTitle,
	);
	assert.equal(detailTitleResolutionCount, 1);
	assert.equal(customDetail.monster, dragon);
	assert.equal(customDetail.favoriteActive, false);
	assert.equal(customDetail.insertAction, selectDetailMonster);
	assert.equal(customDetail.addAction, addDetailMonster);
	assert.equal(customDetail.addTitle, "Додати до енкаунтера");
	assert.equal(customDetail.showAddToEncounterPicker, true);
	assert.equal(customDetail.deleteAction, deleteDetailMonster);
	customDetail.insertAction(customDetail.monster);
	customDetail.addAction(customDetail.monster);
	customDetail.deleteAction(customDetail.monster);
	assert.deepEqual(detailCalls, [
		["select", dragon],
		["add", dragon],
		["delete", dragon],
	]);
	assert.equal(
		getBestiaryDetailPresentation(
			dragon,
			[],
			undefined,
			undefined,
			null,
			() => "Додати до енкаунтера",
		).deleteAction,
		undefined,
	);
	const selectedDragon = {
		name: " Дракон ",
		source: "custom",
		cr: "5",
	};
	const dragonReference = { name: "дракон", source: "CUSTOM" };
	assert.equal(
		getBestiaryInitialSelectionScrollPlan(
			[dragon],
			dragonReference,
			selectedDragon,
			false,
			"",
		),
		null,
	);
	assert.equal(
		getBestiaryInitialSelectionScrollPlan(
			[dragon],
			{ name: "", source: "CUSTOM" },
			selectedDragon,
			true,
			"",
		),
		null,
	);
	assert.equal(
		getBestiaryInitialSelectionScrollPlan(
			[dragon],
			dragonReference,
			null,
			true,
			"",
		),
		null,
	);
	assert.equal(
		getBestiaryInitialSelectionScrollPlan(
			[dragon],
			{ name: "Огр", source: "CUSTOM" },
			selectedDragon,
			true,
			"",
		),
		null,
	);
	assert.equal(
		getBestiaryInitialSelectionScrollPlan(
			[dragon],
			{ name: "Дракон", source: "MM" },
			selectedDragon,
			true,
			"",
		),
		null,
	);
	assert.equal(
		getBestiaryInitialSelectionScrollPlan(
			[goblin],
			dragonReference,
			selectedDragon,
			true,
			"",
		),
		null,
	);
	assert.deepEqual(
		getBestiaryInitialSelectionScrollPlan(
			[goblin, dragon],
			dragonReference,
			selectedDragon,
			true,
			"",
		),
		{ scrollKey: "custom: Дракон ", selectedIndex: 1 },
	);
	assert.equal(
		getBestiaryInitialSelectionScrollPlan(
			[goblin, dragon],
			dragonReference,
			selectedDragon,
			true,
			"custom: Дракон ",
		),
		null,
	);
	const sourcelessMonster = { name: "Без джерела" };
	assert.deepEqual(
		getBestiaryInitialSelectionScrollPlan(
			[sourcelessMonster, { ...sourcelessMonster }],
			{ name: "Без джерела", source: "" },
			sourcelessMonster,
			true,
			"",
		),
		{ scrollKey: ":Без джерела", selectedIndex: 0 },
	);

	const generated = { name: "Виверна", source: "CUSTOM" };
	const updatePlan = getCustomBestiaryUpdatePlan(
		{ monsters: [dragon, generated] },
		{ generated: { monsters: [{ ...generated, imageUrl: "/draft.png" }] } },
	);
	assert.equal(updatePlan.trackUndo, true);
	assert.equal(updatePlan.nextSelectedMonster, generated);
	assert.equal(updatePlan.updatedMonsters[1], generated);
	assert.deepEqual(getCustomBestiaryUpdatePlan(null), {
		hasUpdatedMonsters: false,
		updatedMonsters: [],
		nextSelectedMonster: null,
		trackUndo: false,
	});
	assert.deepEqual(
		getCustomBestiaryUpdatePlan({ results: [generated] }, { selectedName: "Виверна" }),
		{
			hasUpdatedMonsters: false,
			updatedMonsters: [],
			nextSelectedMonster: null,
			trackUndo: false,
		},
	);
	assert.deepEqual(getCustomBestiaryUpdatePlan({ monsters: [] }), {
		hasUpdatedMonsters: true,
		updatedMonsters: [],
		nextSelectedMonster: null,
		trackUndo: true,
	});
	const selectedReturnedMonster = { name: "  Мантикора ", source: " custom " };
	const selectedByNamePlan = getCustomBestiaryUpdatePlan(
		{ monsters: [null, { source: "CUSTOM" }, selectedReturnedMonster] },
		{ selectedName: "МАНТИКОРА", trackUndo: false },
	);
	assert.deepEqual(selectedByNamePlan.updatedMonsters, [selectedReturnedMonster]);
	assert.equal(selectedByNamePlan.nextSelectedMonster, selectedReturnedMonster);
	assert.equal(selectedByNamePlan.trackUndo, false);
	const generatedDraft = { name: "Грифон", source: "CUSTOM", imageUrl: "/draft.png" };
	const selectedByGeneratedPlan = getCustomBestiaryUpdatePlan(
		{ monsters: [selectedReturnedMonster] },
		{
			generated: { monsters: [generatedDraft] },
			selectedName: "Мантикора",
		},
	);
	assert.equal(selectedByGeneratedPlan.nextSelectedMonster, generatedDraft);
	assert.equal(
		getCustomBestiaryUpdatePlan(
			{ monsters: [selectedReturnedMonster] },
			{
				generated: {
					monsters: [{ name: "мантикора", source: "CUSTOM" }],
				},
				selectedName: "не використовується",
			},
		).nextSelectedMonster,
		selectedReturnedMonster,
	);
	assert.equal(
		getCustomRefreshSelection([dragon], { name: "Дракон", source: "CUSTOM" }, null),
		dragon,
	);
	const officialRefreshCandidate = { name: "Мавка", source: "MM" };
	const firstCustomRefreshCandidate = { name: " Мавка ", source: " custom " };
	const duplicateCustomRefreshCandidate = { name: "МАВКА", source: "CUSTOM" };
	const currentCustomRefreshCandidate = { name: "Лісовик", source: "CUSTOM" };
	const refreshCandidates = [
		officialRefreshCandidate,
		firstCustomRefreshCandidate,
		duplicateCustomRefreshCandidate,
		currentCustomRefreshCandidate,
	];
	assert.equal(
		getCustomRefreshSelection(
			refreshCandidates,
			{ name: "мавка", source: "WRONG-SOURCE" },
			{ name: "Лісовик", source: "CUSTOM" },
		),
		firstCustomRefreshCandidate,
	);
	assert.equal(
		getCustomRefreshSelection(
			refreshCandidates,
			{ name: "", source: "CUSTOM" },
			{ name: " лісовик ", source: " custom " },
		),
		currentCustomRefreshCandidate,
	);
	assert.equal(
		getCustomRefreshSelection(refreshCandidates, null, {
			name: "Лісовик",
			source: "MM",
		}),
		null,
	);
	assert.equal(
		getCustomRefreshSelection(refreshCandidates, undefined, {
			name: "Відсутній",
			source: "CUSTOM",
		}),
		null,
	);
	assert.equal(getCustomRefreshSelection(refreshCandidates, null, null), null);
	assert.deepEqual(
		getAiMonsterInstructionPlan("create-based", "  сильніший  ", "Створи копію"),
		{ error: null, instructions: "Створи копію\n\nсильніший" },
	);
	assert.deepEqual(
		getAiMonsterEditStartPlan({
			targetMonster: null,
			mode: "edit",
			rawInstructions: "посиль",
			createInstruction: "Створи копію",
			selectedModel: "gemini-test",
			attachedImages: [],
			attachedFiles: [],
			language: "uk",
		}),
		{ kind: "skip" },
	);
	assert.deepEqual(
		getAiMonsterEditStartPlan({
			targetMonster: dragon,
			mode: "local-edit",
			rawInstructions: "   ",
			createInstruction: "Створи копію",
			selectedModel: "",
			attachedImages: [],
			attachedFiles: [],
			language: "uk",
		}),
		{ kind: "invalid", error: "missing-instructions" },
	);
	const attachedImages = [{ name: "дракон.png" }];
	const attachedFiles = [{ name: "опис.md" }];
	const aiEditStartPlan = getAiMonsterEditStartPlan({
		targetMonster: dragon,
		mode: "create-based",
		rawInstructions: "  додай крила  ",
		createInstruction: "Створи копію",
		selectedModel: "",
		attachedImages,
		attachedFiles,
		language: "uk",
	});
	assert.equal(aiEditStartPlan.kind, "ready");
	assert.equal(aiEditStartPlan.targetMonster, dragon);
	assert.equal(aiEditStartPlan.payload.attachedImages, attachedImages);
	assert.equal(aiEditStartPlan.payload.attachedFiles, attachedFiles);
	assert.equal(aiEditStartPlan.payload.customMonsterTarget, dragon);
	assert.deepEqual(aiEditStartPlan.payload, {
		type: "custom-monster",
		modelName: undefined,
		userInstructions: "Створи копію\n\nдодай крила",
		path: { campaign: "bestiary" },
		attachedImages,
		attachedFiles,
		customMonsterTarget: dragon,
		customMonsterMode: "create-based",
		parseAIResponse: true,
		generateCharacters: false,
		generateNpcs: false,
		generateLocations: false,
		generateEncounters: false,
		entityScope: "custom-bestiary",
		contextConfig: null,
		language: "uk",
	});
	const aiDraftEntry = {
		id: "чернетка-1",
		changes: {
			resources: [{
				id: "монстр-1",
				kind: "custom-monster",
				before: null,
				after: { name: "Новий дракон" },
			}],
		},
	};
	const aiDraftTarget = {
		...dragon,
		imageUrl: "/токени/дракон.webp",
	};
	const draftGenerationPlan = getAiMonsterGenerationResultPlan(
		{
			draft: true,
			aiResponse: aiDraftEntry,
			get updated() {
				throw new Error("Draft result must win before updated is read");
			},
			get generated() {
				throw new Error("Draft result must win before generated is read");
			},
		},
		aiDraftTarget,
		"edit",
	);
	assert.equal(draftGenerationPlan.kind, "draft");
	assert.notEqual(draftGenerationPlan.entry, aiDraftEntry);
	assert.deepEqual(
		draftGenerationPlan.entry.changes.resources[0].after,
		{
			name: "Новий дракон",
			imageUrl: "/токени/дракон.webp",
			originalBestiaryName: "Дракон",
		},
	);
	assert.equal(aiDraftEntry.changes.resources[0].after.imageUrl, undefined);

	const generatedMonsters = { monsters: [dragon] };
	const updatedMonsters = { monsters: [dragon] };
	const updateGenerationPlan = getAiMonsterGenerationResultPlan(
		{
			draft: true,
			aiResponse: null,
			updated: updatedMonsters,
			generated: generatedMonsters,
		},
		dragon,
		"edit",
	);
	assert.deepEqual(updateGenerationPlan, {
		kind: "update",
		updated: updatedMonsters,
		options: {
			generated: generatedMonsters,
			selectedName: "Дракон",
			trackUndo: false,
		},
	});
	assert.equal(updateGenerationPlan.updated, updatedMonsters);
	assert.equal(updateGenerationPlan.options.generated, generatedMonsters);

	const nonEditGenerationPlan = getAiMonsterGenerationResultPlan(
		{
			draft: false,
			aiResponse: aiDraftEntry,
			updated: "оновлено",
			generated: undefined,
		},
		{
			name: "Не читати токен",
			source: "MM",
			get imageUrl() {
				throw new Error("Update result must not enrich draft images");
			},
		},
		"local-edit",
	);
	assert.deepEqual(nonEditGenerationPlan, {
		kind: "update",
		updated: "оновлено",
		options: {
			generated: undefined,
			selectedName: undefined,
			trackUndo: false,
		},
	});
	assert.deepEqual(
		getAiMonsterGenerationResultPlan(
			{
				draft: true,
				aiResponse: null,
				updated: 0,
				generated: generatedMonsters,
			},
			dragon,
			"create-based",
		),
		{ kind: "skip" },
	);
	assert.equal(
		getAiMonsterEditErrorMessage(
			new DOMException("Скасовано", "AbortError"),
			"Невідома помилка",
		),
		null,
	);
	assert.equal(
		getAiMonsterEditErrorMessage(new Error("Помилка моделі"), "Невідома помилка"),
		"Помилка моделі",
	);
	assert.equal(
		getAiMonsterEditErrorMessage(new Error(""), "Невідома помилка"),
		"Невідома помилка",
	);
	const activeController = {};
	assert.equal(
		shouldClearAiMonsterEditController(activeController, activeController),
		true,
	);
	assert.equal(shouldClearAiMonsterEditController({}, activeController), false);
	const aiEditSignal = new AbortController().signal;
	const aiEditExecutionEvents = [];
	let appliedAiEditData = null;
	const aiEditExecutionOutcome = await executeAiMonsterEditRequest({
		plan: aiEditStartPlan,
		signal: aiEditSignal,
		fallbackError: "Невідома помилка",
		generateAi: async (payload, options) => {
			assert.equal(payload, aiEditStartPlan.payload);
			assert.equal(options.signal, aiEditSignal);
			aiEditExecutionEvents.push("generate");
			return {
				draft: true,
				aiResponse: { id: "відповідь-1" },
				generated: { monsters: [dragon] },
				updated: { monsters: [dragon] },
			};
		},
		onApplied: (data, targetMonster) => {
			assert.equal(targetMonster, dragon);
			appliedAiEditData = data;
			aiEditExecutionEvents.push("apply");
		},
		onReset: () => aiEditExecutionEvents.push("reset"),
		onError: () => aiEditExecutionEvents.push("error"),
		onSettled: () => aiEditExecutionEvents.push("settled"),
	});
	assert.deepEqual(aiEditExecutionEvents, [
		"generate",
		"apply",
		"reset",
		"settled",
	]);
	assert.equal(aiEditExecutionOutcome.status, "succeeded");
	assert.equal(aiEditExecutionOutcome.data, appliedAiEditData);
	assert.equal(appliedAiEditData.draft, true);
	assert.equal(appliedAiEditData.aiResponse.id, "відповідь-1");
	assert.equal(appliedAiEditData.generated.monsters[0], dragon);

	const cancelledAiEditEvents = [];
	const cancelledAiEditOutcome = await executeAiMonsterEditRequest({
		plan: aiEditStartPlan,
		signal: aiEditSignal,
		fallbackError: "Невідома помилка",
		generateAi: async () => {
			cancelledAiEditEvents.push("generate");
			throw new DOMException("Скасовано", "AbortError");
		},
		onApplied: () => cancelledAiEditEvents.push("apply"),
		onReset: () => cancelledAiEditEvents.push("reset"),
		onError: () => cancelledAiEditEvents.push("error"),
		onSettled: () => cancelledAiEditEvents.push("settled"),
	});
	assert.deepEqual(cancelledAiEditOutcome, { status: "cancelled" });
	assert.deepEqual(cancelledAiEditEvents, ["generate", "settled"]);

	const failedAiEditEvents = [];
	const aiEditFailure = new Error("Помилка виконання");
	const failedAiEditOutcome = await executeAiMonsterEditRequest({
		plan: aiEditStartPlan,
		signal: aiEditSignal,
		fallbackError: "Невідома помилка",
		generateAi: async () => {
			failedAiEditEvents.push("generate");
			throw aiEditFailure;
		},
		onApplied: () => failedAiEditEvents.push("apply"),
		onReset: () => failedAiEditEvents.push("reset"),
		onError: (message) => failedAiEditEvents.push(`error:${message}`),
		onSettled: () => failedAiEditEvents.push("settled"),
	});
	assert.deepEqual(failedAiEditOutcome, {
		status: "failed",
		error: aiEditFailure,
		message: "Помилка виконання",
	});
	assert.deepEqual(failedAiEditEvents, [
		"generate",
		"error:Помилка виконання",
		"settled",
	]);

	const failedAiEditApplyEvents = [];
	const aiEditApplyFailure = new Error("Не вдалося застосувати");
	const failedAiEditApplyOutcome = await executeAiMonsterEditRequest({
		plan: aiEditStartPlan,
		signal: aiEditSignal,
		fallbackError: "Невідома помилка",
		generateAi: async () => {
			failedAiEditApplyEvents.push("generate");
			return null;
		},
		onApplied: () => {
			failedAiEditApplyEvents.push("apply");
			throw aiEditApplyFailure;
		},
		onReset: () => failedAiEditApplyEvents.push("reset"),
		onError: (message) => failedAiEditApplyEvents.push(`error:${message}`),
		onSettled: () => failedAiEditApplyEvents.push("settled"),
	});
	assert.deepEqual(failedAiEditApplyOutcome, {
		status: "failed",
		error: aiEditApplyFailure,
		message: "Не вдалося застосувати",
	});
	assert.deepEqual(failedAiEditApplyEvents, [
		"generate",
		"apply",
		"error:Не вдалося застосувати",
		"settled",
	]);
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

	const draftEntry = {
		id: "draft-1",
		changes: {
			resources: [
				{
					id: "monster-1",
					kind: "custom-monster",
					after: { name: "Мавка" },
				},
				{
					id: "monster-2",
					kind: "custom-monster",
					after: { name: "Лісовик" },
				},
			],
		},
	};
	const currentCustomMonsters = [
		{ name: "Мавка", source: "CUSTOM", hp: 27 },
	];
	assert.equal(
		getAiDraftRestoreStartPlan(
			null,
			"apply",
			undefined,
			false,
			currentCustomMonsters,
		),
		null,
	);
	assert.equal(
		getAiDraftRestoreStartPlan(
			{ id: "" },
			"apply",
			undefined,
			false,
			currentCustomMonsters,
		),
		null,
	);
	assert.equal(
		getAiDraftRestoreStartPlan(
			draftEntry,
			"apply",
			undefined,
			true,
			currentCustomMonsters,
		),
		null,
	);
	const selectedResourceIds = ["monster-2"];
	const applyRestoreStart = getAiDraftRestoreStartPlan(
		draftEntry,
		"apply",
		selectedResourceIds,
		false,
		currentCustomMonsters,
	);
	assert.equal(applyRestoreStart.entry, draftEntry);
	assert.equal(applyRestoreStart.resourceIds, selectedResourceIds);
	assert.deepEqual(applyRestoreStart.undoSnapshot, currentCustomMonsters);
	assert.notEqual(applyRestoreStart.undoSnapshot, currentCustomMonsters);
	currentCustomMonsters[0].hp = 1;
	assert.equal(applyRestoreStart.undoSnapshot[0].hp, 27);
	assert.deepEqual(getAiDraftRestoreResultPlan(applyRestoreStart, null), {
		nextEntry: draftEntry,
		update: null,
	});

	const restoredEntry = {
		...draftEntry,
		id: "draft-restored",
	};
	const changedUpdatedBestiary = {
		monsters: [{ name: "Лісовик", source: "CUSTOM", hp: 45 }],
	};
	const applyRestoreResult = getAiDraftRestoreResultPlan(applyRestoreStart, {
		response: restoredEntry,
		updated: changedUpdatedBestiary,
	});
	assert.equal(applyRestoreResult.nextEntry, restoredEntry);
	assert.equal(applyRestoreResult.update.updated, changedUpdatedBestiary);
	assert.deepEqual(applyRestoreResult.update.options, {
		selectedName: "Лісовик",
		trackUndo: false,
	});
	assert.equal(
		applyRestoreResult.update.undoSnapshot,
		applyRestoreStart.undoSnapshot,
	);
	const sameUpdatedBestiary = {
		monsters: applyRestoreStart.undoSnapshot,
	};
	assert.equal(
		getAiDraftRestoreResultPlan(applyRestoreStart, {
			updated: sameUpdatedBestiary,
		}).update.undoSnapshot,
		null,
	);
	const noSelectedResourceStart = getAiDraftRestoreStartPlan(
		draftEntry,
		"apply",
		[],
		false,
		[],
	);
	assert.deepEqual(
		getAiDraftRestoreResultPlan(noSelectedResourceStart, {
			updated: { monsters: [] },
		}).update.options,
		{ selectedName: undefined, trackUndo: false },
	);

	const undoRestoreStart = getAiDraftRestoreStartPlan(
		draftEntry,
		"undo",
		selectedResourceIds,
		false,
		currentCustomMonsters,
	);
	assert.equal(undoRestoreStart.undoSnapshot, null);
	const undoUpdatedBestiary = {
		monsters: [{ name: "Мавка", source: "CUSTOM", hp: 27 }],
	};
	assert.deepEqual(
		getAiDraftRestoreResultPlan(undoRestoreStart, {
			updated: undoUpdatedBestiary,
		}),
		{
			nextEntry: draftEntry,
			update: {
				updated: undoUpdatedBestiary,
				options: { trackUndo: false },
				undoSnapshot: null,
			},
		},
	);
	assert.deepEqual(
		getAiDraftRestoreResultPlan(undoRestoreStart, {
			response: restoredEntry,
		}),
		{ nextEntry: restoredEntry, update: null },
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

await run("Bestiary AI draft restore executor preserves routing and lifecycle order", async () => {
	const skippedReads = [];
	const skipped = await executeAiDraftRestore(
		new Proxy(
			{ start: null },
			{
				get(target, property) {
					skippedReads.push(property);
					return target[property];
				},
			},
		),
	);
	assert.deepEqual(skipped, { status: "skipped" });
	assert.deepEqual(skippedReads, ["start"]);

	const entry = {
		id: "draft-apply",
		changes: {
			resources: [{ id: "monster-2", after: { name: "Forest Spirit" } }],
		},
	};
	const restoredEntry = { ...entry, id: "draft-applied" };
	const resourceIds = ["monster-2"];
	const undoSnapshot = [{ name: "River Spirit", source: "CUSTOM", hp: 21 }];
	const updated = {
		monsters: [{ name: "Forest Spirit", source: "CUSTOM", hp: 38 }],
	};
	const applyStart = {
		entry,
		mode: "apply",
		resourceIds,
		undoSnapshot,
	};
	const applyEvents = [];
	const applyOutcome = await executeAiDraftRestore({
		start: applyStart,
		onBusy: (isBusy) => applyEvents.push(["busy", isBusy]),
		apply: async (receivedEntry, payload) => {
			applyEvents.push(["apply", receivedEntry, payload]);
			assert.equal(receivedEntry, entry);
			assert.deepEqual(Object.keys(payload), ["resourceIds"]);
			assert.equal(payload.resourceIds, resourceIds);
			return { response: restoredEntry, updated };
		},
		undo: async () => assert.fail("apply restore must not call undo"),
		onEntry: (nextEntry) => applyEvents.push(["entry", nextEntry]),
		onUndoSnapshot: (snapshot) => applyEvents.push(["snapshot", snapshot]),
		onUpdate: (nextUpdated, options) =>
			applyEvents.push(["update", nextUpdated, options]),
		onError: (error) => assert.fail(`unexpected restore error: ${error}`),
	});
	assert.equal(applyOutcome.status, "succeeded");
	assert.equal(applyOutcome.plan.nextEntry, restoredEntry);
	assert.deepEqual(
		applyEvents.map(([name, value]) => [name, value]),
		[
			["busy", true],
			["apply", entry],
			["entry", restoredEntry],
			["snapshot", undoSnapshot],
			["update", updated],
			["busy", false],
		],
	);

	const undoEvents = [];
	const undoStart = {
		entry,
		mode: "undo",
		resourceIds: undefined,
		undoSnapshot: null,
	};
	const undoOutcome = await executeAiDraftRestore({
		start: undoStart,
		onBusy: (isBusy) => undoEvents.push(["busy", isBusy]),
		apply: async () => assert.fail("undo restore must not call apply"),
		undo: async (receivedEntry, payload) => {
			undoEvents.push(["undo", receivedEntry, payload]);
			assert.deepEqual(payload, { resourceIds: undefined });
			return { updated };
		},
		onEntry: (nextEntry) => undoEvents.push(["entry", nextEntry]),
		onUndoSnapshot: () => assert.fail("undo restore must not create a snapshot"),
		onUpdate: (nextUpdated, options) =>
			undoEvents.push(["update", nextUpdated, options]),
		onError: (error) => assert.fail(`unexpected restore error: ${error}`),
	});
	assert.equal(undoOutcome.status, "succeeded");
	assert.deepEqual(
		undoEvents.map(([name, value]) => [name, value]),
		[
			["busy", true],
			["undo", entry],
			["entry", entry],
			["update", updated],
			["busy", false],
		],
	);
});

await run("Bestiary AI draft restore executor reports failures and always settles", async () => {
	const entry = { id: "draft-failure" };
	const start = {
		entry,
		mode: "apply",
		resourceIds: undefined,
		undoSnapshot: [],
	};
	const transportError = new Error("restore failed");
	const transportEvents = [];
	const transportOutcome = await executeAiDraftRestore({
		start,
		onBusy: (isBusy) => transportEvents.push(["busy", isBusy]),
		apply: async () => {
			transportEvents.push(["apply"]);
			throw transportError;
		},
		undo: async () => assert.fail("apply restore must not call undo"),
		onEntry: () => assert.fail("failed transport must not apply entry"),
		onUndoSnapshot: () => assert.fail("failed transport must not apply snapshot"),
		onUpdate: () => assert.fail("failed transport must not apply update"),
		onError: (error) => transportEvents.push(["error", error]),
	});
	assert.deepEqual(transportOutcome, { status: "failed", error: transportError });
	assert.deepEqual(transportEvents, [
		["busy", true],
		["apply"],
		["error", transportError],
		["busy", false],
	]);

	const effectError = new Error("entry effect failed");
	const effectEvents = [];
	const effectOutcome = await executeAiDraftRestore({
		start,
		onBusy: (isBusy) => effectEvents.push(["busy", isBusy]),
		apply: async () => ({ updated: { monsters: [] } }),
		undo: async () => assert.fail("apply restore must not call undo"),
		onEntry: () => {
			effectEvents.push(["entry"]);
			throw effectError;
		},
		onUndoSnapshot: () => assert.fail("entry failure must stop snapshot"),
		onUpdate: () => assert.fail("entry failure must stop update"),
		onError: (error) => effectEvents.push(["error", error]),
	});
	assert.deepEqual(effectOutcome, { status: "failed", error: effectError });
	assert.deepEqual(effectEvents, [
		["busy", true],
		["entry"],
		["error", effectError],
		["busy", false],
	]);

	const alertError = new Error("alert failed");
	const alertBusy = [];
	await assert.rejects(
		executeAiDraftRestore({
			start,
			onBusy: (isBusy) => alertBusy.push(isBusy),
			apply: async () => {
				throw transportError;
			},
			undo: async () => assert.fail("apply restore must not call undo"),
			onEntry: () => {},
			onUndoSnapshot: () => {},
			onUpdate: () => {},
			onError: () => {
				throw alertError;
			},
		}),
		(error) => error === alertError,
	);
	assert.deepEqual(alertBusy, [true, false]);
});

await run("rules reference modal policies preserve qualified identities and UTF-8 tags", () => {
	assert.equal(REFERENCE_TAB_POLICIES.length, 7);
	assert.equal(getInitialTabId("bestiary"), "bestiary");
	assert.equal(getInitialTabId("unknown"), "conditions");
	const directList = [{ name: "Прямий список" }];
	assert.equal(normalizeReferenceList(directList), directList);
	assert.deepEqual(normalizeReferenceList({ monsters: directList }), []);
	assert.deepEqual(
		combineBestiaryLists(
			{ monsters: [{ name: "Вовк", source: "MM" }] },
			{ results: [{ name: "Мавка", source: "CUSTOM" }] },
		).map((item) => item.name),
		["Вовк", "Мавка"],
	);
	assert.deepEqual(
		combineBestiaryLists(
			{
				monster: null,
				monsters: [{ name: "Вибраний envelope" }],
				results: [{ name: "Пізній fallback" }],
			},
			undefined,
		).map((item) => item.name),
		["Вибраний envelope"],
	);
	assert.deepEqual(
		combineBestiaryLists(
			{ monster: {}, monsters: [{ name: "Не використовується" }] },
			"invalid custom payload",
		),
		[],
	);
	assert.equal(
		getCreatureReferenceName({ name: "  Мавка  ", source: "  CUSTOM  " }),
		"Мавка|CUSTOM",
	);
	assert.equal(getSpellReferenceName({ name: " Щит ", source: "   " }), "Щит");
	assert.equal(getCreatureReferenceName({ name: 0, source: "MM" }), "");
	assert.equal(getCreatureReferenceName({ name: "Вовк", source: 0 }), "Вовк");
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
		getReferenceInlineTag("diseases", { name: "Сліпа гарячка" }),
		"{@disease Сліпа гарячка}",
	);
	assert.equal(getReferenceInlineTag("skills", { name: "" }), "");
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
	assert.equal(getCreatureReferenceMatchRank(creatures[0], ""), 0);
	assert.equal(getCreatureReferenceMatchRank(creatures[0], "Мавка|XMM"), 0);
	assert.equal(getCreatureReferenceMatchRank(creatures[0], "Дракон"), 2);
	assert.equal(getCreatureReferenceMatchRank(creatures[0], "Дракон|xmm"), 3);
	assert.equal(getCreatureReferenceMatchRank(creatures[0], "Дракон|MM"), 1);
	assert.equal(itemMatchesSelectedName("bestiary", creatures[0], "Дракон|MM"), true);
	assert.equal(itemMatchesSelectedName("conditions", { name: "Отруєний" }, " Отруєний "), true);
	assert.equal(
		itemMatchesSelectedName("spells", { name: "Щит", source: "PHB" }, "Щит"),
		true,
	);
	assert.equal(
		itemMatchesSelectedName("spells", { name: "Щит", source: "PHB" }, "Щит|PHB"),
		true,
	);
	const rankedCreatures = [
		{ name: "Дракон", source: "XMM" },
		{ name: "Дракон", source: "TCE" },
		{ name: "Дракон", source: "MM" },
		{ name: "Дракон", source: "MM" },
	];
	assert.equal(
		findSelectedReferenceItem("bestiary", rankedCreatures, "Дракон|MM"),
		rankedCreatures[2],
	);
	assert.equal(
		findSelectedReferenceItem("bestiary", rankedCreatures.slice(0, 2), "Дракон|MM"),
		rankedCreatures[0],
	);
	const unreadableAfterExact = { get name() { throw new Error("lookup continued after exact match"); } };
	assert.equal(
		findSelectedReferenceItem("bestiary", [rankedCreatures[2], unreadableAfterExact], "Дракон|MM"),
		rankedCreatures[2],
	);
	const duplicateConditions = [{ name: "Отруєний" }, { name: "Отруєний" }];
	assert.equal(
		findSelectedReferenceItem("conditions", duplicateConditions, "Отруєний"),
		duplicateConditions[0],
	);
	const diseasePolicy = REFERENCE_TAB_POLICIES.find((tab) => tab.id === "diseases");
	assert.equal(itemMatchesQuery(diseasePolicy, { name: "Сліпа гарячка", entries: ["лихоманка"] }, "лихоманка", true), true);
	assert.equal(itemMatchesQuery(diseasePolicy, { name: "Сліпа гарячка" }, "гаряч", false), true);
});

await run("rules reference modal plans preserve keyboard and tab navigation", () => {
	const baseKeyboardInput = {
		key: "Backspace",
		altKey: false,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		isEditableTarget: false,
		canNavigateBack: true,
	};
	assert.deepEqual(getReferenceKeyboardPlan(baseKeyboardInput), {
		preventDefault: true,
		historyDirection: -1,
	});
	for (const override of [
		{ key: "Delete" },
		{ altKey: true },
		{ ctrlKey: true },
		{ metaKey: true },
		{ shiftKey: true },
		{ isEditableTarget: true },
		{ canNavigateBack: false },
	]) {
		assert.equal(getReferenceKeyboardPlan({ ...baseKeyboardInput, ...override }), null);
	}

	assert.deepEqual(
		getReferenceTabSelectionPlan("conditions", "", { name: "Отруєний" }),
		{
			tabId: "conditions",
			navigationName: "Отруєний",
			pendingNavigationTabId: null,
		},
	);
	assert.deepEqual(
		getReferenceTabSelectionPlan("bestiary", "", { name: "Мавка", source: "CUSTOM" }),
		{
			tabId: "bestiary",
			navigationName: "Мавка|CUSTOM",
			pendingNavigationTabId: null,
		},
	);
	assert.deepEqual(
		getReferenceTabSelectionPlan("conditions", "Збережений вибір", { name: "Перший" }),
		{
			tabId: "conditions",
			navigationName: "Збережений вибір",
			pendingNavigationTabId: null,
		},
	);
	assert.deepEqual(getReferenceTabSelectionPlan("conditions", "", { name: "" }), {
		tabId: "conditions",
		navigationName: null,
		pendingNavigationTabId: "conditions",
	});
	assert.deepEqual(getReferenceTabSelectionPlan("spells", "Вогняна куля|PHB", null), {
		tabId: "spells",
		navigationName: "Вогняна куля|PHB",
		pendingNavigationTabId: null,
	});
	assert.deepEqual(getReferenceTabSelectionPlan("spells", "", { name: "Щит", source: "PHB" }), {
		tabId: "spells",
		navigationName: null,
		pendingNavigationTabId: "spells",
	});
	assert.equal(getReferenceTabSelectionPlan("unknown", "", null), null);
});

await run("rules reference modal orchestration plans preserve request, load, and host effects", () => {
	assert.equal(getReferenceNavigationRequestPlan(undefined, null), null);
	assert.equal(getReferenceNavigationRequestPlan({ requestId: 0, tabId: "skills" }, null), null);
	assert.equal(
		getReferenceNavigationRequestPlan({ requestId: 4, tabId: "skills" }, 4),
		null,
	);
	assert.deepEqual(
		getReferenceNavigationRequestPlan({ requestId: 5, tabId: "skills", forceTab: true }, null),
		{ type: "tab-only", requestId: 5, tabId: "skills" },
	);
	assert.deepEqual(
		getReferenceNavigationRequestPlan({ requestId: 6, tabId: "spells", name: "Щит|PHB", forceTab: true }, 5),
		{ type: "reference", requestId: 6, tabId: "spells", name: "Щит|PHB" },
	);
	assert.deepEqual(
		getReferenceNavigationRequestPlan({ requestId: 7, tabId: "conditions" }, null),
		{ type: "reference", requestId: 7, tabId: "conditions", name: "" },
	);

	const historyEntry = { tabId: "bestiary", name: "Мавка|CUSTOM" };
	assert.equal(
		getReferenceInitialNavigationPlan(true, false, "skills", "", historyEntry),
		null,
	);
	const initialPlans = [
		getReferenceInitialNavigationPlan(false, true, "spells", "Щит|PHB", historyEntry),
		getReferenceInitialNavigationPlan(false, true, "skills", "", historyEntry),
		getReferenceInitialNavigationPlan(false, false, "conditions", "Отруєний", historyEntry),
		getReferenceInitialNavigationPlan(false, false, "conditions", "", historyEntry),
		getReferenceInitialNavigationPlan(false, false, "invalid", "", null),
	];
	assert.deepEqual(initialPlans, [
		{ type: "force-reference", tabId: "spells", name: "Щит|PHB" },
		{ type: "force-tab", tabId: "skills" },
		{ type: "reference", tabId: "conditions", name: "Отруєний" },
		{ type: "history", entry: historyEntry },
		{ type: "tab", tabId: "conditions" },
	]);
	const initialEvents = [];
	assert.equal(
		executeReferenceInitialNavigationPlan(initialPlans[0], {
			onTabOnly: (tabId) => initialEvents.push(["tab-only", tabId]),
			onReference: (tabId, name) => initialEvents.push(["reference", tabId, name]),
			onHistory: (entry) => initialEvents.push(["history", entry]),
			onTab: (tabId) => initialEvents.push(["tab", tabId]),
		}),
		true,
	);
	assert.deepEqual(initialEvents, [
		["tab-only", "spells"],
		["reference", "spells", "Щит|PHB"],
	]);
	assert.equal(
		executeReferenceInitialNavigationPlan(null, {
			onTabOnly: () => assert.fail("null plan must not execute"),
			onReference: () => assert.fail("null plan must not execute"),
			onHistory: () => assert.fail("null plan must not execute"),
			onTab: () => assert.fail("null plan must not execute"),
		}),
		false,
	);

	const loadedConditions = [{ name: "Отруєний" }];
	const itemsByTab = { conditions: loadedConditions };
	assert.deepEqual(
		getReferenceTabsToLoad(
			true,
			["conditions", "diseases", "spells"],
			"conditions",
			itemsByTab,
			new Set(["spells"]),
		),
		["diseases"],
	);
	assert.deepEqual(
		getReferenceTabsToLoad(false, ["conditions", "skills"], "skills", itemsByTab, new Set()),
		["skills"],
	);
	assert.deepEqual(
		getReferenceTabsToLoad(false, ["conditions", "skills"], "skills", itemsByTab, new Set(["skills"])),
		[],
	);
	const selectedConditions = { conditions: "Збережений" };
	assert.equal(
		applyLoadedReferenceSelection(selectedConditions, "conditions", loadedConditions),
		selectedConditions,
	);
	const selectedSpells = {};
	assert.equal(
		applyLoadedReferenceSelection(selectedSpells, "spells", [{ name: "Щит", source: "PHB" }]),
		selectedSpells,
	);
	assert.deepEqual(
		applyLoadedReferenceSelection({}, "conditions", loadedConditions),
		{ conditions: "Отруєний" },
	);
	const cleared = { conditions: "" };
	assert.equal(applyReferenceTabOnlySelection(cleared, "conditions"), cleared);
	assert.deepEqual(applyReferenceTabOnlySelection({}, "conditions"), { conditions: "" });
	assert.equal(getReferenceLoadErrorMessage(new Error("Помилка завантаження"), "Fallback"), "Помилка завантаження");
	assert.equal(getReferenceLoadErrorMessage({ message: "unsafe" }, "Невідома помилка"), "Невідома помилка");

	const tabEvents = [];
	assert.equal(
		executeReferenceTabSelectionPlan(
			{ tabId: "conditions", navigationName: "Отруєний", pendingNavigationTabId: null },
			{
				onScrollRequest: (value) => tabEvents.push(["scroll", value]),
				onPendingNavigation: (tabId) => tabEvents.push(["pending", tabId]),
				onNavigation: (tabId, name) => tabEvents.push(["navigation", tabId, name]),
				onActiveTab: (tabId) => tabEvents.push(["active", tabId]),
			},
		),
		true,
	);
	assert.deepEqual(tabEvents, [
		["scroll", false],
		["pending", null],
		["navigation", "conditions", "Отруєний"],
		["active", "conditions"],
	]);
	const pendingTabEvents = [];
	executeReferenceTabSelectionPlan(
		{ tabId: "spells", navigationName: null, pendingNavigationTabId: "spells" },
		{
			onScrollRequest: (value) => pendingTabEvents.push(["scroll", value]),
			onPendingNavigation: (tabId) => pendingTabEvents.push(["pending", tabId]),
			onNavigation: () => assert.fail("pending tab must not record navigation"),
			onActiveTab: (tabId) => pendingTabEvents.push(["active", tabId]),
		},
	);
	assert.deepEqual(pendingTabEvents, [
		["scroll", false],
		["pending", "spells"],
		["active", "spells"],
	]);

	assert.equal(getReferenceModalHostPlan(undefined, null, false), null);
	assert.equal(
		getReferenceModalHostPlan({ requestId: 8, tabId: "skills" }, 8, false),
		null,
	);
	assert.deepEqual(
		getReferenceModalHostPlan(
			{ requestId: 9, tabId: "bestiary", name: "Мавка|CUSTOM", forceTab: true },
			8,
			true,
		),
		{
			requestId: 9,
			shouldOpen: false,
			initialTab: "bestiary",
			initialName: "Мавка|CUSTOM",
			forceTab: true,
		},
	);
});

await run("rules reference modal plans reconcile selections and consume scroll requests", () => {
	assert.deepEqual(getReferenceHistoryAvailability(-1, 3), {
		canNavigateBack: false,
		canNavigateForward: false,
	});
	assert.deepEqual(getReferenceHistoryAvailability(0, 3), {
		canNavigateBack: false,
		canNavigateForward: true,
	});
	assert.deepEqual(getReferenceHistoryAvailability(1, 3), {
		canNavigateBack: true,
		canNavigateForward: true,
	});
	assert.deepEqual(getReferenceHistoryAvailability(2, 3), {
		canNavigateBack: true,
		canNavigateForward: false,
	});
	const wolf = { name: "Вовк", source: "MM" };
	const mavka = { name: "Мавка", source: "CUSTOM" };
	const reconciliationInput = {
		tabId: "bestiary",
		hasLoaded: true,
		isLoading: false,
		activeItems: [],
		filteredItems: [wolf, mavka],
		selectedName: "Невідомий|MM",
	};
	assert.deepEqual(
		getReferenceSelectionReconciliationPlan(reconciliationInput),
		{ type: "select", tabId: "bestiary", name: "Вовк|MM" },
	);
	assert.equal(
		getReferenceSelectionReconciliationPlan({
			...reconciliationInput,
			hasLoaded: false,
		}),
		null,
	);
	assert.equal(
		getReferenceSelectionReconciliationPlan({
			...reconciliationInput,
			isLoading: true,
		}),
		null,
	);
	assert.equal(
		getReferenceSelectionReconciliationPlan({
			...reconciliationInput,
			tabId: "spells",
		}),
		null,
	);
	assert.equal(
		getReferenceSelectionReconciliationPlan({
			...reconciliationInput,
			activeItems: [wolf],
			selectedName: "Вовк|MM",
		}),
		null,
	);
	assert.equal(
		getReferenceSelectionReconciliationPlan({
			...reconciliationInput,
			filteredItems: [wolf],
			selectedName: "Вовк",
		}),
		null,
	);
	const clearPlan = getReferenceSelectionReconciliationPlan({
		...reconciliationInput,
		filteredItems: [],
	});
	assert.deepEqual(clearPlan, { type: "clear", tabId: "bestiary" });
	const emptySelections = { conditions: "" };
	assert.equal(
		applyReferenceSelectionReconciliationPlan(emptySelections, clearPlan),
		emptySelections,
	);
	assert.deepEqual(
		applyReferenceSelectionReconciliationPlan(
			{ bestiary: "Старий вибір|MM", conditions: "Отруєний" },
			clearPlan,
		),
		{ bestiary: "", conditions: "Отруєний" },
	);
	const selectPlan = getReferenceSelectionReconciliationPlan(reconciliationInput);
	assert.deepEqual(
		applyReferenceSelectionReconciliationPlan(
			{ conditions: "Отруєний" },
			selectPlan,
		),
		{ conditions: "Отруєний", bestiary: "Вовк|MM" },
	);

	const dragons = [
		{ name: "Дракон", source: "XMM" },
		{ name: "Дракон", source: "MM" },
	];
	const scrollInput = {
		tabId: "bestiary",
		hasLoaded: true,
		isLoading: false,
		shouldScroll: true,
		filteredItems: dragons,
		selectedName: "Дракон|MM",
	};
	assert.deepEqual(getReferenceScrollPlan(scrollInput), { scrollIndex: 1 });
	assert.deepEqual(
		getReferenceScrollPlan({ ...scrollInput, selectedName: "Дракон|XMM" }),
		{ scrollIndex: 0 },
	);
	assert.deepEqual(
		getReferenceScrollPlan({ ...scrollInput, selectedName: "Мавка|CUSTOM" }),
		{ scrollIndex: -1 },
	);
	for (const override of [
		{ hasLoaded: false },
		{ isLoading: true },
		{ shouldScroll: false },
		{ selectedName: "" },
	]) {
		assert.equal(getReferenceScrollPlan({ ...scrollInput, ...override }), null);
	}
});

await run("campaign search policies index campaign and session content", async () => {
	const translate = (key, params = {}) =>
		key.replace("{number}", String(params.number ?? ""));
	const campaign = {
		slug: "ukrainian-campaign",
		name: "Кампанія",
		description: "Таємниця старого лісу",
		notes: [{ id: "n1", title: "Підказка", text: "Шукати біля брами" }],
	};
	const index = buildCampaignSearchIndex(
		{
			campaign,
			entities: {
				characters: [{ id: "hero", firstName: "Олена", lastName: "Мудра", race: "людина" }],
				npc: [{ id: "npc1", name: "Коваль", notes: [{ id: "nn", text: "Знає пароль" }] }],
				locations: [{ id: "loc1", title: "Стара брама", description: "Вкрита мохом" }],
			},
			sessions: [{
				fileName: "session-1.json",
				detail: {
					name: "Перша сесія",
					data: {
						scenes: [{ id: "scene1", title: "Зустріч", description: "Коваль чекає", notes: [{ id: "sn", title: "Репліка", text: "Назви пароль" }] }],
					},
				},
			}],
		},
		translate,
	);
	assert.equal(index.some((item) => item.title === "Олена Мудра" && item.filter === "npc"), true);
	assert.equal(index.some((item) => item.title === "Стара брама" && item.filter === "locations"), true);
	assert.equal(index.some((item) => item.title === "Зустріч" && item.target.hash === "session-scene-scene1"), true);
	assert.equal(filterCampaignSearchResults(index, "пароль", new Set(CAMPAIGN_SEARCH_FILTERS)).length, 4);
	assert.deepEqual(getCampaignSearchHighlightTerms("а ліс  ліс брама"), ["ліс", "брама"]);
	assert.equal(campaignSearchValueToText({ name: "видиме", _private: "ні", imageUrl: "ні" }), "видиме");
	assert.match(buildCampaignSearchSnippet(`${"початок ".repeat(20)}ключ далі`, "ключ"), /^\.\.\./);
	assert.deepEqual([...toggleCampaignSearchFilter(new Set(["notes"]), "notes")], ["notes"]);

	const calls = [];
	const loaded = await loadCampaignSearchIndex({
		campaign: { ...campaign, characters: [{ id: "local", name: "Локальний герой" }] },
		currentData: { ...campaign, characters: [{ id: "local", name: "Локальний герой" }] },
		translate,
		api: {
			getEntities: async (_slug, type) => { calls.push(type); return [{ id: `remote-${type}`, name: `remote-${type}` }]; },
			listSessions: async () => [{ fileName: "s.json", name: "Список" }],
			getSession: async () => ({ name: "Деталі", data: { notes: [{ id: "loaded", title: "Завантажено" }] } }),
		},
	});
	assert.deepEqual(calls, ["characters", "npc", "locations"]);
	assert.equal(loaded.some((item) => item.title === "Локальний герой"), true);
	assert.equal(loaded.some((item) => item.title === "remote-characters"), false);
	assert.equal(loaded.some((item) => item.title === "Завантажено"), true);
});

await run("campaign search text and snippet policies preserve recursive boundaries", () => {
	assert.equal(campaignSearchValueToText(null), "");
	assert.equal(campaignSearchValueToText(undefined), "");
	assert.equal(campaignSearchValueToText("Брама"), "Брама");
	assert.equal(campaignSearchValueToText(0), "0");
	assert.equal(campaignSearchValueToText(true), "");
	assert.equal(
		campaignSearchValueToText({
			visible: ["Ліс", { text: "брама", _secret: "не індексувати" }, true],
			imageUrl: "не індексувати",
			nested: { imageUrl: "також ні", number: 7 },
		}),
		"Ліс\nбрама\n\n7",
	);

	assert.equal(buildCampaignSearchSnippet(null, "ключ"), "");
	assert.equal(buildCampaignSearchSnippet("  Перша\n\tбрама  ", ""), "Перша брама");
	assert.equal(buildCampaignSearchSnippet("Ключ зберігає РЕГІСТР", "ключ"), "Ключ зберігає РЕГІСТР");
	assert.equal(buildCampaignSearchSnippet("x".repeat(180), "відсутній"), "x".repeat(180));
	assert.equal(buildCampaignSearchSnippet("x".repeat(181), "відсутній"), `${"x".repeat(180)}...`);
	const centeredMatch = `${"a".repeat(80)}КЛЮЧ${"b".repeat(105)}`;
	assert.equal(buildCampaignSearchSnippet(centeredMatch, "ключ"), `...${centeredMatch.slice(10)}`);
});

await run("campaign search names preserve fallback precedence", () => {
	const index = buildCampaignSearchIndex({
		campaign: { slug: "names", name: "Імена" },
		entities: {
			characters: [
				{ id: "full", firstName: "Олена", lastName: "Мудра", name: "Ігнороване ім'я" },
				{ id: "last", lastName: "Самітня" },
				{ id: "name", name: "Коваль", title: "Майстер" },
				{ id: "title", title: "Безіменний вартовий" },
				{ id: "untitled" },
			],
			npc: [],
			locations: [],
		},
		sessions: [],
	}, (key) => key === "Untitled" ? "Без назви" : key);
	const titles = index.filter((item) => item.id.startsWith("campaign-character:")).map((item) => item.title);
	assert.deepEqual(titles, ["Олена Мудра", "Самітня", "Коваль", "Безіменний вартовий", "Без назви"]);
});

await run("campaign search loader preserves request order overrides and fail-fast errors", async () => {
	const calls = [];
	const translate = (key) => key;
	const loaded = await loadCampaignSearchIndex({
		campaign: { slug: "loader", name: "Loader" },
		currentData: {
			slug: "loader",
			name: "Локальна кампанія",
			characters: [],
			npcs: null,
		},
		translate,
		api: {
			getEntities: async (_slug, type) => {
				calls.push(`entities:${type}`);
				return [{ id: type, name: `remote-${type}` }];
			},
			listSessions: async () => {
				calls.push("sessions:list");
				return [{ fileName: "first.json" }, "invalid", { fileName: 0 }];
			},
			getSession: async (_slug, fileName) => {
				calls.push(`session:${fileName}`);
				return { data: { notes: [{ id: `note-${fileName}`, title: `detail-${fileName}` }] } };
			},
		},
	});
	assert.deepEqual(calls, [
		"entities:characters",
		"entities:npc",
		"entities:locations",
		"sessions:list",
		"session:first.json",
		"session:",
		"session:",
	]);
	assert.equal(loaded.some((item) => item.title === "remote-characters"), false);
	assert.equal(loaded.some((item) => item.title === "remote-npc"), true);
	assert.equal(loaded.some((item) => item.title === "remote-locations"), true);
	assert.equal(loaded.some((item) => item.title === "detail-first.json"), true);

	const sourceError = new Error("source failed");
	await assert.rejects(
		loadCampaignSearchIndex({
			campaign: { slug: "failure", name: "Failure" },
			translate,
			api: {
				getEntities: async (_slug, type) => type === "npc" ? Promise.reject(sourceError) : [],
				listSessions: async () => [],
				getSession: async () => ({}),
			},
		}),
		(error) => error === sourceError,
	);

	const hydrationError = new Error("hydration failed");
	await assert.rejects(
		loadCampaignSearchIndex({
			campaign: { slug: "failure", name: "Failure" },
			translate,
			api: {
				getEntities: async () => [],
				listSessions: async () => [{ fileName: "broken.json" }],
				getSession: async () => Promise.reject(hydrationError),
			},
		}),
		(error) => error === hydrationError,
	);
});

await run("campaign search load execution preserves effects errors and cancellation", async () => {
	const createApi = (sessions = []) => ({
		getEntities: async () => [],
		listSessions: async () => sessions,
		getSession: async () => ({}),
	});
	const campaign = { slug: "executor", name: "Виконавець" };
	const events = [];
	await executeCampaignSearchIndexLoad({
		campaign,
		currentData: campaign,
		api: createApi(),
		translate: (key) => key,
		unknownErrorMessage: "Невідома помилка",
		isCancelled: () => false,
		effects: {
			setIndex: (index) => events.push(["index", index]),
			setError: (message) => events.push(["error", message]),
			setLoading: (loading) => events.push(["loading", loading]),
		},
	});
	assert.equal(events[0][0], "index");
	assert.equal(events[0][1].some((item) => item.id === "campaign-description"), true);
	assert.deepEqual(events[1], ["loading", false]);

	const failureEvents = [];
	await executeCampaignSearchIndexLoad({
		campaign,
		api: {
			...createApi(),
			listSessions: async () => { throw new Error("Помилка сесій"); },
		},
		translate: (key) => key,
		unknownErrorMessage: "Невідома помилка",
		isCancelled: () => false,
		effects: {
			setIndex: (index) => failureEvents.push(["index", index]),
			setError: (message) => failureEvents.push(["error", message]),
			setLoading: (loading) => failureEvents.push(["loading", loading]),
		},
	});
	assert.deepEqual(failureEvents, [["error", "Помилка сесій"], ["loading", false]]);
	assert.equal(getCampaignSearchErrorMessage("невідоме", "Запасне"), "Запасне");

	const cancelledEvents = [];
	await executeCampaignSearchIndexLoad({
		campaign,
		api: createApi(),
		translate: (key) => key,
		unknownErrorMessage: "Невідома помилка",
		isCancelled: () => true,
		effects: {
			setIndex: (index) => cancelledEvents.push(["index", index]),
			setError: (message) => cancelledEvents.push(["error", message]),
			setLoading: (loading) => cancelledEvents.push(["loading", loading]),
		},
	});
	assert.deepEqual(cancelledEvents, []);
});

await run("campaign search scenes preserve identity title and lazy fallback", () => {
	const translationCalls = [];
	const translate = (key, params = {}) => {
		translationCalls.push(key);
		return key.replace("{number}", String(params.number ?? ""));
	};
	const index = buildCampaignSearchIndex({
		campaign: { slug: "scenes", name: "Сцени" },
		entities: { characters: [], npc: [], locations: [] },
		sessions: [{
			fileName: "scene.json",
			detail: { data: { scenes: [
				{ id: "named", title: "Названа сцена" },
				{ name: "Альтернативна назва" },
				{},
			] } },
		}],
	}, translate);
	const scenes = index.filter((item) => item.filter === "scenes");
	assert.deepEqual(scenes.map((item) => item.title), ["Названа сцена", "Альтернативна назва", "Scene 3"]);
	assert.deepEqual(scenes.map((item) => item.id), [
		"session-scene.json-scene-named",
		"session-scene.json-scene-1",
		"session-scene.json-scene-2",
	]);
	assert.equal(translationCalls.filter((key) => key === "Scene {number}").length, 1);
});

await run("campaign entity modal policies preserve rename and save contracts", () => {
	assert.equal(
		getCampaignEntityRenamePlan("  Пан Коваль ", "пан   коваль").requiresConfirmation,
		false,
	);
	assert.equal(
		getCampaignEntityRenamePlan("Пан Коваль", "Майстер Коваль").requiresConfirmation,
		true,
	);
	assert.equal(getCampaignEntityRenamePlan("", "Нове ім'я").requiresConfirmation, false);
	assert.equal(isCampaignModalEntity({ slug: "npc-1" }), true);
	assert.equal(isCampaignModalEntity({ slug: "  " }), false);
	assert.deepEqual(
		sanitizeCampaignModalEntity({
			id: "npc-1",
			slug: "npc-1",
			name: "Коваль",
			_scope: "campaign",
			_internal: true,
			notes: [
				{ id: 1, title: "Плітка", text: "Знає пароль", collapsed: false, _renderKey: "one" },
				{ title: "Без ID", text: "Зберегти", collapsed: false },
				{ id: 2, title: "", text: "", collapsed: false },
			],
		}),
		{
			id: "npc-1",
			slug: "npc-1",
			name: "Коваль",
			notes: [
				{ id: 1, title: "Плітка", text: "Знає пароль", collapsed: false },
				{ title: "Без ID", text: "Зберегти", collapsed: false },
			],
		},
	);
	assert.deepEqual(getCampaignEntityModalCardPlan("locations", { id: 7 }), {
		kind: "location",
		key: "7",
	});
	assert.deepEqual(getCampaignEntityModalCardPlan("npc", {}), {
		kind: "character",
		key: "entity-modal-card",
	});
	assert.equal(shouldRenderCampaignEntityModal("campaign", undefined), true);
	assert.equal(shouldRenderCampaignEntityModal("campaign", "session"), false);
	assert.equal(shouldRenderCampaignEntityModal("", undefined), false);
});

await run("AI assistant context projection preserves route-specific contracts", () => {
	const campaign = {
		id: "campaign-1",
		name: "Бурштинова брама",
		description: "Місто над прірвою",
		notes: [{ id: "note-1", text: "Стара угода" }],
	};
	const session = {
		name: "Засідання ради",
		data: { scenes: [{ id: "scene-1" }] },
	};
	const encounter = { id: "encounter-1", name: "Засідка" };
	const collections = {
		characters: [{ id: "character-1" }],
		npcs: [{ id: "npc-1" }],
		locations: [{ id: "location-1" }],
	};

	const bestiaryProjection = getAiAssistantContextProjection({
		activeCampaign: campaign,
		activeSession: session,
		activeEncounter: encounter,
		...collections,
		isBestiary: true,
		isCampaign: false,
		isEncounter: false,
		parseAiResponse: true,
		generateEncounters: true,
	});
	assert.equal(bestiaryProjection.sessionName, "Засідання ради");
	assert.equal(bestiaryProjection.campaignContext, null);
	assert.deepEqual(bestiaryProjection.sessionData, {});
	assert.equal(bestiaryProjection.isResponseParsingLocked, true);
	assert.equal(bestiaryProjection.isCustomMonsterGenerationVisible, false);

	const campaignProjection = getAiAssistantContextProjection({
		activeCampaign: campaign,
		activeSession: session,
		...collections,
		isBestiary: false,
		isCampaign: true,
		isEncounter: false,
		parseAiResponse: true,
		generateEncounters: true,
	});
	assert.equal(campaignProjection.sessionName, "Бурштинова брама");
	assert.deepEqual(campaignProjection.campaignContext, {
		description: "Місто над прірвою",
		notes: campaign.notes,
	});
	assert.deepEqual(campaignProjection.sessionData, {
		...campaign,
		...collections,
	});
	assert.equal(campaignProjection.isCustomMonsterGenerationVisible, false);

	const sessionProjection = getAiAssistantContextProjection({
		activeCampaign: campaign,
		activeSession: session,
		...collections,
		isBestiary: false,
		isCampaign: false,
		isEncounter: false,
		parseAiResponse: true,
		generateEncounters: true,
	});
	assert.equal(sessionProjection.sessionName, "Засідання ради");
	assert.deepEqual(sessionProjection.sessionData, session.data);
	assert.equal(sessionProjection.isCustomMonsterGenerationVisible, true);

	const encounterProjection = getAiAssistantContextProjection({
		activeCampaign: campaign,
		activeSession: session,
		activeEncounter: encounter,
		...collections,
		isBestiary: false,
		isCampaign: false,
		isEncounter: true,
		parseAiResponse: true,
		generateEncounters: true,
	});
	assert.deepEqual(encounterProjection.sessionData, encounter);
	assert.equal(encounterProjection.isCustomMonsterGenerationVisible, false);

	assert.deepEqual(
		getAiAssistantContextProjection({
			activeCampaign: "invalid",
			activeSession: { data: [] },
			characters: [],
			npcs: [],
			locations: [],
			isBestiary: false,
			isCampaign: false,
			isEncounter: false,
			parseAiResponse: false,
			generateEncounters: false,
		}),
		{
			sessionName: "",
			campaignContext: { description: "", notes: [] },
			sessionData: {},
			isResponseParsingLocked: false,
			isCustomMonsterGenerationVisible: false,
		},
	);
	const translate = (phrase) => `uk:${phrase}`;
	assert.equal(
		getAiAssistantTitle(
			{
				isBestiary: false,
				isCampaign: false,
				isEncounter: true,
			},
			translate,
		),
		"uk:AI Encounter Assistant",
	);
	assert.equal(
		getAiAssistantPromptPlaceholder(
			{
				isBestiary: false,
				isCampaign: false,
				isEncounter: false,
				parseAiResponse: false,
			},
			translate,
		),
		"uk:Send your request. The response will appear in a dialog and will not change your data.",
	);
	assert.deepEqual(
		getAiAssistantRouteState({
			isBestiary: false,
			navigation: {
				activeCampaignSlug: "бурштинова-брама",
				activeSessionFileName: "session-1.json",
				activeEncounterId: "encounter-1",
			},
			imagePromptBasePrompt: "global image",
			campaignAiBasePrompts: {
				"бурштинова-брама": "campaign story",
			},
			campaignImagePromptBasePrompts: {
				"бурштинова-брама": "campaign image",
			},
		}),
		{
			route: {
				campaign: "бурштинова-брама",
				session: "session-1.json",
				encounter: "encounter-1",
			},
			activeImagePromptBasePrompt: "campaign image",
			activeCampaignBasePrompt: "campaign story",
			isCampaign: false,
			isEncounter: true,
			historyCampaign: "бурштинова-брама",
			assetCampaignSlug: "бурштинова-брама",
			generateEncountersByDefault: true,
		},
	);
	assert.equal(
		getAiAssistantRouteState({
			isBestiary: true,
			navigation: { activeCampaignSlug: "ignored" },
			imagePromptBasePrompt: "global image",
		}).assetCampaignSlug,
		"general",
	);
	assert.deepEqual(
		getAiAssistantContextProjection({
			activeCampaign: {
				description: "Безпечний контекст",
				notes: [{ id: "valid" }, "invalid", null],
			},
			characters: [],
			npcs: [],
			locations: [],
			isBestiary: false,
			isCampaign: true,
			isEncounter: false,
			parseAiResponse: true,
			generateEncounters: false,
		}).campaignContext,
		{
			description: "Безпечний контекст",
			notes: [{ id: "valid" }],
		},
	);
});

await run("AI assistant route state preserves falsy and bestiary target semantics", () => {
	assert.deepEqual(
		getAiAssistantRouteState({
			isBestiary: false,
			navigation: {
				activeCampaignSlug: null,
				activeSessionFileName: "",
				activeEncounterId: 0,
			},
			imagePromptBasePrompt: "global image",
			campaignAiBasePrompts: { "": "root story" },
			campaignImagePromptBasePrompts: { "": "" },
		}),
		{
			route: { campaign: "", session: "", encounter: 0 },
			activeImagePromptBasePrompt: "global image",
			activeCampaignBasePrompt: "root story",
			isCampaign: true,
			isEncounter: false,
			historyCampaign: "",
			assetCampaignSlug: "",
			generateEncountersByDefault: false,
		},
	);

	assert.deepEqual(
		getAiAssistantRouteState({
			isBestiary: false,
			navigation: {
				activeCampaignSlug: "кампанія",
				activeSessionFileName: "session.json",
				activeEncounterId: 7,
			},
			imagePromptBasePrompt: "global image",
			campaignAiBasePrompts: { кампанія: "" },
			campaignImagePromptBasePrompts: { кампанія: "campaign image" },
		}),
		{
			route: {
				campaign: "кампанія",
				session: "session.json",
				encounter: 7,
			},
			activeImagePromptBasePrompt: "campaign image",
			activeCampaignBasePrompt: "",
			isCampaign: false,
			isEncounter: true,
			historyCampaign: "кампанія",
			assetCampaignSlug: "кампанія",
			generateEncountersByDefault: true,
		},
	);

	assert.deepEqual(
		getAiAssistantRouteState({
			isBestiary: true,
			navigation: {
				activeCampaignSlug: "ignored",
				activeSessionFileName: null,
				activeEncounterId: "monster-draft",
			},
			imagePromptBasePrompt: "global image",
			campaignAiBasePrompts: { bestiary: "bestiary story" },
			campaignImagePromptBasePrompts: { bestiary: "bestiary image" },
		}),
		{
			route: {
				campaign: "bestiary",
				session: null,
				encounter: "monster-draft",
			},
			activeImagePromptBasePrompt: "bestiary image",
			activeCampaignBasePrompt: "bestiary story",
			isCampaign: false,
			isEncounter: true,
			historyCampaign: "bestiary",
			assetCampaignSlug: "general",
			generateEncountersByDefault: false,
		},
	);

	const conflictingProjection = getAiAssistantContextProjection({
		activeCampaign: { name: "Кампанія" },
		activeSession: { name: "Сесія", data: { source: "session" } },
		activeEncounter: { source: "encounter" },
		isBestiary: false,
		isCampaign: true,
		isEncounter: true,
		parseAiResponse: true,
		generateEncounters: true,
	});
	assert.equal(conflictingProjection.sessionName, "Кампанія");
	assert.deepEqual(conflictingProjection.sessionData, { source: "encounter" });

	const bestiaryPrecedence = getAiAssistantContextProjection({
		activeCampaign: { name: "Кампанія" },
		activeEncounter: { source: "encounter" },
		isBestiary: true,
		isCampaign: true,
		isEncounter: true,
		parseAiResponse: true,
		generateEncounters: true,
	});
	assert.equal(bestiaryPrecedence.sessionName, "Кампанія");
	assert.deepEqual(bestiaryPrecedence.sessionData, {});
	assert.equal(bestiaryPrecedence.campaignContext, null);
});

await run("AI assistant history policies preserve filtering, diffs, and confirmations", () => {
	const matchingEncounter = {
		id: "matching",
		path: { campaign: "кампанія", session: "session-1", encounter: "enc-1" },
		changes: {
			resources: [
				{
					id: "scene-1",
					kind: "scene",
					before: { title: "До" },
					after: { title: "Після" },
				},
			],
		},
	};
	const entries = [
		{ id: "bestiary", path: { campaign: "bestiary" } },
		matchingEncounter,
		{
			id: "other-encounter",
			path: { campaign: "кампанія", session: "session-1", encounter: "enc-2" },
		},
		{ id: "campaign-response", path: { campaign: "кампанія" } },
	];
	const view = getAiAssistantHistoryView({
		entries,
		selectedEntry: matchingEncounter,
		route: { campaign: "кампанія", session: "session-1", encounter: "enc-1" },
		isBestiary: false,
		labels: {
			note: "Нотатка",
			scene: "Сцена",
			encounter: "Енкаунтер",
			creature: "Істота",
		},
	});
	assert.deepEqual(
		view.visibleEntries.map((entry) => entry.id),
		["matching", "campaign-response"],
	);
	assert.equal(view.hasChanges, true);
	assert.equal(view.diffResources.length, 1);
	assert.equal(view.diffResources[0].id, "scene-1");

	const translate = (phrase) => `uk:${phrase}`;
	assert.deepEqual(getAiHistoryDeleteConfirmation("entry", translate), {
		title: "uk:Delete response",
		message: "uk:Delete this AI response?",
	});
	assert.deepEqual(
		getAiHistoryRestoreConfirmation(
			{ isUndo: true, isPartial: true },
			translate,
		),
		{
			title: "uk:Undo selected AI change",
			message:
				"uk:Undo only this AI change? Newer edits in this resource may be overwritten.",
		},
	);
	assert.deepEqual(
		getAiHistoryRestoreConfirmation(
			{ isUndo: false, isPartial: false },
			translate,
		),
		{
			title: "uk:Apply AI changes",
			message:
				"uk:Restore data to the state after this AI response? Newer edits in these resources may be overwritten.",
		},
	);
	assert.equal(getAiHistoryErrorMessage(new Error("Помилка"), "fallback"), "Помилка");
	assert.equal(getAiHistoryErrorMessage({ message: "unsafe" }, "fallback"), "fallback");
});

await run("AI response modal policies preserve nested draft and preview identity", () => {
	assert.equal(
		getAiResponsePreviewCardType({
			id: "campaign:npcs/коваль",
			kind: "entity",
			type: "npc",
		}),
		"character",
	);
	assert.equal(
		getAiResponsePreviewCardType({
			id: "campaign:locations/брама",
			kind: "entity",
		}),
		"location",
	);
	assert.deepEqual(
		getAiResponseEncounterParticipantEntries([
			{ name: "Вартовий", source: "CUSTOM" },
			{ name: "Вартовий", source: "CUSTOM" },
		]).map((entry) => entry.key),
		[
			"monster:name:вартовий:custom:1",
			"monster:name:вартовий:custom:2",
		],
	);

	const parent = {
		id: "session-1",
		kind: "session",
		after: {
			data: {
				scenes: [
					{ id: "scene-1", title: "До" },
					{ id: "scene-2", title: "Інша" },
				],
			},
		},
	};
	const child = {
		id: "session-1:scenes/scene-1",
		parentResourceId: "session-1",
		kind: "session",
		before: { id: "scene-1", title: "До" },
		after: { id: "scene-1", title: "Після" },
		listIndex: 0,
	};
	assert.deepEqual(getEditedResourceAfterFromParent(parent, child), {
		id: "scene-1",
		title: "До",
	});
	assert.equal(findDraftResourceForPreview([parent], child, true), parent);
	const updated = updateDraftResourceCollection(
		[parent],
		child,
		{ id: "scene-1", title: "Після" },
	);
	assert.deepEqual(updated[0].after.data.scenes, [
		{ id: "scene-1", title: "Після" },
		{ id: "scene-2", title: "Інша" },
	]);
	assert.deepEqual(parent.after.data.scenes[0], {
		id: "scene-1",
		title: "До",
	});
	assert.deepEqual(
		buildAiResponseCardHighlightFields({
			id: "npc-1",
			before: {
				name: "Коваль",
				notes: [{ id: "note-1", title: "Чутка", text: "До" }],
			},
			after: {
				name: "Майстер Коваль",
				notes: [{ id: "note-1", title: "Чутка", text: "Після" }],
			},
		}),
		{
			fields: ["name"],
			notes: { "note-1": ["text"], "Чутка": ["text"] },
		},
	);
	assert.throws(
		() => parseAiResponseSnapshotText("", false, "Чернетка порожня"),
		/Чернетка порожня/,
	);
});

await run("AI assistant presentation preserves history and entity contracts", () => {
	const translate = (phrase, variables = {}) =>
		phrase === "Scene {number}"
			? `Сцена ${variables.number}`
			: phrase === "Untitled"
				? "Без назви"
				: phrase;
	const presentation = createAiAssistantPresentation({
		translate,
		isFailedHistoryEntry: (entry) => entry.status === "failed",
		hasHistoryChanges: (entry) => entry.hasChanges === true,
	});

	assert.equal(
		presentation.getCharacterDisplayName({
			first_name: "  Ірина ",
			lastName: " Штормова ",
		}),
		"Ірина Штормова",
	);
	assert.equal(
		presentation.getCharacterDisplayName({
			firstName: "   ",
			first_name: "Ірина",
			name: "Запасне ім'я",
		}),
		"Запасне ім'я",
	);
	assert.equal(
		presentation.getCharacterDisplayName({ name: "   ", title: "Архіварка" }),
		"",
	);
	assert.equal(
		presentation.getCharacterDisplayName({ firstName: 0, title: "Архіварка" }),
		"Архіварка",
	);
	assert.equal(
		presentation.getCharacterContextKey({ title: "Архіварка" }),
		"Архіварка",
	);
	assert.equal(presentation.getCharacterContextKey({ id: 0 }), "0");
	assert.equal(presentation.getCharacterContextKey({}), "");
	assert.equal(
		presentation.getLocationDisplayName({}),
		"Без назви",
	);
	assert.equal(
		presentation.getSceneImagePromptTitle({ texts: {} }, 2),
		"Сцена 3",
	);
	assert.equal(
		presentation.getSceneImagePromptDescription({
			texts: {
				summary: "Причал",
				goal: "Зупинити корабель",
				stakes: "Місто затопить",
			},
		}),
		"Причал Зупинити корабель Місто затопить",
	);
	assert.equal(
		presentation.getImagePromptPreview(`  ${"буря ".repeat(30)} `).length,
		120,
	);
	assert.equal(
		presentation.stripGeneratedMonsterEditPrompt(
			'Current encounter creature: {"name":"Вартовий","trait":{"text":"каже \\\"стій\\\""}} Зміни обладунок',
		),
		"Зміни обладунок",
	);
	const unicodeMonsterSnapshot = JSON.stringify({
		name: "Мавка {ніч}",
		trait: {
			text: 'каже "стій" і показує } знак',
			path: "C:\\ліс\\мавка",
		},
	});
	assert.equal(
		presentation.stripGeneratedMonsterEditPrompt(
			`Current encounter creature: ${unicodeMonsterSnapshot} Залиши український опис`,
		),
		"Залиши український опис",
	);
	const incompleteMonsterPrompt =
		'Current encounter creature: {"name":"Мавка","trait":{"text":"незавершено }';
	assert.equal(
		presentation.stripGeneratedMonsterEditPrompt(incompleteMonsterPrompt),
		incompleteMonsterPrompt,
	);
	const missingObjectPrompt =
		"Current encounter creature: опис без JSON об'єкта";
	assert.equal(
		presentation.stripGeneratedMonsterEditPrompt(missingObjectPrompt),
		missingObjectPrompt,
	);
	assert.equal(
		presentation.stripGeneratedMonsterEditPrompt(
			"Create a new custom creature based on the selected creature. Do not change the selected creature.  Додай крила",
		),
		"Додай крила",
	);
	assert.equal(
		presentation.getHistoryRequestText({
			retryPayload: { historyUserInstructions: "  Повтори запит  " },
		}),
		"Повтори запит",
	);
	assert.equal(
		presentation.getHistoryRequestText({
			request: { userInstructions: "   " },
			userInstructions: "Не використовувати через truthy precedence",
		}),
		"",
	);
	assert.equal(
		presentation.getHistoryOptionsSummary({
			request: {
				options: {
					mode: "campaign",
					responseParsing: true,
					characterGeneration: true,
					npcGeneration: false,
					locationGeneration: true,
					encounterGeneration: false,
					customMonsterGeneration: true,
					contextEnabled: true,
				},
			},
		}),
		"Mode: AI Story Assistant; Response parsing: On; Create characters: On; Create NPCs: Off; Create locations/factions: On; Encounter generation: Off; Custom monster generation: On; Context: On",
	);
	assert.equal(
		presentation.getHistoryContextSummary({
			request: {
				context: {
					enabled: true,
					campaignNotes: 2,
					campaignCharacters: 1,
					scenes: 3,
				},
			},
		}),
		"Context: Notes: 2, Characters: 1, Scenes: 3",
	);
	assert.equal(
		presentation.getHistoryContextSummary({
			request: { context: { enabled: true } },
		}),
		"Context: Empty",
	);
	assert.equal(
		presentation.getHistoryContextSummary({
			request: { context: { enabled: false, scenes: 3 } },
		}),
		"Context: Off",
	);
	assert.equal(
		presentation.getHistoryOptionsSummary({
			request: {
				options: {
					mode: "невідомий-режим",
					responseParsing: false,
					contextEnabled: false,
				},
			},
		}),
		"Mode: невідомий-режим; Response parsing: Off; Context: Off",
	);
	assert.deepEqual(
		presentation.getHistoryDetailRows({
			createdAt: "not-a-date",
			request: { optionsSummary: "Налаштування" },
		}),
		[{ label: "Settings", value: "Налаштування" }],
	);
	assert.equal(
		presentation.getHistoryTitle({ status: "failed" }),
		"Failed AI request",
	);
	assert.equal(
		presentation.getHistoryTitle({ hasChanges: true }),
		"AI changes",
	);
	assert.equal(
		presentation.getHistoryTitle({ text: "**Готова відповідь**" }),
		"Готова відповідь",
	);
	assert.equal(
		presentation.getAiResponseStateLabel({ applyState: "undone" }),
		"Undone",
	);
	assert.notEqual(presentation.formatResponseDate(0, "en-US"), "");
	let untitledTranslationCalls = 0;
	const lazyFallbackPresentation = createAiAssistantPresentation({
		translate: (phrase) => {
			if (phrase === "Untitled") untitledTranslationCalls += 1;
			return phrase;
		},
		isFailedHistoryEntry: () => false,
		hasHistoryChanges: () => false,
	});
	assert.equal(
		lazyFallbackPresentation.getCharacterDisplayName({ name: "Ірина" }),
		"Ірина",
	);
	assert.equal(untitledTranslationCalls, 0);
	assert.equal(lazyFallbackPresentation.getCharacterDisplayName({}), "Untitled");
	assert.equal(untitledTranslationCalls, 1);
});

await run("AI image prompt picker preserves target and generation policies", () => {
	assert.deepEqual(getImagePromptPickerState({}), {
		isDetailsVisible: false,
		instructionsRequired: false,
		canGenerate: true,
		titleKey: "Choose an element to generate a prompt",
	});
	assert.deepEqual(
		getImagePromptPickerState({
			isContextMode: true,
			request: "  Намалюй штормове узбережжя  ",
		}),
		{
			isDetailsVisible: true,
			instructionsRequired: true,
			canGenerate: true,
			titleKey: "Image prompt",
		},
	);
	assert.equal(
		getImagePromptPickerState({
			isContextMode: true,
			request: "   ",
		}).canGenerate,
		false,
	);
	assert.equal(
		getImagePromptPickerState({
			selectedTarget: { type: "scene", id: 7, name: "Брама" },
			loading: true,
		}).canGenerate,
		false,
	);
	assert.equal(
		getImagePromptItemKey({ id: 0, slug: "вартовий" }, 2, "NPCs"),
		"вартовий",
	);
	assert.equal(
		getImagePromptItemKey({}, 2, "NPCs", "session:npc"),
		"session:npc",
	);
	assert.equal(
		getCustomMonsterPromptDescription({ type: "дракон", cr: "7" }),
		"дракон - CR 7",
	);
	assert.equal(
		getScenePromptItemKey(
			{ _imagePromptSessionFileName: "сесія-1.json", id: "брама" },
			0,
		),
		"сесія-1.json:брама",
	);
	assert.equal(
		getScenePromptDescription(
			{ _imagePromptSessionName: "Шторм" },
			"Бій на причалі",
		),
		"Шторм - Бій на причалі",
	);
	const campaignCollections = getAiImagePromptCollections({
		isCampaign: true,
		currentLanguage: "en",
		sessionData: { npcs: [], locations: [{ id: "local-location" }] },
		npcs: [{ id: "fallback-npc" }],
		locations: [{ id: "fallback-location" }],
		sessions: [
			{
				name: "Storm",
				fileName: "storm.json",
				data: {
					scenes: [{ id: "scene-1" }],
					encounters: [{ id: "encounter-1" }],
				},
			},
		],
		customMonsters: [
			{ name: "Wyvern", imageUrl: "/wyvern.png" },
			{ name: "Drake" },
		],
	});
	assert.deepEqual(campaignCollections.npcs, [{ id: "fallback-npc" }]);
	assert.deepEqual(campaignCollections.locations, [{ id: "local-location" }]);
	assert.equal(campaignCollections.scenes[0]._imagePromptSessionName, "Storm");
	assert.equal(
		campaignCollections.scenes[0]._imagePromptSessionFileName,
		"storm.json",
	);
	assert.deepEqual(
		campaignCollections.customMonstersWithoutImages.map((monster) => monster.name),
		["Drake"],
	);
	assert.deepEqual(
		campaignCollections.customMonstersWithImages.map((monster) => monster.name),
		["Wyvern"],
	);
	assert.deepEqual(
		buildAiImagePromptGenerationPlan(null, "  Painterly  ", "   "),
		{
			errorKey:
				"Image prompt instructions are required when no element is selected.",
			targetSceneId: null,
			options: {
				imageTarget: null,
				imagePromptBasePromptOverride: "Painterly",
				userInstructionsOverride: "",
			},
		},
	);
	assert.deepEqual(
		buildAiImagePromptGenerationPlan(
			null,
			"  Watercolor  ",
			"  Намалюй мавку  ",
		),
		{
			errorKey: null,
			targetSceneId: null,
			options: {
				imageTarget: null,
				imagePromptBasePromptOverride: "Watercolor",
				userInstructionsOverride: "Намалюй мавку",
			},
		},
	);
	const sceneTarget = {
		type: "scene",
		id: "scene-1",
		name: "Gate",
		sessionName: "Storm",
	};
	assert.equal(getImagePromptTargetTitle(sceneTarget), "Gate - Storm");
	assert.deepEqual(
		buildAiImagePromptGenerationPlan(sceneTarget, " Ink ", "ignored"),
		{
			errorKey: null,
			targetSceneId: "scene-1",
			options: {
				imageTarget: sceneTarget,
				imagePromptBasePromptOverride: "Ink",
				userInstructionsOverride: "",
			},
		},
	);
	const zeroSceneTarget = {
		type: "scene",
		id: 0,
		name: "Нульова сцена",
	};
	assert.deepEqual(
		buildAiImagePromptGenerationPlan(zeroSceneTarget, "  Etching  ", "skip"),
		{
			errorKey: null,
			targetSceneId: null,
			options: {
				imageTarget: zeroSceneTarget,
				imagePromptBasePromptOverride: "Etching",
				userInstructionsOverride: "",
			},
		},
	);
	const unnamedNpcTarget = {
		type: "npc",
		id: 0,
		name: "",
	};
	assert.equal(getImagePromptTargetTitle(unnamedNpcTarget), "npc");
	assert.equal(
		buildAiImagePromptGenerationPlan(unnamedNpcTarget, "", "ignored")
			.targetSceneId,
		null,
	);
	assert.equal(
		getImagePromptTargetTitle({
			type: "scene",
			id: "scene-empty-name",
			name: "",
			sessionName: "Шторм",
		}),
		" - Шторм",
	);
	assert.equal(
		getImagePromptTargetTitle({
			type: "scene",
			id: "scene-id",
			name: "",
		}),
		"scene-id",
	);
	assert.equal(
		getImagePromptTargetTitle({
			type: "location",
			id: "location-id",
			name: "  ",
		}),
		"  ",
	);
	assert.equal(getImagePromptTargetTitle(null), "");
	assert.equal(getImagePromptTargetTitle(undefined), "");
});

await run("sidebar keeps campaign navigation and ordering policies stable", () => {
	const activeCampaign = {
		slug: "буря-на-морі",
		name: "Буря на морі",
		sessionCount: 3,
	};
	const completedCampaign = {
		slug: "завершена",
		name: "Завершена кампанія",
		completed: true,
	};
	const secondActiveCampaign = {
		slug: "підземелля",
		name: "Підземелля",
	};
	const groups = groupSidebarCampaigns([
		activeCampaign,
		completedCampaign,
		secondActiveCampaign,
	]);

	assert.deepEqual(groups, {
		active: [activeCampaign, secondActiveCampaign],
		completed: [completedCampaign],
	});
	assert.deepEqual(
		mergeSidebarCampaignGroup(groups, "active", [
			secondActiveCampaign,
			activeCampaign,
		]),
		[secondActiveCampaign, activeCampaign, completedCampaign],
	);
	assert.deepEqual(
		mergeSidebarCampaignGroup(groups, "completed", [completedCampaign]),
		[activeCampaign, secondActiveCampaign, completedCampaign],
	);
	assert.deepEqual(
		buildSidebarCampaignOrder([
			secondActiveCampaign,
			activeCampaign,
			completedCampaign,
		]),
		{ "підземелля": 0, "буря-на-морі": 1, "завершена": 2 },
	);
	assert.equal(
		getSidebarCampaignSelection({
			campaignSlug: activeCampaign.slug,
			activeCampaignSlug: activeCampaign.slug,
		}),
		"",
	);
	assert.equal(
		getSidebarCampaignSelection({
			campaignSlug: activeCampaign.slug,
			activeCampaignSlug: activeCampaign.slug,
			activeSessionFileName: "session-1.json",
		}),
		activeCampaign.slug,
	);
	assert.equal(
		getSidebarCampaignSelection({
			campaignSlug: activeCampaign.slug,
			activeCampaignSlug: activeCampaign.slug,
			activeEncounterId: 0,
		}),
		"",
	);
	assert.equal(getSidebarClassName(true, false), "Sidebar App__sidebar Sidebar__hovered");
	assert.equal(
		getSidebarClassName(false, true),
		"Sidebar App__sidebar Sidebar__mobile_open",
	);
	assert.equal(isSidebarToggleKey("Enter"), true);
	assert.equal(isSidebarToggleKey(" "), true);
	assert.equal(isSidebarToggleKey("Escape"), false);
	assert.equal(
		getSidebarErrorMessage(new Error("Помилка архіву"), "Невідома помилка"),
		"Помилка архіву",
	);
	assert.equal(
		getSidebarErrorMessage({ message: "небезпечне поле" }, "Невідома помилка"),
		"Невідома помилка",
	);
});

await run("rules reference modal owns spells and bestiary navigation", async () => {
	const embeddedPropPattern = new RegExp("is" + "Embedded");
	const mainContentSource = await fs.readFile(
		"src/app/routing/MainContent.tsx",
		"utf8",
	);
	const sidebarSource = await fs.readFile(
		"src/widgets/sidebar/ui/Sidebar.tsx",
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
	const appStoreSource = (
		await Promise.all(
			[
				"src/shared/model/appStore.ts",
				"src/shared/model/workflowReducer.ts",
				"src/shared/model/rulesReferenceWorkflowReducer.ts",
			].map((file) => fs.readFile(file, "utf8")),
		)
	).join("\n");
	const aiAssistantSource = await fs.readFile(
		"src/widgets/ai-assistant/ui/AiAssistantPanel.tsx",
		"utf8",
	);
	const aiUpdatedDataWorkflowSource = await fs.readFile(
		"src/features/ai/model/updatedDataWorkflow.ts",
		"utf8",
	);
	const aiAssistantContextSource = await fs.readFile(
		"src/widgets/ai-assistant/model/assistantContext.ts",
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
	assert.match(bestiarySource, /getBestiarySyncEventPlan\(syncEvent\)/);
	assert.match(bestiarySource, /executeBestiarySyncEventPlan\(\{/);
	assert.match(bestiarySource, /executeBestiaryFieldEditSave\(\{/);
	assert.match(bestiarySource, /executeBestiarySelectedSourcesSave\(\{/);
	assert.match(bestiaryModelSource, /function applyBestiarySyncPendingSelection/);
	assert.match(bestiaryModelSource, /event\.monsterName/);
	assert.match(bestiaryModelSource, /event\.monsterSource \|\| "CUSTOM"/);
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
	assert.match(bestiaryContentSource, /getBestiaryDetailPresentation\(/);
	assert.match(
		bestiaryContentSource,
		/showAddToEncounterPicker=\{presentation\.showAddToEncounterPicker\}/,
	);
	assert.match(bestiaryModelSource, /showAddToEncounterPicker: Boolean\(onAddMonster\)/);
	assert.doesNotMatch(spellsSource, embeddedPropPattern);
	assert.doesNotMatch(spellsSource, /useSearchParams/);
	assert.doesNotMatch(spellsSource, /next\.set\("spell"/);
	assert.doesNotMatch(spellsSource, /next\.set\("s_source"/);
	assert.match(spellsSource, /getInitialSpellSelection\(displayedSpells, allSpells/);
	assert.match(rulesReferenceSource, /tabId === "spells"/);
	assert.match(rulesReferenceSource, /recordEmbeddedReferenceSelection/);
	assert.match(rulesReferenceSource, /recordNavigation\(tabId, name\)/);
	assert.match(rulesReferenceSource, /recordRulesReferenceHistoryEntry/);
	assert.match(rulesReferenceSource, /setRulesReferenceHistoryIndex/);
	assert.match(rulesReferenceSource, /applyTabOnlyNavigation/);
	assert.match(rulesReferenceSource, /getReferenceNavigationRequestPlan/);
	assert.match(rulesReferenceSource, /normalizedRequest\.forceTab/);
	assert.match(rulesReferenceSource, /getReferenceInitialNavigationPlan/);
	assert.match(rulesReferenceSource, /Boolean\(initialName\)/);
	assert.doesNotMatch(rulesReferenceSource, /setNavigationHistory/);
	assert.match(rulesReferenceSource, /onActiveSpellChange/);
	assert.doesNotMatch(rulesReferenceSource, /onActiveMonsterChange/);
	assert.match(rulesReferenceSource, /getCreatureReferenceName/);
	assert.match(rulesReferenceSource, /itemMatchesSelectedName/);
	assert.match(
		rulesReferenceHostSource,
		/handledRequestIdRef\.current = plan\.requestId;\s*if \(!plan\.shouldOpen\) return;/,
	);
	assert.match(appStoreSource, /rulesReference:[\s\S]*history:[\s\S]*entries: \[\]/);
	assert.match(appActionsSource, /forceTab: Boolean\(options\.forceTab\)/);
	assert.match(appStoreSource, /RECORD_RULES_REFERENCE_HISTORY_ENTRY/);
	assert.match(appStoreSource, /SET_RULES_REFERENCE_HISTORY_INDEX/);
	assert.match(aiAssistantSource, /historyCampaign: aiHistoryCampaign/);
	assert.match(
		aiAssistantContextSource,
		/historyCampaign: isBestiary \? "bestiary" : route\.campaign/,
	);
	assert.match(aiAssistantContextSource, /getAiAssistantRouteTargets/);
	assert.match(aiAssistantSource, /getAiAssistantRouteState/);
	assert.match(aiAssistantSource, /buildAiUpdatedDataPlan/);
	assert.match(aiAssistantSource, /executeAiUpdatedDataPlan/);
	assert.doesNotMatch(aiAssistantSource, /resource: "custom-bestiary"/);
	assert.match(aiUpdatedDataWorkflowSource, /resource: "custom-bestiary"/);
	assert.match(aiUpdatedDataWorkflowSource, /monsterName/);
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

await run(
	"AI patch service normalizes character aliases updates and malformed notes",
	async () => {
		await withTestSlug("ai-character-normalization", async (slug) => {
			await storage.writeJson(storage.campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Нормалізація персонажів",
				description: "",
				notes: [],
			});
			await storage.writeEntity(slug, "characters", "keeper", {
				id: "keeper-id",
				slug: "keeper",
				firstName: "Стара",
				lastName: "Варта",
				race: "Людина",
				class: "Воїн",
				level: 7,
				motivation: "Стара мета",
				description: "Старий опис",
				trait: "Обережна",
				notes: [
					{
						id: "visible-note",
						title: "Видима",
						text: "Старий текст",
						collapsed: true,
					},
					{
						id: "ignored-note",
						title: "Прихована",
						text: "Не змінювати",
						collapsed: false,
						_aiIgnored: true,
					},
				],
				collapsed: true,
				isNotesCollapsed: true,
				imageUrl: "/old-character.png",
			});
			await storage.writeEntity(slug, "characters", "malformed", {
				id: "malformed-id",
				slug: "malformed",
				firstName: "Зламана",
				lastName: "Нотатка",
				notes: { text: "not-an-array" },
			});
			await storage.writeEntity(slug, "characters", "clear-name", {
				id: "clear-id",
				slug: "clear-name",
				firstName: "Очистити",
				lastName: "Ім'я",
				race: "Дворф",
				notes: [],
			});

			const inheritedData = Object.create({
				race: "Успадкована раса",
				role: "Успадкована роль",
			});
			inheritedData.name = "Власне Поле";

			const result = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "update",
							entity: "character",
							id: "keeper-id",
							patch: {
								level: "",
								motivation: 0,
								description: null,
								trait: false,
								notes: [
									{
										id: "visible-note",
										title: "Оновлений заголовок",
										text: "Оновлений текст",
										collapsed: false,
									},
								],
								collapsed: false,
								isNotesCollapsed: false,
								imageUrl: "/replacement.png",
							},
						},
						{
							op: "update",
							entity: "character",
							id: "malformed-id",
							patch: { trait: "Стійка" },
						},
						{
							op: "update",
							entity: "character",
							id: "clear-id",
							patch: { firstName: "", lastName: "" },
						},
						{
							op: "create",
							entity: "character",
							data: {
								name: "Марія Коваль",
								species: "Ельф",
								role: "Маг",
								level: 0,
								goal: 0,
								backstory: null,
								quirk: false,
								notes: "not-an-array",
								collapsed: "yes",
								isNotesCollapsed: 0,
								imageUrl: "/maria.png",
							},
						},
						{
							op: "create",
							entity: "character",
							data: {
								first_name: "Олена",
								last_name: "Ніч",
								race: "Людина",
								species: "Ельф",
								class: "Воїн",
								role: "Маг",
								motivation: "Канонічна мета",
								goal: "Аліас мети",
								description: "Канонічний опис",
								bio: "Аліас опису",
								trait: "Канонічна риса",
								personality: "Аліас риси",
								level: "",
								notes: [{ title: "Заголовок", text: "Текст" }],
							},
						},
						{
							op: "create",
							entity: "character",
							data: inheritedData,
						},
					],
				},
				campaignSlug: slug,
				simplifiedNotes: true,
				permissions: { allowCharacters: true },
			});

			const characters = await storage.listEntities(slug, "characters");
			const byId = new Map(characters.map((character) => [character.id, character]));
			const keeper = byId.get("keeper-id");
			assert.equal(keeper.firstName, "Стара");
			assert.equal(keeper.lastName, "Варта");
			assert.equal(keeper.race, "Людина");
			assert.equal(keeper.class, "Воїн");
			assert.equal(keeper.level, "");
			assert.equal(keeper.motivation, "0");
			assert.equal(keeper.description, "");
			assert.equal(keeper.trait, "false");
			assert.equal(keeper.collapsed, true);
			assert.equal(keeper.isNotesCollapsed, true);
			assert.equal(keeper.imageUrl, "/old-character.png");
			assert.deepEqual(
				keeper.notes.map((note) => note.id),
				["visible-note", "ignored-note"],
			);
			assert.equal(keeper.notes[0].title, "");
			assert.equal(keeper.notes[0].text, "Оновлений текст");
			assert.equal(keeper.notes[0].collapsed, true);
			assert.equal(keeper.notes[1]._aiIgnored, true);
			assert.equal(keeper.notes[1].title, "Прихована");

			const malformed = byId.get("malformed-id");
			assert.equal(malformed.trait, "Стійка");
			assert.equal(Array.isArray(malformed.notes), true);
			assert.equal(malformed.notes.length, 1);
			assert.equal(malformed.notes[0].text, "");

			const cleared = byId.get("clear-id");
			assert.equal(cleared.firstName, "");
			assert.equal(cleared.lastName, "");
			assert.equal(cleared.race, "Дворф");

			const maria = characters.find(
				(character) => character.firstName === "Марія",
			);
			assert.ok(maria.id);
			assert.equal(maria.lastName, "Коваль");
			assert.equal(maria.race, "Ельф");
			assert.equal(maria.class, "Маг");
			assert.equal(maria.level, 1);
			assert.equal(maria.motivation, "0");
			assert.equal(maria.description, "");
			assert.equal(maria.trait, "false");
			assert.equal(maria.notes.length, 1);
			assert.equal(maria.collapsed, true);
			assert.equal(maria.isNotesCollapsed, false);
			assert.equal(maria.imageUrl, "/maria.png");

			const olena = characters.find(
				(character) => character.firstName === "Олена",
			);
			assert.equal(olena.lastName, "Ніч");
			assert.equal(olena.race, "Людина");
			assert.equal(olena.class, "Воїн");
			assert.equal(olena.motivation, "Канонічна мета");
			assert.equal(olena.description, "Канонічний опис");
			assert.equal(olena.trait, "Канонічна риса");
			assert.equal(olena.level, "");
			assert.equal(olena.notes[0].title, "");

			const ownOnly = characters.find(
				(character) => character.firstName === "Власне",
			);
			assert.equal(ownOnly.lastName, "Поле");
			assert.equal(ownOnly.race, "");
			assert.equal(ownOnly.class, "");
			assert.deepEqual(result.warnings, []);
		});
	},
);

await run(
	"AI patch service normalizes location aliases malformed notes and scope moves",
	async () => {
		await withTestSlug("ai-location-normalization", async (slug) => {
			await storage.ensureDir(path.join(storage.campaignDir(slug), "sessions"));
			await storage.writeJson(storage.campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Нормалізація локацій",
				description: "",
				notes: [],
			});
			await storage.writeEntity(slug, "locations", "old-archive", {
				id: "archive-id",
				slug: "old-archive",
				name: "Старий Архів",
				description: "Старий опис",
				notes: [
					{
						id: "visible-location-note",
						title: "Видима",
						text: "Старий текст",
						collapsed: true,
					},
					{
						id: "ignored-location-note",
						title: "Прихована",
						text: "Не змінювати",
						collapsed: false,
						_aiIgnored: true,
					},
				],
				collapsed: true,
				isNotesCollapsed: true,
				imageUrl: "/old-location.png",
			});
			await storage.writeEntity(slug, "locations", "malformed-location", {
				id: "malformed-location-id",
				slug: "malformed-location",
				name: "Зламані Нотатки",
				description: "До оновлення",
				notes: { text: "not-an-array" },
			});
			await storage.writeEntity(slug, "locations", "clear-location", {
				id: "clear-location-id",
				slug: "clear-location",
				name: "Очистити Локацію",
				description: "Очистити опис",
				notes: [],
			});
			await storage.writeEntity(slug, "locations", "moving-tower", {
				id: "campaign-moving-id",
				slug: "moving-tower",
				name: "Перехідна Вежа",
				description: "Кампанійна версія",
				notes: [{ id: "campaign-move-note", text: "З кампанії" }],
			});
			await storage.writeJson(storage.sessionPath(slug, "session.json"), {
				id: "session-id",
				name: "Сесія",
				data: {
					scenes: [],
					encounters: [],
					notes: [],
					npcs: [],
					locations: [
						{
							id: "session-moving-id",
							slug: "moving-tower",
							name: "Перехідна Вежа",
							description: "Сесійна версія",
							notes: [{ id: "session-move-note", text: "Із сесії" }],
						},
					],
				},
			});

			const inheritedData = Object.create({
				title: "Успадкована назва",
				summary: "Успадкований опис",
			});
			inheritedData.name = "Власна Локація";

			const result = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "update",
							entity: "location",
							scope: "campaign",
							id: "archive-id",
							patch: {
								name: "  [[Новий   Архів]]  ",
								description: 0,
								notes: [
									{
										id: "visible-location-note",
										title: "Оновлено",
										text: "Новий текст",
										collapsed: false,
									},
								],
								collapsed: false,
								isNotesCollapsed: false,
								imageUrl: "/replacement-location.png",
							},
						},
						{
							op: "update",
							entity: "location",
							scope: "campaign",
							id: "malformed-location-id",
							patch: { description: false },
						},
						{
							op: "update",
							entity: "location",
							scope: "campaign",
							id: "clear-location-id",
							patch: { name: "", description: null },
						},
						{
							op: "create",
							entity: "location",
							scope: "campaign",
							data: {
								title: " [Тиха   Гавань] ",
								summary: 7,
								notes: "not-an-array",
								collapsed: "yes",
								isNotesCollapsed: 0,
								imageUrl: "/harbor.png",
							},
						},
						{
							op: "create",
							entity: "location",
							scope: "campaign",
							data: {
								name: "Канонічна Назва",
								title: "Аліас Назви",
								description: "Канонічний опис",
								summary: "Аліас опису",
								notes: [{ title: "Заголовок", text: "Текст" }],
							},
						},
						{
							op: "create",
							entity: "location",
							scope: "campaign",
							data: inheritedData,
						},
						{
							op: "create",
							entity: "faction",
							scope: "session",
							data: { title: "Сесійна Фракція", text: false },
						},
						{
							op: "moveScope",
							entity: "location",
							id: "campaign-moving-id",
							from: "campaign",
							to: "session",
						},
					],
				},
				campaignSlug: slug,
				sessionFile: "session.json",
				entityScope: "mixed",
				simplifiedNotes: true,
				permissions: { allowLocations: true },
			});

			const campaignLocations = await storage.listEntities(slug, "locations");
			const campaignById = new Map(
				campaignLocations.map((location) => [location.id, location]),
			);
			const archive = campaignById.get("archive-id");
			assert.equal(archive.name, "Новий Архів");
			assert.equal(archive.description, "0");
			assert.equal(archive.collapsed, true);
			assert.equal(archive.isNotesCollapsed, true);
			assert.equal(archive.imageUrl, "/old-location.png");
			assert.deepEqual(
				archive.notes.map((note) => note.id),
				["visible-location-note", "ignored-location-note"],
			);
			assert.equal(archive.notes[0].title, "");
			assert.equal(archive.notes[0].text, "Новий текст");
			assert.equal(archive.notes[0].collapsed, true);
			assert.equal(archive.notes[1]._aiIgnored, true);
			assert.equal(archive.notes[1].title, "Прихована");

			const malformed = campaignById.get("malformed-location-id");
			assert.equal(malformed.description, "false");
			assert.equal(Array.isArray(malformed.notes), true);
			assert.equal(malformed.notes.length, 1);
			assert.equal(malformed.notes[0].text, "");

			const cleared = campaignById.get("clear-location-id");
			assert.equal(cleared.name, "");
			assert.equal(cleared.description, "");

			const harbor = campaignLocations.find(
				(location) => location.name === "Тиха Гавань",
			);
			assert.ok(harbor.id);
			assert.equal(harbor.description, "7");
			assert.equal(harbor.notes.length, 1);
			assert.equal(harbor.collapsed, true);
			assert.equal(harbor.isNotesCollapsed, false);
			assert.equal(harbor.imageUrl, "/harbor.png");

			const canonical = campaignLocations.find(
				(location) => location.name === "Канонічна Назва",
			);
			assert.equal(canonical.description, "Канонічний опис");
			assert.equal(canonical.notes[0].title, "");

			const ownOnly = campaignLocations.find(
				(location) => location.name === "Власна Локація",
			);
			assert.equal(ownOnly.description, "");
			assert.equal(campaignById.has("campaign-moving-id"), false);

			const session = await storage.readSession(slug, "session.json");
			const moved = session.data.locations.find(
				(location) => location.name === "Перехідна Вежа",
			);
			assert.equal(moved.id, "session-moving-id");
			assert.equal(moved.description, "Кампанійна версія");
			assert.equal(moved.notes[0].id, "campaign-move-note");
			const faction = session.data.locations.find(
				(location) => location.name === "Сесійна Фракція",
			);
			assert.equal(faction.description, "false");
			assert.ok(
				result.warnings.some((warning) =>
					warning.includes("Replaced duplicate session locations during moveScope"),
				),
			);
		});
	},
);

await run(
	"AI patch service persists campaign note lifecycles through one entity cache",
	async () => {
		await withTestSlug("ai-campaign-note-lifecycle", async (slug) => {
			await storage.writeJson(storage.campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Нотатки кампанії",
				description: "",
				notes: [],
			});
			await storage.writeEntity(slug, "npc", "mira", {
				id: "npc-1",
				slug: "mira",
				firstName: "Міра",
				lastName: "",
				notes: [],
			});

			const originalListEntities = storage.listEntities;
			const originalWriteEntity = storage.writeEntity;
			let listCalls = 0;
			let entityWrites = 0;
			storage.listEntities = async (...args) => {
				listCalls += 1;
				return originalListEntities(...args);
			};
			storage.writeEntity = async (...args) => {
				entityWrites += 1;
				return originalWriteEntity(...args);
			};
			try {
				await aiPatchService.applyAiOperations({
					payload: {
						operations: [
							{
								op: "appendNote",
								entity: "campaign",
								note: {
									id: "campaign-note",
									title: "План",
									text: "Зберегти місто.",
								},
							},
							{
								op: "appendNote",
								entity: "npc",
								scope: "campaign",
								id: "npc-1",
								note: {
									id: "kept-note",
									title: "Таємниця",
									text: "Старий текст.",
								},
							},
							{
								op: "updateNote",
								entity: "npc",
								scope: "campaign",
								id: "npc-1",
								noteId: "kept-note",
								patch: { title: "Оновлено", text: "Новий текст." },
							},
							{
								op: "appendNote",
								entity: "npc",
								scope: "campaign",
								id: "npc-1",
								note: { id: "deleted-note", text: "Видалити мене." },
							},
							{
								op: "deleteNote",
								entity: "npc",
								scope: "campaign",
								id: "npc-1",
								noteId: "deleted-note",
							},
							{
								op: "appendNote",
								entity: "npc",
								scope: "campaign",
								id: "missing-npc",
								note: { text: "Не застосовувати." },
							},
						],
					},
					campaignSlug: slug,
					simplifiedNotes: true,
				});
			} finally {
				storage.listEntities = originalListEntities;
				storage.writeEntity = originalWriteEntity;
			}

			const campaign = await storage.readCampaign(slug);
			const [npc] = await storage.listEntities(slug, "npc");
			assert.equal(campaign.notes.length, 1);
			assert.equal(campaign.notes[0].title, "");
			assert.equal(campaign.notes[0].text, "Зберегти місто.");
			assert.equal(npc.notes.length, 1);
			assert.equal(npc.notes[0].id, "kept-note");
			assert.equal(npc.notes[0].title, "");
			assert.equal(npc.notes[0].text, "Новий текст.");
			assert.equal(listCalls, 1);
			assert.equal(entityWrites, 4);
		});
	},
);

await run(
	"AI patch service resolves session entity and scene note client IDs",
	async () => {
		await withTestSlug("ai-session-note-client-ids", async (slug) => {
			await storage.ensureDir(path.join(storage.campaignDir(slug), "sessions"));
			await storage.writeJson(storage.campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Сесійні нотатки",
				description: "",
				notes: [],
			});
			await storage.writeJson(storage.sessionPath(slug, "session.json"), {
				id: "session-id",
				name: "Сесія",
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
					operations: [
						{
							op: "create",
							entity: "npc",
							scope: "session",
							clientId: "new-npc",
							data: { name: "Вартова Лада" },
						},
						{
							op: "appendNote",
							entity: "npc",
							targetClientId: "new-npc",
							note: { text: "Чула дзвони вночі." },
						},
						{
							op: "create",
							entity: "scene",
							clientId: "new-scene",
							data: { texts: { summary: "Розмова біля брами." } },
						},
						{
							op: "appendNote",
							entity: "scene",
							targetClientId: "new-scene",
							note: { text: "Показати зламаний амулет." },
						},
						{
							op: "appendNote",
							entity: "session",
							note: { text: "Почати без затримки." },
						},
						{
							op: "appendNote",
							entity: "location",
							id: "missing-location",
							note: { text: "Не застосовувати." },
						},
					],
				},
				campaignSlug: slug,
				sessionFile: "session.json",
				entityScope: "session",
				permissions: { allowNpcs: true, allowLocations: true },
			});

			const session = await storage.readSession(slug, "session.json");
			assert.equal(result.updated.fileName, "session.json");
			assert.ok(
				session.data.npcs[0].notes.some(
					(note) => note.text === "Чула дзвони вночі.",
				),
			);
			assert.ok(
				session.data.scenes[0].notes.some(
					(note) => note.text === "Показати зламаний амулет.",
				),
			);
			assert.equal(session.data.notes[0].text, "Почати без затримки.");
			assert.equal(session.data.locations.length, 0);
		});
	},
);

await run(
	"AI patch service applies ordered custom Bestiary mutations with ID precedence",
	async () => {
		const originalRead = storage.readCustomBestiaryMonsters;
		const originalWrite = storage.writeCustomBestiaryMonsters;
		const existing = [
			{ id: "name-first", name: "Назва-ціль", source: "CUSTOM", cr: "1" },
			{ id: "id-target", name: "ID ціль", source: "CUSTOM", cr: "2" },
			{ id: "delete-id", name: "Видалити", source: "CUSTOM", cr: "3" },
			{ id: "duplicate-id", name: "Дубль", source: "CUSTOM", cr: "1" },
		];
		const writes = [];
		storage.readCustomBestiaryMonsters = async () => existing;
		storage.writeCustomBestiaryMonsters = async (monsters) => {
			writes.push(monsters.map((monster) => ({ ...monster })));
			return [...monsters].sort((left, right) =>
				left.name.localeCompare(right.name),
			);
		};

		let result;
		try {
			result = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "update",
							entity: "monster",
							id: "id-target",
							targetName: "Назва-ціль",
							patch: { name: "ID оновлено", cr: "7" },
						},
						{
							op: "delete",
							entity: "custom-monster",
							targetName: "ВИДАЛИТИ",
						},
						{
							op: "create",
							entity: "custommonster",
							data: { id: "client-id", name: "Дубль", cr: "4" },
						},
						{
							op: "create",
							entity: "monster",
							data: { name: "" },
						},
						{
							op: "update",
							entity: "monster",
							targetId: "missing-id",
							patch: { name: "Не застосовувати" },
						},
						{
							op: "delete",
							entity: "monster",
							targetName: "Відсутній",
						},
					],
				},
				campaignSlug: "bestiary",
			});
		} finally {
			storage.readCustomBestiaryMonsters = originalRead;
			storage.writeCustomBestiaryMonsters = originalWrite;
		}

		assert.equal(writes.length, 1);
		assert.deepEqual(
			writes[0].map((monster) => monster.name),
			["Назва-ціль", "ID оновлено", "Дубль"],
		);
		assert.equal(writes[0][0].id, "name-first");
		assert.equal(writes[0][0].cr, "1");
		assert.equal(writes[0][1].id, "id-target");
		assert.equal(writes[0][1].cr, "7");
		assert.notEqual(writes[0][2].id, "client-id");
		assert.notEqual(writes[0][2].id, "duplicate-id");
		assert.equal(result.customBestiaryChange.hasChanges, true);
		assert.deepEqual(
			result.changedMonsters.map((monster) => monster.name),
			["ID оновлено", "Дубль"],
		);
		assert.deepEqual(result.updated.monsters, result.customBestiaryChange.after);
		assert.deepEqual(result.customBestiaryChange.before, existing);
	},
);

await run(
	"AI patch service materializes missing monster IDs before a no-op batch",
	async () => {
		const originalRead = storage.readCustomBestiaryMonsters;
		const originalWrite = storage.writeCustomBestiaryMonsters;
		const writes = [];
		storage.readCustomBestiaryMonsters = async () => [
			{ name: "Звір без ID", source: "CUSTOM", cr: "1" },
		];
		storage.writeCustomBestiaryMonsters = async (monsters) => {
			const materialized = monsters.map((monster) => ({
				...monster,
				id: monster.id || "materialized-id",
			}));
			writes.push(materialized);
			return materialized;
		};

		let result;
		try {
			result = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "update",
							entity: "monster",
							targetId: "missing-id",
							patch: { cr: "9" },
						},
						{ op: "unsupported", entity: "monster" },
					],
				},
				campaignSlug: "bestiary",
			});
		} finally {
			storage.readCustomBestiaryMonsters = originalRead;
			storage.writeCustomBestiaryMonsters = originalWrite;
		}

		assert.equal(writes.length, 2);
		assert.equal(writes[0][0].id, "materialized-id");
		assert.equal(writes[1][0].id, "materialized-id");
		assert.equal(result.customBestiaryChange.before[0].id, "materialized-id");
		assert.equal(result.customBestiaryChange.hasChanges, false);
		assert.deepEqual(result.changedMonsters, []);
		assert.equal(result.updated, null);
	},
);

await run(
	"AI patch service applies scene lifecycle policies and client-ID notes",
	async () => {
		await withTestSlug("ai-scene-lifecycle", async (slug) => {
			await storage.ensureDir(path.join(storage.campaignDir(slug), "sessions"));
			await storage.writeJson(storage.campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Сцени",
				description: "",
				notes: [],
			});
			await storage.writeJson(storage.sessionPath(slug, "session.json"), {
				id: "session-id",
				name: "Сесія",
				data: {
					scenes: [
						{
							id: "scene-keep",
							texts: {
								summary: "Старий вступ.",
								goal: "Стара мета.",
								stakes: "Старі ставки.",
								location: "Стара брама.",
							},
							notes: [],
							npcs: [],
							collapsed: true,
							isNotesCollapsed: true,
							encounterId: "old-encounter",
							imageUrl: "/old-scene.png",
						},
						{
							id: "scene-delete",
							texts: { summary: "Видалити." },
							notes: [],
							npcs: [],
						},
					],
					encounters: [],
					notes: [],
					npcs: [],
					locations: [],
				},
			});

			const result = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "update",
							entity: "scene",
							id: "scene-keep",
							patch: {
								id: "replacement-id",
								texts: { summary: "Оновлений вступ." },
								notes: [
									{ id: "scene-note", title: "Підказка", text: "Знайти ключ." },
								],
								npcs: [
									"Лада",
									{ name: "Тарас", description: "Чекає біля воріт." },
								],
								encounterId: "direct-encounter",
								imageUrl: "/new-scene.png",
							},
						},
						{
							op: "create",
							entity: "scene",
							clientId: "created-scene",
							data: {
								notes: [
									{ id: "created-note", title: "Початок", text: "Почати тихо." },
								],
							},
						},
						{
							op: "appendNote",
							entity: "scene",
							targetClientId: "created-scene",
							note: { id: "linked-note", title: "Шум", text: "Потім дзвони." },
						},
						{ op: "delete", entity: "scene", id: "scene-delete" },
						{ op: "update", entity: "scene", id: "missing", patch: {} },
						{ op: "delete", entity: "scene", id: "missing" },
						{ op: "unsupported", entity: "scene" },
					],
				},
				campaignSlug: slug,
				sessionFile: "session.json",
				entityScope: "session",
				simplifiedNotes: true,
				permissions: { allowEncounters: true },
			});

			const session = await storage.readSession(slug, "session.json");
			assert.equal(result.updated.fileName, "session.json");
			assert.equal(session.data.scenes.length, 2);
			const updated = session.data.scenes[0];
			const created = session.data.scenes[1];
			assert.equal(updated.id, "scene-keep");
			assert.equal(updated.texts.summary, "Оновлений вступ.");
			assert.equal(updated.texts.goal, "Стара мета.");
			assert.equal(updated.texts.stakes, "Старі ставки.");
			assert.equal(updated.texts.location, "Стара брама.");
			assert.equal(updated.imageUrl, "/old-scene.png");
			assert.equal(updated.encounterId, "direct-encounter");
			assert.equal(updated.collapsed, true);
			assert.equal(updated.isNotesCollapsed, true);
			assert.equal(updated.notes[0].title, "");
			assert.deepEqual(updated.npcs, [
				{ name: "Лада", description: "" },
				{ name: "Тарас", description: "Чекає біля воріт." },
			]);
			assert.deepEqual(created.texts, {
				summary: "",
				goal: "",
				stakes: "",
				location: "",
			});
			assert.deepEqual(
				created.notes.map((note) => [note.title, note.text]),
				[["", "Почати тихо."], ["", "Потім дзвони."]],
			);
			assert.deepEqual(result.warnings, []);
		});
	},
);

await run(
	"AI patch service projects scene texts and evaluates every content branch",
	async () => {
		await withTestSlug("ai-scene-content-policies", async (slug) => {
			await storage.ensureDir(path.join(storage.campaignDir(slug), "sessions"));
			await storage.writeJson(storage.campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Політики вмісту сцен",
				description: "",
				notes: [],
			});
			await storage.writeJson(storage.sessionPath(slug, "session.json"), {
				id: "session-id",
				name: "Сесія",
				data: {
					scenes: [
						{
							id: "existing-scene",
							texts: {
								summary: "Старий вступ",
								goal: "Стара мета",
								stakes: "Старі ставки",
								location: "Стара локація",
							},
							notes: [],
							npcs: [],
						},
					],
					encounters: [],
					notes: [],
					npcs: [],
					locations: [],
				},
			});
			const inheritedTexts = Object.create({
				summary: "Успадкований текст",
			});

			const result = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "update",
							entity: "scene",
							id: "existing-scene",
							patch: {
								texts: { summary: 0, goal: false, stakes: null },
							},
						},
						{
							op: "create",
							entity: "scene",
							data: {
								summary: "Плаский вступ ігнорується",
								goal: "Пласка мета ігнорується",
								texts: { summary: "Вкладений вступ" },
							},
						},
						{
							op: "create",
							entity: "scene",
							data: {
								texts: null,
								summary: "Плаский вступ",
								goal: 7,
								stakes: false,
								location: null,
							},
						},
						{
							op: "create",
							entity: "scene",
							data: {
								texts: "not-an-object",
								summary: "Fallback від scalar texts",
							},
						},
						{
							op: "create",
							entity: "scene",
							data: { notes: [{ title: "", text: "Лише нотатка" }] },
						},
						{
							op: "create",
							entity: "scene",
							data: { npcs: ["Лада"] },
						},
						{
							op: "create",
							entity: "scene",
							data: { encounterId: 0 },
						},
						{
							op: "create",
							entity: "scene",
							data: { imageUrl: false },
						},
						{
							op: "create",
							entity: "scene",
							data: { texts: { summary: 0 } },
						},
						{
							op: "create",
							entity: "scene",
							data: {
								texts: [],
								summary: "Ігнорувати через array texts",
								notes: {},
								npcs: {},
							},
						},
						{
							op: "create",
							entity: "scene",
							data: { texts: inheritedTexts },
						},
						{
							op: "create",
							entity: "scene",
							data: {
								texts: { summary: " " },
								notes: [{ title: 0, text: null }],
								npcs: [{ name: 0, description: null }],
								encounterId: " ",
								imageUrl: null,
							},
						},
					],
				},
				campaignSlug: slug,
				sessionFile: "session.json",
				permissions: { allowEncounters: true },
			});

			const session = await storage.readSession(slug, "session.json");
			assert.equal(session.data.scenes.length, 9);
			assert.deepEqual(session.data.scenes[0].texts, {
				summary: "0",
				goal: "false",
				stakes: "",
				location: "Стара локація",
			});
			assert.deepEqual(session.data.scenes[1].texts, {
				summary: "Вкладений вступ",
				goal: "",
				stakes: "",
				location: "",
			});
			assert.deepEqual(session.data.scenes[2].texts, {
				summary: "Плаский вступ",
				goal: "7",
				stakes: "false",
				location: "",
			});
			assert.equal(
				session.data.scenes[3].texts.summary,
				"Fallback від scalar texts",
			);
			assert.equal(session.data.scenes[4].notes[0].text, "Лише нотатка");
			assert.equal(session.data.scenes[5].npcs[0].name, "Лада");
			assert.equal(session.data.scenes[6].encounterId, "0");
			assert.equal(session.data.scenes[7].imageUrl, false);
			assert.equal(session.data.scenes[8].texts.summary, "0");
			assert.equal(
				result.warnings.filter((warning) =>
					warning.includes("Skipped empty scene create"),
				).length,
				3,
			);
		});
	},
);

await run(
	"AI patch service normalizes scene aggregates NPCs and encounter precedence",
	async () => {
		const mainScene = {
			id: "main-scene",
			texts: { summary: "Старий вступ", goal: "", stakes: "", location: "" },
			notes: [
				{
					id: "visible-scene-note",
					title: "Видима",
					text: "Старий текст",
					collapsed: true,
				},
				{
					id: "ignored-scene-note",
					title: "Прихована",
					text: "Не змінювати",
					collapsed: false,
					_aiIgnored: true,
				},
			],
			npcs: [{ name: "Стара", description: "Учасниця" }],
			collapsed: true,
			isNotesCollapsed: true,
			encounterId: "main-existing-encounter",
			imageUrl: "/old-scene-image.png",
		};
		const clearScene = {
			id: "clear-scene",
			texts: { summary: "Очистити", goal: "", stakes: "", location: "" },
			notes: [{ id: "clear-note", text: "Очистити" }],
			npcs: [{ name: "Очистити NPC", description: "" }],
		};
		const malformedScene = {
			id: "malformed-scene",
			texts: { summary: "Зламана сцена", goal: "", stakes: "", location: "" },
			notes: { text: "not-an-array" },
			npcs: { name: "not-an-array" },
			encounterId: "malformed-existing-encounter",
		};
		const retainedScene = {
			id: "retained-scene",
			texts: { summary: "Зберегти", goal: "", stakes: "", location: "" },
			notes: [
				{
					id: "retained-note",
					title: "Старий заголовок",
					text: "Стабільний текст",
					collapsed: true,
				},
			],
			npcs: [{ name: "Стабільний NPC", description: "Опис", extra: true }],
		};
		const directScene = {
			id: "direct-scene",
			texts: { summary: "Прямий ID", goal: "", stakes: "", location: "" },
			notes: [],
			npcs: [],
			encounterId: "direct-existing-encounter",
		};
		const mappedScene = {
			id: "mapped-scene",
			texts: { summary: "Mapped ID", goal: "", stakes: "", location: "" },
			notes: [],
			npcs: [],
			encounterId: "mapped-existing-encounter",
		};
		const unresolvedScene = {
			id: "unresolved-scene",
			texts: { summary: "Fallback ID", goal: "", stakes: "", location: "" },
			notes: [],
			npcs: [],
			encounterId: "unresolved-existing-encounter",
		};
		const session = {
			id: "session-id",
			name: "Сесія",
			data: {
				scenes: [
					mainScene,
					clearScene,
					malformedScene,
					retainedScene,
					directScene,
					mappedScene,
					unresolvedScene,
				],
				encounters: [],
				notes: [],
				npcs: [],
				locations: [],
			},
		};
		const originalReadSession = storage.readSession;
		const originalGetBestiaryIndex = storage.getBestiaryIndex;
		const originalWriteJson = storage.writeJson;
		storage.readSession = async () => session;
		storage.getBestiaryIndex = async () => new Map();
		storage.writeJson = async () => {};

		let result;
		try {
			result = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "create",
							entity: "encounter",
							clientId: "future-encounter",
							data: { name: "Майбутня сутичка", monsters: [] },
						},
						{
							op: "update",
							entity: "scene",
							id: "main-scene",
							patch: {
								id: "replacement-id",
								texts: { summary: "Оновлений вступ" },
								notes: [
									{
										id: "visible-scene-note",
										title: "Оновлений заголовок",
										text: "Оновлений текст",
										collapsed: false,
									},
								],
								npcs: [
									" Лада ",
									{ firstName: "Тарас", trait: "Пильний" },
									{ name: "Міра", description: "Готова" },
									{ name: 0, firstName: "Нуль", description: 0, trait: "Аліас" },
									null,
									7,
									"",
									{ name: "" },
								],
								collapsed: false,
								isNotesCollapsed: false,
								imageUrl: "/replacement-scene-image.png",
							},
						},
						{
							op: "update",
							entity: "scene",
							id: "clear-scene",
							patch: {
								texts: { summary: "Очищено" },
								notes: [],
								npcs: [],
							},
						},
						{
							op: "update",
							entity: "scene",
							id: "malformed-scene",
							patch: { texts: { summary: "Виправлено" } },
						},
						{
							op: "update",
							entity: "scene",
							id: "retained-scene",
							patch: { texts: { goal: "Нова мета" } },
						},
						{
							op: "update",
							entity: "scene",
							id: "direct-scene",
							patch: { encounterId: 0 },
						},
						{
							op: "update",
							entity: "scene",
							id: "mapped-scene",
							patch: { encounterClientId: "future-encounter" },
						},
						{
							op: "update",
							entity: "scene",
							id: "unresolved-scene",
							patch: { encounterClientId: "missing-encounter" },
						},
						{
							op: "create",
							entity: "scene",
							clientId: "created-scene",
							data: {
								texts: { summary: "Створена сцена" },
								encounterClientId: "future-encounter",
								collapsed: true,
								isNotesCollapsed: true,
								imageUrl: "/created-scene.png",
							},
						},
					],
				},
				campaignSlug: "bestiary",
				sessionFile: "session.json",
				simplifiedNotes: true,
				permissions: { allowEncounters: true },
			});
		} finally {
			storage.readSession = originalReadSession;
			storage.getBestiaryIndex = originalGetBestiaryIndex;
			storage.writeJson = originalWriteJson;
		}

		const scenes = result.updated.data.scenes;
		const byId = new Map(scenes.map((scene) => [scene.id, scene]));
		const updatedMain = byId.get("main-scene");
		assert.notEqual(updatedMain, mainScene);
		assert.equal(updatedMain.texts.summary, "Оновлений вступ");
		assert.equal(updatedMain.notes[0].id, "visible-scene-note");
		assert.equal(updatedMain.notes[0].title, "");
		assert.equal(updatedMain.notes[0].text, "Оновлений текст");
		assert.equal(updatedMain.notes[0].collapsed, true);
		assert.equal(updatedMain.notes[1].id, "ignored-scene-note");
		assert.equal(updatedMain.notes[1]._aiIgnored, true);
		assert.equal(updatedMain.notes[1].title, "Прихована");
		assert.deepEqual(updatedMain.npcs, [
			{ name: "Лада", description: "" },
			{ name: "Тарас", description: "Пильний" },
			{ name: "Міра", description: "Готова" },
			{ name: "Нуль", description: "Аліас" },
		]);
		assert.equal(updatedMain.collapsed, true);
		assert.equal(updatedMain.isNotesCollapsed, true);
		assert.equal(updatedMain.imageUrl, "/old-scene-image.png");

		assert.deepEqual(byId.get("clear-scene").notes, []);
		assert.deepEqual(byId.get("clear-scene").npcs, []);
		assert.notEqual(byId.get("malformed-scene"), malformedScene);
		assert.deepEqual(byId.get("malformed-scene").notes, []);
		assert.deepEqual(byId.get("malformed-scene").npcs, []);
		assert.equal(
			byId.get("malformed-scene").encounterId,
			"malformed-existing-encounter",
		);
		assert.equal(byId.get("retained-scene").notes[0].id, "retained-note");
		assert.equal(byId.get("retained-scene").notes[0].title, "");
		assert.equal(byId.get("retained-scene").notes[0].collapsed, true);
		assert.deepEqual(byId.get("retained-scene").npcs, [
			{ name: "Стабільний NPC", description: "Опис" },
		]);
		assert.equal(byId.get("direct-scene").encounterId, "0");
		const createdEncounter = result.updated.data.encounters[0];
		assert.equal(createdEncounter.name, "Майбутня сутичка");
		assert.equal(byId.get("mapped-scene").encounterId, createdEncounter.id);
		assert.equal(
			byId.get("unresolved-scene").encounterId,
			"unresolved-existing-encounter",
		);
		const createdScene = scenes.find(
			(scene) => scene.texts.summary === "Створена сцена",
		);
		assert.ok(createdScene.id);
		assert.notEqual(createdScene.id, "created-scene");
		assert.equal(createdScene.encounterId, createdEncounter.id);
		assert.equal(createdScene.collapsed, false);
		assert.equal(createdScene.isNotesCollapsed, false);
		assert.equal(createdScene.imageUrl, "/created-scene.png");
		assert.ok(
			result.warnings.some((warning) =>
				warning.includes(
					'encounterClientId "missing-encounter" could not be resolved',
				),
			),
		);
	},
);

await run(
	"AI patch service dispatches campaign entity commands with stable effect ordering",
	async () => {
		const campaignEntities = {
			characters: [
				{
					id: "campaign-duplicate-id",
					slug: "campaign-duplicate",
					firstName: "Дубль",
					lastName: "Кампанії",
					trait: "Стара версія",
					imageUrl: "/duplicate-old.png",
					notes: [],
				},
				{
					id: "rename-id",
					slug: "rename-entity",
					firstName: "Стара",
					lastName: "Назва",
					trait: "Без змін",
					imageUrl: "/rename-old.png",
					notes: [],
				},
				{
					id: "delete-id",
					slug: "delete-entity",
					firstName: "Видалити",
					lastName: "Мене",
					notes: [],
				},
			],
			npc: [],
			locations: [],
		};
		const session = {
			id: "session-id",
			data: {
				scenes: [],
				encounters: [],
				notes: [],
				npcs: [
					{
						id: "session-shadow-id",
						slug: "session-shadow",
						firstName: "Дубль",
						lastName: "Кампанії",
						trait: "Не переносити",
						notes: [],
					},
					{
						id: "session-lada-id",
						slug: "session-lada",
						firstName: "Сесійна",
						lastName: "Лада",
						trait: "Стара сесійна версія",
						notes: [],
					},
				],
				locations: [],
			},
		};
		const events = [];
		let generatedId = 0;
		const originals = {
			createId: storage.createId,
			listEntities: storage.listEntities,
			ensureUniqueEntitySlug: storage.ensureUniqueEntitySlug,
			writeEntity: storage.writeEntity,
			deleteEntity: storage.deleteEntity,
			updateCampaignMentionReferences:
				storage.updateCampaignMentionReferences,
			readSession: storage.readSession,
			writeJson: storage.writeJson,
		};
		storage.createId = () => `generated-${++generatedId}`;
		storage.listEntities = async (_slug, type) => {
			events.push({ kind: "list", type });
			return campaignEntities[type];
		};
		storage.ensureUniqueEntitySlug = async (_slug, type, baseSlug) => {
			events.push({ kind: "slug", type, baseSlug });
			return `${baseSlug}-unique`;
		};
		storage.writeEntity = async (_slug, type, entitySlug, payload) => {
			events.push({ kind: "write", type, slug: entitySlug });
			if (payload.firstName === "Помилка") {
				throw new Error("campaign write failed");
			}
			const saved = { ...payload, slug: entitySlug };
			const list = campaignEntities[type];
			const index = list.findIndex(
				(entity) => entity.slug === entitySlug || entity.id === saved.id,
			);
			if (index >= 0) list[index] = saved;
			else list.push(saved);
			return saved;
		};
		storage.deleteEntity = async (_slug, type, entitySlug) => {
			events.push({ kind: "delete", type, slug: entitySlug });
			campaignEntities[type] = campaignEntities[type].filter(
				(entity) => entity.slug !== entitySlug,
			);
		};
		storage.updateCampaignMentionReferences = async (
			_slug,
			oldName,
			newName,
		) => {
			events.push({ kind: "mention", oldName, newName });
		};
		storage.readSession = async () => session;
		storage.writeJson = async () => {
			events.push({ kind: "session-write" });
		};

		let result;
		let disabledResult;
		let failure;
		try {
			result = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "create",
							entity: "character",
							clientId: "campaign-duplicate-client",
							data: {
								name: "Дубль Кампанії",
								trait: "Нова кампанійна версія",
								imageUrl: "/duplicate-new.png",
							},
						},
						{
							op: "create",
							entity: "npc",
							scope: "campaign",
							clientId: "promoted-client",
							data: {
								name: "Сесійна Лада",
								trait: "Кампанійна версія",
							},
						},
						{
							op: "create",
							entity: "location",
							scope: "campaign",
							clientId: "created-location-client",
							data: { name: "Нова Вежа", description: "Перший опис" },
						},
						{
							op: "update",
							entity: "location",
							scope: "campaign",
							targetClientId: "created-location-client",
							patch: { description: "Оновлений опис" },
						},
						{
							op: "create",
							entity: "location",
							scope: "campaign",
							data: { description: "Без назви" },
						},
						{
							op: "create",
							entity: "character",
							data: { race: "Без імені" },
						},
						{
							op: "update",
							entity: "character",
							id: "rename-id",
							patch: {
								firstName: "Нова",
								lastName: "Назва",
								imageUrl: "/rename-new.png",
							},
						},
						{
							op: "delete",
							entity: "character",
							slug: "delete-entity",
						},
						{
							op: "update",
							entity: "character",
							id: "missing-id",
							patch: { trait: "Не застосовувати" },
						},
						{
							op: "delete",
							entity: "character",
							id: "missing-id",
						},
						{
							op: "constructor",
							entity: "character",
						},
					],
				},
				campaignSlug: "bestiary",
				sessionFile: "session.json",
				permissions: {
					allowCharacters: true,
					allowNpcs: true,
					allowLocations: true,
				},
			});

			const listCountBeforeDisabled = events.filter(
				(event) => event.kind === "list",
			).length;
			disabledResult = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "create",
							entity: "location",
							scope: "campaign",
							data: { name: "Заборонена" },
						},
					],
				},
				campaignSlug: "bestiary",
				sessionFile: "session.json",
				permissions: { allowLocations: false },
			});
			assert.equal(
				events.filter((event) => event.kind === "list").length,
				listCountBeforeDisabled,
			);

			session.data.npcs.push({
				id: "failed-session-id",
				slug: "failed-session",
				firstName: "Помилка",
				lastName: "Запису",
				notes: [],
			});
			const sessionWritesBeforeFailure = events.filter(
				(event) => event.kind === "session-write",
			).length;
			try {
				await aiPatchService.applyAiOperations({
					payload: {
						operations: [
							{
								op: "create",
								entity: "npc",
								scope: "campaign",
								data: { name: "Помилка Запису" },
							},
						],
					},
					campaignSlug: "bestiary",
					sessionFile: "session.json",
					permissions: { allowNpcs: true },
				});
			} catch (error) {
				failure = error;
			}
			assert.equal(
				events.filter((event) => event.kind === "session-write").length,
				sessionWritesBeforeFailure,
			);
		} finally {
			Object.assign(storage, originals);
		}

		assert.equal(
			events.filter((event) => event.kind === "list").length,
			12,
		);
		assert.equal(events.filter((event) => event.kind === "write").length, 6);
		assert.equal(events.filter((event) => event.kind === "slug").length, 1);
		assert.equal(events.filter((event) => event.kind === "delete").length, 1);
		assert.equal(
			events.filter((event) => event.kind === "session-write").length,
			1,
		);
		const duplicate = campaignEntities.characters.find(
			(entity) => entity.id === "campaign-duplicate-id",
		);
		assert.equal(duplicate.slug, "campaign-duplicate");
		assert.equal(duplicate.trait, "Нова кампанійна версія");
		assert.equal(duplicate.imageUrl, "/duplicate-old.png");
		assert.ok(
			session.data.npcs.some((entity) => entity.id === "session-shadow-id"),
		);
		assert.equal(
			session.data.npcs.some((entity) => entity.id === "session-lada-id"),
			false,
		);
		const promoted = campaignEntities.npc.find(
			(entity) => entity.id === "session-lada-id",
		);
		assert.equal(promoted.slug, "session-lada");
		assert.equal(promoted.trait, "Кампанійна версія");
		const location = campaignEntities.locations.find(
			(entity) => entity.name === "Нова Вежа",
		);
		assert.ok(location.id);
		assert.equal(location.description, "Оновлений опис");
		assert.equal(
			campaignEntities.locations.some((entity) => !entity.name),
			false,
		);
		const renamed = campaignEntities.characters.find(
			(entity) => entity.id === "rename-id",
		);
		assert.equal(renamed.slug, "rename-entity");
		assert.equal(renamed.firstName, "Нова");
		assert.equal(renamed.lastName, "Назва");
		assert.equal(renamed.imageUrl, "/rename-old.png");
		assert.equal(
			campaignEntities.characters.some((entity) => entity.id === "delete-id"),
			false,
		);
		const renameWriteIndex = events.findIndex(
			(event) => event.kind === "write" && event.slug === "rename-entity",
		);
		const mentionIndex = events.findIndex((event) => event.kind === "mention");
		assert.ok(renameWriteIndex >= 0 && mentionIndex > renameWriteIndex);
		assert.deepEqual(events[mentionIndex], {
			kind: "mention",
			oldName: "Стара Назва",
			newName: "Нова Назва",
		});
		assert.ok(
			result.warnings.some((warning) =>
				warning.includes("Replaced duplicate campaign characters"),
			),
		);
		assert.ok(
			result.warnings.some((warning) =>
				warning.includes("Moved duplicate session npc with new AI version"),
			),
		);
		assert.deepEqual(disabledResult.warnings, [
			"Skipped create for disabled locations.",
		]);
		assert.equal(failure?.message, "campaign write failed");
		assert.ok(
			session.data.npcs.some((entity) => entity.id === "failed-session-id"),
		);
	},
);

await run(
	"AI patch service dispatches session entity commands with compensated campaign moves",
	async () => {
		const campaignEntities = {
			npc: [
				{
					id: "campaign-shadow-id",
					slug: "campaign-shadow",
					firstName: "Тінь",
					lastName: "Сесії",
					trait: "Не переносити",
					notes: [],
				},
				{
					id: "campaign-move-id",
					slug: "campaign-move",
					firstName: "Кампанійна",
					lastName: "Міра",
					trait: "Стара кампанійна версія",
					imageUrl: "/campaign-move-old.png",
					notes: [],
				},
			],
			locations: [],
		};
		const session = {
			id: "session-id",
			data: {
				scenes: [],
				encounters: [],
				notes: [],
				npcs: [
					{
						id: "session-duplicate-id",
						slug: "session-duplicate",
						firstName: "Тінь",
						lastName: "Сесії",
						trait: "Стара сесійна версія",
						imageUrl: "/session-duplicate-old.png",
						notes: [],
					},
					{
						id: "session-update-id",
						slug: "session-update",
						firstName: "Стара",
						lastName: "Лада",
						imageUrl: "/session-update-old.png",
						notes: [],
					},
					{
						id: "session-delete-id",
						slug: "session-delete",
						firstName: "Видалити",
						lastName: "Мене",
						notes: [],
					},
				],
				locations: [],
			},
		};
		const events = [];
		let generatedId = 0;
		let sessionAvailable = true;
		let failCampaignReads = false;
		const originals = {
			createId: storage.createId,
			campaignSlug: storage.campaignSlug,
			listEntities: storage.listEntities,
			deleteEntity: storage.deleteEntity,
			readSession: storage.readSession,
			writeJson: storage.writeJson,
		};
		storage.createId = () => `session-generated-${++generatedId}`;
		storage.campaignSlug = (name) => {
			events.push({ kind: "slug", name });
			return originals.campaignSlug(name);
		};
		storage.listEntities = async (_slug, type) => {
			events.push({ kind: "list", type, failed: failCampaignReads });
			if (failCampaignReads) throw new Error("campaign list failed");
			return campaignEntities[type] || [];
		};
		storage.deleteEntity = async (_slug, type, entitySlug) => {
			events.push({ kind: "delete", type, slug: entitySlug });
			if (entitySlug === "delete-failure") {
				throw new Error("campaign delete failed");
			}
			campaignEntities[type] = (campaignEntities[type] || []).filter(
				(entity) => entity.slug !== entitySlug,
			);
		};
		storage.readSession = async () => (sessionAvailable ? session : null);
		storage.writeJson = async () => {
			events.push({ kind: "session-write" });
		};

		let result;
		let disabledResult;
		let missingSessionResult;
		let failure;
		try {
			result = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "create",
							entity: "npc",
							scope: "session",
							clientId: "session-duplicate-client",
							data: {
								name: "Тінь Сесії",
								trait: "Нова сесійна версія",
								imageUrl: "/session-duplicate-new.png",
							},
						},
						{
							op: "create",
							entity: "npc",
							scope: "session",
							clientId: "campaign-move-client",
							data: {
								name: "Кампанійна Міра",
								trait: "Нова сесійна копія",
								imageUrl: "/campaign-move-new.png",
							},
						},
						{
							op: "create",
							entity: "location",
							scope: "session",
							clientId: "new-location-client",
							data: { name: "Нова Брама", description: "Перший опис" },
						},
						{
							op: "update",
							entity: "location",
							scope: "session",
							targetClientId: "new-location-client",
							patch: { description: "Оновлений опис" },
						},
						{
							op: "create",
							entity: "location",
							scope: "session",
							data: { description: "Без назви" },
						},
						{
							op: "create",
							entity: "npc",
							scope: "session",
							data: { race: "Без імені" },
						},
						{
							op: "update",
							entity: "npc",
							scope: "session",
							id: "session-update-id",
							patch: {
								firstName: "Нова",
								lastName: "Лада",
								imageUrl: "/session-update-new.png",
							},
						},
						{
							op: "delete",
							entity: "npc",
							scope: "session",
							id: "session-delete-id",
						},
						{
							op: "update",
							entity: "npc",
							scope: "session",
							id: "missing-id",
							patch: { trait: "Не застосовувати" },
						},
						{
							op: "delete",
							entity: "npc",
							scope: "session",
							id: "missing-id",
						},
						{
							op: "constructor",
							entity: "npc",
							scope: "session",
						},
					],
				},
				campaignSlug: "bestiary",
				sessionFile: "session.json",
				entityScope: "session",
				permissions: { allowNpcs: true, allowLocations: true },
			});

			const listsBeforeDisabled = events.filter(
				(event) => event.kind === "list",
			).length;
			disabledResult = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "create",
							entity: "location",
							scope: "session",
							data: { name: "Заборонена" },
						},
					],
				},
				campaignSlug: "bestiary",
				sessionFile: "session.json",
				entityScope: "session",
				permissions: { allowLocations: false },
			});
			assert.equal(
				events.filter((event) => event.kind === "list").length,
				listsBeforeDisabled,
			);

			sessionAvailable = false;
			missingSessionResult = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "create",
							entity: "npc",
							scope: "session",
							data: { name: "Без Сесії" },
						},
					],
				},
				campaignSlug: "bestiary",
				sessionFile: "missing.json",
				entityScope: "session",
				permissions: { allowNpcs: true },
			});
			sessionAvailable = true;

			failCampaignReads = true;
			await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "create",
							entity: "npc",
							scope: "session",
							data: { name: "Фейл Оупен" },
						},
					],
				},
				campaignSlug: "bestiary",
				sessionFile: "session.json",
				entityScope: "session",
				permissions: { allowNpcs: true },
			});
			failCampaignReads = false;

			campaignEntities.npc.push({
				id: "delete-failure-id",
				slug: "delete-failure",
				firstName: "Помилка",
				lastName: "Видалення",
				notes: [],
			});
			const writesBeforeFailure = events.filter(
				(event) => event.kind === "session-write",
			).length;
			try {
				await aiPatchService.applyAiOperations({
					payload: {
						operations: [
							{
								op: "create",
								entity: "npc",
								scope: "session",
								clientId: "failed-move-client",
								data: { name: "Помилка Видалення" },
							},
						],
					},
					campaignSlug: "bestiary",
					sessionFile: "session.json",
					entityScope: "session",
					permissions: { allowNpcs: true },
				});
			} catch (error) {
				failure = error;
			}
			assert.equal(
				events.filter((event) => event.kind === "session-write").length,
				writesBeforeFailure,
			);
		} finally {
			Object.assign(storage, originals);
		}

		assert.equal(events.filter((event) => event.kind === "list").length, 6);
		assert.equal(events.filter((event) => event.kind === "delete").length, 2);
		assert.equal(events.filter((event) => event.kind === "slug").length, 2);
		assert.equal(
			events.filter((event) => event.kind === "session-write").length,
			2,
		);
		const duplicate = session.data.npcs.find(
			(entity) => entity.id === "session-duplicate-id",
		);
		assert.equal(duplicate.slug, "session-duplicate");
		assert.equal(duplicate.trait, "Нова сесійна версія");
		assert.equal(duplicate.imageUrl, "/session-duplicate-old.png");
		assert.ok(
			campaignEntities.npc.some(
				(entity) => entity.id === "campaign-shadow-id",
			),
		);
		const moved = session.data.npcs.find(
			(entity) => entity.id === "campaign-move-id",
		);
		assert.equal(moved.slug, "campaign-move");
		assert.equal(moved.trait, "Нова сесійна копія");
		assert.equal(moved.imageUrl, "/campaign-move-old.png");
		assert.equal(
			campaignEntities.npc.some(
				(entity) => entity.id === "campaign-move-id",
			),
			false,
		);
		const location = session.data.locations.find(
			(entity) => entity.name === "Нова Брама",
		);
		assert.ok(location.id);
		assert.equal(location.description, "Оновлений опис");
		assert.equal(
			session.data.locations.some((entity) => !entity.name),
			false,
		);
		const updated = session.data.npcs.find(
			(entity) => entity.id === "session-update-id",
		);
		assert.equal(updated.slug, "session-update");
		assert.equal(updated.firstName, "Нова");
		assert.equal(updated.lastName, "Лада");
		assert.equal(updated.imageUrl, "/session-update-old.png");
		assert.equal(
			session.data.npcs.some((entity) => entity.id === "session-delete-id"),
			false,
		);
		assert.ok(
			session.data.npcs.some(
				(entity) => `${entity.firstName} ${entity.lastName}` === "Фейл Оупен",
			),
		);
		assert.ok(
			result.warnings.some((warning) =>
				warning.includes("Replaced duplicate session npc with new AI version"),
			),
		);
		assert.ok(
			result.warnings.some((warning) =>
				warning.includes("Moved duplicate campaign npc to session"),
			),
		);
		assert.deepEqual(disabledResult.warnings, [
			"Skipped create for disabled locations.",
		]);
		assert.deepEqual(missingSessionResult.warnings, [
			"Skipped session create; no session target.",
		]);
		assert.equal(failure?.message, "campaign delete failed");
		assert.equal(
			session.data.npcs.some(
				(entity) => entity.id === "delete-failure-id",
			),
			false,
		);
		assert.ok(
			campaignEntities.npc.some(
				(entity) => entity.id === "delete-failure-id",
			),
		);
	},
);

await run(
	"AI patch service dispatches compensated scope movement transactions",
	async () => {
		let campaignEntities = {
			npc: [
				{
					id: "campaign-duplicate-id",
					slug: "campaign-duplicate",
					firstName: "Спільна",
					lastName: "Варта",
					trait: "Стара кампанійна версія",
					imageUrl: "/campaign-duplicate-old.png",
					notes: [],
				},
				{
					id: "campaign-to-session-id",
					slug: "campaign-to-session",
					firstName: "Спільна",
					lastName: "Брама",
					trait: "Нова кампанійна версія",
					imageUrl: "/campaign-to-session.png",
					notes: [],
				},
			],
			locations: [],
		};
		const session = {
			id: "session-id",
			data: {
				scenes: [],
				encounters: [],
				notes: [],
				npcs: [
					{
						id: "session-to-campaign-id",
						slug: "session-to-campaign",
						firstName: "Спільна",
						lastName: "Варта",
						trait: "Нова сесійна версія",
						imageUrl: "/session-to-campaign.png",
						notes: [],
					},
					{
						id: "session-duplicate-id",
						slug: "session-duplicate",
						firstName: "Спільна",
						lastName: "Брама",
						trait: "Стара сесійна версія",
						imageUrl: "/session-duplicate-old.png",
						notes: [],
					},
				],
				locations: [],
			},
		};
		const events = [];
		let generatedId = 0;
		let sessionAvailable = true;
		let failSessionWrite = false;
		let failDeleteSlug = "";
		let failWriteSlug = "";
		const originals = {
			createId: storage.createId,
			listEntities: storage.listEntities,
			ensureUniqueEntitySlug: storage.ensureUniqueEntitySlug,
			writeEntity: storage.writeEntity,
			deleteEntity: storage.deleteEntity,
			readSession: storage.readSession,
			writeJson: storage.writeJson,
		};
		storage.createId = () => `move-generated-${++generatedId}`;
		storage.listEntities = async (_slug, type) => {
			events.push({ kind: "list", type });
			return campaignEntities[type] || [];
		};
		storage.ensureUniqueEntitySlug = async (_slug, type, baseSlug) => {
			events.push({ kind: "slug", type, baseSlug });
			return baseSlug;
		};
		storage.writeEntity = async (_slug, type, entitySlug, payload) => {
			events.push({ kind: "write", type, slug: entitySlug });
			if (entitySlug === failWriteSlug) {
				throw new Error("campaign write failed");
			}
			const saved = { ...payload, slug: entitySlug };
			const list = campaignEntities[type] || (campaignEntities[type] = []);
			const index = list.findIndex(
				(entity) => entity.slug === entitySlug || entity.id === saved.id,
			);
			if (index >= 0) list[index] = saved;
			else list.push(saved);
			return saved;
		};
		storage.deleteEntity = async (_slug, type, entitySlug) => {
			events.push({ kind: "delete", type, slug: entitySlug });
			if (entitySlug === failDeleteSlug) {
				throw new Error("campaign delete failed");
			}
			campaignEntities[type] = (campaignEntities[type] || []).filter(
				(entity) => entity.slug !== entitySlug,
			);
		};
		storage.readSession = async () => (sessionAvailable ? session : null);
		storage.writeJson = async () => {
			events.push({
				kind: failSessionWrite ? "session-write-failed" : "session-write",
			});
			if (failSessionWrite) throw new Error("session write failed");
		};

		let result;
		let invalidResult;
		let equalResult;
		let noSessionResult;
		let missingResult;
		let sessionToCampaignFailure;
		let campaignToSessionFailure;
		let deleteFailure;
		let writeFailure;
		try {
			result = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "moveScope",
							entity: "npc",
							id: "session-to-campaign-id",
							from: "session",
							to: "campaign",
						},
						{
							op: "create",
							entity: "npc",
							scope: "campaign",
							clientId: "created-campaign-client",
							data: {
								name: "Клієнтська Ціль",
								trait: "Створено перед рухом",
							},
						},
						{
							op: "moveScope",
							entity: "npc",
							targetClientId: "created-campaign-client",
							from: "campaign",
							to: "session",
						},
						{
							op: "moveScope",
							entity: "npc",
							id: "campaign-to-session-id",
							from: "campaign",
							to: "session",
						},
					],
				},
				campaignSlug: "bestiary",
				sessionFile: "session.json",
				entityScope: "mixed",
				permissions: { allowNpcs: true },
			});
			const campaignDuplicate = campaignEntities.npc.find(
				(entity) => entity.id === "campaign-duplicate-id",
			);
			assert.equal(campaignDuplicate.slug, "campaign-duplicate");
			assert.equal(campaignDuplicate.trait, "Нова сесійна версія");
			assert.equal(
				campaignDuplicate.imageUrl,
				"/campaign-duplicate-old.png",
			);
			assert.equal(
				session.data.npcs.some(
					(entity) => entity.id === "session-to-campaign-id",
				),
				false,
			);
			const sessionDuplicate = session.data.npcs.find(
				(entity) => entity.id === "session-duplicate-id",
			);
			assert.equal(sessionDuplicate.slug, "session-duplicate");
			assert.equal(sessionDuplicate.trait, "Нова кампанійна версія");
			assert.equal(sessionDuplicate.imageUrl, "/session-duplicate-old.png");
			assert.equal(
				campaignEntities.npc.some(
					(entity) => entity.id === "campaign-to-session-id",
				),
				false,
			);
			const clientMoved = session.data.npcs.find(
				(entity) =>
					`${entity.firstName} ${entity.lastName}` === "Клієнтська Ціль",
			);
			assert.ok(clientMoved.id);
			assert.equal(
				campaignEntities.npc.some((entity) => entity.id === clientMoved.id),
				false,
			);

			const readsBeforeRejectedScopes = events.filter(
				(event) => event.kind === "list",
			).length;
			invalidResult = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "moveScope",
							entity: "npc",
							id: "missing",
							from: "void",
							to: "session",
						},
					],
				},
				campaignSlug: "bestiary",
				sessionFile: "session.json",
			});
			equalResult = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "moveScope",
							entity: "npc",
							id: "missing",
							from: "campaign",
							to: "campaign",
						},
					],
				},
				campaignSlug: "bestiary",
				sessionFile: "session.json",
			});
			sessionAvailable = false;
			noSessionResult = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "moveScope",
							entity: "npc",
							id: "missing",
							from: "campaign",
							to: "session",
						},
					],
				},
				campaignSlug: "bestiary",
				sessionFile: "missing.json",
			});
			sessionAvailable = true;
			assert.equal(
				events.filter((event) => event.kind === "list").length,
				readsBeforeRejectedScopes,
			);
			missingResult = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "moveScope",
							entity: "npc",
							id: "missing",
							from: "campaign",
							to: "session",
						},
					],
				},
				campaignSlug: "bestiary",
				sessionFile: "session.json",
			});

			campaignEntities.npc = [
				{
					id: "restore-campaign-id",
					slug: "restore-campaign",
					firstName: "Відновна",
					lastName: "Варта",
					trait: "Оригінал кампанії",
					imageUrl: "/restore-campaign.png",
					notes: [],
				},
			];
			session.data.npcs = [
				{
					id: "restore-session-source-id",
					slug: "restore-session-source",
					firstName: "Відновна",
					lastName: "Варта",
					trait: "Версія сесії",
					notes: [],
				},
			];
			failSessionWrite = true;
			const sessionToCampaignStart = events.length;
			try {
				await aiPatchService.applyAiOperations({
					payload: {
						operations: [
							{
								op: "moveScope",
								entity: "npc",
								id: "restore-session-source-id",
								from: "session",
								to: "campaign",
							},
						],
					},
					campaignSlug: "bestiary",
					sessionFile: "session.json",
				});
			} catch (error) {
				sessionToCampaignFailure = error;
			}
			failSessionWrite = false;
			const sessionToCampaignEvents = events.slice(sessionToCampaignStart);
			assert.equal(session.data.npcs.length, 1);
			assert.equal(session.data.npcs[0].id, "restore-session-source-id");
			assert.equal(session.data.npcs[0].trait, "Версія сесії");
			assert.equal(campaignEntities.npc.length, 1);
			assert.equal(campaignEntities.npc[0].id, "restore-campaign-id");
			assert.equal(campaignEntities.npc[0].trait, "Оригінал кампанії");
			assert.equal(
				campaignEntities.npc[0].imageUrl,
				"/restore-campaign.png",
			);

			campaignEntities.npc = [
				{
					id: "restore-campaign-source-id",
					slug: "restore-campaign-source",
					firstName: "Відновна",
					lastName: "Брама",
					trait: "Версія кампанії",
					imageUrl: "/restore-campaign-source.png",
					notes: [],
				},
			];
			session.data.npcs = [
				{
					id: "restore-session-id",
					slug: "restore-session",
					firstName: "Відновна",
					lastName: "Брама",
					trait: "Оригінал сесії",
					imageUrl: "/restore-session.png",
					notes: [],
				},
			];
			failSessionWrite = true;
			const campaignToSessionStart = events.length;
			try {
				await aiPatchService.applyAiOperations({
					payload: {
						operations: [
							{
								op: "moveScope",
								entity: "npc",
								id: "restore-campaign-source-id",
								from: "campaign",
								to: "session",
							},
						],
					},
					campaignSlug: "bestiary",
					sessionFile: "session.json",
				});
			} catch (error) {
				campaignToSessionFailure = error;
			}
			failSessionWrite = false;
			const campaignToSessionEvents = events.slice(campaignToSessionStart);
			assert.equal(session.data.npcs.length, 1);
			assert.equal(session.data.npcs[0].id, "restore-session-id");
			assert.equal(session.data.npcs[0].trait, "Оригінал сесії");
			assert.equal(session.data.npcs[0].imageUrl, "/restore-session.png");
			assert.equal(campaignEntities.npc.length, 1);
			assert.equal(
				campaignEntities.npc[0].id,
				"restore-campaign-source-id",
			);
			assert.equal(campaignEntities.npc[0].trait, "Версія кампанії");

			campaignEntities.npc = [
				{
					id: "delete-failure-id",
					slug: "delete-failure",
					firstName: "Помилка",
					lastName: "Видалення",
					notes: [],
				},
			];
			session.data.npcs = [];
			failDeleteSlug = "delete-failure";
			const deleteFailureStart = events.length;
			try {
				await aiPatchService.applyAiOperations({
					payload: {
						operations: [
							{
								op: "moveScope",
								entity: "npc",
								id: "delete-failure-id",
								from: "campaign",
								to: "session",
							},
						],
					},
					campaignSlug: "bestiary",
					sessionFile: "session.json",
				});
			} catch (error) {
				deleteFailure = error;
			}
			failDeleteSlug = "";
			const deleteFailureEvents = events.slice(deleteFailureStart);
			assert.equal(session.data.npcs.length, 0);
			assert.equal(campaignEntities.npc.length, 1);
			assert.equal(campaignEntities.npc[0].id, "delete-failure-id");

			campaignEntities.npc = [];
			session.data.npcs = [
				{
					id: "write-failure-id",
					slug: "write-failure",
					firstName: "Помилка",
					lastName: "Запису",
					notes: [],
				},
			];
			failWriteSlug = "write-failure";
			const writeFailureStart = events.length;
			try {
				await aiPatchService.applyAiOperations({
					payload: {
						operations: [
							{
								op: "moveScope",
								entity: "npc",
								id: "write-failure-id",
								from: "session",
								to: "campaign",
							},
						],
					},
					campaignSlug: "bestiary",
					sessionFile: "session.json",
				});
			} catch (error) {
				writeFailure = error;
			}
			failWriteSlug = "";
			const writeFailureEvents = events.slice(writeFailureStart);

			assert.equal(sessionToCampaignFailure?.message, "session write failed");
			assert.deepEqual(
				sessionToCampaignEvents.map((event) => event.kind),
				["list", "write", "session-write-failed", "write"],
			);
			assert.equal(campaignToSessionFailure?.message, "session write failed");
			assert.deepEqual(
				campaignToSessionEvents.map((event) => event.kind),
				["list", "delete", "session-write-failed", "write"],
			);
			assert.equal(deleteFailure?.message, "campaign delete failed");
			assert.equal(
				deleteFailureEvents.some((event) => event.kind.startsWith("session-write")),
				false,
			);
			assert.equal(writeFailure?.message, "campaign write failed");
			assert.equal(
				writeFailureEvents.some((event) => event.kind.startsWith("session-write")),
				false,
			);
		} finally {
			Object.assign(storage, originals);
		}

		assert.ok(
			result.warnings.some((warning) =>
				warning.includes("Replaced duplicate campaign npc during moveScope"),
			),
		);
		assert.ok(
			result.warnings.some((warning) =>
				warning.includes("Replaced duplicate session npc during moveScope"),
			),
		);
		assert.deepEqual(invalidResult.warnings, [
			"Skipped moveScope with invalid scope.",
		]);
		assert.deepEqual(equalResult.warnings, []);
		assert.deepEqual(noSessionResult.warnings, [
			"Skipped moveScope; no session target.",
		]);
		assert.deepEqual(missingResult.warnings, []);
		assert.equal(session.data.npcs.length, 1);
		assert.equal(session.data.npcs[0].id, "write-failure-id");
		assert.equal(campaignEntities.npc.length, 0);
	},
);

await run(
	"AI patch service resolves entity identity scope and version precedence",
	async () => {
		const nameSource = {
			id: "name-first-id",
			slug: "name-first",
			firstName: "Спільна",
			lastName: "Ціль",
			trait: "Початковий name match",
			notes: [],
		};
		const zeroSource = {
			id: 0,
			slug: "zero-id",
			firstName: "Нульова",
			lastName: "Ціль",
			trait: "Початковий zero ID",
			imageUrl: "/zero-old.png",
			notes: [],
		};
		let campaignEntities = {
			npc: [
				nameSource,
				{
					id: "slug-id",
					slug: "wanted-slug",
					firstName: "Інша",
					lastName: "Slug",
					trait: "Початковий slug match",
					notes: [],
				},
				zeroSource,
				{
					id: "mapped-session-id",
					slug: "campaign-mapped",
					firstName: "Мапована",
					lastName: "Ціль",
					trait: "Початкова кампанійна",
					imageUrl: "/campaign-mapped.png",
					notes: [],
				},
				{
					id: "duplicate-id",
					slug: "duplicate-stable",
					firstName: "Дубль",
					lastName: "Версії",
					trait: "Старий дубль",
					imageUrl: "/duplicate-stable.png",
					notes: [],
				},
			],
			locations: [],
		};
		const session = {
			id: "session-id",
			data: {
				scenes: [],
				encounters: [],
				notes: [],
				npcs: [
					{
						id: "mapped-session-id",
						slug: "session-mapped",
						firstName: "Мапована",
						lastName: "Ціль",
						trait: "Початкова сесійна",
						imageUrl: "/session-mapped.png",
						notes: [],
					},
				],
				locations: [],
			},
		};
		const events = [];
		let malformedCampaignList = false;
		let generatedId = 0;
		const originals = {
			createId: storage.createId,
			listEntities: storage.listEntities,
			ensureUniqueEntitySlug: storage.ensureUniqueEntitySlug,
			writeEntity: storage.writeEntity,
			readSession: storage.readSession,
			writeJson: storage.writeJson,
		};
		storage.createId = () => `precedence-generated-${++generatedId}`;
		storage.listEntities = async (_slug, type) => {
			events.push({ kind: "list", type });
			return malformedCampaignList ? { malformed: true } : campaignEntities[type];
		};
		storage.ensureUniqueEntitySlug = async (_slug, type, baseSlug) => {
			events.push({ kind: "slug", type, baseSlug });
			return baseSlug;
		};
		storage.writeEntity = async (_slug, type, entitySlug, payload) => {
			events.push({ kind: "write", type, slug: entitySlug });
			const saved = { ...payload, slug: entitySlug };
			const list = campaignEntities[type];
			const index = list.findIndex(
				(entity) => entity.slug === entitySlug || entity.id === saved.id,
			);
			if (index >= 0) list[index] = saved;
			else list.push(saved);
			return saved;
		};
		storage.readSession = async () => session;
		storage.writeJson = async () => {
			events.push({ kind: "session-write" });
		};

		let malformedResult;
		try {
			await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "create",
							entity: "npc",
							scope: "session",
							clientId: "mapped-client",
							data: {
								name: "Мапована Ціль",
								trait: "Мапована початкова",
							},
						},
						{
							op: "update",
							entity: "npc",
							targetClientId: "mapped-client",
							scope: "void",
							patch: { trait: "Mapped scope переміг invalid explicit" },
						},
						{
							op: "update",
							entity: "npc",
							targetClientId: "mapped-client",
							scope: " Campaign ",
							patch: { trait: "Explicit campaign переміг mapping" },
						},
						{
							op: "update",
							entity: "npc",
							scope: "campaign",
							id: 0,
							slug: "wanted-slug",
							name: "Спільна Ціль",
							patch: {
								id: "replace-zero",
								slug: "replace-zero",
								imageUrl: "/zero-new.png",
								trait: "ID zero переміг slug і name",
							},
						},
						{
							op: "update",
							entity: "npc",
							scope: "campaign",
							id: "missing-id",
							slug: "wanted-slug",
							name: "Спільна Ціль",
							patch: { trait: "Slug переміг name" },
						},
						{
							op: "update",
							entity: "npc",
							scope: "campaign",
							id: "missing-id",
							slug: "missing-slug",
							name: "Спільна Ціль",
							patch: { trait: "Name fallback" },
						},
						{
							op: "create",
							entity: "npc",
							scope: "campaign",
							data: {
								id: "replace-duplicate",
								slug: "replace-duplicate",
								name: "Дубль Версії",
								trait: "Новий дубль",
								imageUrl: "/duplicate-new.png",
							},
						},
						{
							op: "update",
							entity: "npc",
							scope: "campaign",
							id: "name-first-id",
							patch: ["malformed", "patch"],
						},
						{
							op: "create",
							entity: "npc",
							scope: "campaign",
							data: ["malformed", "data"],
						},
					],
				},
				campaignSlug: "bestiary",
				sessionFile: "session.json",
				entityScope: "campaign",
				permissions: { allowNpcs: true },
			});

			await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "update",
							entity: "npc",
							id: "mapped-session-id",
							patch: { trait: "Default session scope" },
						},
					],
				},
				campaignSlug: "bestiary",
				sessionFile: "session.json",
				entityScope: "session",
				permissions: { allowNpcs: true },
			});

			const writesBeforeMalformedList = events.filter(
				(event) => event.kind === "write",
			).length;
			malformedCampaignList = true;
			malformedResult = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "update",
							entity: "npc",
							scope: "campaign",
							id: "missing",
							patch: null,
						},
					],
				},
				campaignSlug: "bestiary",
				sessionFile: "session.json",
				entityScope: "campaign",
				permissions: { allowNpcs: true },
			});
			assert.equal(
				events.filter((event) => event.kind === "write").length,
				writesBeforeMalformedList,
			);
		} finally {
			Object.assign(storage, originals);
		}

		const zero = campaignEntities.npc.find((entity) => entity.id === 0);
		assert.equal(zero.slug, "zero-id");
		assert.equal(zero.trait, "ID zero переміг slug і name");
		assert.equal(zero.imageUrl, "/zero-old.png");
		const slug = campaignEntities.npc.find((entity) => entity.id === "slug-id");
		assert.equal(slug.trait, "Slug переміг name");
		const name = campaignEntities.npc.find(
			(entity) => entity.id === "name-first-id",
		);
		assert.equal(name.trait, "Name fallback");
		const mappedCampaign = campaignEntities.npc.find(
			(entity) => entity.id === "mapped-session-id",
		);
		assert.equal(mappedCampaign.trait, "Explicit campaign переміг mapping");
		assert.equal(mappedCampaign.slug, "campaign-mapped");
		assert.equal(mappedCampaign.imageUrl, "/campaign-mapped.png");
		const mappedSession = session.data.npcs.find(
			(entity) => entity.id === "mapped-session-id",
		);
		assert.equal(mappedSession.trait, "Default session scope");
		assert.equal(mappedSession.slug, "session-mapped");
		assert.equal(mappedSession.imageUrl, "/session-mapped.png");
		const duplicate = campaignEntities.npc.find(
			(entity) => entity.id === "duplicate-id",
		);
		assert.equal(duplicate.slug, "duplicate-stable");
		assert.equal(duplicate.trait, "Новий дубль");
		assert.equal(duplicate.imageUrl, "/duplicate-stable.png");
		assert.equal(
			campaignEntities.npc.some(
				(entity) => entity.id === "replace-duplicate",
			),
			false,
		);
		assert.equal(nameSource.trait, "Початковий name match");
		assert.equal(zeroSource.trait, "Початковий zero ID");
		assert.equal(zeroSource.imageUrl, "/zero-old.png");
		assert.deepEqual(malformedResult.warnings, []);
	},
);

await run(
	"AI patch service normalizes name level and note shape lifecycles",
	async () => {
		await withTestSlug("ai-normalization-prelude", async (slug) => {
			await storage.ensureDir(path.join(storage.campaignDir(slug), "sessions"));
			await storage.writeJson(storage.campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Матриця нормалізації",
				description: "",
				notes: [],
			});
			await storage.writeEntity(slug, "characters", "note-owner", {
				id: "note-owner-id",
				slug: "note-owner",
				firstName: "Власниця",
				lastName: "Нотаток",
				level: 5,
				notes: [
					{
						id: "existing-note",
						title: "Старий заголовок",
						text: "Старий текст",
						collapsed: true,
					},
					{
						id: "ignored-note",
						title: "Прихована",
						text: "Не змінювати",
						collapsed: false,
						_aiIgnored: true,
					},
				],
			});
			await storage.writeJson(storage.sessionPath(slug, "session.json"), {
				id: "session-id",
				name: "Сесія нормалізації",
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
					operations: [
						{
							op: "update",
							entity: "character",
							id: "note-owner-id",
							patch: {
								notes: [
									{
										id: "existing-note",
										title: "Оновлений заголовок",
										text: "Оновлений текст",
										collapsed: false,
									},
								],
							},
						},
						{
							op: "create",
							entity: "character",
							data: {
								firstName: "  [[Ірина]]  ",
								first_name: "Аліас",
								lastName: "  Штормова  ",
								last_name: "Інший Аліас",
								name: "Конфліктне Повне Ім'я",
								level: " 3abc ",
							},
						},
						{
							op: "create",
							entity: "character",
							data: {
								firstName: "",
								first_name: " Олена ",
								lastName: 0,
								last_name: " Ніч ",
								level: "   ",
							},
						},
						{
							op: "create",
							entity: "character",
							data: { fullName: "[[Моноліт]]", level: 99 },
						},
						{
							op: "create",
							entity: "character",
							data: { title: "[  Марко   Тихий  ]", level: 0 },
						},
						{
							op: "create",
							entity: "character",
							data: {
								name: "Нотаткова Матриця",
								level: "не число",
								notes: [
									"  Видимий рядок  ",
									"   ",
									{
										id: "alias-note",
										title: "",
										name: "Назва з alias",
										text: null,
										description: 0,
										content: "Не брати",
										collapsed: "yes",
									},
									{ id: "content-note", content: false },
									{ id: "empty-note", title: " ", text: " " },
									[],
									null,
									7,
								],
							},
						},
						{
							op: "create",
							entity: "character",
							data: {
								name: "Порожній Носій",
								level: null,
								notes: [[], null, 7, "   "],
							},
						},
						{
							op: "create",
							entity: "character",
							data: ["malformed"],
						},
						{
							op: "appendNote",
							entity: "session",
							note: "  Рядкова нотатка  ",
						},
						{
							op: "appendNote",
							entity: "session",
							note: "   ",
						},
						{
							op: "appendNote",
							entity: "session",
							note: {
								id: "object-note",
								title: "",
								name: "Object alias",
								text: null,
								description: 0,
								content: "Не брати",
								collapsed: "yes",
							},
						},
						{
							op: "appendNote",
							entity: "session",
							note: { id: 0, title: 0, name: "Нульовий ID", text: "" },
						},
						{
							op: "appendNote",
							entity: "session",
							note: ["invalid", "array"],
						},
						{
							op: "appendNote",
							entity: "session",
							note: 7,
						},
					],
				},
				campaignSlug: slug,
				sessionFile: "session.json",
				entityScope: "mixed",
				permissions: { allowCharacters: true },
			});

			await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "create",
							entity: "character",
							data: {
								name: "Спрощена Нотатка",
								notes: [
									{ title: "Прибрати", text: "Залишити текст" },
								],
							},
						},
						{
							op: "appendNote",
							entity: "session",
							note: { title: "Прибрати", text: "Спрощений текст" },
						},
					],
				},
				campaignSlug: slug,
				sessionFile: "session.json",
				simplifiedNotes: true,
				permissions: { allowCharacters: true },
			});

			const characters = await storage.listEntities(slug, "characters");
			const byName = new Map(
				characters.map((character) => [
					`${character.firstName} ${character.lastName}`.trim(),
					character,
				]),
			);
			const canonical = byName.get("Ірина Штормова");
			assert.equal(canonical.level, 3);
			assert.equal(byName.has("Аліас Інший Аліас"), false);
			assert.equal(byName.get("Олена Ніч").level, "");
			assert.equal(byName.get("Моноліт").lastName, "");
			assert.equal(byName.get("Моноліт").level, 20);
			assert.equal(byName.get("Марко Тихий").level, 1);
			const matrix = byName.get("Нотаткова Матриця");
			assert.equal(matrix.level, 1);
			assert.equal(matrix.notes.length, 3);
			assert.equal(matrix.notes[0].title, "");
			assert.equal(matrix.notes[0].text, "Видимий рядок");
			assert.equal(matrix.notes[1].id, "alias-note");
			assert.equal(matrix.notes[1].title, "Назва з alias");
			assert.equal(matrix.notes[1].text, "0");
			assert.equal(matrix.notes[1].collapsed, true);
			assert.equal(matrix.notes[2].id, "content-note");
			assert.equal(matrix.notes[2].text, "false");
			const emptyCarrier = byName.get("Порожній Носій");
			assert.equal(emptyCarrier.level, 1);
			assert.equal(emptyCarrier.notes.length, 1);
			assert.equal(emptyCarrier.notes[0].title, "");
			assert.equal(emptyCarrier.notes[0].text, "");
			assert.ok(emptyCarrier.notes[0].id);
			const simplified = byName.get("Спрощена Нотатка");
			assert.equal(simplified.notes.length, 1);
			assert.equal(simplified.notes[0].title, "");
			assert.equal(simplified.notes[0].text, "Залишити текст");
			assert.equal(
				characters.some(
					(character) => !character.firstName && !character.lastName,
				),
				false,
			);
			const noteOwner = characters.find(
				(character) => character.id === "note-owner-id",
			);
			assert.deepEqual(
				noteOwner.notes.map((note) => note.id),
				["existing-note", "ignored-note"],
			);
			assert.equal(noteOwner.notes[0].title, "Оновлений заголовок");
			assert.equal(noteOwner.notes[0].text, "Оновлений текст");
			assert.equal(noteOwner.notes[0].collapsed, true);
			assert.equal(noteOwner.notes[1]._aiIgnored, true);

			const session = await storage.readSession(slug, "session.json");
			assert.equal(session.data.notes.length, 5);
			assert.equal(session.data.notes[0].text, "Рядкова нотатка");
			assert.equal(session.data.notes[1].text, "");
			assert.equal(session.data.notes[2].id, "object-note");
			assert.equal(session.data.notes[2].title, "Object alias");
			assert.equal(session.data.notes[2].text, "0");
			assert.equal(session.data.notes[2].collapsed, true);
			assert.notEqual(session.data.notes[3].id, 0);
			assert.equal(session.data.notes[3].title, "Нульовий ID");
			assert.equal(session.data.notes[3].text, "");
			assert.equal(session.data.notes[4].title, "");
			assert.equal(session.data.notes[4].text, "Спрощений текст");
		});
	},
);

await run(
	"AI campaign entity persistence preserves slug allocation and write lifecycles",
	async () => {
		const campaignEntities = {
			characters: [
				{
					id: "existing-character",
					slug: "existing-character-slug",
					firstName: "Стабільна",
					lastName: "Героїня",
					trait: "До оновлення",
					notes: [],
				},
			],
			npc: [],
			locations: [
				{
					id: "blank-location",
					slug: "",
					name: "",
					description: "",
					notes: [],
				},
			],
		};
		const session = {
			id: "phase-52-session",
			data: {
				scenes: [],
				encounters: [],
				notes: [],
				npcs: [
					{
						id: "supplied-npc",
						slug: "supplied-npc-slug",
						firstName: "Надана",
						lastName: "Мітка",
						notes: [],
					},
					{
						id: "numeric-npc",
						slug: 42,
						firstName: "Числова",
						lastName: "Мітка",
						notes: [],
					},
					{
						id: "zero-npc",
						slug: 0,
						firstName: "Нуль",
						lastName: "Мітка",
						notes: [],
					},
					{
						id: "empty-npc",
						slug: "",
						firstName: "",
						lastName: "Без Імені",
						notes: [],
					},
				],
				locations: [],
			},
		};
		const operations = [
			{
				op: "update",
				entity: "character",
				scope: "campaign",
				id: "existing-character",
				patch: { trait: "Після оновлення", slug: "ignored-patch-slug" },
			},
			{
				op: "create",
				entity: "location",
				scope: "campaign",
				data: { name: "Київська Вежа" },
			},
			{
				op: "create",
				entity: "character",
				scope: "campaign",
				data: { name: "Без Slug" },
			},
			...[
				"supplied-npc",
				"numeric-npc",
				"zero-npc",
				"empty-npc",
			].map((id) => ({
				op: "moveScope",
				entity: "npc",
				id,
				from: "session",
				to: "campaign",
			})),
			{
				op: "appendNote",
				entity: "location",
				scope: "campaign",
				id: "blank-location",
				note: { text: "Нотатка без slug та назви" },
			},
		];
		const operationsSnapshot = structuredClone(operations);
		const events = [];
		let generatedId = 0;
		let writeNumber = 0;
		const originals = {
			createId: storage.createId,
			listEntities: storage.listEntities,
			campaignSlug: storage.campaignSlug,
			ensureUniqueEntitySlug: storage.ensureUniqueEntitySlug,
			writeEntity: storage.writeEntity,
			deleteEntity: storage.deleteEntity,
			updateCampaignMentionReferences:
				storage.updateCampaignMentionReferences,
			readSession: storage.readSession,
			writeJson: storage.writeJson,
		};
		storage.createId = () => `phase-52-${++generatedId}`;
		storage.listEntities = async (_campaignSlug, type) =>
			campaignEntities[type] || [];
		storage.campaignSlug = (baseName) => {
			events.push({ kind: "slugify", baseName });
			return `base:${String(baseName)}`;
		};
		storage.ensureUniqueEntitySlug = async (
			_campaignSlug,
			type,
			baseSlug,
		) => {
			events.push({ kind: "allocate", type, baseSlug });
			return `${baseSlug}:unique`;
		};
		storage.writeEntity = async (_campaignSlug, type, slug, payload) => {
			events.push({
				kind: "write",
				type,
				slug,
				payload: structuredClone(payload),
			});
			if (payload.firstName === "Помилка") {
				throw new Error("phase 52 write failed");
			}
			const saved = Object.freeze({
				...payload,
				storageResult: `write-${++writeNumber}`,
			});
			const list = campaignEntities[type] || (campaignEntities[type] = []);
			const index = list.findIndex(
				(entity) => entity.id === saved.id || entity.slug === slug,
			);
			if (index >= 0) list[index] = saved;
			else list.push(saved);
			return saved;
		};
		storage.deleteEntity = async (_campaignSlug, type, slug) => {
			campaignEntities[type] = (campaignEntities[type] || []).filter(
				(entity) => entity.slug !== slug,
			);
		};
		storage.updateCampaignMentionReferences = async () => {};
		storage.readSession = async () => session;
		storage.writeJson = async () => {
			events.push({ kind: "session-write" });
		};

		const failingData = { name: "Помилка Запису", untouched: true };
		const failingSnapshot = structuredClone(failingData);
		let failure;
		try {
			await aiPatchService.applyAiOperations({
				payload: { operations },
				campaignSlug: "bestiary",
				sessionFile: "phase-52.json",
				entityScope: "mixed",
				permissions: {
					allowCharacters: true,
					allowNpcs: true,
					allowLocations: true,
				},
			});
			try {
				await aiPatchService.applyAiOperations({
					payload: {
						operations: [
							{
								op: "create",
								entity: "character",
								scope: "campaign",
								data: failingData,
							},
						],
					},
					campaignSlug: "bestiary",
					permissions: { allowCharacters: true },
				});
			} catch (error) {
				failure = error;
			}
		} finally {
			Object.assign(storage, originals);
		}

		assert.deepEqual(operations, operationsSnapshot);
		assert.deepEqual(failingData, failingSnapshot);
		assert.equal(failure?.message, "phase 52 write failed");
		const writes = events.filter((event) => event.kind === "write");
		assert.equal(writes.length, 9);
		assert.ok(writes.every((event) => event.payload.slug === event.slug));
		assert.equal(writes[0].slug, "existing-character-slug");
		assert.equal(writes[0].payload.trait, "Після оновлення");
		assert.equal(writes[3].slug, "supplied-npc-slug");
		assert.equal(writes[4].slug, 42);
		assert.deepEqual(
			events
				.filter((event) => event.kind === "slugify")
				.map((event) => event.baseName),
			["Київська Вежа", "Без", "Нуль", "npc", "locations", "Помилка"],
		);
		assert.deepEqual(
			events
				.filter((event) => event.kind === "allocate")
				.map(({ type, baseSlug }) => ({ type, baseSlug })),
			[
				{ type: "locations", baseSlug: "base:Київська Вежа" },
				{ type: "characters", baseSlug: "base:Без" },
				{ type: "npc", baseSlug: "base:Нуль" },
				{ type: "npc", baseSlug: "base:npc" },
				{ type: "locations", baseSlug: "base:locations" },
				{ type: "characters", baseSlug: "base:Помилка" },
			],
		);
		assert.equal(
			events.filter((event) => event.kind === "session-write").length,
			1,
		);
		assert.equal(session.data.npcs.length, 0);
		assert.equal(
			campaignEntities.characters.find(
				(entity) => entity.id === "existing-character",
			).slug,
			"existing-character-slug",
		);
		assert.equal(
			campaignEntities.locations.find(
				(entity) => entity.id === "blank-location",
			).slug,
			"base:locations:unique",
		);
	},
);

await run(
	"AI scene encounter links preserve payload precedence aliases and strict IDs",
	async () => {
		const sessions = new Map();
		const writes = [];
		let idQueue = [];
		let fallbackId = 0;
		const originals = {
			createId: storage.createId,
			readSession: storage.readSession,
			getBestiaryIndex: storage.getBestiaryIndex,
			writeJson: storage.writeJson,
		};
		storage.createId = () =>
			idQueue.length > 0 ? idQueue.shift() : `phase-53-${++fallbackId}`;
		storage.readSession = async (_campaignSlug, fileName) =>
			sessions.get(fileName) || null;
		storage.getBestiaryIndex = async () => new Map();
		storage.writeJson = async (_filePath, value) => {
			writes.push(value);
		};

		let discoveryResult;
		let resolutionResult;
		let zeroResult;
		const discoveryOperations = [
			{
				op: "CREATE",
				entity: "SCENES",
				data: {
					texts: { summary: "Дані мають пріоритет" },
					encounterClientId: "shared-link",
				},
				value: {
					texts: { summary: "Value не застосовувати" },
					encounterClientId: "value-not-used",
				},
				patch: { encounterClientId: "patch-not-used" },
			},
			{
				op: "create",
				entity: "scene",
				data: null,
				value: {
					texts: { summary: "Value застосовано" },
					encounterClientId: "shared-link",
				},
				patch: { encounterClientId: "patch-not-used" },
			},
			{
				op: "create",
				entity: "scene",
				data: "invalid",
				value: false,
				patch: {
					texts: { summary: "Patch fallback" },
					encounterClientId: "shared-link",
				},
			},
			{
				op: "create",
				entity: "scene",
				data: {
					texts: { summary: "Пробільний client ID" },
					encounterClientId: "   ",
				},
				patch: { encounterClientId: "suppressed-link" },
			},
			{
				op: "create",
				entity: "scene",
				data: [],
				value: {
					texts: { summary: "Array не пропускає value" },
					encounterClientId: "array-suppressed",
				},
			},
			{ op: "delete", entity: "scene", data: { encounterClientId: "delete-link" } },
			{
				op: "create",
				entity: "location",
				data: { name: "Не сцена", encounterClientId: "location-link" },
			},
			null,
			[],
			7,
			{
				op: "create",
				entity: "encounter",
				clientId: "shared-link",
				data: { name: "Спільна сутичка", monsters: [] },
			},
			{
				op: "create",
				entity: "encounter",
				clientId: "suppressed-link",
				data: { name: "Пригнічена сутичка", monsters: [] },
			},
			{
				op: "create",
				entity: "encounter",
				clientId: "array-suppressed",
				data: { name: "Array сутичка", monsters: [] },
			},
		];
		const discoverySnapshot = structuredClone(discoveryOperations);
		const discoverySession = {
			id: "discovery-session",
			data: {
				scenes: [],
				encounters: [],
				notes: [],
				npcs: [],
				locations: [],
			},
		};
		sessions.set("discovery.json", discoverySession);

		const resolutionSession = {
			id: "resolution-session",
			data: {
				scenes: [
					{
						id: "missing-map-scene",
						texts: { summary: "Немає мапи" },
						notes: [],
						npcs: [],
						encounterId: "old-missing",
					},
					{
						id: "same-id-scene",
						texts: { summary: "Старий exact текст" },
						notes: [],
						npcs: [],
						encounterId: "same-id",
					},
					{
						id: "typed-id-scene",
						texts: { summary: "Числовий ID" },
						notes: [],
						npcs: [],
						encounterId: 7,
					},
				],
				encounters: [],
				notes: [],
				npcs: [],
				locations: [],
			},
		};
		sessions.set("resolution.json", resolutionSession);

		const zeroSession = {
			id: "zero-session",
			data: {
				scenes: [
					{
						id: "zero-scene",
						texts: { summary: "Нульова мапа" },
						notes: [],
						npcs: [],
						encounterId: "old-zero",
					},
				],
				encounters: [],
				notes: [],
				npcs: [],
				locations: [],
			},
		};
		sessions.set("zero.json", zeroSession);

		try {
			idQueue = [
				"scene-data",
				"scene-value",
				"scene-patch",
				"scene-whitespace",
				"scene-array-skipped",
				"encounter-shared",
			];
			discoveryResult = await aiPatchService.applyAiOperations({
				payload: { operations: discoveryOperations },
				campaignSlug: "bestiary",
				sessionFile: "discovery.json",
				permissions: { allowEncounters: true, allowLocations: false },
			});

			idQueue = ["wrong-map-scene", "same-id", "7"];
			resolutionResult = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "update",
							entity: "scene",
							id: "missing-map-scene",
							patch: { encounterClientId: "відсутній" },
						},
						{
							op: "create",
							entity: "scene",
							clientId: "wrong-map",
							data: {
								texts: { summary: "Мапа веде на сцену" },
								encounterClientId: "wrong-map",
							},
						},
						{
							op: "update",
							entity: "scene",
							id: "missing-scene",
							patch: { encounterClientId: "missing-scene-link" },
						},
						{
							op: "update",
							entity: "scene",
							id: "same-id-scene",
							data: { texts: { summary: "Data не застосовувати" } },
							patch: {
								texts: { summary: "Patch має пріоритет" },
								encounterClientId: "same-client",
							},
						},
						{
							op: "create",
							entity: "encounter",
							clientId: "same-client",
							data: { name: "Exact encounter", monsters: [] },
						},
						{
							op: "update",
							entity: "scenes",
							id: "typed-id-scene",
							patch: { encounterClientId: "typed-client" },
						},
						{
							op: "create",
							entity: "encounter",
							clientId: "typed-client",
							data: { name: "Typed encounter", monsters: [] },
						},
					],
				},
				campaignSlug: "bestiary",
				sessionFile: "resolution.json",
				permissions: { allowEncounters: true },
			});

			idQueue = [0];
			zeroResult = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "update",
							entity: "scene",
							id: "zero-scene",
							patch: { encounterClientId: "zero-client" },
						},
						{
							op: "create",
							entity: "encounter",
							clientId: "zero-client",
							data: { name: "Zero encounter", monsters: [] },
						},
					],
				},
				campaignSlug: "bestiary",
				sessionFile: "zero.json",
				permissions: { allowEncounters: true },
			});
		} finally {
			Object.assign(storage, originals);
		}

		assert.deepEqual(discoveryOperations, discoverySnapshot);
		assert.equal(discoverySession.data.scenes.length, 4);
		assert.deepEqual(
			discoverySession.data.scenes.map((scene) => scene.texts.summary),
			[
				"Дані мають пріоритет",
				"Value застосовано",
				"Patch fallback",
				"Пробільний client ID",
			],
		);
		assert.equal(discoverySession.data.encounters.length, 1);
		assert.ok(
			discoverySession.data.scenes
				.slice(0, 3)
				.every((scene) => scene.encounterId === "encounter-shared"),
		);
		assert.equal(discoverySession.data.scenes[3].encounterId, "");
		assert.ok(
			discoveryResult.warnings.some((warning) =>
				warning.includes("Skipped empty scene create"),
			),
		);
		assert.ok(
			discoveryResult.warnings.some((warning) =>
				warning.includes('scene encounterClientId "suppressed-link"'),
			),
		);
		assert.ok(
			discoveryResult.warnings.some((warning) =>
				warning.includes('scene encounterClientId "array-suppressed"'),
			),
		);

		const resolvedById = new Map(
			resolutionSession.data.scenes.map((scene) => [scene.id, scene]),
		);
		assert.equal(
			resolvedById.get("same-id-scene").texts.summary,
			"Patch має пріоритет",
		);
		assert.equal(
			resolvedById.get("same-id-scene").encounterId,
			"same-id",
		);
		assert.equal(resolvedById.get("typed-id-scene").encounterId, "7");
		assert.deepEqual(resolutionResult.warnings, [
			'Scene encounterClientId "відсутній" could not be resolved to a created encounter.',
			'Scene encounterClientId "wrong-map" could not be resolved to a created encounter.',
		]);
		assert.equal(
			resolutionResult.warnings.some((warning) =>
				warning.includes("missing-scene-link"),
			),
			false,
		);

		assert.equal(zeroSession.data.scenes[0].encounterId, "old-zero");
		assert.equal(zeroSession.data.encounters[0].id, 0);
		assert.deepEqual(zeroResult.warnings, [
			'Scene encounterClientId "zero-client" could not be resolved to a created encounter.',
		]);
		assert.equal(writes.length, 3);
	},
);

await run(
	"AI entity dispatcher preserves move and effective-scope routing",
	async () => {
		const campaignEntities = {
			characters: [],
			npc: [],
			locations: [],
		};
		const session = {
			id: "phase-54-session",
			data: {
				scenes: [],
				encounters: [],
				notes: [],
				npcs: [
					{
						id: "move-me",
						slug: "move-me",
						firstName: "Рухома",
						lastName: "Варта",
						trait: "До руху",
						notes: [],
					},
				],
				locations: [],
			},
		};
		const operations = [
			{
				op: "create",
				entity: "PC",
				scope: "session",
				data: { name: "Кампанійний Герой" },
			},
			{
				op: "create",
				entity: "NPCS",
				clientId: "session-client",
				data: { name: "Сесійна Мапа", trait: "До mapping" },
			},
			{
				op: "update",
				entity: "npc",
				targetClientId: "session-client",
				scope: "invalid",
				patch: { trait: "Mapped session route" },
			},
			{
				op: "create",
				entity: "location",
				data: { name: "Сесійна Локація" },
			},
			{
				op: "create",
				entity: "FACTIONS",
				scope: "campaign",
				data: { name: "Кампанійна Фракція" },
			},
			{
				op: "MOVESCOPE",
				entity: "npc",
				id: "move-me",
				scope: "session",
				from: "session",
				to: "campaign",
			},
			{
				op: "create",
				entity: "unknown-entity",
				scope: "campaign",
				data: { name: "Не застосовувати" },
			},
		];
		const operationsSnapshot = structuredClone(operations);
		const events = [];
		let generatedId = 0;
		const originals = {
			createId: storage.createId,
			listEntities: storage.listEntities,
			campaignSlug: storage.campaignSlug,
			ensureUniqueEntitySlug: storage.ensureUniqueEntitySlug,
			writeEntity: storage.writeEntity,
			deleteEntity: storage.deleteEntity,
			updateCampaignMentionReferences:
				storage.updateCampaignMentionReferences,
			readSession: storage.readSession,
			writeJson: storage.writeJson,
		};
		storage.createId = () => `phase-54-${++generatedId}`;
		storage.listEntities = async (_campaignSlug, type) =>
			campaignEntities[type] || [];
		storage.campaignSlug = (name) => `route-${String(name)}`;
		storage.ensureUniqueEntitySlug = async (_campaignSlug, _type, slug) =>
			slug;
		storage.writeEntity = async (_campaignSlug, type, slug, payload) => {
			events.push({ kind: "campaign-write", type, slug });
			if (payload.firstName === "Помилка") {
				throw new Error("phase 54 delegated write failed");
			}
			const saved = { ...payload, slug };
			const list = campaignEntities[type] || (campaignEntities[type] = []);
			const index = list.findIndex(
				(entity) => entity.id === saved.id || entity.slug === slug,
			);
			if (index >= 0) list[index] = saved;
			else list.push(saved);
			return saved;
		};
		storage.deleteEntity = async (_campaignSlug, type, slug) => {
			campaignEntities[type] = (campaignEntities[type] || []).filter(
				(entity) => entity.slug !== slug,
			);
		};
		storage.updateCampaignMentionReferences = async () => {};
		storage.readSession = async () => session;
		storage.writeJson = async () => {
			events.push({ kind: "session-write" });
		};

		let result;
		let noSessionResult;
		let failure;
		try {
			result = await aiPatchService.applyAiOperations({
				payload: { operations },
				campaignSlug: "bestiary",
				sessionFile: "phase-54.json",
				entityScope: "session",
				permissions: {
					allowCharacters: true,
					allowNpcs: true,
					allowLocations: true,
				},
			});
			noSessionResult = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "create",
							entity: "npc",
							data: { name: "Без Сесії" },
						},
					],
				},
				campaignSlug: "bestiary",
				entityScope: "session",
				permissions: { allowNpcs: true },
			});
			try {
				await aiPatchService.applyAiOperations({
					payload: {
						operations: [
							{
								op: "create",
								entity: "player-character",
								scope: "session",
								data: { name: "Помилка Маршруту" },
							},
						],
					},
					campaignSlug: "bestiary",
					permissions: { allowCharacters: true },
				});
			} catch (error) {
				failure = error;
			}
		} finally {
			Object.assign(storage, originals);
		}

		assert.deepEqual(operations, operationsSnapshot);
		assert.equal(result.updated.fileName, "phase-54.json");
		assert.equal(noSessionResult.updated, null);
		assert.equal(failure?.message, "phase 54 delegated write failed");
		assert.deepEqual(
			events
				.filter((event) => event.kind === "campaign-write")
				.map(({ type }) => type),
			["characters", "locations", "npc", "npc", "characters"],
		);
		assert.equal(
			events.filter((event) => event.kind === "session-write").length,
			1,
		);
		assert.equal(campaignEntities.characters[0].firstName, "Кампанійний");
		assert.equal(campaignEntities.locations[0].name, "Кампанійна Фракція");
		assert.equal(
			campaignEntities.npc.some((entity) => entity.id === "move-me"),
			true,
		);
		assert.equal(
			session.data.npcs.some((entity) => entity.id === "move-me"),
			false,
		);
		const mappedSessionNpc = session.data.npcs.find(
			(entity) => entity.firstName === "Сесійна",
		);
		assert.equal(mappedSessionNpc.trait, "Mapped session route");
		assert.equal(session.data.locations[0].name, "Сесійна Локація");
		assert.equal(
			campaignEntities.npc.some(
				(entity) => entity.firstName === "Без" && entity.lastName === "Сесії",
			),
			true,
		);
		assert.equal(
			campaignEntities.locations.some(
				(entity) => entity.name === "Не застосовувати",
			),
			false,
		);
	},
);

await run(
	"AI patch service preserves disabled-encounter scene rules and missing-session warnings",
	async () => {
		await withTestSlug("ai-scene-permissions", async (slug) => {
			await storage.ensureDir(path.join(storage.campaignDir(slug), "sessions"));
			await storage.writeJson(storage.campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Заборонені енкаунтери",
				description: "",
				notes: [],
			});
			await storage.writeJson(storage.sessionPath(slug, "session.json"), {
				id: "session-id",
				name: "Сесія",
				data: {
					scenes: [
						{
							id: "scene-existing",
							texts: { summary: "Стара сцена." },
							notes: [],
							npcs: [],
							encounterId: "keep-encounter",
						},
					],
					encounters: [],
					notes: [],
					npcs: [],
					locations: [],
				},
			});

			const result = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "create",
							entity: "scene",
							data: { encounterId: "blocked", encounterClientId: "blocked-client" },
						},
						{
							op: "create",
							entity: "scene",
							data: {
								texts: { summary: "Дозволений текст." },
								encounterId: "blocked",
								encounterClientId: "blocked-client",
							},
						},
						{
							op: "update",
							entity: "scene",
							id: "scene-existing",
							patch: {
								texts: { summary: "Оновлена сцена." },
								encounterId: "replacement",
								encounterClientId: "future-encounter",
							},
						},
						{
							op: "create",
							entity: "encounter",
							clientId: "future-encounter",
							data: { name: "Не створювати" },
						},
					],
				},
				campaignSlug: slug,
				sessionFile: "session.json",
				entityScope: "session",
				permissions: { allowEncounters: false },
			});

			const session = await storage.readSession(slug, "session.json");
			assert.equal(session.data.scenes.length, 2);
			assert.equal(session.data.scenes[0].encounterId, "keep-encounter");
			assert.equal(session.data.scenes[0].texts.summary, "Оновлена сцена.");
			assert.equal(session.data.scenes[1].encounterId, "");
			assert.equal(session.data.encounters.length, 0);
			assert.ok(
				result.warnings.some((warning) =>
					warning.includes("Skipped empty scene create"),
				),
			);
			assert.ok(
				result.warnings.some((warning) =>
					warning.includes("encounter generation disabled"),
				),
			);
			assert.ok(
				result.warnings.some((warning) =>
					warning.includes('encounterClientId "future-encounter" could not be resolved'),
				),
			);

			const missingSessionResult = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "create",
							entity: "scene",
							data: { texts: { summary: "Немає сесії." } },
						},
					],
				},
				campaignSlug: slug,
				sessionFile: "missing-session.json",
			});
			assert.equal(missingSessionResult.updated, null);
			assert.ok(
				missingSessionResult.warnings.some((warning) =>
					warning.includes("no session target"),
				),
			);
		});
	},
);

await run(
	"AI patch service applies encounter lifecycle with focused fallback and normalized monsters",
	async () => {
		const focusedEncounter = {
			id: "focused-encounter",
			name: "Старий бій",
			monsters: [{ name: "Старий учасник" }],
		};
		const deletedEncounter = {
			id: "delete-encounter",
			name: "Видалити",
			monsters: [],
		};
		const preservedEncounter = {
			id: "preserve-encounter",
			name: "Зберегти учасників",
			monsters: [{ id: "manual-monster", name: "Ручний звір", source: "HOME" }],
		};
		const session = {
			id: "session-id",
			name: "Сесія",
			data: {
				scenes: [
					{
						id: "link-scene",
						texts: { summary: "Майбутня засідка." },
						notes: [],
						npcs: [],
						encounterId: "",
					},
				],
				encounters: [focusedEncounter, preservedEncounter, deletedEncounter],
				notes: [],
				npcs: [],
				locations: [],
			},
		};
		const bestiaryIndex = new Map([
			[
				"вовк|MM",
				{
					id: "wolf-base",
					name: "Вовк",
					source: "MM",
					hp: { average: 11 },
					ac: [{ ac: 13 }],
				},
			],
		]);
		const originalReadSession = storage.readSession;
		const originalGetBestiaryIndex = storage.getBestiaryIndex;
		const originalWriteJson = storage.writeJson;
		let indexReads = 0;
		let sessionWrites = 0;
		storage.readSession = async () => session;
		storage.getBestiaryIndex = async () => {
			indexReads += 1;
			return bestiaryIndex;
		};
		storage.writeJson = async () => {
			sessionWrites += 1;
		};

		let result;
		try {
			result = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "update",
							entity: "encounter",
							patch: {
								name: "Оновлений бій",
								monsters: [
									{ monsterName: "Вовк" },
									{
										monsterName: "Невідомий звір",
										name: "Іменний звір",
										source: "HOME",
									},
									{},
								],
							},
						},
						{
							op: "update",
							entity: "encounters",
							targetId: "preserve-encounter",
							patch: { name: "Перейменовано без monsters" },
						},
						{
							op: "update",
							entity: "scene",
							id: "link-scene",
							patch: { encounterClientId: "new-encounter" },
						},
						{
							op: "create",
							entity: "encounter",
							clientId: "new-encounter",
							data: {
								name: "Нова засідка",
								monsters: [{ monsterName: "Вовк" }],
							},
						},
						{ op: "delete", entity: "encounter", id: "delete-encounter" },
						{
							op: "update",
							entity: "encounter",
							targetId: "missing",
							patch: { name: "Не застосовувати" },
						},
						{ op: "delete", entity: "encounter", targetId: "missing" },
						{ op: "unsupported", entity: "encounter" },
					],
				},
				campaignSlug: "bestiary",
				sessionFile: "session.json",
				encounterId: "focused-encounter",
				permissions: { allowEncounters: true },
			});
		} finally {
			storage.readSession = originalReadSession;
			storage.getBestiaryIndex = originalGetBestiaryIndex;
			storage.writeJson = originalWriteJson;
		}

		assert.equal(indexReads, 7);
		assert.equal(sessionWrites, 1);
		assert.equal(result.updated.fileName, "session.json");
		assert.equal(result.updated.data.encounters.length, 3);
		assert.equal(result.updated.data.encounters[0], focusedEncounter);
		assert.equal(focusedEncounter.name, "Оновлений бій");
		assert.equal(focusedEncounter.monsters.length, 2);
		assert.equal(focusedEncounter.monsters[0].id, "wolf-base");
		assert.equal(focusedEncounter.monsters[0].originalBestiaryName, "Вовк");
		assert.equal(focusedEncounter.monsters[0].currentHp, 11);
		assert.equal(focusedEncounter.monsters[0].hit_points, 11);
		assert.equal(focusedEncounter.monsters[0].armor_class, 13);
		assert.ok(focusedEncounter.monsters[0].instanceId.startsWith("inst-"));
		assert.equal(focusedEncounter.monsters[1].name, "Іменний звір");
		assert.equal(
			focusedEncounter.monsters[1].originalBestiaryName,
			"Невідомий звір",
		);
		assert.equal(focusedEncounter.monsters[1].source, "HOME");
		assert.equal(focusedEncounter.monsters[1].currentHp, 0);
		assert.equal(preservedEncounter.name, "Перейменовано без monsters");
		assert.equal(preservedEncounter.monsters.length, 1);
		assert.equal(preservedEncounter.monsters[0].id, "manual-monster");
		assert.equal(preservedEncounter.monsters[0].name, "Ручний звір");
		const created = result.updated.data.encounters[2];
		assert.equal(created.name, "Нова засідка");
		assert.notEqual(created.id, "new-encounter");
		assert.equal(result.updated.data.scenes[0].encounterId, created.id);
		assert.deepEqual(result.warnings, []);
	},
);

await run(
	"AI patch service projects encounter participants with stable lookup and combat precedence",
	async () => {
		const session = {
			id: "session-id",
			data: {
				scenes: [
					{
						id: "scene-id",
						texts: { summary: "Засідка біля брами." },
						notes: [],
						npcs: [],
						encounterId: "",
					},
				],
				encounters: [],
				notes: [],
				npcs: [],
				locations: [],
			},
		};
		const bestiaryIndex = new Map([
			[
				"варта|FIRST",
				{
					id: "first-guard",
					name: "Варта першого джерела",
					source: "FIRST",
					hit_points: 17,
					armor_class: 14,
					marker: "first-match",
				},
			],
			[
				"варта|SECOND",
				{
					id: "second-guard",
					name: "Варта другого джерела",
					source: "SECOND",
					hit_points: 99,
					armor_class: 20,
				},
			],
			[
				"ведмідь|MODERN",
				{
					id: "bear-base",
					name: "Ведмідь",
					source: "MODERN",
					hp: { average: 22 },
					ac: [15],
				},
			],
			[
				"привид|MALFORMED",
				{
					name: "Привид",
					source: "MALFORMED",
					hp: null,
					hit_points: 9,
					ac: [0],
					armor_class: 12,
				},
			],
		]);
		const originalReadSession = storage.readSession;
		const originalGetBestiaryIndex = storage.getBestiaryIndex;
		const originalWriteJson = storage.writeJson;
		const originalDateNow = Date.now;
		const originalMathRandom = Math.random;
		storage.readSession = async () => session;
		storage.getBestiaryIndex = async () => bestiaryIndex;
		storage.writeJson = async () => {};
		Date.now = () => 123456;
		Math.random = () => 0.4567;

		let result;
		try {
			result = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "update",
							entity: "scene",
							id: "scene-id",
							patch: { encounterClientId: "projected-encounter" },
						},
						{
							op: "create",
							entity: "encounter",
							clientId: "projected-encounter",
							data: {
								name: "Проєкція учасників",
								monsters: [
									{
										id: "caller-guard",
										monsterName: "Варта",
										name: "Варта героя",
										source: "CALLER",
									},
									{ monsterName: "Ведмідь" },
									{ monsterName: "Привид" },
									{ monsterName: "Невідомий", source: "UA-HOME" },
									{},
								],
							},
						},
					],
				},
				campaignSlug: "bestiary",
				sessionFile: "session.json",
				permissions: { allowEncounters: true },
			});
		} finally {
			storage.readSession = originalReadSession;
			storage.getBestiaryIndex = originalGetBestiaryIndex;
			storage.writeJson = originalWriteJson;
			Date.now = originalDateNow;
			Math.random = originalMathRandom;
		}

		const monsters = result.updated.data.encounters[0].monsters;
		assert.equal(monsters.length, 4);
		assert.deepEqual(
			monsters.map((monster) => monster.instanceId),
			Array(4).fill("inst-123456-4567"),
		);
		assert.equal(monsters[0].id, "caller-guard");
		assert.equal(monsters[0].name, "Варта героя");
		assert.equal(monsters[0].originalBestiaryName, "Варта першого джерела");
		assert.equal(monsters[0].source, "FIRST");
		assert.equal(monsters[0].marker, "first-match");
		assert.equal(monsters[0].currentHp, 17);
		assert.equal(monsters[0].hit_points, 17);
		assert.equal(monsters[0].armor_class, 14);
		assert.equal(monsters[1].id, "bear-base");
		assert.equal(monsters[1].currentHp, 22);
		assert.equal(monsters[1].armor_class, 15);
		assert.ok(monsters[2].id);
		assert.equal(monsters[2].currentHp, 9);
		assert.equal(monsters[2].hit_points, 9);
		assert.equal(monsters[2].armor_class, 12);
		assert.equal(monsters[3].name, "Невідомий");
		assert.equal(monsters[3].originalBestiaryName, "Невідомий");
		assert.equal(monsters[3].source, "UA-HOME");
		assert.equal(monsters[3].currentHp, 0);
		assert.equal(monsters[3].hit_points, 0);
		assert.equal(monsters[3].armor_class, 0);
		assert.deepEqual(result.warnings, []);
	},
);

await run(
	"AI patch service validates encounter eligibility and create links before mutation",
	async () => {
		const originalReadSession = storage.readSession;
		const originalGetBestiaryIndex = storage.getBestiaryIndex;
		const originalWriteJson = storage.writeJson;
		const session = {
			id: "session-id",
			data: {
				scenes: [],
				encounters: [],
				notes: [],
				npcs: [],
				locations: [],
			},
		};
		let indexReads = 0;
		storage.readSession = async (_campaign, fileName) =>
			fileName === "missing.json" ? null : session;
		storage.getBestiaryIndex = async () => {
			indexReads += 1;
			return new Map();
		};
		storage.writeJson = async () => {};

		let missingSessionResult;
		let disabledResult;
		let invalidCreateResult;
		try {
			missingSessionResult = await aiPatchService.applyAiOperations({
				payload: {
					operations: [{ op: "delete", entity: "encounter", id: "x" }],
				},
				campaignSlug: "bestiary",
				sessionFile: "missing.json",
			});
			disabledResult = await aiPatchService.applyAiOperations({
				payload: {
					operations: [{ op: "update", entity: "encounter", id: "x" }],
				},
				campaignSlug: "bestiary",
				sessionFile: "session.json",
				permissions: { allowEncounters: false },
			});
			invalidCreateResult = await aiPatchService.applyAiOperations({
				payload: {
					operations: [
						{
							op: "create",
							entity: "encounter",
							data: {},
						},
						{
							op: "create",
							entity: "encounter",
							clientId: "unlinked",
							data: { name: "Неприв'язана засідка" },
						},
						{ op: "update", entity: "encounter", targetId: "missing" },
						{ op: "delete", entity: "encounter", targetId: "missing" },
						{ op: "unsupported", entity: "encounter" },
					],
				},
				campaignSlug: "bestiary",
				sessionFile: "session.json",
				permissions: { allowEncounters: true },
			});
		} finally {
			storage.readSession = originalReadSession;
			storage.getBestiaryIndex = originalGetBestiaryIndex;
			storage.writeJson = originalWriteJson;
		}

		assert.equal(indexReads, 5);
		assert.equal(missingSessionResult.updated, null);
		assert.ok(
			missingSessionResult.warnings.some((warning) =>
				warning.includes("no session target"),
			),
		);
		assert.equal(disabledResult.updated, null);
		assert.ok(
			disabledResult.warnings.some((warning) =>
				warning.includes("encounter generation disabled"),
			),
		);
		assert.equal(invalidCreateResult.updated, null);
		assert.equal(session.data.encounters.length, 0);
		assert.ok(
			invalidCreateResult.warnings.some((warning) =>
				warning.includes('create "Encounter 1"; new encounters must use clientId'),
			),
		);
		assert.ok(
			invalidCreateResult.warnings.some((warning) =>
				warning.includes(
					'create "Неприв\'язана засідка" without matching scene encounterClientId "unlinked"',
				),
			),
		);
	},
);

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
	"AI patch service persists campaign before session and returns the session",
	async () => {
		await withTestSlug("ai-persistence-order", async (slug) => {
			await storage.ensureDir(path.join(storage.campaignDir(slug), "sessions"));
			await storage.writeJson(storage.campaignMetaPath(slug), {
				id: "campaign-id",
				name: "Порядок запису",
				description: "Старий опис.",
				notes: [],
			});
			await storage.writeJson(storage.sessionPath(slug, "session.json"), {
				id: "session-id",
				name: "Сесія",
				data: {
					scenes: [],
					encounters: [],
					notes: [],
					npcs: [],
					locations: [],
				},
			});

			const originalWriteJson = storage.writeJson;
			const writes = [];
			storage.writeJson = async (...args) => {
				writes.push(args[0]);
				return originalWriteJson(...args);
			};
			let result;
			try {
				result = await aiPatchService.applyAiOperations({
					payload: {
						operations: [
							null,
							{ op: "update", entity: "unknown", patch: {} },
							{ op: "update", entity: "toString", patch: {} },
							{
								op: "appendNote",
								entity: "constructor",
								note: { text: "Не застосовувати." },
							},
							{
								op: "update",
								entity: "campaign",
								patch: { description: "Новий опис." },
							},
							{
								op: "create",
								entity: "scene",
								data: { texts: { summary: "Нова сцена." } },
							},
						],
					},
					campaignSlug: slug,
					sessionFile: "session.json",
					entityScope: "mixed",
					permissions: { allowEncounters: false },
				});
			} finally {
				storage.writeJson = originalWriteJson;
			}

			assert.deepEqual(writes, [
				storage.campaignMetaPath(slug),
				storage.sessionPath(slug, "session.json"),
			]);
			assert.equal(result.updated.fileName, "session.json");
			assert.equal(result.updated.data.scenes[0].texts.summary, "Нова сцена.");
			assert.equal((await storage.readCampaign(slug)).description, "Новий опис.");
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
		resolveSelectedPromptSettings({
			scope: GLOBAL_SETTINGS_SCOPE,
			aiBasePrompt: "Глобальна інструкція",
			imagePromptBasePrompt: "Глобальний стиль",
			campaignAiBasePrompts: { "curse-of-strahd": "Кампанія" },
			campaignImagePromptBasePrompts: { "curse-of-strahd": "Туман" },
		}),
		{
			isGlobalScope: true,
			basePrompt: "Глобальна інструкція",
			imagePrompt: "Глобальний стиль",
		},
	);
	assert.deepEqual(
		resolveSelectedPromptSettings({
			scope: "curse-of-strahd",
			aiBasePrompt: "Global",
			imagePromptBasePrompt: "Global image",
			campaignAiBasePrompts: { "curse-of-strahd": "Політична кампанія" },
			campaignImagePromptBasePrompts: {},
		}),
		{
			isGlobalScope: false,
			basePrompt: "Політична кампанія",
			imagePrompt: "",
		},
	);
	assert.deepEqual(
		resolveSelectedSourceSettings({
			scope: "missing",
			ignoreSourcesList: ["PHB"],
			campaignIgnoreSourcesLists: {},
		}),
		{ isGlobalScope: false, ignoreSourcesList: ["PHB"] },
	);
	assert.deepEqual(
		setCampaignIgnoreSourcesForScope(
			{ existing: ["MM"] },
			"curse-of-strahd",
			[" phb ", "PHB", "mm"],
		),
		{ existing: ["MM"], "curse-of-strahd": ["MM", "PHB"] },
	);
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
			"src/app/routing/ProjectGuide.tsx",
			"utf8",
		);
		const mainContentSource = await fs.readFile(
			"src/app/routing/MainContent.tsx",
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
			"src/pages/campaign/ui/CampaignPage.tsx",
			"utf8",
		);
		const sessionViewSource = await fs.readFile(
			"src/pages/session/ui/SessionPage.tsx",
			"utf8",
		);
		const noteCardSource = await fs.readFile(
			"src/features/notes/ui/NoteCard.tsx",
			"utf8",
		);
		const noteCardPartsSource = await fs.readFile(
			"src/features/notes/ui/NoteCardParts.tsx",
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
		const mentionSelectionPolicySource = await fs.readFile(
			"src/features/editor/model/mentionSelectionPolicy.ts",
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
			"src/pages/campaign/ui/components/CampaignNotesGraph.tsx",
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
			"src/pages/session/ui/components/SceneCardFields.tsx",
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
		assert.match(
			mentionSelectionPolicySource,
			/offset <= MENTION_BOUNDARY\.length/,
		);
		assert.match(mentionEditorSource, /getMentionBeforeCollapsedSelection/);
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
		assert.match(noteCardSource, /<NoteCardHeader/);
		assert.match(noteCardSource, /<NoteCardBody/);
		assert.match(noteCardPartsSource, /enableHistory=\{enableHistory\}/);
		assert.match(noteCardPartsSource, /type="textarea"/);
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
	const ukrainianSpirit = {
		name: "Лісовий Дух",
		type: {
			type: "фея",
			tags: ["дух", "охоронець"],
		},
	};

	assert.equal(getMonsterTypeString("beast"), "beast");
	assert.equal(getMonsterTypeString({ type: "dragon" }), "dragon");
	assert.equal(
		getMonsterTypeString({ type: { choose: ["fiend", "undead"] } }),
		"fiend/undead",
	);
	assert.equal(getMonsterTypeString({ type: null }), "");
	assert.equal(getMonsterTypeString({ type: { choose: [] } }), "");
	assert.equal(getMonsterTypeString({ type: { choose: "fiend" } }), "");
	assert.equal(getMonsterTypeString(null), "");
	assert.equal(getMonsterTypeString(42), "");
	assert.equal(matchesMonsterSearch(dragon, ""), true);
	assert.equal(matchesMonsterSearch(dragon, "   "), true);
	assert.equal(matchesMonsterSearch(dragon, 0), true);
	assert.equal(matchesMonsterSearch(dragon, false), true);
	assert.equal(matchesMonsterSearch(dragon, "red"), true);
	assert.equal(matchesMonsterSearch(dragon, "dragon"), true);
	assert.equal(matchesMonsterSearch(dragon, "chromatic"), true);
	assert.equal(matchesMonsterSearch(dragon, "DRAGON FIRE"), true);
	assert.equal(matchesMonsterSearch(dragon, "construct"), false);
	assert.equal(matchesMonsterSearch(chooser, "undead"), true);
	assert.equal(matchesMonsterSearch(chooser, "shapechanger"), true);
	assert.equal(matchesMonsterSearch(ukrainianSpirit, "  ЛІСОВИЙ дух "), true);
	assert.equal(matchesMonsterSearch({ name: "Legacy", type: "UNDEAD" }, "undead"), true);
	assert.equal(
		matchesMonsterSearch(
			{ name: "Odd tags", type: { type: "aberration", tags: [0, false, null, "dream"] } },
			"false",
		),
		true,
	);
	assert.equal(
		matchesMonsterSearch(
			{ name: "Ignored tags", type: { type: "beast", tags: "forest" } },
			"forest",
		),
		false,
	);
	assert.equal(
		matchesMonsterSearch({ name: "Null type", type: { type: null } }, "dragon"),
		false,
	);
	assert.equal(matchesMonsterSearch(null, "dragon"), false);
	assert.equal(matchesMonsterSearch(undefined, "dragon"), false);
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

await run("dice term projection preserves ordering ties and keep bounds", () => {
	const originalRandom = Math.random;
	let rollIndex = 0;
	const setRolls = (values) => {
		rollIndex = 0;
		Math.random = () => values[rollIndex++];
	};

	try {
		setRolls([0.5, 0.5, 0, 0.999]);
		const keepHighest = rollDiceFormula("4d6h2");
		assert.equal(keepHighest.total, 10);
		assert.equal(keepHighest.average, 7);
		assert.equal(keepHighest.min, 2);
		assert.equal(keepHighest.max, 12);
		assert.equal(keepHighest.formula, "4d6h2");
		assert.deepEqual(
			keepHighest.breakdown.map((roll) => Boolean(roll.dropped)),
			[false, true, true, false],
		);

		setRolls([0.5, 0.5, 0, 0.999]);
		const keepLowest = rollDiceFormula("4d6l2");
		assert.equal(keepLowest.total, 5);
		assert.equal(keepLowest.average, 7);
		assert.deepEqual(
			keepLowest.breakdown.map((roll) => Boolean(roll.dropped)),
			[false, true, false, true],
		);

		setRolls([0, 0.5, 0.999]);
		const keepNone = rollDiceFormula("3d6h0");
		assert.equal(keepNone.total, 0);
		assert.equal(keepNone.average, 0);
		assert.equal(keepNone.min, 0);
		assert.equal(keepNone.max, 0);
		assert.equal(keepNone.formula, "3d6h0");
		assert.ok(keepNone.breakdown.every((roll) => roll.dropped));

		setRolls([0, 0.5, 0.999]);
		const plain = rollDiceFormula("3d6");
		assert.equal(plain.total, 11);
		assert.equal(plain.average, 10);
		assert.equal(plain.min, 3);
		assert.equal(plain.max, 18);
		assert.ok(plain.breakdown.every((roll) => !roll.dropped));

		setRolls([0, 0.999]);
		const boundedKeep = rollDiceFormula("2d6h5");
		assert.equal(boundedKeep.total, 7);
		assert.equal(boundedKeep.min, 2);
		assert.equal(boundedKeep.max, 12);
		assert.ok(boundedKeep.breakdown.every((roll) => !roll.dropped));
	} finally {
		Math.random = originalRandom;
	}
});

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

await run("dice expression parsing preserves precedence unary and invalid formulas", () => {
	const precedence = rollDiceFormula("2 + 3 * 4");
	assert.equal(precedence.total, 14);
	assert.equal(precedence.average, 14);
	assert.equal(precedence.expressionBreakdown, "2 + 3 * 4");
	assert.equal(precedence.formula, "2 + 3 * 4");

	const grouped = rollDiceFormula("(2 + 3) * 4");
	assert.equal(grouped.total, 20);
	assert.equal(grouped.expressionBreakdown, "(2 + 3) * 4");
	assert.equal(rollDiceFormula("--2").total, 2);
	assert.equal(rollDiceFormula("+-2").total, -2);
	assert.equal(rollDiceFormula("-(2 + 3) * 2").total, -10);

	const legacyUnaryFallback = rollDiceFormula("-");
	assert.ok(Object.is(legacyUnaryFallback.total, -0));
	assert.equal(legacyUnaryFallback.formula, "-1");
	assert.deepEqual(legacyUnaryFallback.breakdown, [{ val: -1, max: null }]);

	for (const formula of ["1+", "()", "(1+2", "1/2", "2**3"]) {
		const invalid = rollDiceFormula(formula);
		assert.equal(invalid.total, 0, formula);
		assert.equal(invalid.formula, "", formula);
		assert.deepEqual(invalid.breakdown, [], formula);
	}
});

await run("dice tokenization preserves precedence cursor and failure contracts", () => {
	const shorthand = getDiceProbabilityDistribution(" D 6 ");
	assert.equal(shorthand.formula, "D6");
	assert.equal(shorthand.outcomes.length, 6);
	assert.equal(shorthand.min, 1);
	assert.equal(shorthand.max, 6);

	const zeroCount = getDiceProbabilityDistribution("0d6");
	assert.deepEqual(zeroCount.outcomes, shorthand.outcomes);
	const leadingZeros = getDiceProbabilityDistribution("02d006h01");
	assert.equal(leadingZeros.formula, "02d006h01");
	assert.equal(leadingZeros.min, 1);
	assert.equal(leadingZeros.max, 6);

	const joinedWhitespace = getDiceProbabilityDistribution("1 2");
	assert.deepEqual(joinedWhitespace.outcomes, [{ value: 12, probability: 1 }]);
	assert.equal(joinedWhitespace.formula, "12");
	const leadingZeroNumber = getDiceProbabilityDistribution("1d2 + 002");
	assert.equal(leadingZeroNumber.formula, "1d2 + 002");
	assert.deepEqual(leadingZeroNumber.outcomes, [
		{ value: 3, probability: 0.5 },
		{ value: 4, probability: 0.5 },
	]);

	for (const formula of [
		".",
		"/",
		"1d",
		"d",
		"2d6h",
		"2d6x1",
		"2d6h2l1",
		"1d6.5",
		"1,2",
		"@",
	]) {
		assert.equal(getDiceProbabilityDistribution(formula), null, formula);
		const roll = rollDiceFormula(formula);
		assert.equal(roll.formula, "", formula);
		assert.deepEqual(roll.breakdown, [], formula);
	}
});

await run("dice roll result projection preserves critical and formatting contracts", () => {
	const originalRandom = Math.random;
	const originalNow = Date.now;
	Date.now = () => 24680;

	try {
		Math.random = () => 0;
		const mixedCritical = rollDiceFormula("1d20 + 1d6");
		assert.equal(mixedCritical.id, 24680);
		assert.equal(mixedCritical.isCritical, true);
		assert.equal(mixedCritical.total, 1);
		assert.equal(mixedCritical.average, 14);
		assert.equal(mixedCritical.formula, "1d20 + 1d6");
		assert.equal(mixedCritical.expressionBreakdown, "");

		Math.random = () => 0.999;
		const multipliedCritical = rollDiceFormula("1d20 * 2");
		assert.equal(multipliedCritical.isCritical, true);
		assert.equal(multipliedCritical.total, 20);
		assert.equal(multipliedCritical.expressionBreakdown, "20 * 2");
		assert.equal(multipliedCritical.max, 40);

		let rollIndex = 0;
		Math.random = () => [0, 0.999][rollIndex++];
		const multipleD20s = rollDiceFormula("2d20");
		assert.equal(multipleD20s.isCritical, false);
		assert.equal(multipleD20s.total, 21);

		rollIndex = 0;
		Math.random = () => [0, 0.999][rollIndex++];
		const keptD20 = rollDiceFormula("2d20h1");
		assert.equal(keptD20.isCritical, false);
		assert.equal(keptD20.total, 20);

		Math.random = () => 0;
		const preservedInputCase = rollDiceFormula("1D6*2");
		assert.equal(preservedInputCase.formula, "1D6 * 2");
		assert.equal(preservedInputCase.expressionBreakdown, "1 * 2");

		Math.random = () => 0.5;
		assert.equal(rollDiceFormula("-1d2").average, -2);

		const invalidToken = rollDiceFormula("невірно");
		assert.deepEqual(invalidToken, {
			id: 24680,
			formula: "",
			breakdown: [],
			total: 0,
			average: 0,
			min: 0,
			max: 0,
			isCritical: false,
		});
		assert.equal("expressionBreakdown" in invalidToken, false);
		assert.deepEqual(rollDiceFormula("1+"), invalidToken);
		assert.equal(rollDiceFormula(0), null);
		assert.equal(rollDiceFormula(false), null);
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

	const precedence = getDiceProbabilityDistribution("2 + 3 * 4");
	assert.deepEqual(precedence.outcomes, [{ value: 14, probability: 1 }]);
	const grouped = getDiceProbabilityDistribution("(2 + 3) * 4");
	assert.deepEqual(grouped.outcomes, [{ value: 20, probability: 1 }]);
	const negated = getDiceProbabilityDistribution("-1d2");
	assert.deepEqual(negated.outcomes, [
		{ value: -2, probability: 0.5 },
		{ value: -1, probability: 0.5 },
	]);
	assert.equal(getDiceProbabilityDistribution("-"), null);
	for (const formula of ["1+", "()", "(1+2", "1/2", "2**3"]) {
		assert.equal(getDiceProbabilityDistribution(formula), null, formula);
	}
	assert.equal(
		getDiceProbabilityDistribution("10d20h1", {
			maxRollCombinations: 1000,
		}),
		null,
	);
	assert.equal(
		getDiceProbabilityDistribution("2d6", { maxStates: 3 }),
		null,
	);
	assert.equal(getDiceProbabilityDistribution("d6").average, 3.5);
	assert.deepEqual(getDiceProbabilityDistribution("2d6h0").outcomes, [
		{ value: 0, probability: 1.0000000000000002 },
	]);

	const formatted = getDiceProbabilityDistribution(" 1D2 + 1 ");
	assert.equal(formatted.formula, "1D2 + 1");
	assert.deepEqual(formatted.outcomes, [
		{ value: 2, probability: 0.5 },
		{ value: 3, probability: 0.5 },
	]);
	assert.equal(formatted.maxProbability, 0.5);
	assert.equal(formatted.average, 2.5);
	assert.equal(formatted.min, 2);
	assert.equal(formatted.max, 3);

	assert.deepEqual(getDiceProbabilityDistribution("5"), {
		formula: "5",
		outcomes: [{ value: 5, probability: 1 }],
		maxProbability: 1,
		average: 5,
		min: 5,
		max: 5,
	});
	assert.deepEqual(getDiceProbabilityDistribution("1d0"), {
		formula: "1d0",
		outcomes: [],
		maxProbability: 0,
		average: 0,
		min: 0,
		max: 0,
	});
	assert.ok(getDiceProbabilityDistribution("2d6", { maxStates: 0 }));
	assert.equal(getDiceProbabilityDistribution(0), null);
	assert.equal(getDiceProbabilityDistribution(false), null);
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
	for (const imageUrl of [undefined, null, ""]) {
		assert.equal(parseGalleryLocationFromImageUrl(imageUrl), null);
	}
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
	assert.deepEqual(
		parseGalleryLocationFromImageUrl("api/images/general/scenes/token.png"),
		{
			source: "general",
			category: "scenes",
			subcategory: "",
		},
	);
	assert.deepEqual(
		parseGalleryLocationFromImageUrl(
			"/api//images/%D1%81%D0%B2%D1%96%D1%82/characters//heroes%2Fparty//token.png",
		),
		{
			source: "світ",
			category: "characters",
			subcategory: "heroes/party",
		},
	);
	assert.deepEqual(
		parseGalleryLocationFromImageUrl(
			"/api/images/world/scenes/%E0%A4%A/token.png",
		),
		{
			source: "world",
			category: "scenes",
			subcategory: "%E0%A4%A",
		},
	);
	assert.deepEqual(
		parseGalleryLocationFromImageUrl(
			"https://cdn.example/api/images/world/characters/folder/token.png?size=small#preview",
			"http://localhost:5173",
		),
		{
			source: "world",
			category: "characters",
			subcategory: "folder",
		},
	);
	assert.equal(
		parseGalleryLocationFromImageUrl(
			"https://cdn.example/api/images/world/characters/token.png",
		),
		null,
	);
	assert.equal(
		parseGalleryLocationFromImageUrl("/outside/images/token.png"),
		null,
	);
	assert.equal(
		parseGalleryLocationFromImageUrl("/API/images/world/scenes/token.png"),
		null,
	);
	assert.equal(
		parseGalleryLocationFromImageUrl("/api/images/world/scenes"),
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
	assert.deepEqual(
		getImageAssetFieldPresentation({
			imageUrl: "/portrait.png",
			hasImageError: false,
			isImagePreviewOpen: true,
		}),
		{
			contentState: "valid",
			resolvedImageUrl: "/portrait.png",
			showPreview: true,
		},
	);
	assert.deepEqual(
		getImageAssetFieldPresentation({
			imageUrl: "/missing.png",
			hasImageError: true,
			isImagePreviewOpen: true,
		}),
		{
			contentState: "missing",
			resolvedImageUrl: "/missing.png",
			showPreview: false,
		},
	);
	for (const imageUrl of [undefined, null, ""]) {
		assert.deepEqual(
			getImageAssetFieldPresentation({
				imageUrl,
				hasImageError: true,
				isImagePreviewOpen: true,
			}),
			{
				contentState: "empty",
				resolvedImageUrl: "",
				showPreview: false,
			},
		);
	}
	assert.deepEqual(getImageAssetFieldContextMenuPlan(true), {
		preventDefault: true,
		stopPropagation: true,
		action: "open-gallery",
	});
	assert.deepEqual(getImageAssetFieldContextMenuPlan(false), {
		preventDefault: false,
		stopPropagation: false,
		action: "none",
	});
	assert.equal(getImageAssetFieldSelectionUrl({ url: "/selected.webp" }), "/selected.webp");
	assert.equal(getImageAssetFieldSelectionUrl({ url: "" }), null);
	assert.equal(getImageAssetFieldSelectionUrl(null), null);
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
	assert.equal(getGalleryColumnCount(500, "16px"), 3);
	assert.equal(getGalleryColumnCount(120, "4px"), 1);
	assert.equal(getGalleryColumnCount(500, "0px"), 3);
	assert.equal(getGalleryColumnCount(500, "normal"), 3);
	assert.equal(getGalleryColumnCount(-100, "16px"), 1);
	assert.equal(getGalleryColumnCount(Number.POSITIVE_INFINITY, "16px"), Infinity);
	assert.equal(Number.isNaN(getGalleryColumnCount(Number.NaN, "16px")), true);
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
	const getHistoryKeyboardPlan = (overrides = {}) =>
		getGalleryHistoryKeyboardPlan({
			altKey: false,
			canNavigateBack: true,
			canNavigateForward: true,
			ctrlKey: false,
			isEditableTarget: false,
			isOpen: true,
			key: "Backspace",
			metaKey: false,
			shiftKey: false,
			...overrides,
		});
	assert.deepEqual(getHistoryKeyboardPlan(), {
		action: "navigate",
		direction: -1,
		preventDefault: true,
	});
	assert.deepEqual(
		getHistoryKeyboardPlan({ altKey: true, key: "ArrowLeft" }),
		{ action: "navigate", direction: -1, preventDefault: true },
	);
	assert.deepEqual(
		getHistoryKeyboardPlan({ altKey: true, key: "ArrowRight" }),
		{ action: "navigate", direction: 1, preventDefault: true },
	);
	for (const overrides of [
		{ canNavigateBack: false },
		{ altKey: true, canNavigateBack: false, key: "ArrowLeft" },
		{ altKey: true, canNavigateForward: false, key: "ArrowRight" },
		{ isEditableTarget: true },
		{ isOpen: false },
		{ key: "backspace" },
		{ key: "ArrowLeft" },
		{ altKey: true },
		{ altKey: true, ctrlKey: true, key: "ArrowLeft" },
		{ altKey: true, key: "ArrowRight", metaKey: true },
		{ altKey: true, key: "ArrowRight", shiftKey: true },
		{ ctrlKey: true },
		{ metaKey: true },
		{ shiftKey: true },
		{ key: "Delete" },
	]) {
		assert.deepEqual(getHistoryKeyboardPlan(overrides), {
			action: "none",
			preventDefault: false,
		});
	}
	assert.deepEqual(
		getHistoryKeyboardPlan({
			altKey: true,
			canNavigateBack: false,
			canNavigateForward: true,
			key: "ArrowRight",
		}),
		{ action: "navigate", direction: 1, preventDefault: true },
	);
	const images = deduplicateGalleryImages(
		[
			{ name: "Ірина.png", url: "/api/images/general/tokens/Ірина.png" },
			{ name: "Ірина.png", url: "/api/images/general/tokens/Ірина.png" },
		],
		{ source: "general", category: "tokens", subcategory: "герої" },
	);
	assert.equal(images.length, 1);
	assert.equal(
		getGalleryImageKey(
			{
				name: "ІРИНА.PNG",
				url: "",
				path: "",
				source: "",
				category: "",
				subcategory: "",
			},
			{ source: "кампанія", category: "characters", subcategory: "герої" },
		),
		"кампанія\u0000characters\u0000\u0000\u0000\u0000ірина.png",
	);
	assert.equal(
		getGalleryImageKey(
			{ name: "token.png", url: "/token.png" },
			{ source: "", category: "", subcategory: "" },
		),
		"general\u0000\u0000\u0000\u0000/token.png\u0000token.png",
	);
	const subcategoryVariants = deduplicateGalleryImages(
		[
			{
				name: "same.png",
				url: "/same.png",
				subcategory: "",
			},
			{ name: "same.png", url: "/same.png" },
			{
				name: "same.png",
				url: "/same.png",
				subcategory: null,
			},
		],
		{ source: "general", category: "tokens", subcategory: "герої" },
	);
	assert.equal(subcategoryVariants.length, 2);
	assert.deepEqual(
		subcategoryVariants.map((image) => image.galleryKey.split("\u0000")[2]),
		["", "герої"],
	);
	assert.deepEqual(
		buildGalleryPresentationItems(["npc"], images).map((item) => item.type),
		["sub", "image"],
	);
	const categories = [
		{ id: "tokens", label: "Tokens", icon: "token" },
		{ id: "characters", label: "Characters", icon: "user" },
	];
	assert.deepEqual(
		getGlobalGalleryResultNavigationPlan({
			categories,
			image: {
				name: "Ірина.png",
				url: "/api/images/кампанія/characters/герої/Ірина.png",
				source: "кампанія",
				category: "characters",
				subcategory: "герої",
				globalSearch: true,
			},
			isSelectionMode: false,
		}),
		{
			category: categories[1],
			contentScope: "local",
			path: {
				source: "кампанія",
				category: "characters",
				subcategory: "герої",
			},
			pendingSelection: {
				name: "Ірина.png",
				pathKey: "кампанія\u0000characters\u0000герої",
			},
			searchQuery: "",
		},
	);
	assert.deepEqual(
		getGlobalGalleryResultNavigationPlan({
			categories,
			image: {
				name: "token.png",
				url: "/api/images/general/tokens/token.png",
				category: "tokens",
				globalSearch: true,
			},
			isSelectionMode: false,
		})?.path,
		{ source: "general", category: "tokens", subcategory: "" },
	);
	for (const input of [
		{
			image: null,
			isSelectionMode: false,
		},
		{
			image: { name: "local.png", url: "/local.png" },
			isSelectionMode: false,
		},
		{
			image: {
				name: "unknown.png",
				url: "/unknown.png",
				category: "unknown",
				globalSearch: true,
			},
			isSelectionMode: false,
		},
		{
			image: {
				name: "select.png",
				url: "/select.png",
				category: "tokens",
				globalSearch: true,
			},
			isSelectionMode: true,
		},
	]) {
		assert.equal(
			getGlobalGalleryResultNavigationPlan({ categories, ...input }),
			null,
		);
	}
	assert.deepEqual(
		getGalleryFolderPresentation({
			dragOverTargetId: "npc",
			hasFiles: true,
			isBestiaryFolder: true,
			isReadonly: true,
			isSelected: true,
			selectedSub: "герої",
			sub: "npc",
		}),
		{
			canInteract: false,
			checkboxIcon: "check",
			folderIcon: "folder-bestiary",
			hasFiles: true,
			isBestiaryFolder: true,
			isDragOver: true,
			isReadonly: true,
			isSelected: true,
			subcategory: "герої/npc",
		},
	);
	for (const [sub, folderIcon] of [
		["npc", "folder-npc"],
		["players", "folder-players"],
		["мапи", "folder"],
	]) {
		const presentation = getGalleryFolderPresentation({
			dragOverTargetId: "other",
			hasFiles: false,
			isBestiaryFolder: false,
			isReadonly: false,
			isSelected: false,
			selectedSub: "",
			sub,
		});
		assert.equal(presentation.folderIcon, folderIcon);
		assert.equal(presentation.checkboxIcon, "plus");
		assert.equal(presentation.canInteract, true);
		assert.equal(presentation.isDragOver, false);
		assert.equal(presentation.subcategory, sub);
	}
	assert.equal(getGalleryFolderSubcategory("root/nested", "leaf"), "root/nested/leaf");
});

await run("image gallery search presentation preserves scope and reset policies", () => {
	assert.deepEqual(
		getGallerySearchPresentation({
			canShowDatabaseTokens: false,
			contentScope: "local",
			searchQuery: "",
			selectedSource: "general",
		}),
		{
			clearSearchQuery: "",
			clearTitleKey: "Clear search",
			placeholderKey: "Search images...",
			scopeControls: [
				{
					icon: "map",
					isActive: false,
					nextScope: "source",
					scope: "source",
					titleKey: "Show all general content",
				},
				{
					icon: "layers",
					isActive: false,
					nextScope: "all",
					scope: "all",
					titleKey: "Show all gallery content",
				},
			],
			showClearButton: false,
		},
	);
	const campaignSource = getGallerySearchPresentation({
		canShowDatabaseTokens: true,
		contentScope: "source",
		searchQuery: " ",
		selectedSource: "кампанія",
	});
	assert.equal(campaignSource.showClearButton, true);
	assert.equal(campaignSource.clearSearchQuery, "");
	assert.deepEqual(
		campaignSource.scopeControls.map((control) => control.scope),
		["source", "databaseTokens", "all"],
	);
	assert.deepEqual(campaignSource.scopeControls[0], {
		icon: "map",
		isActive: true,
		nextScope: "local",
		scope: "source",
		titleKey: "Show all campaign content",
	});
	assert.deepEqual(campaignSource.scopeControls[1], {
		icon: "book",
		isActive: false,
		nextScope: "databaseTokens",
		scope: "databaseTokens",
		titleKey: "Show all database tokens",
	});
	const databaseScope = getGallerySearchPresentation({
		canShowDatabaseTokens: true,
		contentScope: "databaseTokens",
		searchQuery: "Ірина",
		selectedSource: "general",
	});
	assert.equal(databaseScope.scopeControls[1].isActive, true);
	assert.equal(databaseScope.scopeControls[1].nextScope, "local");
	assert.equal(databaseScope.scopeControls[0].nextScope, "source");
	const allScope = getGallerySearchPresentation({
		canShowDatabaseTokens: false,
		contentScope: "all",
		searchQuery: "Ірина",
		selectedSource: "",
	});
	assert.deepEqual(allScope.scopeControls.at(-1), {
		icon: "layers",
		isActive: true,
		nextScope: "local",
		scope: "all",
		titleKey: "Show all gallery content",
	});
	assert.equal(
		allScope.scopeControls[0].titleKey,
		"Show all campaign content",
	);
	const unexpectedScope = getGallerySearchPresentation({
		canShowDatabaseTokens: true,
		contentScope: "unexpected",
		searchQuery: "0",
		selectedSource: "general",
	});
	assert.equal(unexpectedScope.showClearButton, true);
	assert.equal(
		unexpectedScope.scopeControls.every(
			(control) => !control.isActive && control.nextScope === control.scope,
		),
		true,
	);
	assert.equal(isAiResponseVisibleForRoute(null), true);
	assert.equal(
		isAiResponseVisibleForRoute({ path: { encounter: 0 } }, {}),
		true,
	);
});

await run("image gallery stats and actions preserve nullable and visibility policies", () => {
	assert.deepEqual(
		getGalleryStatsAndActionsPresentation({
			hasSelection: false,
			isReadonlyCurrentFolder: false,
			selectedFilenameCount: 0,
			selectedSubfolderCount: 0,
			storageStats: null,
		}),
		{
			selectionCount: 0,
			showSelectionActions: false,
			showUpload: true,
			storageItems: [
				{ bytes: 0, id: "total", labelKey: "Total gallery size" },
				{ bytes: 0, id: "category", labelKey: "Tab size" },
			],
		},
	);
	const selectedReadonly = getGalleryStatsAndActionsPresentation({
		hasSelection: true,
		isReadonlyCurrentFolder: true,
		selectedFilenameCount: 2,
		selectedSubfolderCount: 3,
		storageStats: {
			totalBytes: 4096,
			sourceBytes: 3072,
			categoryBytes: 1024,
			subcategoryBytes: 512,
			sourceSizes: {},
			categorySizes: {},
		},
	});
	assert.equal(selectedReadonly.selectionCount, 5);
	assert.equal(selectedReadonly.showSelectionActions, true);
	assert.equal(selectedReadonly.showUpload, false);
	assert.deepEqual(selectedReadonly.storageItems, [
		{ bytes: 4096, id: "total", labelKey: "Total gallery size" },
		{ bytes: 1024, id: "category", labelKey: "Tab size" },
	]);
	const inconsistentSelection = getGalleryStatsAndActionsPresentation({
		hasSelection: true,
		isReadonlyCurrentFolder: false,
		selectedFilenameCount: 0,
		selectedSubfolderCount: 0,
		storageStats: undefined,
	});
	assert.equal(inconsistentSelection.selectionCount, 0);
	assert.equal(inconsistentSelection.showSelectionActions, true);
	const hiddenNonzeroSelection = getGalleryStatsAndActionsPresentation({
		hasSelection: false,
		isReadonlyCurrentFolder: false,
		selectedFilenameCount: 4,
		selectedSubfolderCount: 1,
		storageStats: { totalBytes: -5, categoryBytes: Number.NaN },
	});
	assert.equal(hiddenNonzeroSelection.selectionCount, 5);
	assert.equal(hiddenNonzeroSelection.showSelectionActions, false);
	assert.equal(hiddenNonzeroSelection.storageItems[0].bytes, -5);
	assert.equal(Number.isNaN(hiddenNonzeroSelection.storageItems[1].bytes), true);
	const nullishFields = getGalleryStatsAndActionsPresentation({
		hasSelection: false,
		isReadonlyCurrentFolder: true,
		selectedFilenameCount: 0,
		selectedSubfolderCount: 0,
		storageStats: { totalBytes: null, categoryBytes: undefined },
	});
	assert.deepEqual(
		nullishFields.storageItems.map((item) => item.bytes),
		[0, 0],
	);
	assert.equal(nullishFields.showUpload, false);
});

await run("image gallery interaction plans validate drops, moves, and selection", () => {
	assert.deepEqual(
		getGalleryEscapePlan({
			hasPreview: false,
			hasSelection: true,
			key: "Enter",
		}),
		{ action: "none", preventDefault: false, stopPropagation: false },
	);
	assert.deepEqual(
		getGalleryEscapePlan({
			hasPreview: false,
			hasSelection: false,
			key: "Escape",
		}),
		{ action: "none", preventDefault: false, stopPropagation: false },
	);
	assert.deepEqual(
		getGalleryEscapePlan({
			hasPreview: false,
			hasSelection: true,
			key: "Escape",
		}),
		{
			action: "clear-selection",
			preventDefault: true,
			stopPropagation: true,
		},
	);
	for (const hasSelection of [false, true]) {
		assert.deepEqual(
			getGalleryEscapePlan({
				hasPreview: true,
				hasSelection,
				key: "Escape",
			}),
			{
				action: "close-preview",
				preventDefault: true,
				stopPropagation: true,
			},
		);
	}
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
	const gridTarget = getGalleryGridDropTarget({
		category: "tokens",
		isReadonly: false,
		slug: "кампанія",
		subcategory: "герої/Ірина",
	});
	assert.deepEqual(gridTarget, {
		slug: "кампанія",
		category: "tokens",
		subcategory: "герої/Ірина",
		readonly: false,
	});
	assert.deepEqual(
		getGalleryGridDragOverPlan({
			dragSource: null,
			isSearchResults: false,
			target: gridTarget,
		}),
		{ nextDraggingOver: true, preventDefault: true },
	);
	assert.deepEqual(
		getGalleryGridDragOverPlan({
			dragSource: {
				slug: "кампанія",
				category: "tokens",
				subcategory: "герої/Ірина",
			},
			isSearchResults: false,
			target: gridTarget,
		}),
		{ nextDraggingOver: null, preventDefault: true },
	);
	assert.deepEqual(
		getGalleryGridDragOverPlan({
			dragSource: {
				slug: "кампанія",
				category: "tokens",
				subcategory: "герої/Ірина",
			},
			isSearchResults: true,
			target: gridTarget,
		}),
		{ nextDraggingOver: false, preventDefault: true },
	);
	const readonlyGridTarget = getGalleryGridDropTarget({
		category: "tokens",
		isReadonly: true,
		slug: "general",
		subcategory: "MM",
	});
	assert.deepEqual(
		getGalleryGridDragOverPlan({
			dragSource: null,
			isSearchResults: false,
			target: readonlyGridTarget,
		}),
		{ nextDraggingOver: null, preventDefault: true },
	);
	assert.deepEqual(
		getGalleryGridDragOverPlan({
			dragSource: null,
			isSearchResults: true,
			target: readonlyGridTarget,
		}),
		{ nextDraggingOver: false, preventDefault: true },
	);
	const rootTarget = getGalleryGridDropTarget({
		category: "tokens",
		isReadonly: false,
		slug: "general",
		subcategory: "",
	});
	assert.deepEqual(
		getGalleryGridDragOverPlan({
			dragSource: { slug: "general", category: "tokens" },
			isSearchResults: false,
			target: rootTarget,
		}),
		{ nextDraggingOver: true, preventDefault: true },
	);
	for (const dragSource of [
		{ slug: "other", category: "tokens", subcategory: "герої/Ірина" },
		{ slug: "кампанія", category: "attachments", subcategory: "герої/Ірина" },
		{ slug: "кампанія", category: "tokens", subcategory: "інша" },
	]) {
		assert.deepEqual(
			getGalleryGridDragOverPlan({
				dragSource,
				isSearchResults: false,
				target: gridTarget,
			}),
			{ nextDraggingOver: true, preventDefault: true },
		);
	}
	assert.deepEqual(
		getGalleryGridDropPlan({
			isSearchResults: true,
			target: gridTarget,
		}),
		{
			action: "reject-search",
			nextDraggingOver: false,
			preventDefault: true,
		},
	);
	const delegatedGridDrop = getGalleryGridDropPlan({
		isSearchResults: false,
		target: readonlyGridTarget,
	});
	assert.deepEqual(delegatedGridDrop, {
		action: "delegate",
		preventDefault: false,
		target: readonlyGridTarget,
	});
	assert.equal(delegatedGridDrop.target, readonlyGridTarget);
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
	assert.equal(selection.lastIndex, 0);
	const rangeImages = [
		{ name: "hero.png", url: "/hero.png" },
		{ name: "locked.png", url: "/locked.png", readonly: true },
		{ name: "ally.png", url: "/ally.png" },
	];
	const previousFilenames = new Set(["existing.png"]);
	const previousSubfolders = new Set(["existing-folder"]);
	const reverseAdditiveSelection = getGallerySelectionPlan({
		allSubs: ["official", "custom"],
		filenames: previousFilenames,
		images: rangeImages,
		index: 1,
		isAdditive: true,
		isReadonlyImage: (image) => Boolean(image?.readonly),
		isReadonlySub: (name) => name === "official",
		isShift: true,
		lastIndex: 4,
		name: "custom",
		subfolders: previousSubfolders,
		type: "sub",
	});
	assert.deepEqual([...reverseAdditiveSelection.subfolders], [
		"existing-folder",
		"custom",
	]);
	assert.deepEqual([...reverseAdditiveSelection.filenames], [
		"existing.png",
		"hero.png",
		"ally.png",
	]);
	assert.equal(reverseAdditiveSelection.lastIndex, 4);
	assert.deepEqual([...previousFilenames], ["existing.png"]);
	assert.deepEqual([...previousSubfolders], ["existing-folder"]);
	assert.notEqual(reverseAdditiveSelection.filenames, previousFilenames);
	assert.notEqual(reverseAdditiveSelection.subfolders, previousSubfolders);
	const freshReverseSelection = getGallerySelectionPlan({
		allSubs: ["official", "custom"],
		filenames: previousFilenames,
		images: rangeImages,
		index: 0,
		isAdditive: false,
		isReadonlyImage: (image) => Boolean(image?.readonly),
		isReadonlySub: (name) => name === "official",
		isShift: true,
		lastIndex: 4,
		name: "official",
		subfolders: previousSubfolders,
		type: "sub",
	});
	assert.deepEqual([...freshReverseSelection.subfolders], ["custom"]);
	assert.deepEqual([...freshReverseSelection.filenames], [
		"hero.png",
		"ally.png",
	]);
	assert.equal(freshReverseSelection.lastIndex, 4);
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
	assert.deepEqual(
		getGalleryFolderDragOverPlan({
			currentTargetId: "other",
			isReadonly: true,
			sub: "герої",
		}),
		{ preventDefault: false, target: null },
	);
	assert.deepEqual(
		getGalleryFolderDragOverPlan({
			currentTargetId: "герої",
			isReadonly: false,
			sub: "герої",
		}),
		{ preventDefault: true, target: null },
	);
	assert.deepEqual(
		getGalleryFolderDragOverPlan({
			currentTargetId: "other",
			isReadonly: false,
			sub: "герої",
		}),
		{ preventDefault: true, target: { type: "sub", id: "герої" } },
	);
	assert.deepEqual(
		getGalleryFolderDropTarget({
			category: "tokens",
			isReadonly: true,
			slug: "кампанія",
			subcategory: "герої/npc",
		}),
		{
			slug: "кампанія",
			category: "tokens",
			subcategory: "герої/npc",
			readonly: true,
		},
	);
	for (const value of [undefined, null, "", 0, false]) {
		assert.equal(getGalleryFolderRenameName(value), null);
	}
	assert.equal(getGalleryFolderRenameName("Нова назва"), "Нова назва");
	assert.equal(getGalleryFolderRenameName(" "), " ");
	assert.deepEqual(
		getGalleryKeyboardPlan({
			isOpen: true,
			key: "Delete",
			selectedSub: "герої/npc",
		}),
		{ action: "delete-selection", preventDefault: false },
	);
	assert.deepEqual(
		getGalleryKeyboardPlan({
			isOpen: true,
			key: "Backspace",
			selectedSub: "герої//npc/",
		}),
		{
			action: "navigate-parent",
			preventDefault: true,
			subcategory: "герої",
		},
	);
	assert.deepEqual(
		getGalleryKeyboardPlan({
			isOpen: true,
			key: "Backspace",
			selectedSub: "/",
		}),
		{ action: "navigate-parent", preventDefault: true, subcategory: "" },
	);
	assert.deepEqual(
		getGalleryKeyboardPlan({
			isOpen: true,
			key: "Backspace",
			selectedSub: "",
		}),
		{ action: "none", preventDefault: true },
	);
	for (const input of [
		{ isOpen: false, key: "Backspace", targetTagName: null },
		{ isOpen: true, key: "Delete", targetTagName: "INPUT" },
		{ isOpen: true, key: "Backspace", targetTagName: "TEXTAREA" },
		{ isOpen: true, key: "Escape", targetTagName: null },
	]) {
		assert.deepEqual(
			getGalleryKeyboardPlan({ ...input, selectedSub: "герої" }),
			{ action: "none", preventDefault: false },
		);
	}
	for (const targetTagName of ["SELECT", "DIV", "input"]) {
		assert.deepEqual(
			getGalleryKeyboardPlan({
				isOpen: true,
				key: "Delete",
				selectedSub: "герої",
				targetTagName,
			}),
			{ action: "delete-selection", preventDefault: false },
		);
	}
	for (const input of [
		{ newName: "", oldName: "old", selectedSub: "" },
		{ newName: "   ", oldName: "old", selectedSub: "root" },
		{ newName: "same", oldName: "same", selectedSub: "root" },
	]) {
		assert.equal(getGallerySubcategoryRenamePlan(input), null);
	}
	assert.deepEqual(
		getGallerySubcategoryRenamePlan({
			newName: "нові",
			oldName: "герої",
			selectedSub: "",
		}),
		{
			newPath: "нові",
			oldPath: "герої",
			selectedSubcategory: null,
		},
	);
	assert.deepEqual(
		getGallerySubcategoryRenamePlan({
			newName: " нові ",
			oldName: "герої",
			selectedSub: "кампанія//tokens",
		}),
		{
			newPath: "кампанія//tokens/ нові ",
			oldPath: "кампанія//tokens/герої",
			selectedSubcategory: null,
		},
	);
	assert.deepEqual(
		getGallerySubcategoryRenamePlan({
			newName: "нові",
			oldName: "герої",
			selectedSub: "герої",
		}),
		{
			newPath: "герої/нові",
			oldPath: "герої/герої",
			selectedSubcategory: "нові",
		},
	);
	assert.equal(
		getGallerySubcategoryRenamePlan({
			newName: "нові",
			oldName: "герої",
			selectedSub: "root/герої",
		})?.selectedSubcategory,
		null,
	);
});

await run("image gallery single selection preserves toggle, type, and Set identity", () => {
	const images = [
		{ name: "Ірина.png", url: "/iryna.png" },
		{ name: "protected.png", url: "/protected.png", readonly: true },
	];
	const getSingleSelection = (overrides = {}) =>
		getGallerySelectionPlan({
			allSubs: ["герої", "protected-folder"],
			filenames: new Set(),
			images,
			index: 0,
			isAdditive: false,
			isReadonlyImage: (image) => Boolean(image?.readonly),
			isReadonlySub: (name) => name === "protected-folder",
			isShift: false,
			lastIndex: null,
			name: "Ірина.png",
			subfolders: new Set(),
			type: "image",
			...overrides,
		});

	const readonlyFilenames = new Set(["Ірина.png"]);
	const readonlySubfolders = new Set(["герої"]);
	assert.equal(
		getSingleSelection({
			filenames: readonlyFilenames,
			index: 1,
			name: "protected.png",
			subfolders: readonlySubfolders,
		}),
		null,
	);
	assert.equal(
		getSingleSelection({
			filenames: readonlyFilenames,
			name: "protected-folder",
			subfolders: readonlySubfolders,
			type: "sub",
		}),
		null,
	);
	assert.deepEqual([...readonlyFilenames], ["Ірина.png"]);
	assert.deepEqual([...readonlySubfolders], ["герої"]);

	let missingImageCandidate = "not-called";
	assert.equal(
		getSingleSelection({
			isReadonlyImage: (image) => {
				missingImageCandidate = image;
				return true;
			},
			name: "відсутня.png",
		}),
		null,
	);
	assert.equal(missingImageCandidate, undefined);

	const selectedImageSet = new Set(["Ірина.png"]);
	const clearedImage = getSingleSelection({ filenames: selectedImageSet });
	assert.deepEqual([...clearedImage.filenames], []);
	assert.deepEqual([...clearedImage.subfolders], []);
	assert.equal(clearedImage.lastIndex, null);
	assert.notEqual(clearedImage.filenames, selectedImageSet);
	assert.deepEqual([...selectedImageSet], ["Ірина.png"]);

	const selectedFolderSet = new Set(["герої"]);
	const clearedFolder = getSingleSelection({
		name: "герої",
		subfolders: selectedFolderSet,
		type: "sub",
	});
	assert.deepEqual([...clearedFolder.filenames], []);
	assert.deepEqual([...clearedFolder.subfolders], []);
	assert.equal(clearedFolder.lastIndex, null);
	assert.notEqual(clearedFolder.subfolders, selectedFolderSet);
	assert.deepEqual([...selectedFolderSet], ["герої"]);

	const multipleFilenames = new Set(["Ірина.png", "інша.png"]);
	const multipleSubfolders = new Set(["герої"]);
	const narrowedImage = getSingleSelection({
		filenames: multipleFilenames,
		index: 7,
		subfolders: multipleSubfolders,
	});
	assert.deepEqual([...narrowedImage.filenames], ["Ірина.png"]);
	assert.deepEqual([...narrowedImage.subfolders], []);
	assert.equal(narrowedImage.lastIndex, 7);
	assert.notEqual(narrowedImage.filenames, multipleFilenames);
	assert.notEqual(narrowedImage.subfolders, multipleSubfolders);
	assert.deepEqual([...multipleFilenames], ["Ірина.png", "інша.png"]);
	assert.deepEqual([...multipleSubfolders], ["герої"]);

	const narrowedFolder = getSingleSelection({
		filenames: multipleFilenames,
		index: 0,
		name: "герої",
		subfolders: multipleSubfolders,
		type: "sub",
	});
	assert.deepEqual([...narrowedFolder.filenames], []);
	assert.deepEqual([...narrowedFolder.subfolders], ["герої"]);
	assert.equal(narrowedFolder.lastIndex, 0);

	const sameNameOppositeType = getSingleSelection({
		filenames: new Set(),
		name: "герої",
		subfolders: new Set(["герої"]),
		type: "image",
	});
	assert.deepEqual([...sameNameOppositeType.filenames], ["герої"]);
	assert.deepEqual([...sameNameOppositeType.subfolders], []);
	assert.equal(sameNameOppositeType.lastIndex, 0);
});

await run("image gallery bulk-delete policies preserve safe selection and payload semantics", () => {
	assert.equal(
		getGalleryBulkDeleteSummary({ safeFilenames: [], safeSubs: [] }),
		null,
	);
	assert.deepEqual(
		getGalleryBulkDeleteSummary({
			safeFilenames: ["Ірина.png", "npc.png"],
			safeSubs: ["герої"],
		}),
		{ hasFolders: true, total: 3 },
	);
	assert.deepEqual(
		getGalleryBulkDeleteSummary({
			safeFilenames: ["Ірина.png"],
			safeSubs: [],
		}),
		{ hasFolders: false, total: 1 },
	);
	assert.deepEqual(
		getGalleryBulkDeleteConfirmationPlan({
			hasNonEmptySelectedFolders: true,
			total: 3,
		}),
		{ count: 3, showExtractFolderContents: true },
	);
	assert.deepEqual(createGalleryBulkDeleteConfirmation("так"), {
		confirmed: true,
		extractFolderContents: true,
	});
	assert.deepEqual(createGalleryBulkDeleteConfirmation(0), {
		confirmed: true,
		extractFolderContents: false,
	});
	for (const value of [null, undefined, "confirmed", {}, { confirmed: 0 }]) {
		assert.equal(normalizeGalleryBulkDeleteConfirmation(value), null);
	}
	assert.deepEqual(
		normalizeGalleryBulkDeleteConfirmation({
			confirmed: "yes",
			extractFolderContents: "так",
		}),
		{ confirmed: true, extractFolderContents: true },
	);
	assert.deepEqual(
		normalizeGalleryBulkDeleteConfirmation({ confirmed: true }),
		{ confirmed: true, extractFolderContents: false },
	);

	const currentLocation = {
		slug: "кампанія",
		category: "tokens",
		subcategory: "герої",
	};
	const imageGroups = [
		{
			items: ["Ірина.png"],
			src: currentLocation,
		},
		{
			items: ["official.png"],
			src: { slug: "general", category: "tokens", subcategory: "MM" },
		},
	];
	assert.deepEqual(
		buildGalleryBulkDeletePayloads({
			extractFolderContents: false,
			hasNonEmptySelectedFolders: false,
			imageGroups,
			safeSubs: [],
			src: currentLocation,
		}),
		imageGroups,
	);
	assert.deepEqual(
		buildGalleryBulkDeletePayloads({
			extractFolderContents: true,
			hasNonEmptySelectedFolders: true,
			imageGroups,
			safeSubs: ["npc", "лиходії"],
			src: currentLocation,
		}),
		[
			...imageGroups,
			{
				items: ["npc", "лиходії"],
				src: currentLocation,
				options: { extractFolderContents: true },
			},
		],
	);
	assert.deepEqual(
		buildGalleryBulkDeletePayloads({
			extractFolderContents: true,
			hasNonEmptySelectedFolders: false,
			imageGroups: [],
			safeSubs: ["порожня"],
			src: currentLocation,
		}),
		[
			{
				items: ["порожня"],
				src: currentLocation,
				options: { extractFolderContents: false },
			},
		],
	);
});

await run("image gallery folder inspection is parallel and null-safe", async () => {
	const emptyCalls = [];
	assert.equal(
		await hasNonEmptyGalleryFolders({
			api: {
				getImages: async (...args) => emptyCalls.push(["images", ...args]),
				getSubcategories: async (...args) =>
					emptyCalls.push(["subcategories", ...args]),
			},
			category: "tokens",
			folderNames: [],
			selectedSource: "кампанія",
			selectedSub: "герої",
		}),
		false,
	);
	assert.deepEqual(emptyCalls, []);

	const calls = [];
	const api = {
		getImages: async (source, category, subcategory) => {
			calls.push(["images", source, category, subcategory]);
			return subcategory.endsWith("/лиходії") ? null : [];
		},
		getSubcategories: async (source, category, subcategory) => {
			calls.push(["subcategories", source, category, subcategory]);
			return subcategory.endsWith("/лиходії") ? ["боси"] : "invalid";
		},
	};
	const inspection = hasNonEmptyGalleryFolders({
		api,
		category: "tokens",
		folderNames: ["npc", "лиходії"],
		selectedSource: "кампанія",
		selectedSub: "герої//tokens",
	});
	assert.deepEqual(calls, [
		["images", "кампанія", "tokens", "герої//tokens/npc"],
		["subcategories", "кампанія", "tokens", "герої//tokens/npc"],
		["images", "кампанія", "tokens", "герої//tokens/лиходії"],
		["subcategories", "кампанія", "tokens", "герої//tokens/лиходії"],
	]);
	assert.equal(await inspection, true);
	assert.equal(
		await hasNonEmptyGalleryFolders({
			api: {
				getImages: async () => [{ name: "Ірина.png" }],
				getSubcategories: async () => [],
			},
			category: "characters",
			folderNames: ["герої"],
			selectedSource: "кампанія",
			selectedSub: "",
		}),
		true,
	);
	assert.equal(
		await hasNonEmptyGalleryFolders({
			api: {
				getImages: async () => undefined,
				getSubcategories: async () => ({ length: 2 }),
			},
			category: "characters",
			folderNames: ["порожня"],
			selectedSource: "кампанія",
			selectedSub: "",
		}),
		false,
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
	const scopedBase = {
		categories: ["tokens", "characters"],
		category: "characters",
		ignoreSourcesList: ["UA"],
		search: "ірина",
		selectedSub: "герої",
		selectedSource: "кампанія",
	};
	assert.deepEqual(
		getScopedGallerySearchQuery({ ...scopedBase, contentScope: "all" }),
		{
			search: "ірина",
			source: "",
			category: "",
			subcategory: "",
			categories: ["tokens", "characters"],
			ignoreSourcesList: ["UA"],
		},
	);
	assert.deepEqual(
		getScopedGallerySearchQuery({ ...scopedBase, contentScope: "source" }),
		{
			search: "ірина",
			source: "кампанія",
			category: "",
			subcategory: "",
			categories: ["tokens", "characters"],
			ignoreSourcesList: ["UA"],
		},
	);
	const localQuery = {
		search: "ірина",
		source: "кампанія",
		category: "characters",
		subcategory: "герої",
		categories: ["tokens", "characters"],
		ignoreSourcesList: ["UA"],
	};
	for (const contentScope of ["local", "databaseTokens", "unexpected"]) {
		assert.deepEqual(
			getScopedGallerySearchQuery({ ...scopedBase, contentScope }),
			localQuery,
		);
	}
	const scopedCalls = [];
	let scopedResponse = {
		images: [{ name: "Ірина.png", url: "/scoped.png" }],
	};
	const scopedApi = {
		...api,
		searchImageGallery: async (query) => {
			scopedCalls.push(query);
			return scopedResponse;
		},
	};
	const scopedOptions = {
		activeSearchQuery: "ірина",
		api: scopedApi,
		...scopedBase,
		contentScope: "source",
		isGeneralTokens: false,
		isScopedContent: true,
		normalizedSearchQuery: "ірина",
	};
	assert.deepEqual(await loadGalleryImages(scopedOptions), scopedResponse.images);
	assert.deepEqual(scopedCalls[0], {
		...localQuery,
		category: "",
		subcategory: "",
	});
	scopedResponse = null;
	assert.deepEqual(await loadGalleryImages(scopedOptions), []);
	scopedResponse = { images: "invalid" };
	assert.deepEqual(await loadGalleryImages(scopedOptions), []);
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
