import { useCallback, useEffect, useRef, useState } from "react";

import { sessionApi } from "../../../entities/session/index.js";

export function useSessionPersistence({
	campaignSlug,
	sessionId,
	onSessionRenamed,
	onSaveError,
	delay = 250,
}) {
	const [isSaving, setIsSaving] = useState(false);
	const saveTimeoutRef = useRef(null);
	const pendingSessionRef = useRef(null);

	const clearTimer = useCallback(() => {
		if (!saveTimeoutRef.current) return;
		clearTimeout(saveTimeoutRef.current);
		saveTimeoutRef.current = null;
	}, []);

	const discardPendingSave = useCallback(() => {
		clearTimer();
		pendingSessionRef.current = null;
		setIsSaving(false);
	}, [clearTimer]);

	const save = useCallback(
		async (session, options = {}) => {
			if (!session) return null;
			const { throwOnError = false, updateUi = true } = options;
			clearTimer();
			pendingSessionRef.current = null;
			if (updateUi) setIsSaving(true);
			try {
				const result = await sessionApi.updateSession(
					campaignSlug,
					sessionId,
					session,
				);
				if (updateUi && result?.fileName && result.fileName !== sessionId) {
					onSessionRenamed?.(result);
				}
				return result;
			} catch (error) {
				onSaveError?.(error);
				if (throwOnError) throw error;
				return null;
			} finally {
				if (updateUi) setIsSaving(false);
			}
		},
		[campaignSlug, clearTimer, onSaveError, onSessionRenamed, sessionId],
	);

	const flushPendingSave = useCallback(
		(options = {}) => {
			clearTimer();
			const pendingSession = pendingSessionRef.current;
			pendingSessionRef.current = null;
			return pendingSession ? save(pendingSession, options) : Promise.resolve(null);
		},
		[clearTimer, save],
	);

	const scheduleSave = useCallback(
		(session, instant = false) => {
			pendingSessionRef.current = session;
			clearTimer();
			if (instant) return flushPendingSave();
			setIsSaving(true);
			saveTimeoutRef.current = setTimeout(() => {
				saveTimeoutRef.current = null;
				const pendingSession = pendingSessionRef.current;
				pendingSessionRef.current = null;
				save(pendingSession);
			}, delay);
			return undefined;
		},
		[clearTimer, delay, flushPendingSave, save],
	);

	const hasPendingSave = useCallback(
		() => Boolean(saveTimeoutRef.current || pendingSessionRef.current),
		[],
	);

	useEffect(
		() => () => {
			flushPendingSave({ updateUi: false });
		},
		[flushPendingSave],
	);

	return {
		discardPendingSave,
		flushPendingSave,
		hasPendingSave,
		isSaving,
		scheduleSave,
	};
}
