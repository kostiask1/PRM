import type {
	AiHistoryEntry,
	AiHistoryId,
	AiHistoryPatch,
	AiHistoryRepository,
	AiHistoryStats,
} from "../application/ports/aiHistoryRepository";

export interface AiHistoryStorageAdapter {
	readAiResponses(campaignSlug: string): Promise<AiHistoryEntry[]>;
	getAiResponsesStorageStats(campaignSlug: string): Promise<AiHistoryStats>;
	getAiResponse(
		campaignSlug: string,
		id: AiHistoryId,
	): Promise<AiHistoryEntry | null>;
	addAiResponse(entry: AiHistoryEntry): Promise<AiHistoryEntry>;
	updateAiResponse(
		campaignSlug: string,
		id: AiHistoryId,
		patch: AiHistoryPatch,
	): Promise<AiHistoryEntry>;
	deleteAiResponse(campaignSlug: string, id: AiHistoryId): Promise<unknown>;
	clearAiResponses(campaignSlug: string): Promise<unknown>;
}

export function createFileAiHistoryRepository(
	storage: AiHistoryStorageAdapter,
): Readonly<AiHistoryRepository>;
