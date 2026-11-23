import type { AiHistoryResource } from "../../../features/ai/index.js";

export type SnapshotRecord = Record<string, unknown>;

export interface PreviewResource extends AiHistoryResource {
	label?: string;
	fieldSummary?: string[];
	parentResourceId?: string;
	listIndex?: number | null;
	applyState?: string;
}

export interface EncounterParticipantEntry {
	key: string;
	index: number;
	participant: SnapshotRecord;
}

export interface CardHighlightFields {
	fields: string[];
	notes: Record<string, string[]>;
}

interface SnapshotPair {
	before?: unknown;
	after?: unknown;
}

export function snapshotToText(value: unknown): string {
	if (value === null || value === undefined) return "";
	return JSON.stringify(value, null, 2);
}

export function parseSnapshotText(
	text: unknown,
	allowNull = false,
	emptyMessage = "Draft value cannot be empty.",
): unknown {
	const trimmed = String(text || "").trim();
	if (!trimmed) {
		if (allowNull) return null;
		throw new Error(emptyMessage);
	}
	return JSON.parse(trimmed) as unknown;
}

export function isObjectSnapshot(value: unknown): value is SnapshotRecord {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function snapshotsEqual(before: unknown, after: unknown): boolean {
	return JSON.stringify(before ?? null) === JSON.stringify(after ?? null);
}

export function formatFieldValue(value: unknown): string {
	if (value === null || value === undefined || value === "") return "—";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	return JSON.stringify(value, null, 2);
}

export function formatComparisonFieldValue(field: string | undefined, value: unknown): string {
	if (field === "hp" && isObjectSnapshot(value)) {
		const keys = Object.keys(value);
		if (keys.every((key) => key === "average" || key === "formula") && typeof value.average === "number" && (value.formula === undefined || (typeof value.formula === "string" && value.formula.length > 0))) {
			return value.formula === undefined ? String(value.average) : `${value.average} (${value.formula})`;
		}
	}
	if (field === "ac" && Array.isArray(value) && value.length === 1) {
		const entry = value[0];
		if (typeof entry === "number") return String(entry);
		if (isObjectSnapshot(entry) && Object.keys(entry).every((key) => key === "ac" || key === "from") && typeof entry.ac === "number") {
			if (entry.from === undefined) return String(entry.ac);
			if (Array.isArray(entry.from) && entry.from.length > 0 && entry.from.every((source) => typeof source === "string" && source.length > 0)) {
				return `${entry.ac} (${entry.from.join(", ")})`;
			}
		}
	}
	return formatFieldValue(value);
}

export function isFieldEmpty(value: unknown): boolean {
	if (value === null || value === undefined || value === "") return true;
	if (Array.isArray(value) && value.length === 0) return true;
	return false;
}

export const PREVIEW_IGNORED_KEYS = new Set([
	"id",
	"slug",
	"source",
	"createdAt",
	"collapsed",
	"isNotesCollapsed",
	"isDescriptionCollapsed",
	"isCharactersCollapsed",
	"isNpcsCollapsed",
	"isLocationsCollapsed",
]);
export const CARD_IGNORED_KEYS = new Set([
	...PREVIEW_IGNORED_KEYS,
]);

function getChangedKeys(
	before: unknown,
	after: unknown,
	ignoredKeys: ReadonlySet<string>,
): string[] {
	if (!isObjectSnapshot(before) || !isObjectSnapshot(after)) return [];
	return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
		(key) => {
			if (ignoredKeys.has(key)) return false;
			if (
				key === "armor_class" &&
				!isFieldEmpty(before.ac) &&
				!isFieldEmpty(after.ac) &&
				snapshotsEqual(before.ac, after.ac)
			) {
				return false;
			}
			if (
				key === "hit_points" &&
				!isFieldEmpty(before.hp) &&
				!isFieldEmpty(after.hp) &&
				snapshotsEqual(before.hp, after.hp)
			) {
				return false;
			}
			const bVal = before[key];
			const aVal = after[key];
			if (isFieldEmpty(bVal) && isFieldEmpty(aVal)) return false;
			return !snapshotsEqual(bVal, aVal);
		},
	);
}

