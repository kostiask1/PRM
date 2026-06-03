import Modal from "../common/Modal";
import Button from "../form/Button";
import Input from "../form/Input";
import Select from "../form/Select";
import { lang } from "../../services/localization";

export default function MonsterAiEditModal({
	aiEditingMonster,
	aiEditError,
	aiEditInstructions,
	aiEditMode,
	aiModels,
	isAiEditingMonster,
	onCancel,
	onCancelRequest,
	onInstructionsChange,
	onModelChange,
	onSave,
	selectedAiModel,
}) {
	if (!aiEditingMonster) return null;

	const isCreateBased = aiEditMode === "create-based";
	const isLocalEdit = aiEditMode === "local-edit";

	return (
		<Modal
			title={
				isLocalEdit
					? lang.t("AI edit encounter creature")
					: isCreateBased
						? lang.t("Create custom creature based on this")
						: lang.t("AI edit custom creature")
			}
			onCancel={onCancel}
			showFooter={false}
			className="Bestiary__ai_edit_modal"
			cancelDisabled={isAiEditingMonster}
		>
			<div className="Bestiary__edit_form">
				<div className="Bestiary__ai_edit_target">
					<span className="Bestiary__ai_edit_target_label">
						{isLocalEdit
							? lang.t("Encounter creature")
							: isCreateBased
								? lang.t("Source creature")
								: lang.t("Custom creature")}
						:
					</span>{" "}
					{aiEditingMonster.name}
				</div>
				<Select
					className="Bestiary__ai_edit_model"
					value={selectedAiModel}
					onChange={(event) => onModelChange(event.target.value)}
					disabled={isAiEditingMonster || aiModels.length === 0}
				>
					{aiModels.length > 0 ? (
						aiModels.map((model) => (
							<option key={model.name} value={model.name}>
								{model.displayName || model.name}
							</option>
						))
					) : (
						<option value="">{lang.t("Loading models...")}</option>
					)}
				</Select>
				<Input
					type="textarea"
					value={aiEditInstructions}
					onChange={(event) => onInstructionsChange(event.target.value)}
					disabled={isAiEditingMonster}
					placeholder={
						isCreateBased
							? lang.t(
									"Describe what to create, or leave empty to let AI decide.",
								)
							: isLocalEdit
								? lang.t("Describe what to change for this encounter only.")
								: lang.t("Describe what to change.")
					}
					className="Bestiary__ai_edit_prompt"
				/>
				{aiEditError && (
					<div className="Bestiary__edit_error">{aiEditError}</div>
				)}
				<div className="Bestiary__edit_actions">
					<Button
						variant="ghost"
						onClick={isAiEditingMonster ? onCancelRequest : onCancel}
					>
						{lang.t("Cancel")}
					</Button>
					<Button
						variant="primary"
						icon="wand"
						onClick={onSave}
						disabled={isAiEditingMonster}
					>
						{isAiEditingMonster
							? lang.t("AI is working, please wait...")
							: isCreateBased
								? lang.t("Create custom creature")
								: isLocalEdit
									? lang.t("Apply local AI edit")
									: lang.t("Apply AI edit")}
					</Button>
				</div>
			</div>
		</Modal>
	);
}
