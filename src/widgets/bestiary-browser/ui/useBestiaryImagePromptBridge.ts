import { useRef } from "react";
import type { BestiaryMonster } from "../../../entities/bestiary/index.js";

export function useBestiaryImagePromptBridge() {
	const openImagePromptForMonsterRef = useRef<
		((monster: BestiaryMonster) => void) | null
	>(null);

	return {
		onOpenImagePrompt: (monster: BestiaryMonster) => {
			openImagePromptForMonsterRef.current?.(monster);
		},
		onRegisterImagePromptAction: (
			handler: ((monster: BestiaryMonster) => void) | null,
		) => {
			openImagePromptForMonsterRef.current = handler;
		},
	};
}
