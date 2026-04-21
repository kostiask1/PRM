const API_BASE = "/api";

export const api = {
	async request(path, options = {}) {
		const isFormData = options.body instanceof FormData;
		const response = await fetch(`${API_BASE}${path}`, {
			headers: isFormData 
				? { ...(options.headers || {}) }
				: {
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

	async requestBlob(path, options = {}) {
		const response = await fetch(`${API_BASE}${path}`, {
			...options,
		});
		if (!response.ok) {
			let message = "Помилка запиту";
			try {
				const data = await response.json();
				message = data?.error || message;
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
	deleteCampaign: (slug) =>
		api.request(`/campaigns/${encodeURIComponent(slug)}`, {
			method: "DELETE",
		}),
	exportCampaign: (slug) =>
		api.request(`/campaigns/${encodeURIComponent(slug)}/export`),
	exportCampaignArchive: (slug) =>
		api.requestBlob(`/campaigns/${encodeURIComponent(slug)}/export/archive`),
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
	getEntities: (slug, type) => api.request(`/campaigns/${slug}/entities/${type}`),
	createEntity: (slug, type, payload) => api.request(`/campaigns/${slug}/entities/${type}`, {
		method: "POST", body: JSON.stringify(payload)
	}),
	updateEntity: (slug, type, entitySlug, payload) => api.request(`/campaigns/${slug}/entities/${type}/${entitySlug}`, {
		method: "PATCH", body: JSON.stringify(payload)
	}),
	deleteEntity: (slug, type, entitySlug) => api.request(`/campaigns/${slug}/entities/${type}/${entitySlug}`, {
		method: "DELETE"
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
	getBestiaryFavorites: () => api.request("/bestiary/favorites"),
	toggleBestiaryFavorite: (name, source) => api.request("/bestiary/favorites/toggle", {
		method: "POST",
		body: JSON.stringify({ name, source })
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
		formData.append("image", file); // Файл має бути останнім, щоб multer бачив інші поля
		
		return api.request(`/campaigns/${encodeURIComponent(slug)}/images/${category}`, {
			method: "POST",
			body: formData,
		});
	},
	getImages: (slug, category, subcategory) => 
		api.request(`/campaigns/${encodeURIComponent(slug)}/images/${category}${subcategory ? `?subcategory=${encodeURIComponent(subcategory)}` : ""}`),
	
	moveImages: (payload) => api.request("/images/move", {
		method: "POST",
		body: JSON.stringify(payload)
	}),
	
	createSubcategory: (slug, category, name) => 
		api.request(`/campaigns/${encodeURIComponent(slug)}/images/${category}/subcategories`, {
			method: "POST",
			body: JSON.stringify({ name })
		}),
	getSubcategories: (slug, category, subcategory = "") => 
		api.request(`/campaigns/${encodeURIComponent(slug)}/images/${category}/subcategories${subcategory ? `?subcategory=${encodeURIComponent(subcategory)}` : ""}`),
	
	renameSubcategory: (slug, category, oldName, newName) =>
		api.request(`/campaigns/${encodeURIComponent(slug)}/images/${category}/subcategories/${encodeURIComponent(oldName)}`, {
			method: "PATCH",
			body: JSON.stringify({ newName })
		}),
	
	renameImage: (slug, category, subcategory, oldName, newName) =>
		api.request(`/campaigns/${encodeURIComponent(slug)}/images/${category}/rename`, {
			method: "PATCH",
			body: JSON.stringify({ subcategory, oldName, newName })
		}),
	
	deleteImages: (payload) => api.request("/images/delete", {
		method: "POST",
		body: JSON.stringify(payload)
	}),
};
