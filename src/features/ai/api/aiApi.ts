import { request } from "../../../shared/api/index.ts";

export type AiHistoryId = string | number;

export interface AiModelDescriptor {
	name: string;
	displayName: string;
	description?: string;
	inputTokenLimit?: number;
	outputTokenLimit?: number;
}

export interface AiModelListResult {
	models: AiModelDescriptor[];
	imageModels?: AiModelDescriptor[];
	defaultModel: string;
	source: "gemini" | "fallback" | string;
}

export interface AiHistoryResource extends Record<string, unknown> {
	id: string;
	name?: string;
	kind?: string;
	type?: string;
	before?: unknown;
	after?: unknown;
}

export interface AiChangeSummary {
	added: number;
	deleted: number;
	modified: number;
	total: number;
}

export interface AiHistoryChanges extends Record<string, unknown> {
	resources?: AiHistoryResource[];
	summary?: Partial<AiChangeSummary>;
}

export interface AiHistoryEntry extends Record<string, unknown> {
	id: AiHistoryId;
	campaign?: string;
	createdAt?: string;
	applyState?: "draft" | "applied" | "undone" | string;
	status?: "pending" | "completed" | "failed" | string;
	type?: string;
	modelName?: string;
	language?: string;
	retryPayload?: AiGenerationPayload;
	request?: {
		options?: Record<string, unknown>;
		[key: string]: unknown;
	};
	changes?: AiHistoryChanges;
	path?: {
		campaign?: string;
		session?: string;
		encounter?: AiHistoryId;
		[key: string]: unknown;
	};
}

export interface AiHistoryStats {
	bytes: number;
}

export interface AiHistoryRestorePayload {
	resourceIds?: string[];
}

export interface AiHistoryDraftPayload {
	resources: Array<Pick<AiHistoryResource, "id" | "after">>;
}

export interface AiHistoryRestoreResult extends Record<string, unknown> {
	response?: AiHistoryEntry;
	responses?: AiHistoryEntry[];
	updated?: Record<string, unknown>;
}

export type AiGenerationPayload = Record<string, unknown>;

export interface AiGenerationResult extends Record<string, unknown> {
	aiResponse?: AiHistoryEntry;
	draft?: boolean;
	error?: string;
	generated?: unknown;
	generatedContent?: unknown;
	prompt?: string;
	updated?: unknown;
}

export interface AiChatContextSettings {
	includeCurrentScene: boolean;
	includeCampaignNpc: boolean;
	includeCampaignLocations: boolean;
	includeRecentSessionHistory: boolean;
	includeBestiary: boolean;
	mutationPermission: "diff_only" | "direct_mutation";
	responseTone: "concise" | "narrative" | "rules_strict";
}

export interface AiChatAnchor {
	type: "campaign" | "session" | "encounter" | "bestiary" | "general" | string;
	title: string;
	sessionFileName?: string;
	encounterId?: string;
	sceneId?: string;
	pinned?: boolean;
}

export interface AiChatWorkspaceContext {
	viewType?: "campaign" | "session" | "encounter" | "bestiary";
	campaignSlug: string;
	sessionFileName?: string | null;
	encounterId?: string | number | null;
	sceneId?: string | number | null;
	activeSection?: string;
}

export interface AiChatAttachmentRecord {
	id?: string;
	name: string;
	mimeType?: string;
	type?: string;
	sizeBytes?: number;
	size?: number;
	kind?: "image" | "file";
	data?: string;
	url?: string;
}

export interface AiChatActionCardStat {
	label: string;
	value: string;
	type?: "added" | "changed" | "info" | "neutral";
}

export interface AiChatActionCardRecord {
	id: string;
	type: "atomic" | "diff";
	title: string;
	subtitle?: string;
	description?: string;
	targetEntity?: string;
	targetType?:
		| "campaign"
		| "session"
		| "scene"
		| "npc"
		| "character"
		| "location"
		| "encounter"
		| "monster"
		| "note";
	stats?: AiChatActionCardStat[];
	status: "pending" | "applied" | "rejected" | "undone";
	diffSnippet?: {
		before?: string;
		after?: string;
	};
	diffResources?: AiHistoryResource[];
	operations?: unknown[];
	aiResponseId?: string | null;
	appliedAt?: number | null;
}

export interface AiChatMessageRecord {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: number;
	status?: "pending" | "streaming" | "done" | "error";
	actionCards?: AiChatActionCardRecord[];
	attachments?: AiChatAttachmentRecord[];
	errorMessage?: string;
}

export interface AiChatSummary {
	id: string;
	campaignSlug: string;
	title: string;
	isAutoTitled: boolean;
	createdAt: number;
	updatedAt: number;
	model: string;
	autoApply: boolean;
	contextSettings: AiChatContextSettings;
	anchor: AiChatAnchor | null;
	messageCount: number;
	userMessageCount: number;
	tokenEstimate: number;
	maxTokens: number;
}

