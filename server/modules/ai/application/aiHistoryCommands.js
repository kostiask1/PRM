function hasAlignedArrays(before, after) {
	if (!Array.isArray(before)) return false;
	return Array.isArray(after);
}

function hasObjectOperands(before, after) {
	if (!before) return false;
	if (!after) return false;
	if (typeof before !== "object") return false;
	return typeof after === "object";
}

function hasAlignedNonArrayObjects(before, after) {
	if (!hasObjectOperands(before, after)) return false;
	if (Array.isArray(before)) return false;
	return !Array.isArray(after);
}

function preserveArrayIds(before, after) {
	return after.map((item, index) => preserveExistingIds(before[index], item));
}

function preserveObjectIds(before, after) {
	const next = { ...after };
	if (Object.prototype.hasOwnProperty.call(before, "id")) next.id = before.id;
	for (const key of Object.keys(next)) {
		next[key] = preserveExistingIds(before[key], next[key]);
	}
	return next;
}

function preserveExistingIds(before, after) {
	if (hasAlignedArrays(before, after)) return preserveArrayIds(before, after);
	if (hasAlignedNonArrayObjects(before, after))
		return preserveObjectIds(before, after);
	return after;
}

function assertDraftEntry(entry) {
	if (entry?.applyState !== "draft") {
		const error = new Error("Only draft AI responses can be edited.");
		error.status = 400;
		throw error;
	}
}

function assertSubmittedResources(rawResources) {
	if (!Array.isArray(rawResources)) {
		const error = new Error("resources must be an array.");
		error.status = 400;
		throw error;
	}
}

function isSubmittedResource(resource) {
	return resource && typeof resource === "object";
}

function projectSubmittedResource(resource) {
	return [String(resource.id || ""), resource.after ?? null];
}

function createSubmittedAfterMap(rawResources) {
	return new Map(
		rawResources
			.filter(isSubmittedResource)
			.map(projectSubmittedResource),
	);
}

function patchStoredResource(resource, afterById) {
	if (!afterById.has(resource.id)) return resource;
	return {
		...resource,
		after: preserveExistingIds(
			resource.before,
			afterById.get(resource.id),
		),
	};
}

function patchStoredResources(entry, afterById) {
	return (entry.changes?.resources || []).map((resource) =>
		patchStoredResource(resource, afterById),
	);
}

function assembleDraftChanges(entry, resources, buildChangeSummary) {
	return {
		...(entry.changes || {}),
		resources,
		summary: buildChangeSummary(resources),
	};
}

function patchDraftAiChanges(entry, rawResources, buildChangeSummary) {
	assertDraftEntry(entry);
	assertSubmittedResources(rawResources);
	const afterById = createSubmittedAfterMap(rawResources);
	const resources = patchStoredResources(entry, afterById);
	return assembleDraftChanges(entry, resources, buildChangeSummary);
}

function createAiHistoryCommands({ repository, restoreSnapshot, buildChangeSummary }) {
	async function requireEntry(campaignSlug, id) {
		const entry = await repository.get(campaignSlug, id);
		if (!entry) {
			const error = new Error("AI response not found.");
			error.status = 404;
			throw error;
		}
		return entry;
	}

	return {
		async patchDraft({ campaignSlug, id, resources }) {
			const entry = await requireEntry(campaignSlug, id);
			const changes = patchDraftAiChanges(
				entry,
				resources,
				buildChangeSummary,
			);
			return repository.update(campaignSlug, entry.id, { changes });
		},
		async apply({ campaignSlug, id, resourceIds }) {
			const entry = await requireEntry(campaignSlug, id);
			return restoreSnapshot(entry, "after", { resourceIds });
		},
		async undo({ campaignSlug, id, resourceIds }) {
			const entry = await requireEntry(campaignSlug, id);
			return restoreSnapshot(entry, "before", { resourceIds });
		},
	};
}

module.exports = {
	createAiHistoryCommands,
	patchDraftAiChanges,
	preserveExistingIds,
};
