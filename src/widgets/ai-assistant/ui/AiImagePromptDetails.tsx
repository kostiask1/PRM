import type {
	AiAttachmentStateSetter,
	AiModelOption,
	AiUiAttachment,
} from "../../../features/ai/ui/index.js";
import {
	AiAttachmentControls,
	renderAiModelOptions,
} from "../../../features/ai/ui/index.js";
import { EditableField } from "../../../features/editor/ui/index.js";
import { lang } from "../../../shared/lib/index.js";
import { Button, Select } from "../../../shared/ui/index.js";
import type { ImagePromptTarget } from "../model/imagePromptPicker.ts";

interface AiImagePromptDetailsProps {
	attachedFiles: AiUiAttachment[];
	attachedImages: AiUiAttachment[];
	campaignSlug?: string | null;
	aiModels: AiModelOption[];
	loading: boolean;
	canGenerate: boolean;
	isContextMode: boolean;
	imagePromptRequest: string;
	imagePromptInstructions: string;
	selectedModel: string;
	selectedTarget: ImagePromptTarget | null;
	getImagePromptTargetTitle: (target: ImagePromptTarget) => string;
	onBackToSelection: () => void;
	onGenerate: (target: ImagePromptTarget | null) => void;
	onInstructionsChange: (value: string) => void;
	onModelChange: (value: string) => void;
	onRequestChange: (value: string) => void;
	setAttachedFiles: AiAttachmentStateSetter;
	setAttachedImages: AiAttachmentStateSetter;
}

function SelectedImagePromptTarget({
	selectedTarget,
	getTitle,
}: {
	selectedTarget: ImagePromptTarget | null;
	getTitle: (target: ImagePromptTarget) => string;
}) {
	return selectedTarget ? (
		<div className="AiAssistant__image_prompt_target">
			<span>{lang.t("Selected element")}</span>
			<strong>{getTitle(selectedTarget)}</strong>
		</div>
	) : (
		<div className="AiAssistant__image_prompt_target">
			<span>{lang.t("No element selected")}</span>
			<strong>
				{lang.t("The request will use current context and your instructions.")}
			</strong>
		</div>
	);
}

export default function AiImagePromptDetails({
	attachedFiles,
	attachedImages,
	campaignSlug,
	aiModels,
	loading,
	canGenerate,
	isContextMode,
	imagePromptRequest,
	imagePromptInstructions,
	selectedModel,
	selectedTarget,
	getImagePromptTargetTitle,
	onBackToSelection,
	onGenerate,
	onInstructionsChange,
	onModelChange,
	onRequestChange,
	setAttachedFiles,
	setAttachedImages,
}: AiImagePromptDetailsProps) {
	return (
		<div className="AiAssistant__image_prompt_details">
			<SelectedImagePromptTarget
				selectedTarget={selectedTarget}
				getTitle={getImagePromptTargetTitle}
			/>
			<Select
				className="AiAssistant__image_prompt_model"
				value={selectedModel}
				onChange={(event) => onModelChange(event.target.value)}
				disabled={loading || aiModels.length === 0}
			>
				{renderAiModelOptions(aiModels)}
			</Select>
			{isContextMode && (
				<label className="AiAssistant__image_prompt_field">
					<span>{lang.t("What to generate")}</span>
					<EditableField
						type="textarea"
						value={imagePromptRequest}
						onChange={(event) => onRequestChange(event.target.value)}
						placeholder={lang.t("Describe what image prompt to generate...")}
						disabled={loading}
						className="AiAssistant__image_prompt_model AiAssistant__image_prompt_instructions"
					/>
				</label>
			)}
			<label className="AiAssistant__image_prompt_field">
				<span>{lang.t("Base image prompt")}</span>
				<EditableField
					type="textarea"
					value={imagePromptInstructions}
					onChange={(event) => onInstructionsChange(event.target.value)}
					placeholder={lang.t("Optional image prompt instructions...")}
					disabled={loading}
					className="AiAssistant__image_prompt_model AiAssistant__image_prompt_instructions"
				/>
			</label>
			<AiAttachmentControls
				attachedFiles={attachedFiles}
				attachedImages={attachedImages}
				campaignSlug={campaignSlug}
				disabled={loading}
				setAttachedFiles={setAttachedFiles}
				setAttachedImages={setAttachedImages}
			/>
			<div className="AiAssistant__image_prompt_actions">
				<Button
					variant="ghost"
					icon="back"
					onClick={onBackToSelection}
					disabled={loading}
				>
					{lang.t("Back to selection")}
				</Button>
				<Button
					variant="primary"
					icon="image"
					onClick={() => onGenerate(selectedTarget)}
					disabled={!canGenerate}
				>
					{lang.t("Generate image prompt")}
				</Button>
			</div>
		</div>
	);
}
