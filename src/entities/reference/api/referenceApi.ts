import { request } from "../../../shared/api/index.ts";

export interface ReferenceRecord extends Record<string, unknown> {
	name?: string;
	source?: string;
}

export const referenceApi = {
	getConditions: (options: RequestInit = {}) =>
		request<ReferenceRecord[]>("/spells/conditions", options),
	getDiseases: (options: RequestInit = {}) =>
		request<ReferenceRecord[]>("/spells/diseases", options),
	getVariantRules: (options: RequestInit = {}) =>
		request<ReferenceRecord[]>("/spells/variantrules", options),
	getSkills: (options: RequestInit = {}) =>
		request<ReferenceRecord[]>("/spells/skills", options),
	getSenses: (options: RequestInit = {}) =>
		request<ReferenceRecord[]>("/spells/senses", options),
};
