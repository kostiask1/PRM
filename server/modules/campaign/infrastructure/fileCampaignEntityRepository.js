const {
	createCampaignEntityRepositoryPort,
} = require("../application/ports/campaignEntityRepository");

function createFileCampaignEntityRepository(storage) {
	return createCampaignEntityRepositoryPort({
		list: (campaignSlug, type) => storage.listEntities(campaignSlug, type),
		read: (campaignSlug, type, entitySlug) =>
			storage.readEntity(campaignSlug, type, entitySlug),
		write: (campaignSlug, type, entitySlug, data) =>
			storage.writeEntity(campaignSlug, type, entitySlug, data),
		delete: (campaignSlug, type, entitySlug) =>
			storage.deleteEntity(campaignSlug, type, entitySlug),
		createId: () => storage.createId(),
		sanitizeName: (name) => storage.sanitizeName(name),
		toSlug: (name) => storage.campaignSlug(name),
		ensureUniqueSlug: (campaignSlug, type, baseSlug) =>
			storage.ensureUniqueEntitySlug(campaignSlug, type, baseSlug),
		updateMentionReferences: (campaignSlug, oldName, newName) =>
			storage.updateCampaignMentionReferences(campaignSlug, oldName, newName),
		move: (...args) => storage.moveEntity(...args),
	});
}

module.exports = { createFileCampaignEntityRepository };
