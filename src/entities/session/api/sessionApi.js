import { httpClient } from "../../../shared/api/index.js";

export const sessionApi = {
	listSessions: (slug, options = {}) =>
		httpClient.request(
			`/campaigns/${encodeURIComponent(slug)}/sessions`,
			options,
		),
	createSession: (slug, name) =>
		httpClient.request(`/campaigns/${encodeURIComponent(slug)}/sessions`, {
			method: "POST",
			body: JSON.stringify({ name }),
		}),
	getSession: (slug, fileName, options = {}) =>
		httpClient.request(
			`/campaigns/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(fileName)}`,
			options,
		),
	updateSession: (slug, fileName, payload) =>
		httpClient.request(
			`/campaigns/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(fileName)}`,
			{
				method: "PATCH",
				body: JSON.stringify(payload),
			},
		),
	deleteSession: (slug, fileName) =>
		httpClient.request(
			`/campaigns/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(fileName)}`,
			{ method: "DELETE" },
		),
	reorderSessions: (slug, orders) =>
		httpClient.request(
			`/campaigns/${encodeURIComponent(slug)}/sessions/reorder`,
			{
				method: "POST",
				body: JSON.stringify({ orders }),
			},
		),
};
