export type NoteId = string | number;

export interface NoteCardNote {
	id: NoteId;
	title?: string;
	text: string;
	collapsed?: boolean;
}

export interface NoteCardPresentation {
	canCollapse: boolean;
	isCollapsed: boolean;
	showClassicHeader: boolean;
	showSimplifiedActions: boolean;
	shortText: string;
	hasTruncatedPreview: boolean;
}

export interface CollapsibleNoteItem {
	collapsed?: boolean;
	_isVirtual?: boolean;
}

export interface AiIgnoredNote extends CollapsibleNoteItem {
	id: NoteId;
	_aiIgnored?: boolean;
	_renderKey?: string | number;
}

export function getNoteCardPresentation(
	note: NoteCardNote,
	isLast: boolean,
	simplifiedNotesEnabled: boolean,
	shortTextLength = 50,
): NoteCardPresentation {
	const noteTitle = String(note.title || "").trim();
	const noteText = String(note.text || "").trim();
	const canCollapse =
		!isLast && (noteTitle.length > 0 || noteText.length > 0);
	const isCollapsed = Boolean(canCollapse && note.collapsed);

	return {
		canCollapse,
		isCollapsed,
		showClassicHeader: !simplifiedNotesEnabled,
		showSimplifiedActions: simplifiedNotesEnabled && !isLast,
		shortText: note.text.slice(0, shortTextLength),
		hasTruncatedPreview: note.text.length > shortTextLength,
	};
}

export function getBulkCollapseAction(
	items: readonly CollapsibleNoteItem[],
): boolean | null {
	const realItems = items.filter((item) => !item._isVirtual);
	if (realItems.length === 0) return null;
	return realItems.some((item) => !item.collapsed);
}

export function isRealNote(note: CollapsibleNoteItem): boolean {
	return !note._isVirtual;
}
