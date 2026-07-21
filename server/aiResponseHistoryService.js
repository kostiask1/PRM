const fs = require("fs/promises");
const path = require("path");

const storage = require("./storage");
const { formatGeneratedContentForHistory } = require("./aiHistoryService");
const {
	buildAiChangeSummary,
} = require("./ai/aiChangeSummary");

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

function getCustomMonsterId(monster) {
	return String(monster?.id || "").trim();
}

function getCustomMonsterNameKey(monster) {
	return String(monster?.name || "")
		.trim()
		.toLowerCase();
}

function getCustomMonsterLabel(monster, fallbackName = "") {
	return String(monster?.name || fallbackName || "custom-monster").trim();
}

function buildCustomMonsterChangeResources(
	beforeMonsters = [],
	afterMonsters = [],
) {
	const beforeList = (
		Array.isArray(beforeMonsters) ? beforeMonsters : []
	).filter((monster) => monster && typeof monster === "object");
	const afterList = (Array.isArray(afterMonsters) ? afterMonsters : []).filter(
		(monster) => monster && typeof monster === "object",
	);
	const beforeById = new Map(
		beforeList
			.filter((monster) => getCustomMonsterId(monster))
			.map((monster) => [getCustomMonsterId(monster), monster]),
	);
	const afterById = new Map(
		afterList
			.filter((monster) => getCustomMonsterId(monster))
			.map((monster) => [getCustomMonsterId(monster), monster]),
	);
	const matchedBefore = new Set();
	const matchedAfter = new Set();
	const resources = [];

	const pushResource = (before, after, fallbackKey = "") => {
		if (!snapshotValueChanged(before, after)) return;
		const monsterId =
			getCustomMonsterId(after) ||
			getCustomMonsterId(before) ||
			getCustomMonsterNameKey(after || before) ||
			fallbackKey;
		const name = getCustomMonsterLabel(after || before, fallbackKey);
		resources.push({
			id: `custom-monster:${monsterId}`,
			kind: "custom-monster",
			campaign: "bestiary",
			name,
			label: `data/custom-bestiary.json / ${name}`,
			before: cloneSnapshotValue(before),
			after: cloneSnapshotValue(after),
		});
	};

	for (const key of new Set([...beforeById.keys(), ...afterById.keys()])) {
		const before = beforeById.get(key) || null;
		const after = afterById.get(key) || null;
		if (before) matchedBefore.add(before);
		if (after) matchedAfter.add(after);
		pushResource(before, after, key);
	}

	const beforeByName = new Map(
		beforeList
			.filter(
				(monster) =>
					!matchedBefore.has(monster) && getCustomMonsterNameKey(monster),
			)
			.map((monster) => [getCustomMonsterNameKey(monster), monster]),
	);
	const afterByName = new Map(
		afterList
			.filter(
				(monster) =>
					!matchedAfter.has(monster) && getCustomMonsterNameKey(monster),
			)
			.map((monster) => [getCustomMonsterNameKey(monster), monster]),
	);

	for (const key of new Set([...beforeByName.keys(), ...afterByName.keys()])) {
		pushResource(
			beforeByName.get(key) || null,
			afterByName.get(key) || null,
			key,
		);
	}
	resources.sort((a, b) =>
		String(a.label || a.id || "").localeCompare(
			String(b.label || b.id || ""),
		),
	);
	return resources;
}

function pushAiChange(resources, resource) {
	if (!snapshotValueChanged(resource.before, resource.after)) return;
	resources.push({
		...resource,
		before: cloneSnapshotValue(resource.before),
		after: cloneSnapshotValue(resource.after),
	});
}

function createEmptyAiChangeSet() {
	const resources = [];
	return { resources, summary: buildAiChangeSummary(resources) };
}

function createCampaignChangeResource(beforeBundle, afterBundle, campaignSlug) {
	return {
		id: `campaign:${campaignSlug}`,
		kind: "campaign",
		campaign: campaignSlug,
		label: `${campaignSlug}/_campaign.json`,
		before: beforeBundle.meta ?? null,
		after: afterBundle.meta ?? null,
	};
}

function createResourceIndex(items, getKey, getValue) {
	return new Map(items.map((item) => [getKey(item), getValue(item)]));
}

function createSessionIndex(bundle) {
	return createResourceIndex(
		bundle.sessions || [],
		(session) => session.fileName,
		(session) => session.content,
	);
}