export function getPreviewFieldKeys(
	before: unknown,
	after: unknown,
	summary: string[] = [],
): string[] {
	if (!isObjectSnapshot(before) || !isObjectSnapshot(after)) return ["value"];
	const keys = getChangedKeys(before, after, PREVIEW_IGNORED_KEYS);
	return keys.length > 0 ? keys : summary.filter((key) => !PREVIEW_IGNORED_KEYS.has(key));
}

export function getFieldValue(snapshot: unknown, key: string, wholeSnapshot = false): unknown {
	if (wholeSnapshot) return snapshot;
	if (isObjectSnapshot(snapshot)) return snapshot[key];
	if (key === "value") return snapshot;
	return undefined;
}

export function getChangedObjectKeys(before: unknown, after: unknown): string[] {
	return getChangedKeys(before, after, CARD_IGNORED_KEYS);
}

export type PreviewCardType = "monster" | "character" | "location" | null;

function getExplicitPreviewCardType(resource: PreviewResource): PreviewCardType {
	if (resource.kind === "custom-monster") return "monster";
	if (resource.kind !== "entity") return null;
	if (resource.type === "characters" || resource.type === "npc") return "character";
	return resource.type === "locations" ? "location" : null;
}

function getIdPreviewCardType(resourceId: string | number): PreviewCardType {
	const id = String(resourceId || "").toLowerCase();
	if (id.includes(":npcs/") || id.includes(":characters/")) return "character";
	return id.includes(":locations/") ? "location" : null;
}

export function getPreviewCardType(resource: PreviewResource): PreviewCardType {
	return getExplicitPreviewCardType(resource) || getIdPreviewCardType(resource.id);
}

export function getCardEntityType(
	resource: PreviewResource,
): "npc" | "characters" {
	if (resource?.type === "npc") return "npc";
	if (resource?.type === "characters") return "characters";
	return String(resource?.id || "").toLowerCase().includes(":npcs/")
		? "npc"
		: "characters";
}

export function isNoteSnapshot(value: unknown): boolean {
	return (
		isObjectSnapshot(value) &&
		(hasOwn(value, "text") || hasOwn(value, "title")) &&
		!hasOwn(value, "firstName") &&
		!hasOwn(value, "name")
	);
}

export function isNoteResource(resource: PreviewResource): boolean {
	const id = String(resource?.id || "").toLowerCase();
	return (
		id.includes(":notes/") ||
		id.includes(":note/") ||
		isNoteSnapshot(resource?.before) ||
		isNoteSnapshot(resource?.after)
	);
}

export function isEncounterResource(resource: PreviewResource): boolean {
	return (
		resource?.kind === "session" &&
		String(resource?.id || "").toLowerCase().includes(":encounters/")
	);
}

export function getEncounterParticipants(snapshot: unknown): SnapshotRecord[] {
	if (!isObjectSnapshot(snapshot) || !Array.isArray(snapshot.monsters)) return [];
	return snapshot.monsters.filter(isObjectSnapshot);
}

export function getEncounterParticipantName(
	participant: SnapshotRecord = {},
	fallbackName = "Creature",
): string {
	return String(
		participant.name ||
			participant.originalBestiaryName ||
			participant.title ||
			fallbackName,
	).trim();
}

function getEncounterParticipantBaseKey(participant: SnapshotRecord): string {
	const type = String(participant.participantType || "monster").trim().toLowerCase();
	const id = String(participant.id || participant.instanceId || "").trim();
	if (id) return `${type}:id:${id}`;
	const source = String(participant.source || "").trim().toLowerCase();
	return `${type}:name:${getEncounterParticipantName(participant).toLowerCase()}:${source}`;
}

export function getEncounterParticipantEntries(
	list: unknown,
): EncounterParticipantEntry[] {
	const counts = new Map<string, number>();
	return (Array.isArray(list) ? list : [])
		.filter(isObjectSnapshot)
		.map((participant, index) => {
			const baseKey = getEncounterParticipantBaseKey(participant);
			const nextCount = (counts.get(baseKey) || 0) + 1;
			counts.set(baseKey, nextCount);
			return { key: `${baseKey}:${nextCount}`, index, participant };
		});
}

