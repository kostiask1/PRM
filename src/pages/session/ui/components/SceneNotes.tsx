import type { ReactNode } from "react";

import type { SessionScene } from "../../../../entities/session/index.js";
import { getAiIgnoredNoteListProps } from "../../../../features/notes/ui/index.js";
import type { SessionResourceId } from "../../../../features/session-editor/index.js";
import { getNoteListLabel, getNoteListPreview, getNotesForRender, lang, makeDomId, type SharedNote } from "../../../../shared/lib/index.js";
import { EntityLinkedListItem } from "../../../../features/entity-link/index.js";
import { DraggableList, useHashItemSelection } from "../../../../shared/ui/index.js";
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
	const notes = getNotesForRender(scene.notes, { simplifiedNotes: simplifiedNotesEnabled });
	const { selected, setSelectedKey } = useHashItemSelection(
		notes,
		(note) => String(note.id),
		(note, hash) => matchesHistoryTargetId(hash, "session", "scene-note", scene.id, note.id) || hash === `#${makeDomId("session", "scene", scene.id, "note", note.id)}`,
		(note, key) => note._renderKey != null && String(note._renderKey) === key,
	);
	return (
		<div className="SessionSceneCard__notes">
			<div className="SessionSceneCard__notesHeaderRow"><div className="SessionSceneCard__notesHeader"><label>{lang.t("Scene notes")}</label></div></div>
			<div className="CampaignEntitySection__workspace">
				<DraggableList
					items={notes}
					className="SessionSceneCard__notesList CampaignEntitySection__list NoteSelectionList"
					keyboardReorder
					getKeyboardReorderLabel={(note) => lang.t("Reorder note: {name} (arrow keys)", { name: getNoteListLabel(note) || lang.t("New note") })}
					onReorder={onSceneNotesReorder}
					{...getAiIgnoredNoteListProps(onSceneNoteAiIgnoredChange)}
					renderItem={(note) => { const preview = getNoteListPreview(note); const label = getNoteListLabel(note) || lang.t("New note"); return <EntityLinkedListItem text={preview.text || label} label={label} maxLength={preview.maxLength} selected={note === selected} onSelect={() => setSelectedKey(String(note.id))} />; }}
				/>
				<div className="CampaignEntitySection__detail">{selected && renderNoteCard(selected, notes.indexOf(selected) === notes.length - 1)}</div>
			</div>
		</div>
	);
}
