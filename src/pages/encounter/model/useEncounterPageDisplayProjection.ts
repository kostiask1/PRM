import { useMemo } from "react";
import type { CampaignEntityRecord } from "../../../entities/campaign/index.js";
import type {
	EncounterViewModel,
	EncounterViewParticipant,
} from "./contracts.ts";
import {
	getEncounterGridProjection,
	getEncounterLayout,
	getEncounterSelectedGridId,
} from "./encounterPagePresentation.ts";
import { useEncounterGridFocus } from "./useEncounterGridFocus.ts";

const EMPTY_ENCOUNTER_PARTICIPANTS: EncounterViewParticipant[] = [];
const EMPTY_CAMPAIGN_ENTITIES: CampaignEntityRecord[] = [];

interface Options {
	displayMode: "single" | "grid";
	gridColumns: number;
	view: EncounterViewModel;
}

function getEncounterViewParticipants(
	view: EncounterViewModel,
): EncounterViewParticipant[] {
	return view.encounter?.monsters || EMPTY_ENCOUNTER_PARTICIPANTS;
}

function getEncounterViewPlayerCharacters(
	view: EncounterViewModel,
): CampaignEntityRecord[] {
	return view.playerCharacters || EMPTY_CAMPAIGN_ENTITIES;
}

export function useEncounterPageDisplayProjection({
	displayMode,
	gridColumns,
	view,
}: Options) {
	const encounterParticipants = getEncounterViewParticipants(view);
	const playerCharacters = getEncounterViewPlayerCharacters(view);
	const { gridMonsters, gridRepresentativeByInstanceId } = useMemo(() => {
		const projection = getEncounterGridProjection(encounterParticipants);
		return {
			gridMonsters: projection.monsters,
			gridRepresentativeByInstanceId: projection.representativeByInstanceId,
		};
	}, [encounterParticipants]);
	const selectedGridInstanceId = getEncounterSelectedGridId(
		view.selectedInstance,
		gridRepresentativeByInstanceId,
	);
	const {
		focusTimeoutRef,
		focusedMonsterId,
		focusMonsterInGrid,
		setGridItemRef,
	} = useEncounterGridFocus(gridRepresentativeByInstanceId);
	const {
		displayMode: effectiveDisplayMode,
		gridColumns: effectiveGridColumns,
	} = getEncounterLayout(displayMode, gridColumns, gridMonsters.length);

	return {
		encounterParticipants,
		effectiveDisplayMode,
		effectiveGridColumns,
		focusMonsterInGrid,
		focusedMonsterId,
		focusTimeoutRef,
		gridMonsters,
		playerCharacters,
		selectedGridInstanceId,
		setGridItemRef,
	};
}
