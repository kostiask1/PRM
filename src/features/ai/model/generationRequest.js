export function sanitizeAiContextConfig(contextConfig) {
	if (!contextConfig) return null;
	const sanitized = JSON.parse(JSON.stringify(contextConfig));
	if (sanitized.sessions) {
		for (const session of Object.values(sanitized.sessions)) {
			if (session && typeof session === "object") delete session.data;
		}
	}
	return sanitized;
}

export function buildAiGenerationRequest({
	type = null,
	isBestiary = false,
	isEncounter = false,
	isCampaign = false,
	forceParseAIResponse = null,
	parseAIResponse = false,
	selectedModel = "",
	userInstructions = "",
	userInstructionsOverride = null,
	initialRoute,
	targetSceneId = null,
	imageTarget = null,
	attachedImages = [],
	attachedFiles = [],
	imagePromptBasePromptOverride,
	generateCharacters = false,
	generateNpcs = false,
	generateLocations = false,
	generateEncounters = false,
	generateCustomMonsters = false,
	useContext = false,
	contextConfig = null,
	currentLanguage,
}) {
	const requestType = isBestiary && type !== "image" ? "custom-monster" : type;
	const shouldParseResponse =
		requestType === "image"
			? false
			: isBestiary
				? true
				: forceParseAIResponse === null
					? parseAIResponse
					: forceParseAIResponse;
	const structuredEntityOptionsEnabled =
		shouldParseResponse && !isEncounter && !isBestiary;

	return {
		requestType,
		shouldParseResponse,
		payload: {
			type: requestType,
			modelName: selectedModel || undefined,
			userInstructions:
				userInstructionsOverride === null
					? userInstructions
					: userInstructionsOverride,
			path: initialRoute,
			sceneId: targetSceneId,
			imageTarget,
			attachedImages,
			attachedFiles,
			imagePromptBasePromptOverride,
			parseAIResponse: shouldParseResponse,
			generateCharacters: structuredEntityOptionsEnabled
				? generateCharacters
				: true,
			generateNpcs: structuredEntityOptionsEnabled ? generateNpcs : true,
			generateLocations: structuredEntityOptionsEnabled
				? generateLocations
				: true,
			generateEncounters:
				requestType === "image"
					? false
					: shouldParseResponse &&
						!isCampaign &&
						!isBestiary &&
						generateEncounters,
			generateCustomMonsters:
				requestType !== "image" &&
				shouldParseResponse &&
				!isCampaign &&
				!isBestiary &&
				generateEncounters &&
				generateCustomMonsters,
			contextConfig:
				!isBestiary && useContext
					? sanitizeAiContextConfig(contextConfig)
					: null,
			language: currentLanguage,
		},
	};
}
