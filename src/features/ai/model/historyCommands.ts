import { useCallback, useRef, useState } from "react";
import {
	aiApi,
	type AiHistoryDraftPayload,
	type AiHistoryEntry,
	type AiHistoryId,
	type AiHistoryRestoreResult,
} from "../api/aiApi.ts";
import {
	getAiHistoryCampaign,
	getAiHistoryRestoreMode,
	type AiHistoryRestoreMode,
	type AiHistoryRestoreOperation,
} from "./historyState.ts";

type Awaitable<T> = T | Promise<T>;

export interface AiHistoryCommandClient {
	deleteAiResponse(campaign: string, id: AiHistoryId): Promise<AiHistoryEntry[] | null>;
	clearAiResponses(campaign: string): Promise<AiHistoryEntry[] | null>;
	applyAiResponse(
		campaign: string,
		id: AiHistoryId,
		payload: { resourceIds?: string[] },
	): Promise<AiHistoryRestoreResult | null>;
	undoAiResponse(
		campaign: string,
		id: AiHistoryId,
		payload: { resourceIds?: string[] },
	): Promise<AiHistoryRestoreResult | null>;
	updateAiResponse(
		campaign: string,
		id: AiHistoryId,
		payload: AiHistoryDraftPayload,
	): Promise<AiHistoryEntry | null>;
}

export function createAiHistoryCommandService(apiClient: AiHistoryCommandClient) {
	if (!apiClient) throw new TypeError("apiClient is required");
	return {
		deleteEntry(campaign: string, entryId: AiHistoryId) {
			return apiClient.deleteAiResponse(campaign, entryId);
		},
		clearHistory(campaign: string) {
			return apiClient.clearAiResponses(campaign);
		},
		restoreEntry(
			campaign: string,
			entryId: AiHistoryId,
			mode: AiHistoryRestoreOperation,
			resourceIds?: string[],
		) {
			const payload = { resourceIds };
			return mode === "undo"
				? apiClient.undoAiResponse(campaign, entryId, payload)
				: apiClient.applyAiResponse(campaign, entryId, payload);
		},
		saveDraft(
			campaign: string,
			entryId: AiHistoryId,
			resources: AiHistoryDraftPayload["resources"],
		) {
			return apiClient.updateAiResponse(campaign, entryId, { resources });
		},
	};
}

const aiHistoryCommands = createAiHistoryCommandService(aiApi);

export interface AiHistoryRestoreOptions extends Record<string, unknown> {
	resourceIds?: string[];
}

export interface UseAiHistoryCommandsOptions {
	historyCampaign: string;
	confirmDelete(entry: AiHistoryEntry): Awaitable<boolean>;
	confirmClear(): Awaitable<boolean>;
	confirmRestore(
		entry: AiHistoryEntry,
		mode: AiHistoryRestoreMode,
		options: AiHistoryRestoreOptions,
	): Awaitable<boolean>;
	onHistoryReplaced(entries: AiHistoryEntry[]): void;
	onHistoryChanged(): void;
	onEntryDeleted(entry: AiHistoryEntry): void;
	onHistoryCleared(): void;
	onEntryUpserted(entry: AiHistoryEntry): void;
	onDraftSaved(entry: AiHistoryEntry): void;
	onRestored(
		result: AiHistoryRestoreResult,
		entry: AiHistoryEntry,
		mode: AiHistoryRestoreMode,
	): void;
	onError(action: "delete" | "restore" | "save", error: unknown): void;
}

export function useAiHistoryCommands({
	historyCampaign,
	confirmDelete,
	confirmClear,
	confirmRestore,
	onHistoryReplaced,
	onHistoryChanged,
	onEntryDeleted,
	onHistoryCleared,
	onEntryUpserted,
	onDraftSaved,
	onRestored,
	onError,
}: UseAiHistoryCommandsOptions) {
	const [isRestoring, setIsRestoring] = useState(false);
	const restoringRef = useRef(false);

	const resolveCampaign = useCallback(
		(entry: AiHistoryEntry) => getAiHistoryCampaign(entry, historyCampaign),
		[historyCampaign],
	);

	const deleteEntry = useCallback(
		async (entry: AiHistoryEntry): Promise<boolean> => {
			if (!entry?.id || !(await confirmDelete(entry))) return false;
			try {
				const responses = await aiHistoryCommands.deleteEntry(
					resolveCampaign(entry),
					entry.id,
				);
				onHistoryReplaced(Array.isArray(responses) ? responses : []);
				onHistoryChanged();
				onEntryDeleted(entry);
				return true;
			} catch (error) {
				onError("delete", error);
				return false;
			}
		},
		[
			confirmDelete,
			onEntryDeleted,
			onError,
			onHistoryChanged,
			onHistoryReplaced,
			resolveCampaign,
		],
	);

	const clearHistory = useCallback(async (): Promise<boolean> => {
		if (!(await confirmClear())) return false;
		try {
			const responses = await aiHistoryCommands.clearHistory(historyCampaign);
			onHistoryReplaced(Array.isArray(responses) ? responses : []);
			onHistoryChanged();
			onHistoryCleared();
			return true;
		} catch (error) {
			onError("delete", error);
			return false;
		}
	}, [
		confirmClear,
		historyCampaign,
		onError,
		onHistoryChanged,
		onHistoryCleared,
		onHistoryReplaced,
	]);

	const restoreEntry = useCallback(
		async (
			entry: AiHistoryEntry,
			mode: string,
			options: AiHistoryRestoreOptions = {},
		): Promise<boolean> => {
			if (!entry?.id || restoringRef.current) return false;
			const restoreMode = getAiHistoryRestoreMode(mode, options.resourceIds);
			if (!(await confirmRestore(entry, restoreMode, options))) return false;

			restoringRef.current = true;
			setIsRestoring(true);
			try {
				const result = await aiHistoryCommands.restoreEntry(
					resolveCampaign(entry),
					entry.id,
					restoreMode.operation,
					options.resourceIds,
				);
				if (!result) throw new Error("AI restore response was empty.");
				onRestored(result, entry, restoreMode);
				return true;
			} catch (error) {
				onError("restore", error);
				return false;
			} finally {
				restoringRef.current = false;
				setIsRestoring(false);
			}
		},
		[confirmRestore, onError, onRestored, resolveCampaign],
	);

	const saveDraft = useCallback(
		async (
			entry: AiHistoryEntry,
			resources: AiHistoryDraftPayload["resources"],
		): Promise<AiHistoryEntry | null> => {
			if (!entry?.id) return null;
			try {
				const updatedEntry = await aiHistoryCommands.saveDraft(
					resolveCampaign(entry),
					entry.id,
					resources,
				);
				if (!updatedEntry) return null;
				onEntryUpserted(updatedEntry);
				onDraftSaved(updatedEntry);
				return updatedEntry;
			} catch (error) {
				onError("save", error);
				throw error;
			}
		},
		[onDraftSaved, onEntryUpserted, onError, resolveCampaign],
	);

	return { isRestoring, deleteEntry, clearHistory, restoreEntry, saveDraft };
}
