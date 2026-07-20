import type { AiHistoryResource } from "../api/aiApi.ts";

export type SnapshotRecord = Record<string, unknown>;
export type NameReader = (item: SnapshotRecord) => unknown;

export type DiffLineType = "context" | "added" | "removed";

export interface DiffLine {
	type: DiffLineType;
	oldNumber: number | null;
	newNumber: number | null;
	text: string;
}

export interface DiffLabels {
	added?: string;
	deleted?: string;
	modified?: string;
	note?: string;
	scene?: string;
	encounter?: string;
	creature?: string;
}

export interface DiffWorkResource extends AiHistoryResource {
	label?: string;
	parentResourceId?: string;
	listIndex?: number | null;
}

export interface DiffResource extends DiffWorkResource {
	fieldSummary: string[];
	lines: DiffLine[];
}
