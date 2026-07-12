import { request } from "../../../shared/api/httpClient.js";

export const aiApi = {
	listAiModels: () => request("/ai/models"),
	saveGeminiApiKey: (apiKey) =>
		request("/ai/api-key", {
			method: "POST",
			body: JSON.stringify({ apiKey }),
		}),
	listAiResponses: (campaign) =>
		request(`/ai/responses?campaign=${encodeURIComponent(campaign)}`),
	getAiResponsesStats: (campaign) =>
		request(`/ai/responses/stats?campaign=${encodeURIComponent(campaign)}`),
	deleteAiResponse: (campaign, id) =>
		request(
			`/ai/responses/${encodeURIComponent(id)}?campaign=${encodeURIComponent(campaign)}`,
			{ method: "DELETE" },
		),
	updateAiResponse: (campaign, id, payload) =>
		request(
			`/ai/responses/${encodeURIComponent(id)}?campaign=${encodeURIComponent(campaign)}`,
			{ method: "PATCH", body: JSON.stringify(payload) },
		),
	applyAiResponse: (campaign, id, payload = {}) =>
		request(
			`/ai/responses/${encodeURIComponent(id)}/apply?campaign=${encodeURIComponent(campaign)}`,
			{ method: "POST", body: JSON.stringify(payload) },
		),
	undoAiResponse: (campaign, id, payload = {}) =>
		request(
			`/ai/responses/${encodeURIComponent(id)}/undo?campaign=${encodeURIComponent(campaign)}`,
			{ method: "POST", body: JSON.stringify(payload) },
		),
	clearAiResponses: (campaign) =>
		request(`/ai/responses?campaign=${encodeURIComponent(campaign)}`, {
			method: "DELETE",
		}),
	generateAi: (payload, options = {}) =>
		request("/ai/generate", {
			method: "POST",
			body: JSON.stringify(payload),
			...options,
		}),
};
