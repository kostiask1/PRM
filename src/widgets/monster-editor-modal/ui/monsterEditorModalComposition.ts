import type { ComponentType, ReactNode } from "react";

import type {
	MonsterFieldEditModalProps,
	MonsterParserReferenceContentProps,
} from "../../../features/edit-monster/index.js";

export type MonsterEditorModalProps = Omit<
	MonsterFieldEditModalProps,
	"RulesReferenceContent"
>;

export type MonsterEditorModalComponent = ComponentType<MonsterEditorModalProps>;

export type MonsterEditorRulesReferenceContentSlotProps =
	MonsterParserReferenceContentProps;

export interface MonsterEditorModalCompositionSlots {
	RulesReferenceContent: (
		props: MonsterEditorRulesReferenceContentSlotProps,
	) => ReactNode;
}
