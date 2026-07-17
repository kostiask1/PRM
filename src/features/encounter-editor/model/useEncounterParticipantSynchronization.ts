import { useCallback, useEffect, useRef, useState } from "react";
import { bestiaryApi } from "../../../entities/bestiary/index.js";
import { campaignApi } from "../../../entities/campaign/index.js";
import type { CampaignEntityRecord } from "../../../entities/campaign/index.js";
import type {
	ApplyEncounterUpdate,
	EncounterEditorState,
	EncounterEditorSyncEvent,
} from "./contracts.ts";
import {
	buildEntityImageMap,
	normalizeParticipantName,
	synchronizeCustomMonsterParticipants,
} from "./participantSynchronization.ts";

type ParticipantSyncOperation = "load-entities" | "sync-custom-bestiary";

interface EncounterParticipantSynchronizationOptions {
	campaignSlug: string;
	encounter: EncounterEditorState | null;
	selectedInstanceId?: string | null;
	applyEncounterUpdate: ApplyEncounterUpdate;
	hasPendingSave: () => boolean;
	syncEvent?: EncounterEditorSyncEvent | null;
	onError?: (error: unknown, operation: ParticipantSyncOperation) => void;
}

export interface EncounterParticipantSynchronization {
	getMonsterImageOverride: (monster: { name?: unknown }) => string | null;
	playerCharacters: CampaignEntityRecord[];
	syncCustomBestiaryMonsters: () => Promise<void>;
}

export function useEncounterParticipantSynchronization({
	campaignSlug,
	encounter,
	selectedInstanceId,
	applyEncounterUpdate,
	hasPendingSave,
	syncEvent,
	onError,
}: EncounterParticipantSynchronizationOptions): EncounterParticipantSynchronization {
	const [playerCharacters, setPlayerCharacters] = useState<
		CampaignEntityRecord[]
	>([]);
	const [entityImageMap, setEntityImageMap] = useState<Map<string, string>>(
		new Map(),
	);
	const processedSyncVersionRef = useRef<string | number | null>(null);

	useEffect(() => {
		let active = true;
		Promise.all([
			campaignApi.getEntities(campaignSlug, "characters"),
			campaignApi.getEntities(campaignSlug, "npc"),
		])
			.then(([characters, npcs]) => {
				if (!active) return;
				const safeCharacters = Array.isArray(characters) ? characters : [];
				const safeNpcs = Array.isArray(npcs) ? npcs : [];
				setPlayerCharacters(safeCharacters);
				setEntityImageMap(
					buildEntityImageMap([...safeCharacters, ...safeNpcs]),
				);
			})
			.catch((error: unknown) => {
				if (active) onError?.(error, "load-entities");
			});
		return () => {
			active = false;
		};
	}, [campaignSlug, onError]);

	const getMonsterImageOverride = useCallback(
		(monster: { name?: unknown }) =>
			entityImageMap.get(normalizeParticipantName(monster?.name)) || null,
		[entityImageMap],
	);

	const syncCustomBestiaryMonsters = useCallback(async (): Promise<void> => {
		if (!encounter?.monsters?.length) return;
		try {
			const customMonsters = await bestiaryApi.getCustomBestiaryData();
			const result = synchronizeCustomMonsterParticipants(
				encounter,
				customMonsters || [],
			);
			if (!result.changed || !result.encounter) return;
			applyEncounterUpdate(result.encounter, {
				pushUndo: false,
				preferredId: selectedInstanceId || null,
			});
		} catch (error) {
			onError?.(error, "sync-custom-bestiary");
		}
	}, [applyEncounterUpdate, encounter, onError, selectedInstanceId]);

	useEffect(() => {
		if (!syncEvent || !["custom-bestiary", "ai"].includes(syncEvent.resource || "")) {
			return;
		}
		if (processedSyncVersionRef.current === syncEvent.version) return;
		if (hasPendingSave()) return;
		processedSyncVersionRef.current = syncEvent.version ?? null;
		void syncCustomBestiaryMonsters();
	}, [hasPendingSave, syncCustomBestiaryMonsters, syncEvent]);

	return {
		getMonsterImageOverride,
		playerCharacters,
		syncCustomBestiaryMonsters,
	};
}
