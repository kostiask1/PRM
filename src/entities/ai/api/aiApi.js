import { httpClient } from "../../../shared/api/index.js";

export const aiApi = {
	listAiModels: () => httpClient.request("/ai/models"),
	saveGeminiApiKey: (apiKey) =>
		httpClient.request("/ai/api-key", {
			method: "POST",
			body: JSON.stringify({ apiKey }),
		}),
	listAiResponses: (campaign) =>
		httpClient.request(
			`/ai/responses?campaign=${encodeURIComponent(campaign)}`,
		),
	getAiResponsesStats: (campaign) =>
		httpClient.request(
			`/ai/responses/stats?campaign=${encodeURIComponent(campaign)}`,
		),
	deleteAiResponse: (campaign, id) =>
		httpClient.request(
			`/ai/responses/${encodeURIComponent(id)}?campaign=${encodeURIComponent(campaign)}`,
			{ method: "DELETE" },
		),
	updateAiResponse: (campaign, id, payload) =>
		httpClient.request(
			`/ai/responses/${encodeURIComponent(id)}?campaign=${encodeURIComponent(campaign)}`,
			{
				method: "PATCH",
				body: JSON.stringify(payload),
			},
		),
	applyAiResponse: (campaign, id, payload = {}) =>
		httpClient.request(
			`/ai/responses/${encodeURIComponent(id)}/apply?campaign=${encodeURIComponent(campaign)}`,
			{
				method: "POST",
				body: JSON.stringify(payload),
			},
		),
	undoAiResponse: (campaign, id, payload = {}) =>
		httpClient.request(
			`/ai/responses/${encodeURIComponent(id)}/undo?campaign=${encodeURIComponent(campaign)}`,
			{
				method: "POST",
				body: JSON.stringify(payload),
			},
		),
	clearAiResponses: (campaign) =>
		httpClient.request(
			`/ai/responses?campaign=${encodeURIComponent(campaign)}`,
			{ method: "DELETE" },
		),
	generateAi: (payload, options = {}) =>
		httpClient.request("/ai/generate", {
			method: "POST",
			body: JSON.stringify(payload),
			...options,
		}),
};
