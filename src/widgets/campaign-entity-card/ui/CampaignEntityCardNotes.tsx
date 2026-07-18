import type { ReactNode } from "react";
import {
	CardNoteModel,
	type CardEntity,
	type CardNote,
} from "../../../entities/campaign/index.js";
import { getAiIgnoredNoteListProps, NoteCard } from "../../../features/notes/ui/index.js";
import { sanitizeNotesForSave } from "../../../shared/lib/index.js";
import { Button, CollapseToggleButton, DraggableList } from "../../../shared/ui/index.js";
import {
	getCampaignNoteHighlightFields,
	setCampaignNoteAiIgnored,
	type CampaignCardEntityId,
	type CampaignEntityHighlightFields,
} from "../model/campaignEntityCard.ts";

interface CampaignEntityCardNotesProps<Entity extends CardEntity> {
	classPrefix: "character_card" | "location_card";
	entityId: CampaignCardEntityId;
	model: CardNoteModel<Entity>;
	notesForRender: CardNote[];
	hasNotesData: boolean;
	isNotesCollapsed: boolean;
	currentNotesCollapsed: boolean;
	campaignSlug?: string | null;
	enableHistory: boolean;
	label: ReactNode;
	highlightFields?: CampaignEntityHighlightFields | null;
	onChange: (id: CampaignCardEntityId, entity: Entity, options?: { trackUndo?: boolean }) => void;
	onReorderDrop?: (notes: CardNote[]) => void;
}

export default function CampaignEntityCardNotes<Entity extends CardEntity>({
	classPrefix,
	entityId,
	model,
	notesForRender,
	hasNotesData,
	isNotesCollapsed,
	currentNotesCollapsed,
	campaignSlug,
	enableHistory,
	label,
	highlightFields,
	onChange,
	onReorderDrop,
}: CampaignEntityCardNotesProps<Entity>) {
	const updateNotes = (notes: CardNote[]) => onChange(entityId, model.withField("notes", notes));
	const toggleNotes = () => onChange(entityId, model.withField("isNotesCollapsed", !currentNotesCollapsed));
	return (
		<div className={`${classPrefix}__notes`}>
			<div className={`${classPrefix}__notes_header`} onClick={hasNotesData ? toggleNotes : undefined}>
				{hasNotesData && (
					<CollapseToggleButton size={Button.SIZES.SMALL} collapsed={isNotesCollapsed} onClick={toggleNotes} />
				)}
				<label>{label}</label>
			</div>
			{!isNotesCollapsed && (
				<DraggableList<CardNote>
					items={notesForRender}
					className={`${classPrefix}__notes_list`}
					onReorder={(notes) => onChange(entityId, model.withField("notes", sanitizeNotesForSave(notes)), { trackUndo: true })}
					onDrop={onReorderDrop}
					{...getAiIgnoredNoteListProps((noteId, ignored) => updateNotes(setCampaignNoteAiIgnored(model.notes, noteId, ignored)))}
					renderItem={(note, _isDragging, index) => (
						<NoteCard
							note={{ ...note, text: note.text ?? "" }}
							isLast={index === notesForRender.length - 1}
							campaignSlug={campaignSlug}
							enableHistory={enableHistory}
							onToggleCollapse={(noteId) => updateNotes(model.toggleNoteCollapse(noteId))}
							onTitleChange={(noteId, title) => updateNotes(model.withUpdatedNote(noteId, { title }))}
							onTextChange={(noteId, text) => updateNotes(model.withUpdatedNote(noteId, { text }))}
							onDelete={(noteId) => updateNotes(model.withDeletedNote(noteId))}
							highlightFields={getCampaignNoteHighlightFields(highlightFields, note)}
						/>
					)}
				/>
			)}
		</div>
	);
}
