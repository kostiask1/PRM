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
const CORE_TEXT_MODELS = [
	"gemini-3.1-flash-lite-preview",
	"gemini-3-flash-preview",
	"gemini-2.5-flash",
	"gemini-2.5-pro",
	"gemini-2.5-flash-lite",
	"gemini-2.0-flash",
];
const FALLBACK_TEXT_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro"];
const PREFERRED_FAST_TEXT_MODELS = [
	"gemini-3.1-flash-lite-preview",
	"gemini-3-flash-preview",
	"gemini-2.5-flash",
	"gemini-2.5-flash-lite",
	"gemini-2.0-flash",
	"gemini-1.5-flash",
];
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

function isLikelyTextModel(name) {
	const lower = normalizeModelName(name).toLowerCase();
	return !["imagen", "veo", "embedding", "aqa", "learnlm"].some((token) =>
		lower.includes(token),
	);
}

function isCoreTextModel(name) {
	const lower = normalizeModelName(name).toLowerCase();
	return CORE_TEXT_MODELS.some(
		(core) => lower === core || lower.startsWith(`${core}-`),
	);
}

function pickDefaultModel(models) {
	for (const preferred of PREFERRED_FAST_TEXT_MODELS) {
		if (models.some((model) => model.name === preferred)) return preferred;
	}
	return models[0]?.name || FALLBACK_TEXT_MODELS[0];
}

async function listAvailableModels({ forceRefresh = false } = {}) {
	const now = Date.now();
	if (!forceRefresh && modelCache.data && modelCache.expiresAt > now) {
		return modelCache.data;
	}

	if (!process.env.GEMINI_API_KEY) {
		const fallback = {
			models: FALLBACK_TEXT_MODELS.map((name) => ({ name, displayName: name })),
			defaultModel: FALLBACK_TEXT_MODELS[0],
			source: "fallback",
		};
		modelCache = { data: fallback, expiresAt: now + MODEL_CACHE_TTL_MS };
		return fallback;
	}

	try {
		const response = await fetch(
			`${GEMINI_MODELS_ENDPOINT}?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
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
			.filter((model) => isLikelyTextModel(model.name));

		const deduped = Array.from(
			new Map(models.map((model) => [model.name, model])).values(),
		).filter((model) => isCoreTextModel(model.name));

		const ordered = deduped.sort((a, b) => {
			const aName = a.name.toLowerCase();
			const bName = b.name.toLowerCase();
			const aIdx = CORE_TEXT_MODELS.findIndex(
				(core) => aName === core || aName.startsWith(`${core}-`),
			);
			const bIdx = CORE_TEXT_MODELS.findIndex(
				(core) => bName === core || bName.startsWith(`${core}-`),
			);
			const safeA = aIdx === -1 ? Number.MAX_SAFE_INTEGER : aIdx;
			const safeB = bIdx === -1 ? Number.MAX_SAFE_INTEGER : bIdx;
			return safeA - safeB || a.name.localeCompare(b.name);
		});

		const result = {
			models: ordered.length
				? ordered
				: FALLBACK_TEXT_MODELS.map((name) => ({ name, displayName: name })),
			defaultModel: pickDefaultModel(ordered),
			source: "api",
		};
		modelCache = { data: result, expiresAt: now + MODEL_CACHE_TTL_MS };
		return result;
	} catch (error) {
		const fallback = {
			models: FALLBACK_TEXT_MODELS.map((name) => ({ name, displayName: name })),
			defaultModel: FALLBACK_TEXT_MODELS[0],
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
