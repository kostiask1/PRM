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
const TEXT_MODEL_CATALOG = [
	"gemini-3.8-flash",
	"gemini-3.7-flash",
	"gemini-3.6-flash",
	"gemini-3.5-flash",
	"gemini-3.5-flash-lite",
	"gemini-3.1-pro-preview",
	"gemini-3.1-flash-lite",
];
const DEFAULT_TEXT_MODEL = TEXT_MODEL_CATALOG[0];
const TEXT_MODEL_NAMES = new Set(TEXT_MODEL_CATALOG);
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
	return models[0]?.name || DEFAULT_TEXT_MODEL;
}

function buildFallbackModelCatalog() {
	return TEXT_MODEL_CATALOG.map((name) => ({ name, displayName: name }));
}

async function listAvailableModels({ forceRefresh = false } = {}) {
	const now = Date.now();
	if (!forceRefresh && modelCache.data && modelCache.expiresAt > now) {
		return modelCache.data;
	}

	if (!process.env.GEMINI_API_KEY) {
		const fallback = {
			models: buildFallbackModelCatalog(),
			defaultModel: DEFAULT_TEXT_MODEL,
			source: "fallback",
		};
		modelCache = { data: fallback, expiresAt: now + MODEL_CACHE_TTL_MS };
		return fallback;
	}

	try {
		const response = await fetch(
			`${GEMINI_MODELS_ENDPOINT}?pageSize=1000&key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
		);
		if (!response.ok) {
			throw new Error(`Gemini models request failed: ${response.status}`);
		}
		const payload = await response.json();
		const models = (payload.models || [])
			.filter((model) => Array.isArray(model.supportedGenerationMethods))
			.filter((model) =>
				model.supportedGenerationMethods.includes("generateContent"),
			)
			.map((model) => ({
				name: normalizeModelName(model.name),
				displayName: model.displayName || normalizeModelName(model.name),
				description: model.description || "",
				inputTokenLimit: model.inputTokenLimit,
				outputTokenLimit: model.outputTokenLimit,
			}))
			.filter((model) => model.name)
			.filter((model) => TEXT_MODEL_NAMES.has(model.name));

		const modelsByName = new Map(
			models.map((model) => [model.name, model]),
		);
		const ordered = TEXT_MODEL_CATALOG.flatMap((name) => {
			const model = modelsByName.get(name);
			return model ? [model] : [];
		});

		const result = {
			models: ordered.length
				? ordered
				: buildFallbackModelCatalog(),
			defaultModel: pickDefaultModel(ordered),
			source: "api",
		};
		modelCache = { data: result, expiresAt: now + MODEL_CACHE_TTL_MS };
		return result;
	} catch (error) {
		const fallback = {
			models: buildFallbackModelCatalog(),
			defaultModel: DEFAULT_TEXT_MODEL,
			source: "fallback",
			error: error.message,
		};
		modelCache = { data: fallback, expiresAt: now + MODEL_CACHE_TTL_MS };
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
