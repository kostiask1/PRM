const REQUIRED_METHODS = Object.freeze([
	"listCampaignSlugs",
	"exportCampaignBundle",
	"exportCampaignArchiveBundle",
	"exportCampaignPartialArchiveBundle",
	"importCampaignPartialArchiveBundle",
	"clearAllCampaignData",
	"findCampaignSlugById",
	"importCampaignBundle",
	"importCampaignArchiveBundleWithStrategy",
]);

function createBackupRepositoryPort(implementation = {}) {
	for (const method of REQUIRED_METHODS) {
		if (typeof implementation[method] !== "function") {
			throw new TypeError(`Backup repository requires ${method}().`);
		}
	}
	return Object.freeze(
		Object.fromEntries(
			REQUIRED_METHODS.map((method) => [
				method,
				implementation[method].bind(implementation),
			]),
		),
	);
}

module.exports = { createBackupRepositoryPort };
