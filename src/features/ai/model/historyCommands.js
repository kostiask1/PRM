import { useCallback, useRef, useState } from "react";
import { aiApi } from "../api/aiApi.js";
import { getAiHistoryCampaign, getAiHistoryRestoreMode } from "./historyState.js";

export function createAiHistoryCommandService(apiClient) {
	if (!apiClient) throw new TypeError("apiClient is required");
	return {
		deleteEntry(campaign, entryId) {
			return apiClient.deleteAiResponse(campaign, entryId);
		},
		clearHistory(campaign) {
			return apiClient.clearAiResponses(campaign);
		},
		restoreEntry(campaign, entryId, mode, resourceIds) {
			const payload = { resourceIds };
			return mode === "undo"
				? apiClient.undoAiResponse(campaign, entryId, payload)
				: apiClient.applyAiResponse(campaign, entryId, payload);
		},
		saveDraft(campaign, entryId, resources) {
			return apiClient.updateAiResponse(campaign, entryId, { resources });
		},
	};
}

const aiHistoryCommands = createAiHistoryCommandService(aiApi);

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
}) {
	const [isRestoring, setIsRestoring] = useState(false);
	const restoringRef = useRef(false);

	const resolveCampaign = useCallback(
		(entry) => getAiHistoryCampaign(entry, historyCampaign),
		[historyCampaign],
	);

	const deleteEntry = useCallback(
		async (entry) => {
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

	const clearHistory = useCallback(async () => {
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
		async (entry, mode, options = {}) => {
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
		async (entry, resources) => {
			if (!entry?.id) return null;
			try {
				const updatedEntry = await aiHistoryCommands.saveDraft(
					resolveCampaign(entry),
					entry.id,
					resources,
				);
				if (updatedEntry) {
					onEntryUpserted(updatedEntry);
					onDraftSaved(updatedEntry);
				}
				return updatedEntry;
			} catch (error) {
				onError("save", error);
				throw error;
			}
		},
		[onDraftSaved, onEntryUpserted, onError, resolveCampaign],
	);

	return {
		isRestoring,
		deleteEntry,
		clearHistory,
		restoreEntry,
		saveDraft,
	};
}
