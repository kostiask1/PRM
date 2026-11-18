import type { ReactNode } from "react";

import type { SessionScene } from "../../../../entities/session/index.js";
import { getAiIgnoredNoteListProps, useCardNotesViewMode, useRestoreNoteStreamPosition } from "../../../../features/notes/ui/index.js";
import type { SessionResourceId } from "../../../../features/session-editor/index.js";
import { getNoteListLabel, getNoteListPreview, getNotesForRender, lang, makeDomId, type SharedNote } from "../../../../shared/lib/index.js";
import { EntityLinkedListItem } from "../../../../features/entity-link/index.js";
import { DraggableList, NoteViewMode, useHashItemSelection } from "../../../../shared/ui/index.js";
import { matchesHistoryTargetId } from "../../../../entities/history/index.js";
import "../../../../assets/components/CampaignEntitySection.css";

interface SceneNotesProps {
	onSceneNoteAiIgnoredChange: (
		noteId: SessionResourceId,
		ignored: boolean,
	) => void;
	onSceneNotesReorder: (notes: SharedNote[]) => void;
	renderNoteCard: (note: SharedNote, isLast: boolean) => ReactNode;
	scene: SessionScene;
	simplifiedNotesEnabled: boolean;
}

export default function SceneNotes({
	onSceneNoteAiIgnoredChange,
	onSceneNotesReorder,
	renderNoteCard,
	scene,
	simplifiedNotesEnabled,
}: SceneNotesProps) {
	const { showAll, setShowAll } = useCardNotesViewMode();
	const notes = getNotesForRender(scene.notes, { simplifiedNotes: simplifiedNotesEnabled });
	const { selected, setSelectedKey } = useHashItemSelection(
		notes,
		(note) => String(note.id),
		(note, hash) => matchesHistoryTargetId(hash, "session", "scene-note", scene.id, note.id) || hash === `#${makeDomId("session", "scene", scene.id, "note", note.id)}`,
		(note, key) => note._renderKey != null && String(note._renderKey) === key,
	);
	const { detailRef, restoringRef } = useRestoreNoteStreamPosition(showAll, notes.indexOf(selected));
	return (
		<div className="SessionSceneCard__notes">
			<div className="SessionSceneCard__notesHeaderRow">
				<div className="SessionSceneCard__notesHeader">
					<label>{lang.t("Scene notes")}</label>
					<NoteViewMode value={showAll} onChange={setShowAll} />
				</div>
			</div>
			<div className="CampaignEntitySection__workspace">
				<DraggableList
					items={notes}
					className="SessionSceneCard__notesList CampaignEntitySection__list NoteSelectionList"
					keyboardReorder
					getKeyboardReorderLabel={(note) => lang.t("Reorder note: {name} (arrow keys)", { name: getNoteListLabel(note) || lang.t("New note") })}
					onReorder={onSceneNotesReorder}
					{...getAiIgnoredNoteListProps(onSceneNoteAiIgnoredChange)}
					renderItem={(note) => { const preview = getNoteListPreview(note); const label = getNoteListLabel(note) || lang.t("New note"); return <EntityLinkedListItem text={preview.text || label} label={label} maxLength={preview.maxLength} selected={note === selected} onSelect={() => { setSelectedKey(String(note.id)); if (showAll) detailRef.current?.querySelectorAll<HTMLElement>(":scope > [data-note-index]")[notes.indexOf(note)]?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }} />; }}
				/>
				<div ref={detailRef} className={`CampaignEntitySection__detail${showAll ? " CampaignEntitySection__detail_stream" : ""}`} onScroll={(event) => {
					if (!showAll) return;
					if (restoringRef.current) { restoringRef.current = false; return; }
					const top = event.currentTarget.getBoundingClientRect().top;
					const cards = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(":scope > [data-note-index]"));
					const active = cards.reduce<HTMLElement | null>((current, card) => card.getBoundingClientRect().top <= top + 24 ? card : current, cards[0] || null);
					if (active) setSelectedKey(String(notes[Number(active.dataset.noteIndex)]?.id));
				}}>{(showAll ? notes : selected ? [selected] : []).map((note) => { const index = notes.indexOf(note); return <div key={String(note.id)} data-note-index={index}>{renderNoteCard(note, index === notes.length - 1)}</div>; })}</div>
			</div>
		</div>
	);
}
