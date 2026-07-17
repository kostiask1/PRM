export function idsEqual(left: unknown, right: unknown): boolean;

export interface SharedNote {
	id: string | number;
	title?: string;
	text?: string;
	collapsed?: boolean;
	[key: string]: unknown;
}

export function upsertNoteById<T extends SharedNote>(
	notes: T[],
	noteId: string | number,
	updates?: Partial<T>,
): T[];

export function sanitizeNotesForSave<T extends SharedNote>(notes: T[]): T[];

export { lang } from "./localization";

export interface HistoryTransition<T> {
	target: T | null;
	undoStack: T[];
	redoStack: T[];
}

export interface HistoryTransitionOptions<T> {
	undoStack: T[];
	redoStack: T[];
	current: T | null | undefined;
	clone?: (value: T) => T;
}

export function createUndoTransition<T>(
	options: HistoryTransitionOptions<T>,
): HistoryTransition<T>;
export function createRedoTransition<T>(
	options: HistoryTransitionOptions<T>,
): HistoryTransition<T>;
export function isHistoryShortcutEvent(
	event: Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "code">,
): boolean;
export function shouldUseAppHistoryForEvent(
	event: Pick<Event, "target">,
): boolean;

export interface DistinctHistoryTransitionOptions<T> {
	undoStack: T[];
	redoStack: T[];
	current: T;
	isEqual: (left: T, right: T) => boolean;
	clone?: (value: T) => T;
}

export function addUndoSnapshot<T>(
	undoStack: T[],
	snapshot: T,
	clone?: (value: T) => T,
): T[];
export function clearRedoStack<T>(): T[];
export function createDistinctUndoTransition<T>(
	options: DistinctHistoryTransitionOptions<T>,
): HistoryTransition<T>;
export function createDistinctRedoTransition<T>(
	options: DistinctHistoryTransitionOptions<T>,
): HistoryTransition<T>;
export function useDebounce<T>(value: T, delay: number): T;
export function shouldOpenInNewTabFromEvent(
	event?: Pick<MouseEvent, "ctrlKey" | "metaKey" | "button"> | null,
): boolean;
export function downloadBlob(blob: Blob, filename: string): void;
