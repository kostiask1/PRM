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

function executeAiHistoryRestoreTransport(
	apiClient: AiHistoryCommandClient,
	campaign: string,
	entryId: AiHistoryId,
	mode: AiHistoryRestoreOperation,
	resourceIds?: string[],
): Promise<AiHistoryRestoreResult | null> {
	const payload = { resourceIds };
	return mode === "undo"
		? apiClient.undoAiResponse(campaign, entryId, payload)
		: apiClient.applyAiResponse(campaign, entryId, payload);
}

function requireAiHistoryRestoreResult(
	result: AiHistoryRestoreResult | null,
): AiHistoryRestoreResult {
	if (!result) throw new Error("AI restore response was empty.");
	return result;
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
		async restoreEntry(
			campaign: string,
			entryId: AiHistoryId,
			mode: AiHistoryRestoreOperation,
			resourceIds?: string[],
		) {
			return requireAiHistoryRestoreResult(
				await executeAiHistoryRestoreTransport(
					apiClient,
					campaign,
					entryId,
					mode,
					resourceIds,
				),
			);
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

interface RestoreLock {
	current: boolean;
}

interface ExecuteAiHistoryRestoreOptions {
	entry: AiHistoryEntry;
	mode: AiHistoryRestoreMode;
	resourceIds?: string[];
	campaign: string;
	releaseLock(): void;
	onRestored(
		result: AiHistoryRestoreResult,
		entry: AiHistoryEntry,
		mode: AiHistoryRestoreMode,
	): void;
	onError(action: "restore", error: unknown): void;
}

async function getConfirmedAiHistoryRestoreMode(
	entry: AiHistoryEntry,
	mode: string,
	options: AiHistoryRestoreOptions,
	confirmRestore: UseAiHistoryCommandsOptions["confirmRestore"],
): Promise<AiHistoryRestoreMode | null> {
	if (!entry?.id) return null;
	const restoreMode = getAiHistoryRestoreMode(mode, options.resourceIds);
	return (await confirmRestore(entry, restoreMode, options)) ? restoreMode : null;
}

function acquireAiHistoryRestoreLock(
	lock: RestoreLock,
	setIsRestoring: (value: boolean) => void,
): (() => void) | null {
	if (lock.current) return null;
	lock.current = true;
	setIsRestoring(true);
	return () => {
		lock.current = false;
		setIsRestoring(false);
	};
}

async function executeAiHistoryRestore({
	entry,
	mode,
	resourceIds,
	campaign,
	releaseLock,
	onRestored,
	onError,
}: ExecuteAiHistoryRestoreOptions): Promise<boolean> {
	try {
		const result = await aiHistoryCommands.restoreEntry(
			campaign,
			entry.id,
			mode.operation,
			resourceIds,
		);
		onRestored(result, entry, mode);
		return true;
	} catch (error) {
		onError("restore", error);
		return false;
	} finally {
		releaseLock();
	}
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
			if (restoringRef.current) return false;
			const restoreMode = await getConfirmedAiHistoryRestoreMode(
				entry,
				mode,
				options,
				confirmRestore,
			);
			if (!restoreMode) return false;
			const releaseLock = acquireAiHistoryRestoreLock(
				restoringRef,
				setIsRestoring,
			);
			if (!releaseLock) return false;

			return executeAiHistoryRestore({
				entry,
				mode: restoreMode,
				resourceIds: options.resourceIds,
				campaign: resolveCampaign(entry),
				releaseLock,
				onRestored,
				onError,
			});
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
