import AiContextIgnoreButton from "./AiContextIgnoreButton.jsx";
import { getNoteRenderKey } from "../../utils/noteUtils.js";

function isRealNote(note) {
	return !note._isVirtual;
}

function getAiIgnoredNoteListProps(onNoteAiIgnoredChange) {
	return {
		keyExtractor: (note, index) => getNoteRenderKey(note, index),
		isItemDraggable: isRealNote,
		isolateDragEvents: true,
		isItemControlActive: (note) => Boolean(note._aiIgnored),
		renderItemControl: (note) =>
			isRealNote(note) && (
				<AiContextIgnoreButton
					ignored={Boolean(note._aiIgnored)}
					onToggle={(ignored) => onNoteAiIgnoredChange?.(note.id, ignored)}
				/>
			),
	};
}

export { getAiIgnoredNoteListProps };
