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
	status?: string;
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

const historyPath = (campaign: string, id?: AiHistoryId) =>
	`/ai/responses${id === undefined ? "" : `/${encodeURIComponent(String(id))}`}?campaign=${encodeURIComponent(campaign)}`;

export const aiApi = {
	listAiModels: () => request<AiModelListResult>("/ai/models"),
	saveGeminiApiKey: (apiKey: string) =>
		request<{ ok: true }>("/ai/api-key", {
			method: "POST",
			body: JSON.stringify({ apiKey }),
		}),
	listAiResponses: (campaign: string) =>
		request<AiHistoryEntry[]>(historyPath(campaign)),
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
