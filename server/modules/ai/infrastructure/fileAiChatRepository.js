const path = require("path");

const DEFAULT_CHAT_TITLE = "Новий діалог";
const MAX_STORED_CHAT_MESSAGES = 200;
const CHATS_FILE_NAME = "_aiChats.json";
const DEFAULT_MAX_TOKENS = 1000000;

const VALID_MUTATION_PERMISSIONS = new Set(["diff_only", "direct_mutation"]);
const VALID_RESPONSE_TONES = new Set(["concise", "narrative", "rules_strict"]);
const VALID_ROLES = new Set(["user", "assistant", "system"]);
const VALID_ACTION_STATUSES = new Set([
	"pending",
	"applied",
	"rejected",
	"undone",
]);

const DEFAULT_CHAT_CONTEXT_SETTINGS = Object.freeze({
	includeCurrentScene: true,
	includeCampaignNpc: true,
	includeCampaignLocations: true,
	includeRecentSessionHistory: false,
	includeBestiary: false,
	mutationPermission: "diff_only",
	responseTone: "narrative",
});

function createHttpError(message, status) {
	const error = new Error(message);
	error.status = status;
	return error;
}

function resolveCampaignSlug(campaignSlug) {
	const raw = String(campaignSlug || "").trim();
	if (!raw || raw === "." || raw === ".." || raw.includes("/") || raw.includes("\\")) {
		throw createHttpError("Valid campaign slug is required.", 400);
	}
	const base = path.basename(raw);
	if (!base || base === "." || base === "..") {
		throw createHttpError("Valid campaign slug is required.", 400);
	}
	return base;
}

function normalizeBoolean(value, fallback) {
	return typeof value === "boolean" ? value : fallback;
}

function normalizeTimestamp(value, fallback = Date.now()) {
	const num = Number(value);
	return Number.isFinite(num) && num > 0 ? num : fallback;
}

function normalizeContextSettings(raw = {}) {
	const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
	const mutationPermission = VALID_MUTATION_PERMISSIONS.has(source.mutationPermission)
		? source.mutationPermission
		: DEFAULT_CHAT_CONTEXT_SETTINGS.mutationPermission;
	const responseTone = VALID_RESPONSE_TONES.has(source.responseTone)
		? source.responseTone
		: DEFAULT_CHAT_CONTEXT_SETTINGS.responseTone;

	return {
		includeCurrentScene: normalizeBoolean(
			source.includeCurrentScene,
			DEFAULT_CHAT_CONTEXT_SETTINGS.includeCurrentScene,
		),
		includeCampaignNpc: normalizeBoolean(
			source.includeCampaignNpc,
			DEFAULT_CHAT_CONTEXT_SETTINGS.includeCampaignNpc,
		),
		includeCampaignLocations: normalizeBoolean(
			source.includeCampaignLocations,
			DEFAULT_CHAT_CONTEXT_SETTINGS.includeCampaignLocations,
		),
		includeRecentSessionHistory: normalizeBoolean(
			source.includeRecentSessionHistory,
			DEFAULT_CHAT_CONTEXT_SETTINGS.includeRecentSessionHistory,
		),
		includeBestiary: normalizeBoolean(
			source.includeBestiary,
			DEFAULT_CHAT_CONTEXT_SETTINGS.includeBestiary,
		),
		mutationPermission,
		responseTone,
	};
}

function normalizeAnchor(raw) {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
	const title = String(raw.title || "").trim();
	if (!title) return null;
	return {
		type: String(raw.type || "campaign").trim() || "campaign",
		title,
		...(raw.sessionFileName ? { sessionFileName: String(raw.sessionFileName) } : {}),
		...(raw.encounterId !== undefined && raw.encounterId !== null && raw.encounterId !== ""
			? { encounterId: String(raw.encounterId) }
			: {}),
		...(raw.sceneId !== undefined && raw.sceneId !== null && raw.sceneId !== ""
			? { sceneId: String(raw.sceneId) }
			: {}),
		pinned: Boolean(raw.pinned),
	};
}

function sanitizeAttachment(item, createId) {
	if (!item || typeof item !== "object" || Array.isArray(item)) return null;
	const name = String(item.name || "").trim();
	const url = String(item.url || "").trim();
	if (!name && !url) return null;
	const mimeType = String(item.mimeType || item.type || "").trim();
	const sizeBytes = Number(item.sizeBytes ?? item.size ?? 0);
	const sanitized = {
		id: String(item.id || createId()),
		name: name || path.basename(url) || "attachment",
		...(mimeType ? { mimeType } : {}),
		...(Number.isFinite(sizeBytes) && sizeBytes > 0 ? { sizeBytes } : {}),
		...(url ? { url } : {}),
	};
	return sanitized;
}