export interface AiChatRecord {
	id: string;
	campaignSlug: string;
	title: string;
	isAutoTitled: boolean;
	createdAt: number;
	updatedAt: number;
	model: string;
	autoApply: boolean;
	contextSettings: AiChatContextSettings;
	anchor: AiChatAnchor | null;
	summary: string;
	summarizedMessageCount: number;
	tokenEstimate: number;
	maxTokens: number;
	messages: AiChatMessageRecord[];
}

export interface SendAiChatMessagePayload {
	content: string;
	model?: string;
	autoApply?: boolean;
	contextSettings?: Partial<AiChatContextSettings>;
	anchor?: AiChatAnchor | null;
	workspaceContext?: AiChatWorkspaceContext;
	language?: string;
	attachedImages?: AiChatAttachmentRecord[];
	attachedFiles?: AiChatAttachmentRecord[];
}

export type AiChatStreamPhase = "thinking" | "streaming" | "preparing_actions";

export interface SendAiChatMessageStreamOptions {
	signal?: AbortSignal;
	onDelta?: (text: string, replyComplete: boolean) => void;
	onStatus?: (phase: AiChatStreamPhase) => void;
}

export interface SendAiChatMessageResult {
	chat: AiChatRecord;
	userMessage: AiChatMessageRecord;
	assistantMessage: AiChatMessageRecord;
	updated?: unknown;
	appliedActionIds?: string[];
	changedEntityTypes?: string[];
	tokenEstimate: number;
	maxTokens: number;
	diceRolls?: Array<{
		expression: string;
		rolls: number[];
		modifier: number;
		total: number;
	}>;
}

export interface AiChatActionMutationResult {
	chat: AiChatRecord;
	actionCard: AiChatActionCardRecord;
	updated?: unknown;
	aiResponse?: AiHistoryEntry | null;
	changedEntityTypes?: string[];
}

const historyPath = (campaign: string, id?: AiHistoryId) =>
	`/ai/responses${id === undefined ? "" : `/${encodeURIComponent(String(id))}`}?campaign=${encodeURIComponent(campaign)}`;

const chatPath = (campaign: string, chatId?: string, suffix = "") =>
	`/ai/chats${chatId === undefined ? "" : `/${encodeURIComponent(String(chatId))}`}${suffix}?campaign=${encodeURIComponent(campaign)}`;