function createEntityIndex(bundle, type) {
	return createResourceIndex(
		bundle.entities?.[type] || [],
		(entity) => entity.slug,
		(entity) => entity,
	);
}

function getCombinedResourceKeys(beforeIndex, afterIndex) {
	return new Set([...beforeIndex.keys(), ...afterIndex.keys()]);
}

function getIndexedSnapshot(index, key) {
	return index.has(key) ? index.get(key) : null;
}

function appendIndexedChanges({
	resources,
	beforeIndex,
	afterIndex,
	createResource,
}) {
	for (const key of getCombinedResourceKeys(beforeIndex, afterIndex)) {
		pushAiChange(
			resources,
			createResource(
				key,
				getIndexedSnapshot(beforeIndex, key),
				getIndexedSnapshot(afterIndex, key),
			),
		);
	}
}

function createSessionChangeResource(
	fileName,
	before,
	after,
	campaignSlug,
) {
	return {
		id: `session:${fileName}`,
		kind: "session",
		campaign: campaignSlug,
		fileName,
		label: `${campaignSlug}/sessions/${fileName}`,
		before,
		after,
	};
}

function appendSessionChanges(
	resources,
	beforeBundle,
	afterBundle,
	campaignSlug,
) {
	appendIndexedChanges({
		resources,
		beforeIndex: createSessionIndex(beforeBundle),
		afterIndex: createSessionIndex(afterBundle),
		createResource: (fileName, before, after) =>
			createSessionChangeResource(
				fileName,
				before,
				after,
				campaignSlug,
			),
	});
}

function createEntityChangeResource(
	type,
	slug,
	before,
	after,
	campaignSlug,
) {
	return {
		id: `entity:${type}:${slug}`,
		kind: "entity",
		campaign: campaignSlug,
		type,
		slug,
		label: getEntityResourceLabel(campaignSlug, type, slug),
		before,
		after,
	};
}

function appendEntityTypeChanges({
	resources,
	beforeBundle,
	afterBundle,
	campaignSlug,
	type,
}) {
	appendIndexedChanges({
		resources,
		beforeIndex: createEntityIndex(beforeBundle, type),
		afterIndex: createEntityIndex(afterBundle, type),
		createResource: (slug, before, after) =>
			createEntityChangeResource(type, slug, before, after, campaignSlug),
	});
}

function appendEntityChanges(
	resources,
	beforeBundle,
	afterBundle,
	campaignSlug,
) {
	for (const type of storage.ENTITY_TYPES) {
		appendEntityTypeChanges({
			resources,
			beforeBundle,
			afterBundle,
			campaignSlug,
			type,
		});
	}
}

function sortAiChangeResources(resources) {
	resources.sort((a, b) => a.label.localeCompare(b.label));
}

function createAiChangeSet(resources) {
	sortAiChangeResources(resources);
	return {
		resources,
		summary: buildAiChangeSummary(resources),
	};
}

function buildAiChangeSet(beforeBundle, afterBundle, campaignSlug) {
	if (!beforeBundle || !afterBundle) return createEmptyAiChangeSet();

	const resources = [];
	pushAiChange(
		resources,
		createCampaignChangeResource(beforeBundle, afterBundle, campaignSlug),
	);
	appendSessionChanges(resources, beforeBundle, afterBundle, campaignSlug);
	appendEntityChanges(resources, beforeBundle, afterBundle, campaignSlug);
	return createAiChangeSet(resources);
}

async function buildParsedAiChanges(
	beforeApplyBundle,
	responsePath,
	extraChangeResources = [],
) {
	const afterApplyBundle = await storage.exportCampaignBundle(
		responsePath.campaign,
	);
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
			),
		);
		changes.summary = buildAiChangeSummary(changes.resources);
	}
	return changes;
}

