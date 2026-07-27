import { httpClient } from "../../../shared/api/index.js";

export const rulesReferenceApi = {
	getConditions: (options = {}) =>
		httpClient.request("/spells/conditions", options),
	getDiseases: (options = {}) =>
		httpClient.request("/spells/diseases", options),
	getVariantRules: (options = {}) =>
		httpClient.request("/spells/variantrules", options),
	getSkills: (options = {}) =>
		httpClient.request("/spells/skills", options),
	getSenses: (options = {}) =>
		httpClient.request("/spells/senses", options),
};
