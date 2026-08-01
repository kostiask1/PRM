import { getMonsterAiEditPresentation } from "../../../../features/ai-edit-monster/index.js";
import {
	AiAttachmentControls,
	renderAiModelOptions,
} from "../../../../features/ai/ui/index.js";
import { EditableField } from "../../../../features/editor/ui/index.js";
import { lang } from "../../../../shared/lib/index.js";
import { Button, Modal, Select } from "../../../../shared/ui/index.js";
import type { BestiaryAiModalsSlotProps } from "../../../../widgets/bestiary-browser/index.js";

type MonsterAiEditModalProps = Pick<
	BestiaryAiModalsSlotProps,
	| "aiEditAttachedFiles"
	| "aiEditAttachedImages"
	| "aiEditingMonster"
	| "aiEditError"
	| "aiEditInstructions"
	| "aiEditMode"
	| "aiModels"
	| "isAiEditingMonster"
	| "onCancelEdit"
	| "onCancelEditRequest"
	| "onInstructionsChange"
	| "onModelChange"
	| "onSaveEdit"
	| "selectedAiModel"
	| "setAiEditAttachedFiles"
	| "setAiEditAttachedImages"
>;

export default function MonsterAiEditModal({
	aiEditAttachedFiles,
	aiEditAttachedImages,
	aiEditingMonster,
	aiEditError,
	aiEditInstructions,
	aiEditMode,
	aiModels,
	isAiEditingMonster,
	onCancelEdit,
	onCancelEditRequest,
	onInstructionsChange,
	onModelChange,
	onSaveEdit,
	selectedAiModel,
	setAiEditAttachedFiles,
	setAiEditAttachedImages,
}: MonsterAiEditModalProps) {
	if (!aiEditingMonster) return null;

	const presentation = getMonsterAiEditPresentation(aiEditMode, lang.t);

	return (
		<Modal
			title={presentation.title}
			onConfirm={() => {}}
			onCancel={onCancelEdit}
			showFooter={false}
			className="Bestiary__ai_edit_modal"
			cancelDisabled={isAiEditingMonster}
		>
			<div className="Bestiary__edit_form">
				<div className="Bestiary__ai_edit_target">
					<span className="Bestiary__ai_edit_target_label">
						{presentation.targetLabel}:
					</span>{" "}
					{aiEditingMonster.name}
				</div>
				<Select
					className="Bestiary__ai_edit_model"
					value={selectedAiModel}
					onChange={(event) => onModelChange(event.target.value)}
					disabled={isAiEditingMonster || aiModels.length === 0}
				>
					{renderAiModelOptions(aiModels)}
				</Select>
				<EditableField
					type="textarea"
					value={aiEditInstructions}
					onChange={(event) => onInstructionsChange(event.target.value)}
					disabled={isAiEditingMonster}
					placeholder={presentation.placeholder}
					className="Bestiary__ai_edit_prompt"
				/>
				<AiAttachmentControls
					attachedFiles={aiEditAttachedFiles}
					attachedImages={aiEditAttachedImages}
					campaignSlug="general"
					disabled={isAiEditingMonster}
					setAttachedFiles={setAiEditAttachedFiles}
					setAttachedImages={setAiEditAttachedImages}
				/>
				{aiEditError && (
					<div className="Bestiary__edit_error">{aiEditError}</div>
				)}
				<div className="Bestiary__edit_actions">
					<Button
						variant="ghost"
						onClick={
							isAiEditingMonster ? onCancelEditRequest : onCancelEdit
						}
					>
						{lang.t("Cancel")}
					</Button>
					<Button
						variant="primary"
						icon="wand"
						onClick={onSaveEdit}
						disabled={isAiEditingMonster}
					>
						{isAiEditingMonster
							? lang.t("AI is working, please wait...")
							: presentation.submitLabel}
					</Button>
				</div>
			</div>
		</Modal>
	);
}