export function getEncounterParticipantHp(
	participant: SnapshotRecord = {},
): unknown {
	if (participant.currentHp !== undefined && participant.currentHp !== null) {
		return participant.currentHp;
	}
	if (participant.hit_points !== undefined && participant.hit_points !== null) {
		return participant.hit_points;
	}
	if (isObjectSnapshot(participant.hp)) {
		return participant.hp.average ?? participant.hp.special ?? "";
	}
	return "";
}

export function getEncounterParticipantAc(
	participant: SnapshotRecord = {},
): unknown {
	if (participant.armor_class !== undefined && participant.armor_class !== null) {
		return participant.armor_class;
	}
	if (!Array.isArray(participant.ac) || participant.ac.length === 0) return "";
	const first = participant.ac[0];
	return isObjectSnapshot(first) ? first.ac : first;
}

export function getEncounterParticipantMeta(
	participant: SnapshotRecord = {},
	formatSource: (source: unknown) => string = (source) => String(source || ""),
): string {
	const ac = getEncounterParticipantAc(participant);
	const hp = getEncounterParticipantHp(participant);
	const challenge = participant.cr || participant.challenge;
	return [
		formatSource(participant.source),
		ac ? `AC ${String(ac)}` : "",
		hp ? `HP ${String(hp)}` : "",
		challenge ? `CR ${String(challenge)}` : "",
	]
		.filter(Boolean)
		.join(" / ");
}

const ENCOUNTER_PARTICIPANT_STAT_IGNORED_KEYS = new Set([
	"instanceId",
	"currentHp",
	"originalBestiaryName",
	"originalCharacterId",
	"originalCharacterSlug",
	"participantType",
]);

function getEncounterMonsterStatSnapshot(
	participant: unknown,
): SnapshotRecord | null {
	if (!isObjectSnapshot(participant)) return null;
	return Object.fromEntries(
		Object.entries(participant).filter(
			([key]) => !ENCOUNTER_PARTICIPANT_STAT_IGNORED_KEYS.has(key),
		),
	);
}

export function encounterMonsterStatsChanged(before: unknown, after: unknown): boolean {
	if (!before || !after) return false;
	return !snapshotsEqual(
		getEncounterMonsterStatSnapshot(before),
		getEncounterMonsterStatSnapshot(after),
	);
}

export function getNoteDiffKey(note: unknown, index: number): string {
	if (isObjectSnapshot(note)) {
		const id = String(note.id ?? "").trim();
		if (id) return `id:${id}`;
		const signature = `${String(note.title || "").trim()}\n${String(note.text || "").trim()}`;
		if (signature.trim()) return `content:${signature}`;
	}
	return `index:${index}`;
}

export function buildNoteHighlightMap(
	beforeNotes: unknown,
	afterNotes: unknown,
): Record<string, string[]> {
	const beforeList = Array.isArray(beforeNotes) ? beforeNotes : [];
	const afterList = Array.isArray(afterNotes) ? afterNotes : [];
	const beforeByKey = new Map(
		beforeList.map((note, index) => [getNoteDiffKey(note, index), note]),
	);
	const highlights: Record<string, string[]> = {};
	afterList.forEach((note, index) => {
		const before = beforeByKey.get(getNoteDiffKey(note, index));
		const changedFields = ["title", "text"].filter(
			(field) =>
				!snapshotsEqual(
					isObjectSnapshot(before) ? before[field] : undefined,
					isObjectSnapshot(note) ? note[field] : undefined,
				),
		);
		if (changedFields.length === 0 || !isObjectSnapshot(note)) return;
		const id = String(note.id ?? "").trim();
		if (id) highlights[id] = changedFields;
		const title = String(note.title || "").trim();
		if (title) highlights[title] = changedFields;
	});
	return highlights;
}

export function buildCardHighlightFields(
	resource: SnapshotPair,
): CardHighlightFields {
	const before = isObjectSnapshot(resource.before) ? resource.before : {};
	const after = isObjectSnapshot(resource.after) ? resource.after : {};
	return {
		fields: getChangedObjectKeys(before, after).filter((key) => key !== "notes"),
		notes: buildNoteHighlightMap(before.notes, after.notes),
	};
}

