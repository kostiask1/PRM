import { lang } from "./services/localization.js";

const API_BASE = "/api";

function appendImageGalleryQuery(
	query,
	{ source = "", category = "", subcategory = "", categories = [] } = {},
) {
	if (source) query.set("source", source);
	if (category) query.set("category", category);
	if (subcategory) query.set("subcategory", subcategory);
	if (categories.length > 0) query.set("categories", categories.join(","));
}

function getSyncClientHeader() {
	if (typeof window === "undefined") return {};
	try {
		if (!window.__PRM_SYNC_CLIENT_ID__) {
			window.__PRM_SYNC_CLIENT_ID__ =
				typeof globalThis.crypto?.randomUUID === "function"
					? globalThis.crypto.randomUUID()
					: `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		}
		const value = window.__PRM_SYNC_CLIENT_ID__;
		return value ? { "X-Sync-Client-Id": value } : {};
	} catch {
		return {};
	}
}

export const api = {
	async request(path, options = {}) {
		const isFormData = options.body instanceof FormData;
		const response = await fetch(`${API_BASE}${path}`, {
			headers: isFormData
				? {
						...getSyncClientHeader(),
						...(options.headers || {}),
					}
				: {
						"Content-Type": "application/json",
						...getSyncClientHeader(),
						...(options.headers || {}),
					},
			...options,
		});
		if (response.status === 204) return null;
		const data = await response.json().catch(() => null);
		if (!response.ok) {
			const error = new Error(lang.t(data?.error || "Request error"));
			error.status = response.status;
			error.data = data;
			throw error;
		}
		return data;
	},

	async requestBlob(path, options = {}) {
		const response = await fetch(`${API_BASE}${path}`, {
			...options,
			headers: {
				...getSyncClientHeader(),
				...(options.headers || {}),
			},
		});
		if (!response.ok) {
			let message = lang.t("Request error");
			try {
				const data = await response.json();
				message = data?.error ? lang.t(data.error) : message;
			} catch {
				// ignore parse failures for binary responses
			}
			const error = new Error(message);
			error.status = response.status;
			throw error;
		}
		return response.blob();
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
	deleteCampaign: (slug, options = {}) =>
		api.request(`/campaigns/${encodeURIComponent(slug)}`, {
			method: "DELETE",
			body: JSON.stringify(options),
		}),
	campaignHasImages: (slug) =>
		api.request(`/campaigns/${encodeURIComponent(slug)}/has-images`),
	exportCampaign: (slug) =>
		api.request(`/campaigns/${encodeURIComponent(slug)}/export`),
	exportCampaignArchive: (slug) =>
		api.requestBlob(`/campaigns/${encodeURIComponent(slug)}/export/archive`),
	exportCampaignPartialArchive: (slug, sections = []) => {
		const query = new URLSearchParams();
		if (sections.length > 0) query.set("sections", sections.join(","));
		return api.requestBlob(
			`/campaigns/${encodeURIComponent(slug)}/export/partial-archive?${query.toString()}`,
		);
	},
	importCampaign: (bundle) =>
		api.request("/import-all", {
			method: "POST",
			body: JSON.stringify(bundle),
		}),
	importCampaignPartialArchive: (slug, file, sections = []) => {
		const formData = new FormData();
		formData.append("archive", file);
		if (sections.length > 0) formData.append("sections", sections.join(","));
		return api.request(
			`/campaigns/${encodeURIComponent(slug)}/import/partial-archive`,
			{
				method: "POST",
				body: formData,
			},
		);
	},
	reorderCampaigns: (orders) =>
		api.request("/campaigns/reorder", {
			method: "POST",
			body: JSON.stringify({ orders }),
		}),
	getEntities: (slug, type) =>
		api.request(`/campaigns/${slug}/entities/${type}`),
	createEntity: (slug, type, payload) =>
		api.request(`/campaigns/${slug}/entities/${type}`, {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	updateEntity: (slug, type, entitySlug, payload) =>
		api.request(`/campaigns/${slug}/entities/${type}/${entitySlug}`, {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
	replaceEntities: (slug, type, entities) =>
		api.request(`/campaigns/${slug}/entities/${type}`, {
			method: "PUT",
			body: JSON.stringify({ entities }),
		}),
	deleteEntity: (slug, type, entitySlug) =>
		api.request(`/campaigns/${slug}/entities/${type}/${entitySlug}`, {
			method: "DELETE",
		}),
	moveEntity: (slug, type, entitySlug, targetType) =>
		api.request(`/campaigns/${slug}/entities/${type}/${entitySlug}/move`, {
			method: "POST",
			body: JSON.stringify({ targetType }),
		}),

	// Global Backup/Restore
	exportAll: () => api.request("/export-all"),
	exportAllArchive: () => api.requestBlob("/export-all/archive"),
	importAll: (data, strategy = "append") =>
		api.request(`/import-all?strategy=${encodeURIComponent(strategy)}`, {
			method: "POST",
			body: JSON.stringify(data),
		}),
	importArchive: (file, mode = "all", strategy = "append") => {
		const formData = new FormData();
		formData.append("archive", file);
		const query = new URLSearchParams({
			mode: String(mode),
			strategy: String(strategy),
		});
		return api.request(`/import-archive?${query.toString()}`, {
			method: "POST",
			body: formData,
		});
	},

	// App settings
	getSettings: () => api.request("/settings"),
	updateSettings: (payload) =>
		api.request("/settings", {
			method: "PATCH",
			body: JSON.stringify(payload),
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
	listAiModels: () => api.request("/ai/models"),
	saveGeminiApiKey: (apiKey) =>
		api.request("/ai/api-key", {
			method: "POST",
			body: JSON.stringify({ apiKey }),
		}),
	listAiResponses: (campaign) =>
		api.request(`/ai/responses?campaign=${encodeURIComponent(campaign)}`),
	getAiResponsesStats: (campaign) =>
		api.request(`/ai/responses/stats?campaign=${encodeURIComponent(campaign)}`),
	deleteAiResponse: (campaign, id) =>
		api.request(
			`/ai/responses/${encodeURIComponent(id)}?campaign=${encodeURIComponent(campaign)}`,
			{
				method: "DELETE",
			},
		),
	updateAiResponse: (campaign, id, payload) =>
		api.request(
			`/ai/responses/${encodeURIComponent(id)}?campaign=${encodeURIComponent(campaign)}`,
			{
				method: "PATCH",
				body: JSON.stringify(payload),
			},
		),
	applyAiResponse: (campaign, id, payload = {}) =>
		api.request(
			`/ai/responses/${encodeURIComponent(id)}/apply?campaign=${encodeURIComponent(campaign)}`,
			{
				method: "POST",
				body: JSON.stringify(payload),
			},
		),
	undoAiResponse: (campaign, id, payload = {}) =>
		api.request(
			`/ai/responses/${encodeURIComponent(id)}/undo?campaign=${encodeURIComponent(campaign)}`,
			{
				method: "POST",
				body: JSON.stringify(payload),
			},
		),
	clearAiResponses: (campaign) =>
		api.request(`/ai/responses?campaign=${encodeURIComponent(campaign)}`, {
			method: "DELETE",
		}),
	generateAi: (payload, options = {}) =>
		api.request("/ai/generate", {
			method: "POST",
			body: JSON.stringify(payload),
			...options,
		}),

	// Bestiary methods
	getBestiarySources: () => api.request("/bestiary/sources"),
	getBestiaryData: (source) =>
		api.request(`/bestiary/${encodeURIComponent(source.toLowerCase())}`),
	getCustomBestiaryData: () =>
		api.request(`/bestiary/custom?ts=${Date.now()}`, {
			cache: "no-store",
			headers: {
				"Cache-Control": "no-cache",
			},
		}),
	updateCustomBestiaryMonster: (name, payload) =>
		api.request(`/bestiary/custom/${encodeURIComponent(name)}`, {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
	replaceCustomBestiaryMonsters: (monsters) =>
		api.request("/bestiary/custom", {
			method: "PUT",
			body: JSON.stringify({ monsters }),
		}),
	deleteCustomBestiaryMonster: (name) =>
		api.request(`/bestiary/custom/${encodeURIComponent(name)}`, {
			method: "DELETE",
		}),
	getLegendaryGroups: () => api.request("/bestiary/legendarygroups"),
	getBestiaryFavorites: () => api.request("/bestiary/favorites"),
	toggleBestiaryFavorite: (name, source) =>
		api.request("/bestiary/favorites/toggle", {
			method: "POST",
			body: JSON.stringify({ name, source }),
		}),
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
	getConditions: () => api.request("/spells/conditions"),
	getDiseases: () => api.request("/spells/diseases"),
	getVariantRules: () => api.request("/spells/variantrules"),
	getSkills: () => api.request("/spells/skills"),
	getSenses: () => api.request("/spells/senses"),
	searchSpells: (params = {}) => {
		const query = new URLSearchParams();
		if (params.name) query.append("name", params.name);
		if (params.level !== undefined) query.append("level", params.level);
		if (params.school) query.append("school", params.school);
		return api.request(`/spells/search?${query.toString()}`);
	},

	// Image methods
	uploadImage: (slug, category, subcategory, file) => {
		const formData = new FormData();
		if (subcategory) formData.append("subcategory", subcategory);
		formData.append("image", file); // File must be last so multer can read other fields.

		return api.request(
			`/campaigns/${encodeURIComponent(slug)}/images/${category}`,
			{
				method: "POST",
				body: formData,
			},
		);
	},
	getImages: (slug, category, subcategory) =>
		api.request(
			`/campaigns/${encodeURIComponent(slug)}/images/${category}${subcategory ? `?subcategory=${encodeURIComponent(subcategory)}` : ""}`,
		),
	getBestiaryTokenAssets: (subcategory = "", search = "") => {
		const query = new URLSearchParams();
		if (subcategory) query.set("subcategory", subcategory);
		if (search) query.set("search", search);
		return api.request(`/images/bestiary-tokens?${query.toString()}`);
	},
	searchImageGallery: ({
		search = "",
		source = "",
		category = "",
		subcategory = "",
		categories = [],
	} = {}) => {
		const query = new URLSearchParams();
		if (search) query.set("search", search);
		appendImageGalleryQuery(query, {
			source,
			category,
			subcategory,
			categories,
		});
		return api.request(`/images/search?${query.toString()}`);
	},
	getImageGalleryStats: (slug, category, subcategory, categories = []) => {
		const query = new URLSearchParams();
		appendImageGalleryQuery(query, {
			source: slug,
			category,
			subcategory,
			categories,
		});
		return api.request(`/images/stats?${query.toString()}`);
	},

	moveImages: (payload) =>
		api.request("/images/move", {
			method: "POST",
			body: JSON.stringify(payload),
		}),

	createSubcategory: (slug, category, name) =>
		api.request(
			`/campaigns/${encodeURIComponent(slug)}/images/${category}/subcategories`,
			{
				method: "POST",
				body: JSON.stringify({ name }),
			},
		),
	getSubcategories: (slug, category, subcategory = "") =>
		api.request(
			`/campaigns/${encodeURIComponent(slug)}/images/${category}/subcategories${subcategory ? `?subcategory=${encodeURIComponent(subcategory)}` : ""}`,
		),

	renameSubcategory: (slug, category, oldName, newName) =>
		api.request(
			`/campaigns/${encodeURIComponent(slug)}/images/${category}/subcategories/${encodeURIComponent(oldName)}`,
			{
				method: "PATCH",
				body: JSON.stringify({ newName }),
			},
		),

	renameImage: (slug, category, subcategory, oldName, newName) =>
		api.request(
			`/campaigns/${encodeURIComponent(slug)}/images/${category}/rename`,
			{
				method: "PATCH",
				body: JSON.stringify({ subcategory, oldName, newName }),
			},
		),

	deleteImages: (payload) =>
		api.request("/images/delete", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
};
