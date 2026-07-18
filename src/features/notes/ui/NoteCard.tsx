import { classNames, lang } from "../../../shared/lib/index.js";
import { useAppSelector } from "../../../shared/model/index.js";
import "../../../assets/components/NoteCard.css";
import { Button, CollapseToggleButton } from "../../../shared/ui/index.js";
import { EditableField } from "../../editor/ui/index.js";
import { renderMentionText } from "../../rich-content/index.js";
import {
	getNoteCardPresentation,
	type NoteCardNote,
	type NoteId,
} from "../model.ts";

const SHORT_TEXT_LENGTH = 50;

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

export default function NoteCard({
	note,
	isLast,
	campaignSlug,
	enableHistory = true,
	onToggleCollapse,
	onTitleChange,
	onTextChange,
	onDelete,
	highlightFields = null,
}: NoteCardProps) {
	const simplifiedNotesEnabled = useAppSelector(
		(state) => state.ui.simplifiedNotes,
	);
	const {
		canCollapse,
		hasTruncatedPreview,
		isCollapsed,
		shortText,
		showClassicHeader,
		showSimplifiedActions,
	} = getNoteCardPresentation(
		note,
		isLast,
		simplifiedNotesEnabled,
		SHORT_TEXT_LENGTH,
	);

	return (
		<div
			className={classNames("note_card_simple", {
				is_collapsed: isCollapsed,
				note_card_simple__simplified: simplifiedNotesEnabled,
			})}
			onClick={() => {
				if (isCollapsed && simplifiedNotesEnabled && canCollapse) {
					onToggleCollapse(note.id);
				}
			}}
		>
			{showClassicHeader && (
				<div
					key="classic-header"
					className="note_card_simple__header"
					onClick={() => {
						if (canCollapse) onToggleCollapse(note.id);
					}}
				>
					{canCollapse && (
						<CollapseToggleButton
							key="collapse-toggle"
							size={Button.SIZES.SMALL}
							collapsed={isCollapsed}
							onClick={() => onToggleCollapse(note.id)}
						/>
					)}
					<EditableField
						key="title"
						value={note.title || ""}
						enableHistory={enableHistory}
						onChange={(event) => onTitleChange(note.id, event.target.value)}
						placeholder={lang.t("New note")}
						className={classNames(
							"note_card_simple__title",
							highlightFields?.includes?.("title") && "is_ai_changed_field",
						)}
					/>
					{!isLast && (
						<Button
							key="delete"
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
			)}
			{showSimplifiedActions && isCollapsed && (
				<span key="collapsed-preview">
					{renderMentionText(shortText)}
					{hasTruncatedPreview && "..."}
				</span>
			)}
			{showSimplifiedActions && (
				<div key="simplified-actions" className="note_card_simple__simpleActions">
					{canCollapse && (
						<CollapseToggleButton
							key="collapse-toggle"
							size={Button.SIZES.SMALL}
							collapsed={isCollapsed}
							onClick={() => onToggleCollapse(note.id)}
							title={
								isCollapsed ? lang.t("Expand note") : lang.t("Collapse note")
							}
							className="note_card_simple__actionBtn"
						/>
					)}
					<Button
						key="delete"
						variant="ghost"
						icon="trash"
						size={Button.SIZES.SMALL}
						iconSize={14}
						onClick={(event) => {
							event.stopPropagation();
							onDelete(note.id);
						}}
						title={lang.t("Delete note")}
						className="note_card_simple__actionBtn note_card_simple__actionBtn__danger"
					/>
				</div>
			)}
			{!isCollapsed && (
				<div key="content" className="note_card_simple__content">
					<EditableField
						type="textarea"
						value={note.text}
						enableHistory={enableHistory}
						onChange={(event) => onTextChange(note.id, event.target.value)}
						placeholder={lang.t("Note text...")}
						campaignSlug={campaignSlug}
						className={
							highlightFields?.includes?.("text") ? "is_ai_changed_field" : ""
						}
					/>
				</div>
			)}
		</div>
	);
}
