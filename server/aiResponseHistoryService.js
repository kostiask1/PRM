const fs = require("fs/promises");
const path = require("path");

const storage = require("./storage");
const { formatGeneratedContentForHistory } = require("./aiHistoryService");

function cloneSnapshotValue(value) {
	if (value === undefined) return null;
	return JSON.parse(JSON.stringify(value));
}

function snapshotValueChanged(before, after) {
	return JSON.stringify(before ?? null) !== JSON.stringify(after ?? null);
}

function getEntityResourceLabel(campaignSlug, type, slug) {
	return `${campaignSlug}/${type}/${slug}/info.json`;
}

function buildAiChangeSummary(resources) {
	return resources.reduce(
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

function pushAiChange(resources, resource) {
	if (!snapshotValueChanged(resource.before, resource.after)) return;
	resources.push({
		...resource,
		before: cloneSnapshotValue(resource.before),
		after: cloneSnapshotValue(resource.after),
	});
}

function buildAiChangeSet(beforeBundle, afterBundle, campaignSlug) {
	if (!beforeBundle || !afterBundle) {
		return { resources: [], summary: buildAiChangeSummary([]) };
	}

	const resources = [];
	pushAiChange(resources, {
		id: `campaign:${campaignSlug}`,
		kind: "campaign",
		campaign: campaignSlug,
		label: `${campaignSlug}/_campaign.json`,
		before: beforeBundle.meta ?? null,
		after: afterBundle.meta ?? null,
	});

	const beforeSessions = new Map(
		(beforeBundle.sessions || []).map((session) => [
			session.fileName,
			session.content,
		]),
	);
	const afterSessions = new Map(
		(afterBundle.sessions || []).map((session) => [
			session.fileName,
			session.content,
		]),
	);
	for (const fileName of new Set([
		...beforeSessions.keys(),
		...afterSessions.keys(),
	])) {
		pushAiChange(resources, {
			id: `session:${fileName}`,
			kind: "session",
			campaign: campaignSlug,
			fileName,
			label: `${campaignSlug}/sessions/${fileName}`,
			before: beforeSessions.has(fileName) ? beforeSessions.get(fileName) : null,
			after: afterSessions.has(fileName) ? afterSessions.get(fileName) : null,
		});
	}

	for (const type of storage.ENTITY_TYPES) {
		const beforeEntities = new Map(
			(beforeBundle.entities?.[type] || []).map((entity) => [
				entity.slug,
				entity,
			]),
		);
		const afterEntities = new Map(
			(afterBundle.entities?.[type] || []).map((entity) => [
				entity.slug,
				entity,
			]),
		);
		for (const slug of new Set([
			...beforeEntities.keys(),
			...afterEntities.keys(),
		])) {
			pushAiChange(resources, {
				id: `entity:${type}:${slug}`,
				kind: "entity",
				campaign: campaignSlug,
				type,
				slug,
				label: getEntityResourceLabel(campaignSlug, type, slug),
				before: beforeEntities.has(slug) ? beforeEntities.get(slug) : null,
				after: afterEntities.has(slug) ? afterEntities.get(slug) : null,
			});
		}
	}

	resources.sort((a, b) => a.label.localeCompare(b.label, "uk"));
	return {
		resources,
		summary: buildAiChangeSummary(resources),
	};
}

async function saveParsedAiResponse({
	beforeApplyBundle,
	generatedContent,
	path: responsePath,
	type,
	modelName,
	language,
	userInstructions,
	requestSnapshot,
	retryPayload = null,
	extraChangeResources = [],
}) {
	const afterApplyBundle = await storage.exportCampaignBundle(responsePath.campaign);
	const changes = buildAiChangeSet(
		beforeApplyBundle,
		afterApplyBundle,
		responsePath.campaign,
	);
	if (Array.isArray(extraChangeResources) && extraChangeResources.length > 0) {
		changes.resources.push(...extraChangeResources);
		changes.resources.sort((a, b) =>
			String(a.label || a.id || "").localeCompare(
				String(b.label || b.id || ""),
				"uk",
			),
		);
		changes.summary = buildAiChangeSummary(changes.resources);
	}
	const appliedAt = new Date().toISOString();
	return storage.addAiResponse({
		text: formatGeneratedContentForHistory(generatedContent),
		path: responsePath,
		type,
		modelName,
		language,
		userInstructions,
		request: requestSnapshot,
		retryPayload,
		changes,
		applyState: "applied",
		appliedAt,
	});
}

async function saveDraftParsedAiResponse({
	beforeApplyBundle,
	generatedContent,
	path: responsePath,
	type,
	modelName,
	language,
	userInstructions,
	requestSnapshot,
	retryPayload = null,
	extraChangeResources = [],
}) {
	const afterApplyBundle = await storage.exportCampaignBundle(responsePath.campaign);
	const changes = buildAiChangeSet(
		beforeApplyBundle,
		afterApplyBundle,
		responsePath.campaign,
	);
	if (Array.isArray(extraChangeResources) && extraChangeResources.length > 0) {
		changes.resources.push(...extraChangeResources);
		changes.resources.sort((a, b) =>
			String(a.label || a.id || "").localeCompare(
				String(b.label || b.id || ""),
				"uk",
			),
		);
		changes.summary = buildAiChangeSummary(changes.resources);
	}

	const response = await storage.addAiResponse({
		text: formatGeneratedContentForHistory(generatedContent),
		path: responsePath,
		type,
		modelName,
		language,
		userInstructions,
		request: requestSnapshot,
		retryPayload,
		changes,
		applyState: "draft",
		appliedAt: null,
	});

	for (const resource of changes.resources) {
		await writeAiResourceSnapshot(resource, resource.before ?? null);
	}

	return response;
}

async function writeAiResourceSnapshot(resource, snapshotValue) {
	if (resource.kind === "custom-bestiary") {
		await storage.writeCustomBestiaryMonsters(
			Array.isArray(snapshotValue) ? snapshotValue : [],
		);
		return;
	}

	const campaignSlug = resource.campaign;
	if (!campaignSlug) {
		throw new Error("AI response change has no campaign target.");
	}

	if (resource.kind === "campaign") {
		if (snapshotValue === null) {
			throw new Error("Campaign deletion cannot be restored from AI history.");
		}
		await storage.writeJson(storage.campaignMetaPath(campaignSlug), snapshotValue);
		return;
	}

	if (resource.kind === "session") {
		const fileName = path.basename(String(resource.fileName || ""));
		if (!fileName) throw new Error("AI response change has no session target.");
		const fullPath = storage.sessionPath(campaignSlug, fileName);
		if (snapshotValue === null) {
			await fs.rm(fullPath, { force: true });
		} else {
			await storage.writeJson(fullPath, snapshotValue);
		}
		return;
	}

	if (resource.kind === "entity") {
		const type = resource.type;
		const slug = path.basename(String(resource.slug || ""));
		if (!storage.ENTITY_TYPES.includes(type) || !slug) {
			throw new Error("AI response change has invalid entity target.");
		}
		if (snapshotValue === null) {
			await storage.deleteEntity(campaignSlug, type, slug);
		} else {
			await storage.writeJson(
				path.join(storage.campaignDir(campaignSlug), type, slug, "info.json"),
				{ ...snapshotValue, slug },
			);
		}
		return;
	}

	throw new Error("AI response change has unknown target type.");
}

async function readUpdatedObjectForAiResponse(entry) {
	const targetPath = entry?.path || {};
	if (!targetPath.campaign) return null;

	if (targetPath.campaign === "bestiary") {
		return { monsters: await storage.readCustomBestiaryMonsters() };
	}

	if (targetPath.session) {
		const sessionFile = storage.sessionPath(
			targetPath.campaign,
			targetPath.session,
		);
		if (await storage.exists(sessionFile)) {
			const session = await storage.readJson(sessionFile);
			return { ...session, fileName: targetPath.session };
		}
	}

	const metaPath = storage.campaignMetaPath(targetPath.campaign);
	if (await storage.exists(metaPath)) {
		return storage.readJson(metaPath);
	}
	return null;
}

async function restoreAiResponseSnapshot(entry, snapshotKey) {
	const resources = entry?.changes?.resources || [];
	if (!resources.length) {
		const error = new Error("This AI response has no saved changes.");
		error.status = 400;
		throw error;
	}

	for (const resource of resources) {
		await writeAiResourceSnapshot(resource, resource[snapshotKey] ?? null);
	}

	const campaignSlug = entry?.path?.campaign;
	const response = await storage.updateAiResponse(
		campaignSlug,
		entry.id,
		{
			applyState: snapshotKey === "after" ? "applied" : "undone",
			appliedAt: new Date().toISOString(),
		},
	);
	return {
		response,
		responses: await storage.readAiResponses(campaignSlug),
		updated: await readUpdatedObjectForAiResponse(response || entry),
	};
}

module.exports = {
	buildAiChangeSet,
	restoreAiResponseSnapshot,
	saveParsedAiResponse,
	saveDraftParsedAiResponse,
};
