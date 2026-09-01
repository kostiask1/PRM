import { useState } from "react";
import type { CharacterData } from "../../../entities/campaign/index.js";
import type { EncounterViewParticipant } from "./contracts.ts";

interface Options {
	onUpdate(instanceId: string, character: CharacterData): void;
}

export function useEncounterCharacterModal({ onUpdate }: Options) {
	const [value, setValue] = useState<EncounterViewParticipant | null>(null);
	const open = (character: EncounterViewParticipant) => setValue(character);
	const close = () => setValue(null);
	const getOnChange = (instanceId: string) => (
		_characterId: string | number | undefined,
		nextCharacter: CharacterData,
	) => {
		onUpdate(instanceId, nextCharacter);
		setValue((current) => current?.instanceId === instanceId
			? { ...current, ...nextCharacter, participantType: "character", instanceId }
			: current);
	};
	return { value, open, close, getOnChange };
}
