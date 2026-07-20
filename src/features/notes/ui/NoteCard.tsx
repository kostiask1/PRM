import "../../../assets/components/NoteCard.css";
import { classNames } from "../../../shared/lib/index.js";
import { useAppSelector } from "../../../shared/model/index.js";
import {
	getNoteCardPresentation,
	shouldExpandNoteFromCardClick,
	type NoteCardNote,
	type NoteId,
} from "../model.ts";
import {
	NoteCardBody,
	NoteCardHeader,
	NoteCardSimplified,
} from "./NoteCardParts.tsx";

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
	const presentation = getNoteCardPresentation(
		note,
		isLast,
		simplifiedNotesEnabled,
		SHORT_TEXT_LENGTH,
	);

	return (
		<div
			className={classNames("note_card_simple", {
				is_collapsed: presentation.isCollapsed,
				note_card_simple__simplified: simplifiedNotesEnabled,
			})}
			onClick={() => {
				if (
					shouldExpandNoteFromCardClick(
						presentation,
						simplifiedNotesEnabled,
					)
				) {
					onToggleCollapse(note.id);
				}
			}}
		>
			<NoteCardHeader
				visible={presentation.showClassicHeader}
				note={note}
				isLast={isLast}
				canCollapse={presentation.canCollapse}
				isCollapsed={presentation.isCollapsed}
				enableHistory={enableHistory}
				highlightFields={highlightFields}
				onToggleCollapse={onToggleCollapse}
				onTitleChange={onTitleChange}
				onDelete={onDelete}
			/>
			<NoteCardSimplified
				visible={presentation.showSimplifiedActions}
				noteId={note.id}
				canCollapse={presentation.canCollapse}
				isCollapsed={presentation.isCollapsed}
				shortText={presentation.shortText}
				hasTruncatedPreview={presentation.hasTruncatedPreview}
				onToggleCollapse={onToggleCollapse}
				onDelete={onDelete}
			/>
			<NoteCardBody
				visible={!presentation.isCollapsed}
				note={note}
				campaignSlug={campaignSlug}
				enableHistory={enableHistory}
				highlightFields={highlightFields}
				onTextChange={onTextChange}
			/>
		</div>
	);
}
