import { useCallback, useEffect, useRef, useState } from "react";
import { sessionApi } from "../../../entities/session/index.js";
import type {
	EncounterUpdateResult,
	SessionDomainId,
} from "../../../entities/session/index.js";
import type { EncounterEditorState } from "./contracts.ts";

export interface EncounterFlushOptions {
	updateUi?: boolean;
}

interface EncounterPersistenceOptions {
	campaignSlug: string;
	sessionId: string;
	encounterId: SessionDomainId;
	onSaved?: (result: EncounterUpdateResult) => void;
	onError?: (error: unknown) => void;
}

export interface EncounterPersistence {
	flush: (
		options?: EncounterFlushOptions,
	) => Promise<EncounterUpdateResult | null>;
	hasPendingSave: () => boolean;
	isSaving: boolean;
	scheduleSave: (encounter: EncounterEditorState, debounceMs?: number) => void;
}

export function useEncounterPersistence({
	campaignSlug,
	sessionId,
	encounterId,
	onSaved,
	onError,
}: EncounterPersistenceOptions): EncounterPersistence {
	const [isSaving, setIsSaving] = useState(false);
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingEncounterRef = useRef<EncounterEditorState | null>(null);

	const clearTimer = useCallback(() => {
		if (!saveTimeoutRef.current) return;
		clearTimeout(saveTimeoutRef.current);
		saveTimeoutRef.current = null;
	}, []);

	const flush = useCallback(
		async ({
			updateUi = true,
		}: EncounterFlushOptions = {}): Promise<EncounterUpdateResult | null> => {
			clearTimer();
			const pendingEncounter = pendingEncounterRef.current;
			pendingEncounterRef.current = null;
			if (!pendingEncounter) return null;
			if (updateUi) setIsSaving(true);
			try {
				const result = await sessionApi.updateEncounter(
					campaignSlug,
					sessionId,
					encounterId,
					pendingEncounter,
				);
				if (result) onSaved?.(result);
				return result;
			} catch (error) {
				onError?.(error);
				return null;
			} finally {
				if (updateUi) setIsSaving(false);
			}
		},
		[campaignSlug, clearTimer, encounterId, onError, onSaved, sessionId],
	);

	const scheduleSave = useCallback(
		(encounter: EncounterEditorState, debounceMs = 0) => {
			pendingEncounterRef.current = encounter;
			clearTimer();
			setIsSaving(true);
			if (debounceMs > 0) {
				saveTimeoutRef.current = setTimeout(() => void flush(), debounceMs);
				return;
			}
			void flush();
		},
		[clearTimer, flush],
	);

	const hasPendingSave = useCallback(
		() => Boolean(saveTimeoutRef.current || pendingEncounterRef.current),
		[],
	);

	useEffect(
		() => () => {
			void flush({ updateUi: false });
		},
		[flush],
	);

	return { flush, hasPendingSave, isSaving, scheduleSave };
}
