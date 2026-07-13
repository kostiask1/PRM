const {
	createCampaignEntityScopeRepositoryPort,
} = require("../application/ports/campaignEntityScopeRepository");

function createFileCampaignEntityScopeRepository(storage) {
	return createCampaignEntityScopeRepositoryPort({
		readEntity: (...args) => storage.readEntity(...args),
		writeEntity: (...args) => storage.writeEntity(...args),
		deleteEntity: (...args) => storage.deleteEntity(...args),
		readSession: (...args) => storage.readSession(...args),
		writeSession: async (campaignSlug, fileName, session) => {
			await storage.writeJson(storage.sessionPath(campaignSlug, fileName), session);
			return { ...session, fileName };
		},
		sanitizeName: (name) => storage.sanitizeName(name),
		toSlug: (name) => storage.campaignSlug(name),
		ensureUniqueSlug: (...args) => storage.ensureUniqueEntitySlug(...args),
	});
}

module.exports = { createFileCampaignEntityScopeRepository };
