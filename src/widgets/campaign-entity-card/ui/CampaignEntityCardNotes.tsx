import { useMemo, useRef, useState, type ReactNode } from "react";
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
import { EntityLinkedListItem, renderMentionText } from "../../../features/entity-link/index.js";
import { getNoteListLabel, getNoteListPreview, lang, makeDomId, sanitizeNotesForSave } from "../../../shared/lib/index.js";
import { DraggableList, useHashItemSelection } from "../../../shared/ui/index.js";
import "../../../assets/components/CampaignEntitySection.css";
import {
	getCampaignNoteHighlightFields,
	setCampaignNoteAiIgnored,
	type CampaignCardEntityId,
	type CampaignEntityHighlightFields,
} from "../model/campaignEntityCard.ts";
import { makeHistoryTargetId, matchesHistoryTargetId } from "../../../entities/history/index.js";

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
	campaignSlug,
	enableHistory,
	label,
	highlightFields,
	onChange,
	onReorderDrop,
}: CampaignEntityCardNotesProps<Entity>) {
	const [showAll, setShowAll] = useState(true);
	const detailRef = useRef<HTMLDivElement>(null);
	const stream = historyKind !== "character" && showAll;
	const updateNotes = (notes: CardNote[]) => onChange(entityId, model.withField("notes", notes));
	const highlightedId = notesForRender.find((note) => getCampaignNoteHighlightFields(highlightFields, note)?.length)?.id;
	const highlightedSelection = useMemo(() => highlightedId == null ? null : { id: highlightedId }, [entityId, highlightedId]);
	const { selected, setSelectedKey } = useHashItemSelection(
		notesForRender,
		(note) => String(note.id),
		(note, hash) => matchesHistoryTargetId(hash, historyScope, `${historyKind}-note`, entityId, note.id) || hash === `#${makeDomId("campaign", "entity", entityId, "note", note.id)}`,
		(note, key) => note._renderKey != null && String(note._renderKey) === key,
		highlightedSelection,
	);
	return (
		<div className={`${classPrefix}__notes`}>
			<div className={`${classPrefix}__notesHeader`}>
				<label>{label}</label>
				{historyKind !== "character" && <div className="NoteViewMode" role="group" aria-label={lang.t("Notes display mode")}>
					<button type="button" aria-pressed={showAll} onClick={() => setShowAll(true)}>{lang.t("All notes")}</button>
					<button type="button" aria-pressed={!showAll} onClick={() => setShowAll(false)}>{lang.t("One note")}</button>
				</div>}
			</div>
			<div className="CampaignEntitySection__workspace">
				<DraggableList<CardNote>
					items={notesForRender}
					className={`${classPrefix}__notesList CampaignEntitySection__list NoteSelectionList`}
					keyboardReorder
					getKeyboardReorderLabel={(note) => lang.t("Reorder note: {name} (arrow keys)", { name: getNoteListLabel(note) || lang.t("New note") })}
					onReorder={(notes) =>
						onChange(
							entityId,
							model.withField("notes", sanitizeNotesForSave(notes)),
						)
					}
					onDrop={onReorderDrop}
					{...getAiIgnoredNoteListProps((noteId, ignored) => updateNotes(setCampaignNoteAiIgnored(model.notes, noteId, ignored)))}
					renderItem={(note) => { const preview = getNoteListPreview(note); const label = getNoteListLabel(note) || lang.t("New note"); const changed = Boolean(getCampaignNoteHighlightFields(highlightFields, note)?.length); return <EntityLinkedListItem text={preview.text || label} label={changed ? `${label} — ${lang.t("Changed")}` : label} maxLength={preview.maxLength} selected={note === selected} changed={changed} onSelect={() => { setSelectedKey(String(note.id)); if (stream) detailRef.current?.querySelectorAll<HTMLElement>(":scope > [data-note-index]")[notesForRender.indexOf(note)]?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }} />; }}
				/>
				<div ref={detailRef} className={`CampaignEntitySection__detail${stream ? " CampaignEntitySection__detail_stream" : ""}`} onScroll={(event) => {
					if (!stream) return;
					const top = event.currentTarget.getBoundingClientRect().top;
					const cards = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(":scope > [data-note-index]"));
					const active = cards.reduce<HTMLElement | null>((current, card) => card.getBoundingClientRect().top <= top + 24 ? card : current, cards[0] || null);
					if (active) setSelectedKey(String(notesForRender[Number(active.dataset.noteIndex)]?.id));
				}}>
					{(stream ? notesForRender : selected ? [selected] : []).map((note) => {
						const index = notesForRender.indexOf(note);
						return (
						<div key={String(note.id)} data-note-index={index}
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
							collapsible={false}
							onToggleCollapse={(noteId) => updateNotes(model.toggleNoteCollapse(noteId))}
							onTitleChange={(noteId, title) => updateNotes(model.withUpdatedNote(noteId, { title }))}
							onTextChange={(noteId, text) => updateNotes(model.withUpdatedNote(noteId, { text }))}
							onDelete={(noteId) => updateNotes(model.withDeletedNote(noteId))}
							highlightFields={getCampaignNoteHighlightFields(highlightFields, note)}
						/>
						</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
