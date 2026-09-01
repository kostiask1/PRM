import type {
	AiChangeSummary,
	AiHistoryEntry,
	AiHistoryResource,
} from "../api/aiApi.ts";
import { getDiffResourceState as getBaseDiffResourceState } from "./aiDiff.ts";

type Translate = (value: string) => string;
type MonsterRecord = Record<string, unknown> & { name?: string };

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function buildAiChangeSummary(
	resources: AiHistoryResource[] = [],
): AiChangeSummary {
	return resources.reduce<AiChangeSummary>(
		(summary, resource) => {
			if (resource.before === null && resource.after !== null) {
				summary.added += 1;
			} else if (resource.before !== null && resource.after === null) {
				summary.deleted += 1;
			} else {
				summary.modified += 1;
			}
			summary.total += 1;
			return summary;
		},
		{ added: 0, deleted: 0, modified: 0, total: 0 },
	);
}

function getAiChangeResources(
	entry: AiHistoryEntry | null | undefined,
): AiHistoryResource[] {
	return Array.isArray(entry?.changes?.resources)
		? entry.changes.resources
		: [];
}

function getRequestedResourceIds(
	resourceIds: Array<string | number> | null,
): Set<string> | null {
	if (!Array.isArray(resourceIds)) return null;
	return new Set(
		resourceIds.map((id) => String(id || "")).filter(Boolean),
	);
}

function isRequestedResource(
	resource: AiHistoryResource,
	resourceIds: Set<string> | null,
): boolean {
	return resourceIds === null || resourceIds.has(String(resource.id));
}

export function getLocalizedDiffResourceState(
	resource: AiHistoryResource,
	translate: Translate = (value) => value,
): string {
	return getBaseDiffResourceState(resource, {
		added: translate("Added"),
		deleted: translate("Deleted"),
		modified: translate("Modified"),
	});
}

function getCustomMonsterResource(
	entry: AiHistoryEntry | null | undefined,
	resourceIds: Array<string | number> | null = null,
): AiHistoryResource | undefined {
	const ids = getRequestedResourceIds(resourceIds);
	return getAiChangeResources(entry).find(
		(resource) =>
			resource.kind === "custom-monster" &&
			isRequestedResource(resource, ids),
	);
}

function getPreferredMonsterName(
	resource: AiHistoryResource | undefined,
): unknown {
	return [
		asRecord(resource?.after)?.name,
		asRecord(resource?.before)?.name,
		resource?.name,
	].find(Boolean);
}

export function getFirstChangedMonster(
	entry: AiHistoryEntry | null | undefined,
	resourceIds: Array<string | number> | null = null,
): unknown {
	return getCustomMonsterResource(entry, resourceIds)?.after ?? null;
}

export function getFirstChangedMonsterName(
	entry: AiHistoryEntry | null | undefined,
	resourceIds: Array<string | number> | null = null,
): string | null {
	const resource = getCustomMonsterResource(entry, resourceIds);
	const name = getPreferredMonsterName(resource);
	return typeof name === "string" ? name : null;
}

function getExplicitMonsterImageUrl(
	monster: MonsterRecord | null | undefined,
): string {
	return typeof monster?.imageUrl === "string" ? monster.imageUrl : "";
}

function getMonsterTokenSource(
	monster: MonsterRecord | null | undefined,
): string {
	return String(monster?.source || "").trim();
}

function getMonsterTokenName(
	monster: MonsterRecord | null | undefined,
): string {
	return String(monster?.originalBestiaryName || monster?.name || "").trim();
}

function buildMonsterTokenImageUrl(source: string, name: string): string {
	return source && name
		? `/api/bestiary/tokens/${encodeURIComponent(source)}/${encodeURIComponent(name)}.webp`
		: "";
}

function getMonsterTokenImageUrl(
	monster: MonsterRecord | null | undefined,
): string {
	return (
		getExplicitMonsterImageUrl(monster) ||
		buildMonsterTokenImageUrl(
			getMonsterTokenSource(monster),
			getMonsterTokenName(monster),
		)
	);
}

function addMonsterImageToDraftResource(
	resource: AiHistoryResource,
	imageUrl: string,
	sourceMonsterName: string | undefined,
): AiHistoryResource {
	const after = asRecord(resource.after);
	if (
		resource.kind !== "custom-monster" ||
		resource.before !== null ||
		!after ||
		after.imageUrl
	) {
		return resource;
	}
	return {
		...resource,
		after: {
			...after,
			imageUrl,
			originalBestiaryName: after.originalBestiaryName || sourceMonsterName,
		},
	};
}

function resourcesChanged(
	resources: AiHistoryResource[],
	nextResources: AiHistoryResource[],
): boolean {
	return nextResources.some((resource, index) => resource !== resources[index]);
}

function addMonsterImageToDraftResources(
	resources: AiHistoryResource[],
	imageUrl: string,
	sourceMonsterName: string | undefined,
): AiHistoryResource[] {
	return resources.map((resource) =>
		addMonsterImageToDraftResource(resource, imageUrl, sourceMonsterName),
	);
}

function buildEntryWithDraftResources(
	entry: AiHistoryEntry,
	resources: AiHistoryResource[],
): AiHistoryEntry {
	return {
		...entry,
		changes: {
			...(entry.changes || {}),
			resources,
			summary: entry.changes?.summary || buildAiChangeSummary(resources),
		},
	};
}

export function addSourceMonsterImageToDraft(
	entry: AiHistoryEntry | null | undefined,
	sourceMonster: MonsterRecord | null | undefined,
): AiHistoryEntry | null | undefined {
	if (!entry) return entry;
	const imageUrl = getMonsterTokenImageUrl(sourceMonster);
	if (!imageUrl) return entry;
	const resources = getAiChangeResources(entry);
	const nextResources = addMonsterImageToDraftResources(
		resources,
		imageUrl,
		sourceMonster?.name,
	);
	if (!resourcesChanged(resources, nextResources)) return entry;
	return buildEntryWithDraftResources(entry, nextResources);
}

function isEncounterRouteMatch(
	entryPath: NonNullable<AiHistoryEntry["path"]>,
	route: {
		campaign?: string | null;
		session?: string | null;
		encounter?: string | number | null;
	},
): boolean {
	return (
		entryPath.campaign === route.campaign &&
		entryPath.session === route.session &&
		entryPath.encounter === route.encounter
	);
}

export function updateDraftResourceAfterValues(
	entry: AiHistoryEntry | null | undefined,
	resources: AiHistoryResource[] | null | undefined,
): AiHistoryEntry | null {
	if (!entry?.id) return null;
	const afterById = new Map(
		(Array.isArray(resources) ? resources : []).map((resource) => [
			String(resource.id || ""),
			resource.after ?? null,
		]),
	);
	const nextResources = getAiChangeResources(entry).map((resource) =>
		afterById.has(String(resource.id))
			? { ...resource, after: afterById.get(String(resource.id)) }
			: resource,
	);
	return {
		...entry,
		changes: {
			...(entry.changes || {}),
			resources: nextResources,
			summary: buildAiChangeSummary(nextResources),
		},
	};
}

export function isAiResponseVisibleForRoute(
	entry: AiHistoryEntry | null | undefined,
	route: {
		campaign?: string | null;
		session?: string | null;
		encounter?: string | number | null;
	} = {},
	{ isBestiary = false }: { isBestiary?: boolean } = {},
): boolean {
	const entryPath = entry?.path || {};
	if (entryPath.campaign === "bestiary") return isBestiary;
	return !entryPath.encounter || isEncounterRouteMatch(entryPath, route);
}
