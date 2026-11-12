import type { ReactNode } from "react";

import type { SessionScene } from "../../../../entities/session/index.js";
import { getAiIgnoredNoteListProps } from "../../../../features/notes/ui/index.js";
import type { SessionResourceId } from "../../../../features/session-editor/index.js";
import { getNotesForRender, lang, type SharedNote } from "../../../../shared/lib/index.js";
import { DraggableList } from "../../../../shared/ui/index.js";

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
	return (
		<div className="SessionSceneCard__notes">
			<div className="SessionSceneCard__notesHeaderRow"><div className="SessionSceneCard__notesHeader"><label>{lang.t("Scene notes")}</label></div></div>
			{renderSceneNotesList({
					onSceneNoteAiIgnoredChange,
					onSceneNotesReorder,
					notes,
					renderNoteCard,
				})}
		</div>
	);
}

interface SceneNotesListProps {
	onSceneNoteAiIgnoredChange: (
		noteId: SessionResourceId,
		ignored: boolean,
	) => void;
	onSceneNotesReorder: (notes: SharedNote[]) => void;
	notes: ReturnType<typeof getNotesForRender>;
	renderNoteCard: (note: SharedNote, isLast: boolean) => ReactNode;
}

function renderSceneNotesList({
	onSceneNoteAiIgnoredChange,
	onSceneNotesReorder,
	notes,
	renderNoteCard,
}: SceneNotesListProps) {
	return (
		<DraggableList
			items={notes}
			className="SessionSceneCard__notesList NoteCardList"
			onReorder={onSceneNotesReorder}
			{...getAiIgnoredNoteListProps(onSceneNoteAiIgnoredChange)}
			renderItem={(note, isDragging, index) =>
				renderNoteCard(
					note,
					index === notes.length - 1,
				)
			}
		/>
	);
}
