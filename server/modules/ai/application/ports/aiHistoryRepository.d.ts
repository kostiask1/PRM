export type AiHistoryId = string | number;

export interface AiHistoryEntry extends Record<string, unknown> {
	id: AiHistoryId;
	campaign?: string;
}

export type AiHistoryPatch = Record<string, unknown>;
export type AiHistoryStats = Record<string, unknown>;

export interface AiHistoryRepository {
	list(campaignSlug: string): Promise<AiHistoryEntry[]>;
	stats(campaignSlug: string): Promise<AiHistoryStats>;
	get(campaignSlug: string, id: AiHistoryId): Promise<AiHistoryEntry | null>;
	add(entry: AiHistoryEntry): Promise<AiHistoryEntry>;
	update(
		campaignSlug: string,
		id: AiHistoryId,
		patch: AiHistoryPatch,
	): Promise<AiHistoryEntry>;
	delete(campaignSlug: string, id: AiHistoryId): Promise<unknown>;
	clear(campaignSlug: string): Promise<unknown>;
}

export const AI_HISTORY_REPOSITORY_METHODS: readonly (keyof AiHistoryRepository)[];
export function createAiHistoryRepositoryPort(
	implementation: AiHistoryRepository,
): Readonly<AiHistoryRepository>;