export function cloneSnapshot<T>(value: T): T {
	return JSON.parse(JSON.stringify(value ?? null)) as T;
}

export function hasOwn(object: unknown, key: string): boolean {
	return isObjectSnapshot(object) && Object.prototype.hasOwnProperty.call(object, key);
}

export function buildNoteHighlightFields(resource: SnapshotPair): string[] {
	const before = isObjectSnapshot(resource.before) ? resource.before : {};
	const after = isObjectSnapshot(resource.after) ? resource.after : {};
	return ["title", "text"].filter(
		(field) => !snapshotsEqual(before[field], after[field]),
	);
}

export const isResourceApplied = (resource: PreviewResource): boolean =>
	resource?.applyState === "applied";

export const isResourceUndone = (resource: PreviewResource): boolean =>
	resource?.applyState === "undone";

function findListItemIndex(list: unknown[], originalItem: unknown, index: number | null): number {
	const original = isObjectSnapshot(originalItem) ? originalItem : {};
	for (const key of ["id", "instanceId"] as const) {
		const originalValue = original[key];
		if (originalValue === null || originalValue === undefined || String(originalValue) === "") continue;
		const match = list.findIndex((item) => isObjectSnapshot(item) && item[key] !== null && item[key] !== undefined && String(item[key]) === String(originalValue));
		return match;
	}
	if (Number.isInteger(index) && index !== null && index >= 0 && index < list.length) return index;
	return list.findIndex((item) => snapshotsEqual(item, originalItem));
}

export function findEditedListItem(
	list: unknown,
	originalItem: unknown,
	index: number | null = null,
): unknown {
	const items = Array.isArray(list) ? list : [];
	return items[findListItemIndex(items, originalItem, index)];
}

export function findDraftResourceForPreview(
	draftResources: PreviewResource[],
	resource: PreviewResource,
	isDraft: boolean,
): PreviewResource | null {
	if (!isDraft) return null;
	const parentResourceId = String(resource.parentResourceId || "");
	return (
		draftResources.find((item) => item.id === resource.id) ||
		(parentResourceId
			? draftResources.find((item) => item.id === parentResourceId)
			: null) ||
		draftResources.find((item) =>
			String(resource.id || "").startsWith(`${String(item.id)}:`),
		) ||
		null
	);
}

export function getEditedResourceAfterFromParent(
	parentResource: PreviewResource | null,
	resource: PreviewResource,
): unknown {
	if (!parentResource || parentResource.id === resource.id) return parentResource?.after;
	if (!isNestedResourceOf(parentResource, resource)) return undefined;
	const parentResourceId = String(resource.parentResourceId || parentResource.id || "");
	const suffix = String(resource.id).slice(parentResourceId.length + 1);
	return getNestedResourceAfter(parentResource, resource, suffix);
}

const SESSION_LIST_SECTIONS = new Set(["notes", "npcs", "locations", "scenes", "encounters"]);

function isNestedResourceOf(
	parentResource: PreviewResource,
	resource: PreviewResource,
): boolean {
	if (resource.parentResourceId) return parentResource.id === resource.parentResourceId;
	return String(resource.id || "").startsWith(`${String(parentResource.id)}:`);
}

function getSessionResourceAfter(
	parentAfter: SnapshotRecord | null,
	resource: PreviewResource,
	suffix: string,
): unknown {
	if (!isObjectSnapshot(parentAfter?.data)) return undefined;
	const [section] = suffix.split("/");
	if (!SESSION_LIST_SECTIONS.has(section)) return undefined;
	return findEditedListItem(parentAfter.data[section], resource.after, resource.listIndex);
}

function getNestedResourceAfter(
	parentResource: PreviewResource,
	resource: PreviewResource,
	suffix: string,
): unknown {
	const parentAfter = isObjectSnapshot(parentResource.after) ? parentResource.after : null;
	if (parentResource.kind === "session") {
		return getSessionResourceAfter(parentAfter, resource, suffix);
	}
	if (isNestedNoteResource(parentResource, suffix)) {
		return findEditedListItem(parentAfter?.notes, resource.after, resource.listIndex);
	}
	if (isNestedBestiaryResource(parentResource, suffix)) {
		return findEditedListItem(parentResource.after, resource.after, resource.listIndex);
	}
	return undefined;
}

