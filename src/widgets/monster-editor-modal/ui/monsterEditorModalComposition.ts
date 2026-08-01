import type { ComponentType, ReactNode } from "react";

import type { MonsterFieldEditModalProps } from "../../../features/edit-monster/index.js";

export type MonsterEditorModalProps = Omit<
	MonsterFieldEditModalProps,
	"RulesReferenceContent"
>;

export type MonsterEditorModalComponent = ComponentType<MonsterEditorModalProps>;

export interface MonsterEditorRulesReferenceContentSlotProps {
	onSelectReference: (selection: { tag: string }) => void;
}

export interface MonsterEditorModalCompositionSlots {
	RulesReferenceContent: (
		props: MonsterEditorRulesReferenceContentSlotProps,
	) => ReactNode;
}
