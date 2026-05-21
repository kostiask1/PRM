function asText(value) {
	if (value === null || value === undefined) return "";
	if (
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "bigint" ||
		typeof value === "boolean"
	) {
		return String(value).trim();
	}
	return "";
}

function isContextListIncluded(contextConfig) {
	if (!contextConfig) return false;
	if (contextConfig === true) return true;
	if (typeof contextConfig !== "object") return Boolean(contextConfig);
	return contextConfig.included !== false;
}

function getAiRequestMode(type, path = {}) {
	if (type) return type;
	if (path.encounter) return "encounter";
	if (path.session) return "session";
	return "campaign";
}

function buildAiOptionsSummary(options) {
	const parts = [
		`mode: ${options.mode}`,
		`parse: ${options.responseParsing ? "on" : "off"}`,
		`characters: ${options.characterGeneration ? "on" : "off"}`,
		`npcs: ${options.npcGeneration ? "on" : "off"}`,
		`locations: ${options.locationGeneration ? "on" : "off"}`,
		`entity-scope: ${options.entityScope || "campaign"}`,
		`encounters: ${options.encounterGeneration ? "on" : "off"}`,
		`custom-monsters: ${options.customMonsterGeneration ? "on" : "off"}`,
		`context: ${options.contextEnabled ? "on" : "off"}`,
	];
	if (options.modelName) parts.push(`model: ${options.modelName}`);
	if (options.sceneId) parts.push(`scene: ${options.sceneId}`);
	if (options.imageTarget) {
		parts.push(
			`image-target: ${[options.imageTarget.type, options.imageTarget.name]
				.filter(Boolean)
				.join(": ")}`,
		);
	}
	if (options.globalBasePrompt) parts.push("global-base-prompt: on");
	if (options.imagePromptBasePrompt) parts.push("image-base-prompt: on");
	if (options.campaignBasePrompt) parts.push("campaign-base-prompt: on");
	return parts.join("; ");
}

function buildAiContextSummary(contextConfig, contextData = {}) {
	if (!contextConfig) {
		return {
			enabled: false,
			campaignNotes: 0,
			campaignCharacters: 0,
			campaignNpcs: 0,
			campaignLocations: 0,
			sessions: 0,
			scenes: 0,
			summary: "context: off",
		};
	}

	const sessions = Array.isArray(contextData.sessions)
		? contextData.sessions
		: [];
	const scenes = sessions.reduce(
		(total, session) =>
			total +
			(Array.isArray(session?.data?.scenes) ? session.data.scenes.length : 0),
		0,
	);
	const campaignNotes = Array.isArray(contextData.campaign?.notes)
		? contextData.campaign.notes.length
		: 0;
	const campaignCharacters = Array.isArray(contextData.campaign?.characters)
		? contextData.campaign.characters.length
		: 0;
	const campaignNpcs = Array.isArray(contextData.campaign?.npcs)
		? contextData.campaign.npcs.length
		: 0;
	const campaignLocations = Array.isArray(contextData.campaign?.locations)
		? contextData.campaign.locations.length
		: 0;

	const parts = [];
	if (contextConfig.campaignNotes) parts.push(`notes: ${campaignNotes}`);
	if (isContextListIncluded(contextConfig.campaignCharacters)) {
		parts.push(`characters: ${campaignCharacters}`);
	}
	if (
		isContextListIncluded(contextConfig.campaignNpcs) ||
		(contextConfig.campaignNpcs === undefined &&
			isContextListIncluded(contextConfig.campaignCharacters))
	) {
		parts.push(`npcs: ${campaignNpcs}`);
	}
	if (isContextListIncluded(contextConfig.campaignLocations)) {
		parts.push(`locations: ${campaignLocations}`);
	}
	if (sessions.length) parts.push(`sessions: ${sessions.length}`);
	if (scenes) parts.push(`scenes: ${scenes}`);

	return {
		enabled: true,
		campaignNotes,
		campaignCharacters,
		campaignNpcs,
		campaignLocations,
		sessions: sessions.length,
		scenes,
		summary: parts.length ? `context: ${parts.join(", ")}` : "context: empty",
	};
}

function buildAiRequestSnapshot({
	type,
	modelName,
	userInstructions,
	path,
	sceneId,
	imageTarget,
	parseAIResponse,
	shouldParseAIResponse,
	generateEncounters,
	generateCustomMonsters,
	generateCharacters,
	generateNpcs,
	generateLocations,
	entityScope,
	contextConfig,
	contextData,
	language,
	globalBasePrompt,
	imagePromptBasePrompt,
	campaignBasePrompt,
}) {
	const options = {
		mode: getAiRequestMode(type, path),
		modelName: modelName || null,
		language,
		responseParsing: Boolean(shouldParseAIResponse),
		requestedResponseParsing: Boolean(parseAIResponse),
		characterGeneration: Boolean(generateCharacters),
		npcGeneration: Boolean(generateNpcs),
		locationGeneration: Boolean(generateLocations),
		entityScope: entityScope || "campaign",
		encounterGeneration: Boolean(generateEncounters),
		customMonsterGeneration: Boolean(generateCustomMonsters),
		contextEnabled: Boolean(contextConfig),
		globalBasePrompt: Boolean(asText(globalBasePrompt)),
		imagePromptBasePrompt: Boolean(asText(imagePromptBasePrompt)),
		campaignBasePrompt: Boolean(asText(campaignBasePrompt)),
		sceneId: sceneId || null,
		imageTarget:
			imageTarget && typeof imageTarget === "object"
				? {
						type: asText(imageTarget.type),
						name: asText(imageTarget.name),
					}
				: null,
	};
	const context = buildAiContextSummary(contextConfig, contextData);

	return {
		userInstructions: asText(userInstructions),
		options,
		optionsSummary: buildAiOptionsSummary(options),
		context,
		contextSummary: context.summary,
	};
}

function formatGeneratedContentForHistory(generatedContent) {
	if (typeof generatedContent === "string") return generatedContent;
	return [
		"Parsed AI response",
		"",
		"```json",
		JSON.stringify(generatedContent ?? null, null, 2),
		"```",
	].join("\n");
}

module.exports = {
	buildAiContextSummary,
	buildAiOptionsSummary,
	buildAiRequestSnapshot,
	formatGeneratedContentForHistory,
	getAiRequestMode,
};
