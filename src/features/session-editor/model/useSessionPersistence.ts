import { useCallback, useEffect, useRef, useState } from "react";
import { sessionApi } from "../../../entities/session/index.js";
import type { SessionRecord } from "../../../entities/session/index.js";
import type { SessionEditorSession } from "./sessionMutations.ts";
import {
	executeSessionSave,
	normalizeSessionSavePolicy,
	type SessionRenamedRecord,
} from "./sessionPersistence.ts";

export interface SessionSaveOptions {
	throwOnError?: boolean;
	updateUi?: boolean;
}

interface SessionPersistenceOptions {
	campaignSlug: string;
	sessionId: string;
	onSessionRenamed?: (session: SessionRenamedRecord) => void;
	onSaveError?: (error: unknown) => void;
	delay?: number;
}

export type ScheduleSessionSave = (
	session: SessionEditorSession,
	instant?: boolean,
) => Promise<SessionRecord | null> | undefined;

export interface SessionPersistence {
	discardPendingSave: () => void;
	flushPendingSave: (
		options?: SessionSaveOptions,
	) => Promise<SessionRecord | null>;
	hasPendingSave: () => boolean;
	isSaving: boolean;
	scheduleSave: ScheduleSessionSave;
}

export function useSessionPersistence({
	campaignSlug,
	sessionId,
	onSessionRenamed,
	onSaveError,
	delay = 250,
}: SessionPersistenceOptions): SessionPersistence {
	const [isSaving, setIsSaving] = useState(false);
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingSessionRef = useRef<SessionEditorSession | null>(null);

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
		async (
			session: SessionEditorSession | null,
			options: SessionSaveOptions = {},
		): Promise<SessionRecord | null> => {
			if (!session) return null;
			clearTimer();
			pendingSessionRef.current = null;
			return executeSessionSave({
				campaignSlug,
				sessionId,
				session,
				policy: normalizeSessionSavePolicy(options),
				updateSession: sessionApi.updateSession,
				setSaving: setIsSaving,
				onSessionRenamed,
				onSaveError,
			});
		},
		[campaignSlug, clearTimer, onSaveError, onSessionRenamed, sessionId],
	);

	const flushPendingSave = useCallback(
		(options: SessionSaveOptions = {}): Promise<SessionRecord | null> => {
			clearTimer();
			const pendingSession = pendingSessionRef.current;
			pendingSessionRef.current = null;
			return pendingSession
				? save(pendingSession, options)
				: Promise.resolve(null);
		},
		[clearTimer, save],
	);

	const scheduleSave = useCallback<ScheduleSessionSave>(
		(session, instant = false) => {
			pendingSessionRef.current = session;
			clearTimer();
			if (instant) return flushPendingSave();
			setIsSaving(true);
			saveTimeoutRef.current = setTimeout(() => {
				saveTimeoutRef.current = null;
				const pendingSession = pendingSessionRef.current;
				pendingSessionRef.current = null;
				void save(pendingSession);
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
			void flushPendingSave({ updateUi: false });
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
