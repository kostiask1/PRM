import { request } from "../../../shared/api/httpClient.js";

const sessionPath = (slug, fileName = "") =>
	`/campaigns/${encodeURIComponent(slug)}/sessions${fileName ? `/${encodeURIComponent(fileName)}` : ""}`;

export const sessionApi = {
	listSessions: (slug) => request(sessionPath(slug)),
	createSession: (slug, name) =>
		request(sessionPath(slug), {
			method: "POST",
			body: JSON.stringify({ name }),
		}),
	getSession: (slug, fileName) => request(sessionPath(slug, fileName)),
	updateSession: (slug, fileName, payload) =>
		request(sessionPath(slug, fileName), {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
	deleteSession: (slug, fileName) =>
		request(sessionPath(slug, fileName), { method: "DELETE" }),
	reorderSessions: (slug, orders) =>
		request(`${sessionPath(slug)}/reorder`, {
			method: "POST",
			body: JSON.stringify({ orders }),
		}),
};
