import { request } from "../../../shared/api/index.ts";
import type { MonsterData } from "../model/MonsterStatBlockModel.ts";

export interface BestiaryMonster extends MonsterData {
	name: string;
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

function withNoCache(options: RequestInit): RequestInit {
	const headers = new Headers(options.headers);
	headers.set("Cache-Control", "no-cache");
	return {
		...options,
		cache: "no-store",
		headers,
	};
}

export const bestiaryApi = {
	getBestiarySources: (options: RequestInit = {}) =>
		request<BestiarySource[]>("/bestiary/sources", options),
	getBestiaryData: (source: string, options: RequestInit = {}) =>
		request<BestiaryMonster[]>(
			`/bestiary/${encodeURIComponent(source.toLowerCase())}`,
			options,
		),
	getCustomBestiaryData: (options: RequestInit = {}) =>
		request<BestiaryMonster[]>(
			`/bestiary/custom?ts=${Date.now()}`,
			withNoCache(options),
		),
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
	getLegendaryGroups: (options: RequestInit = {}) =>
		request<LegendaryGroup[]>("/bestiary/legendarygroups", options),
	getBestiaryFavorites: (options: RequestInit = {}) =>
		request<BestiaryFavorite[]>("/bestiary/favorites", options),
	toggleBestiaryFavorite: (name: string, source: string) =>
		request<BestiaryFavorite[]>("/bestiary/favorites/toggle", {
			method: "POST",
			body: JSON.stringify({ name, source }),
		}),
	searchBestiary: (
		name?: string,
		type?: string,
		options: RequestInit = {},
	) => {
		const params = new URLSearchParams();
		if (name) params.append("name", name);
		if (type) params.append("type", type);
		return request<BestiaryMonster[]>(
			`/bestiary/search?${params.toString()}`,
			options,
		);
	},
};
