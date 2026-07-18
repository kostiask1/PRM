import { request } from "../../../shared/api/index.ts";
import type { SpellData } from "../model/SpellCardModel.ts";

export interface SpellRecord extends SpellData {
	name: string;
}

export interface ReferenceRecord extends Record<string, unknown> {
	name?: string;
	source?: string;
}

export interface SpellSearchParams {
	name?: string;
	level?: number | string;
	school?: string;
}

export const spellApi = {
	getSpellSources: () => request<string[]>("/spells/sources"),
	getSpellData: (source: string) =>
		request<SpellRecord[]>(`/spells/${encodeURIComponent(source)}`),
	getConditions: () => request<ReferenceRecord[]>("/spells/conditions"),
	getDiseases: () => request<ReferenceRecord[]>("/spells/diseases"),
	getVariantRules: () => request<ReferenceRecord[]>("/spells/variantrules"),
	getSkills: () => request<ReferenceRecord[]>("/spells/skills"),
	getSenses: () => request<ReferenceRecord[]>("/spells/senses"),
	searchSpells: (params: SpellSearchParams = {}) => {
		const query = new URLSearchParams();
		if (params.name) query.append("name", params.name);
		if (params.level !== undefined) query.append("level", String(params.level));
		if (params.school) query.append("school", params.school);
		return request<SpellRecord[]>(`/spells/search?${query.toString()}`);
	},
};
