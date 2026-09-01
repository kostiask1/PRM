import { useCallback, useEffect, useState } from "react";
import { API_MUTATION_EVENT } from "../../../shared/api/index.ts";
import {
	historyApi,
	isHistoryConflict,
	type HistoryMutationResult,
	type HistoryStatus,
} from "../api/historyApi.ts";
import { publishHistoryFocus } from "./historyFocus.ts";
import {
	ACTIVE_HISTORY_FLUSH_EVENT,
	waitForActiveHistoryFlush,
} from "./historyFlush.ts";
import { formatHistoryActionTitle } from "./historyLabels.ts";

const EMPTY_STATUS: HistoryStatus = {
	version: 1,
	revision: 0,
	limit: 100,
	canUndo: false,
	canRedo: false,
	undo: null,
	redo: null,
	pending: null,
	restoring: null,
};

interface PersistentCampaignHistoryOptions {
	campaignSlug: string;
	beforeRestore?: () => void | Promise<void>;
	onConflict?: (error: unknown) => void | Promise<void>;
	onRestored?: (result: HistoryMutationResult) => void | Promise<void>;
	onError?: (error: unknown) => void;
	syncVersion?: unknown;
}

export interface PersistentCampaignHistory {
	canUndo: boolean;
	canRedo: boolean;
	handleUndo: () => Promise<void>;
	handleRedo: () => Promise<void>;
	isRestoring: boolean;
	redoLabel: string;
	refreshHistory: () => Promise<HistoryStatus>;
	status: HistoryStatus;
	undoLabel: string;
}

export function usePersistentCampaignHistory({
	campaignSlug,
	beforeRestore,
	onConflict,
	onRestored,
	onError = console.error,
	syncVersion,
}: PersistentCampaignHistoryOptions): PersistentCampaignHistory {
	const [status, setStatus] = useState<HistoryStatus>(EMPTY_STATUS);
	const [isRestoring, setIsRestoring] = useState(false);
	const refreshHistory = useCallback(async () => {
		const next = await historyApi.getCampaign(campaignSlug);
		const normalized = next || EMPTY_STATUS;
		setStatus(normalized);
		return normalized;
	}, [campaignSlug]);

	useEffect(() => {
		void refreshHistory().catch(onError);
	}, [refreshHistory, onError, syncVersion]);

	useEffect(() => {
		if (!beforeRestore) return undefined;
		const handleFlush = (event: Event) => {
			waitForActiveHistoryFlush(event, beforeRestore);
		};
		window.addEventListener(ACTIVE_HISTORY_FLUSH_EVENT, handleFlush);
		return () => window.removeEventListener(ACTIVE_HISTORY_FLUSH_EVENT, handleFlush);
	}, [beforeRestore]);

	useEffect(() => {
		const campaignPrefix = `/campaigns/${encodeURIComponent(campaignSlug)}`;
		const handleMutation = (event: Event) => {
			const path = String(
				(event as CustomEvent<{ path?: unknown }>).detail?.path || "",
			);
			if (!path.startsWith(campaignPrefix) && !path.startsWith("/ai/")) return;
			void refreshHistory().catch(onError);
		};
		window.addEventListener(API_MUTATION_EVENT, handleMutation);
		return () => window.removeEventListener(API_MUTATION_EVENT, handleMutation);
	}, [campaignSlug, onError, refreshHistory]);

	const apply = useCallback(
		async (direction: "undo" | "redo") => {
			if (isRestoring) return;
			setIsRestoring(true);
			try {
				await beforeRestore?.();
				const currentStatus = await refreshHistory();
				const result = direction === "undo"
					? await historyApi.undoCampaign(campaignSlug, currentStatus.revision)
					: await historyApi.redoCampaign(campaignSlug, currentStatus.revision);
				if (!result) return;
				setStatus(result.history);
				await onRestored?.(result);
				publishHistoryFocus(result.focus);
			} catch (error) {
				if (isHistoryConflict(error) && onConflict) {
					try {
						await onConflict(error);
					} catch (conflictReloadError) {
						onError(conflictReloadError);
					}
				} else {
					onError(error);
				}
				await refreshHistory().catch(onError);
			} finally {
				setIsRestoring(false);
			}
		},
		[
			beforeRestore,
			campaignSlug,
			isRestoring,
			onConflict,
			onError,
			onRestored,
			refreshHistory,
		],
	);

	return {
		canUndo: status.canUndo,
		canRedo: status.canRedo,
		handleUndo: useCallback(() => apply("undo"), [apply]),
		handleRedo: useCallback(() => apply("redo"), [apply]),
		isRestoring,
		redoLabel: formatHistoryActionTitle("redo", status.redo),
		refreshHistory,
		status,
		undoLabel: formatHistoryActionTitle("undo", status.undo),
	};
}
