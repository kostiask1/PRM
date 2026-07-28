export function idsEqual(left: unknown, right: unknown): boolean;
export function mapWithConcurrency<TItem, TResult>(
	items: Iterable<TItem> | ArrayLike<TItem> | null | undefined,
	concurrency: unknown,
	mapper: (item: TItem, index: number) => TResult | Promise<TResult>,
): Promise<TResult[]>;

export type ClassNameValue =
	| string
	| number
	| false
	| null
	| undefined
	| ClassNameValue[]
	| Record<string, unknown>;

export function classNames(...values: ClassNameValue[]): string;

export interface SharedNote {
	id: string | number;
	title?: string;
	text?: string;
	collapsed?: boolean;
	[key: string]: unknown;
}

export interface RenderableNoteKey {
	id?: string | number;
	_renderKey?: string | number;
}

export function getNoteRenderKey(
	note: RenderableNoteKey,
	fallback: string | number,
): string | number;

export function upsertNoteById<T extends SharedNote>(
	notes: T[],
	noteId: string | number,
	updates?: Partial<T>,
): T[];

export function sanitizeNotesForSave<T extends SharedNote>(notes: T[]): T[];
export function getNotesForRender<T extends SharedNote>(
	notes?: readonly T[],
	options?: { simplifiedNotes?: boolean },
): Array<T & { _isVirtual?: boolean; _renderKey?: string | number }>;

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
export interface DiceProbabilityOptions {
	maxRollCombinations?: number;
	maxStates?: number;
}
export interface DiceProbabilityOutcome {
	value: number;
	probability: number;
}
export interface DiceProbabilityDistribution {
	formula: string;
	outcomes: DiceProbabilityOutcome[];
	maxProbability: number;
	average: number;
	min: number;
	max: number;
}
export interface DiceBreakdownEntry {
	val: number;
	max: number | null;
	dropped?: boolean;
}
export interface DiceFormulaResult {
	id: number;
	formula: string;
	breakdown: DiceBreakdownEntry[];
	expressionBreakdown?: string;
	total: number;
	average: number;
	min: number;
	max: number;
	isCritical: boolean;
}
export function rollDiceFormula(input: unknown): DiceFormulaResult | null;
export function getDiceProbabilityDistribution(
	input: string,
	options?: DiceProbabilityOptions,
): DiceProbabilityDistribution | null;
export type CampaignSlug = string;
export type SessionFileName = string;
export type EncounterId = string | number;
export interface ParsedNavigationRoute {
	campaign: CampaignSlug | null;
	session: SessionFileName | null;
	encounter: string | null;
}
export function parseUrl(pathname?: string | null): ParsedNavigationRoute;
export function buildNavigationUrl(
	slug: CampaignSlug | null | undefined,
	fileName?: SessionFileName | null,
	encounterId?: EncounterId | null,
): string;
export function shouldOpenInNewTabFromEvent(
	event?: Pick<MouseEvent, "ctrlKey" | "metaKey" | "button"> | null,
): boolean;
export function downloadBlob(blob: Blob, filename: string): void;
export function downloadJsonFile(data: unknown, filename: string): void;
export function formatBytes(bytes: number): string;
export function objectMatchesSearch(value: unknown, searchQuery?: unknown): boolean;
export function makeDomId(...parts: unknown[]): string;
export function scrollToHashTarget(hash?: string): boolean;
