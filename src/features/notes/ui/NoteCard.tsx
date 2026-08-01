import "../../../assets/components/NoteCard.css";
import { classNames } from "../../../shared/lib/index.js";
import { useAppSelector } from "../../../shared/model/index.js";
import {
	getNoteCardPresentation,
	shouldExpandNoteFromCardClick,
} from "../model.ts";
import {
	NoteCardBody,
	NoteCardHeader,
	NoteCardSimplified,
} from "./NoteCardParts.tsx";
import type {
	NoteCardComponent,
	NoteCardCompositionSlots,
	NoteCardProps,
} from "./noteCardComposition.ts";

const SHORT_TEXT_LENGTH = 50;

type NoteCardInternalProps = NoteCardProps & NoteCardCompositionSlots;

function NoteCard({
	note,
	isLast,
	campaignSlug,
	enableHistory = true,
	onToggleCollapse,
	onTitleChange,
	onTextChange,
	onDelete,
	highlightFields = null,
	EditableField,
	renderMentionText,
}: NoteCardInternalProps) {
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
				EditableField={EditableField}
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
				renderMentionText={renderMentionText}
				onToggleCollapse={onToggleCollapse}
				onDelete={onDelete}
			/>
			<NoteCardBody
				visible={!presentation.isCollapsed}
				note={note}
				campaignSlug={campaignSlug}
				enableHistory={enableHistory}
				highlightFields={highlightFields}
				EditableField={EditableField}
				onTextChange={onTextChange}
			/>
		</div>
	);
}

export function createNoteCardComponent({
	EditableField,
	renderMentionText,
}: NoteCardCompositionSlots): NoteCardComponent {
	function ConfiguredNoteCard(props: NoteCardProps) {
		return (
			<NoteCard
				{...props}
				EditableField={EditableField}
				renderMentionText={renderMentionText}
			/>
		);
	}

	return ConfiguredNoteCard;
}
