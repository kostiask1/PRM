import { httpClient } from "../../../shared/api/index.js";

function appendGalleryQuery(
	query,
	{
		source = "",
		category = "",
		subcategory = "",
		categories = [],
		ignoreSourcesList = [],
	} = {},
) {
	if (source) query.set("source", source);
	if (category) query.set("category", category);
	if (subcategory) query.set("subcategory", subcategory);
	if (categories.length > 0) query.set("categories", categories.join(","));
	if (ignoreSourcesList.length > 0) {
		query.set("ignoreSources", ignoreSourcesList.join(","));
	}
}

export const imageApi = {
	upload: (slug, category, subcategory, file) => {
		const formData = new FormData();
		if (subcategory) formData.append("subcategory", subcategory);
		// File must be last so multer can read the other fields first.
		formData.append("image", file);

		return httpClient.request(
			`/campaigns/${encodeURIComponent(slug)}/images/${category}`,
			{
				method: "POST",
				body: formData,
			},
		);
	},
	getImages: (slug, category, subcategory) =>
		httpClient.request(
			`/campaigns/${encodeURIComponent(slug)}/images/${category}${subcategory ? `?subcategory=${encodeURIComponent(subcategory)}` : ""}`,
		),
	search: ({
		search = "",
		source = "",
		category = "",
		subcategory = "",
		categories = [],
		ignoreSourcesList = [],
	} = {}) => {
		const query = new URLSearchParams();
		if (search) query.set("search", search);
		appendGalleryQuery(query, {
			source,
			category,
			subcategory,
			categories,
			ignoreSourcesList,
		});
		return httpClient.request(`/images/search?${query.toString()}`);
	},
	getStats: (slug, category, subcategory, categories = []) => {
		const query = new URLSearchParams();
		appendGalleryQuery(query, {
			source: slug,
			category,
			subcategory,
			categories,
		});
		return httpClient.request(`/images/stats?${query.toString()}`);
	},
	move: (payload) =>
		httpClient.request("/images/move", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	createSubcategory: (slug, category, name) =>
		httpClient.request(
			`/campaigns/${encodeURIComponent(slug)}/images/${category}/subcategories`,
			{
				method: "POST",
				body: JSON.stringify({ name }),
			},
		),
	getSubcategories: (slug, category, subcategory = "", options = {}) => {
		const params = new URLSearchParams();
		if (subcategory) params.set("subcategory", subcategory);
		if (options.includeMeta) params.set("includeMeta", "1");
		const query = params.toString();
		return httpClient.request(
			`/campaigns/${encodeURIComponent(slug)}/images/${category}/subcategories${query ? `?${query}` : ""}`,
		);
	},
	renameSubcategory: (slug, category, oldName, newName) =>
		httpClient.request(
			`/campaigns/${encodeURIComponent(slug)}/images/${category}/subcategories/${encodeURIComponent(oldName)}`,
			{
				method: "PATCH",
				body: JSON.stringify({ newName }),
			},
		),
	rename: (slug, category, subcategory, oldName, newName) =>
		httpClient.request(
			`/campaigns/${encodeURIComponent(slug)}/images/${category}/rename`,
			{
				method: "PATCH",
				body: JSON.stringify({ subcategory, oldName, newName }),
			},
		),
	delete: (payload) =>
		httpClient.request("/images/delete", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
};
