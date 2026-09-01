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

interface SessionDiffSnapshots {
	before: SnapshotRecord;
	after: SnapshotRecord;
	beforeData: SnapshotRecord;
	afterData: SnapshotRecord;
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

function getGranularArrayItemSuffix(
	pathLabel: string,
	key: string,
	beforeItem: unknown,
	afterItem: unknown,
	getName: NameReader,
): string {
	const labelRecord = asSnapshotRecord(afterItem ?? beforeItem) || {};
	const name = normalizeDiffIdentity(getName(labelRecord));
	return `${pathLabel}/${name || key}`;
}

function createGranularArrayItemDiff(
	resource: DiffWorkResource,
	pathLabel: string,
	key: string,
	beforeByKey: Map<string, IndexedDiffItem>,
	afterByKey: Map<string, IndexedDiffItem>,
	getName: NameReader,
): DiffWorkResource | null {
	const beforeItem = beforeByKey.get(key)?.item;
	const afterEntry = afterByKey.get(key);
	const afterItem = afterEntry?.item;
	return createGranularDiff(
		resource,
		getGranularArrayItemSuffix(
			pathLabel,
			key,
			beforeItem,
			afterItem,
			getName,
		),
		beforeItem,
		afterItem,
		{ listIndex: afterEntry?.index ?? null },
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
		const diff = createGranularArrayItemDiff(
			resource,
			pathLabel,
			key,
			beforeByKey,
			afterByKey,
			getName,
		);
		return diff ? [diff] : [];
	});
}

function getSessionSnapshotData(snapshot: SnapshotRecord): SnapshotRecord {
	return asSnapshotRecord(snapshot.data) || {};
}

function getSessionDiffSnapshots(
	resource: DiffWorkResource,
): SessionDiffSnapshots {
	const before = asSnapshotRecord(resource.before) || {};
	const after = asSnapshotRecord(resource.after) || {};
	return {
		before,
		after,
		beforeData: getSessionSnapshotData(before),
		afterData: getSessionSnapshotData(after),
	};
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

function getKnownSessionDiffs(
	resource: DiffWorkResource,
	snapshots: SessionDiffSnapshots,
): DiffWorkResource[] {
	return [
		createGranularDiff(
			resource,
			"name",
			snapshots.before.name,
			snapshots.after.name,
		),
		createGranularDiff(
			resource,
			"summary",
			snapshots.beforeData.result_text,
			snapshots.afterData.result_text,
		),
	].filter((diff): diff is DiffWorkResource => diff !== null);
}

function getSessionArrayDiffs(
	resource: DiffWorkResource,
	snapshots: SessionDiffSnapshots,
	labels: DiffLabels,
): DiffWorkResource[] {
	const policies = getSessionArrayDiffPolicies(labels);
	return SESSION_ARRAY_PATHS.flatMap((key) => {
		const policy = policies[key];
		return getGranularArrayDiff(
			resource,
			policy.path,
			snapshots.beforeData[key],
			snapshots.afterData[key],
			policy.getName,
		);
	});
}

function getExtraSessionDiffs(
	resource: DiffWorkResource,
	snapshots: SessionDiffSnapshots,
): DiffWorkResource[] {
	return [
		...getUncoveredRecordDiffs(
			resource,
			snapshots.beforeData,
			snapshots.afterData,
			COVERED_SESSION_DATA_KEYS,
			"data.",
		),
		...getUncoveredRecordDiffs(
			resource,
			snapshots.before,
			snapshots.after,
			COVERED_SESSION_TOP_LEVEL_KEYS,
		),
	];
}

function getExpandedSessionDiffs(
	resource: DiffWorkResource,
	labels: DiffLabels,
): DiffWorkResource[] {
	const snapshots = getSessionDiffSnapshots(resource);
	return [
		...getKnownSessionDiffs(resource, snapshots),
		...getSessionArrayDiffs(resource, snapshots, labels),
		...getExtraSessionDiffs(resource, snapshots),
	];
}

function retainOriginalWhenEmpty(
	resource: DiffWorkResource,
	expanded: DiffWorkResource[],
): DiffWorkResource[] {
	return expanded.length > 0 ? expanded : [resource];
}

export function expandSessionDiffResource(
	resource: DiffWorkResource,
	labels: DiffLabels = {},
): DiffWorkResource[] {
	if (resource.kind !== "session" || (!resource.before && !resource.after)) {
		return [resource];
	}
	return retainOriginalWhenEmpty(
		resource,
		getExpandedSessionDiffs(resource, labels),
	);
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
	return retainOriginalWhenEmpty(resource, expanded);
}
