import { useCallback, type Dispatch, type SetStateAction } from "react";
import { sessionApi } from "../../../entities/session/index.js";
import {
	usePersistentCampaignHistory,
	type HistoryMutationResult,
} from "../../../entities/history/index.js";
import type { SessionEditorSession } from "./sessionMutations.ts";
import type { SessionSaveOptions } from "./useSessionPersistence.ts";

interface ExternalSessionReplacementOptions {
	discardPendingSave: () => void;
	normalizeSession: (session: unknown) => SessionEditorSession;
}

interface SessionHistoryOptions {
	campaignSlug: string;
	sessionId: string;
	session: SessionEditorSession | null;
	setSession: Dispatch<SetStateAction<SessionEditorSession | null>>;
	flushPendingSave: (
		options?: SessionSaveOptions,
	) => Promise<unknown>;
	normalizeSession: (session: unknown) => SessionEditorSession;
	onSessionFileChanged?: (session: SessionEditorSession & { fileName?: string }) => void;
	onHistoryConflict?: (error: unknown) => void | Promise<void>;
	onHistoryError?: (error: unknown) => void;
	onHistoryRestored?: (result: HistoryMutationResult) => void | Promise<void>;
	syncVersion?: unknown;
}

export interface SessionHistory {
	canRedo: boolean;
	canUndo: boolean;
	handleRedo: () => void;
	handleUndo: () => void;
	isRestoring: boolean;
	redoLabel: string;
	replaceFromExternalUpdate: (
		updatedSession: unknown,
		options: ExternalSessionReplacementOptions,
	) => void;
	undoLabel: string;
}

export function useSessionHistory({
	campaignSlug,
	sessionId,
	session,
	setSession,
	flushPendingSave,
	normalizeSession,
	onSessionFileChanged,
	onHistoryConflict,
	onHistoryError,
	onHistoryRestored,
	syncVersion,
}: SessionHistoryOptions): SessionHistory {
	const reloadRestoredSession = useCallback(async () => {
		const sessions = await sessionApi.listSessions(campaignSlug);
		const currentId = session?.id;
		const summary = (sessions || []).find(
			(item) => currentId != null && String(item.id) === String(currentId),
		) || (sessions || []).find((item) => item.fileName === sessionId);
		if (!summary?.fileName) {
			setSession(null);
			return;
		}
		const loaded = normalizeSession(
			await sessionApi.getSession(campaignSlug, summary.fileName),
		);
		setSession(loaded);
		if (summary.fileName !== sessionId) onSessionFileChanged?.(loaded);
	}, [
		campaignSlug,
		normalizeSession,
		onSessionFileChanged,
		session?.id,
		sessionId,
		setSession,
	]);
	const beforeRestore = useCallback(async () => {
		await flushPendingSave({ throwOnError: true });
	}, [flushPendingSave]);
	const reloadAffectedSession = useCallback(async (
		result: HistoryMutationResult,
	) => {
		const affectedSessions = result.transaction?.affected.sessions;
		const currentId = session?.id;
		const affectsCurrent = !affectedSessions || affectedSessions.some(
			(id) =>
				(currentId != null && String(id) === String(currentId)) ||
				String(id) === String(sessionId),
		);
		if (affectsCurrent) await reloadRestoredSession();
		await onHistoryRestored?.(result);
	}, [
		onHistoryRestored,
		reloadRestoredSession,
		session?.id,
		sessionId,
	]);
	const reloadAfterConflict = useCallback(async (error: unknown) => {
		try {
			await reloadRestoredSession();
		} finally {
			await onHistoryConflict?.(error);
		}
	}, [onHistoryConflict, reloadRestoredSession]);
	const persistent = usePersistentCampaignHistory({
		campaignSlug,
		beforeRestore,
		onConflict: reloadAfterConflict,
		onRestored: reloadAffectedSession,
		onError: onHistoryError,
		syncVersion,
	});
	const refreshHistory = persistent.refreshHistory;
	const handleRedo = persistent.handleRedo;
	const handleUndo = persistent.handleUndo;

	const replaceFromExternalUpdate = useCallback(
		(
			updatedSession: unknown,
			{ discardPendingSave, normalizeSession: normalize }: ExternalSessionReplacementOptions,
		) => {
			discardPendingSave();
			setSession(normalize(updatedSession));
			void refreshHistory();
		},
		[refreshHistory, setSession],
	);
	const invokeRedo = useCallback(() => {
		void handleRedo();
	}, [handleRedo]);
	const invokeUndo = useCallback(() => {
		void handleUndo();
	}, [handleUndo]);

	return {
		canRedo: persistent.canRedo,
		canUndo: persistent.canUndo,
		handleRedo: invokeRedo,
		handleUndo: invokeUndo,
		isRestoring: persistent.isRestoring,
		redoLabel: persistent.redoLabel,
		replaceFromExternalUpdate,
		undoLabel: persistent.undoLabel,
	};
}
