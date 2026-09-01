const crypto = require("crypto");

const ARRAY_IDENTITY_KEYS = ["instanceId", "id", "slug"];

function clone(value) {
	return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function valuesEqual(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}

function isPresentationKey(key) {
	return key === "collapsed" || /^is.*Collapsed$/.test(key);
}

function canonicalHistoryValue(value) {
	if (Array.isArray(value)) return value.map(canonicalHistoryValue);
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.keys(value)
			.filter((key) => !isPresentationKey(key))
			.sort()
			.map((key) => [key, canonicalHistoryValue(value[key])]),
	);
}

function historyValueHash(value, exists = true) {
	const serialized = exists
		? JSON.stringify(canonicalHistoryValue(value))
		: "<missing>";
	return crypto.createHash("sha256").update(serialized).digest("hex");
}

function snapshotState(exists, value, index) {
	if (!exists) return { exists: false };
	const state = { exists: true, value: clone(value) };
	if (Number.isSafeInteger(index)) state.index = index;
	return state;
}

function identityToken(value) {
	return String(value);
}

function uniqueArrayIdentity(items, key) {
	const result = new Map();
	for (const [index, item] of items.entries()) {
		if (!item || typeof item !== "object" || Array.isArray(item)) return null;
		if (item[key] === null || item[key] === undefined) return null;
		const token = identityToken(item[key]);
		if (result.has(token)) return null;
		result.set(token, { index, item, value: item[key] });
	}
	return result;
}

function findArrayIdentity(before, after) {
	if (before.length === 0 && after.length === 0) return null;
	for (const key of ARRAY_IDENTITY_KEYS) {
		const beforeIndex = uniqueArrayIdentity(before, key);
		const afterIndex = uniqueArrayIdentity(after, key);
		if (beforeIndex && afterIndex) return { key, beforeIndex, afterIndex };
	}
	return null;
}

function selector(key, value) {
	return { by: key, value: clone(value) };
}

function createValuePatch(path, beforeExists, before, afterExists, after, indexes = {}) {
	return {
		kind: "value",
		path: clone(path),
		before: snapshotState(beforeExists, before, indexes.before),
		after: snapshotState(afterExists, after, indexes.after),
	};
}

function diffKeyedArray(before, after, path, identity) {
	const patches = [];
	const { key, beforeIndex, afterIndex } = identity;
	for (const [token, record] of beforeIndex) {
		const next = afterIndex.get(token);
		const itemPath = [...path, selector(key, record.value)];
		if (!next) {
			patches.push(
				createValuePatch(
					itemPath,
					true,
					record.item,
					false,
					undefined,
					{ before: record.index },
				),
			);
			continue;
		}
		patches.push(...diffJson(record.item, next.item, itemPath));
	}
	for (const [token, record] of afterIndex) {
		if (beforeIndex.has(token)) continue;
		patches.push(
			createValuePatch(
				[...path, selector(key, record.value)],
				false,
				undefined,
				true,
				record.item,
				{ after: record.index },
			),
		);
	}
	const beforeOrder = before.map((item) => clone(item[key]));
	const afterOrder = after.map((item) => clone(item[key]));
	if (!valuesEqual(beforeOrder, afterOrder)) {
		patches.push({
			kind: "array-order",
			path: clone(path),
			identityKey: key,
			before: beforeOrder,
			after: afterOrder,
		});
	}
	return patches;
}

function findCommonArrayRange(before, after) {
	let start = 0;
	while (
		start < before.length &&
		start < after.length &&
		valuesEqual(
			canonicalHistoryValue(before[start]),
			canonicalHistoryValue(after[start]),
		)
	) {
		start += 1;
	}
	let beforeEnd = before.length;
	let afterEnd = after.length;
	while (
		beforeEnd > start &&
		afterEnd > start &&
		valuesEqual(
			canonicalHistoryValue(before[beforeEnd - 1]),
			canonicalHistoryValue(after[afterEnd - 1]),
		)
	) {
		beforeEnd -= 1;
		afterEnd -= 1;
	}
	return { start, beforeEnd, afterEnd };
}

function diffUnkeyedArray(before, after, path) {
	if (before.length === after.length) {
		return before.flatMap((item, index) =>
			diffJson(item, after[index], [...path, index]),
		);
	}
	const { start, beforeEnd, afterEnd } = findCommonArrayRange(before, after);
	return [{
		kind: "array-splice",
		path: clone(path),
		before: {
			index: start,
			length: before.length,
			items: clone(before.slice(start, beforeEnd)),
		},
		after: {
			index: start,
			length: after.length,
			items: clone(after.slice(start, afterEnd)),
		},
	}];
}

