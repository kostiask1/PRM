import type {
	AiAttachmentStateSetter,
	AiModelOption,
	AiUiAttachment,
} from "../../../features/ai/ui/index.js";
import { renderAiModelOptions } from "../../../features/ai/ui/index.js";
import { EditableField } from "../../../features/editor/ui/index.js";
import { lang } from "../../../shared/lib/index.js";
import { Button, Select } from "../../../shared/ui/index.js";
import type { ImagePromptTarget } from "../model/imagePromptPicker.ts";
import { AiAssistantAttachmentControls } from "./aiAssistantUiComposition.ts";

interface AiImagePromptDetailsProps {
	attachedFiles: AiUiAttachment[];
	attachedImages: AiUiAttachment[];
	campaignSlug?: string | null;
	aiModels: AiModelOption[];
	imageModels: AiModelOption[];
	imageMode: boolean;
	imageModel: string;
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
	onGenerateImage: (target: ImagePromptTarget | null, modelName: string) => void;
	onImageModeChange: (value: boolean) => void;
	onImageModelChange: (value: string) => void;
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
		<div className="AiAssistantPanel__image_prompt_target">
			<span>{lang.t("Selected element")}</span>
			<strong>{getTitle(selectedTarget)}</strong>
		</div>
	) : (
		<div className="AiAssistantPanel__image_prompt_target">
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
	imageModels,
	imageMode,
	imageModel,
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
	onGenerateImage,
	onImageModeChange,
	onImageModelChange,
	onInstructionsChange,
	onModelChange,
	onRequestChange,
	setAttachedFiles,
	setAttachedImages,
}: AiImagePromptDetailsProps) {
	return (
		<div className="AiAssistantPanel__image_prompt_details">
			<p className="AiAssistantPanel__image_prompt_explanation">{imageMode ? "Gemini згенерує зображення й збереже його в історії ШІ." : lang.t("This creates text for an image generator.")}</p>
			<div className="AiAssistantPanel__image_prompt_actions" role="group" aria-label="Результат генерації">
				<Button variant={imageMode ? "ghost" : "primary"} onClick={() => onImageModeChange(false)} disabled={loading}>Текстовий промпт</Button>
				<Button variant={imageMode ? "primary" : "ghost"} onClick={() => onImageModeChange(true)} disabled={loading}>Зображення</Button>
			</div>
			<SelectedImagePromptTarget
				selectedTarget={selectedTarget}
				getTitle={getImagePromptTargetTitle}
			/>
			<Select
				className="AiAssistantPanel__image_prompt_model"
				aria-label={lang.t("AI model")}
				value={imageMode ? imageModel : selectedModel}
				onChange={(event) => imageMode ? onImageModelChange(event.target.value) : onModelChange(event.target.value)}
				disabled={loading || (imageMode ? imageModels.length === 0 : aiModels.length === 0)}
			>
				{renderAiModelOptions(imageMode ? imageModels : aiModels)}
			</Select>
			{isContextMode && (
				<label className="AiAssistantPanel__image_prompt_field">
					<span>{lang.t("What to generate")}</span>
					<EditableField
						type="textarea"
						aria-label={lang.t("What to generate")}
						value={imagePromptRequest}
						onChange={(event) => onRequestChange(event.target.value)}
						placeholder={lang.t("Describe what image prompt to generate...")}
						disabled={loading}
						className="AiAssistantPanel__image_prompt_model AiAssistantPanel__image_prompt_instructions"
					/>
				</label>
			)}
			<label className="AiAssistantPanel__image_prompt_field">
				<span>{lang.t("Base image prompt")}</span>
				<EditableField
					type="textarea"
					aria-label={lang.t("Base image prompt")}
					value={imagePromptInstructions}
					onChange={(event) => onInstructionsChange(event.target.value)}
					placeholder={lang.t("Optional image prompt instructions...")}
					disabled={loading}
					className="AiAssistantPanel__image_prompt_model AiAssistantPanel__image_prompt_instructions"
				/>
			</label>
			<AiAssistantAttachmentControls
				attachedFiles={attachedFiles}
				attachedImages={attachedImages}
				campaignSlug={campaignSlug}
				disabled={loading}
				setAttachedFiles={setAttachedFiles}
				setAttachedImages={setAttachedImages}
			/>
			<div className="AiAssistantPanel__image_prompt_actions">
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
					onClick={() => imageMode ? onGenerateImage(selectedTarget, imageModel) : onGenerate(selectedTarget)}
					disabled={!canGenerate || (imageMode ? !imageModel : !selectedModel)}
				>
					{imageMode ? "Згенерувати зображення" : lang.t("Generate image prompt")}
				</Button>
			</div>
		</div>
	);
}
