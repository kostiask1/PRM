const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const router = express.Router();
const storage = require("../storage");
const aiService = require("../aiService");
const { AiHistoryWriter, asText } = require("../ai/AiHistoryWriter");
const {
	EncounterLocalMonsterAiFlow,
} = require("../ai/EncounterLocalMonsterAiFlow");
const { CustomMonsterAiFlow } = require("../ai/CustomMonsterAiFlow");
const { CampaignAiFlow } = require("../ai/CampaignAiFlow");
const { assertAiGeneratedContentContract } = require("../aiPayloadSchemas");
const { restoreAiResponseSnapshot } = require("../aiResponseHistoryService");
const {
	buildAiChangeSummary,
} = require("../ai/aiChangeSummary");
const {
	getCharacterDisplayName,
	getLocationDisplayName,
} = require("../ai/entityDisplayUtils");

const ENV_PATH = path.join(__dirname, "..", "..", ".env");
const aiHistoryWriter = new AiHistoryWriter();
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

function normalizeApiKey(value) {
	return String(value || "").trim();
}

function updateEnvValue(envText, key, value) {
	const line = `${key}=${value}`;
	const eol = envText.includes("\r\n") ? "\r\n" : "\n";
	const matcher = new RegExp(`^${key}=.*$`, "m");

	if (matcher.test(envText)) {
		return envText.replace(matcher, line);
	}

	const suffix = envText && !envText.endsWith("\n") ? eol : "";
	return `${envText}${suffix}${line}${eol}`;
}

function preserveExistingIds(before, after) {
	if (Array.isArray(before) && Array.isArray(after)) {
		return after.map((item, index) => preserveExistingIds(before[index], item));
	}
	if (
		before &&
		after &&
		typeof before === "object" &&
		typeof after === "object" &&
		!Array.isArray(before) &&
		!Array.isArray(after)
	) {
		const next = { ...after };
		if (Object.prototype.hasOwnProperty.call(before, "id")) {
			next.id = before.id;
		}
		for (const key of Object.keys(next)) {
			next[key] = preserveExistingIds(before[key], next[key]);
		}
		return next;
	}
	return after;
}