export const aiApi = {
	listAiModels: () => request<AiModelListResult>("/ai/models"),
	listAiChats: (campaign: string) =>
		request<AiChatSummary[]>(chatPath(campaign)),
	getAiChat: (campaign: string, chatId: string) =>
		request<AiChatRecord>(chatPath(campaign, chatId)),
	createAiChat: (campaign: string, payload: Record<string, unknown> = {}) =>
		request<AiChatRecord>(chatPath(campaign), {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	updateAiChat: (
		campaign: string,
		chatId: string,
		patch: Record<string, unknown>,
	) =>
		request<AiChatRecord>(chatPath(campaign, chatId), {
			method: "PATCH",
			body: JSON.stringify(patch),
		}),
	deleteAiChat: (campaign: string, chatId: string) =>
		request<AiChatSummary[]>(chatPath(campaign, chatId), {
			method: "DELETE",
		}),
	sendAiChatMessage: (
		campaign: string,
		chatId: string,
		payload: SendAiChatMessagePayload,
		options: Omit<RequestInit, "method" | "body"> = {},
	) =>
		request<SendAiChatMessageResult>(
			chatPath(campaign, chatId, "/messages"),
			{
				method: "POST",
				body: JSON.stringify(payload),
				...options,
			},
		),
	sendAiChatMessageStream: async (
		campaign: string,
		chatId: string,
		payload: SendAiChatMessagePayload,
		{ signal, onDelta, onStatus }: SendAiChatMessageStreamOptions = {},
	): Promise<SendAiChatMessageResult> => {
		const response = await fetch(
			`/api${chatPath(campaign, chatId, "/messages/stream")}`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "text/event-stream",
				},
				body: JSON.stringify(payload),
				signal,
			},
		);

		if (!response.ok) {
			const data = (await response.json().catch(() => null)) as {
				error?: string;
				code?: string;
			} | null;
			const error = new Error(
				data?.error || `Request failed with status ${response.status}`,
			) as Error & { status?: number; code?: string };
			error.status = response.status;
			if (data?.code) error.code = data.code;
			throw error;
		}

		if (!response.body) {
			throw new Error("Streaming response body is unavailable.");
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder("utf-8");
		let buffer = "";
		let finalResult: SendAiChatMessageResult | null = null;

		const handleEventBlock = (block: string) => {
			if (!block.trim()) return;
			let eventType = "message";
			const dataLines: string[] = [];
			for (const line of block.split("\n")) {
				if (line.startsWith("event:")) {
					eventType = line.slice(6).trim();
				} else if (line.startsWith("data:")) {
					dataLines.push(line.slice(5).trimStart());
				}
			}
			if (dataLines.length === 0) return;
			let parsed: Record<string, unknown>;
			try {
				parsed = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
			} catch {
				return;
			}
			if (eventType === "status" && typeof parsed.phase === "string") {
				onStatus?.(parsed.phase as AiChatStreamPhase);
			} else if (eventType === "delta") {
				onDelta?.(String(parsed.text ?? ""), Boolean(parsed.replyComplete));
			} else if (eventType === "done") {
				finalResult = parsed as unknown as SendAiChatMessageResult;
			} else if (eventType === "error") {
				const err = new Error(
					String(parsed.error || "Не вдалося отримати відповідь від AI-асистента."),
				) as Error & { status?: number; code?: string };
				if (typeof parsed.status === "number") err.status = parsed.status;
				if (typeof parsed.code === "string") err.code = parsed.code;
				throw err;
			}
		};

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
			let sepIndex = buffer.indexOf("\n\n");
			while (sepIndex !== -1) {
				const block = buffer.slice(0, sepIndex);
				buffer = buffer.slice(sepIndex + 2);
				handleEventBlock(block);
				sepIndex = buffer.indexOf("\n\n");
			}
		}

		buffer += decoder.decode().replace(/\r\n/g, "\n");
		if (buffer.trim()) {
			handleEventBlock(buffer);
		}

		if (!finalResult) {
			throw new Error("Потік відповіді завершився без фінального результату.");
		}
		return finalResult;
	},
	applyAiChatAction: (
		campaign: string,
		chatId: string,
		actionId: string,
		payload: Record<string, unknown> = {},
	) =>
		request<AiChatActionMutationResult>(
			chatPath(
				campaign,
				chatId,
				`/actions/${encodeURIComponent(String(actionId))}/apply`,
			),
			{
				method: "POST",
				body: JSON.stringify(payload),
			},
		),
	undoAiChatAction: (
		campaign: string,
		chatId: string,
		actionId: string,
	) =>
		request<AiChatActionMutationResult>(
			chatPath(
				campaign,
				chatId,
				`/actions/${encodeURIComponent(String(actionId))}/undo`,
			),
			{
				method: "POST",
				body: JSON.stringify({}),
			},
		),
	rejectAiChatAction: (
		campaign: string,
		chatId: string,
		actionId: string,
	) =>
		request<AiChatActionMutationResult>(
			chatPath(
				campaign,
				chatId,
				`/actions/${encodeURIComponent(String(actionId))}/reject`,
			),
			{
				method: "POST",
				body: JSON.stringify({}),
			},
		),
	generateImage: (payload: { campaign: string; historyCampaign?: string; modelName: string; prompt: string; attachedImages?: Record<string, unknown>[]; responseId?: AiHistoryId }) =>
		request<{ aiResponse: AiHistoryEntry; imageUrl: string }>("/ai/generate-image", { method: "POST", body: JSON.stringify(payload) }),
	saveGeminiApiKey: (apiKey: string) =>
		request<{ ok: true }>("/ai/api-key", {
			method: "POST",
			body: JSON.stringify({ apiKey }),
		}),
	listAiResponses: (campaign: string) =>
		request<AiHistoryEntry[]>(historyPath(campaign)),
	createAiResponse: (
		payload: AiGenerationPayload,
		options: Omit<RequestInit, "method" | "body"> = {},
	) =>
		request<AiHistoryEntry>("/ai/responses", {
			method: "POST",
			body: JSON.stringify(payload),
			...options,
		}),
	getAiResponsesStats: (campaign: string) =>
		request<AiHistoryStats>(
			`/ai/responses/stats?campaign=${encodeURIComponent(campaign)}`,
		),
	deleteAiResponse: (campaign: string, id: AiHistoryId) =>
		request<AiHistoryEntry[]>(historyPath(campaign, id), { method: "DELETE" }),
	updateAiResponse: (
		campaign: string,
		id: AiHistoryId,
		payload: AiHistoryDraftPayload,
	) =>
		request<AiHistoryEntry>(historyPath(campaign, id), {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
	applyAiResponse: (
		campaign: string,
		id: AiHistoryId,
		payload: AiHistoryRestorePayload = {},
	) =>
		request<AiHistoryRestoreResult>(
			`/ai/responses/${encodeURIComponent(String(id))}/apply?campaign=${encodeURIComponent(campaign)}`,
			{ method: "POST", body: JSON.stringify(payload) },
		),
	undoAiResponse: (
		campaign: string,
		id: AiHistoryId,
		payload: AiHistoryRestorePayload = {},
	) =>
		request<AiHistoryRestoreResult>(
			`/ai/responses/${encodeURIComponent(String(id))}/undo?campaign=${encodeURIComponent(campaign)}`,
			{ method: "POST", body: JSON.stringify(payload) },
		),
	clearAiResponses: (campaign: string) =>
		request<AiHistoryEntry[]>(historyPath(campaign), { method: "DELETE" }),
	generateAi: (
		payload: AiGenerationPayload,
		options: Omit<RequestInit, "method" | "body"> = {},
	) =>
		request<AiGenerationResult>("/ai/generate", {
			method: "POST",
			body: JSON.stringify(payload),
			...options,
		}),
};
