import AiContextIgnoreButton from "./AiContextIgnoreButton.jsx";

function isRealNote(note) {
	return !note._isVirtual;
}

function getAiIgnoredNoteListProps(onNoteAiIgnoredChange) {
	return {
		keyExtractor: (note) => note.id,
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
