const storage = require("../storage");
const {
	buildAiRequestSnapshot,
	formatGeneratedContentForHistory,
} = require("../aiHistoryService");
const {
	saveDraftParsedAiResponse,
	saveParsedAiResponse,
} = require("../aiResponseHistoryService");
const { coerceAiText: asText } = require("./textUtils");

function getFailedAiResponseText(error, status = null) {
	const message =
		asText(error?.message || error?.error) || "AI request failed.";
	return ["AI request failed", "", status ? `Status: ${status}` : null, message]
		.filter(Boolean)
		.join("\n");
}

class AiHistoryWriter {
	cloneRetryPayload(payload = {}) {
		const cloned = JSON.parse(JSON.stringify(payload || {}));
		if (Array.isArray(cloned.attachedImages)) {
			cloned.attachedImages = cloned.attachedImages
				.map((image) => {
					if (!image || typeof image !== "object") return null;
					const name = asText(image.name);
					const url = asText(image.url);
					const mimeType = asText(image.mimeType);
					const sizeBytes = Number(image.sizeBytes) || 0;
					if (!name && !url && !mimeType && !sizeBytes && !image.data) {
						return null;
					}
					return {
						...(name ? { name } : {}),
						...(url ? { url } : {}),
						...(mimeType ? { mimeType } : {}),
						...(sizeBytes ? { sizeBytes } : {}),
						...(image.data ? { omittedData: true } : {}),
					};
				})
				.filter(Boolean);
		}
		if (Array.isArray(cloned.attachedFiles)) {
			cloned.attachedFiles = cloned.attachedFiles
				.map((file) => {
					if (!file || typeof file !== "object") return null;
					const name = asText(file.name);
					return name ? { name } : null;
				})
				.filter(Boolean);
		}
		return cloned;
	}

	shouldSave(payload = {}) {
		return (
			payload?.historyMode !== "ephemeral" && payload?.saveToHistory !== false
		);
	}

	createEphemeral(payload = {}) {
		return {
			...payload,
			id: `ephemeral-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			status: payload.status || "completed",
			createdAt: new Date().toISOString(),
		};
	}

	getUserInstructions(payload = {}) {
		return asText(
			Object.prototype.hasOwnProperty.call(payload, "historyUserInstructions")
				? payload.historyUserInstructions
				: payload.userInstructions,
		);
	}

	buildRequestSnapshot(options) {
		return buildAiRequestSnapshot(options);
	}

	formatGeneratedContent(generatedContent) {
		return formatGeneratedContentForHistory(generatedContent);
	}

	async addResponse(payload) {
		return storage.addAiResponse(payload);
	}

	async addSavedOrEphemeral(requestPayload, responsePayload) {
		return this.shouldSave(requestPayload)
			? storage.addAiResponse(responsePayload)
			: this.createEphemeral(responsePayload);
	}

	async saveFailed(payload = {}, error, status = null) {
		if (!this.shouldSave(payload)) return null;
		const path =
			payload?.path && typeof payload.path === "object" ? payload.path : {};
		const campaignSlug = asText(path.campaign);
		if (!campaignSlug) return null;
		const historyUserInstructions = this.getUserInstructions(payload);

		const shouldParseAIResponse =
			payload.type !== "image" &&
			Boolean(payload.parseAIResponse) &&
			(!path.encounter || payload.generateEncounters);
		const requestSnapshot = this.buildRequestSnapshot({
			type: payload.type,
			modelName: payload.modelName,
			userInstructions: historyUserInstructions,
			path,
			sceneId: payload.sceneId,
			imageTarget: payload.imageTarget,
			attachedImages: payload.attachedImages,
			attachedFiles: payload.attachedFiles,
			parseAIResponse: payload.parseAIResponse,
			shouldParseAIResponse,
			generateCharacters: payload.generateCharacters !== false,
			generateNpcs: payload.generateNpcs !== false,
			generateLocations: payload.generateLocations !== false,
			generateEncounters: Boolean(payload.generateEncounters),
			generateCustomMonsters: Boolean(payload.generateCustomMonsters),
			entityScope: payload.entityScope,
			contextConfig: payload.contextConfig,
			contextData: {},
			language: payload.language,
		});

		return storage.addAiResponse({
			text: getFailedAiResponseText(error, status),
			path,
			type: payload.type || null,
			modelName: payload.modelName || null,
			language: payload.language || null,
			userInstructions: historyUserInstructions,
			request: requestSnapshot,
			status: "failed",
			error: {
				message: asText(error?.message || error?.error) || "AI request failed.",
				status,
			},
			retryPayload: this.cloneRetryPayload(payload),
		});
	}

	async saveDraftParsed(options) {
		return saveDraftParsedAiResponse({
			...options,
			retryPayload:
				options.retryPayload ?? this.cloneRetryPayload(options.payload),
		});
	}

	async saveParsed(options) {
		return saveParsedAiResponse({
			...options,
			retryPayload:
				options.retryPayload ?? this.cloneRetryPayload(options.payload),
		});
	}
}

module.exports = {
	AiHistoryWriter,
	asText,
};
