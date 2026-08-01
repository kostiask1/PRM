import type { ComponentType, ReactNode } from "react";

import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import type { SpellRecord } from "../../../entities/spell/index.js";
import type { RichContentRenderOptions } from "../../../features/rich-content/index.js";
import type {
	ReferenceSelection,
	ReferenceTabId,
} from "../model.js";

export interface RulesReferenceModalContentProps {
	initialTab?: ReferenceTabId;
	initialName?: string;
	forceTab?: boolean;
	onSelectReference?: ((selection: ReferenceSelection) => void) | null;
}

export type RulesReferenceModalContentComponent =
	(props: RulesReferenceModalContentProps) => ReactNode;

export interface RulesReferenceMonsterStatBlockSlotProps {
	monster: BestiaryMonster;
	allowTokenUpload?: boolean;
	showFavoriteAction?: boolean;
	searchHighlight?: string;
}

export interface RulesReferenceSpellsBrowserSlotProps {
	hideSearchInput?: boolean;
	initialSearch?: string;
	initialDetailedSearch?: boolean;
	initialSelectedName?: string;
	onActiveSpellChange?: ((spell: SpellRecord) => void) | null;
	onSelectSpell?: ((spell: SpellRecord) => void) | null;
	renderOptions?: RichContentRenderOptions;
}

export interface RulesReferenceModalCompositionSlots {
	MonsterStatBlock: ComponentType<RulesReferenceMonsterStatBlockSlotProps>;
	SpellsBrowser: ComponentType<RulesReferenceSpellsBrowserSlotProps>;
}

export type RulesReferenceModalHostProps = RulesReferenceModalCompositionSlots;
