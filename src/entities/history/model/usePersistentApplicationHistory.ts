import { useCallback, useEffect, useState } from "react";
import { API_MUTATION_EVENT } from "../../../shared/api/index.ts";
import {
	historyApi,
	isHistoryConflict,
	type HistoryMutationResult,
	type HistoryStatus,
} from "../api/historyApi.ts";
import { publishHistoryFocus } from "./historyFocus.ts";
import { requestActiveHistoryFlush } from "./historyFlush.ts";
import { formatHistoryActionTitle } from "./historyLabels.ts";

const EMPTY_APPLICATION_STATUS: HistoryStatus = {
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

interface PersistentApplicationHistoryOptions {
	onConflict?: (error: unknown) => void | Promise<void>;
	onRestored?: (result: HistoryMutationResult) => void | Promise<void>;
	onError?: (error: unknown) => void;
	syncVersion?: unknown;
}

export function usePersistentApplicationHistory({
	onConflict,
	onRestored,
	onError = console.error,
	syncVersion,
}: PersistentApplicationHistoryOptions = {}) {
	const [status, setStatus] = useState(EMPTY_APPLICATION_STATUS);
	const [isRestoring, setIsRestoring] = useState(false);
	const refresh = useCallback(async () => {
		const next = await historyApi.getApplication();
		const normalized = next || EMPTY_APPLICATION_STATUS;
		setStatus(normalized);
		return normalized;
	}, []);

	useEffect(() => {
		void refresh().catch(onError);
		const handleMutation = (event: Event) => {
			const detail = (event as CustomEvent<{ path?: unknown }>).detail;
			const path = String(detail?.path || "");
			const isCampaignLifecycle =
				path === "/campaigns" ||
				path === "/campaigns/reorder" ||
				/^\/campaigns\/[^/]+$/.test(path);
			if (
				!isCampaignLifecycle &&
				!path.startsWith("/import-all") &&
				!path.startsWith("/import-archive")
			) return;
			void refresh().catch(onError);
		};
		window.addEventListener(API_MUTATION_EVENT, handleMutation);
		return () => window.removeEventListener(API_MUTATION_EVENT, handleMutation);
	}, [onError, refresh, syncVersion]);

	const apply = useCallback(async (direction: "undo" | "redo") => {
		if (isRestoring) return;
		setIsRestoring(true);
		try {
			await requestActiveHistoryFlush();
			const currentStatus = await refresh();
			const result = direction === "undo"
				? await historyApi.undoApplication(currentStatus.revision)
				: await historyApi.redoApplication(currentStatus.revision);
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
			await refresh().catch(onError);
		} finally {
			setIsRestoring(false);
		}
	}, [isRestoring, onConflict, onError, onRestored, refresh]);

	return {
		canRedo: status.canRedo,
		canUndo: status.canUndo,
		status,
		isRestoring,
		handleUndo: useCallback(() => apply("undo"), [apply]),
		handleRedo: useCallback(() => apply("redo"), [apply]),
		redoLabel: formatHistoryActionTitle("redo", status.redo),
		refresh,
		undoLabel: formatHistoryActionTitle("undo", status.undo),
	};
}
