import { httpClient } from "../../../shared/api/index.js";

export const bestiaryApi = {
	getSources: (options = {}) =>
		httpClient.request("/bestiary/sources", options),
	getData: (source, options = {}) =>
		httpClient.request(
			`/bestiary/${encodeURIComponent(source.toLowerCase())}`,
			options,
		),
	getCustomData: (options = {}) => {
		const { headers, ...requestOptions } = options;
		return httpClient.request(`/bestiary/custom?ts=${Date.now()}`, {
			cache: "no-store",
			...requestOptions,
			headers: {
				"Cache-Control": "no-cache",
				...(headers || {}),
			},
		});
	},
	updateCustomMonster: (name, payload) =>
		httpClient.request(`/bestiary/custom/${encodeURIComponent(name)}`, {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
	replaceCustomMonsters: (monsters) =>
		httpClient.request("/bestiary/custom", {
			method: "PUT",
			body: JSON.stringify({ monsters }),
		}),
	deleteCustomMonster: (name) =>
		httpClient.request(`/bestiary/custom/${encodeURIComponent(name)}`, {
			method: "DELETE",
		}),
	getLegendaryGroups: (options = {}) =>
		httpClient.request("/bestiary/legendarygroups", options),
	getFavorites: (options = {}) =>
		httpClient.request("/bestiary/favorites", options),
	toggleFavorite: (name, source) =>
		httpClient.request("/bestiary/favorites/toggle", {
			method: "POST",
			body: JSON.stringify({ name, source }),
		}),
	search: (name, type, options = {}) => {
		const params = new URLSearchParams();
		if (name) params.append("name", name);
		if (type) params.append("type", type);
		return httpClient.request(
			`/bestiary/search?${params.toString()}`,
			options,
		);
	},
	getTokenAssets: (
		subcategory = "",
		search = "",
		ignoreSourcesList = [],
		options = {},
	) => {
		const query = new URLSearchParams();
		if (subcategory) query.set("subcategory", subcategory);
		if (search) query.set("search", search);
		if (ignoreSourcesList.length > 0) {
			query.set("ignoreSources", ignoreSourcesList.join(","));
		}
		if (options.recursive) query.set("recursive", "1");
		return httpClient.request(`/images/bestiary-tokens?${query.toString()}`);
	},
};
