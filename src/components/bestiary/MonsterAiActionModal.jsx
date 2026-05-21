import Modal from "../common/Modal";
import Button from "../form/Button";
import { lang } from "../../services/localization";

export default function MonsterAiActionModal({
	aiActionMonster,
	onCancel,
	onChoose,
}) {
	if (!aiActionMonster) return null;

	return (
		<Modal
			title={lang.t("AI creature action")}
			onCancel={onCancel}
			showFooter={false}
			className="Bestiary__ai_action_modal"
		>
			<div className="Bestiary__ai_action_body">
				<div className="Bestiary__ai_edit_target">
					<span className="Bestiary__ai_edit_target_label">
						{lang.t("Custom creature")}:
					</span>{" "}
					{aiActionMonster.name}
				</div>
				<div className="Bestiary__ai_action_buttons">
					<Button variant="primary" icon="wand" onClick={() => onChoose("edit")}>
						{lang.t("Edit this creature")}
					</Button>
					<Button
						variant="ghost"
						icon="plus"
						onClick={() => onChoose("create-based")}
					>
						{lang.t("Create new custom creature based on this")}
					</Button>
				</div>
			</div>
		</Modal>
	);
}