function normalizeActionCard(card, createId) {
	if (!card || typeof card !== "object" || Array.isArray(card)) return null;
	const status = VALID_ACTION_STATUSES.has(card.status) ? card.status : "pending";
	const stats = Array.isArray(card.stats)
		? card.stats
				.filter((stat) => stat && typeof stat === "object")
				.map((stat) => ({
					label: String(stat.label || "").trim(),
					value: String(stat.value || "").trim(),
					type: String(stat.type || "neutral").trim() || "neutral",
				}))
				.filter((stat) => stat.value)
		: [];
	const diffSnippet =
		card.diffSnippet && typeof card.diffSnippet === "object" && !Array.isArray(card.diffSnippet)
			? {
					before: String(card.diffSnippet.before ?? ""),
					after: String(card.diffSnippet.after ?? ""),
				}
			: undefined;

	return {
		id: String(card.id || `act-${createId()}`),
		type: card.type === "atomic" ? "atomic" : "diff",
		title: String(card.title || "Дія асистента").trim(),
		...(card.subtitle ? { subtitle: String(card.subtitle).trim() } : {}),
		...(card.description ? { description: String(card.description).trim() } : {}),
		...(card.targetEntity ? { targetEntity: String(card.targetEntity).trim() } : {}),
		...(card.targetType ? { targetType: String(card.targetType).trim() } : {}),
		...(stats.length > 0 ? { stats } : {}),
		status,
		...(diffSnippet ? { diffSnippet } : {}),
		...(Array.isArray(card.diffResources) && card.diffResources.length > 0
			? { diffResources: card.diffResources }
			: {}),
		...(Array.isArray(card.operations) ? { operations: card.operations } : {}),
		...(card.aiResponseId !== undefined && card.aiResponseId !== null
			? { aiResponseId: String(card.aiResponseId) }
			: {}),
		...(card.appliedAt ? { appliedAt: normalizeTimestamp(card.appliedAt, null) } : {}),
	};
}

function normalizeMessage(message, createId) {
	if (!message || typeof message !== "object" || Array.isArray(message)) return null;
	const role = VALID_ROLES.has(message.role) ? message.role : "user";
	const attachments = Array.isArray(message.attachments)
		? message.attachments.map((item) => sanitizeAttachment(item, createId)).filter(Boolean)
		: [];
	const actionCards = Array.isArray(message.actionCards)
		? message.actionCards.map((card) => normalizeActionCard(card, createId)).filter(Boolean)
		: [];

	return {
		id: String(message.id || `msg-${createId()}`),
		role,
		content: String(message.content || ""),
		timestamp: normalizeTimestamp(message.timestamp),
		status: String(message.status || "done"),
		...(attachments.length > 0 ? { attachments } : {}),
		...(actionCards.length > 0 ? { actionCards } : {}),
		...(message.errorMessage ? { errorMessage: String(message.errorMessage) } : {}),
	};
}

function capChatMessages(messages, summarizedMessageCount) {
	const baseSummarized = Math.max(0, Math.floor(Number(summarizedMessageCount) || 0));
	if (messages.length <= MAX_STORED_CHAT_MESSAGES) {
		return {
			messages,
			summarizedMessageCount: Math.min(baseSummarized, messages.length),
		};
	}
	const trimmedCount = messages.length - MAX_STORED_CHAT_MESSAGES;
	const kept = messages.slice(trimmedCount);
	return {
		messages: kept,
		summarizedMessageCount: Math.max(0, Math.min(kept.length, baseSummarized - trimmedCount)),
	};
}

function normalizeChatRecord(raw, campaignSlug, createId) {
	const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
	const now = Date.now();
	const createdAt = normalizeTimestamp(source.createdAt, now);
	const updatedAt = normalizeTimestamp(source.updatedAt, createdAt);
	const normalizedMessages = (Array.isArray(source.messages) ? source.messages : [])
		.map((msg) => normalizeMessage(msg, createId))
		.filter(Boolean);
	const capped = capChatMessages(normalizedMessages, source.summarizedMessageCount);
	const title = String(source.title || "").trim() || DEFAULT_CHAT_TITLE;
	const maxTokensNum = Number(source.maxTokens);
	const tokenEstimateNum = Number(source.tokenEstimate);

	return {
		id: String(source.id || `chat-${createId()}`),
		campaignSlug,
		title,
		isAutoTitled: Boolean(source.isAutoTitled),
		createdAt,
		updatedAt,
		model: String(source.model || "").trim(),
		autoApply: Boolean(source.autoApply),
		contextSettings: normalizeContextSettings(source.contextSettings),
		anchor: normalizeAnchor(source.anchor),
		summary: String(source.summary || ""),
		summarizedMessageCount: capped.summarizedMessageCount,
		tokenEstimate: Number.isFinite(tokenEstimateNum) && tokenEstimateNum >= 0
			? tokenEstimateNum
			: 0,
		maxTokens: Number.isFinite(maxTokensNum) && maxTokensNum > 0
			? maxTokensNum
			: DEFAULT_MAX_TOKENS,
		messages: capped.messages,
	};
}

