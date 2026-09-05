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

function getFailedErrorValue(error) {
	if (!error) return undefined;
	return error.message || error.error;
}

function getFailedErrorMessage(error) {
	return asText(getFailedErrorValue(error)) || "AI request failed.";
}

function getFailedStatusLine(status) {
	return status ? `Status: ${status}` : null;
}

function getFailedAiResponseText(error, status = null) {
	return [
		"AI request failed",
		"",
		getFailedStatusLine(status),
		getFailedErrorMessage(error),
	]
		.filter(Boolean)
		.join("\n");
}

function getRetryImageFields(image) {
	return [
		["name", asText(image.name)],
		["url", asText(image.url)],
		["mimeType", asText(image.mimeType)],
		["sizeBytes", Number(image.sizeBytes) || 0],
	];
}

function hasRetryImageField(fields) {
	return fields.some(([, value]) => Boolean(value));
}

function compactRetryFields(fields) {
	return Object.fromEntries(fields.filter(([, value]) => Boolean(value)));
}

function isRetryAttachment(value) {
	return Boolean(value) && typeof value === "object";
}

function shouldKeepRetryImage(fields, image) {
	return hasRetryImageField(fields) || Boolean(image.data);
}

function createRetryImage(fields, image) {
	const projected = compactRetryFields(fields);
	if (image.data) projected.omittedData = true;
	return projected;
}

function projectRetryImage(image) {
	if (!isRetryAttachment(image)) return null;
	const fields = getRetryImageFields(image);
	if (!shouldKeepRetryImage(fields, image)) return null;
	return createRetryImage(fields, image);
}

function projectRetryFile(file) {
	if (!isRetryAttachment(file)) return null;
	const name = asText(file.name);
	return name ? { name } : null;
}

function projectRetryCollection(value, projectItem) {
	return value.map(projectItem).filter(Boolean);
}

function projectRetryAttachments(cloned) {
	if (Array.isArray(cloned.attachedImages)) {
		cloned.attachedImages = projectRetryCollection(
			cloned.attachedImages,
			projectRetryImage,
		);
	}
	if (Array.isArray(cloned.attachedFiles)) {
		cloned.attachedFiles = projectRetryCollection(
			cloned.attachedFiles,
			projectRetryFile,
		);
	}
	return cloned;
}

function cloneRetryPayload(payload) {
	const cloned = JSON.parse(JSON.stringify(payload || {}));
	return projectRetryAttachments(cloned);
}

function getFailedHistoryPath(payload) {
	return payload?.path && typeof payload.path === "object" ? payload.path : {};
}

function shouldParseFailedResponse(payload, path) {
	return (
		payload.type !== "image" &&
		Boolean(payload.parseAIResponse) &&
		(!path.encounter ||
			payload.generateEncounters ||
			Boolean(payload.editEncounterCreatures))
	);
}

function createFailedRequestSnapshotInput({
	payload,
	path,
	historyUserInstructions,
}) {
	return {
		type: payload.type,
		modelName: payload.modelName,
		userInstructions: historyUserInstructions,
		path,
		sceneId: payload.sceneId,
		imageTarget: payload.imageTarget,
		attachedImages: payload.attachedImages,
		attachedFiles: payload.attachedFiles,
		parseAIResponse: payload.parseAIResponse,
		shouldParseAIResponse: shouldParseFailedResponse(payload, path),
		generateCharacters: payload.generateCharacters !== false,
		...(path.encounter
			? {
					editEncounterCreatures: Boolean(
						payload.editEncounterCreatures,
					),
				}
			: {}),
		generateNpcs: payload.generateNpcs !== false,
		generateLocations: payload.generateLocations !== false,
		generateEncounters: Boolean(payload.generateEncounters),
		generateCustomMonsters: Boolean(payload.generateCustomMonsters),
		entityScope: payload.entityScope,
		contextConfig: payload.contextConfig,
		contextData: {},
		language: payload.language,
	};
}

function createFailedResponsePayload({
	payload,
	path,
	historyUserInstructions,
	requestSnapshot,
	error,
	status,
	clonePayload,
}) {
	return {
		text: getFailedAiResponseText(error, status),
		path,
		type: payload.type || null,
		modelName: payload.modelName || null,
		language: payload.language || null,
		userInstructions: historyUserInstructions,
		request: requestSnapshot,
		status: "failed",
		error: {
			message: getFailedErrorMessage(error),
			status,
		},
		retryPayload: clonePayload(payload),
	};
}

class AiHistoryWriter {
	cloneRetryPayload(payload = {}) {
		return cloneRetryPayload(payload);
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
		const path = getFailedHistoryPath(payload);
		const campaignSlug = asText(path.campaign);
		if (!campaignSlug) return null;
		const historyUserInstructions = this.getUserInstructions(payload);
		const requestSnapshot = this.buildRequestSnapshot(
			createFailedRequestSnapshotInput({
				payload,
				path,
				historyUserInstructions,
			}),
		);
		return storage.addAiResponse(
			createFailedResponsePayload({
				payload,
				path,
				historyUserInstructions,
				requestSnapshot,
				error,
				status,
				clonePayload: (value) => this.cloneRetryPayload(value),
			}),
		);
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
