import {
	executeEncounterParticipantSelection,
	getEncounterParticipantSelectionPlan,
} from "./encounterPagePresentation.ts";
import type { EncounterViewParticipant } from "./contracts.ts";

interface Options {
	selectedInstanceId: string | undefined;
	displayMode: "grid" | "single";
	onOpenCharacter(character: EncounterViewParticipant): void;
	onSelect(participant: EncounterViewParticipant): void;
	onFocus(instanceId: string): void;
	onTokenImageUpdate(instanceId: string, imageUrl: string | null): void;
}

export function useEncounterMonsterInteractions(options: Options) {
	const select = (monster: EncounterViewParticipant) => {
		executeEncounterParticipantSelection(
			getEncounterParticipantSelectionPlan(
				monster,
				options.selectedInstanceId,
				options.displayMode,
			),
			{
				onOpenCharacter: options.onOpenCharacter,
				onSelect: options.onSelect,
				onFocus: options.onFocus,
			},
		);
	};

	const updateTokenImage = (
		monster: EncounterViewParticipant,
		imageUrl: string | null,
	) => {
		if (!monster?.instanceId) return;
		options.onTokenImageUpdate(monster.instanceId, imageUrl);
	};

	return { select, updateTokenImage };
}
