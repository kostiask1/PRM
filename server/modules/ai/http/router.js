const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const router = express.Router();
const storage = require("../../../storage");
const aiService = require("../../../aiService");
const { AiHistoryWriter, asText } = require("../../../ai/AiHistoryWriter");
const {
	EncounterLocalMonsterAiFlow,
} = require("../../../ai/EncounterLocalMonsterAiFlow");
const { CustomMonsterAiFlow } = require("../../../ai/CustomMonsterAiFlow");
const { CampaignAiFlow } = require("../../../ai/CampaignAiFlow");
const { assertAiGeneratedContentContract } = require("../domain/aiPayloadSchemas");
const { restoreAiResponseSnapshot } = require("../../../aiResponseHistoryService");
const {
	buildAiChangeSummary,
} = require("../../../ai/aiChangeSummary");
const {
	getGenerateRequestPath,
	isBestiaryImagePromptRequestPayload,
	prepareGenerateAiRequest,
} = require("../application/prepareGenerateAiRequest");
const {
	createGenerateBestiaryImagePrompt,
} = require("../application/generateBestiaryImagePrompt");
const {
	createGenerateCustomMonster,
} = require("../application/generateCustomMonster");
const {
	createGenerateCampaignContent,
} = require("../application/generateCampaignContent");
const {
	applyMentionsToGeneratedContent,
	collectMentionCandidates,
	processGeneratedTextMentions,
} = require("../application/mentionProcessing");
const {
	fillCurrentTargetIds,
} = require("../application/fillCurrentTargetIds");
const {
	createAppendConfiguredCampaignContext,
	filterSessionDataForAiContext,
} = require("../application/campaignContext");
const {
	createFileAiHistoryRepository,
} = require("../infrastructure/fileAiHistoryRepository");
const {
	createAiHistoryCommands,
} = require("../application/aiHistoryCommands");
const {
	createGenerateAiRequest,
} = require("../application/generateAiRequest");
const {
	createSaveGeminiApiKey,
} = require("../application/saveGeminiApiKey");
const {
	createEnvApiKeyStore,
} = require("../infrastructure/envApiKeyStore");
const { geminiGateway } = require("../infrastructure/geminiGateway");
const { buildImageParts } = require("../infrastructure/attachmentParts");

const ENV_PATH = path.join(__dirname, "..", "..", "..", "..", ".env");
const envApiKeyStore = createEnvApiKeyStore({
	filePath: ENV_PATH,
	fileSystem: fs,
	environment: process.env,
});
const aiHistoryWriter = new AiHistoryWriter();
const aiHistoryRepository = createFileAiHistoryRepository(storage);
const aiHistoryCommands = createAiHistoryCommands({
	repository: aiHistoryRepository,
	restoreSnapshot: restoreAiResponseSnapshot,
	buildChangeSummary: buildAiChangeSummary,
});
const encounterLocalMonsterAiFlow = new EncounterLocalMonsterAiFlow({
	historyWriter: aiHistoryWriter,
	buildAiChangeSummary,
});
const customMonsterAiFlow = new CustomMonsterAiFlow({
	historyWriter: aiHistoryWriter,
	buildAiChangeSummary,
});
const campaignAiFlow = new CampaignAiFlow({
	historyWriter: aiHistoryWriter,
});
const appendConfiguredCampaignContext =
	createAppendConfiguredCampaignContext({
		listEntities: (campaignSlug, type) =>
			storage.listEntities(campaignSlug, type),
		readSession: (campaignSlug, sessionSlug) =>
			storage.readSession(campaignSlug, sessionSlug),
	});
const generateBestiaryImagePrompt = createGenerateBestiaryImagePrompt({
	generateContent: (request) => aiService.generateContent(request),
	addAiResponse: (entry) => aiHistoryRepository.add(entry),
	historyWriter: aiHistoryWriter,
});
const generateCustomMonster = createGenerateCustomMonster({
	readCustomBestiary: () => storage.readCustomBestiary(),
	writeCustomBestiaryMonsters: (monsters) =>
		storage.writeCustomBestiaryMonsters(monsters),
	readCampaign: (slug) => storage.readCampaign(slug),
	readSession: (campaignSlug, sessionSlug) =>
		storage.readSession(campaignSlug, sessionSlug),
	appendCampaignContext: (...args) => appendConfiguredCampaignContext(...args),
	generateContent: (request) => aiService.generateContent(request),
	fillCurrentTargetIds,
	assertGeneratedContent: assertAiGeneratedContentContract,
	historyWriter: aiHistoryWriter,
	encounterLocalFlow: encounterLocalMonsterAiFlow,
	customMonsterFlow: customMonsterAiFlow,
});
const generateCampaignContent = createGenerateCampaignContent({
	readCampaign: (slug) => storage.readCampaign(slug),
	readSession: (campaignSlug, sessionSlug) =>
		storage.readSession(campaignSlug, sessionSlug),
	readCustomBestiary: () => storage.readCustomBestiary(),
	appendCampaignContext: (...args) => appendConfiguredCampaignContext(...args),
	filterSessionData: filterSessionDataForAiContext,
	generateContent: (request) => aiService.generateContent(request),
	fillCurrentTargetIds,
	collectMentionCandidates,
	applyMentionsToGeneratedContent,
	assertGeneratedContent: assertAiGeneratedContentContract,
	historyWriter: aiHistoryWriter,
	campaignFlow: campaignAiFlow,
});
const generateAiRequest = createGenerateAiRequest({
	prepareRequest: (input) =>
		prepareGenerateAiRequest({
			...input,
			readCampaign: (slug) => storage.readCampaign(slug),
		}),
	generateCustomMonster,
	generateBestiaryImagePrompt,
	generateCampaignContent,
	historyWriter: aiHistoryWriter,
	isApiKeyConfigured: () => Boolean(process.env.GEMINI_API_KEY),
	readSettings: () => storage.readSettings(),
});
const saveGeminiApiKey = createSaveGeminiApiKey({
	apiKeyStore: envApiKeyStore,
	clearModelCache: () => aiService.clearModelCache(),
});