function toChatSummary(chat) {
	const userMessageCount = chat.messages.filter((msg) => msg.role === "user").length;
	return {
		id: chat.id,
		campaignSlug: chat.campaignSlug,
		title: chat.title,
		isAutoTitled: chat.isAutoTitled,
		createdAt: chat.createdAt,
		updatedAt: chat.updatedAt,
		model: chat.model,
		autoApply: chat.autoApply,
		contextSettings: chat.contextSettings,
		anchor: chat.anchor,
		messageCount: chat.messages.length,
		userMessageCount,
		tokenEstimate: chat.tokenEstimate,
		maxTokens: chat.maxTokens,
	};
}

function sortChatsByUpdatedAt(chats) {
	return [...chats].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * Creates a persistent JSON-backed AI chat repository per campaign.
 */
function createFileAiChatRepository({ storage }) {
	function getChatsPath(campaignSlug) {
		const slug = resolveCampaignSlug(campaignSlug);
		return {
			slug,
			filePath: path.join(storage.campaignDir(slug), CHATS_FILE_NAME),
		};
	}

	async function assertCampaignExists(slug) {
		const exists = await storage.exists(storage.campaignMetaPath(slug));
		if (!exists) {
			throw createHttpError("Campaign not found.", 404);
		}
	}

	async function readAllNormalized(campaignSlug) {
		const { slug, filePath } = getChatsPath(campaignSlug);
		if (!(await storage.exists(filePath))) {
			await assertCampaignExists(slug);
			return { slug, filePath, chats: [] };
		}
		const saved = await storage.readJson(filePath);
		const list = Array.isArray(saved) ? saved : [];
		const chats = sortChatsByUpdatedAt(
			list.map((item) => normalizeChatRecord(item, slug, storage.createId)),
		);
		return { slug, filePath, chats };
	}

	async function writeAll(filePath, chats) {
		await storage.ensureDir(path.dirname(filePath));
		await storage.writeJson(filePath, sortChatsByUpdatedAt(chats));
	}

	async function list(campaignSlug) {
		const { chats } = await readAllNormalized(campaignSlug);
		return chats.map(toChatSummary);
	}

	async function get(campaignSlug, chatId) {
		const targetId = String(chatId || "").trim();
		if (!targetId) return null;
		const { chats } = await readAllNormalized(campaignSlug);
		return chats.find((chat) => chat.id === targetId) || null;
	}

	async function create(campaignSlug, input = {}) {
		const { slug, filePath, chats } = await readAllNormalized(campaignSlug);
		await assertCampaignExists(slug);
		const now = Date.now();
		const chat = normalizeChatRecord(
			{
				...input,
				id: input?.id || `chat-${storage.createId()}`,
				createdAt: input?.createdAt || now,
				updatedAt: input?.updatedAt || now,
			},
			slug,
			storage.createId,
		);
		const nextChats = sortChatsByUpdatedAt([
			chat,
			...chats.filter((existing) => existing.id !== chat.id),
		]);
		await writeAll(filePath, nextChats);
		return chat;
	}

	async function update(campaignSlug, chatId, patch = {}) {
		const targetId = String(chatId || "").trim();
		if (!targetId) throw createHttpError("Chat ID is required.", 400);
		const { slug, filePath, chats } = await readAllNormalized(campaignSlug);
		const index = chats.findIndex((chat) => chat.id === targetId);
		if (index === -1) throw createHttpError("AI chat not found.", 404);
		const existing = chats[index];
		const merged = {
			...existing,
			...(patch && typeof patch === "object" ? patch : {}),
			id: existing.id,
			campaignSlug: slug,
			createdAt: existing.createdAt,
			updatedAt: Date.now(),
		};
		const normalized = normalizeChatRecord(merged, slug, storage.createId);
		const nextChats = [...chats];
		nextChats[index] = normalized;
		await writeAll(filePath, nextChats);
		return normalized;
	}

	async function remove(campaignSlug, chatId) {
		const targetId = String(chatId || "").trim();
		if (!targetId) throw createHttpError("Chat ID is required.", 400);
		const { filePath, chats } = await readAllNormalized(campaignSlug);
		const nextChats = chats.filter((chat) => chat.id !== targetId);
		if (nextChats.length === chats.length) {
			throw createHttpError("AI chat not found.", 404);
		}
		await writeAll(filePath, nextChats);
		return sortChatsByUpdatedAt(nextChats).map(toChatSummary);
	}

	return {
		list,
		get,
		create,
		update,
		delete: remove,
	};
}

module.exports = {
	DEFAULT_CHAT_TITLE,
	DEFAULT_CHAT_CONTEXT_SETTINGS,
	DEFAULT_MAX_TOKENS,
	MAX_STORED_CHAT_MESSAGES,
	createFileAiChatRepository,
};
