export {
	AI_FILE_ACCEPT,
	AI_IMAGE_ACCEPT,
	ESTIMATED_FILE_TOKEN_BYTES,
	MAX_AI_ATTACHMENTS,
	MAX_AI_FILE_BYTES,
	MAX_AI_IMAGE_BYTES,
	getAttachedFileKey,
	getAttachedImageKey,
	getSupportedAiFileMimeType,
	getSupportedAiImageMimeType,
	readFileAsBase64,
} from "./model/aiAttachments.js";
export {
	buildDiffResources,
	getDiffResourceState,
} from "./model/aiDiff.js";
export {
	addSourceMonsterImageToDraft,
	getFirstChangedMonster,
	getFirstChangedMonsterName,
	getHistoryChangeSummary,
	getLocalizedDiffResourceState,
	isAiResponseVisibleForRoute,
	updateDraftResourceAfterValues,
} from "./model/aiResponseHelpers.js";