function diffJson(before, after, path = []) {
	if (
		valuesEqual(
			canonicalHistoryValue(before),
			canonicalHistoryValue(after),
		)
	) {
		return [];
	}
	if (Array.isArray(before) && Array.isArray(after)) {
		const identity = findArrayIdentity(before, after);
		return identity
			? diffKeyedArray(before, after, path, identity)
			: diffUnkeyedArray(before, after, path);
	}
	const beforeObject = Boolean(before && typeof before === "object" && !Array.isArray(before));
	const afterObject = Boolean(after && typeof after === "object" && !Array.isArray(after));
	if (beforeObject && afterObject) {
		const keys = [...Object.keys(before)];
		for (const key of Object.keys(after)) {
			if (!Object.prototype.hasOwnProperty.call(before, key)) keys.push(key);
		}
		return keys.flatMap((key) => {
			if (isPresentationKey(key)) return [];
			const beforeExists = Object.prototype.hasOwnProperty.call(before, key);
			const afterExists = Object.prototype.hasOwnProperty.call(after, key);
			if (!beforeExists || !afterExists) {
				return [createValuePatch(
					[...path, key],
					beforeExists,
					before[key],
					afterExists,
					after[key],
				)];
			}
			return diffJson(before[key], after[key], [...path, key]);
		});
	}
	return [createValuePatch(path, true, before, true, after)];
}

function createJsonPatches(before, after, beforeExists = true, afterExists = true) {
	if (!beforeExists || !afterExists) {
		if (beforeExists === afterExists) return [];
		return [createValuePatch([], beforeExists, before, afterExists, after)];
	}
	return diffJson(before, after);
}

function isSelector(segment) {
	return Boolean(
		segment &&
		typeof segment === "object" &&
		!Array.isArray(segment) &&
		typeof segment.by === "string",
	);
}

function selectorIndex(array, segment) {
	if (!Array.isArray(array)) return -1;
	return array.findIndex((item) =>
		item &&
		typeof item === "object" &&
		item[segment.by] !== null &&
		item[segment.by] !== undefined &&
		identityToken(item[segment.by]) === identityToken(segment.value),
	);
}

function locate(root, path) {
	if (path.length === 0) {
		return { exists: root !== undefined, value: root, root: true };
	}
	let current = root;
	for (let index = 0; index < path.length - 1; index += 1) {
		const segment = path[index];
		if (isSelector(segment)) {
			const itemIndex = selectorIndex(current, segment);
			if (itemIndex < 0) return { exists: false, missingParent: true };
			current = current[itemIndex];
			continue;
		}
		if (
			current === null ||
			current === undefined ||
			!Object.prototype.hasOwnProperty.call(Object(current), segment)
		) {
			return { exists: false, missingParent: true };
		}
		current = current[segment];
	}
	const segment = path[path.length - 1];
	if (isSelector(segment)) {
		const index = selectorIndex(current, segment);
		return {
			exists: index >= 0,
			value: index >= 0 ? current[index] : undefined,
			parent: current,
			segment,
			index,
			selector: true,
		};
	}
	const exists = Boolean(
		current !== null &&
		current !== undefined &&
		Object.prototype.hasOwnProperty.call(Object(current), segment),
	);
	return {
		exists,
		value: exists ? current[segment] : undefined,
		parent: current,
		segment,
		index: Array.isArray(current) && Number.isInteger(segment) ? segment : undefined,
	};
}

function stateMatches(location, state) {
	if (Boolean(location.exists) !== Boolean(state.exists)) return false;
	if (!state.exists) return true;
	return valuesEqual(
		canonicalHistoryValue(location.value),
		canonicalHistoryValue(state.value),
	);
}

function arrayIdentityOrder(array, identityKey) {
	if (!Array.isArray(array)) return null;
	const indexed = uniqueArrayIdentity(array, identityKey);
	if (!indexed) return null;
	return array.map((item) => clone(item[identityKey]));
}

function validateJsonPatches(value, patches, side) {
	for (const patch of patches) {
		const expected = patch[side];
		if (patch.kind === "value") {
			if (!stateMatches(locate(value, patch.path), expected)) return false;
			continue;
		}
		const location = locate(value, patch.path);
		if (!location.exists) return false;
		if (patch.kind === "array-order") {
			if (!valuesEqual(arrayIdentityOrder(location.value, patch.identityKey), expected)) {
				return false;
			}
			continue;
		}
		if (patch.kind === "array-splice") {
			if (!Array.isArray(location.value) || location.value.length !== expected.length) {
				return false;
			}
			if (!valuesEqual(
				canonicalHistoryValue(
					location.value.slice(expected.index, expected.index + expected.items.length),
				),
				canonicalHistoryValue(expected.items),
			)) {
				return false;
			}
			continue;
		}
		return false;
	}
	return true;
}

