import { classNames, lang } from "../../../shared/lib/index.js";
import { Button, CollapseToggleButton } from "../../../shared/ui/index.js";
import {
	isNoteCardFieldHighlighted,
	type NoteCardNote,
	type NoteId,
} from "../model.ts";
import type {
	NoteCardEditableFieldSlot,
	NoteCardMentionRenderer,
} from "./noteCardComposition.ts";

export interface NoteCardHeaderProps {
	visible: boolean;
	note: NoteCardNote;
	isLast: boolean;
	canCollapse: boolean;
	isCollapsed: boolean;
	enableHistory: boolean;
	highlightFields: readonly string[] | null;
	onToggleCollapse: (noteId: NoteId) => void;
	onTitleChange: (noteId: NoteId, value: string) => void;
	onDelete: (noteId: NoteId) => void;
	EditableField: NoteCardEditableFieldSlot;
}

export function NoteCardHeader({
	visible,
	note,
	isLast,
	canCollapse,
	isCollapsed,
	enableHistory,
	highlightFields,
	onToggleCollapse,
	onTitleChange,
	onDelete,
	EditableField,
}: NoteCardHeaderProps) {
	if (!visible) return null;
	return (
		<div
			className="note_card_simple__header"
			onClick={() => {
				if (canCollapse) onToggleCollapse(note.id);
			}}
		>
			{canCollapse && (
				<CollapseToggleButton
					size={Button.SIZES.SMALL}
					collapsed={isCollapsed}
					onClick={() => onToggleCollapse(note.id)}
				/>
			)}
			<EditableField
				value={note.title || ""}
				enableHistory={enableHistory}
				onChange={(event) => onTitleChange(note.id, event.target.value)}
				placeholder={lang.t("New note")}
				className={classNames(
					"note_card_simple__title",
					isNoteCardFieldHighlighted(highlightFields, "title") &&
						"is_ai_changed_field",
				)}
			/>
			{!isLast && (
				<Button
					variant="danger"
					icon="trash"
					size={Button.SIZES.SMALL}
					iconSize={14}
					onClick={(event) => {
						event.stopPropagation();
						onDelete(note.id);
					}}
					title={lang.t("Delete note")}
				/>
			)}
		</div>
	);
}

export interface NoteCardSimplifiedProps {
	visible: boolean;
	noteId: NoteId;
	canCollapse: boolean;
	isCollapsed: boolean;
	shortText: string;
	hasTruncatedPreview: boolean;
	onToggleCollapse: (noteId: NoteId) => void;
	onDelete: (noteId: NoteId) => void;
	renderMentionText: NoteCardMentionRenderer;
}

export function NoteCardSimplified({
	visible,
	noteId,
	canCollapse,
	isCollapsed,
	shortText,
	hasTruncatedPreview,
	onToggleCollapse,
	onDelete,
	renderMentionText,
}: NoteCardSimplifiedProps) {
	if (!visible) return null;
	return (
		<>
			{isCollapsed && (
				<span>
					{renderMentionText(shortText)}
					{hasTruncatedPreview && "..."}
				</span>
			)}
			<div className="note_card_simple__simpleActions">
				{canCollapse && (
					<CollapseToggleButton
						size={Button.SIZES.SMALL}
						collapsed={isCollapsed}
						onClick={() => onToggleCollapse(noteId)}
						title={
							isCollapsed ? lang.t("Expand note") : lang.t("Collapse note")
						}
						className="note_card_simple__actionBtn"
					/>
				)}
				<Button
					variant="ghost"
					icon="trash"
					size={Button.SIZES.SMALL}
					iconSize={14}
					onClick={(event) => {
						event.stopPropagation();
						onDelete(noteId);
					}}
					title={lang.t("Delete note")}
					className="note_card_simple__actionBtn note_card_simple__actionBtn__danger"
				/>
			</div>
		</>
	);
}

export interface NoteCardBodyProps {
	visible: boolean;
	note: NoteCardNote;
	campaignSlug?: string | null;
	enableHistory: boolean;
	highlightFields: readonly string[] | null;
	onTextChange: (noteId: NoteId, value: string) => void;
	EditableField: NoteCardEditableFieldSlot;
}

export function NoteCardBody({
	visible,
	note,
	campaignSlug,
	enableHistory,
	highlightFields,
	onTextChange,
	EditableField,
}: NoteCardBodyProps) {
	if (!visible) return null;
	return (
		<div className="note_card_simple__content">
			<EditableField
				type="textarea"
				value={note.text}
				enableHistory={enableHistory}
				onChange={(event) => onTextChange(note.id, event.target.value)}
				placeholder={lang.t("Note text...")}
				campaignSlug={campaignSlug}
				className={
					isNoteCardFieldHighlighted(highlightFields, "text")
						? "is_ai_changed_field"
						: ""
				}
			/>
		</div>
	);
}
