const {
	createBackupRepositoryPort,
} = require("../application/ports/backupRepository");

function createFileBackupRepository(storage) {
	return createBackupRepositoryPort({
		listCampaignSlugs: () => storage.listExportableCampaignSlugs(),
		exportCampaignBundle: (...args) => storage.exportCampaignBundle(...args),
		exportCampaignArchiveBundle: (...args) =>
			storage.exportCampaignArchiveBundle(...args),
		exportApplicationDataArchiveBundle: (...args) =>
			storage.exportApplicationDataArchiveBundle(...args),
		exportCampaignPartialArchiveBundle: (...args) =>
			storage.exportCampaignPartialArchiveBundle(...args),
		importCampaignPartialArchiveBundle: (...args) =>
			storage.importCampaignPartialArchiveBundle(...args),
		clearAllCampaignData: () => storage.clearAllCampaignData(),
		findCampaignSlugById: (id) => storage.findCampaignSlugById(id),
		importCampaignBundle: (...args) => storage.importCampaignBundle(...args),
		importCampaignArchiveBundleWithStrategy: (...args) =>
			storage.importCampaignArchiveBundleWithStrategy(...args),
		importApplicationDataArchiveBundle: (...args) =>
			storage.importApplicationDataArchiveBundle(...args),
	});
}

module.exports = { createFileBackupRepository };
