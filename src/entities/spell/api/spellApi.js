import { request } from "../../../shared/api/httpClient.js";

export const spellApi = {
	getSpellSources: () => request("/spells/sources"),
	getSpellData: (source) => request(`/spells/${encodeURIComponent(source)}`),
	getConditions: () => request("/spells/conditions"),
	getDiseases: () => request("/spells/diseases"),
	getVariantRules: () => request("/spells/variantrules"),
	getSkills: () => request("/spells/skills"),
	getSenses: () => request("/spells/senses"),
	searchSpells: (params = {}) => {
		const query = new URLSearchParams();
		if (params.name) query.append("name", params.name);
		if (params.level !== undefined) query.append("level", params.level);
		if (params.school) query.append("school", params.school);
		return request(`/spells/search?${query.toString()}`);
	},
};
