import { request } from "../../../shared/api/index.ts";

export interface HistoryAffectedResources {
	campaigns: string[];
	sessions: string[];
	entities: string[];
	encounters: string[];
}

export type HistoryFocusResource =
	| "campaign-list"
	| "campaign-sessions"
	| "campaign"
	| "campaign-meta"
	| "session"
	| "session-entity"
	| "entity"
	| "encounter"
	| "scene"
	| "note";

export interface HistoryFocusTarget {
	resource: HistoryFocusResource | string;
	campaignSlug: string | null;
	resourceId?: string | number | null;
	resourceExists?: boolean;
	sessionId?: string | number | null;
	sessionFileName?: string | null;
	entityId?: string | number | null;
	entityType?: string | null;
	entitySlug?: string | null;
	encounterId?: string | number | null;
	encounterExists?: boolean | null;
	sceneId?: string | number | null;
	sceneExists?: boolean | null;
	noteId?: string | number | null;
	noteExists?: boolean | null;
	participantInstanceId?: string | number | null;
	participantExists?: boolean | null;
	entityExists?: boolean | null;
	field?: string | null;
	caretOffset?: number | null;
	caretValueRevision?: string | null;
	preserveRoute?: boolean;
	exists: boolean;
}

export interface HistoryTransactionSummary {
	id: string;
	createdAt: string;
	operation: string;
	params: Record<string, unknown>;
	status: "committed" | "partial" | "interrupted" | string;
	affected: HistoryAffectedResources;
}

export interface HistoryStatus {
	version: number;
	revision: number;
	limit: number;
	canUndo: boolean;
	canRedo: boolean;
	undo: HistoryTransactionSummary | null;
	redo: HistoryTransactionSummary | null;
	pending: { id?: string; operation?: string; startedAt?: string } | null;
	restoring: {
		transactionId: string;
		direction: "undo" | "redo";
		active: number | null;
		completed: number[];
	} | null;
}

export interface HistoryMutationResult {
	history: HistoryStatus;
	transaction: HistoryTransactionSummary | null;
	currentSlug?: string | null;
	focus?: HistoryFocusTarget | null;
}

export interface HistoryConflict {
	status: 409;
	error: string;
}

export function isHistoryConflict(error: unknown): boolean {
	return Boolean(
		error &&
			typeof error === "object" &&
			(error as { status?: unknown }).status === 409,
	);
}

const campaignHistoryPath = (slug: string) =>
	`/campaigns/${encodeURIComponent(slug)}/history`;

export const historyApi = {
	getCampaign: (slug: string) =>
		request<HistoryStatus>(campaignHistoryPath(slug)),
	undoCampaign: (slug: string, expectedRevision: number) =>
		request<HistoryMutationResult>(`${campaignHistoryPath(slug)}/undo`, {
			method: "POST",
			body: JSON.stringify({ expectedRevision }),
		}),
	redoCampaign: (slug: string, expectedRevision: number) =>
		request<HistoryMutationResult>(`${campaignHistoryPath(slug)}/redo`, {
			method: "POST",
			body: JSON.stringify({ expectedRevision }),
		}),
	getApplication: () => request<HistoryStatus>("/history"),
	undoApplication: (expectedRevision: number) =>
		request<HistoryMutationResult>("/history/undo", {
			method: "POST",
			body: JSON.stringify({ expectedRevision }),
		}),
	redoApplication: (expectedRevision: number) =>
		request<HistoryMutationResult>("/history/redo", {
			method: "POST",
			body: JSON.stringify({ expectedRevision }),
		}),
};
