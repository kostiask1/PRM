import { MonsterFieldEditModal } from "../../../features/edit-monster/index.js";
import { RulesReferenceModalContent } from "../../rules-reference-modal/index.js";

export default function MonsterEditorModal(props) {
	return (
		<MonsterFieldEditModal
			{...props}
			RulesReferenceContent={RulesReferenceModalContent}
		/>
	);
}
