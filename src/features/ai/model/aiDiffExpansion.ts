import type {
	DiffLabels,
	DiffWorkResource,
	NameReader,
	SnapshotRecord,
} from "./aiDiffContracts.ts";
import {
	asSnapshotRecord,
	getCharacterDiffName,
	getDiffItemKey,
	getLocationDiffName,
	normalizeDiffIdentity,
	snapshotsEqual,
} from "./aiDiffSnapshot.ts";

interface IndexedDiffItem {
	item: unknown;
	index: number;
}

interface SessionArrayDiffPolicy {
	path: string;
	getName: NameReader;
}

const SESSION_ARRAY_PATHS = [
	"notes",
	"npcs",
	"locations",
	"scenes",
	"encounters",
] as const;

const COVERED_SESSION_DATA_KEYS = new Set([
	"result_text",
	...SESSION_ARRAY_PATHS,
]);
const COVERED_SESSION_TOP_LEVEL_KEYS = new Set(["data", "name"]);

function createGranularDiff(
	resource: DiffWorkResource,
	suffix: string,
	before: unknown,
	after: unknown,
	meta: Partial<DiffWorkResource> = {},
): DiffWorkResource | null {
	if (snapshotsEqual(before, after)) return null;
	return {
		...resource,
		...meta,
		parentResourceId: resource.id,
		id: `${resource.id}:${suffix}`,
		label: `${resource.label}#${suffix}`,
		before: before === undefined ? null : before,
		after: after === undefined ? null : after,
	};
}

function indexDiffItems(
	value: unknown,
	getName: NameReader,
): Map<string, IndexedDiffItem> {
	const items = Array.isArray(value) ? value : [];
	return new Map(
		items.map((item, index) => [
			getDiffItemKey(item, index, getName),
			{ item, index },
		]),
	);
}

function getGranularArrayDiff(
	resource: DiffWorkResource,
	pathLabel: string,
	before: unknown,
	after: unknown,
	getName: NameReader,
): DiffWorkResource[] {
	const beforeByKey = indexDiffItems(before, getName);
	const afterByKey = indexDiffItems(after, getName);
	const keys = new Set([...beforeByKey.keys(), ...afterByKey.keys()]);
	return [...keys].flatMap((key) => {
		const beforeItem = beforeByKey.get(key)?.item;
		const afterEntry = afterByKey.get(key);
		const afterItem = afterEntry?.item;
		const labelRecord = asSnapshotRecord(afterItem ?? beforeItem) || {};
		const name = normalizeDiffIdentity(getName(labelRecord));
		const suffix = `${pathLabel}/${name || key}`;
		const diff = createGranularDiff(
			resource,
			suffix,
			beforeItem,
			afterItem,
			{ listIndex: afterEntry?.index ?? null },
		);
		return diff ? [diff] : [];
	});
}

function getSessionSnapshotData(snapshot: SnapshotRecord): SnapshotRecord {
	return asSnapshotRecord(snapshot.data) || {};
}

function getSessionArrayDiffPolicies(
	labels: DiffLabels,
): Record<(typeof SESSION_ARRAY_PATHS)[number], SessionArrayDiffPolicy> {
	return {
		notes: {
			path: "notes",
			getName: (note) => note.title || note.text || labels.note || "Note",
		},
		npcs: { path: "npcs", getName: getCharacterDiffName },
		locations: { path: "locations", getName: getLocationDiffName },
		scenes: {
			path: "scenes",
			getName: (scene) =>
				asSnapshotRecord(scene.texts)?.summary ||
				scene.name ||
				labels.scene ||
				"Scene",
		},
		encounters: {
			path: "encounters",
			getName: (encounter) =>
				encounter.name || labels.encounter || "Encounter",
		},
	};
}

function getUncoveredRecordDiffs(
	resource: DiffWorkResource,
	before: SnapshotRecord,
	after: SnapshotRecord,
	coveredKeys: ReadonlySet<string>,
	prefix = "",
): DiffWorkResource[] {
	const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
	return [...keys].flatMap((key) => {
		if (coveredKeys.has(key)) return [];
		const diff = createGranularDiff(
			resource,
			`${prefix}${key}`,
			before[key],
			after[key],
		);
		return diff ? [diff] : [];
	});
}

export function expandSessionDiffResource(
	resource: DiffWorkResource,
	labels: DiffLabels = {},
): DiffWorkResource[] {
	if (resource.kind !== "session" || (!resource.before && !resource.after)) {
		return [resource];
	}
	const before = asSnapshotRecord(resource.before) || {};
	const after = asSnapshotRecord(resource.after) || {};
	const beforeData = getSessionSnapshotData(before);
	const afterData = getSessionSnapshotData(after);
	const knownDiffs = [
		createGranularDiff(resource, "name", before.name, after.name),
		createGranularDiff(
			resource,
			"summary",
			beforeData.result_text,
			afterData.result_text,
		),
	].filter((diff): diff is DiffWorkResource => diff !== null);
	const policies = getSessionArrayDiffPolicies(labels);
	const arrayDiffs = SESSION_ARRAY_PATHS.flatMap((key) => {
		const policy = policies[key];
		return getGranularArrayDiff(
			resource,
			policy.path,
			beforeData[key],
			afterData[key],
			policy.getName,
		);
	});
	const extraDataDiffs = getUncoveredRecordDiffs(
		resource,
		beforeData,
		afterData,
		COVERED_SESSION_DATA_KEYS,
		"data.",
	);
	const extraTopLevelDiffs = getUncoveredRecordDiffs(
		resource,
		before,
		after,
		COVERED_SESSION_TOP_LEVEL_KEYS,
	);
	const expanded = [
		...knownDiffs,
		...arrayDiffs,
		...extraDataDiffs,
		...extraTopLevelDiffs,
	];
	return expanded.length > 0 ? expanded : [resource];
}

export function expandCustomBestiaryDiffResource(
	resource: DiffWorkResource,
	labels: DiffLabels = {},
): DiffWorkResource[] {
	if (
		resource.kind !== "custom-bestiary" ||
		(!Array.isArray(resource.before) && !Array.isArray(resource.after))
	) {
		return [resource];
	}
	const expanded = getGranularArrayDiff(
		resource,
		"monsters",
		resource.before,
		resource.after,
		(monster) => monster.name || labels.creature || "Creature",
	);
	return expanded.length > 0 ? expanded : [resource];
}
