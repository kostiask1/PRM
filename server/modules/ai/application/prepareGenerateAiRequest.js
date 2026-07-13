const { asText } = require("../../../ai/AiHistoryWriter");

function isBestiaryImagePromptRequestPayload(payload = {}) {
	return (
		payload?.type === "image" &&
		(payload?.path?.campaign === "bestiary" ||
			asText(payload?.imageTarget?.type) === "custom-monster")
	);
}

function getGenerateRequestPath(payload = {}) {
	if (isBestiaryImagePromptRequestPayload(payload) && !payload?.path?.campaign) {
		return { campaign: "bestiary", session: null, encounter: null };
	}
	return payload?.path && typeof payload.path === "object" ? payload.path : {};
}

function getCampaignBasePrompt(settings, campaignSlug) {
	const prompts =
		settings?.campaignAiBasePrompts &&
		typeof settings.campaignAiBasePrompts === "object"
			? settings.campaignAiBasePrompts
			: {};
	return asText(prompts[campaignSlug]);
}

function getCampaignImagePromptBasePrompt(settings, campaignSlug) {
	const prompts =
		settings?.campaignImagePromptBasePrompts &&
		typeof settings.campaignImagePromptBasePrompts === "object"
			? settings.campaignImagePromptBasePrompts
			: {};
	return asText(prompts[campaignSlug]);
}

async function prepareGenerateAiRequest({
	payload = {},
	apiKeyConfigured,
	readSettings,
}) {
	const responseLanguage = String(payload.language || "").trim().toLowerCase();
	if (!responseLanguage) {
		return { error: { status: 400, message: "language is required." } };
	}
	if (!apiKeyConfigured) {
		return {
			error: { status: 500, message: "GEMINI_API_KEY is not configured." },
		};
	}
	const requestPath = getGenerateRequestPath(payload);
	const requestedEncounterGeneration = Boolean(payload.generateEncounters);
	const shouldParseAIResponse =
		payload.type !== "image" &&
		Boolean(payload.parseAIResponse) &&
		(!requestPath?.encounter || requestedEncounterGeneration);
	const encounterGenerationEnabled =
		shouldParseAIResponse && requestedEncounterGeneration;
	const settings = await readSettings();
	const simplifiedNotesEnabled = Boolean(settings.simplifiedNotes);
	const globalBasePrompt = asText(settings.aiBasePrompt);
	const imagePromptBasePrompt =
		payload.type === "image" &&
		Object.prototype.hasOwnProperty.call(
			payload,
			"imagePromptBasePromptOverride",
		)
			? asText(payload.imagePromptBasePromptOverride)
			: getCampaignImagePromptBasePrompt(settings, requestPath?.campaign) ||
				asText(settings.imagePromptBasePrompt);
	return {
		error: null,
		requestPath,
		responseLanguage,
		isBestiaryImagePromptRequest:
			isBestiaryImagePromptRequestPayload(payload),
		shouldParseAIResponse,
		encounterGenerationEnabled,
		customMonsterGenerationEnabled:
			encounterGenerationEnabled && Boolean(payload.generateCustomMonsters),
		characterGenerationEnabled: shouldParseAIResponse
			? payload.generateCharacters !== false
			: true,
		npcGenerationEnabled: shouldParseAIResponse
			? payload.generateNpcs !== false
			: true,
		locationGenerationEnabled: shouldParseAIResponse
			? payload.generateLocations !== false
			: true,
		entityTargetScope:
			shouldParseAIResponse && requestPath?.session && !requestPath?.encounter
				? "mixed"
				: "campaign",
		simplifiedNotesEnabled,
		autoApplyAiChanges: settings.autoApplyAiChanges !== false,
		globalBasePrompt,
		imagePromptBasePrompt,
		campaignBasePrompt: getCampaignBasePrompt(settings, requestPath?.campaign),
	};
}

module.exports = {
	getGenerateRequestPath,
	isBestiaryImagePromptRequestPayload,
	prepareGenerateAiRequest,
};
