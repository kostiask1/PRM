import {
	useCallback,
	type Dispatch,
	type SetStateAction,
} from "react";
import { sessionApi } from "../../../entities/session/index.js";
import type { SessionRecord } from "../../../entities/session/index.js";
import type { EncounterScene } from "./contracts.ts";

interface EncounterCreationSessionData extends Record<string, unknown> {
	scenes?: EncounterScene[];
}

export interface EncounterCreationSession extends Record<string, unknown> {
	fileName?: string;
	data?: EncounterCreationSessionData;
}

interface EncounterOpenOptions {
	openInNewTab?: boolean;
}

interface EncounterNavigationOptions {
	fileName: string;
	openInNewTab: boolean;
}

interface EncounterCreationOptions {
	campaignSlug: string;
	session: EncounterCreationSession | null;
	sessionId: string;
	setSession: Dispatch<
		SetStateAction<EncounterCreationSession | SessionRecord | null>
	>;
	flushPendingSave: (options: {
		throwOnError: boolean;
	}) => Promise<SessionRecord | null>;
	requestEncounterName: (
		scene: EncounterScene,
		sceneIndex: number,
	) => string | null | Promise<string | null>;
	navigateToEncounter: (
		encounterId: string | number,
		options: EncounterNavigationOptions,
	) => void;
	onError?: (error: unknown) => void;
}

export type OpenEncounter = (
	scene: EncounterScene | null | undefined,
	options?: EncounterOpenOptions,
) => Promise<void>;

export function useEncounterCreation({
	campaignSlug,
	session,
	sessionId,
	setSession,
	flushPendingSave,
	requestEncounterName,
	navigateToEncounter,
	onError,
}: EncounterCreationOptions): OpenEncounter {
	return useCallback(
		async (
			scene: EncounterScene | null | undefined,
			{ openInNewTab = false }: EncounterOpenOptions = {},
		): Promise<void> => {
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
				if (!result?.session || result.encounter.id === undefined) {
					throw new Error("Encounter creation returned an incomplete result");
				}
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
