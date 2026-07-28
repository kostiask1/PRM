import { request } from "../../../shared/api/index.ts";
import type { SpellData } from "../model/SpellCardModel.ts";

export interface SpellRecord extends SpellData {
	name: string;
}

export interface SpellSearchParams {
	name?: string;
	level?: number | string;
	school?: string;
}

export const spellApi = {
	getSpellSources: (options: RequestInit = {}) =>
		request<string[]>("/spells/sources", options),
	getSpellData: (source: string, options: RequestInit = {}) =>
		request<SpellRecord[]>(
			`/spells/${encodeURIComponent(source)}`,
			options,
		),
	searchSpells: (
		params: SpellSearchParams = {},
		options: RequestInit = {},
	) => {
		const query = new URLSearchParams();
		if (params.name) query.append("name", params.name);
		if (params.level !== undefined) query.append("level", String(params.level));
		if (params.school) query.append("school", params.school);
		return request<SpellRecord[]>(
			`/spells/search?${query.toString()}`,
			options,
		);
	},
};
