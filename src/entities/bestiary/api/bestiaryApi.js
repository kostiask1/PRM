import { request } from "../../../shared/api/httpClient.js";

export const bestiaryApi = {
	getBestiarySources: () => request("/bestiary/sources"),
	getBestiaryData: (source) =>
		request(`/bestiary/${encodeURIComponent(source.toLowerCase())}`),
	getCustomBestiaryData: () =>
		request(`/bestiary/custom?ts=${Date.now()}`, {
			cache: "no-store",
			headers: { "Cache-Control": "no-cache" },
		}),
	updateCustomBestiaryMonster: (name, payload) =>
		request(`/bestiary/custom/${encodeURIComponent(name)}`, {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
	replaceCustomBestiaryMonsters: (monsters) =>
		request("/bestiary/custom", {
			method: "PUT",
			body: JSON.stringify({ monsters }),
		}),
	deleteCustomBestiaryMonster: (name) =>
		request(`/bestiary/custom/${encodeURIComponent(name)}`, {
			method: "DELETE",
		}),
	getLegendaryGroups: () => request("/bestiary/legendarygroups"),
	getBestiaryFavorites: () => request("/bestiary/favorites"),
	toggleBestiaryFavorite: (name, source) =>
		request("/bestiary/favorites/toggle", {
			method: "POST",
			body: JSON.stringify({ name, source }),
		}),
	searchBestiary: (name, type) => {
		const params = new URLSearchParams();
		if (name) params.append("name", name);
		if (type) params.append("type", type);
		return request(`/bestiary/search?${params.toString()}`);
	},
};
