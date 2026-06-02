import Modal from "../common/Modal";
import Button from "../form/Button";
import { lang } from "../../services/localization";

export default function MonsterAiActionModal({
	aiActionMonster,
	showLocalEdit = false,
	showGlobalEdit = true,
	targetLabel = null,
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
						{targetLabel || lang.t("Custom creature")}:
					</span>{" "}
					{aiActionMonster.name}
				</div>
				<div className="Bestiary__ai_action_buttons">
					{showLocalEdit && (
						<Button
							variant="primary"
							icon="wand"
							onClick={() => onChoose("local-edit")}
						>
							{lang.t("Edit only in this encounter")}
						</Button>
					)}
					{showGlobalEdit && (
						<Button
							variant={showLocalEdit ? "ghost" : "primary"}
							icon="wand"
							onClick={() => onChoose("edit")}
						>
							{lang.t("Edit this creature")}
						</Button>
					)}
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
