import { httpClient } from "../../../shared/api/index.js";

export const campaignApi = {
	listCampaigns: () => httpClient.request("/campaigns"),
	createCampaign: (name) =>
		httpClient.request("/campaigns", {
			method: "POST",
			body: JSON.stringify({ name }),
		}),
	updateCampaign: (slug, payload) =>
		httpClient.request(`/campaigns/${encodeURIComponent(slug)}`, {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
	deleteCampaign: (slug, options = {}) =>
		httpClient.request(`/campaigns/${encodeURIComponent(slug)}`, {
			method: "DELETE",
			body: JSON.stringify(options),
		}),
	campaignHasImages: (slug) =>
		httpClient.request(
			`/campaigns/${encodeURIComponent(slug)}/has-images`,
		),
	exportCampaign: (slug) =>
		httpClient.request(`/campaigns/${encodeURIComponent(slug)}/export`),
	exportCampaignArchive: (slug) =>
		httpClient.requestBlob(
			`/campaigns/${encodeURIComponent(slug)}/export/archive`,
		),
	exportCampaignPartialArchive: (slug, sections = []) => {
		const query = new URLSearchParams();
		if (sections.length > 0) query.set("sections", sections.join(","));
		return httpClient.requestBlob(
			`/campaigns/${encodeURIComponent(slug)}/export/partial-archive?${query.toString()}`,
		);
	},
	importCampaign: (bundle) =>
		httpClient.request("/import-all", {
			method: "POST",
			body: JSON.stringify(bundle),
		}),
	importCampaignPartialArchive: (slug, file, sections = []) => {
		const formData = new FormData();
		formData.append("archive", file);
		if (sections.length > 0) formData.append("sections", sections.join(","));
		return httpClient.request(
			`/campaigns/${encodeURIComponent(slug)}/import/partial-archive`,
			{
				method: "POST",
				body: formData,
			},
		);
	},
	reorderCampaigns: (orders) =>
		httpClient.request("/campaigns/reorder", {
			method: "POST",
			body: JSON.stringify({ orders }),
		}),
	getEntities: (slug, type, options = {}) =>
		httpClient.request(
			`/campaigns/${slug}/entities/${type}`,
			options,
		),
	createEntity: (slug, type, payload) =>
		httpClient.request(`/campaigns/${slug}/entities/${type}`, {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	updateEntity: (slug, type, entitySlug, payload) =>
		httpClient.request(`/campaigns/${slug}/entities/${type}/${entitySlug}`, {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
	replaceEntities: (slug, type, entities) =>
		httpClient.request(`/campaigns/${slug}/entities/${type}`, {
			method: "PUT",
			body: JSON.stringify({ entities }),
		}),
	deleteEntity: (slug, type, entitySlug) =>
		httpClient.request(`/campaigns/${slug}/entities/${type}/${entitySlug}`, {
			method: "DELETE",
		}),
	moveEntity: (slug, type, entitySlug, targetType) =>
		httpClient.request(
			`/campaigns/${slug}/entities/${type}/${entitySlug}/move`,
			{
				method: "POST",
				body: JSON.stringify({ targetType }),
			},
		),
};
