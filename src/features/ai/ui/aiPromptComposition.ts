import type { ReactElement } from "react";

import type { AiTokenEstimate } from "../model/tokenEstimation.ts";
import type { AiAttachmentControlsComponent } from "./aiAttachmentComposition.ts";
import type { AiAttachmentStateSetter, AiUiAttachment } from "./types.ts";

export interface AiPromptComposerProps {
	attachedFiles: AiUiAttachment[];
	attachedImages: AiUiAttachment[];
	campaignSlug?: string | null;
	canCancel: boolean;
	formattedFileTokenEstimate: string;
	formattedImageTokenEstimate: string;
	formattedTextTokenEstimate: string;
	formattedTokenEstimate: string;
	isLoading: boolean;
	onCancel: () => void;
	onGenerate: () => void;
	onInstructionsChange: (value: string) => void;
	placeholder?: string;
	setAttachedFiles: AiAttachmentStateSetter;
	setAttachedImages: AiAttachmentStateSetter;
	tokenEstimate: AiTokenEstimate;
	userInstructions: string;
}

export interface AiPromptComposerEditableFieldChangeEvent {
	target: { value: string };
}

export interface AiPromptComposerEditableFieldSlotProps {
	type: "textarea";
	className: string;
	placeholder?: string;
	value: string;
	onChange: (event: AiPromptComposerEditableFieldChangeEvent) => void;
	disabled: boolean;
}

export type AiPromptComposerEditableFieldSlot = (
	props: AiPromptComposerEditableFieldSlotProps,
) => ReactElement | null;

export interface AiPromptComposerCompositionSlots {
	AiAttachmentControls: AiAttachmentControlsComponent;
	EditableField: AiPromptComposerEditableFieldSlot;
}

export type AiPromptComposerComponent = (
	props: AiPromptComposerProps,
) => ReactElement | null;
