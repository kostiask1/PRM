import { Modal } from "../../modal/index.js";
import { Button } from "../../../shared/ui/index.js";
import { lang } from "../../../shared/lib/index.js";

export default function MonsterAiActionModal({
	aiActionMonster,
	showLocalEdit = false,
	showGlobalEdit = true,
	showImagePromptAction = false,
	targetLabel = null,
	title = lang.t("AI creature action"),
	actionIcon = "wand",
	onCancel,
	onChoose,
}) {
	if (!aiActionMonster) return null;

	return (
		<Modal
			title={title}
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
							icon={actionIcon}
							onClick={() => onChoose("local-edit")}
						>
							{lang.t("Edit only in this encounter")}
						</Button>
					)}
					{showGlobalEdit && (
						<Button
							variant={showLocalEdit ? "ghost" : "primary"}
							icon={actionIcon}
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
					{showImagePromptAction && (
						<Button
							variant="ghost"
							icon="image"
							onClick={() => onChoose("image-prompt")}
						>
							{lang.t("Generate image prompt")}
						</Button>
					)}
				</div>
			</div>
		</Modal>
	);
}
