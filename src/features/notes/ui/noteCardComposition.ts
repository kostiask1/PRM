import type { ReactElement, ReactNode } from "react";

import type { NoteCardNote, NoteId } from "../model.ts";

export interface NoteCardProps {
	note: NoteCardNote;
	isLast: boolean;
	campaignSlug?: string | null;
	enableHistory?: boolean;
	onToggleCollapse: (noteId: NoteId) => void;
	onTitleChange: (noteId: NoteId, value: string) => void;
	onTextChange: (noteId: NoteId, value: string) => void;
	onDelete: (noteId: NoteId) => void;
	highlightFields?: readonly string[] | null;
}

export interface NoteCardEditableFieldChangeEvent {
	target: { value: string };
}

export interface NoteCardEditableFieldSlotProps {
	value: string | number | null | undefined;
	enableHistory: boolean;
	onChange: (event: NoteCardEditableFieldChangeEvent) => void;
	placeholder: string;
	className: string;
	type?: "text" | "textarea";
	campaignSlug?: string | null;
}

export type NoteCardEditableFieldSlot = (
	props: NoteCardEditableFieldSlotProps,
) => ReactElement | null;

export type NoteCardMentionRenderer = (text: unknown) => ReactNode;

export interface NoteCardCompositionSlots {
	EditableField: NoteCardEditableFieldSlot;
	renderMentionText: NoteCardMentionRenderer;
}

export type NoteCardComponent = (
	props: NoteCardProps,
) => ReactElement | null;
