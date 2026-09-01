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
	extends Omit<
		BestiaryAiModalsSlotProps,
		| "onApplyDraft"
		| "onApplyDraftResource"
		| "onUndoDraft"
		| "onUndoDraftResource"
	> {
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
	onRestoreAiDraftResponse: (
		entry: Parameters<BestiaryAiModalsSlotProps["onApplyDraft"]>[0],
		mode: "apply" | "undo",
		options?: { resourceIds?: string[] },
	) => void | Promise<void>;
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
	onRestoreAiDraftResponse,
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
			<BestiaryAiModals
				{...aiModalsProps}
				onApplyDraft={(entry) => onRestoreAiDraftResponse(entry, "apply")}
				onApplyDraftResource={(entry, resourceIds) =>
					onRestoreAiDraftResponse(entry, "apply", { resourceIds })
				}
				onUndoDraft={(entry) => onRestoreAiDraftResponse(entry, "undo")}
				onUndoDraftResource={(entry, resourceIds) =>
					onRestoreAiDraftResponse(entry, "undo", { resourceIds })
				}
			/>
		</>
	);
}
