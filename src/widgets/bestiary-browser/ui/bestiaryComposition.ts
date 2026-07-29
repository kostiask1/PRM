import type {
	ComponentType,
	Dispatch,
	ReactNode,
	SetStateAction,
} from "react";
import type {
	BestiaryFavorite,
	BestiaryMonster,
} from "../../../entities/bestiary/index.js";
import type { AiResponseModalComponent } from "../../../features/ai/ui/index.js";

export interface BestiaryAssistantSlotProps {
	ResponseModal: AiResponseModalComponent;
	isBestiary: boolean;
	onRegisterImagePromptAction: (
		handler: ((monster: BestiaryMonster) => void) | null,
	) => void;
}

export type BestiaryAssistantSlot =
	ComponentType<BestiaryAssistantSlotProps>;

export interface BestiaryMonsterStatBlockSlotProps {
	monster: BestiaryMonster;
	favoriteActive: boolean;
	onNameClick?: (monster: BestiaryMonster) => void;
	nameTitle?: ReactNode;
	onFavoriteChange: Dispatch<SetStateAction<BestiaryFavorite[]>>;
	showAddToEncounterPicker: boolean;
	onAddToEncounter?: (monster: BestiaryMonster) => void;
	onAiAction: (monster: BestiaryMonster) => void;
	onDelete?: (monster: BestiaryMonster) => void;
	onFieldEdit: (monster: BestiaryMonster) => void;
	searchHighlight: string;
}

export type BestiaryMonsterStatBlockSlot =
	ComponentType<BestiaryMonsterStatBlockSlotProps>;
