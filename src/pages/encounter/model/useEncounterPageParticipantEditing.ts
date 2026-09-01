import { useMemo } from "react";
import type { CampaignEntityRecord } from "../../../entities/campaign/index.js";
import { lang } from "../../../shared/lib/index.js";
import type { EncounterPageMessage } from "./EncounterPageRuntime.tsx";
import type {
	EncounterViewModel,
	EncounterViewParticipant,
} from "./contracts.ts";
import { getAvailableEncounterCharacters } from "./encounterPagePresentation.ts";
import { useEncounterCharacterModal } from "./useEncounterCharacterModal.ts";
import { useEncounterHpEditing } from "./useEncounterHpEditing.ts";
import { useEncounterPlayerCreation } from "./useEncounterPlayerCreation.ts";

interface Options {
	campaignSlug: string;
	encounterParticipants: EncounterViewParticipant[];
	getParticipantInstanceId(participant: EncounterViewParticipant): string;
	playerCharacters: CampaignEntityRecord[];
	refreshEntities(): void;
	showMessage(message: EncounterPageMessage): void;
	view: EncounterViewModel;
}

export function useEncounterPageParticipantEditing(options: Options) {
	const availablePlayerCharacters = useMemo(
		() => getAvailableEncounterCharacters(
			options.encounterParticipants,
			options.playerCharacters,
		),
		[options.encounterParticipants, options.playerCharacters],
	);
	const playerCreation = useEncounterPlayerCreation({
		campaignSlug: options.campaignSlug,
		onAdd: options.view.handleAddCharacter,
		onClosePicker: () => options.view.setShowCharacterPicker(false),
		refreshEntities: options.refreshEntities,
		showMessage: options.showMessage,
		messages: {
			errorTitle: lang.t("Error"),
			missingName: lang.t("Name is required to create an entry."),
			failedCreation: lang.t("Failed to create entity."),
		},
	});
	const hpEditing = useEncounterHpEditing({
		getInstanceId: options.getParticipantInstanceId,
		onUpdate: options.view.updateMonsterHp,
	});
	const characterModal = useEncounterCharacterModal({
		onUpdate: options.view.updateEncounterCharacter,
	});

	return {
		availablePlayerCharacters,
		characterModal,
		hpEditing,
		playerCreation,
	};
}
