import type { ComponentType } from "react";

import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import type {
	CardNote,
	CharacterData,
	LocationData,
} from "../../../entities/campaign/index.js";
import type { MonsterFieldEditModalProps } from "../../../features/edit-monster/index.js";

export type AiResponseModalCardId = string | number | undefined;

export interface AiResponseModalCardHighlightFields {
	fields?: readonly string[];
	notes?: Record<string, readonly string[]>;
}

export interface AiResponseModalMonsterHighlightFields {
	fields?: string[];
}

export interface AiResponseModalCharacterCardSlotProps {
	character: CharacterData;
	onChange: (
		id: AiResponseModalCardId,
		character: CharacterData,
		options?: { trackUndo?: boolean },
	) => void;
	onNameBlur?: (
		id: AiResponseModalCardId,
		character: CharacterData,
		oldName: string,
		newName: string,
	) => boolean | void | Promise<boolean | void>;
	onDelete?: (id: AiResponseModalCardId) => void;
	onReorderDrop?: (notes: CardNote[]) => void;
	campaignSlug?: string | null;
	type?: string;
	showDeleteButton?: boolean;
	highlightFields?: AiResponseModalCardHighlightFields | null;
}

export interface AiResponseModalLocationCardSlotProps {
	location: LocationData;
	onChange: (
		id: AiResponseModalCardId,
		location: LocationData,
		options?: { trackUndo?: boolean },
	) => void;
	onNameBlur?: (
		id: AiResponseModalCardId,
		location: LocationData,
		oldName: string,
		newName: string,
	) => boolean | void | Promise<boolean | void>;
	onDelete?: (id: AiResponseModalCardId) => void;
	onReorderDrop?: (notes: CardNote[]) => void;
	campaignSlug?: string | null;
	showDeleteButton?: boolean;
	highlightFields?: AiResponseModalCardHighlightFields | null;
}

export interface AiResponseModalMonsterStatBlockSlotProps {
	monster: BestiaryMonster;
	showFavoriteAction?: boolean;
	allowTokenUpload?: boolean;
	onFieldEdit?: (monster: BestiaryMonster) => void;
	searchHighlight?: string;
	highlightFields?: AiResponseModalMonsterHighlightFields | null;
}

export type AiResponseModalMonsterEditorSlotProps = Pick<
	MonsterFieldEditModalProps,
	"editingMonster" | "onCancel" | "onSave"
>;

export interface AiResponseModalCompositionSlots {
	CharacterCard: ComponentType<AiResponseModalCharacterCardSlotProps>;
	LocationCard: ComponentType<AiResponseModalLocationCardSlotProps>;
	MonsterStatBlock: ComponentType<AiResponseModalMonsterStatBlockSlotProps>;
	MonsterEditorModal: ComponentType<AiResponseModalMonsterEditorSlotProps>;
}
