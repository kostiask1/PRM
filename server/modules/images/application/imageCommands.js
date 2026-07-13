function parseList(value) {
	return String(value || "")
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function parseGalleryQuery(query = {}, defaultSource = "") {
	return {
		source: query.source || defaultSource,
		category: query.category || "",
		subcategory: query.subcategory || "",
		categories: parseList(query.categories),
		ignoreSourcesList: parseList(query.ignoreSources),
	};
}

function createImageCommands(repository) {
	return {
		list({ slug, category, subcategory = "" }) {
			return repository.list(slug, category, subcategory);
		},
		stats({ query }) {
			return repository.stats(parseGalleryQuery(query, "general"));
		},
		listBestiaryTokens({ query }) {
			return repository.listBestiaryTokens({
				subcategory: query.subcategory || "",
				search: query.search || "",
				recursive: query.recursive === "1",
				ignoreSourcesList: parseList(query.ignoreSources),
			});
		},
		search({ query }) {
			return repository.search({
				search: query.search || "",
				...parseGalleryQuery(query),
			});
		},
		listSubcategories({ slug, category, query }) {
			return repository.listSubcategories(
				slug,
				category,
				query.subcategory || "",
				{ includeMeta: query.includeMeta === "1" },
			);
		},
		async createSubcategory({ slug, category, name }) {
			await repository.createSubcategory({ slug, category, subcategory: name });
			return { ok: true };
		},
		renameImage({ slug, category, payload }) {
			return repository.renameImage(
				slug,
				category,
				payload.subcategory,
				payload.oldName,
				payload.newName,
			);
		},
		async renameSubcategory({ slug, category, oldName, newName }) {
			await repository.renameSubcategory(slug, category, oldName, newName);
			return { ok: true };
		},
		move({ items, src, dest }) {
			return repository.move(items, src, dest);
		},
		async delete({ items, src, options = {} }) {
			await repository.delete(items, src, options);
			return { ok: true };
		},
	};
}

module.exports = { createImageCommands, parseGalleryQuery, parseList };
