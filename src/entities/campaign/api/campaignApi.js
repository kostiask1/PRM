import { request, requestBlob } from "../../../shared/api/httpClient.js";

export const campaignApi = {
	listCampaigns: () => request("/campaigns"),
	createCampaign: (name) =>
		request("/campaigns", { method: "POST", body: JSON.stringify({ name }) }),
	updateCampaign: (slug, payload) =>
		request(`/campaigns/${encodeURIComponent(slug)}`, {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
	deleteCampaign: (slug, options = {}) =>
		request(`/campaigns/${encodeURIComponent(slug)}`, {
			method: "DELETE",
			body: JSON.stringify(options),
		}),
	campaignHasImages: (slug) =>
		request(`/campaigns/${encodeURIComponent(slug)}/has-images`),
	exportCampaign: (slug) =>
		request(`/campaigns/${encodeURIComponent(slug)}/export`),
	exportCampaignArchive: (slug) =>
		requestBlob(`/campaigns/${encodeURIComponent(slug)}/export/archive`),
	exportCampaignPartialArchive: (slug, sections = []) => {
		const query = new URLSearchParams();
		if (sections.length > 0) query.set("sections", sections.join(","));
		return requestBlob(
			`/campaigns/${encodeURIComponent(slug)}/export/partial-archive?${query.toString()}`,
		);
	},
	importCampaign: (bundle) =>
		request("/import-all", { method: "POST", body: JSON.stringify(bundle) }),
	importCampaignPartialArchive: (slug, file, sections = []) => {
		const formData = new FormData();
		formData.append("archive", file);
		if (sections.length > 0) formData.append("sections", sections.join(","));
		return request(`/campaigns/${encodeURIComponent(slug)}/import/partial-archive`, {
			method: "POST",
			body: formData,
		});
	},
	reorderCampaigns: (orders) =>
		request("/campaigns/reorder", {
			method: "POST",
			body: JSON.stringify({ orders }),
		}),
	getEntities: (slug, type) => request(`/campaigns/${slug}/entities/${type}`),
	createEntity: (slug, type, payload) =>
		request(`/campaigns/${slug}/entities/${type}`, {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	updateEntity: (slug, type, entitySlug, payload) =>
		request(`/campaigns/${slug}/entities/${type}/${entitySlug}`, {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
	replaceEntities: (slug, type, entities) =>
		request(`/campaigns/${slug}/entities/${type}`, {
			method: "PUT",
			body: JSON.stringify({ entities }),
		}),
	deleteEntity: (slug, type, entitySlug) =>
		request(`/campaigns/${slug}/entities/${type}/${entitySlug}`, {
			method: "DELETE",
		}),
	moveEntity: (slug, type, entitySlug, targetType) =>
		request(`/campaigns/${slug}/entities/${type}/${entitySlug}/move`, {
			method: "POST",
			body: JSON.stringify({ targetType }),
		}),
};