function setValueAtPath(root, path, target) {
	if (path.length === 0) return target.exists ? clone(target.value) : undefined;
	const location = locate(root, path);
	if (location.missingParent || !location.parent) {
		throw new Error("History patch target is missing.");
	}
	if (location.selector) {
		if (!Array.isArray(location.parent)) {
			throw new Error("History array patch target is invalid.");
		}
		if (!target.exists) {
			if (location.exists) location.parent.splice(location.index, 1);
			return root;
		}
		if (location.exists) {
			location.parent[location.index] = clone(target.value);
			return root;
		}
		const index = Number.isSafeInteger(target.index)
			? Math.max(0, Math.min(target.index, location.parent.length))
			: location.parent.length;
		location.parent.splice(index, 0, clone(target.value));
		return root;
	}
	if (Array.isArray(location.parent) && Number.isInteger(location.segment)) {
		if (!target.exists) {
			if (location.exists) location.parent.splice(location.segment, 1);
		} else if (location.exists) {
			location.parent[location.segment] = clone(target.value);
		} else {
			location.parent.splice(location.segment, 0, clone(target.value));
		}
		return root;
	}
	if (target.exists) location.parent[location.segment] = clone(target.value);
	else delete location.parent[location.segment];
	return root;
}

function applyArrayOrder(root, patch, side) {
	const location = locate(root, patch.path);
	if (!location.exists || !Array.isArray(location.value)) {
		throw new Error("History array order target is missing.");
	}
	const index = uniqueArrayIdentity(location.value, patch.identityKey);
	const order = patch[side];
	if (!index || index.size !== order.length) {
		throw new Error("History array order target conflicts with the transaction.");
	}
	const reordered = order.map((value) => {
		const record = index.get(identityToken(value));
		if (!record) {
			throw new Error("History array item is missing.");
		}
		return record.item;
	});
	location.value.splice(0, location.value.length, ...reordered);
	return root;
}

function applyArraySplice(root, patch, side) {
	const location = locate(root, patch.path);
	if (!location.exists || !Array.isArray(location.value)) {
		throw new Error("History array splice target is missing.");
	}
	const expectedSide = side === "before" ? "after" : "before";
	const expected = patch[expectedSide];
	const target = patch[side];
	location.value.splice(
		expected.index,
		expected.items.length,
		...clone(target.items),
	);
	return root;
}

function applyJsonPatches(value, patches, side) {
	let result = clone(value);
	for (const patch of patches) {
		if (patch.kind === "value") {
			result = setValueAtPath(result, patch.path, patch[side]);
		}
	}
	for (const patch of patches) {
		if (patch.kind === "array-splice") {
			result = applyArraySplice(result, patch, side);
		}
	}
	for (const patch of patches) {
		if (patch.kind === "array-order") {
			result = applyArrayOrder(result, patch, side);
		}
	}
	return result;
}

function locationKey(location) {
	if (!location) return "<missing>";
	if (location.resource === "campaign-meta") return `meta:${location.campaignSlug}`;
	if (location.resource === "session") {
		return `session:${location.campaignSlug}:${location.fileName}`;
	}
	if (location.resource === "entity") {
		return `entity:${location.campaignSlug}:${location.entityType}:${location.entitySlug}`;
	}
	return `ai:${location.campaignSlug}`;
}

function contentId(record) {
	return record?.value?.id;
}

function stableToken(record) {
	const id = contentId(record);
	return id === null || id === undefined ? null : String(id);
}

function uniqueStableIndex(records) {
	const counts = new Map();
	for (const record of records) {
		const token = stableToken(record);
		if (token !== null) counts.set(token, (counts.get(token) || 0) + 1);
	}
	const result = new Map();
	for (const record of records) {
		const token = stableToken(record);
		if (token !== null && counts.get(token) === 1) result.set(token, record);
	}
	return result;
}

function pairResourceRecords(beforeRecords, afterRecords) {
	const pairs = [];
	const matchedBefore = new Set();
	const matchedAfter = new Set();
	const beforeIds = uniqueStableIndex(beforeRecords);
	const afterIds = uniqueStableIndex(afterRecords);
	for (const [token, before] of beforeIds) {
		const after = afterIds.get(token);
		if (!after) continue;
		pairs.push({ before, after });
		matchedBefore.add(before);
		matchedAfter.add(after);
	}
	const remainingAfterByLocation = new Map();
	for (const record of afterRecords) {
		if (!matchedAfter.has(record)) {
			remainingAfterByLocation.set(locationKey(record.location), record);
		}
	}
	for (const before of beforeRecords) {
		if (matchedBefore.has(before)) continue;
		const after = remainingAfterByLocation.get(locationKey(before.location));
		if (!after || matchedAfter.has(after)) continue;
		pairs.push({ before, after });
		matchedBefore.add(before);
		matchedAfter.add(after);
	}
	for (const before of beforeRecords) {
		if (!matchedBefore.has(before)) pairs.push({ before, after: null });
	}
	for (const after of afterRecords) {
		if (!matchedAfter.has(after)) pairs.push({ before: null, after });
	}
	return pairs;
}

