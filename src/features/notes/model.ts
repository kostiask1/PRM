export type NoteId = string | number;

export interface NoteCardNote {
	id: NoteId;
	title?: string;
	text?: string;
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

export type NoteCardField = "title" | "text";

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
	const rawText = String(note.text || "");
	const noteText = rawText.trim();
	const canCollapse =
		!isLast && (noteTitle.length > 0 || noteText.length > 0);
	const isCollapsed = Boolean(canCollapse && note.collapsed);

	return {
		canCollapse,
		isCollapsed,
		showClassicHeader: !simplifiedNotesEnabled,
		showSimplifiedActions: simplifiedNotesEnabled && !isLast,
		shortText: rawText.slice(0, shortTextLength),
		hasTruncatedPreview: rawText.length > shortTextLength,
	};
}

export function shouldExpandNoteFromCardClick(
	presentation: Pick<NoteCardPresentation, "canCollapse" | "isCollapsed">,
	simplifiedNotesEnabled: boolean,
): boolean {
	return (
		simplifiedNotesEnabled &&
		presentation.canCollapse &&
		presentation.isCollapsed
	);
}

export function isNoteCardFieldHighlighted(
	highlightFields: readonly string[] | null | undefined,
	field: NoteCardField,
): boolean {
	return Boolean(highlightFields?.includes(field));
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
