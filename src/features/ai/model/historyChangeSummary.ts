import type {
	AiChangeSummary,
	AiHistoryEntry,
} from "../api/aiApi.ts";

type Translate = (value: string) => string;
type ChangeCountKey = "added" | "deleted" | "modified";

const CHANGE_COUNT_PARTS: ReadonlyArray<{
	key: ChangeCountKey;
	prefix: "+" | "-" | "~";
}> = [
	{ key: "added", prefix: "+" },
	{ key: "deleted", prefix: "-" },
	{ key: "modified", prefix: "~" },
];

function getHistoryChangeCounters(
	entry: AiHistoryEntry | null | undefined,
): Partial<AiChangeSummary> {
	return entry?.changes?.summary || {};
}

function getHistoryResourceCount(
	entry: AiHistoryEntry | null | undefined,
): number {
	const resources = entry?.changes?.resources;
	return Array.isArray(resources) ? resources.length : 0;
}

function getHistoryChangeTotal(
	summary: Partial<AiChangeSummary>,
	resourceCount: number,
): number {
	const explicitTotal = Number(summary.total);
	if (explicitTotal) return explicitTotal;
	return resourceCount;
}

function getHistoryChangeCountParts(
	summary: Partial<AiChangeSummary>,
): string[] {
	const parts: string[] = [];
	for (const { key, prefix } of CHANGE_COUNT_PARTS) {
		const count = summary[key];
		if (count) parts.push(`${prefix}${count}`);
	}
	return parts;
}

function formatHistoryChangeCounts(parts: string[], total: number): string {
	return parts.length ? parts.join(" ") : String(total);
}

export function getHistoryChangeSummary(
	entry: AiHistoryEntry | null | undefined,
	translate: Translate = (value) => value,
): string {
	const summary = getHistoryChangeCounters(entry);
	const total = getHistoryChangeTotal(summary, getHistoryResourceCount(entry));
	if (!total) return "";
	const counts = formatHistoryChangeCounts(
		getHistoryChangeCountParts(summary),
		total,
	);
	return `${translate("Changes")}: ${counts}`;
}