function buildParsedAiResponsePayload({
	generatedContent,
	path: responsePath,
	type,
	modelName,
	language,
	userInstructions,
	requestSnapshot,
	retryPayload,
	changes,
	applyState,
	appliedAt,
}) {
	return {
		text: formatGeneratedContentForHistory(generatedContent),
		path: responsePath,
		type,
		modelName,
		language,
		userInstructions,
		request: requestSnapshot,
		retryPayload,
		changes,
		applyState,
		appliedAt,
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
	const changes = await buildParsedAiChanges(
		beforeApplyBundle,
		responsePath,
		extraChangeResources,
	);
	return storage.addAiResponse(
		buildParsedAiResponsePayload({
			generatedContent,
			path: responsePath,
			type,
			modelName,
			language,
			userInstructions,
			requestSnapshot,
			retryPayload,
			changes,
			applyState: "applied",
			appliedAt: new Date().toISOString(),
		}),
	);
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
	const changes = await buildParsedAiChanges(
		beforeApplyBundle,
		responsePath,
		extraChangeResources,
	);

	const response = await storage.addAiResponse(
		buildParsedAiResponsePayload({
			generatedContent,
			path: responsePath,
			type,
			modelName,
			language,
			userInstructions,
			requestSnapshot,
			retryPayload,
			changes,
			applyState: "draft",
			appliedAt: null,
		}),
	);

	for (const resource of changes.resources) {
		await writeAiResourceSnapshot(resource, resource.before ?? null);
	}

	return response;
}

function normalizeSnapshotIdentityPart(value) {
	return String(value || "").trim();
}

function normalizeSnapshotNameKey(value) {
	return normalizeSnapshotIdentityPart(value).toLowerCase();
}

function getCustomMonsterResourceId(resource) {
	const resourceId = String(resource.id || "");
	return resourceId.startsWith("custom-monster:")
		? resourceId.slice("custom-monster:".length)
		: "";
}

function compactSnapshotIdentityParts(values, normalize) {
	return values.map(normalize).filter(Boolean);
}

function getCustomMonsterSnapshotTargetIds(resource, snapshotValue) {
	return compactSnapshotIdentityParts(
		[
			resource.before?.id,
			resource.after?.id,
			snapshotValue?.id,
			getCustomMonsterResourceId(resource),
		],
		normalizeSnapshotIdentityPart,
	);
}

function getCustomMonsterSnapshotTargetNames(resource, snapshotValue) {
	return compactSnapshotIdentityParts(
		[
			resource.name,
			resource.before?.name,
			resource.after?.name,
			snapshotValue?.name,
		],
		normalizeSnapshotNameKey,
	);
}

function isCustomMonsterSnapshotTarget(monster, targetIds, targetNames) {
	return (
		targetIds.includes(normalizeSnapshotIdentityPart(monster?.id)) ||
		targetNames.includes(normalizeSnapshotNameKey(monster?.name))
	);
}

function projectCustomMonsterSnapshot(
	current,
	resource,
	snapshotValue,
) {
	const targetIds = getCustomMonsterSnapshotTargetIds(resource, snapshotValue);
	const targetNames = getCustomMonsterSnapshotTargetNames(
		resource,
		snapshotValue,
	);
	const next = current.filter(
		(monster) =>
			!isCustomMonsterSnapshotTarget(monster, targetIds, targetNames),
	);
	if (snapshotValue !== null) next.push(snapshotValue);
	return next;
}

async function restoreCustomBestiarySnapshot({ snapshotValue }) {
	await storage.writeCustomBestiaryMonsters(
		Array.isArray(snapshotValue) ? snapshotValue : [],
	);
}

async function restoreCustomMonsterSnapshot({ resource, snapshotValue }) {
	const current = await storage.readCustomBestiaryMonsters();
	const next = projectCustomMonsterSnapshot(
		current,
		resource,
		snapshotValue,
	);
	await storage.writeCustomBestiaryMonsters(next);
}

function requireSnapshotCampaign(resource) {
	if (resource.campaign) return resource.campaign;
	throw new Error("AI response change has no campaign target.");
}

async function restoreCampaignSnapshot({ campaignSlug, snapshotValue }) {
	if (snapshotValue === null) {
		throw new Error("Campaign deletion cannot be restored from AI history.");
	}
	await storage.writeJson(
		storage.campaignMetaPath(campaignSlug),
		snapshotValue,
	);
}

function getSnapshotSessionFileName(resource) {
	const fileName = path.basename(String(resource.fileName || ""));
	if (fileName) return fileName;
	throw new Error("AI response change has no session target.");
}

async function restoreSessionSnapshot({
	resource,
	campaignSlug,
	snapshotValue,
}) {
	const fileName = getSnapshotSessionFileName(resource);
	const fullPath = storage.sessionPath(campaignSlug, fileName);
	if (snapshotValue === null) {
		await fs.rm(fullPath, { force: true });
		return;
	}
	await storage.writeJson(fullPath, snapshotValue);
}

function getSnapshotEntityTarget(resource) {
	const type = resource.type;
	const slug = path.basename(String(resource.slug || ""));
	if (storage.ENTITY_TYPES.includes(type) && slug) return { type, slug };
	throw new Error("AI response change has invalid entity target.");
}

async function restoreEntitySnapshot({
	resource,
	campaignSlug,
	snapshotValue,
}) {
	const { type, slug } = getSnapshotEntityTarget(resource);
	if (snapshotValue === null) {
		await storage.deleteEntity(campaignSlug, type, slug);
		return;
	}
	await storage.writeJson(
		path.join(storage.campaignDir(campaignSlug), type, slug, "info.json"),
		{ ...snapshotValue, slug },
	);
}

const CAMPAIGN_FREE_SNAPSHOT_COMMANDS = new Map([
	["custom-bestiary", restoreCustomBestiarySnapshot],
	["custom-monster", restoreCustomMonsterSnapshot],
]);

const CAMPAIGN_SNAPSHOT_COMMANDS = new Map([
	["campaign", restoreCampaignSnapshot],
	["session", restoreSessionSnapshot],
	["entity", restoreEntitySnapshot],
]);

function getCampaignSnapshotCommand(kind) {
	const command = CAMPAIGN_SNAPSHOT_COMMANDS.get(kind);
	if (command) return command;
	throw new Error("AI response change has unknown target type.");
}

async function writeAiResourceSnapshot(resource, snapshotValue) {
	const campaignFreeCommand = CAMPAIGN_FREE_SNAPSHOT_COMMANDS.get(resource.kind);
	if (campaignFreeCommand) {
		await campaignFreeCommand({ resource, snapshotValue });
		return;
	}
	const campaignSlug = requireSnapshotCampaign(resource);
	const command = getCampaignSnapshotCommand(resource.kind);
	await command({ resource, campaignSlug, snapshotValue });
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

async function restoreAiResponseSnapshot(entry, snapshotKey, options = {}) {
	const resources = entry?.changes?.resources || [];
	if (!resources.length) {
		const error = new Error("This AI response has no saved changes.");
		error.status = 400;
		throw error;
	}

	const resourceIds = Array.isArray(options.resourceIds)
		? new Set(options.resourceIds.map((id) => String(id || "")).filter(Boolean))
		: null;
	const selectedResources = resourceIds
		? resources.filter((resource) => resourceIds.has(resource.id))
		: resources;
	if (!selectedResources.length) {
		const error = new Error("Selected AI response changes were not found.");
		error.status = 400;
		throw error;
	}

	for (const resource of selectedResources) {
		await writeAiResourceSnapshot(resource, resource[snapshotKey] ?? null);
	}

	const campaignSlug = entry?.path?.campaign;
	const appliedAt = new Date().toISOString();
	const patch = resourceIds
		? (() => {
				const nextResources = resources.map((resource) =>
					resourceIds.has(resource.id)
						? {
								...resource,
								applyState: snapshotKey === "after" ? "applied" : "undone",
								appliedAt,
							}
						: resource,
				);
				const allApplied = nextResources.every(
					(resource) => resource.applyState === "applied",
				);
				const allUndone = nextResources.every(
					(resource) => resource.applyState === "undone",
				);
				return {
					changes: {
						...(entry.changes || {}),
						resources: nextResources,
						summary: buildAiChangeSummary(nextResources),
					},
					applyState: allApplied ? "applied" : allUndone ? "undone" : "draft",
					appliedAt: allApplied || allUndone ? appliedAt : null,
				};
			})()
		: {
				changes:
					snapshotKey === "after"
						? {
								...(entry.changes || {}),
								resources: resources.map((resource) => ({
									...resource,
									applyState: "applied",
									appliedAt,
								})),
								summary: buildAiChangeSummary(resources),
							}
						: entry.changes,
				applyState: snapshotKey === "after" ? "applied" : "undone",
				appliedAt,
			};
	const response = await storage.updateAiResponse(
		campaignSlug,
		entry.id,
		patch,
	);
	return {
		response,
		responses: await storage.readAiResponses(campaignSlug),
		updated: await readUpdatedObjectForAiResponse(response || entry),
	};
}

module.exports = {
	buildCustomMonsterChangeResources,
	restoreAiResponseSnapshot,
	saveParsedAiResponse,
	saveDraftParsedAiResponse,
};