function patchDraftAiChanges(entry, rawResources) {
	if (entry?.applyState !== "draft") {
		const error = new Error("Only draft AI responses can be edited.");
		error.status = 400;
		throw error;
	}
	if (!Array.isArray(rawResources)) {
		const error = new Error("resources must be an array.");
		error.status = 400;
		throw error;
	}

	const afterById = new Map(
		rawResources
			.filter((resource) => resource && typeof resource === "object")
			.map((resource) => [String(resource.id || ""), resource.after ?? null]),
	);
	const resources = (entry.changes?.resources || []).map((resource) =>
		afterById.has(resource.id)
			? {
					...resource,
					after: preserveExistingIds(
						resource.before,
						afterById.get(resource.id),
					),
				}
			: resource,
	);
	return {
		...(entry.changes || {}),
		resources,
		summary: buildAiChangeSummary(resources),
	};
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

function isObject(value) {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function fillCurrentTargetIds(
	generatedContent,
	{ path, sceneId, customMonsterTarget },
) {
	if (!Array.isArray(generatedContent?.operations)) return generatedContent;
	for (const operation of generatedContent.operations) {
		if (!isObject(operation)) continue;
		const op = asText(operation.op);
		const entity = asText(operation.entity).toLowerCase();
		const needsExistingTarget = [
			"update",
			"delete",
			"updateNote",
			"deleteNote",
		].includes(op);
		if (!needsExistingTarget) continue;
		if (
			asText(operation.id) ||
			asText(operation.slug) ||
			asText(operation.name) ||
			asText(operation.targetClientId)
		) {
			continue;
		}

		if (["encounter", "encounters"].includes(entity) && path?.encounter) {
			operation.id = path.encounter;
		} else if (["scene", "scenes"].includes(entity) && sceneId) {
			operation.id = sceneId;
		} else if (
			["monster", "custom-monster", "custommonster"].includes(entity) &&
			customMonsterTarget
		) {
			if (asText(customMonsterTarget.id)) {
				operation.id = asText(customMonsterTarget.id);
			} else if (asText(customMonsterTarget.name)) {
				operation.name = asText(customMonsterTarget.name);
			}
		}
	}
	return generatedContent;
}

function escapeRegExp(value) {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCharacterContextKey(entity = {}) {
	return asText(entity.slug || entity.id || getCharacterDisplayName(entity));
}

function getLocationContextKey(entity = {}) {
	return asText(entity.slug || entity.id || getLocationDisplayName(entity));
}

function isContextListIncluded(contextConfig) {
	if (!contextConfig) return false;
	if (contextConfig === true) return true;
	if (typeof contextConfig !== "object") return Boolean(contextConfig);
	return contextConfig.included !== false;
}

function isAiIgnored(value = {}) {
	return Boolean(value?._aiIgnored);
}

function filterEntitiesByContext(entities = [], entityConfig, getKey) {
	const visibleEntities = entities.filter((entity) => !isAiIgnored(entity));
	if (!entityConfig) return [];
	if (entityConfig === true) return visibleEntities;
	if (entityConfig.included === false) return [];

	const items = entityConfig.items || {};
	const selectedKeys = Object.entries(items)
		.filter(([, included]) => included !== false)
		.map(([key]) => key);

	if (Object.keys(items).length === 0) return visibleEntities;

	const selected = new Set(selectedKeys);
	return visibleEntities.filter((entity) => selected.has(getKey(entity)));
}

function filterNotesForAiContext(notes = []) {
	return (Array.isArray(notes) ? notes : []).filter(
		(note) => !isAiIgnored(note),
	);
}

function filterSessionDataForAiContext(data = {}) {
	return {
		...data,
		notes: filterNotesForAiContext(data.notes),
		npcs: (Array.isArray(data.npcs) ? data.npcs : []).filter(
			(entity) => !isAiIgnored(entity),
		),
		locations: (Array.isArray(data.locations) ? data.locations : []).filter(
			(entity) => !isAiIgnored(entity),
		),
		scenes: (Array.isArray(data.scenes) ? data.scenes : []).map((scene) => ({
			...scene,
			notes: filterNotesForAiContext(scene.notes),
		})),
	};
}

function filterLocationsByContext(locations = [], locationConfig) {
	return filterEntitiesByContext(
		locations,
		locationConfig,
		getLocationContextKey,
	);
}

async function appendConfiguredCampaignContext(
	targetContext,
	campaignSlug,
	campaign,
	contextConfig,
) {
	if (!targetContext || !campaign || !contextConfig) return;
	if (contextConfig.campaignNotes) {
		targetContext.campaign.notes = filterNotesForAiContext(campaign.notes);
	}
	if (isContextListIncluded(contextConfig.campaignCharacters)) {
		const chars = await storage.listEntities(campaignSlug, "characters");
		targetContext.campaign.characters = filterEntitiesByContext(
			chars,
			contextConfig.campaignCharacters,
			getCharacterContextKey,
		);
	}
	if (
		isContextListIncluded(contextConfig.campaignNpcs) ||
		(contextConfig.campaignNpcs === undefined &&
			isContextListIncluded(contextConfig.campaignCharacters))
	) {
		const npcs = await storage.listEntities(campaignSlug, "npc");
		targetContext.campaign.npcs = filterEntitiesByContext(
			npcs,
			contextConfig.campaignNpcs === undefined
				? true
				: contextConfig.campaignNpcs,
			getCharacterContextKey,
		);
	}
	if (isContextListIncluded(contextConfig.campaignLocations)) {
		const locations = await storage.listEntities(campaignSlug, "locations");
		targetContext.campaign.locations = filterLocationsByContext(
			locations,
			contextConfig.campaignLocations,
		);
	}

	if (contextConfig.sessions) {
		for (const [slug, conf] of Object.entries(contextConfig.sessions)) {
			if (!conf.included) continue;
			const sData = await storage.readSession(campaignSlug, slug);
			targetContext.sessions.push({
				slug,
				fileName: slug,
				name: sData.name,
				conf,
				data: filterSessionDataForAiContext(sData.data),
			});
		}
	}
}

function buildGenerateContentRequestBase({
	type,
	userInstructions,
	modelName,
	attachedImages,
	contextData,
	entityScope,
	responseLanguage,
	simplifiedNotesEnabled,
	globalBasePrompt,
	imagePromptBasePrompt,
	campaignBasePrompt,
}) {
	return {
		type,
		userInstructions,
		modelName,
		attachedImages,
		contextData,
		generateCharacters: false,
		generateNpcs: false,
		generateLocations: false,
		generateEncounters: false,
		entityScope,
		language: responseLanguage,
		simplifiedNotes: simplifiedNotesEnabled,
		globalBasePrompt,
		imagePromptBasePrompt,
		campaignBasePrompt,
	};
}

async function sendFailedGeneratedContent(req, res, generatedContent, status = 500) {
	const aiResponse = await aiHistoryWriter.saveFailed(
		req.body,
		generatedContent,
		status,
	);
	return res.status(status).json({ ...generatedContent, aiResponse });
}

function normalizeMentionCandidates(names = []) {
	return Array.from(
		new Set(
			names.map((name) => asText(name)).filter((name) => name.length >= 2),
		),
	).sort((a, b) => b.length - a.length);
}

function wrapMentionsInText(text, names) {
	if (!text || !names.length) return text;
	let output = String(text);

	for (const name of names) {
		const pattern = new RegExp(
			`(?<![\\p{L}\\p{N}_\\[])${escapeRegExp(name)}(?![\\p{L}\\p{N}_\\]])`,
			"giu",
		);
		output = output.replace(pattern, (match, offset, source) => {
			const before = source[offset - 1];
			const after = source[offset + match.length];
			if (before === "[" && after === "]") return match;
			return `[${match}]`;
		});
	}

	return output;
}

function collapseNestedMentionBrackets(text) {
	if (typeof text !== "string" || !text) return text;
	let output = text;

	// Collapse repeated opening/closing mention brackets: [[Name]] -> [Name]
	for (let i = 0; i < 5; i += 1) {
		const next = output.replace(/\[\s*\[+/g, "[").replace(/\]+\s*\]/g, "]");
		if (next === output) break;
		output = next;
	}

	return output;
}

function normalizeNameForMatch(value) {
	return String(value || "")
		.toLowerCase()
		.replace(/[`'’]/g, "")
		.replace(/[^\p{L}\p{N}\s-]+/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function resolveCanonicalName(rawName, canonicalNames) {
	const raw = asText(rawName);
	if (!raw || !canonicalNames.length) return null;

	const exact = canonicalNames.find(
		(name) => normalizeNameForMatch(name) === normalizeNameForMatch(raw),
	);
	if (exact) return exact;

	return null;
}

function canonicalizeBracketedMentions(text, names) {
	if (!text || !names.length) return text;
	return String(text).replace(/\[([^[\]]+)\]/g, (full, rawName) => {
		const canonical = resolveCanonicalName(rawName, names);
		return canonical ? `[${canonical}]` : full;
	});
}

function processGeneratedTextMentions(text, names) {
	if (typeof text !== "string") return text;
	const wrapped = wrapMentionsInText(text, names);
	const canonicalized = canonicalizeBracketedMentions(wrapped, names);
	return collapseNestedMentionBrackets(canonicalized);
}

const AI_OPERATION_TEXT_KEYS = new Set([
	"description",
	"motivation",
	"trait",
	"summary",
	"goal",
	"stakes",
	"location",
	"text",
	"content",
]);

const AI_OPERATION_IDENTIFIER_KEYS = new Set([
	"id",
	"slug",
	"clientId",
	"targetClientId",
	"ownerClientId",
	"targetId",
	"noteId",
	"name",
	"title",
	"firstName",
	"first_name",
	"lastName",
	"last_name",
	"monsterName",
	"source",
	"type",
	"entity",
	"op",
	"scope",
	"from",
	"to",
	"targetScope",
]);

function processOperationTextMentions(value, names, key = "") {
	if (typeof value === "string") {
		if (AI_OPERATION_IDENTIFIER_KEYS.has(key)) return value;
		if (!AI_OPERATION_TEXT_KEYS.has(key)) return value;
		return processGeneratedTextMentions(value, names);
	}
	if (Array.isArray(value)) {
		return value.map((item) => processOperationTextMentions(item, names, key));
	}
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value).map(([entryKey, entryValue]) => [
			entryKey,
			processOperationTextMentions(entryValue, names, entryKey),
		]),
	);
}

function applyMentionsToGeneratedContent(generatedContent, names) {
	if (
		!generatedContent ||
		typeof generatedContent !== "object" ||
		!names.length
	) {
		return generatedContent;
	}

	if (Array.isArray(generatedContent.operations)) {
		generatedContent.operations = generatedContent.operations.map((operation) =>
			processOperationTextMentions(operation, names),
		);
	}
	return generatedContent;
}

function getAiHistoryCampaignSlug(req) {
	return String(req.query?.campaign || req.body?.campaign || "").trim();
}

function collectMentionCandidates(generatedContent, contextData = {}) {
	const names = [];
	const campaignContext = contextData?.campaign || {};
	const currentSessionData = contextData?.currentSession?.data || {};

	if (Array.isArray(campaignContext.characters)) {
		names.push(...campaignContext.characters.map(getCharacterDisplayName));
	}
	if (Array.isArray(campaignContext.npcs)) {
		names.push(...campaignContext.npcs.map(getCharacterDisplayName));
	}
	if (Array.isArray(campaignContext.locations)) {
		names.push(...campaignContext.locations.map(getLocationDisplayName));
	}
	if (Array.isArray(currentSessionData.npcs)) {
		names.push(...currentSessionData.npcs.map(getCharacterDisplayName));
	}
	if (Array.isArray(currentSessionData.locations)) {
		names.push(...currentSessionData.locations.map(getLocationDisplayName));
	}
	if (Array.isArray(currentSessionData.scenes)) {
		for (const scene of currentSessionData.scenes) {
			for (const npc of scene?.npcs || []) {
				names.push(asText(npc?.name));
			}
		}
	}

	for (const sessionContext of contextData?.sessions || []) {
		const conf = sessionContext?.conf || {};
		const data = sessionContext?.data || {};
		if (!conf.included) continue;

		if (Array.isArray(data.npcs)) {
			names.push(...data.npcs.map(getCharacterDisplayName));
		}
		if (Array.isArray(data.locations)) {
			names.push(...data.locations.map(getLocationDisplayName));
		}
		if (!Array.isArray(data.scenes)) continue;

		const hasSceneConfig =
			conf.scenes &&
			typeof conf.scenes === "object" &&
			Object.keys(conf.scenes).length > 0;

		for (const scene of data.scenes) {
			if (hasSceneConfig && !conf.scenes[scene.id]?.included) continue;
			for (const npc of scene?.npcs || []) {
				names.push(asText(npc?.name));
			}
		}
	}

	if (Array.isArray(generatedContent?.characters)) {
		for (const character of generatedContent.characters) {
			names.push(getCharacterDisplayName(character));
		}
	}

	if (Array.isArray(generatedContent?.npcs)) {
		for (const npc of generatedContent.npcs) {
			names.push(getCharacterDisplayName(npc));
		}
	}

	if (Array.isArray(generatedContent?.locations)) {
		for (const location of generatedContent.locations) {
			names.push(getLocationDisplayName(location));
		}
	}

	if (Array.isArray(generatedContent?.scenes)) {
		for (const scene of generatedContent.scenes) {
			for (const npc of scene?.npcs || []) {
				names.push(asText(npc?.name));
			}
		}
	}

	if (Array.isArray(generatedContent?.operations)) {
		for (const operation of generatedContent.operations) {
			const data =
				operation?.data && typeof operation.data === "object"
					? operation.data
					: operation?.patch && typeof operation.patch === "object"
						? operation.patch
						: null;
			if (!data) continue;
			const entity = asText(operation.entity).toLowerCase();
			if (["character", "characters", "npc", "npcs"].includes(entity)) {
				names.push(getCharacterDisplayName(data));
			} else if (
				["location", "locations", "faction", "factions"].includes(entity)
			) {
				names.push(getLocationDisplayName(data));
			} else if (entity === "scene" && Array.isArray(data.npcs)) {
				for (const npc of data.npcs) names.push(asText(npc?.name));
			}
		}
	}

	return normalizeMentionCandidates(names);
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

async function handleAiResponseEntryRequest(req, res, next, handler) {
	return handleAiHistoryRequest(req, res, next, async (campaignSlug) => {
		const entry = await storage.getAiResponse(campaignSlug, req.params.id);
		if (!entry) {
			const error = new Error("AI response not found.");
			error.status = 404;
			throw error;
		}
		return handler(entry, campaignSlug);
	});
}

router.get("/models", async (_req, res, next) => {
	try {
		const result = await aiService.listAvailableModels();
		res.json(result);
	} catch (error) {
		next(error);
	}
});

router.get("/responses", (req, res, next) =>
	handleAiHistoryRequest(req, res, next, (campaignSlug) =>
		storage.readAiResponses(campaignSlug),
	),
);

router.get("/responses/stats", (req, res, next) =>
	handleAiHistoryRequest(req, res, next, (campaignSlug) =>
		storage.getAiResponsesStorageStats(campaignSlug),
	),
);

router.delete("/responses/:id", (req, res, next) =>
	handleAiHistoryRequest(req, res, next, (campaignSlug) =>
		storage.deleteAiResponse(campaignSlug, req.params.id),
	),
);

router.delete("/responses", (req, res, next) =>
	handleAiHistoryRequest(req, res, next, (campaignSlug) =>
		storage.clearAiResponses(campaignSlug),
	),
);

router.patch("/responses/:id", (req, res, next) =>
	handleAiResponseEntryRequest(req, res, next, async (entry, campaignSlug) => {
		const changes = patchDraftAiChanges(entry, req.body?.resources);
		return storage.updateAiResponse(campaignSlug, entry.id, { changes });
	}),
);

router.post("/responses/:id/apply", (req, res, next) =>
	handleAiResponseEntryRequest(req, res, next, (entry) =>
		restoreAiResponseSnapshot(entry, "after", {
			resourceIds: req.body?.resourceIds,
		}),
	),
);

router.post("/responses/:id/undo", (req, res, next) =>
	handleAiResponseEntryRequest(req, res, next, (entry) =>
		restoreAiResponseSnapshot(entry, "before", {
			resourceIds: req.body?.resourceIds,
		}),
	),
);

router.post("/api-key", async (req, res, next) => {
	try {
		const apiKey = normalizeApiKey(req.body?.apiKey);
		if (!apiKey) {
			return res.status(400).json({ error: "GEMINI_API_KEY cannot be empty." });
		}
		if (/[\r\n]/.test(apiKey)) {
			return res
				.status(400)
				.json({ error: "GEMINI_API_KEY must be a single line." });
		}

		let envText = "";
		try {
			envText = await fs.readFile(ENV_PATH, "utf8");
		} catch (error) {
			if (error.code !== "ENOENT") {
				throw error;
			}
		}

		await fs.writeFile(
			ENV_PATH,
			updateEnvValue(envText, "GEMINI_API_KEY", apiKey),
			"utf8",
		);
		process.env.GEMINI_API_KEY = apiKey;
		aiService.clearModelCache();
		res.json({ ok: true });
	} catch (error) {
		next(error);
	}
});

router.post("/generate", async (req, res, next) => {
	try {
		const {
			type,
			modelName,
			userInstructions,
			path,
			sceneId,
			imageTarget,
			attachedImages,
			imagePromptBasePromptOverride,
			customMonsterTarget,
			customMonsterMode,
			parseAIResponse,
			generateCharacters,
			generateNpcs,
			generateLocations,
			generateEncounters,
			generateCustomMonsters,
			contextConfig,
			language,
		} = req.body;
		const responseLanguage = String(language || "")
			.trim()
			.toLowerCase();
		const historyUserInstructions = aiHistoryWriter.getUserInstructions(
			req.body,
		);
		if (!responseLanguage) {
			return res.status(400).json({ error: "language is required." });
		}
		if (!process.env.GEMINI_API_KEY) {
			return res
				.status(500)
				.json({ error: "GEMINI_API_KEY is not configured." });
		}
		const requestedEncounterGeneration = Boolean(generateEncounters);
		const shouldParseAIResponse =
			type !== "image" &&
			Boolean(parseAIResponse) &&
			(!path?.encounter || requestedEncounterGeneration);
		const encounterGenerationEnabled =
			shouldParseAIResponse && requestedEncounterGeneration;
		const customMonsterGenerationEnabled =
			encounterGenerationEnabled && Boolean(generateCustomMonsters);
		const characterGenerationEnabled = shouldParseAIResponse
			? generateCharacters !== false
			: true;
		const npcGenerationEnabled = shouldParseAIResponse
			? generateNpcs !== false
			: true;
		const locationGenerationEnabled = shouldParseAIResponse
			? generateLocations !== false
			: true;
		const entityTargetScope =
			shouldParseAIResponse && path?.session && !path?.encounter
				? "mixed"
				: "campaign";
		const settings = await storage.readSettings();
		const simplifiedNotesEnabled = Boolean(settings.simplifiedNotes);
		const autoApplyAiChanges = settings.autoApplyAiChanges !== false;
		const globalBasePrompt = asText(settings.aiBasePrompt);
		const imagePromptBasePrompt =
			type === "image" &&
			Object.prototype.hasOwnProperty.call(
				req.body || {},
				"imagePromptBasePromptOverride",
			)
				? asText(imagePromptBasePromptOverride)
				: getCampaignImagePromptBasePrompt(settings, path?.campaign) ||
					asText(settings.imagePromptBasePrompt);
		const campaignBasePrompt = getCampaignBasePrompt(settings, path?.campaign);

		if (type === "custom-monster") {
			let customBestiary = await storage.readCustomBestiary();
			if (
				Array.isArray(customBestiary.monster) &&
				customBestiary.monster.some((monster) => !asText(monster?.id))
			) {
				const normalizedMonsters = await storage.writeCustomBestiaryMonsters(
					customBestiary.monster,
				);
				customBestiary = { ...customBestiary, monster: normalizedMonsters };
			}
			const beforeCustomMonsters = Array.isArray(customBestiary.monster)
				? customBestiary.monster
				: [];
			const customContextData = {
				campaign: {},
				sessions: [],
				customBestiary: {
					monsters: Array.isArray(customBestiary.monster)
						? customBestiary.monster.map((monster) => ({
								id: monster.id,
								name: monster.name,
								source: monster.source,
								type: monster.type,
								cr: monster.cr,
							}))
						: [],
				},
			};
			if (customMonsterTarget && typeof customMonsterTarget === "object") {
				const targetId = asText(customMonsterTarget.id);
				const targetName = asText(customMonsterTarget.name).toLowerCase();
				const fullTarget = Array.isArray(customBestiary.monster)
					? customBestiary.monster.find(
							(monster) =>
								(targetId && asText(monster?.id) === targetId) ||
								asText(monster?.name).toLowerCase() === targetName,
						)
					: null;
				customContextData.customBestiary.selectedMonster =
					fullTarget || customMonsterTarget;
				customContextData.customBestiary.selectedMonsterMode =
					customMonsterMode === "create-based" ? "create-based" : "edit";
			}
			let customCampaign = null;
			let customSession = null;
			if (path?.campaign && path.campaign !== "bestiary") {
				customCampaign = await storage
					.readCampaign(path.campaign)
					.catch(() => null);
				customSession = await storage
					.readSession(path.campaign, path.session)
					.catch(() => null);

				await appendConfiguredCampaignContext(
					customContextData,
					path.campaign,
					customCampaign,
					contextConfig,
				);
			}

			const generatedContent = await aiService.generateContent({
				...buildGenerateContentRequestBase({
					type: "custom-monster",
					userInstructions,
					modelName,
					attachedImages,
					contextData: customContextData,
					entityScope: "custom-bestiary",
					responseLanguage,
					simplifiedNotesEnabled,
					globalBasePrompt,
					imagePromptBasePrompt,
					campaignBasePrompt,
				}),
				session: customSession,
				campaign: customCampaign,
				encounterId: path?.encounter,
				parseAIResponse: true,
			});

			if (generatedContent.error) {
				return sendFailedGeneratedContent(req, res, generatedContent);
			}

			fillCurrentTargetIds(generatedContent, {
				path: { campaign: "bestiary" },
				sceneId: null,
				customMonsterTarget,
			});

			assertAiGeneratedContentContract(generatedContent, {
				type: "custom-monster",
				requireOperations: true,
			});

			if (encounterLocalMonsterAiFlow.isEnabled(req.body)) {
				const result = await encounterLocalMonsterAiFlow.createDraft({
					payload: req.body,
					generatedContent,
					customMonsterTarget,
					customSession,
					modelName,
					responseLanguage,
					historyUserInstructions,
					customContextData,
					globalBasePrompt,
					imagePromptBasePrompt,
					campaignBasePrompt,
				});
				return res.status(result.status).json(result.body);
			}

			const result = await customMonsterAiFlow.createDraft({
				payload: req.body,
				generatedContent,
				beforeCustomMonsters,
				modelName,
				responseLanguage,
				historyUserInstructions,
				customContextData,
				simplifiedNotesEnabled,
				globalBasePrompt,
				imagePromptBasePrompt,
				campaignBasePrompt,
			});
			return res.status(result.status).json(result.body);
		}

		if (type === "image" && path?.campaign === "bestiary") {
			const generatedContent = await aiService.generateContent({
				...buildGenerateContentRequestBase({
					type: "image",
					userInstructions,
					modelName,
					attachedImages,
					contextData: {},
					entityScope: "custom-bestiary",
					responseLanguage,
					simplifiedNotesEnabled,
					globalBasePrompt,
					imagePromptBasePrompt,
					campaignBasePrompt,
				}),
				session: null,
				campaign: null,
				sceneId,
				imageTarget,
				parseAIResponse: false,
			});

			if (generatedContent.error) {
				return sendFailedGeneratedContent(req, res, generatedContent);
			}

			const aiResponse = await storage.addAiResponse({
				text: generatedContent,
				path: { campaign: "bestiary" },
				type: "image",
				modelName,
				language: responseLanguage,
				userInstructions: historyUserInstructions,
				request: aiHistoryWriter.buildRequestSnapshot({
					type,
					modelName,
					userInstructions: historyUserInstructions,
					path: { campaign: "bestiary" },
					sceneId,
					imageTarget,
					parseAIResponse: false,
					shouldParseAIResponse: false,
					generateCharacters: false,
					generateNpcs: false,
					generateLocations: false,
					generateEncounters: false,
					generateCustomMonsters: false,
					entityScope: "custom-bestiary",
					contextConfig: null,
					contextData: {},
					language: responseLanguage,
					globalBasePrompt,
					imagePromptBasePrompt,
					campaignBasePrompt,
				}),
				retryPayload: aiHistoryWriter.cloneRetryPayload(req.body),
			});
			return res.json({ prompt: generatedContent, aiResponse });
		}

		const campaign = await storage.readCampaign(path.campaign);
		const session = await storage
			.readSession(path.campaign, path.session)
			.catch(() => null);

		const contextData = { campaign: {}, sessions: [] };
		await appendConfiguredCampaignContext(
			contextData,
			path.campaign,
			campaign,
			contextConfig,
		);
		if (entityTargetScope === "mixed" && session) {
			contextData.currentSession = {
				slug: path.session,
				fileName: path.session,
				name: session.name,
				data: filterSessionDataForAiContext(session.data),
			};
		}
		if (path?.encounter || encounterGenerationEnabled) {
			const customBestiary = await storage.readCustomBestiary();
			const monsterNames = (
				Array.isArray(customBestiary.monster) ? customBestiary.monster : []
			)
				.map((monster) => asText(monster?.name))
				.filter(Boolean);
			if (monsterNames.length > 0) {
				contextData.customBestiary = { monsterNames };
			}
		}

		const generatedContent = await aiService.generateContent({
			type,
			session,
			campaign,
			userInstructions,
			modelName,
			encounterId: path.encounter,
			sceneId,
			imageTarget,
			attachedImages,
			parseAIResponse: shouldParseAIResponse,
			contextData,
			generateCharacters: characterGenerationEnabled,
			generateNpcs: npcGenerationEnabled,
			generateLocations: locationGenerationEnabled,
			generateEncounters: encounterGenerationEnabled,
			generateCustomMonsters: customMonsterGenerationEnabled,
			entityScope: entityTargetScope,
			language: responseLanguage,
			simplifiedNotes: simplifiedNotesEnabled,
			globalBasePrompt,
			imagePromptBasePrompt,
			campaignBasePrompt,
		});

		if (shouldParseAIResponse) {
			fillCurrentTargetIds(generatedContent, {
				path,
				sceneId,
				customMonsterTarget: null,
			});
		}

		if (
			shouldParseAIResponse &&
			generatedContent &&
			typeof generatedContent === "object"
		) {
			const mentionNames = collectMentionCandidates(
				generatedContent,
				contextData,
			);
			applyMentionsToGeneratedContent(generatedContent, mentionNames);
		}

		if (generatedContent.error) {
			const aiResponse = await aiHistoryWriter.saveFailed(
				req.body,
				generatedContent,
				500,
			);
			return res.status(500).json({ ...generatedContent, aiResponse });
		}

		if (shouldParseAIResponse) {
			assertAiGeneratedContentContract(generatedContent, {
				type,
				requireExplicitEntityScope: entityTargetScope === "mixed",
			});
		}

		const result = await campaignAiFlow.persistGeneratedContent({
			payload: req.body,
			generatedContent,
			session,
			path,
			type,
			modelName,
			responseLanguage,
			historyUserInstructions,
			sceneId,
			imageTarget,
			parseAIResponse,
			shouldParseAIResponse,
			characterGenerationEnabled,
			npcGenerationEnabled,
			locationGenerationEnabled,
			encounterGenerationEnabled,
			customMonsterGenerationEnabled,
			entityTargetScope,
			contextConfig,
			contextData,
			simplifiedNotesEnabled,
			autoApplyAiChanges,
			globalBasePrompt,
			imagePromptBasePrompt,
			campaignBasePrompt,
		});
		res.status(result.status).json(result.body);
	} catch (error) {
		if (req.path === "/generate") {
			try {
				const aiResponse = await aiHistoryWriter.saveFailed(
					req.body,
					error,
					error.status || 500,
				);
				if (aiResponse) {
					return res.status(error.status || 500).json({
						error: error.message || "AI request failed.",
						aiResponse,
					});
				}
			} catch (historyError) {
				console.error("Failed to save failed AI request", historyError);
			}
		}
		next(error);
	}
});

Object.defineProperty(router, "__test", {
	value: {
		asText,
		fillCurrentTargetIds,
		processGeneratedTextMentions,
	},
});

module.exports = router;
