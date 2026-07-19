import type { Dispatch, SetStateAction } from "react";

export interface AiUiAttachment extends Record<string, unknown> {
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
