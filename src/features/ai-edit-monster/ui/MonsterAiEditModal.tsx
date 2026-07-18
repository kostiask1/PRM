import type { Dispatch, SetStateAction } from "react";

import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import { lang } from "../../../shared/lib/index.js";
import { Button, Select } from "../../../shared/ui/index.js";
import type { AiModelDescriptor } from "../../ai/api/aiApi.ts";
import {
	AiAttachmentControls,
	renderAiModelOptions,
	type AiUiAttachment,
} from "../../ai/ui/index.js";
import { EditableField } from "../../editor/ui/index.js";
import { Modal } from "../../modal/index.js";
import {
	getMonsterAiEditPresentation,
	type MonsterAiEditMode,
} from "../model.ts";

export interface MonsterAiEditModalProps {
	attachedFiles?: AiUiAttachment[];
	attachedImages?: AiUiAttachment[];
	aiEditingMonster?: BestiaryMonster | null;
	aiEditError?: string | null;
	aiEditInstructions: string;
	aiEditMode: MonsterAiEditMode;
	aiModels: AiModelDescriptor[];
	isAiEditingMonster: boolean;
	onCancel: () => void;
	onCancelRequest: () => void;
	onInstructionsChange: (value: string) => void;
	onModelChange: (value: string) => void;
	onSave: () => void;
	selectedAiModel: string;
	setAttachedFiles?: Dispatch<SetStateAction<AiUiAttachment[]>>;
	setAttachedImages?: Dispatch<SetStateAction<AiUiAttachment[]>>;
}

export default function MonsterAiEditModal({
	attachedFiles,
	attachedImages,
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
	setAttachedFiles,
	setAttachedImages,
}: MonsterAiEditModalProps) {
	if (!aiEditingMonster) return null;

	const presentation = getMonsterAiEditPresentation(aiEditMode, lang.t);

	return (
		<Modal
			title={presentation.title}
			onConfirm={() => {}}
			onCancel={onCancel}
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
					attachedFiles={attachedFiles}
					attachedImages={attachedImages}
					campaignSlug="general"
					disabled={isAiEditingMonster}
					setAttachedFiles={setAttachedFiles}
					setAttachedImages={setAttachedImages}
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
							: presentation.submitLabel}
					</Button>
				</div>
			</div>
		</Modal>
	);
}
