function preserveExistingIds(before, after) {
	if (Array.isArray(before) && Array.isArray(after)) {
		return after.map((item, index) => preserveExistingIds(before[index], item));
	}
	if (
		before &&
		after &&
		typeof before === "object" &&
		typeof after === "object" &&
		!Array.isArray(before) &&
		!Array.isArray(after)
	) {
		const next = { ...after };
		if (Object.prototype.hasOwnProperty.call(before, "id")) next.id = before.id;
		for (const key of Object.keys(next)) {
			next[key] = preserveExistingIds(before[key], next[key]);
		}
		return next;
	}
	return after;
}

function patchDraftAiChanges(entry, rawResources, buildChangeSummary) {
	if (entry?.applyState !== "draft") {
		const error = new Error("Only draft AI responses can be edited.");
		error.status = 400;
		throw error;
	}
	if (!Array.isArray(rawResources)) {
		const error = new Error("resources must be an array.");
		error.status = 400;
		throw error;
	}
	const afterById = new Map(
		rawResources
			.filter((resource) => resource && typeof resource === "object")
			.map((resource) => [String(resource.id || ""), resource.after ?? null]),
	);
	const resources = (entry.changes?.resources || []).map((resource) =>
		afterById.has(resource.id)
			? {
					...resource,
					after: preserveExistingIds(
						resource.before,
						afterById.get(resource.id),
					),
				}
			: resource,
	);
	return {
		...(entry.changes || {}),
		resources,
		summary: buildChangeSummary(resources),
	};
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