function sessionRecords(bundle, campaignSlug) {
	return (Array.isArray(bundle?.sessions) ? bundle.sessions : []).map((session) => ({
		location: {
			resource: "session",
			campaignSlug,
			fileName: String(session?.fileName || ""),
		},
		value: session?.content,
	}));
}

function entityRecords(bundle, campaignSlug) {
	const result = [];
	for (const entityType of ["characters", "npc", "locations"]) {
		for (const entity of Array.isArray(bundle?.entities?.[entityType])
			? bundle.entities[entityType]
			: []) {
			result.push({
				location: {
					resource: "entity",
					campaignSlug,
					entityType,
					entitySlug: String(entity?.slug || ""),
				},
				value: entity,
			});
		}
	}
	return result;
}

function createResourceChange(resource, before, after, campaignId) {
	const beforeExists = Boolean(before);
	const afterExists = Boolean(after);
	const beforeValue = before?.value;
	const afterValue = after?.value;
	const patches = createJsonPatches(
		beforeValue,
		afterValue,
		beforeExists,
		afterExists,
	);
	const moved = locationKey(before?.location) !== locationKey(after?.location);
	if (patches.length === 0 && !moved) return null;
	const stableId = contentId(before) ?? contentId(after) ?? locationKey(before?.location || after?.location);
	return {
		kind: "json-resource",
		resource,
		campaignId: campaignId === undefined ? null : clone(campaignId),
		stableId: clone(stableId),
		beforeLocation: clone(before?.location || null),
		afterLocation: clone(after?.location || null),
		beforeHash: historyValueHash(beforeValue, beforeExists),
		afterHash: historyValueHash(afterValue, afterExists),
		patches,
	};
}

function appendPairedChanges(target, resource, beforeRecords, afterRecords, campaignId) {
	for (const pair of pairResourceRecords(beforeRecords, afterRecords)) {
		const change = createResourceChange(resource, pair.before, pair.after, campaignId);
		if (change) target.push(change);
	}
}

function buildCampaignResourceChanges(
	beforeBundle,
	afterBundle,
	beforeSlug,
	afterSlug = beforeSlug,
	options = {},
) {
	const changes = [];
	const campaignId = beforeBundle?.meta?.id ?? afterBundle?.meta?.id ?? null;
	if (beforeBundle?.meta || afterBundle?.meta) {
		const metaChange = createResourceChange(
			"campaign-meta",
			beforeBundle?.meta
				? {
					location: { resource: "campaign-meta", campaignSlug: beforeSlug },
					value: beforeBundle.meta,
				}
				: null,
			afterBundle?.meta
				? {
					location: { resource: "campaign-meta", campaignSlug: afterSlug },
					value: afterBundle.meta,
				}
				: null,
			campaignId,
		);
		if (metaChange) changes.push(metaChange);
	}
	appendPairedChanges(
		changes,
		"session",
		sessionRecords(beforeBundle, beforeSlug),
		sessionRecords(afterBundle, afterSlug),
		campaignId,
	);
	appendPairedChanges(
		changes,
		"entity",
		entityRecords(beforeBundle, beforeSlug),
		entityRecords(afterBundle, afterSlug),
		campaignId,
	);
	if (options.includeAiResponses) {
		const beforeExists = Boolean(beforeBundle && Object.prototype.hasOwnProperty.call(beforeBundle, "aiResponses"));
		const afterExists = Boolean(afterBundle && Object.prototype.hasOwnProperty.call(afterBundle, "aiResponses"));
		const aiChange = createResourceChange(
			"ai-history",
			beforeExists
				? {
					location: { resource: "ai-history", campaignSlug: beforeSlug },
					value: beforeBundle.aiResponses,
				}
				: null,
			afterExists
				? {
					location: { resource: "ai-history", campaignSlug: afterSlug },
					value: afterBundle.aiResponses,
				}
				: null,
			campaignId,
		);
		if (aiChange) changes.push(aiChange);
	}
	return changes;
}

module.exports = {
	applyJsonPatches,
	buildCampaignResourceChanges,
	canonicalHistoryValue,
	createJsonPatches,
	historyValueHash,
	validateJsonPatches,
};
