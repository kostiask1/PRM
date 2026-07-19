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

export function getHistoryChangeSummary(
	entry: AiHistoryEntry | null | undefined,
	translate: Translate = (value) => value,
): string {
	const resources = getAiChangeResources(entry);
	const summary = entry?.changes?.summary || {};
	const total = Number(summary.total) || resources.length || 0;
	if (!total) return "";
	const parts: string[] = [];
	if (summary.added) parts.push(`+${summary.added}`);
	if (summary.deleted) parts.push(`-${summary.deleted}`);
	if (summary.modified) parts.push(`~${summary.modified}`);
	return `${translate("Changes")}: ${parts.length ? parts.join(" ") : total}`;
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
	const ids = Array.isArray(resourceIds)
		? new Set(resourceIds.map((id) => String(id || "")).filter(Boolean))
		: null;
	return getAiChangeResources(entry).find(
		(resource) =>
			resource.kind === "custom-monster" &&
			(!ids || ids.has(String(resource.id))),
	);
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
	const after = asRecord(resource?.after);
	const before = asRecord(resource?.before);
	const name = after?.name || before?.name || resource?.name;
	return typeof name === "string" ? name : null;
}

function getMonsterTokenImageUrl(monster: MonsterRecord | null | undefined) {
	if (!monster) return "";
	if (typeof monster.imageUrl === "string" && monster.imageUrl) {
		return monster.imageUrl;
	}
	const source = String(monster.source || "").trim();
	const name = String(monster.originalBestiaryName || monster.name || "").trim();
	if (!source || !name) return "";
	return `/api/bestiary/tokens/${encodeURIComponent(source)}/${encodeURIComponent(name)}.webp`;
}

export function addSourceMonsterImageToDraft(
	entry: AiHistoryEntry | null | undefined,
	sourceMonster: MonsterRecord | null | undefined,
): AiHistoryEntry | null | undefined {
	if (!entry || !sourceMonster) return entry;
	const imageUrl = getMonsterTokenImageUrl(sourceMonster);
	if (!imageUrl) return entry;
	const resources = getAiChangeResources(entry);
	let changed = false;
	const nextResources = resources.map((resource) => {
		const after = asRecord(resource.after);
		if (
			resource.kind !== "custom-monster" ||
			resource.before !== null ||
			!after ||
			after.imageUrl
		) {
			return resource;
		}
		changed = true;
		return {
			...resource,
			after: {
				...after,
				imageUrl,
				originalBestiaryName:
					after.originalBestiaryName || sourceMonster.name,
			},
		};
	});
	if (!changed) return entry;
	return {
		...entry,
		changes: {
			...(entry.changes || {}),
			resources: nextResources,
			summary: entry.changes?.summary || buildAiChangeSummary(nextResources),
		},
	};
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
	if (entryPath.encounter) {
		return (
			entryPath.campaign === route.campaign &&
			entryPath.session === route.session &&
			entryPath.encounter === route.encounter
		);
	}
	return true;
}
