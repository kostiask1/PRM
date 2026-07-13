import { useCallback, useEffect, useRef, useState } from "react";

import { sessionApi } from "../../../entities/session/index.js";

export function useEncounterPersistence({
	campaignSlug,
	sessionId,
	encounterId,
	onSaved,
	onError,
}) {
	const [isSaving, setIsSaving] = useState(false);
	const saveTimeoutRef = useRef(null);
	const pendingEncounterRef = useRef(null);

	const clearTimer = useCallback(() => {
		if (!saveTimeoutRef.current) return;
		clearTimeout(saveTimeoutRef.current);
		saveTimeoutRef.current = null;
	}, []);

	const flush = useCallback(
		async ({ updateUi = true } = {}) => {
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
				onSaved?.(result);
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
		(encounter, debounceMs = 0) => {
			pendingEncounterRef.current = encounter;
			clearTimer();
			setIsSaving(true);
			if (debounceMs > 0) {
				saveTimeoutRef.current = setTimeout(flush, debounceMs);
				return;
			}
			flush();
		},
		[clearTimer, flush],
	);

	const hasPendingSave = useCallback(
		() => Boolean(saveTimeoutRef.current || pendingEncounterRef.current),
		[],
	);

	useEffect(
		() => () => {
			flush({ updateUi: false });
		},
		[flush],
	);

	return { flush, hasPendingSave, isSaving, scheduleSave };
}
