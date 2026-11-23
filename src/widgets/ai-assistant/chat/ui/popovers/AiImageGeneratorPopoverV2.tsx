import { useRef } from "react";
import { lang } from "../../../../../shared/lib/index.js";
import type { AiModelOption } from "../../model/aiChatTypes.ts";
import { useDismissablePopover } from "./useDismissablePopover.ts";

interface AiImageGeneratorPopoverV2Props {
	isOpen: boolean;
	prompt: string;
	imageModels: readonly AiModelOption[];
	selectedImageModel: string;
	isSending?: boolean;
	onPromptChange: (value: string) => void;
	onSelectImageModel: (modelId: string) => void;
	onComposePrompt: () => void;
	onGenerateImage: () => void;
	onClose: () => void;
}

export default function AiImageGeneratorPopoverV2({
	isOpen,
	prompt,
	imageModels,
	selectedImageModel,
	isSending = false,
	onPromptChange,
	onSelectImageModel,
	onComposePrompt,
	onGenerateImage,
	onClose,
}: AiImageGeneratorPopoverV2Props) {
	const ref = useRef<HTMLDivElement>(null);

	useDismissablePopover({
		isOpen,
		popoverRef: ref,
		triggerSelector: ".AiChatComposerV2__imageBtn",
		onClose,
	});

	if (!isOpen) return null;

	const hasImageModel = imageModels.length > 0 && Boolean(selectedImageModel);
	const canGenerate = Boolean(prompt.trim()) && hasImageModel && !isSending;

	return (
		<div className="AiAssistantPopoverV2 AiImageGeneratorPopoverV2" ref={ref}>
			<div className="AiImageGeneratorPopoverV2__header">
				<span className="AiImageGeneratorPopoverV2__title">{lang.t("Images & prompts")}</span>
				<button
					type="button"
					className="AiImageGeneratorPopoverV2__closeBtn"
					onClick={onClose}
					aria-label={lang.t("Close image window")}
				>
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<div className="AiImageGeneratorPopoverV2__body">
				<label className="AiImageGeneratorPopoverV2__field">
					<span>{lang.t("Image description or prompt")}</span>
					<textarea
						rows={4}
						className="AiImageGeneratorPopoverV2__textarea"
						placeholder={lang.t("Describe an NPC portrait, scene, or creature (you can use [Name])...")}
						value={prompt}
						onChange={(e) => onPromptChange(e.target.value)}
						disabled={isSending}
					/>
				</label>

				<label className="AiImageGeneratorPopoverV2__field">
					<span>{lang.t("Image generation model")}</span>
					{imageModels.length > 0 ? (
						<select
							className="AiImageGeneratorPopoverV2__select"
							value={selectedImageModel}
							onChange={(e) => onSelectImageModel(e.target.value)}
							disabled={isSending}
						>
							{imageModels.map((model) => (
								<option key={model.id} value={model.id}>
									{model.name}
								</option>
							))}
						</select>
					) : (
						<div className="AiImageGeneratorPopoverV2__noModels">
							{lang.t("No available image models were found. You can still compose a prompt with @image.")}
						</div>
					)}
				</label>
			</div>

			<div className="AiImageGeneratorPopoverV2__footer">
				<button
					type="button"
					className="AiImageGeneratorPopoverV2__btn AiImageGeneratorPopoverV2__btn--ghost"
					onClick={onComposePrompt}
					disabled={isSending}
					title={lang.t("Compose or refine a detailed prompt in chat")}
				>
					{lang.t("Compose prompt (@image)")}
				</button>
				<button
					type="button"
					className="AiImageGeneratorPopoverV2__btn AiImageGeneratorPopoverV2__btn--primary"
					onClick={onGenerateImage}
					disabled={!canGenerate}
				>
					{lang.t("Generate")}
				</button>
			</div>
		</div>
	);
}
