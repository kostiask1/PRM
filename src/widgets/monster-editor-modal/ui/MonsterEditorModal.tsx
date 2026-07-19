import {
	MonsterFieldEditModal,
	type MonsterFieldEditModalProps,
	type RuleReferenceSelection,
} from "../../../features/edit-monster/index.js";
import { RulesReferenceModalContent } from "../../rules-reference-modal/index.js";

export type MonsterEditorModalProps = Omit<
	MonsterFieldEditModalProps,
	"RulesReferenceContent"
>;

interface RulesReferenceAdapterProps {
	onSelectReference: (selection: RuleReferenceSelection) => void;
}

function RulesReferenceAdapter({
	onSelectReference,
}: RulesReferenceAdapterProps) {
	return (
		<RulesReferenceModalContent
			onSelectReference={(selection) => onSelectReference({ ...selection })}
		/>
	);
}

export default function MonsterEditorModal(props: MonsterEditorModalProps) {
	return (
		<MonsterFieldEditModal
			{...props}
			RulesReferenceContent={RulesReferenceAdapter}
		/>
	);
}
