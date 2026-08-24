import type { ComponentType } from "react";
import type { MonsterFieldEditModalProps } from "../../../features/edit-monster/index.js";
import {
	MonsterAiActionModal,
	type MonsterAiActionModalProps,
} from "../../../features/ai-edit-monster/index.js";
import { isCustomSource } from "../model.js";
import type {
	BestiaryAiModalsSlot,
	BestiaryAiModalsSlotProps,
} from "./bestiaryComposition.ts";

export interface BestiaryBrowserModalsProps
	extends BestiaryAiModalsSlotProps {
	BestiaryAiModals: BestiaryAiModalsSlot;
	MonsterEditorModal: ComponentType<
		Pick<
			MonsterFieldEditModalProps,
			"editingMonster" | "onCancel" | "onSave"
		>
	>;
	aiActionMonster: MonsterAiActionModalProps["aiActionMonster"];
	fieldEditingMonster: MonsterFieldEditModalProps["editingMonster"];
	onCancelEditCustomMonster: MonsterFieldEditModalProps["onCancel"];
	onCancelMonsterAiAction: MonsterAiActionModalProps["onCancel"];
	onChooseMonsterAiAction: MonsterAiActionModalProps["onChoose"];
	onSaveEditedCustomMonster: MonsterFieldEditModalProps["onSave"];
}

export function BestiaryBrowserModals({
	BestiaryAiModals,
	MonsterEditorModal,
	aiActionMonster,
	fieldEditingMonster,
	onCancelEditCustomMonster,
	onCancelMonsterAiAction,
	onChooseMonsterAiAction,
	onSaveEditedCustomMonster,
	...aiModalsProps
}: BestiaryBrowserModalsProps) {
	return (
		<>
			<MonsterEditorModal
				editingMonster={fieldEditingMonster}
				onCancel={onCancelEditCustomMonster}
				onSave={onSaveEditedCustomMonster}
			/>
			<MonsterAiActionModal
				aiActionMonster={aiActionMonster}
				onCancel={onCancelMonsterAiAction}
				onChoose={onChooseMonsterAiAction}
				showGlobalEdit={isCustomSource(aiActionMonster?.source)}
				showImagePromptAction
			/>
			<BestiaryAiModals {...aiModalsProps} />
		</>
	);
}
