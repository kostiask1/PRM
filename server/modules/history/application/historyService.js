const crypto = require("crypto");
const {
	beginHistoryTransaction,
	clearPendingHistoryTransaction,
	commitHistoryTransaction,
	createHistoryTransition,
	getHistoryStatus,
	markHistoryRestoreActive,
	markHistoryRestoreChange,
	prepareHistoryRestore,
	transactionSummary,
	valuesEqual,
} = require("./historyStack");
const {
	applyJsonPatches,
	buildCampaignResourceChanges,
	historyValueHash,
	validateJsonPatches,
} = require("./resourcePatches");
const {
	createFileHistoryRepository,
} = require("../infrastructure/fileHistoryRepository");

function createMutationQueue() {
	let tail = Promise.resolve();
	return async function acquire() {
		let release;
		const turn = new Promise((resolve) => {
			release = resolve;
		});
		const previous = tail;
		tail = tail.catch(() => {}).then(() => turn);
		await previous.catch(() => {});
		return release;
	};
}

function clone(value) {
	return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isLifecycleRestoreArtifactSlug(slug) {
	return /^\..+\.history-restore-[a-f0-9]+\.(stage|previous)$/.test(
		String(slug || ""),
	);
}

function campaignIdentity(snapshot) {
	const meta = snapshot?.archive?.bundle?.meta;
	return meta?.id == null ? `slug:${snapshot?.slug}` : `id:${String(meta.id)}`;
}

function indexApplicationSnapshot(snapshot) {
	return new Map((snapshot || []).map((item) => [campaignIdentity(item), item]));
}

function indexApplicationSnapshotBySlug(snapshot) {
	return new Map((snapshot || []).map((item) => [String(item.slug), item]));
}

function treeLocation(resource, campaignSlug = null) {
	return campaignSlug
		? { resource, campaignSlug: String(campaignSlug) }
		: { resource };
}

function treeLocationKey(location) {
	return `${location?.resource || "tree"}:${location?.campaignSlug || ""}`;
}

function treeStatesEqual(left, right) {
	return Boolean(left?.exists) === Boolean(right?.exists) &&
		(!left?.exists || left.fingerprint === right.fingerprint);
}

function missingTreeState(location) {
	return { location: clone(location), exists: false, fingerprint: null };
}

function transactionIds(history) {
	return new Set(
		[...(history?.past || []), ...(history?.future || [])]
			.map((entry) => entry?.id)
			.filter(Boolean),
	);
}

function addPatchAffectedIds(change, encounters) {
	for (const patch of change.patches || []) {
		for (const [index, segment] of (patch.path || []).entries()) {
			if (
				segment &&
				typeof segment === "object" &&
				segment.by === "id" &&
				patch.path[index - 1] === "encounters"
			) {
				encounters.add(String(segment.value));
			}
		}
	}
}

function affectedFromChanges(changes) {
	const campaigns = new Set();
	const sessions = new Set();
	const entities = new Set();
	const encounters = new Set();
	for (const change of changes) {
		if (change.kind === "campaign-lifecycle") {
			if (change.before?.slug) campaigns.add(String(change.before.slug));
			if (change.after?.slug) campaigns.add(String(change.after.slug));
			continue;
		}
		if (change.kind === "filesystem-tree") {
			if (change.location?.campaignSlug) {
				campaigns.add(String(change.location.campaignSlug));
			}
			continue;
		}
		for (const location of [change.beforeLocation, change.afterLocation]) {
			if (location?.campaignSlug) campaigns.add(String(location.campaignSlug));
		}
		if (change.resource === "session") sessions.add(String(change.stableId));
		if (change.resource === "entity") entities.add(String(change.stableId));
		addPatchAffectedIds(change, encounters);
	}
	return {
		campaigns: [...campaigns],
		sessions: [...sessions],
		entities: [...entities],
		encounters: [...encounters],
	};
}

function restoredCampaignSlug(transaction, targetSide) {
	const lifecycle = (transaction?.changes || []).find(
		(change) =>
			change.kind === "campaign-lifecycle" &&
			change.before?.slug !== change.after?.slug,
	);
	return lifecycle ? lifecycle[targetSide]?.slug || null : null;
}

function selectorForCollection(path, collection) {
	for (let index = 1; index < (path || []).length; index += 1) {
		const segment = path[index];
		if (
			path[index - 1] === collection &&
			segment &&
			typeof segment === "object" &&
			!Array.isArray(segment) &&
			segment.value !== null &&
			segment.value !== undefined
		) {
			return clone(segment.value);
		}
	}
	return null;
}

function selectorIndexForCollection(path, collection) {
	for (let index = (path || []).length - 1; index >= 1; index -= 1) {
		const segment = path[index];
		if (
			path[index - 1] === collection &&
			segment &&
			typeof segment === "object" &&
			!Array.isArray(segment)
		) {
			return index;
		}
	}
	return -1;
}

const SEMANTIC_COLLECTIONS = [
	"characters",
	"npcs",
	"locations",
	"scenes",
	"encounters",
	"notes",
	"monsters",
];

function deepestSemanticSelector(patch) {
	let selected = null;
	for (const collection of SEMANTIC_COLLECTIONS) {
		const index = selectorIndexForCollection(patch?.path, collection);
		if (index >= 0 && (!selected || index > selected.index)) {
			selected = { collection, index };
		}
	}
	return selected;
}

function selectorElementExists(patch, targetSide, collection, resourceExists) {
	if (!resourceExists) return false;
	const index = selectorIndexForCollection(patch?.path, collection);
	if (index < 0) return true;
	if (patch?.kind !== "value" || index < (patch.path || []).length - 1) {
		return true;
	}
	return Boolean(patch[targetSide]?.exists);
}

function patchElementExists(patch, targetSide, resourceExists) {
	const semantic = deepestSemanticSelector(patch);
	return semantic
		? selectorElementExists(
			patch,
			targetSide,
			semantic.collection,
			resourceExists,
		)
		: resourceExists;
}

function patchFocusScore(patch, operation, targetSide, resourceExists) {
	const path = patch?.path || [];
	let score = path.length;
	if (selectorForCollection(path, "notes") !== null) score += 20;
	if (selectorForCollection(path, "scenes") !== null) score += 25;
	if (selectorForCollection(path, "characters") !== null) score += 30;
	if (selectorForCollection(path, "npcs") !== null) score += 30;
	if (selectorForCollection(path, "locations") !== null) score += 30;
	if (selectorForCollection(path, "encounters") !== null) score += 35;
	if (selectorForCollection(path, "monsters") !== null) score += 40;
	if (String(operation).startsWith("encounter.") && path.includes("encounters")) {
		score += 60;
	}
	if (patchElementExists(patch, targetSide, resourceExists)) score += 10;
	return score;
}

function preferredPatch(change, operation, targetSide) {
	const resourceExists = Boolean(change?.[`${targetSide}Location`]);
	return [...(change?.patches || [])].sort(
		(left, right) =>
			patchFocusScore(right, operation, targetSide, resourceExists) -
			patchFocusScore(left, operation, targetSide, resourceExists),
	)[0] || null;
}

function sessionEntityType(path) {
	if (selectorForCollection(path, "characters") !== null) return "characters";
	if (selectorForCollection(path, "npcs") !== null) return "npc";
	if (selectorForCollection(path, "locations") !== null) return "locations";
	return null;
}

function sessionEntityCollection(entityType) {
	if (entityType === "characters") return "characters";
	if (entityType === "npc") return "npcs";
	return entityType === "locations" ? "locations" : null;
}

function isSessionReorderTransaction(transaction) {
	return (
		transaction?.operation === "session.reorder" ||
		/\/sessions\/reorder$/.test(String(transaction?.params?.path || ""))
	);
}

function historyCaretValueRevision(value) {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193) >>> 0;
	}
	return `${value.length}:${hash.toString(16).padStart(8, "0")}`;
}

