import { useCallback } from "react";

import { sessionApi } from "../../../entities/session/index.js";

export function useEncounterCreation({
	campaignSlug,
	session,
	sessionId,
	setSession,
	flushPendingSave,
	requestEncounterName,
	navigateToEncounter,
	onError,
}) {
	return useCallback(
		async (scene, { openInNewTab = false } = {}) => {
			if (!session || !scene) return;
			if (scene.encounterId !== null && scene.encounterId !== undefined) {
				navigateToEncounter(scene.encounterId, {
					fileName: session.fileName || sessionId,
					openInNewTab,
				});
				return;
			}

			const sceneIndex = (session.data?.scenes || []).findIndex(
				(item) => String(item.id) === String(scene.id),
			);
			if (sceneIndex < 0) return;
			const name = await requestEncounterName(scene, sceneIndex);
			if (name === null) return;

			try {
				const flushedSession = await flushPendingSave({ throwOnError: true });
				const fileName =
					flushedSession?.fileName || session.fileName || sessionId;
				const result = await sessionApi.createSceneEncounter(
					campaignSlug,
					fileName,
					scene.id,
					name,
				);
				setSession(result.session);
				navigateToEncounter(result.encounter.id, { fileName, openInNewTab });
			} catch (error) {
				onError?.(error);
			}
		},
		[
			campaignSlug,
			flushPendingSave,
			navigateToEncounter,
			onError,
			requestEncounterName,
			session,
			sessionId,
			setSession,
		],
	);
}
