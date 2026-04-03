const API_BASE = "/api";

export const api = {
	async request(path, options = {}) {
		const response = await fetch(`${API_BASE}${path}`, {
			headers: {
				"Content-Type": "application/json",
				...(options.headers || {}),
			},
			...options,
		});
		if (response.status === 204) return null;
		const data = await response.json().catch(() => null);
		if (!response.ok) {
			const error = new Error(data?.error || "Помилка запиту");
			error.status = response.status;
			throw error;
		}
		return data;
	},

	// Campaign methods
	listCampaigns: () => api.request("/campaigns"),
	createCampaign: (name) =>
		api.request("/campaigns", {
			method: "POST",
			body: JSON.stringify({ name }),
		}),
	updateCampaign: (slug, payload) =>
		api.request(`/campaigns/${encodeURIComponent(slug)}`, {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
	deleteCampaign: (slug) =>
		api.request(`/campaigns/${encodeURIComponent(slug)}`, {
			method: "DELETE",
		}),
	exportCampaign: (slug) =>
		api.request(`/campaigns/${encodeURIComponent(slug)}/export`),
	importCampaign: (bundle) =>
		api.request("/import-all", {
			method: "POST",
			body: JSON.stringify(bundle),
		}),
	reorderCampaigns: (orders) =>
		api.request("/campaigns/reorder", {
			method: "POST",
			body: JSON.stringify({ orders }),
		}),

	// Global Backup/Restore
	exportAll: () => api.request("/export-all"),
	importAll: (data) =>
		api.request("/import-all", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	// Session methods
	listSessions: (slug) =>
		api.request(`/campaigns/${encodeURIComponent(slug)}/sessions`),
	createSession: (slug, name) =>
		api.request(`/campaigns/${encodeURIComponent(slug)}/sessions`, {
			method: "POST",
			body: JSON.stringify({ name }),
		}),
	getSession: (slug, fileName) =>
		api.request(
			`/campaigns/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(fileName)}`,
		),
	updateSession: (slug, fileName, payload) =>
		api.request(
			`/campaigns/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(fileName)}`,
			{
				method: "PATCH",
				body: JSON.stringify(payload),
			},
		),
	deleteSession: (slug, fileName) =>
		api.request(
			`/campaigns/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(fileName)}`,
			{ method: "DELETE" },
		),
	reorderSessions: (slug, orders) =>
		api.request(`/campaigns/${encodeURIComponent(slug)}/sessions/reorder`, {
			method: "POST",
			body: JSON.stringify({ orders }),
		}),

	// AI methods
	generateAi: (payload) =>
		api.request("/ai/generate", {
			method: "POST",
			body: JSON.stringify(payload),
		}),

	// Bestiary methods
	getBestiarySources: () => api.request("/bestiary/sources"),
	getBestiaryData: (source) =>
		api.request(`/bestiary/${encodeURIComponent(source.toLowerCase())}`),
	getLegendaryGroups: () => api.request("/bestiary/legendarygroups"),
	searchBestiary: (name, type) => {
		const params = new URLSearchParams();
		if (name) params.append("name", name);
		if (type) params.append("type", type);
		return api.request(`/bestiary/search?${params.toString()}`);
	},

	// Spells methods
	getSpellSources: () => api.request("/spells/sources"),
	getSpellData: (source) =>
		api.request(`/spells/${encodeURIComponent(source)}`),
	searchSpells: (params = {}) => {
		const query = new URLSearchParams();
		if (params.name) query.append("name", params.name);
		if (params.level !== undefined) query.append("level", params.level);
		if (params.school) query.append("school", params.school);
		return api.request(`/spells/search?${query.toString()}`);
	},
};
