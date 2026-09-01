import type { DraggableListProps } from "../../../shared/ui/index.js";
import { getNoteRenderKey } from "../../../shared/lib/index.js";
import { isRealNote, type AiIgnoredNote } from "../model.ts";
import AiContextIgnoreButton from "./AiContextIgnoreButton.tsx";

export type AiIgnoredNoteListProps = Pick<
	DraggableListProps<AiIgnoredNote>,
	| "isItemControlActive"
	| "isItemDraggable"
	| "isolateDragEvents"
	| "keyExtractor"
	| "renderItemControl"
>;

export interface AiIgnoredNoteListOptions {
	isolateDragEvents?: boolean;
}

function getAiIgnoredNoteListProps(
	onNoteAiIgnoredChange?: (noteId: AiIgnoredNote["id"], ignored: boolean) => void,
	options?: AiIgnoredNoteListOptions,
): AiIgnoredNoteListProps {
	return {
		keyExtractor: (note, index) => getNoteRenderKey(note, index),
		isItemDraggable: isRealNote,
		isolateDragEvents: options?.isolateDragEvents ?? true,
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
