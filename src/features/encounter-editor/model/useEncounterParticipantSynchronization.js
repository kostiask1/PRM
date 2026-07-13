import { useCallback, useEffect, useRef, useState } from "react";

import { bestiaryApi } from "../../../entities/bestiary/index.js";
import { campaignApi } from "../../../entities/campaign/index.js";
import {
	buildEntityImageMap,
	normalizeParticipantName,
	synchronizeCustomMonsterParticipants,
} from "./participantSynchronization.js";

export function useEncounterParticipantSynchronization({
	campaignSlug,
	encounter,
	selectedInstanceId,
	applyEncounterUpdate,
	hasPendingSave,
	syncEvent,
	onError,
}) {
	const [playerCharacters, setPlayerCharacters] = useState([]);
	const [entityImageMap, setEntityImageMap] = useState(new Map());
	const processedSyncVersionRef = useRef(null);

	useEffect(() => {
		let active = true;
		Promise.all([
			campaignApi.getEntities(campaignSlug, "characters"),
			campaignApi.getEntities(campaignSlug, "npc"),
		])
			.then(([characters = [], npcs = []]) => {
				if (!active) return;
				setPlayerCharacters(characters);
				setEntityImageMap(buildEntityImageMap([...characters, ...npcs]));
			})
			.catch((error) => {
				if (active) onError?.(error, "load-entities");
			});
		return () => {
			active = false;
		};
	}, [campaignSlug, onError]);

	const getMonsterImageOverride = useCallback(
		(monster) =>
			entityImageMap.get(normalizeParticipantName(monster?.name)) || null,
		[entityImageMap],
	);

	const syncCustomBestiaryMonsters = useCallback(async () => {
		if (!encounter?.monsters?.length) return;
		try {
			const result = synchronizeCustomMonsterParticipants(
				encounter,
				await bestiaryApi.getCustomBestiaryData(),
			);
			if (!result.changed) return;
			applyEncounterUpdate(result.encounter, {
				pushUndo: false,
				preferredId: selectedInstanceId || null,
			});
		} catch (error) {
			onError?.(error, "sync-custom-bestiary");
		}
	}, [applyEncounterUpdate, encounter, onError, selectedInstanceId]);

	useEffect(() => {
		if (!["custom-bestiary", "ai"].includes(syncEvent?.resource)) return;
		if (processedSyncVersionRef.current === syncEvent?.version) return;
		if (hasPendingSave()) return;
		processedSyncVersionRef.current = syncEvent?.version;
		syncCustomBestiaryMonsters();
	}, [hasPendingSave, syncCustomBestiaryMonsters, syncEvent]);

	return { getMonsterImageOverride, playerCharacters, syncCustomBestiaryMonsters };
}
