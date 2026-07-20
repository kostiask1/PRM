import type {
	DiffLine,
	DiffLineType,
} from "./aiDiffContracts.ts";
import { splitSnapshotDiffText } from "./aiDiffSnapshot.ts";

const MAX_LCS_CELLS = 200000;

interface DiffCursor {
	oldIndex: number;
	newIndex: number;
	oldNumber: number;
	newNumber: number;
}

function createFullReplacementDiff(
	oldLines: readonly string[],
	newLines: readonly string[],
): DiffLine[] {
	return [
		...oldLines.map((text, index) => ({
			type: "removed" as const,
			oldNumber: index + 1,
			newNumber: null,
			text,
		})),
		...newLines.map((text, index) => ({
			type: "added" as const,
			oldNumber: null,
			newNumber: index + 1,
			text,
		})),
	];
}

function buildLongestCommonSubsequenceTable(
	oldLines: readonly string[],
	newLines: readonly string[],
): number[][] {
	const table = Array.from({ length: oldLines.length + 1 }, () =>
		Array<number>(newLines.length + 1).fill(0),
	);
	for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
		for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
			table[oldIndex][newIndex] =
				oldLines[oldIndex] === newLines[newIndex]
					? table[oldIndex + 1][newIndex + 1] + 1
					: Math.max(
							table[oldIndex + 1][newIndex],
							table[oldIndex][newIndex + 1],
						);
		}
	}
	return table;
}

function getNextDiffLineType(
	oldLines: readonly string[],
	newLines: readonly string[],
	table: readonly number[][],
	cursor: DiffCursor,
): DiffLineType {
	const hasOldLine = cursor.oldIndex < oldLines.length;
	const hasNewLine = cursor.newIndex < newLines.length;
	if (
		hasOldLine &&
		hasNewLine &&
		oldLines[cursor.oldIndex] === newLines[cursor.newIndex]
	) {
		return "context";
	}
	const shouldRemove =
		!hasNewLine ||
		(hasOldLine &&
			table[cursor.oldIndex + 1][cursor.newIndex] >=
				table[cursor.oldIndex][cursor.newIndex + 1]);
	return shouldRemove ? "removed" : "added";
}

function createDiffLine(
	type: DiffLineType,
	oldLines: readonly string[],
	newLines: readonly string[],
	cursor: DiffCursor,
): DiffLine {
	if (type === "context") {
		return {
			type,
			oldNumber: cursor.oldNumber,
			newNumber: cursor.newNumber,
			text: oldLines[cursor.oldIndex],
		};
	}
	if (type === "removed") {
		return {
			type,
			oldNumber: cursor.oldNumber,
			newNumber: null,
			text: oldLines[cursor.oldIndex],
		};
	}
	return {
		type,
		oldNumber: null,
		newNumber: cursor.newNumber,
		text: newLines[cursor.newIndex],
	};
}

function advanceDiffCursor(type: DiffLineType, cursor: DiffCursor): void {
	if (type !== "added") {
		cursor.oldIndex += 1;
		cursor.oldNumber += 1;
	}
	if (type !== "removed") {
		cursor.newIndex += 1;
		cursor.newNumber += 1;
	}
}

export function createLineDiff(before: unknown, after: unknown): DiffLine[] {
	const oldLines = splitSnapshotDiffText(before);
	const newLines = splitSnapshotDiffText(after);
	if (oldLines.length === 0 && newLines.length === 0) return [];
	if (oldLines.length * newLines.length > MAX_LCS_CELLS) {
		return createFullReplacementDiff(oldLines, newLines);
	}

	const table = buildLongestCommonSubsequenceTable(oldLines, newLines);
	const cursor: DiffCursor = {
		oldIndex: 0,
		newIndex: 0,
		oldNumber: 1,
		newNumber: 1,
	};
	const lines: DiffLine[] = [];
	while (cursor.oldIndex < oldLines.length || cursor.newIndex < newLines.length) {
		const type = getNextDiffLineType(oldLines, newLines, table, cursor);
		lines.push(createDiffLine(type, oldLines, newLines, cursor));
		advanceDiffCursor(type, cursor);
	}
	return lines;
}