function restoredTextCaretOffset(patch, targetSide) {
	if (patch?.kind !== "value") return null;
	const target = patch[targetSide];
	const source = patch[targetSide === "before" ? "after" : "before"];
	if (!target?.exists || typeof target.value !== "string") return null;
	if (!source?.exists || typeof source.value !== "string") {
		return target.value.length;
	}
	const targetValue = target.value;
	const sourceValue = source.value;
	let prefix = 0;
	while (
		prefix < targetValue.length &&
		prefix < sourceValue.length &&
		targetValue[prefix] === sourceValue[prefix]
	) {
		prefix += 1;
	}
	let suffix = 0;
	while (
		suffix < targetValue.length - prefix &&
		suffix < sourceValue.length - prefix &&
		targetValue[targetValue.length - suffix - 1] ===
			sourceValue[sourceValue.length - suffix - 1]
	) {
		suffix += 1;
	}
	return targetValue.length - suffix;
}

function restoredTextCaretValueRevision(patch, targetSide) {
	if (patch?.kind !== "value") return null;
	const target = patch[targetSide];
	if (!target?.exists || typeof target.value !== "string") return null;
	return historyCaretValueRevision(target.value);
}

function changeFocusScore(change, operation, targetSide) {
	if (change.kind === "campaign-lifecycle") {
		return ["campaign.create", "campaign.delete", "campaign.rename"].includes(
			operation,
		)
			? 2000
			: 80;
	}
	if (change.kind !== "json-resource") return 0;
	const patch = preferredPatch(change, operation, targetSide);
	const path = patch?.path || [];
	const resourceExists = Boolean(change[`${targetSide}Location`]);
	const elementExists = patchElementExists(patch, targetSide, resourceExists);
	const existenceScore = elementExists ? 500 : 0;
	const embeddedEntityType = change.resource === "session"
		? sessionEntityType(path)
		: null;
	if (
		String(operation).startsWith("entity.") &&
		(change.resource === "entity" || embeddedEntityType)
	) {
		return 1000 + existenceScore + (change.resource === "entity" ? 10 : 0);
	}
	if (
		String(operation).startsWith("encounter.") &&
		change.resource === "session" &&
		path.includes("encounters")
	) {
		return 1000 + existenceScore;
	}
	if (String(operation).startsWith("session.") && change.resource === "session") {
		return 1000 + existenceScore;
	}
	if (
		String(operation).startsWith("campaign.") &&
		change.resource === "campaign-meta"
	) {
		return 1000 + existenceScore;
	}
	if (path.includes("encounters")) return 120 + existenceScore;
	if (change.resource === "entity") return 110 + existenceScore;
	if (embeddedEntityType) return 105 + existenceScore;
	if (change.resource === "session") return 100 + existenceScore;
	if (change.resource === "campaign-meta") return 90 + existenceScore;
	return 10 + existenceScore;
}

function fieldFromPatch(patch) {
	for (let index = (patch?.path || []).length - 1; index >= 0; index -= 1) {
		const segment = patch.path[index];
		if (typeof segment === "string") return segment;
	}
	return null;
}

