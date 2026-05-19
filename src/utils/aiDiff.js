function snapshotToDiffText(value) {
	if (value === null || value === undefined) return "";
	return JSON.stringify(value, null, 2);
}

function splitDiffText(value) {
	const text = snapshotToDiffText(value);
	return text ? text.split(/\r?\n/) : [];
}

export function createLineDiff(before, after) {
	const oldLines = splitDiffText(before);
	const newLines = splitDiffText(after);
	if (oldLines.length === 0 && newLines.length === 0) return [];

	if (oldLines.length * newLines.length > 200000) {
		return [
			...oldLines.map((text, index) => ({
				type: "removed",
				oldNumber: index + 1,
				newNumber: null,
				text,
			})),
			...newLines.map((text, index) => ({
				type: "added",
				oldNumber: null,
				newNumber: index + 1,
				text,
			})),
		];
	}

	const dp = Array.from({ length: oldLines.length + 1 }, () =>
		Array(newLines.length + 1).fill(0),
	);
	for (let i = oldLines.length - 1; i >= 0; i -= 1) {
		for (let j = newLines.length - 1; j >= 0; j -= 1) {
			dp[i][j] =
				oldLines[i] === newLines[j]
					? dp[i + 1][j + 1] + 1
					: Math.max(dp[i + 1][j], dp[i][j + 1]);
		}
	}

	const lines = [];
	let i = 0;
	let j = 0;
	let oldNumber = 1;
	let newNumber = 1;
	while (i < oldLines.length || j < newLines.length) {
		if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
			lines.push({
				type: "context",
				oldNumber,
				newNumber,
				text: oldLines[i],
			});
			i += 1;
			j += 1;
			oldNumber += 1;
			newNumber += 1;
		} else if (
			j >= newLines.length ||
			(i < oldLines.length && dp[i + 1][j] >= dp[i][j + 1])
		) {
			lines.push({
				type: "removed",
				oldNumber,
				newNumber: null,
				text: oldLines[i],
			});
			i += 1;
			oldNumber += 1;
		} else {
			lines.push({
				type: "added",
				oldNumber: null,
				newNumber,
				text: newLines[j],
			});
			j += 1;
			newNumber += 1;
		}
	}
	return lines;
}

export function getDiffResourceState(resource, labels = {}) {
	if (resource.before === null && resource.after !== null) {
		return labels.added || "Added";
	}
	if (resource.before !== null && resource.after === null) {
		return labels.deleted || "Deleted";
	}
	return labels.modified || "Modified";
}

function snapshotsEqual(before, after) {
	return JSON.stringify(before ?? null) === JSON.stringify(after ?? null);
}

function getDiffResourceFieldSummary(resource) {
	const before = resource.before;
	const after = resource.after;
	if (!before || !after || typeof before !== "object" || typeof after !== "object") {
		return [];
	}
	if (Array.isArray(before) || Array.isArray(after)) return [];

	const ignoredKeys = new Set(["id", "slug", "source", "updatedAt"]);
	return [...new Set([...Object.keys(before), ...Object.keys(after)])]
		.filter((key) => !ignoredKeys.has(key))
		.filter((key) => !snapshotsEqual(before[key], after[key]))
		.slice(0, 8);
}

function getSessionSnapshotData(snapshot) {
	return snapshot && typeof snapshot === "object" && snapshot.data
		? snapshot.data
		: {};
}

function getDiffItemKey(item, index, getName) {
	if (item && typeof item === "object") {
		const identity = String(item.id || item.slug || "").trim();
		if (identity) return identity;
		const name = String(getName?.(item) || item.name || item.title || "").trim();
		if (name) return `name:${name.toLowerCase()}`;
	}
	return `index:${index}`;
}

function pushGranularDiff(resources, resource, suffix, before, after) {
	if (snapshotsEqual(before, after)) return;
	resources.push({
		...resource,
		id: `${resource.id}:${suffix}`,
		label: `${resource.label}#${suffix}`,
		before: before === undefined ? null : before,
		after: after === undefined ? null : after,
	});
}