function getAiHistoryCampaignSlug(req) {
	return String(req.query?.campaign || req.body?.campaign || "").trim();
}


async function handleAiHistoryRequest(req, res, next, handler) {
	try {
		const campaignSlug = getAiHistoryCampaignSlug(req);
		if (!campaignSlug) {
			return res.status(400).json({ error: "campaign is required." });
		}
		return res.json(await handler(campaignSlug));
	} catch (error) {
		if (error.status) {
			return res.status(error.status).json({ error: error.message });
		}
		next(error);
	}
}

router.get("/models", async (_req, res, next) => {
	try {
		const result = await aiService.listAvailableModels();
		res.json(result);
	} catch (error) {
		next(error);
	}
});

router.post("/generate-image", async (req, res, next) => {
	try {
		const { campaign, historyCampaign, modelName, prompt, attachedImages } = req.body || {};
		const text = String(prompt || "").trim();
		if (!text || text.length > 10000) return res.status(400).json({ error: "Image prompt must contain 1–10000 characters." });
		if (!process.env.GEMINI_API_KEY) return res.status(400).json({ error: "Gemini API key is required." });
		const available = await aiService.listAvailableModels();
		const model = available.imageModels?.find((item) => item.name === modelName);
		if (!model) return res.status(400).json({ error: "Select an available image model." });
		const slug = path.basename(String(campaign || "").trim());
		if (!slug || slug === ".") return res.status(400).json({ error: "Campaign is required." });
		const historySlug = path.basename(String(historyCampaign || slug).trim());
		if (!historySlug || historySlug === "." || historySlug === "..") return res.status(400).json({ error: "Invalid AI history scope." });
		const attachmentParts = await buildImageParts(Array.isArray(attachedImages) ? attachedImages : []);
		const result = await geminiGateway.generateImage({ modelName: model.name, prompt: text, attachmentParts });
		const imageBuffer = Buffer.from(result.data, "base64");
		if (!imageBuffer.length || imageBuffer.length > 20 * 1024 * 1024) throw new Error("Generated image is empty or too large.");
		const extension = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[result.mimeType];
		const fileName = `ai-${Date.now()}-${require("crypto").randomUUID()}.${extension}`;
		const category = "attachments";
		const directory = storage.campaignImagesDir(slug, category);
		await storage.ensureDir(directory);
		await fs.writeFile(path.join(directory, fileName), imageBuffer, { flag: "wx" });
		const imageUrl = `/api/images/${encodeURIComponent(slug)}/${category}/${encodeURIComponent(fileName)}`;
		const aiResponse = await aiHistoryRepository.add({ text: result.text || text, imageUrl, path: { campaign: historySlug }, type: "generated-image", modelName: model.name, userInstructions: text });
		res.json({ aiResponse, imageUrl });
	} catch (error) {
		next(error);
	}
});

router.get("/responses", (req, res, next) =>
	handleAiHistoryRequest(req, res, next, (campaignSlug) =>
		aiHistoryRepository.list(campaignSlug),
	),
);

router.get("/responses/stats", (req, res, next) =>
	handleAiHistoryRequest(req, res, next, (campaignSlug) =>
		aiHistoryRepository.stats(campaignSlug),
	),
);

router.delete("/responses/:id", (req, res, next) =>
	handleAiHistoryRequest(req, res, next, (campaignSlug) =>
		aiHistoryRepository.delete(campaignSlug, req.params.id),
	),
);

router.delete("/responses", (req, res, next) =>
	handleAiHistoryRequest(req, res, next, (campaignSlug) =>
		aiHistoryRepository.clear(campaignSlug),
	),
);

router.patch("/responses/:id", (req, res, next) =>
	handleAiHistoryRequest(req, res, next, (campaignSlug) =>
		aiHistoryCommands.patchDraft({
			campaignSlug,
			id: req.params.id,
			resources: req.body?.resources,
		}),
	),
);

router.post("/responses/:id/apply", (req, res, next) =>
	handleAiHistoryRequest(req, res, next, (campaignSlug) =>
		aiHistoryCommands.apply({
			campaignSlug,
			id: req.params.id,
			resourceIds: req.body?.resourceIds,
		}),
	),
);

router.post("/responses/:id/undo", (req, res, next) =>
	handleAiHistoryRequest(req, res, next, (campaignSlug) =>
		aiHistoryCommands.undo({
			campaignSlug,
			id: req.params.id,
			resourceIds: req.body?.resourceIds,
		}),
	),
);

router.post("/api-key", async (req, res, next) => {
	try {
		const result = await saveGeminiApiKey(req.body?.apiKey);
		return res.status(result.status).json(result.body);
	} catch (error) {
		next(error);
	}
});

router.post("/generate", async (req, res, next) => {
	try {
		const result = await generateAiRequest(req.body);
		return res.status(result.status).json(result.body);
	} catch (error) {
		next(error);
	}
});

Object.defineProperty(router, "__test", {
	value: {
		asText,
		fillCurrentTargetIds,
		getGenerateRequestPath,
		isBestiaryImagePromptRequestPayload,
		processGeneratedTextMentions,
	},
});

module.exports = router;
