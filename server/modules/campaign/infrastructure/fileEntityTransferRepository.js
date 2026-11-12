function createFileEntityTransferRepository(storage) {
	return {
		readCampaign: (...args) => storage.readCampaign(...args),
		readEntity: (...args) => storage.readEntity(...args),
		listEntities: (...args) => storage.listEntities(...args),
		writeEntity: (...args) => storage.writeEntity(...args),
		deleteEntity: (...args) => storage.deleteEntity(...args),
		readSession: (...args) => storage.readSession(...args),
		writeSession: (slug, fileName, session) => storage.writeJson(storage.sessionPath(slug, fileName), session),
		sanitizeName: (name) => storage.sanitizeName(name),
		toSlug: (name) => storage.campaignSlug(name),
		ensureUniqueSlug: (...args) => storage.ensureUniqueEntitySlug(...args),
	};
}

module.exports = { createFileEntityTransferRepository };
