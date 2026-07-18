import type { Dispatch, SetStateAction } from "react";

export interface AiUiAttachment {
	name?: string;
	mimeType?: string;
	sizeBytes?: number;
	data?: string;
	url?: string;
	previewUrl?: string;
}

export type AiAttachmentStateSetter = Dispatch<
	SetStateAction<AiUiAttachment[]>
>;
