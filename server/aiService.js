const {
	buildPromptContext,
} = require("./modules/ai/application/buildPromptContext");
const {
	buildUserPrompt,
} = require("./modules/ai/application/buildUserPrompt");
const {
	buildSystemInstruction,
} = require("./modules/ai/application/buildSystemInstruction");
const {
	normalizeModelName,
	resolveAiRequest,
	selectAiModel,
} = require("./modules/ai/application/resolveAiRequest");
const {
	extractFirstJsonObject,
	parseAiResponseText,
	stripOuterJsonFence,
} = require("./modules/ai/application/parseAiResponse");
const {
	geminiGateway,
} = require("./modules/ai/infrastructure/geminiGateway");
const {
	buildFileParts,
	buildImageParts,
	collectImageUrls,
	resolveLocalImageUrl,
} = require("./modules/ai/infrastructure/attachmentParts");

const GEMINI_MODELS_ENDPOINT =
	"https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_CACHE_TTL_MS = 10 * 60 * 1000;
let modelCache = {
	expiresAt: 0,
	data: null,
};
function clearModelCache() {
	modelCache = {
		expiresAt: 0,
		data: null,
	};
}
function pickDefaultModel(models) {
	return models[0]?.name || "";
}

function modelRank(name) {
	if (/(?:^|-)pro(?:-|$)/i.test(name)) return 0;
	if (/(?:^|-)flash-lite(?:-|$)/i.test(name)) return 2;
	if (/(?:^|-)flash(?:-|$)/i.test(name)) return 1;
	return 3;
}

async function listAvailableModels({ forceRefresh = false } = {}) {
	const now = Date.now();
	if (!forceRefresh && modelCache.data && modelCache.expiresAt > now) {
		return modelCache.data;
	}

	if (!process.env.GEMINI_API_KEY) {
		const fallback = {
			models: [],
			defaultModel: "",
			source: "fallback",
		};
		modelCache = { data: fallback, expiresAt: now + MODEL_CACHE_TTL_MS };
		return fallback;
	}

	try {
		let pageToken = "";
		const allModels = [];
		do {
		const params = new URLSearchParams({ pageSize: "1000", key: process.env.GEMINI_API_KEY });
		if (pageToken) params.set("pageToken", pageToken);
		const response = await fetch(`${GEMINI_MODELS_ENDPOINT}?${params}`);
		console.log('response:', response)
		if (!response.ok) {
			throw new Error(`Gemini models request failed: ${response.status}`);
		}
		const payload = await response.json();
		console.log('payload:', payload)
		allModels.push(...(payload.models || []));
		console.log('allModels:', allModels)
		pageToken = payload.nextPageToken || "";
		} while (pageToken);
		const models = allModels
			.filter((model) => Array.isArray(model.supportedGenerationMethods))
			.filter((model) =>
				model.supportedGenerationMethods.includes("generateContent"),
			)
			.filter((model) => !/(?:preview|tts|image|nano[\s-]*banana)/i.test(`${model.name || ""} ${model.displayName || ""}`))
			.map((model) => ({
				name: normalizeModelName(model.name),
				displayName: model.displayName || normalizeModelName(model.name),
				description: model.description || "",
				inputTokenLimit: model.inputTokenLimit,
				outputTokenLimit: model.outputTokenLimit,
			}))
			.filter((model) => model.name);
		const ordered = Array.from(new Map(models.map((model) => [model.name, model])).values())
			.sort((a, b) => modelRank(a.name) - modelRank(b.name) || b.name.localeCompare(a.name, "en", { numeric: true }));

		const result = {
			models: ordered,
			defaultModel: pickDefaultModel(ordered),
			source: "api",
		};
		modelCache = { data: result, expiresAt: now + MODEL_CACHE_TTL_MS };
		return result;
	} catch (error) {
		const fallback = {
			models: [],
			defaultModel: "",
			source: "fallback",
			error: error.message,
		};
		return fallback;
	}
}



async function generateContent({
	type,
	session,
	campaign,
	userInstructions,
	encounterId,
	sceneId,
	imageTarget,
	attachedImages,
	attachedFiles,
	parseAIResponse,
	contextData,
	generateCharacters,
	generateNpcs,
	generateLocations,
	generateEncounters,
	generateCustomMonsters,
	editEncounterCreatures,
	entityScope,
	modelName,
	language,
	simplifiedNotes,
	globalBasePrompt,
	imagePromptBasePrompt,
	campaignBasePrompt,
}) {
	const {
		characterGenerationEnabled,
		customMonsterGenerationEnabled,
		encounterCreatureEditingEnabled,
		effectiveParseAIResponse,
		encounterGenerationEnabled,
		entityTargetScope,
		locationGenerationEnabled,
		npcGenerationEnabled,
		responseLanguage,
		simplifiedNotesEnabled,
		useKey,
		usesStructuredJsonContract,
	} = resolveAiRequest({
		type,
		session,
		encounterId,
		parseAIResponse,
		generateCharacters,
		generateNpcs,
		generateLocations,
		generateEncounters,
		generateCustomMonsters,
		editEncounterCreatures,
		entityScope,
		language,
		simplifiedNotes,
	});

	const availableModels = await listAvailableModels();
	const selectedModel = selectAiModel(availableModels, modelName);
	const systemInstruction = buildSystemInstruction({
		useKey,
		responseLanguage,
		usesStructuredJsonContract,
		simplifiedNotesEnabled,
		effectiveParseAIResponse,
		npcGenerationEnabled,
		locationGenerationEnabled,
		encounterGenerationEnabled,
		customMonsterGenerationEnabled,
		encounterCreatureEditingEnabled,
		characterGenerationEnabled,
		entityTargetScope,
		globalBasePrompt,
		campaignBasePrompt,
		imagePromptBasePrompt,
	});

	const contextJson = buildPromptContext({
		campaign,
		session,
		contextData,
		entityTargetScope,
		encounterId,
		simplifiedNotesEnabled,
		encounterCreatureEditingEnabled,
	});
	const userPrompt = buildUserPrompt({
		contextJson,
		useKey,
		imageTarget,
		sceneId,
		entityTargetScope,
		encounterId,
		customMonsterGenerationEnabled,
		encounterGenerationEnabled,
		encounterCreatureEditingEnabled,
		userInstructions,
	});
	const imageParts = await buildImageParts(attachedImages);
	const fileParts = buildFileParts(attachedFiles);
	const attachmentParts = [...imageParts, ...fileParts];
	const text = await geminiGateway.generateText({
		modelName: selectedModel,
		systemInstruction,
		useJsonResponse: useKey !== "prompt" && useKey !== "image",
		userPrompt,
		attachmentParts,
	});

	return parseAiResponseText({
		text,
		shouldParse: effectiveParseAIResponse,
	});
}

module.exports = {
	generateContent,
	listAvailableModels,
	clearModelCache,
	__test: {
		stripOuterJsonFence,
		extractFirstJsonObject,
		collectImageUrls,
		resolveLocalImageUrl,
		buildImageParts,
	},
};
