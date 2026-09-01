const TEXT_SCALAR_TYPES = new Set(["string", "number", "bigint", "boolean"]);

const PARSING_OPTION_SUMMARIES = [
	["characterGeneration", "characters"],
	["npcGeneration", "npcs"],
	["locationGeneration", "locations"],
	["encounterGeneration", "encounters"],
	["customMonsterGeneration", "custom-monsters"],
];

const BASE_PROMPT_SUMMARIES = [
	["globalBasePrompt", "global-base-prompt: on"],
	["imagePromptBasePrompt", "image-base-prompt: on"],
	["campaignBasePrompt", "campaign-base-prompt: on"],
];

function asText(value) {
	if (value === null || value === undefined) return "";
	if (!TEXT_SCALAR_TYPES.has(typeof value)) return "";
	return String(value).trim();
}

function asArray(value) {
	return Array.isArray(value) ? value : [];
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

function appendBooleanSummaries(parts, options, summaries) {
	summaries.forEach(([key, label]) => {
		parts.push(`${label}: ${options[key] ? "on" : "off"}`);
	});
}

function appendParsingSummaries(parts, options) {
	if (!options.responseParsing) return;
	appendBooleanSummaries(parts, options, PARSING_OPTION_SUMMARIES);
}

function appendSummaryWhen(parts, condition, summary) {
	if (condition) parts.push(summary);
}

function formatImageTargetSummary(imageTarget) {
	return [imageTarget.type, imageTarget.name].filter(Boolean).join(": ");
}

function appendImageTargetSummary(parts, imageTarget) {
	if (!imageTarget) return;
	parts.push(`image-target: ${formatImageTargetSummary(imageTarget)}`);
}

function buildAiOptionsSummary(options) {
	const parts = [
		`mode: ${options.mode}`,
		`parse: ${options.responseParsing ? "on" : "off"}`,
		`context: ${options.contextEnabled ? "on" : "off"}`,
	];
	appendParsingSummaries(parts, options);
	appendSummaryWhen(parts, options.modelName, `model: ${options.modelName}`);
	appendSummaryWhen(parts, options.sceneId, `scene: ${options.sceneId}`);
	appendImageTargetSummary(parts, options.imageTarget);
	BASE_PROMPT_SUMMARIES.forEach(([key, summary]) => {
		appendSummaryWhen(parts, options[key], summary);
	});
	return parts.join("; ");
}

function createDisabledContextSummary() {
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

function countCampaignCollection(contextData, key) {
	return asArray(contextData.campaign?.[key]).length;
}

function countSessionScenes(session) {
	return asArray(session?.data?.scenes).length;
}

function projectContextCounts(contextData) {
	const sessions = asArray(contextData.sessions);
	return {
		campaignNotes: countCampaignCollection(contextData, "notes"),
		campaignCharacters: countCampaignCollection(contextData, "characters"),
		campaignNpcs: countCampaignCollection(contextData, "npcs"),
		campaignLocations: countCampaignCollection(contextData, "locations"),
		sessions: sessions.length,
		scenes: sessions.reduce(
			(total, session) => total + countSessionScenes(session),
			0,
		),
	};
}

function includesCampaignNotes(contextConfig) {
	return Boolean(contextConfig.campaignNotes);
}

function includesCampaignCharacters(contextConfig) {
	return isContextListIncluded(contextConfig.campaignCharacters);
}

function includesCampaignNpcs(contextConfig) {
	const npcConfig = contextConfig.campaignNpcs;
	return (
		isContextListIncluded(npcConfig) ||
		(npcConfig === undefined && includesCampaignCharacters(contextConfig))
	);
}

function includesCampaignLocations(contextConfig) {
	return isContextListIncluded(contextConfig.campaignLocations);
}

function includesSessions(_contextConfig, counts) {
	return Boolean(counts.sessions);
}

function includesScenes(_contextConfig, counts) {
	return Boolean(counts.scenes);
}

const CONTEXT_SUMMARY_POLICIES = [
	[includesCampaignNotes, "notes", "campaignNotes"],
	[includesCampaignCharacters, "characters", "campaignCharacters"],
	[includesCampaignNpcs, "npcs", "campaignNpcs"],
	[includesCampaignLocations, "locations", "campaignLocations"],
	[includesSessions, "sessions", "sessions"],
	[includesScenes, "scenes", "scenes"],
];

function appendContextSummaryPart(parts, contextConfig, counts, policy) {
	const [isIncluded, label, countKey] = policy;
	if (isIncluded(contextConfig, counts)) {
		parts.push(`${label}: ${counts[countKey]}`);
	}
}

function buildEnabledContextSummary(contextConfig, counts) {
	const parts = [];
	CONTEXT_SUMMARY_POLICIES.forEach((policy) => {
		appendContextSummaryPart(parts, contextConfig, counts, policy);
	});
	return {
		enabled: true,
		...counts,
		summary: parts.length ? `context: ${parts.join(", ")}` : "context: empty",
	};
}

function buildAiContextSummary(contextConfig, contextData = {}) {
	if (!contextConfig) return createDisabledContextSummary();
	return buildEnabledContextSummary(
		contextConfig,
		projectContextCounts(contextData),
	);
}

function projectImageTarget(imageTarget) {
	if (!imageTarget || typeof imageTarget !== "object") return null;
	return {
		type: asText(imageTarget.type),
		name: asText(imageTarget.name),
	};
}

function buildSnapshotOptions(input) {
	return {
		mode: getAiRequestMode(input.type, input.path),
		modelName: input.modelName || null,
		language: input.language,
		responseParsing: Boolean(input.shouldParseAIResponse),
		requestedResponseParsing: Boolean(input.parseAIResponse),
		characterGeneration: Boolean(input.generateCharacters),
		npcGeneration: Boolean(input.generateNpcs),
		locationGeneration: Boolean(input.generateLocations),
		encounterGeneration: Boolean(input.generateEncounters),
		customMonsterGeneration: Boolean(input.generateCustomMonsters),
		contextEnabled: Boolean(input.contextConfig),
		globalBasePrompt: Boolean(asText(input.globalBasePrompt)),
		imagePromptBasePrompt: Boolean(asText(input.imagePromptBasePrompt)),
		campaignBasePrompt: Boolean(asText(input.campaignBasePrompt)),
		sceneId: input.sceneId || null,
		imageTarget: projectImageTarget(input.imageTarget),
	};
}

function assignTextProperty(target, key, value) {
	const text = asText(value);
	if (text) target[key] = text;
}

function projectImageAttachment(image) {
	const attachment = {};
	assignTextProperty(attachment, "name", image?.name);
	assignTextProperty(attachment, "url", image?.url);
	return attachment;
}

function hasImageAttachmentContent(image) {
	return Boolean(image.name || image.url);
}

function projectFileAttachment(file) {
	return { name: asText(file?.name) };
}

function hasFileAttachmentContent(file) {
	return Boolean(file.name);
}

function projectAttachmentList(values, projectItem, hasContent) {
	return asArray(values).map(projectItem).filter(hasContent);
}

function addAttachmentList(attachments, key, values) {
	if (values.length > 0) attachments[key] = values;
}

function buildSnapshotAttachments(attachedImages, attachedFiles) {
	const attachments = {};
	addAttachmentList(
		attachments,
		"images",
		projectAttachmentList(
			attachedImages,
			projectImageAttachment,
			hasImageAttachmentContent,
		),
	);
	addAttachmentList(
		attachments,
		"files",
		projectAttachmentList(
			attachedFiles,
			projectFileAttachment,
			hasFileAttachmentContent,
		),
	);
	return attachments;
}

function addAttachments(snapshot, attachments) {
	if (Object.keys(attachments).length > 0) snapshot.attachments = attachments;
}

function buildAiRequestSnapshot(input) {
	const options = buildSnapshotOptions(input);
	const context = buildAiContextSummary(input.contextConfig, input.contextData);
	const snapshot = {
		userInstructions: asText(input.userInstructions),
		options,
		optionsSummary: buildAiOptionsSummary(options),
		context,
		contextSummary: context.summary,
	};
	addAttachments(
		snapshot,
		buildSnapshotAttachments(input.attachedImages, input.attachedFiles),
	);
	return snapshot;
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
	buildAiRequestSnapshot,
	formatGeneratedContentForHistory,
};