function pushGranularArrayDiff(resources, resource, pathLabel, before, after, getName) {
	const beforeList = Array.isArray(before) ? before : [];
	const afterList = Array.isArray(after) ? after : [];
	const beforeByKey = new Map(
		beforeList.map((item, index) => [getDiffItemKey(item, index, getName), item]),
	);
	const afterByKey = new Map(
		afterList.map((item, index) => [getDiffItemKey(item, index, getName), item]),
	);

	for (const key of new Set([...beforeByKey.keys(), ...afterByKey.keys()])) {
		const beforeItem = beforeByKey.get(key);
		const afterItem = afterByKey.get(key);
		const labelSource = afterItem || beforeItem;
		const name = String(getName?.(labelSource) || "").trim();
		const suffix = name ? `${pathLabel}/${name}` : `${pathLabel}/${key}`;
		pushGranularDiff(resources, resource, suffix, beforeItem, afterItem);
	}
}

function getCharacterDisplayName(entity = {}) {
	const firstName = String(entity.firstName || entity.first_name || "").trim();
	const lastName = String(entity.lastName || entity.last_name || "").trim();
	const combined = `${firstName} ${lastName}`.trim();
	if (combined) return combined;
	return String(entity.name || entity.title || "").trim();
}

function getLocationDisplayName(entity = {}) {
	return String(entity.name || entity.title || "").trim();
}

function expandSessionDiffResource(resource, labels = {}) {
	if (resource?.kind !== "session" || (!resource.before && !resource.after)) {
		return [resource];
	}

	const expanded = [];
	const before = resource.before || {};
	const after = resource.after || {};
	const beforeData = getSessionSnapshotData(before);
	const afterData = getSessionSnapshotData(after);

	pushGranularDiff(expanded, resource, "name", before.name, after.name);
	pushGranularDiff(
		expanded,
		resource,
		"summary",
		beforeData.result_text,
		afterData.result_text,
	);
	pushGranularArrayDiff(
		expanded,
		resource,
		"notes",
		beforeData.notes,
		afterData.notes,
		(note) => note?.title || note?.text || labels.note || "Note",
	);
	pushGranularArrayDiff(
		expanded,
		resource,
		"npcs",
		beforeData.npcs,
		afterData.npcs,
		getCharacterDisplayName,
	);
	pushGranularArrayDiff(
		expanded,
		resource,
		"locations",
		beforeData.locations,
		afterData.locations,
		getLocationDisplayName,
	);
	pushGranularArrayDiff(
		expanded,
		resource,
		"scenes",
		beforeData.scenes,
		afterData.scenes,
		(scene) => scene?.texts?.summary || scene?.name || labels.scene || "Scene",
	);
	pushGranularArrayDiff(
		expanded,
		resource,
		"encounters",
		beforeData.encounters,
		afterData.encounters,
		(encounter) => encounter?.name || labels.encounter || "Encounter",
	);

	const coveredDataKeys = new Set([
		"result_text",
		"notes",
		"npcs",
		"locations",
		"scenes",
		"encounters",
	]);
	for (const key of new Set([
		...Object.keys(beforeData || {}),
		...Object.keys(afterData || {}),
	])) {
		if (coveredDataKeys.has(key)) continue;
		pushGranularDiff(expanded, resource, `data.${key}`, beforeData[key], afterData[key]);
	}

	const coveredTopLevelKeys = new Set(["data", "name"]);
	for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
		if (coveredTopLevelKeys.has(key)) continue;
		pushGranularDiff(expanded, resource, key, before[key], after[key]);
	}

	return expanded.length > 0 ? expanded : [resource];
}

function expandCustomBestiaryDiffResource(resource, labels = {}) {
	if (
		resource?.kind !== "custom-bestiary" ||
		(!Array.isArray(resource.before) && !Array.isArray(resource.after))
	) {
		return [resource];
	}

	const expanded = [];
	pushGranularArrayDiff(
		expanded,
		resource,
		"monsters",
		resource.before,
		resource.after,
		(monster) => monster?.name || labels.creature || "Creature",
	);
	return expanded.length > 0 ? expanded : [resource];
}

export function buildDiffResources(entry, labels = {}) {
	const resources = Array.isArray(entry?.changes?.resources)
		? entry.changes.resources
		: [];
	return resources
		.flatMap((resource) => expandSessionDiffResource(resource, labels))
		.flatMap((resource) => expandCustomBestiaryDiffResource(resource, labels))
		.map((resource) => ({
			...resource,
			fieldSummary: getDiffResourceFieldSummary(resource),
			lines: createLineDiff(resource.before, resource.after),
		}));
}
