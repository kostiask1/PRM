import type { ReactNode } from "react";
import {
	CardNoteModel,
	type CardEntity,
	type CardNote,
} from "../../../entities/campaign/index.js";
import { EditableField } from "../../../features/editor/ui/index.js";
import {
	createNoteCardComponent,
	getAiIgnoredNoteListProps,
} from "../../../features/notes/ui/index.js";
import { renderMentionText } from "../../../features/entity-link/index.js";
import { makeDomId, sanitizeNotesForSave } from "../../../shared/lib/index.js";
import { Button, CollapseToggleButton, DraggableList } from "../../../shared/ui/index.js";
import {
	getCampaignNoteHighlightFields,
	setCampaignNoteAiIgnored,
	type CampaignCardEntityId,
	type CampaignEntityHighlightFields,
} from "../model/campaignEntityCard.ts";
import { makeHistoryTargetId } from "../../../entities/history/index.js";

const CampaignEntityNoteCard = createNoteCardComponent({
	EditableField,
	renderMentionText,
});

export interface CampaignEntityCardNotesProps<Entity extends CardEntity> {
	classPrefix: "CharacterCard" | "LocationCard";
	historyScope: "campaign" | "session";
	historyKind: "character" | "npc" | "location";
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
	onChange: (id: CampaignCardEntityId, entity: Entity) => void;
	onReorderDrop?: (notes: CardNote[]) => void;
}

export default function CampaignEntityCardNotes<Entity extends CardEntity>({
	classPrefix,
	historyScope,
	historyKind,
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
			<div className={`${classPrefix}__notesHeader`} onClick={hasNotesData ? toggleNotes : undefined}>
				{hasNotesData && (
					<CollapseToggleButton size={Button.SIZES.SMALL} collapsed={isNotesCollapsed} onClick={toggleNotes} />
				)}
				<label>{label}</label>
			</div>
			{!isNotesCollapsed && (
				<DraggableList<CardNote>
					items={notesForRender}
					className={`${classPrefix}__notesList`}
					onReorder={(notes) =>
						onChange(
							entityId,
							model.withField("notes", sanitizeNotesForSave(notes)),
						)
					}
					onDrop={onReorderDrop}
					{...getAiIgnoredNoteListProps((noteId, ignored) => updateNotes(setCampaignNoteAiIgnored(model.notes, noteId, ignored)))}
					renderItem={(note, _isDragging, index) => (
						<div
							id={makeDomId("campaign", "entity", entityId, "note", note.id)}
							data-history-focus-id={makeHistoryTargetId(
								historyScope,
								`${historyKind}-note`,
								entityId,
								note.id,
							)}
						>
						<CampaignEntityNoteCard
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
						</div>
					)}
				/>
			)}
		</div>
	);
}