function isNestedNoteResource(resource: PreviewResource, suffix: string): boolean {
	const isNoteParent = resource.kind === "campaign" || resource.kind === "entity";
	return isNoteParent && (suffix.startsWith("note:") || suffix.startsWith("notes/"));
}

function isNestedBestiaryResource(resource: PreviewResource, suffix: string): boolean {
	return resource.kind === "custom-bestiary" && suffix.startsWith("monsters/");
}

export function getEditedPreviewResource(
	resource: PreviewResource,
	draftResource: PreviewResource | null,
): PreviewResource {
	if (!draftResource) return resource;
	if (draftResource.id === resource.id) return draftResource;
	const editedAfter = getEditedResourceAfterFromParent(draftResource, resource);
	return editedAfter === undefined ? resource : { ...resource, after: editedAfter };
}

export function replaceItemInList(
	list: unknown,
	beforeItem: unknown,
	nextItem: unknown,
	index: number | null = null,
): unknown[] {
	const items = Array.isArray(list) ? list : [];
	const targetIndex = findListItemIndex(items, beforeItem, index);
	return items.map((item, itemIndex) => itemIndex === targetIndex ? nextItem : item);
}

function updateSessionDraftAfter(
	after: SnapshotRecord,
	resource: PreviewResource,
	nextSnapshot: unknown,
	suffix: string,
): SnapshotRecord {
	if (!isObjectSnapshot(after.data)) return after;
	const [section] = suffix.split("/");
	if (!SESSION_LIST_SECTIONS.has(section)) return after;
	after.data[section] = replaceItemInList(
		after.data[section], resource.after, nextSnapshot, resource.listIndex,
	);
	return after;
}

function updateNoteDraftAfter(
	after: SnapshotRecord,
	resource: PreviewResource,
	nextSnapshot: unknown,
): SnapshotRecord {
	after.notes = replaceItemInList(
		after.notes, resource.after, nextSnapshot, resource.listIndex,
	);
	return after;
}

function updateNestedDraftResource(
	item: PreviewResource,
	resource: PreviewResource,
	nextSnapshot: unknown,
): PreviewResource {
	const parentResourceId = String(resource.parentResourceId || item.id);
	const suffix = String(resource.id).slice(parentResourceId.length + 1);
	if (isNestedBestiaryResource(item, suffix)) {
		return {
			...item,
			after: replaceItemInList(item.after, resource.after, nextSnapshot, resource.listIndex),
		};
	}
	const nextAfter = isObjectSnapshot(item.after) ? cloneSnapshot(item.after) : {};
	if (item.kind === "session") {
		return { ...item, after: updateSessionDraftAfter(nextAfter, resource, nextSnapshot, suffix) };
	}
	if (isNestedNoteResource(item, suffix)) {
		return { ...item, after: updateNoteDraftAfter(nextAfter, resource, nextSnapshot) };
	}
	return { ...item, after: nextAfter };
}

function updateDraftResource(
	item: PreviewResource,
	resource: PreviewResource,
	nextSnapshot: unknown,
): PreviewResource {
	if (item.id === resource.id) return { ...item, after: nextSnapshot };
	return isNestedResourceOf(item, resource)
		? updateNestedDraftResource(item, resource, nextSnapshot)
		: item;
}

export function updateDraftResourceCollection(
	current: PreviewResource[],
	resource: PreviewResource,
	nextSnapshot: unknown,
): PreviewResource[] {
	return current.map((item) => updateDraftResource(item, resource, nextSnapshot));
}

export function getHistoryResourceId(
	resources: PreviewResource[],
	resource: PreviewResource,
): string | number {
	return (
		resources.find((item) => item.id === resource.id)?.id ||
		resources.find((item) =>
			String(resource.id || "").startsWith(`${String(item.id)}:`),
		)?.id ||
		resource.id
	);
}
