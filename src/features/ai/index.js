export { aiApi } from "./api/aiApi.ts";
export {
	AI_FILE_ACCEPT,
	AI_IMAGE_ACCEPT,
	MAX_AI_ATTACHMENTS,
	MAX_AI_FILE_BYTES,
	MAX_AI_IMAGE_BYTES,
	getAttachedFileKey,
	getAttachedImageKey,
	getSupportedAiFileMimeType,
	getSupportedAiImageMimeType,
	readFileAsBase64,
} from "./model/aiAttachments.ts";
export { buildDiffResources, getDiffResourceState } from "./model/aiDiff.ts";
export {
	AI_MODEL_REFRESH_ATTEMPTS,
	AI_MODEL_REFRESH_DELAY_MS,
	getAiModelSelection,
	saveGeminiApiKeyAndRefreshModels,
} from "./model/apiKeyWorkflow.ts";
export { loadAiModelOptions } from "./model/aiModels.ts";
export {
	addSourceMonsterImageToDraft,
	getFirstChangedMonster,
	getFirstChangedMonsterName,
	getHistoryChangeSummary,
	getLocalizedDiffResourceState,
	isAiResponseVisibleForRoute,
	updateDraftResourceAfterValues,
} from "./model/aiResponseHelpers.ts";
export {
	ESTIMATED_IMAGE_TOKENS,
	ESTIMATED_FILE_TOKEN_BYTES,
	SYSTEM_TOKEN_ESTIMATES,
	buildAiTokenEstimate,
	compactEntityForEstimate,
	compactNoteForEstimate,
	compactSessionForEstimate,
	estimateTextTokens,
	estimateValueTokens,
	getEstimatedAiMode,
} from "./model/tokenEstimation.ts";
export {
	buildRetryPayloadFromHistoryEntry,
	createAiHistoryWorkflow,
	getGeneratedEntityTypes,
	getHistoryChangeResources,
	getHistoryChangedEntityTypes,
	hasGeneratedCampaignChanges,
	hasHistoryChanges,
	isFailedHistoryEntry,
	isNonParsedHistoryEntry,
} from "./model/historyWorkflow.ts";
export {
	buildAiGenerationRequest,
	sanitizeAiContextConfig,
} from "./model/generationRequest.ts";
export {
	AI_GENERATION_STATUS,
	aiGenerationLifecycleReducer,
	initialAiGenerationLifecycle,
	isAiGenerationPending,
} from "./model/generationLifecycle.ts";
export {
	buildAiHistoryRestorePlan,
	canApplyRestoredAiDataDirectly,
	getAiHistoryCampaign,
	getAiHistoryRestoreMode,
	upsertAiHistoryEntry,
} from "./model/historyState.ts";
export {
	createAiHistoryCommandService,
	useAiHistoryCommands,
} from "./model/historyCommands.ts";
export {
	ensureContextListItems,
	getContextListConfig,
	setAllContextListItems,
	updateContextConfigValue,
	updateContextListIncluded,
	updateContextListItem,
} from "./model/contextConfig.ts";
export {
	buildCustomMonsterImageTarget,
	buildLocationImageTarget,
	buildNpcImageTarget,
	buildSceneImageTarget,
	getImageTargetNotes,
	getSceneImageTargetEncounter,
} from "./model/imageTargets.ts";
export {
	createInitialAiContextConfig,
	mergeLoadedAiSessionData,
	useAiContextData,
} from "./model/useAiContextData.ts";
export {
	normalizeCustomMonsterCollection,
	useAiImagePromptData,
} from "./model/useAiImagePromptData.ts";
