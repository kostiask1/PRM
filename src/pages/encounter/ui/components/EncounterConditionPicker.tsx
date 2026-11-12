import { lang } from "../../../../shared/lib/index.js";
import { Modal } from "../../../../shared/ui/index.js";
import type { ReferenceSelection } from "../../../../widgets/rules-reference-modal/index.js";
import { EncounterRulesReferenceContent } from "./EncounterBestiary.tsx";

export default function EncounterConditionPicker({ onClose, onSelect }: {
	onClose: () => void;
	onSelect: (selection: ReferenceSelection) => void;
}) {
	return (
		<Modal title={lang.t("Rules Reference")} type="custom" showFooter={false} onConfirm={() => {}} onCancel={onClose}>
			<EncounterRulesReferenceContent initialTab="conditions" forceTab selectableTab="conditions" selectionActionLabel={lang.t("Add condition")} onSelectReference={onSelect} />
		</Modal>
	);
}
