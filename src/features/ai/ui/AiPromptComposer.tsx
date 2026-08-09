import { lang } from "../../../shared/lib/index.js";
import { Button } from "../../../shared/ui/index.js";
import { getAiPromptTokenVisibility } from "./presentationModel.ts";
import type {
	AiPromptComposerComponent,
	AiPromptComposerCompositionSlots,
	AiPromptComposerProps,
} from "./aiPromptComposition.ts";

type AiPromptComposerInternalProps = AiPromptComposerProps &
	AiPromptComposerCompositionSlots;

function AiPromptComposer({
	attachedFiles,
	attachedImages,
	campaignSlug,
	canCancel,
	formattedFileTokenEstimate,
	formattedImageTokenEstimate,
	formattedTextTokenEstimate,
	formattedTokenEstimate,
	isLoading,
	onCancel,
	onGenerate,
	onInstructionsChange,
	placeholder,
	setAttachedFiles,
	setAttachedImages,
	tokenEstimate,
	userInstructions,
	AiAttachmentControls,
	EditableField,
}: AiPromptComposerInternalProps) {
	const { showFileTokens, showImageTokens } =
		getAiPromptTokenVisibility(tokenEstimate);

	return (
		<div className="AiAssistant__prompt_area">
			<div className="AiAssistant__prompt_row">
				<div className="AiAssistant__prompt_column">
					<EditableField
						type="textarea"
						className="AiAssistant__prompt_input"
						placeholder={placeholder}
						value={userInstructions}
						onChange={(event) =>
							onInstructionsChange(event.target.value)
						}
						disabled={isLoading}
					/>
					<div
						className="AiAssistant__token_estimate"
						title={lang.t(
							"Approximate estimate. Actual token usage may differ.",
						)}
					>
						<span>
							{lang.t("Estimated request")}: {" "}
							<strong>{formattedTokenEstimate}</strong> {lang.t("tokens")}
						</span>
						<span>
							{lang.t("Text")}: {formattedTextTokenEstimate}
							{showImageTokens
								? `; ${lang.t("Images")}: ${formattedImageTokenEstimate}`
								: ""}
							{showFileTokens
								? `; ${lang.t("Files")}: ${formattedFileTokenEstimate}`
								: ""}
						</span>
					</div>
					<Button
						variant="create"
						className="AiAssistant__generate_btn"
						disabled={isLoading}
						onClick={onGenerate}
					>
						{isLoading
							? lang.t("AI is working, please wait...")
							: lang.t("Generate")}
					</Button>
					{canCancel && (
						<Button
							variant="danger"
							className="AiAssistant__cancel_btn"
							onClick={onCancel}
						>
							{lang.t("Cancel")}
						</Button>
					)}
				</div>
				<AiAttachmentControls
					attachedFiles={attachedFiles}
					attachedImages={attachedImages}
					campaignSlug={campaignSlug}
					disabled={isLoading}
					setAttachedFiles={setAttachedFiles}
					setAttachedImages={setAttachedImages}
				/>
			</div>
		</div>
	);
}

export function createAiPromptComposerComponent({
	AiAttachmentControls,
	EditableField,
}: AiPromptComposerCompositionSlots): AiPromptComposerComponent {
	function ConfiguredAiPromptComposer(props: AiPromptComposerProps) {
		return (
			<AiPromptComposer
				{...props}
				AiAttachmentControls={AiAttachmentControls}
				EditableField={EditableField}
			/>
		);
	}

	return ConfiguredAiPromptComposer;
}
