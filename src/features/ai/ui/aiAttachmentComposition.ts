import type { ReactElement, RefObject } from "react";

import type { AiAttachmentStateSetter, AiUiAttachment } from "./types.ts";

export interface AiAttachmentControlsProps {
	attachedFiles?: AiUiAttachment[];
	attachedImages?: AiUiAttachment[];
	campaignSlug?: string | null;
	disabled?: boolean;
	fileInputRef?: RefObject<HTMLInputElement>;
	setAttachedFiles?: AiAttachmentStateSetter;
	setAttachedImages?: AiAttachmentStateSetter;
}

export interface AiAttachmentGalleryImage {
	name?: string;
	url?: string;
}

export interface AiAttachmentGallerySlotProps {
	isOpen: boolean;
	onClose: () => void;
	onSelect: (
		image: AiAttachmentGalleryImage | null | undefined,
	) => void;
	initialSource: string;
	initialCategory: "attachments";
	initialSubcategory: "";
}

export type AiAttachmentGallerySlot = (
	props: AiAttachmentGallerySlotProps,
) => ReactElement | null;

export interface AiAttachmentControlsCompositionSlots {
	ImageGallery: AiAttachmentGallerySlot;
}

export type AiAttachmentControlsComponent = (
	props: AiAttachmentControlsProps,
) => ReactElement | null;
