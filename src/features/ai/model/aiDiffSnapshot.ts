import type {
	NameReader,
	SnapshotRecord,
} from "./aiDiffContracts.ts";

export function asSnapshotRecord(value: unknown): SnapshotRecord | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as SnapshotRecord)
		: null;
}

export function snapshotsEqual(before: unknown, after: unknown): boolean {
	return JSON.stringify(before ?? null) === JSON.stringify(after ?? null);
}

export function splitSnapshotDiffText(value: unknown): string[] {
	if (value === null || value === undefined) return [];
	const text = JSON.stringify(value, null, 2);
	return text ? text.split(/\r?\n/) : [];
}

export function normalizeDiffIdentity(value: unknown): string {
	if (value === null || value === undefined) return "";
	return String(value).trim();
}

function getFirstDiffIdentity(values: readonly unknown[]): string {
	for (const value of values) {
		const normalized = normalizeDiffIdentity(value);
		if (normalized) return normalized;
	}
	return "";
}

export function getDiffItemKey(
	item: unknown,
	index: number,
	getName?: NameReader,
): string {
	const record = asSnapshotRecord(item);
	if (!record) return `index:${index}`;
	const identity = getFirstDiffIdentity([record.id, record.slug]);
	if (identity) return identity;
	const name = getFirstDiffIdentity([
		getName?.(record),
		record.name,
		record.title,
	]);
	return name ? `name:${name.toLowerCase()}` : `index:${index}`;
}

export function getCharacterDiffName(entity: SnapshotRecord): string {
	const firstName = getFirstDiffIdentity([
		entity.firstName,
		entity.first_name,
	]);
	const lastName = getFirstDiffIdentity([entity.lastName, entity.last_name]);
	const combined = `${firstName} ${lastName}`.trim();
	return combined || getFirstDiffIdentity([entity.name, entity.title]);
}

export function getLocationDiffName(entity: SnapshotRecord): string {
	return getFirstDiffIdentity([entity.name, entity.title]);
}

export function getDiffResourceFieldSummary(
	beforeValue: unknown,
	afterValue: unknown,
): string[] {
	const before = asSnapshotRecord(beforeValue);
	const after = asSnapshotRecord(afterValue);
	if (!before || !after) return [];
	const ignoredKeys = new Set(["id", "slug", "source"]);
	return [...new Set([...Object.keys(before), ...Object.keys(after)])]
		.filter((key) => !ignoredKeys.has(key))
		.filter((key) => !snapshotsEqual(before[key], after[key]))
		.slice(0, 8);
}
