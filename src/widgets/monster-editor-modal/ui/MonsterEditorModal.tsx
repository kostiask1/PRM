import {
	MonsterFieldEditModal,
	type MonsterFieldEditModalProps,
} from "../../../features/edit-monster/index.js";
import type {
	MonsterEditorModalComponent,
	MonsterEditorModalCompositionSlots,
	MonsterEditorModalProps,
	MonsterEditorRulesReferenceContentSlotProps,
} from "./monsterEditorModalComposition.ts";

function MonsterEditorModal(props: MonsterFieldEditModalProps) {
	return <MonsterFieldEditModal {...props} />;
}

export function createMonsterEditorModalComponent({
	RulesReferenceContent,
}: MonsterEditorModalCompositionSlots): MonsterEditorModalComponent {
	function RulesReferenceAdapter({
		onSelectReference,
	}: MonsterEditorRulesReferenceContentSlotProps) {
		return (
			<RulesReferenceContent
				onSelectReference={(selection) =>
					onSelectReference({ ...selection })
				}
			/>
		);
	}

	function ConfiguredMonsterEditorModal(props: MonsterEditorModalProps) {
		return (
			<MonsterEditorModal
				{...props}
				RulesReferenceContent={RulesReferenceAdapter}
			/>
		);
	}

	return ConfiguredMonsterEditorModal;
}
