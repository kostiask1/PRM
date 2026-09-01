const { asText } = require("../../../ai/AiHistoryWriter");

function readProperty(value, key) {
	if (value === null || value === undefined) return undefined;
	return value[key];
}

function isBestiaryImagePromptRequestPayload(payload = {}) {
	if (readProperty(payload, "type") !== "image") return false;
	const path = readProperty(payload, "path");
	if (readProperty(path, "campaign") === "bestiary") return true;
	const imageTarget = readProperty(payload, "imageTarget");
	return asText(readProperty(imageTarget, "type")) === "custom-monster";
}

function asRequestPath(path) {
	if (path && typeof path === "object") return path;
	return {};
}

function getGenerateRequestPath(payload = {}) {
	const path = readProperty(payload, "path");
	const campaign = readProperty(path, "campaign");
	if (isBestiaryImagePromptRequestPayload(payload) && !campaign) {
		return { campaign: "bestiary", session: null, encounter: null };
	}
	return asRequestPath(path);
}

function asSettingsRecord(settings) {
	if (settings === null || settings === undefined) return {};
	return Object(settings);
}

function getCampaignPrompt(settings, promptMapKey, campaignSlug) {
	const candidate = settings[promptMapKey];
	const prompts = candidate && typeof candidate === "object" ? candidate : {};
	return asText(prompts[campaignSlug]);
}

function getCampaignBasePrompt(settings, campaignSlug) {
	return getCampaignPrompt(settings, "campaignAiBasePrompts", campaignSlug);
}

function getCampaignImagePromptBasePrompt(settings, campaignSlug) {
	return getCampaignPrompt(
		settings,
		"campaignImagePromptBasePrompts",
		campaignSlug,
	);
}

function getResponseLanguage(payload) {
	return String(payload.language || "").trim().toLowerCase();
}

function getPreflightError(responseLanguage, apiKeyConfigured) {
	if (!responseLanguage) {
		return { status: 400, message: "language is required." };
	}
	if (!apiKeyConfigured) {
		return { status: 500, message: "GEMINI_API_KEY is not configured." };
	}
	return null;
}

function isParsingRequested(payload) {
	if (payload.type === "image") return false;
	return Boolean(payload.parseAIResponse);
}

function encounterTargetAllowsParsing(requestPath, requestedGeneration) {
	if (!readProperty(requestPath, "encounter")) return true;
	return requestedGeneration;
}

function enableWhenParsing(shouldParseAIResponse, requestedValue) {
	if (!shouldParseAIResponse) return false;
	return Boolean(requestedValue);
}

function getParsingPolicy(payload, requestPath) {
	const requestedEncounterGeneration = Boolean(payload.generateEncounters);
	const shouldParseAIResponse =
		isParsingRequested(payload) &&
		encounterTargetAllowsParsing(requestPath, requestedEncounterGeneration);
	return {
		shouldParseAIResponse,
		encounterGenerationEnabled: enableWhenParsing(
			shouldParseAIResponse,
			requestedEncounterGeneration,
		),
	};
}

function getParsedGenerationToggle(shouldParseAIResponse, value) {
	if (!shouldParseAIResponse) return true;
	return value !== false;
}

function getGenerationPolicy(payload, parsingPolicy) {
	const { shouldParseAIResponse, encounterGenerationEnabled } = parsingPolicy;
	return {
		customMonsterGenerationEnabled:
			encounterGenerationEnabled && Boolean(payload.generateCustomMonsters),
		characterGenerationEnabled: getParsedGenerationToggle(
			shouldParseAIResponse,
			payload.generateCharacters,
		),
		npcGenerationEnabled: getParsedGenerationToggle(
			shouldParseAIResponse,
			payload.generateNpcs,
		),
		locationGenerationEnabled: getParsedGenerationToggle(
			shouldParseAIResponse,
			payload.generateLocations,
		),
	};
}

function getEntityTargetScope(shouldParseAIResponse, requestPath) {
	if (!shouldParseAIResponse) return "campaign";
	if (!readProperty(requestPath, "session")) return "campaign";
	if (readProperty(requestPath, "encounter")) return "campaign";
	return "mixed";
}

function hasImagePromptOverride(payload) {
	if (payload.type !== "image") return false;
	return Object.prototype.hasOwnProperty.call(
		payload,
		"imagePromptBasePromptOverride",
	);
}

function getImagePromptBasePrompt(payload, settings, requestPath) {
	if (hasImagePromptOverride(payload)) {
		return asText(payload.imagePromptBasePromptOverride);
	}
	return (
		getCampaignImagePromptBasePrompt(settings, requestPath?.campaign) ||
		asText(settings.imagePromptBasePrompt)
	);
}

function createPreparedResult({
	payload,
	requestPath,
	responseLanguage,
	settings,
	parsingPolicy,
}) {
	return {
		error: null,
		requestPath,
		responseLanguage,
		isBestiaryImagePromptRequest:
			isBestiaryImagePromptRequestPayload(payload),
		...parsingPolicy,
		...getGenerationPolicy(payload, parsingPolicy),
		entityTargetScope: getEntityTargetScope(
			parsingPolicy.shouldParseAIResponse,
			requestPath,
		),
		simplifiedNotesEnabled: Boolean(settings.simplifiedNotes),
		autoApplyAiChanges: settings.autoApplyAiChanges !== false,
		globalBasePrompt: asText(settings.aiBasePrompt),
		imagePromptBasePrompt: getImagePromptBasePrompt(
			payload,
			settings,
			requestPath,
		),
		campaignBasePrompt: getCampaignBasePrompt(
			settings,
			requestPath?.campaign,
		),
	};
}

async function prepareGenerateAiRequest({
	payload = {},
	apiKeyConfigured,
	readSettings,
}) {
	const responseLanguage = getResponseLanguage(payload);
	const preflightError = getPreflightError(
		responseLanguage,
		apiKeyConfigured,
	);
	if (preflightError) return { error: preflightError };

	const requestPath = getGenerateRequestPath(payload);
	const parsingPolicy = getParsingPolicy(payload, requestPath);
	const settings = asSettingsRecord(await readSettings());
	return createPreparedResult({
		payload,
		requestPath,
		responseLanguage,
		settings,
		parsingPolicy,
	});
}

module.exports = {
	getGenerateRequestPath,
	isBestiaryImagePromptRequestPayload,
	prepareGenerateAiRequest,
};