function historyFocusTarget(transaction, targetSide) {
	if (!transaction) return null;
	if (transaction.operation === "campaign.reorder") {
		const first = (transaction.changes || []).find(
			(change) => change.resource === "campaign-meta",
		);
		const location = first?.[`${targetSide}Location`] ||
			first?.beforeLocation ||
			first?.afterLocation;
		return {
			resource: "campaign-list",
			campaignSlug: location?.campaignSlug || null,
			resourceId: clone(first?.stableId ?? null),
			resourceExists: true,
			preserveRoute: true,
			exists: true,
		};
	}
	if (isSessionReorderTransaction(transaction)) {
		const first = (transaction.changes || []).find(
			(change) => change.resource === "session",
		);
		const location = first?.[`${targetSide}Location`] ||
			first?.beforeLocation ||
			first?.afterLocation;
		return {
			resource: "campaign-sessions",
			campaignSlug: location?.campaignSlug || null,
			resourceId: clone(first?.stableId ?? null),
			resourceExists: true,
			exists: true,
		};
	}
	const change = [...(transaction.changes || [])].sort(
		(left, right) =>
			changeFocusScore(right, transaction.operation, targetSide) -
			changeFocusScore(left, transaction.operation, targetSide),
	)[0];
	if (!change) return null;
	if (change.kind === "campaign-lifecycle") {
		const target = change[targetSide];
		const fallback = change[targetSide === "before" ? "after" : "before"];
		return {
			resource: target ? "campaign" : "campaign-list",
			campaignSlug: target?.slug || fallback?.slug || null,
			resourceId: change.id,
			resourceExists: Boolean(target),
			exists: Boolean(target),
		};
	}
	if (change.kind !== "json-resource") return null;
	const targetLocation = change[`${targetSide}Location`];
	const fallbackLocation = change[
		targetSide === "before" ? "afterLocation" : "beforeLocation"
	];
	const location = targetLocation || fallbackLocation || {};
	const patch = preferredPatch(change, transaction.operation, targetSide);
	const path = patch?.path || [];
	const encounterId = selectorForCollection(path, "encounters");
	const sceneId = selectorForCollection(path, "scenes");
	const noteId = selectorForCollection(path, "notes");
	const participantInstanceId = selectorForCollection(path, "monsters");
	const embeddedEntityType = change.resource === "session"
		? sessionEntityType(path)
		: null;
	const embeddedEntityCollection = sessionEntityCollection(embeddedEntityType);
	const embeddedEntityId = embeddedEntityType
		? selectorForCollection(path, embeddedEntityCollection)
		: null;
	const resourceExists = Boolean(targetLocation);
	if (change.resource === "session" && !resourceExists) {
		return {
			resource: "campaign-sessions",
			campaignSlug: location.campaignSlug || null,
			resourceId: clone(change.stableId),
			resourceExists: false,
			field: "sessions",
			exists: false,
		};
	}
	const elementExists = patchElementExists(
		patch,
		targetSide,
		resourceExists,
	);
	const encounterExists = encounterId === null
		? null
		: selectorElementExists(
			patch,
			targetSide,
			"encounters",
			resourceExists,
		);
	const sceneExists = sceneId === null
		? null
		: selectorElementExists(patch, targetSide, "scenes", resourceExists);
	const noteExists = noteId === null
		? null
		: selectorElementExists(patch, targetSide, "notes", resourceExists);
	const participantExists = participantInstanceId === null
		? null
		: selectorElementExists(patch, targetSide, "monsters", resourceExists);
	const embeddedEntityExists = embeddedEntityId === null
		? null
		: selectorElementExists(
			patch,
			targetSide,
			embeddedEntityCollection,
			resourceExists,
		);
	let resource = change.resource;
	if (encounterId !== null) resource = "encounter";
	else if (embeddedEntityType) resource = "session-entity";
	else if (sceneId !== null) resource = "scene";
	else if (noteId !== null) resource = "note";
	else if (change.resource === "campaign-meta") resource = "campaign";
	return {
		resource,
		campaignSlug: location.campaignSlug || null,
		resourceId: clone(change.stableId),
		sessionId: change.resource === "session" ? clone(change.stableId) : null,
		sessionFileName: location.fileName || null,
		entityId: change.resource === "entity"
			? clone(change.stableId)
			: clone(embeddedEntityId),
		entityType: location.entityType || embeddedEntityType || null,
		entitySlug: location.entitySlug || null,
		encounterId,
		sceneId,
		noteId,
		participantInstanceId,
		field: fieldFromPatch(patch),
		resourceExists,
		encounterExists,
		sceneExists,
		noteExists,
		participantExists,
		entityExists: embeddedEntityExists,
		caretOffset: restoredTextCaretOffset(patch, targetSide),
		caretValueRevision: restoredTextCaretValueRevision(patch, targetSide),
		exists: elementExists,
	};
}

