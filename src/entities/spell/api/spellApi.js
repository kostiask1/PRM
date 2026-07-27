import { httpClient } from "../../../shared/api/index.js";

export const spellApi = {
	getSources: (options = {}) =>
		httpClient.request("/spells/sources", options),
	getData: (source, options = {}) =>
		httpClient.request(`/spells/${encodeURIComponent(source)}`, options),
	search: (params = {}, options = {}) => {
		const query = new URLSearchParams();
		if (params.name) query.append("name", params.name);
		if (params.level !== undefined) query.append("level", params.level);
		if (params.school) query.append("school", params.school);
		return httpClient.request(
			`/spells/search?${query.toString()}`,
			options,
		);
	},
};
