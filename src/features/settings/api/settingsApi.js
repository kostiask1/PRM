import { request } from "../../../shared/api/httpClient.js";

export const settingsApi = {
	getSettings: () => request("/settings"),
	updateSettings: (payload) =>
		request("/settings", {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
};