function createHistoryService(storage) {
	const repository = createFileHistoryRepository(storage);
	const acquire = createMutationQueue();

	async function captureCampaign(slug, includeAiResponses = false) {
		if (!(await storage.exists(storage.campaignMetaPath(slug)))) return null;
		const bundle = await storage.exportCampaignBundle(slug);
		const result = {
			meta: bundle.meta,
			sessions: bundle.sessions,
			entities: bundle.entities,
		};
		if (includeAiResponses) result.aiResponses = bundle.aiResponses;
		return result;
	}

	async function captureApplication(mode = "full") {
		const slugs = (await storage.listExportableCampaignSlugs()).filter(
			(slug) => !isLifecycleRestoreArtifactSlug(slug),
		);
		const result = [];
		for (const slug of slugs) {
			await recoverCampaignPending(slug);
			if (mode === "metadata") {
				result.push({
					slug,
					archive: {
						bundle: {
							meta: clone(await storage.readJson(storage.campaignMetaPath(slug))),
							sessions: [],
							entities: { characters: [], npc: [], locations: [] },
							aiResponses: [],
						},
					},
					history: null,
				});
			} else {
				result.push({
					slug,
					archive: { bundle: await storage.exportCampaignBundle(slug) },
					history: await repository.readCampaign(slug),
				});
			}
		}
		return result;
	}

	async function createPending(
		scope,
		scopeKey,
		operation,
		params,
		before,
		extra = {},
	) {
		const id = crypto.randomUUID();
		const snapshot = await repository.writePendingSnapshot(scopeKey, id, before);
		return {
			id,
			scope,
			operation,
			params: clone(params || {}),
			startedAt: new Date().toISOString(),
			snapshot,
			...clone(extra),
		};
	}

	function createTransaction(pending, changes, status) {
		return {
			id: pending.id,
			createdAt: new Date().toISOString(),
			operation: pending.operation,
			params: clone(pending.params || {}),
			status,
			changes: clone(changes),
			affected: affectedFromChanges(changes),
		};
	}

	async function readPendingBefore(pending) {
		if (pending?.snapshot) {
			return repository.readPendingSnapshot(pending.snapshot);
		}
		if (pending && Object.prototype.hasOwnProperty.call(pending, "before")) {
			return clone(pending.before);
		}
		const error = new Error("History recovery snapshot is missing.");
		error.status = 409;
		throw error;
	}

	async function removePendingSnapshot(pending) {
		if (pending?.snapshot) {
			await repository.removePendingSnapshot(pending.snapshot);
		}
	}

	function applicationSourceSlug(operation, params) {
		if (!["campaign.delete", "campaign.rename"].includes(operation)) return null;
		const slug = params?.campaignSlug || params?.oldSlug || params?.slug;
		return slug ? String(slug) : null;
	}

	async function capturePendingLifecycleTrees(pending) {
		if (pending.captureMode === "metadata") return null;
		const rootsBefore = await repository.listLifecycleRoots();
		const sourceSlug = applicationSourceSlug(pending.operation, pending.params);
		const locations = [];
		if (sourceSlug) {
			locations.push(
				treeLocation("campaign-directory", sourceSlug),
				treeLocation("campaign-images", sourceSlug),
			);
		}
		if (
			pending.operation === "campaign.delete" &&
			pending.params?.moveImagesToGeneral
		) {
			locations.push(treeLocation("general-images"));
		}
		const trees = [];
		for (const [index, location] of locations.entries()) {
			trees.push(
				await repository.writePendingTree(
					pending.snapshot,
					`${index}-${location.resource}-${location.campaignSlug || "general"}`,
					location,
				),
			);
		}
		return { rootsBefore, sourceSlug, trees };
	}

	function pendingTreeForLocation(pending, location) {
		return pending?.lifecycle?.trees?.find(
			(tree) => treeLocationKey(tree.location) === treeLocationKey(location),
		) || null;
	}

	function rootWasPresent(pending, location) {
		return Boolean(
			pending?.lifecycle?.rootsBefore?.some(
				(root) => treeLocationKey(root) === treeLocationKey(location),
			),
		);
	}

	function pendingTreeState(pending, location) {
		const tree = pendingTreeForLocation(pending, location);
		if (tree) return tree;
		if (!rootWasPresent(pending, location)) return missingTreeState(location);
		const error = new Error("Exact history snapshot is unavailable for a changed path.");
		error.status = 409;
		throw error;
	}

	async function currentTreeState(location) {
		return { location: clone(location), ...await repository.readTreeState(location) };
	}

	async function materializeTreeSide(
		transactionId,
		key,
		state,
		pending,
	) {
		if (!state?.exists) return null;
		const tombstone = state.kind === "pending-tree"
			? await repository.promotePendingTree(
				pending.snapshot,
				state,
				transactionId,
				key,
			)
			: await repository.writeLiveTreeTombstone(
				transactionId,
				key,
				state.location,
			);
		if (tombstone.fingerprint !== state.fingerprint) {
			const error = new Error("History source changed while its snapshot was captured.");
			error.status = 409;
			throw error;
		}
		return { fingerprint: state.fingerprint, tombstone };
	}

	async function writeLifecycleSnapshot(
		transactionId,
		key,
		snapshot,
		state,
		pending,
	) {
		if (!snapshot) return null;
		const snapshotFingerprint = await repository.writeTombstone(
			transactionId,
			key,
			snapshot,
		);
		const exact = await materializeTreeSide(
			transactionId,
			`${key}-directory`,
			state,
			pending,
		);
		if (!exact) {
			const error = new Error("Campaign lifecycle snapshot directory is missing.");
			error.status = 409;
			throw error;
		}
		return {
			slug: snapshot.slug,
			fingerprint: exact.fingerprint,
			snapshotFingerprint,
			historyFingerprint: historyValueHash(snapshot.history),
			tombstone: { transactionId, key },
			tree: exact.tombstone,
		};
	}

	async function buildFilesystemTreeChange(
		transactionId,
		index,
		location,
		beforeState,
		afterState,
		pending,
	) {
		if (treeStatesEqual(beforeState, afterState)) return null;
		const key = `${index}-${location.resource}-${location.campaignSlug || "general"}`;
		return {
			kind: "filesystem-tree",
			resource: location.resource,
			stableId: location.campaignSlug || location.resource,
			location: clone(location),
			before: await materializeTreeSide(
				transactionId,
				`${key}-before`,
				beforeState,
				pending,
			),
			after: await materializeTreeSide(
				transactionId,
				`${key}-after`,
				afterState,
				pending,
			),
		};
	}

	async function buildApplicationChanges(transactionId, before, after, pending) {
		const beforeIndex = indexApplicationSnapshot(before);
		const afterIndex = indexApplicationSnapshot(after);
		const keys = new Set([...beforeIndex.keys(), ...afterIndex.keys()]);
		const changes = [];
		const coveredCampaignRoots = new Set();
		const lifecycleSlugs = new Set();
		let lifecycleIndex = 0;
		for (const key of keys) {
			const previous = beforeIndex.get(key) || null;
			const next = afterIndex.get(key) || null;
			if (!previous || !next || previous.slug !== next.slug) {
				const beforeKey = `${lifecycleIndex}-before-${String(previous?.slug || "campaign")}`;
				const afterKey = `${lifecycleIndex}-after-${String(next?.slug || "campaign")}`;
				const beforeLocation = previous
					? treeLocation("campaign-directory", previous.slug)
					: null;
				const afterLocation = next
					? treeLocation("campaign-directory", next.slug)
					: null;
				if (previous?.slug) {
					coveredCampaignRoots.add(String(previous.slug));
					lifecycleSlugs.add(String(previous.slug));
				}
				if (next?.slug) {
					coveredCampaignRoots.add(String(next.slug));
					lifecycleSlugs.add(String(next.slug));
				}
				changes.push({
					id: key,
					kind: "campaign-lifecycle",
					before: await writeLifecycleSnapshot(
						transactionId,
						beforeKey,
						previous,
						previous
							? pendingTreeState(pending, beforeLocation)
							: null,
						pending,
					),
					after: await writeLifecycleSnapshot(
						transactionId,
						afterKey,
						next,
						next ? await currentTreeState(afterLocation) : null,
						pending,
					),
				});
				lifecycleIndex += 1;
				continue;
			}
			const sourceSlug = pending?.lifecycle?.sourceSlug;
			if (sourceSlug && String(previous.slug) === String(sourceSlug)) {
				const location = treeLocation("campaign-directory", sourceSlug);
				const beforeState = pendingTreeState(pending, location);
				const afterState = await currentTreeState(location);
				const treeChange = await buildFilesystemTreeChange(
					transactionId,
					changes.length,
					location,
					beforeState,
					afterState,
					pending,
				);
				if (treeChange) {
					changes.push(treeChange);
					coveredCampaignRoots.add(String(sourceSlug));
					continue;
				}
			}
			changes.push(
				...buildCampaignResourceChanges(
					previous.archive.bundle,
					next.archive.bundle,
					previous.slug,
					next.slug,
					{ includeAiResponses: true },
				),
			);
		}
		if (!pending?.lifecycle) return changes;

		const rootsAfter = await repository.listLifecycleRoots();
		const beforeRootKeys = new Set(
			(pending?.lifecycle?.rootsBefore || []).map(treeLocationKey),
		);
		const afterRootKeys = new Set(rootsAfter.map(treeLocationKey));
		const changedRootKeys = new Set(
			[...beforeRootKeys, ...afterRootKeys].filter(
				(key) => beforeRootKeys.has(key) !== afterRootKeys.has(key),
			),
		);
		const sourceSlug = pending?.lifecycle?.sourceSlug;
		if (sourceSlug) {
			changedRootKeys.add(treeLocationKey(
				treeLocation("campaign-directory", sourceSlug),
			));
			changedRootKeys.add(treeLocationKey(
				treeLocation("campaign-images", sourceSlug),
			));
		}
		for (const slug of lifecycleSlugs) {
			changedRootKeys.add(treeLocationKey(treeLocation("campaign-images", slug)));
		}
		if (
			pending?.operation === "campaign.delete" &&
			pending.params?.moveImagesToGeneral
		) {
			changedRootKeys.add(treeLocationKey(treeLocation("general-images")));
		}

		const locations = new Map();
		for (const location of [
			...(pending?.lifecycle?.rootsBefore || []),
			...rootsAfter,
		]) {
			locations.set(treeLocationKey(location), location);
		}
		if (sourceSlug) {
			for (const resource of ["campaign-directory", "campaign-images"]) {
				const location = treeLocation(resource, sourceSlug);
				locations.set(treeLocationKey(location), location);
			}
		}
		for (const slug of lifecycleSlugs) {
			const location = treeLocation("campaign-images", slug);
			locations.set(treeLocationKey(location), location);
		}
		locations.set(
			treeLocationKey(treeLocation("general-images")),
			treeLocation("general-images"),
		);

		for (const key of changedRootKeys) {
			const location = locations.get(key);
			if (!location) continue;
			if (
				location.resource === "campaign-directory" &&
				coveredCampaignRoots.has(String(location.campaignSlug))
			) {
				continue;
			}
			const beforeState = pendingTreeState(pending, location);
			const afterState = await currentTreeState(location);
			const treeChange = await buildFilesystemTreeChange(
				transactionId,
				changes.length,
				location,
				beforeState,
				afterState,
				pending,
			);
			if (treeChange) changes.push(treeChange);
		}
		return changes;
	}

	async function purgeUnreachableTombstones(previousHistory, nextHistory) {
		const retained = transactionIds(nextHistory);
		for (const id of transactionIds(previousHistory)) {
			if (!retained.has(id)) await repository.removeTombstones(id);
		}
	}

	async function beginCampaign(slug, operation, params) {
		const release = await acquire();
		let pending;
		try {
			if ((await recoverApplicationPending()).restoring) {
				throw historyConflict(
					"Finish the application history restoration before editing a campaign.",
				);
			}
			const history = await recoverCampaignPending(slug);
			const before = await captureCampaign(slug);
			pending = await createPending("campaign", `campaign-${slug}`, operation, params, before);
			await repository.writeCampaign(
				slug,
				beginHistoryTransaction(history, pending),
			);
			return { kind: "campaign", slug, before, pending, release };
		} catch (error) {
			await removePendingSnapshot(pending).catch(() => {});
			release();
			throw error;
		}
	}

	async function beginApplication(operation, params) {
		const release = await acquire();
		let pending;
		try {
			const history = await recoverApplicationPending();
			if (history.restoring) {
				throw historyConflict(
					"Finish the pending application history restoration first.",
				);
			}
			for (const slug of await storage.listExportableCampaignSlugs()) {
				if ((await recoverCampaignPending(slug)).restoring) {
					throw historyConflict(
						"Finish the pending campaign history restoration first.",
					);
				}
			}
			const captureMode = operation === "campaign.reorder" ? "metadata" : "full";
			const before = await captureApplication(captureMode);
			pending = await createPending(
				"application",
				"application",
				operation,
				params,
				before,
				{ captureMode },
			);
			pending.lifecycle = await capturePendingLifecycleTrees(pending);
			await repository.writeApplication(
				beginHistoryTransaction(history, pending),
			);
			return { kind: "application", before, captureMode, pending, release };
		} catch (error) {
			await removePendingSnapshot(pending).catch(() => {});
			release();
			throw error;
		}
	}

	async function finishCampaign(context, failed) {
		try {
			const after = await captureCampaign(context.slug);
			const changes = buildCampaignResourceChanges(
				context.before,
				after,
				context.slug,
			);
			let history = await repository.readCampaign(context.slug);
			history = changes.length === 0
				? clearPendingHistoryTransaction(history)
				: commitHistoryTransaction(
					history,
					createTransaction(
						context.pending,
						changes,
						failed ? "partial" : "committed",
					),
				);
			await repository.writeCampaign(context.slug, history);
			await removePendingSnapshot(context.pending).catch(() => {});
		} finally {
			context.release();
		}
	}

	async function finishApplication(context, failed) {
		try {
			const after = await captureApplication(context.captureMode);
			let history = await repository.readApplication();
			const previousHistory = history;
			const changes = await buildApplicationChanges(
				context.pending.id,
				context.before,
				after,
				context.pending,
			);
			history = changes.length === 0
				? clearPendingHistoryTransaction(history)
				: commitHistoryTransaction(
					history,
					createTransaction(
						context.pending,
						changes,
						failed ? "partial" : "committed",
					),
				);
			await repository.writeApplication(history);
			await removePendingSnapshot(context.pending).catch(() => {});
			await purgeUnreachableTombstones(previousHistory, history);
		} finally {
			context.release();
		}
	}

	async function recoverCampaignPending(slug) {
		let history = await repository.readCampaign(slug);
		if (!history.pending) return history;
		const pending = history.pending;
		const before = await readPendingBefore(pending);
		const after = await captureCampaign(slug);
		const changes = buildCampaignResourceChanges(before, after, slug);
		history = changes.length === 0
			? clearPendingHistoryTransaction(history)
			: commitHistoryTransaction(
				history,
				createTransaction(pending, changes, "interrupted"),
			);
		await repository.writeCampaign(slug, history);
		await removePendingSnapshot(pending).catch(() => {});
		return history;
	}

	async function recoverApplicationPending() {
		let history = await repository.readApplication();
		if (!history.pending) return history;
		const pending = history.pending;
		const before = await readPendingBefore(pending);
		const after = await captureApplication(pending.captureMode || "full");
		const changes = await buildApplicationChanges(
			pending.id,
			before,
			after,
			pending,
		);
		history = changes.length === 0
			? clearPendingHistoryTransaction(history)
			: commitHistoryTransaction(
				history,
				createTransaction(pending, changes, "interrupted"),
			);
		await repository.writeApplication(history);
		await removePendingSnapshot(pending).catch(() => {});
		return history;
	}

	function historyConflict(message) {
		const error = new Error(message);
		error.status = 409;
		return error;
	}

	function locationsEqual(left, right) {
		return valuesEqual(left, right);
	}

	async function validateResourceChange(change, expectedSide, targetSide) {
		const expectedLocation = change[`${expectedSide}Location`];
		const targetLocation = change[`${targetSide}Location`];
		const readLocation = expectedLocation || targetLocation;
		const current = await repository.readResource(readLocation);
		const exists = current !== undefined;
		if (historyValueHash(current, exists) !== change[`${expectedSide}Hash`]) {
			throw historyConflict("Resource changed after this history entry.");
		}
		if (!validateJsonPatches(current, change.patches || [], expectedSide)) {
			throw historyConflict("Resource no longer matches this history entry.");
		}
		if (
			expectedLocation &&
			current?.id !== null &&
			current?.id !== undefined &&
			String(current.id) !== String(change.stableId)
		) {
			throw historyConflict("History resource identity has changed.");
		}
		if (
			targetLocation &&
			!locationsEqual(expectedLocation, targetLocation) &&
			(await repository.resourceExists(targetLocation))
		) {
			throw historyConflict("History resource destination already exists.");
		}
		return { change, current, expectedLocation, targetLocation, targetSide };
	}

	async function validateActiveMovedResourceChange(
		change,
		expectedSide,
		targetSide,
	) {
		const sourceLocation = change[`${expectedSide}Location`];
		const targetLocation = change[`${targetSide}Location`];
		if (
			!sourceLocation ||
			!targetLocation ||
			locationsEqual(sourceLocation, targetLocation) ||
			(await repository.resourceExists(sourceLocation))
		) {
			throw historyConflict("Active history resource cannot be resumed.");
		}
		const current = await repository.readResource(targetLocation);
		const exists = current !== undefined;
		if (
			historyValueHash(current, exists) !== change[`${expectedSide}Hash`] ||
			!validateJsonPatches(current, change.patches || [], expectedSide)
		) {
			throw historyConflict("Active history resource is in an unknown state.");
		}
		if (
			current?.id !== null &&
			current?.id !== undefined &&
			String(current.id) !== String(change.stableId)
		) {
			throw historyConflict("History resource identity has changed.");
		}
		return {
			change,
			current,
			expectedLocation: targetLocation,
			targetLocation,
			targetSide,
		};
	}

	async function applyValidatedResourceChange(state) {
		const { change, current, expectedLocation, targetLocation, targetSide } = state;
		const targetExists = Boolean(targetLocation);
		const targetValue = applyJsonPatches(current, change.patches || [], targetSide);
		if (
			historyValueHash(targetValue, targetExists) !== change[`${targetSide}Hash`]
		) {
			throw historyConflict("History patch does not produce the expected resource.");
		}
		if (!targetLocation) {
			await repository.removeResource(expectedLocation);
			return;
		}
		if (!expectedLocation) {
			await repository.writeResource(targetLocation, targetValue);
			return;
		}
		if (!locationsEqual(expectedLocation, targetLocation)) {
			await repository.moveResource(expectedLocation, targetLocation);
		}
		await repository.writeResource(targetLocation, targetValue);
	}

	async function validateLifecycleChange(change, expectedSide, targetSide, snapshots) {
		const expected = change[expectedSide];
		const target = change[targetSide];
		const actual = snapshots.byIdentity.get(change.id) || null;
		if (expected === null && actual !== null) {
			throw historyConflict("Application data changed after this history entry.");
		}
		if (expected !== null) {
			if (!actual || String(actual.slug) !== String(expected.slug)) {
				throw historyConflict("Application data changed after this history entry.");
			}
			const currentState = await repository.readTreeState(
				treeLocation("campaign-directory", expected.slug),
			);
			if (
				!currentState.exists ||
				currentState.fingerprint !== expected.fingerprint
			) {
				throw historyConflict("Campaign files changed after this history entry.");
			}
			if (
				historyValueHash(await repository.readCampaign(expected.slug)) !==
				expected.historyFingerprint
			) {
				throw historyConflict("Campaign has newer local history.");
			}
		}
		if (target?.slug && target.slug !== expected?.slug) {
			const collision = snapshots.bySlug.get(String(target.slug));
			const collisionState = await repository.readTreeState(
				treeLocation("campaign-directory", target.slug),
			);
			if ((collision && collision !== actual) || collisionState.exists) {
				throw historyConflict("Campaign destination already exists.");
			}
		}
		const expectedSnapshot = expected
			? await repository.readTombstone(
				expected.tombstone.transactionId,
				expected.tombstone.key,
				expected.snapshotFingerprint,
			)
			: null;
		const expectedTree = expected
			? await repository.readTreeTombstone(expected.tree)
			: null;
		const targetSnapshot = target
			? await repository.readTombstone(
				target.tombstone.transactionId,
				target.tombstone.key,
				target.snapshotFingerprint,
			)
			: null;
		const targetTree = target
			? await repository.readTreeTombstone(target.tree)
			: null;
		return {
			change,
			expected,
			target,
			expectedSnapshot,
			expectedTree,
			targetSnapshot,
			targetTree,
		};
	}

	async function validateActiveLifecycleChange(change, expectedSide, targetSide) {
		const expected = change[expectedSide];
		const target = change[targetSide];
		const sourceLocation = expected
			? treeLocation("campaign-directory", expected.slug)
			: null;
		const targetLocation = target
			? treeLocation("campaign-directory", target.slug)
			: null;
		const sourceState = sourceLocation
			? await repository.readTreeState(sourceLocation)
			: { exists: false, fingerprint: null };
		const targetState = targetLocation
			? await repository.readTreeState(targetLocation)
			: { exists: false, fingerprint: null };
		if (sourceLocation && sourceState.exists) {
			throw historyConflict("Active campaign restoration source is not recoverable.");
		}
		if (
			targetLocation &&
			targetState.exists &&
			targetState.fingerprint !== target.fingerprint
		) {
			throw historyConflict("Active campaign restoration target has changed.");
		}
		if (
			targetLocation &&
			targetState.exists &&
			historyValueHash(await repository.readCampaign(target.slug)) !==
				target.historyFingerprint
		) {
			throw historyConflict("Active campaign restoration has newer local history.");
		}
		const expectedSnapshot = expected
			? await repository.readTombstone(
				expected.tombstone.transactionId,
				expected.tombstone.key,
				expected.snapshotFingerprint,
			)
			: null;
		const expectedTree = expected
			? await repository.readTreeTombstone(expected.tree)
			: null;
		const targetSnapshot = target
			? await repository.readTombstone(
				target.tombstone.transactionId,
				target.tombstone.key,
				target.snapshotFingerprint,
			)
			: null;
		const targetTree = target
			? await repository.readTreeTombstone(target.tree)
			: null;
		return {
			change,
			expected,
			target,
			expectedSnapshot,
			expectedTree,
			targetSnapshot,
			targetTree,
		};
	}

	async function applyValidatedLifecycleChange(state, restoreToken) {
		const { expected, target } = state;
		await repository.restoreLifecycleTree(
			expected
				? treeLocation("campaign-directory", expected.slug)
				: null,
			target
				? treeLocation("campaign-directory", target.slug)
				: null,
			target?.tree || null,
			restoreToken,
			target ? state.targetSnapshot.history : undefined,
		);
	}

	async function validateFilesystemTreeChange(change, expectedSide, targetSide) {
		const expected = change[expectedSide];
		const target = change[targetSide];
		const current = await repository.readTreeState(change.location);
		if (
			Boolean(current.exists) !== Boolean(expected) ||
			(expected && current.fingerprint !== expected.fingerprint)
		) {
			throw historyConflict("Filesystem resource changed after this history entry.");
		}
		const expectedTree = expected
			? await repository.readTreeTombstone(expected.tombstone)
			: null;
		const targetTree = target
			? await repository.readTreeTombstone(target.tombstone)
			: null;
		return { change, expected, target, expectedTree, targetTree };
	}

	async function validateActiveFilesystemTreeChange(change, targetSide) {
		const target = change[targetSide];
		const current = await repository.readTreeState(change.location);
		if (current.exists) {
			throw historyConflict("Active filesystem restoration target has changed.");
		}
		const expected = change[targetSide === "before" ? "after" : "before"];
		const expectedTree = expected
			? await repository.readTreeTombstone(expected.tombstone)
			: null;
		const targetTree = target
			? await repository.readTreeTombstone(target.tombstone)
			: null;
		return { change, expected, target, expectedTree, targetTree };
	}

	async function applyValidatedFilesystemTreeChange(state, restoreToken) {
		await repository.restoreTree(
			state.change.location,
			state.target?.tombstone || null,
			restoreToken,
		);
	}

	async function applyCampaignHistory(slug, direction, expectedRevision) {
		const release = await acquire();
		try {
			const history = await recoverCampaignPending(slug);
			const prepared = prepareHistoryRestore(history, direction, expectedRevision);
			if (!prepared.transaction) {
				return {
					history: getHistoryStatus(history),
					transaction: null,
					focus: null,
				};
			}
			const expectedSide = direction === "undo" ? "after" : "before";
			const targetSide = direction === "undo" ? "before" : "after";
			const retrying = Boolean(history.restoring);
			let progressHistory = prepared.history;
			const completed = new Set(progressHistory.restoring?.completed || []);
			const validated = new Map();
			for (const [index, change] of prepared.transaction.changes.entries()) {
				if (change.kind !== "json-resource") {
					throw historyConflict("Unsupported campaign history entry.");
				}
				if (completed.has(index)) {
					await validateResourceChange(change, targetSide, expectedSide);
					continue;
				}
				try {
					validated.set(
						index,
						await validateResourceChange(change, expectedSide, targetSide),
					);
				} catch (error) {
					if (!retrying || error.status !== 409) throw error;
					try {
						await validateResourceChange(change, targetSide, expectedSide);
						completed.add(index);
						progressHistory = markHistoryRestoreChange(progressHistory, index);
					} catch {
						if (history.restoring?.active !== index) throw error;
						validated.set(
							index,
							await validateActiveMovedResourceChange(
								change,
								expectedSide,
								targetSide,
							),
						);
					}
				}
			}
			await repository.writeCampaign(slug, progressHistory);
			for (const [index, state] of validated) {
				if (completed.has(index)) continue;
				progressHistory = markHistoryRestoreActive(progressHistory, index);
				await repository.writeCampaign(slug, progressHistory);
				await applyValidatedResourceChange(state);
				progressHistory = markHistoryRestoreChange(progressHistory, index);
				await repository.writeCampaign(slug, progressHistory);
			}
			const transition = createHistoryTransition(
				progressHistory,
				direction,
				expectedRevision,
			);
			await repository.writeCampaign(slug, transition.history);
			return {
				history: getHistoryStatus(transition.history),
				transaction: transactionSummary(prepared.transaction),
				currentSlug: slug,
				focus: historyFocusTarget(prepared.transaction, targetSide),
			};
		} finally {
			release();
		}
	}

	async function applyApplicationHistory(direction, expectedRevision) {
		const release = await acquire();
		try {
			const history = await recoverApplicationPending();
			const prepared = prepareHistoryRestore(history, direction, expectedRevision);
			if (!prepared.transaction) {
				return {
					history: getHistoryStatus(history),
					transaction: null,
					focus: null,
				};
			}
			const expectedSide = direction === "undo" ? "after" : "before";
			const targetSide = direction === "undo" ? "before" : "after";
			const retrying = Boolean(history.restoring);
			let progressHistory = prepared.history;
			const completed = new Set(progressHistory.restoring?.completed || []);
			const needsLifecycleSnapshot = prepared.transaction.changes.some(
				(change) => change.kind === "campaign-lifecycle",
			);
			const current = needsLifecycleSnapshot
				? await captureApplication("metadata")
				: [];
			const snapshots = {
				byIdentity: indexApplicationSnapshot(current),
				bySlug: indexApplicationSnapshotBySlug(current),
			};
			const validated = new Map();
			for (const [index, change] of prepared.transaction.changes.entries()) {
				const validate = async (sourceSide, destinationSide) => {
					if (change.kind === "campaign-lifecycle") {
						return {
							kind: "lifecycle",
							state: await validateLifecycleChange(
								change,
								sourceSide,
								destinationSide,
								snapshots,
							),
						};
					}
					if (change.kind === "json-resource") {
						return {
							kind: "resource",
							state: await validateResourceChange(
								change,
								sourceSide,
								destinationSide,
							),
						};
					}
					if (change.kind === "filesystem-tree") {
						return {
							kind: "tree",
							state: await validateFilesystemTreeChange(
								change,
								sourceSide,
								destinationSide,
							),
						};
					}
					throw historyConflict("Unsupported application history entry.");
				};
				if (completed.has(index)) {
					await validate(targetSide, expectedSide);
					continue;
				}
				try {
					validated.set(index, await validate(expectedSide, targetSide));
				} catch (error) {
					if (!retrying || error.status !== 409) throw error;
					try {
						await validate(targetSide, expectedSide);
						completed.add(index);
						progressHistory = markHistoryRestoreChange(progressHistory, index);
					} catch {
						if (history.restoring?.active !== index) throw error;
						if (change.kind === "campaign-lifecycle") {
							validated.set(index, {
								kind: "lifecycle",
								state: await validateActiveLifecycleChange(
									change,
									expectedSide,
									targetSide,
								),
							});
						} else if (change.kind === "filesystem-tree") {
							validated.set(index, {
								kind: "tree",
								state: await validateActiveFilesystemTreeChange(
									change,
									targetSide,
								),
							});
						} else if (change.kind === "json-resource") {
							validated.set(index, {
								kind: "resource",
								state: await validateActiveMovedResourceChange(
									change,
									expectedSide,
									targetSide,
								),
							});
						} else {
							throw error;
						}
					}
				}
			}
			await repository.writeApplication(progressHistory);
			for (const [index, item] of validated) {
				if (completed.has(index)) continue;
				progressHistory = markHistoryRestoreActive(progressHistory, index);
				await repository.writeApplication(progressHistory);
				const restoreToken = `${prepared.transaction.id}-${direction}-${index}`;
				if (item.kind === "lifecycle") {
					await applyValidatedLifecycleChange(item.state, restoreToken);
				} else if (item.kind === "tree") {
					await applyValidatedFilesystemTreeChange(item.state, restoreToken);
				} else {
					await applyValidatedResourceChange(item.state);
				}
				progressHistory = markHistoryRestoreChange(progressHistory, index);
				await repository.writeApplication(progressHistory);
			}
			const transition = createHistoryTransition(
				progressHistory,
				direction,
				expectedRevision,
			);
			await repository.writeApplication(transition.history);
			await purgeUnreachableTombstones(
				progressHistory,
				transition.history,
			).catch(() => {});
			return {
				history: getHistoryStatus(transition.history),
				transaction: transactionSummary(prepared.transaction),
				currentSlug: restoredCampaignSlug(prepared.transaction, targetSide),
				focus: historyFocusTarget(prepared.transaction, targetSide),
			};
		} finally {
			release();
		}
	}

	async function getCampaignStatus(slug) {
		const release = await acquire();
		try {
			return getHistoryStatus(await recoverCampaignPending(slug));
		} finally {
			release();
		}
	}

	async function getApplicationStatus() {
		const release = await acquire();
		try {
			return getHistoryStatus(await recoverApplicationPending());
		} finally {
			release();
		}
	}

	async function clearCampaignHistory(slug) {
		const release = await acquire();
		try {
			await repository.removeCampaign(slug);
		} finally {
			release();
		}
	}

	async function clearApplicationHistory() {
		const release = await acquire();
		try {
			await repository.removeApplication();
		} finally {
			release();
		}
	}

	return Object.freeze({
		applyApplicationHistory,
		applyCampaignHistory,
		beginApplication,
		beginCampaign,
		finishApplication,
		finishCampaign,
		clearApplicationHistory,
		clearCampaignHistory,
		getApplicationStatus,
		getCampaignStatus,
	});
}

module.exports = { createHistoryService };
