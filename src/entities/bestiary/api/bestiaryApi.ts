import { request } from "../../../shared/api/index.ts";

export interface BestiaryMonster extends Record<string, unknown> {
	name: string;
	source?: string;
	type?: unknown;
}

export interface BestiaryFavorite extends Record<string, unknown> {
	name: string;
	source: string;
}

export type BestiarySource = string | Record<string, unknown>;
export type LegendaryGroup = Record<string, unknown>;
export type BestiaryMonsterUpdate =
	| { monster: BestiaryMonster }
	| { imageUrl: string | null };

export const bestiaryApi = {
	getBestiarySources: () => request<BestiarySource[]>("/bestiary/sources"),
	getBestiaryData: (source: string) =>
		request<BestiaryMonster[]>(
			`/bestiary/${encodeURIComponent(source.toLowerCase())}`,
		),
	getCustomBestiaryData: () =>
		request<BestiaryMonster[]>(`/bestiary/custom?ts=${Date.now()}`, {
			cache: "no-store",
			headers: { "Cache-Control": "no-cache" },
		}),
	updateCustomBestiaryMonster: (
		name: string,
		payload: BestiaryMonsterUpdate,
	) =>
		request<BestiaryMonster>(
			`/bestiary/custom/${encodeURIComponent(name)}`,
			{
				method: "PATCH",
				body: JSON.stringify(payload),
			},
		),
	replaceCustomBestiaryMonsters: (monsters: BestiaryMonster[]) =>
		request<BestiaryMonster[]>("/bestiary/custom", {
			method: "PUT",
			body: JSON.stringify({ monsters }),
		}),
	deleteCustomBestiaryMonster: (name: string) =>
		request<BestiaryMonster[]>(`/bestiary/custom/${encodeURIComponent(name)}`, {
			method: "DELETE",
		}),
	getLegendaryGroups: () =>
		request<LegendaryGroup[]>("/bestiary/legendarygroups"),
	getBestiaryFavorites: () =>
		request<BestiaryFavorite[]>("/bestiary/favorites"),
	toggleBestiaryFavorite: (name: string, source: string) =>
		request<BestiaryFavorite[]>("/bestiary/favorites/toggle", {
			method: "POST",
			body: JSON.stringify({ name, source }),
		}),
	searchBestiary: (name?: string, type?: string) => {
		const params = new URLSearchParams();
		if (name) params.append("name", name);
		if (type) params.append("type", type);
		return request<BestiaryMonster[]>(`/bestiary/search?${params.toString()}`);
	},
};
