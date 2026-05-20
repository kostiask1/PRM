const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const router = express.Router();
const storage = require("../storage");
const aiService = require("../aiService");
const {
	buildAiRequestSnapshot,
	formatGeneratedContentForHistory,
} = require("../aiHistoryService");
const {
	assertAiGeneratedContentContract,
} = require("../aiPayloadSchemas");
const {
	restoreAiResponseSnapshot,
	saveDraftParsedAiResponse,
	saveParsedAiResponse,
} = require("../aiResponseHistoryService");
const { applyAiOperations } = require("../aiPatchService");

const ENV_PATH = path.join(__dirname, "..", "..", ".env");

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

function asText(value) {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value.trim();
	if (
		typeof value === "number" ||
		typeof value === "bigint" ||
		typeof value === "boolean"
	) {
		return String(value).trim();
	}
	return "";
}

function buildAiChangeSummary(resources = []) {
	return resources.reduce(
		(summary, resource) => {
			if (resource.before === null && resource.after !== null) {
				summary.added += 1;
			} else if (resource.before !== null && resource.after === null) {
				summary.deleted += 1;
			} else {
				summary.modified += 1;
			}
			summary.total += 1;
			return summary;
		},
		{ added: 0, deleted: 0, modified: 0, total: 0 },
	);
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
					after: preserveExistingIds(resource.before, afterById.get(resource.id)),
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

function cloneRetryPayload(payload = {}) {
	return JSON.parse(JSON.stringify(payload || {}));
}

function getFailedAiResponseText(error, status = null) {
	const message = asText(error?.message || error?.error) || "AI request failed.";
	return [
		"AI request failed",
		"",
		status ? `Status: ${status}` : null,
		message,
	].filter(Boolean).join("\n");
}

async function saveFailedAiRequest(payload = {}, error, status = null) {
	const path = payload?.path && typeof payload.path === "object" ? payload.path : {};
	const campaignSlug = asText(path.campaign);
	if (!campaignSlug) return null;

	const shouldParseAIResponse =
		payload.type !== "image" &&
		Boolean(payload.parseAIResponse || payload.generateEncounters) &&
		(!path.encounter || payload.generateEncounters);
	const requestSnapshot = buildAiRequestSnapshot({
		type: payload.type,
		modelName: payload.modelName,
		userInstructions: payload.userInstructions,
		path,
		sceneId: payload.sceneId,
		imageTarget: payload.imageTarget,
		parseAIResponse: payload.parseAIResponse,
		shouldParseAIResponse,
		generateCharacters: payload.generateCharacters !== false,
		generateNpcs: payload.generateNpcs !== false,
		generateLocations: payload.generateLocations !== false,
		generateEncounters: Boolean(payload.generateEncounters),
		generateCustomMonsters: Boolean(payload.generateCustomMonsters),
		entityScope: payload.entityScope,
		contextConfig: payload.contextConfig,
		contextData: {},
		language: payload.language,
	});

	return storage.addAiResponse({
		text: getFailedAiResponseText(error, status),
		path,
		type: payload.type || null,
		modelName: payload.modelName || null,
		language: payload.language || null,
		userInstructions: payload.userInstructions || "",
		request: requestSnapshot,
		status: "failed",
		error: {
			message: asText(error?.message || error?.error) || "AI request failed.",
			status,
		},
		retryPayload: cloneRetryPayload(payload),
	});
}

function shouldUseCampaignEntityScope(userInstructions) {
	const text = asText(userInstructions).toLowerCase();
	if (!text) return false;
	if (
		[
			"не в кампан",
			"не у кампан",
			"не до кампан",
			"not campaign",
			"session only",
			"only session",
		].some((hint) => text.includes(hint))
	) {
		return false;
	}
	return [
		"в кампан",
		"у кампан",
		"до кампан",
		"для кампан",
		"глобальн",
		"campaign scope",
		"campaign-wide",
		"to campaign",
		"in campaign",
		"global",
	].some((hint) => text.includes(hint));
}

function escapeRegExp(value) {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCharacterDisplayName(entity = {}) {
	const firstName = asText(entity.firstName || entity.first_name);
	const lastName = asText(entity.lastName || entity.last_name);
	const combined = `${firstName} ${lastName}`.trim();
	if (combined) return combined;
	return asText(entity.name || entity.title);
}

function getCharacterContextKey(entity = {}) {
	return asText(entity.slug || entity.id || getCharacterDisplayName(entity));
}

function getLocationDisplayName(entity = {}) {
	return asText(entity.name || entity.title);
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
	return (Array.isArray(notes) ? notes : []).filter((note) => !isAiIgnored(note));
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
	return String(req.query?.campaign || req.body?.campaign || "")
		.trim();
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

router.get("/models", async (_req, res, next) => {
	try {
		const result = await aiService.listAvailableModels();
		res.json(result);
	} catch (error) {
		next(error);
	}
});

router.get("/responses", async (req, res, next) => {
	try {
		const campaignSlug = getAiHistoryCampaignSlug(req);
		if (!campaignSlug) {
			return res.status(400).json({ error: "campaign is required." });
		}
		res.json(await storage.readAiResponses(campaignSlug));
	} catch (error) {
		next(error);
	}
});

router.delete("/responses/:id", async (req, res, next) => {
	try {
		const campaignSlug = getAiHistoryCampaignSlug(req);
		if (!campaignSlug) {
			return res.status(400).json({ error: "campaign is required." });
		}
		res.json(await storage.deleteAiResponse(campaignSlug, req.params.id));
	} catch (error) {
		next(error);
	}
});

router.delete("/responses", async (req, res, next) => {
	try {
		const campaignSlug = getAiHistoryCampaignSlug(req);
		if (!campaignSlug) {
			return res.status(400).json({ error: "campaign is required." });
		}
		res.json(await storage.clearAiResponses(campaignSlug));
	} catch (error) {
		next(error);
	}
});

router.patch("/responses/:id", async (req, res, next) => {
	try {
		const campaignSlug = getAiHistoryCampaignSlug(req);
		if (!campaignSlug) {
			return res.status(400).json({ error: "campaign is required." });
		}
		const entry = await storage.getAiResponse(campaignSlug, req.params.id);
		if (!entry) {
			return res.status(404).json({ error: "AI response not found." });
		}
		const changes = patchDraftAiChanges(entry, req.body?.resources);
		res.json(
			await storage.updateAiResponse(campaignSlug, entry.id, {
				changes,
			}),
		);
	} catch (error) {
		if (error.status) {
			return res.status(error.status).json({ error: error.message });
		}
		next(error);
	}
});

router.post("/responses/:id/apply", async (req, res, next) => {
	try {
		const campaignSlug = getAiHistoryCampaignSlug(req);
		if (!campaignSlug) {
			return res.status(400).json({ error: "campaign is required." });
		}
		const entry = await storage.getAiResponse(campaignSlug, req.params.id);
		if (!entry) {
			return res.status(404).json({ error: "AI response not found." });
		}
		res.json(
			await restoreAiResponseSnapshot(entry, "after", {
				resourceIds: req.body?.resourceIds,
			}),
		);
	} catch (error) {
		if (error.status) {
			return res.status(error.status).json({ error: error.message });
		}
		next(error);
	}
});

router.post("/responses/:id/undo", async (req, res, next) => {
	try {
		const campaignSlug = getAiHistoryCampaignSlug(req);
		if (!campaignSlug) {
			return res.status(400).json({ error: "campaign is required." });
		}
		const entry = await storage.getAiResponse(campaignSlug, req.params.id);
		if (!entry) {
			return res.status(404).json({ error: "AI response not found." });
		}
		res.json(await restoreAiResponseSnapshot(entry, "before"));
	} catch (error) {
		if (error.status) {
			return res.status(error.status).json({ error: error.message });
		}
		next(error);
	}
});

router.post("/api-key", async (req, res, next) => {
	try {
		const apiKey = normalizeApiKey(req.body?.apiKey);
		if (!apiKey) {
			return res.status(400).json({ error: "GEMINI_API_KEY не може бути порожнім." });
		}
		if (/[\r\n]/.test(apiKey)) {
			return res.status(400).json({ error: "GEMINI_API_KEY має бути одним рядком." });
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
			customMonsterTarget,
			parseAIResponse,
			generateCharacters,
			generateNpcs,
			generateLocations,
			generateEncounters,
			generateCustomMonsters,
			entityScope,
			contextConfig,
			language,
		} = req.body;
		const responseLanguage = String(language || "")
			.trim()
			.toLowerCase();
		if (!responseLanguage) {
			return res.status(400).json({ error: "language is required." });
		}
		if (!process.env.GEMINI_API_KEY) {
			return res.status(500).json({ error: "GEMINI_API_KEY не налаштовано." });
		}
		const encounterGenerationEnabled = Boolean(generateEncounters);
		const customMonsterGenerationEnabled =
			encounterGenerationEnabled && Boolean(generateCustomMonsters);
		const characterGenerationEnabled = generateCharacters !== false;
		const npcGenerationEnabled = generateNpcs !== false;
		const locationGenerationEnabled = generateLocations !== false;
		const entityTargetScope =
			path?.session &&
			!path?.encounter &&
			entityScope !== "campaign" &&
			!shouldUseCampaignEntityScope(userInstructions)
				? "session"
				: "campaign";
		const shouldParseAIResponse =
			type !== "image" &&
			Boolean(parseAIResponse || encounterGenerationEnabled) &&
			(!path?.encounter || encounterGenerationEnabled);
		const settings = await storage.readSettings();
		const simplifiedNotesEnabled = Boolean(settings.simplifiedNotes);
		const autoApplyAiChanges = settings.autoApplyAiChanges !== false;
		const globalBasePrompt = asText(settings.aiBasePrompt);
		const campaignBasePrompt = getCampaignBasePrompt(settings, path?.campaign);

		if (type === "custom-monster") {
			const customBestiary = await storage.readCustomBestiary();
			const beforeCustomMonsters = Array.isArray(customBestiary.monster)
				? customBestiary.monster
				: [];
			const customContextData = {
				campaign: {},
				sessions: [],
				customBestiary: {
					monsters: Array.isArray(customBestiary.monster)
						? customBestiary.monster.map((monster) => ({
								name: monster.name,
								source: monster.source,
								type: monster.type,
								cr: monster.cr,
							}))
						: [],
				},
			};
			if (customMonsterTarget && typeof customMonsterTarget === "object") {
				const targetName = asText(customMonsterTarget.name).toLowerCase();
				const fullTarget = Array.isArray(customBestiary.monster)
					? customBestiary.monster.find(
							(monster) =>
								asText(monster?.name).toLowerCase() === targetName,
						)
					: null;
				customContextData.customBestiary.selectedMonster =
					fullTarget || customMonsterTarget;
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

				if (customCampaign && contextConfig) {
					if (contextConfig.campaignNotes) {
						customContextData.campaign.notes = filterNotesForAiContext(
							customCampaign.notes,
						);
					}
					if (isContextListIncluded(contextConfig.campaignCharacters)) {
						const chars = await storage.listEntities(
							path.campaign,
							"characters",
						);
						customContextData.campaign.characters = filterEntitiesByContext(
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
						const npcs = await storage.listEntities(path.campaign, "npc");
						customContextData.campaign.npcs = filterEntitiesByContext(
							npcs,
							contextConfig.campaignNpcs === undefined
								? true
								: contextConfig.campaignNpcs,
							getCharacterContextKey,
						);
					}
					if (isContextListIncluded(contextConfig.campaignLocations)) {
						const locations = await storage.listEntities(
							path.campaign,
							"locations",
						);
						customContextData.campaign.locations = filterLocationsByContext(
							locations,
							contextConfig.campaignLocations,
						);
					}

					if (contextConfig.sessions) {
						for (const [slug, conf] of Object.entries(contextConfig.sessions)) {
							if (!conf.included) continue;
							const sData = await storage.readSession(path.campaign, slug);
							customContextData.sessions.push({
								slug,
								fileName: slug,
								name: sData.name,
								conf,
								data: filterSessionDataForAiContext(sData.data),
							});
						}
					}
				}
			}

			const generatedContent = await aiService.generateContent({
				type: "custom-monster",
				session: customSession,
				campaign: customCampaign,
				userInstructions,
				modelName,
				encounterId: path?.encounter,
				parseAIResponse: true,
				contextData: customContextData,
				generateCharacters: false,
				generateNpcs: false,
				generateLocations: false,
				generateEncounters: false,
				entityScope: "custom-bestiary",
				language: responseLanguage,
				simplifiedNotes: simplifiedNotesEnabled,
				globalBasePrompt,
				campaignBasePrompt,
			});

			if (generatedContent.error) {
				const aiResponse = await saveFailedAiRequest(req.body, generatedContent, 500);
				return res.status(500).json({ ...generatedContent, aiResponse });
			}

			assertAiGeneratedContentContract(generatedContent, {
				type: "custom-monster",
				requireOperations: true,
			});

			const applied = await applyAiOperations({
				payload: generatedContent,
				campaignSlug: "bestiary",
				sessionFile: null,
				entityScope: "custom-bestiary",
				simplifiedNotes: simplifiedNotesEnabled,
				permissions: {
					allowCharacters: false,
					allowNpcs: false,
					allowLocations: false,
					allowEncounters: false,
				},
			});

			if (!applied.customBestiaryChange?.hasChanges) {
				const aiResponse = await saveFailedAiRequest(
					req.body,
					{ message: "AI did not return any valid creature." },
					400,
				);
				return res.status(400).json({
					error: "AI не повернув жодної коректної істоти.",
					generated: generatedContent,
					aiResponse,
				});
			}

			const monsters = applied.customBestiaryChange?.after || [];
			const customBestiaryChangeResource = {
				id: "custom-bestiary",
				kind: "custom-bestiary",
				campaign: "bestiary",
				label: "data/custom-bestiary.json",
				before: beforeCustomMonsters,
				after: monsters,
			};
			const aiResponsePayload = {
				text: formatGeneratedContentForHistory(generatedContent),
				path: { campaign: "bestiary" },
				type: "custom-monster",
				modelName,
				language: responseLanguage,
				userInstructions,
				request: buildAiRequestSnapshot({
					type,
					modelName,
					userInstructions,
					path: { campaign: "bestiary" },
					parseAIResponse: true,
					shouldParseAIResponse: true,
					generateCharacters: false,
					generateNpcs: false,
					generateLocations: false,
					generateEncounters: false,
					generateCustomMonsters: false,
					entityScope: "custom-bestiary",
					contextConfig: null,
					contextData: customContextData,
					language: responseLanguage,
					globalBasePrompt,
					campaignBasePrompt,
				}),
				retryPayload: cloneRetryPayload(req.body),
				changes: {
					resources: [customBestiaryChangeResource],
					summary: buildAiChangeSummary([customBestiaryChangeResource]),
				},
			};
			if (!autoApplyAiChanges) {
				const aiResponse = await storage.addAiResponse({
					...aiResponsePayload,
					applyState: "draft",
				});
				await storage.writeCustomBestiaryMonsters(beforeCustomMonsters);
				return res.json({
					generated: {
						...generatedContent,
						monsters: applied.changedMonsters,
					},
					draft: true,
					aiResponse,
				});
			}
			const aiResponse = await storage.addAiResponse({
				...aiResponsePayload,
				applyState: "applied",
				appliedAt: new Date().toISOString(),
			});
			return res.json({
				generated: {
					...generatedContent,
					monsters: applied.changedMonsters,
				},
				updated: { monsters },
				aiResponse,
			});
		}

		if (type === "image" && path?.campaign === "bestiary") {
			const generatedContent = await aiService.generateContent({
				type: "image",
				session: null,
				campaign: null,
				userInstructions,
				modelName,
				sceneId,
				imageTarget,
				parseAIResponse: false,
				contextData: {},
				generateCharacters: false,
				generateNpcs: false,
				generateLocations: false,
				generateEncounters: false,
				entityScope: "custom-bestiary",
				language: responseLanguage,
				simplifiedNotes: simplifiedNotesEnabled,
				globalBasePrompt,
				campaignBasePrompt,
			});

			if (generatedContent.error) {
				const aiResponse = await saveFailedAiRequest(req.body, generatedContent, 500);
				return res.status(500).json({ ...generatedContent, aiResponse });
			}

			const aiResponse = await storage.addAiResponse({
				text: generatedContent,
				path: { campaign: "bestiary" },
				type: "image",
				modelName,
				language: responseLanguage,
				userInstructions,
				request: buildAiRequestSnapshot({
					type,
					modelName,
					userInstructions,
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
					campaignBasePrompt,
				}),
				retryPayload: cloneRetryPayload(req.body),
			});
			return res.json({ prompt: generatedContent, aiResponse });
		}

		const campaign = await storage.readCampaign(path.campaign);
		const session = await storage
			.readSession(path.campaign, path.session)
			.catch(() => null);

		const contextData = { campaign: {}, sessions: [] };
		const includeCampaignScopedEntities = entityTargetScope !== "session";
		if (contextConfig) {
			if (contextConfig.campaignNotes)
				contextData.campaign.notes = filterNotesForAiContext(campaign.notes);
			if (isContextListIncluded(contextConfig.campaignCharacters)) {
				const chars = await storage.listEntities(path.campaign, "characters");
				contextData.campaign.characters = filterEntitiesByContext(
					chars,
					contextConfig.campaignCharacters,
					getCharacterContextKey,
				);
			}
			if (
				includeCampaignScopedEntities &&
				(isContextListIncluded(contextConfig.campaignNpcs) ||
					(contextConfig.campaignNpcs === undefined &&
						isContextListIncluded(contextConfig.campaignCharacters)))
			) {
				const npcs = await storage.listEntities(path.campaign, "npc");
				contextData.campaign.npcs = filterEntitiesByContext(
					npcs,
					contextConfig.campaignNpcs === undefined
						? true
						: contextConfig.campaignNpcs,
					getCharacterContextKey,
				);
			}
			if (
				includeCampaignScopedEntities &&
				isContextListIncluded(contextConfig.campaignLocations)
			) {
				const locations = await storage.listEntities(path.campaign, "locations");
				contextData.campaign.locations = filterLocationsByContext(
					locations,
					contextConfig.campaignLocations,
				);
			}

			if (contextConfig.sessions) {
				for (const [slug, conf] of Object.entries(contextConfig.sessions)) {
					if (!conf.included) continue;
					const sData = await storage.readSession(path.campaign, slug);
					contextData.sessions.push({
						slug,
						fileName: slug,
						name: sData.name,
						conf,
						data: filterSessionDataForAiContext(sData.data),
					});
				}
			}
		}
		if (entityTargetScope === "session" && session) {
			contextData.currentSession = {
				slug: path.session,
				fileName: path.session,
				name: session.name,
				data: filterSessionDataForAiContext(session.data),
			};
		}
		if (path?.encounter || encounterGenerationEnabled) {
			const customBestiary = await storage.readCustomBestiary();
			const monsterNames = (Array.isArray(customBestiary.monster)
				? customBestiary.monster
				: [])
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
			campaignBasePrompt,
		});

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
			const aiResponse = await saveFailedAiRequest(req.body, generatedContent, 500);
			return res.status(500).json({ ...generatedContent, aiResponse });
		}

		if (shouldParseAIResponse) {
			assertAiGeneratedContentContract(generatedContent, { type });
		}

		const requestSnapshot = buildAiRequestSnapshot({
			type,
			modelName,
			userInstructions,
			path,
			sceneId,
			imageTarget,
			parseAIResponse,
			shouldParseAIResponse,
			generateCharacters: characterGenerationEnabled,
			generateNpcs: npcGenerationEnabled,
			generateLocations: locationGenerationEnabled,
			generateEncounters: encounterGenerationEnabled,
			generateCustomMonsters: customMonsterGenerationEnabled,
			entityScope: entityTargetScope,
			contextConfig,
			contextData,
			language: responseLanguage,
			globalBasePrompt,
			campaignBasePrompt,
		});

		if (!shouldParseAIResponse) {
			const aiResponse = await storage.addAiResponse({
				text: generatedContent,
				path,
				type,
				modelName,
				language: responseLanguage,
				userInstructions,
				request: requestSnapshot,
				retryPayload: cloneRetryPayload(req.body),
			});
			return res.json({ prompt: generatedContent, aiResponse });
		}

		const beforeApplyBundle = await storage.exportCampaignBundle(path.campaign);
		const applied = await applyAiOperations({
			payload: generatedContent,
			campaignSlug: path.campaign,
			sessionFile: session ? path.session : null,
			encounterId: path.encounter,
			entityScope: entityTargetScope,
			simplifiedNotes: simplifiedNotesEnabled,
			permissions: {
				allowCharacters: characterGenerationEnabled,
				allowNpcs: npcGenerationEnabled,
				allowLocations: locationGenerationEnabled,
				allowEncounters: encounterGenerationEnabled || Boolean(path.encounter),
			},
		});
		const extraChangeResources = applied.customBestiaryChange?.hasChanges
			? [
					{
						id: "custom-bestiary",
						kind: "custom-bestiary",
						campaign: "bestiary",
						label: "data/custom-bestiary.json",
						before: applied.customBestiaryChange.before,
						after: applied.customBestiaryChange.after,
					},
				]
			: [];

		if (!autoApplyAiChanges) {
			const aiResponse = await saveDraftParsedAiResponse({
				beforeApplyBundle,
				generatedContent,
				path,
				type,
				modelName,
				language: responseLanguage,
				userInstructions,
				requestSnapshot,
				retryPayload: cloneRetryPayload(req.body),
				extraChangeResources,
			});
			return res.json({
				generated: generatedContent,
				draft: true,
				aiResponse,
			});
		}

		const aiResponse = await saveParsedAiResponse({
			beforeApplyBundle,
			generatedContent,
			path,
			type,
			modelName,
			language: responseLanguage,
			userInstructions,
			requestSnapshot,
			retryPayload: cloneRetryPayload(req.body),
			extraChangeResources,
		});

		res.json({ generated: generatedContent, updated: applied.updated, aiResponse });
	} catch (error) {
		if (req.path === "/generate") {
			try {
				const aiResponse = await saveFailedAiRequest(
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
		processGeneratedTextMentions,
	},
});

module.exports = router;
