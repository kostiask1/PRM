const path = require("path");
const {
	createCampaignRepositoryPort,
} = require("../application/ports/campaignRepository");

function createFileCampaignRepository(storage) {
	return createCampaignRepositoryPort({
		metaExists: (slug) => storage.exists(storage.campaignMetaPath(slug)),
		dataExists: (slug) => storage.exists(storage.campaignDir(slug)),
		list: () => storage.listCampaignsDetailed(),
		read: (slug) => storage.readCampaign(slug),
		write: async (slug, campaign) => {
			await storage.writeJson(storage.campaignMetaPath(slug), campaign);
			return campaign;
		},
		initialize: (slug) =>
			storage.ensureDir(path.join(storage.campaignDir(slug), "sessions")),
		rename: (...args) => storage.renameCampaignData(...args),
		remove: (...args) => storage.deleteCampaignData(...args),
		hasImages: (slug) => storage.campaignHasImages(slug),
		exportBundle: (slug) => storage.exportCampaignBundle(slug),
		sanitizeName: (name) => storage.sanitizeName(name),
		toSlug: (name) => storage.campaignSlug(name),
		ensureUniqueSlug: (...args) => storage.ensureUniqueCampaignSlug(...args),
		createId: () => storage.createId(),
		replaceImageSlugReferences: (...args) =>
			storage.replaceImageSlugReferences(...args),
		normalizeSourceList: (sources) => storage.normalizeSourceList(sources),
	});
}

module.exports = { createFileCampaignRepository };
