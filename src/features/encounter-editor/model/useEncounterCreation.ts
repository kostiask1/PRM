import { useCallback, type Dispatch, type SetStateAction } from "react";
import { sessionApi } from "../../../entities/session/index.js";
import type { SessionRecord } from "../../../entities/session/index.js";
import type { EncounterScene } from "./contracts.ts";
import {
	executeEncounterOpen,
	type EncounterCreationSession,
	type EncounterNavigationOptions,
} from "./encounterCreation.ts";

export type { EncounterCreationSession } from "./encounterCreation.ts";

interface EncounterOpenOptions {
	openInNewTab?: boolean;
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
		(scene, options = {}) =>
			executeEncounterOpen({
				campaignSlug,
				session,
				sessionId,
				scene,
				openInNewTab: options.openInNewTab,
				flushPendingSave,
				requestEncounterName,
				createSceneEncounter: sessionApi.createSceneEncounter,
				setSession,
				navigateToEncounter,
				onError,
			}),
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
