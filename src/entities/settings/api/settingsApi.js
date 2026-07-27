import { httpClient } from "../../../shared/api/index.js";

export const settingsApi = {
	get: (options = {}) => httpClient.request("/settings", options),
	update: (payload, options = {}) =>
		httpClient.request("/settings", {
			...options,
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
};
