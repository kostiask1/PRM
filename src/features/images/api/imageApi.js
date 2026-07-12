import { request } from "../../../shared/api/httpClient.js";

function appendImageGalleryQuery(
	query,
	{ source = "", category = "", subcategory = "", categories = [], ignoreSourcesList = [] } = {},
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
	uploadImage: (slug, category, subcategory, file) => {
		const formData = new FormData();
		if (subcategory) formData.append("subcategory", subcategory);
		formData.append("image", file);
		return request(`/campaigns/${encodeURIComponent(slug)}/images/${category}`, {
			method: "POST",
			body: formData,
		});
	},
	getImages: (slug, category, subcategory) =>
		request(
			`/campaigns/${encodeURIComponent(slug)}/images/${category}${subcategory ? `?subcategory=${encodeURIComponent(subcategory)}` : ""}`,
		),
	getBestiaryTokenAssets: (subcategory = "", search = "", ignoreSourcesList = [], options = {}) => {
		const query = new URLSearchParams();
		if (subcategory) query.set("subcategory", subcategory);
		if (search) query.set("search", search);
		if (ignoreSourcesList.length > 0) {
			query.set("ignoreSources", ignoreSourcesList.join(","));
		}
		if (options.recursive) query.set("recursive", "1");
		return request(`/images/bestiary-tokens?${query.toString()}`);
	},
	searchImageGallery: ({ search = "", ...filters } = {}) => {
		const query = new URLSearchParams();
		if (search) query.set("search", search);
		appendImageGalleryQuery(query, filters);
		return request(`/images/search?${query.toString()}`);
	},
	getImageGalleryStats: (slug, category, subcategory, categories = []) => {
		const query = new URLSearchParams();
		appendImageGalleryQuery(query, {
			source: slug,
			category,
			subcategory,
			categories,
		});
		return request(`/images/stats?${query.toString()}`);
	},
	moveImages: (payload) =>
		request("/images/move", { method: "POST", body: JSON.stringify(payload) }),
	createSubcategory: (slug, category, name) =>
		request(`/campaigns/${encodeURIComponent(slug)}/images/${category}/subcategories`, {
			method: "POST",
			body: JSON.stringify({ name }),
		}),
	getSubcategories: (slug, category, subcategory = "", options = {}) => {
		const params = new URLSearchParams();
		if (subcategory) params.set("subcategory", subcategory);
		if (options.includeMeta) params.set("includeMeta", "1");
		const query = params.toString();
		return request(
			`/campaigns/${encodeURIComponent(slug)}/images/${category}/subcategories${query ? `?${query}` : ""}`,
		);
	},
	renameSubcategory: (slug, category, oldName, newName) =>
		request(
			`/campaigns/${encodeURIComponent(slug)}/images/${category}/subcategories/${encodeURIComponent(oldName)}`,
			{ method: "PATCH", body: JSON.stringify({ newName }) },
		),
	renameImage: (slug, category, subcategory, oldName, newName) =>
		request(`/campaigns/${encodeURIComponent(slug)}/images/${category}/rename`, {
			method: "PATCH",
			body: JSON.stringify({ subcategory, oldName, newName }),
		}),
	deleteImages: (payload) =>
		request("/images/delete", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
};
