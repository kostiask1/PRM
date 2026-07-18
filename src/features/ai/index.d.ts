export {
	aiApi,
	type AiGenerationResult,
	type AiHistoryEntry,
	type AiHistoryResource,
	type AiHistoryRestoreResult,
	type AiModelDescriptor,
} from "./api/aiApi.ts";
export {
	buildDiffResources,
	getDiffResourceState,
	type DiffResource,
} from "./model/aiDiff.ts";
export {
	AI_MODEL_REFRESH_ATTEMPTS,
	AI_MODEL_REFRESH_DELAY_MS,
	getAiModelSelection,
	saveGeminiApiKeyAndRefreshModels,
	type AiApiKeyModelSelection,
	type AiApiKeySaveResult,
	type SaveAiApiKeyOptions,
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
