import { getDiffResourceState as getBaseDiffResourceState } from "./aiDiff.js";

export function getAiChangeResources(entry) {
	return Array.isArray(entry?.changes?.resources)
		? entry.changes.resources
		: [];
}

export function buildAiChangeSummary(resources = []) {
	return (Array.isArray(resources) ? resources : []).reduce(
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

export function getHistoryChangeSummary(entry, translate = (value) => value) {
	const resources = getAiChangeResources(entry);
	const summary = entry?.changes?.summary || {};
	const total = Number(summary.total) || resources.length || 0;
	if (!total) return "";
	const parts = [];
	if (summary.added) parts.push(`+${summary.added}`);
	if (summary.deleted) parts.push(`-${summary.deleted}`);
	if (summary.modified) parts.push(`~${summary.modified}`);
	return `${translate("Changes")}: ${parts.length ? parts.join(" ") : total}`;
}

export function getLocalizedDiffResourceState(
	resource,
	translate = (value) => value,
) {
	return getBaseDiffResourceState(resource, {
		added: translate("Added"),
		deleted: translate("Deleted"),
		modified: translate("Modified"),
	});
}

export function getCustomMonsterResource(entry, resourceIds = null) {
	const ids = Array.isArray(resourceIds)
		? new Set(resourceIds.map((id) => String(id || "")).filter(Boolean))
		: null;
	return getAiChangeResources(entry).find(
		(resource) =>
			resource?.kind === "custom-monster" && (!ids || ids.has(resource.id)),
	);
}

export function getFirstChangedMonster(entry, resourceIds = null) {
	return getCustomMonsterResource(entry, resourceIds)?.after || null;
}

export function getFirstChangedMonsterName(entry, resourceIds = null) {
	const resource = getCustomMonsterResource(entry, resourceIds);
	return (
		resource?.after?.name || resource?.before?.name || resource?.name || null
	);
}

export function getMonsterTokenImageUrl(monster) {
	if (!monster) return "";
	if (monster.imageUrl) return monster.imageUrl;
	const source = String(monster.source || "").trim();
	const name = String(
		monster.originalBestiaryName || monster.name || "",
	).trim();
	if (!source || !name) return "";
	return `/api/bestiary/tokens/${encodeURIComponent(source)}/${encodeURIComponent(name)}.webp`;
}

export function addSourceMonsterImageToDraft(entry, sourceMonster) {
	if (!entry || !sourceMonster) return entry;
	const imageUrl = getMonsterTokenImageUrl(sourceMonster);
	if (!imageUrl) return entry;
	const resources = getAiChangeResources(entry);
	let changed = false;
	const nextResources = resources.map((resource) => {
		if (
			resource?.kind !== "custom-monster" ||
			resource.before !== null ||
			!resource.after ||
			resource.after.imageUrl
		) {
			return resource;
		}
		changed = true;
		return {
			...resource,
			after: {
				...resource.after,
				imageUrl,
				originalBestiaryName:
					resource.after.originalBestiaryName || sourceMonster.name,
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

export function updateDraftResourceAfterValues(entry, resources) {
	if (!entry?.id) return null;
	const afterById = new Map(
		(Array.isArray(resources) ? resources : []).map((resource) => [
			String(resource.id || ""),
			resource.after ?? null,
		]),
	);
	const nextResources = getAiChangeResources(entry).map((resource) =>
		afterById.has(resource.id)
			? { ...resource, after: afterById.get(resource.id) }
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
	entry,
	route = {},
	{ isBestiary = false } = {},
) {
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
