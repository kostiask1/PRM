const fs = require("fs/promises");
const path = require("path");
const {
	exists,
	renameWithRetry,
} = require("../../infrastructure/jsonFileStore");
const {
	IMAGES_DIR,
	campaignDir,
} = require("../../infrastructure/storagePaths");
const {
	updateCampaignImageSlugReferences,
} = require("../image/imageReferenceService");
const {
	deleteCampaignImages,
	moveCampaignImagesToGeneral,
} = require("../image/imageAssetRepository");

function createCampaignLifecycleService(overrides = {}) {
	const dependencies = {
		campaignDir,
		deleteCampaignImages,
		exists,
		imagesDir: IMAGES_DIR,
		moveCampaignImagesToGeneral,
		removeCampaignDirectory: (directoryPath) =>
			fs.rm(directoryPath, { recursive: true, force: true }),
		renameWithRetry,
		updateCampaignImageSlugReferences,
		...overrides,
	};

	async function renameCampaignData(oldSlug, newSlug) {
		if (!oldSlug || !newSlug || oldSlug === newSlug) return;
		await dependencies.renameWithRetry(
			dependencies.campaignDir(oldSlug),
			dependencies.campaignDir(newSlug),
		);

		const oldImagesDir = path.join(
			dependencies.imagesDir,
			path.basename(oldSlug),
		);
		const newImagesDir = path.join(
			dependencies.imagesDir,
			path.basename(newSlug),
		);
		if (await dependencies.exists(oldImagesDir)) {
			if (await dependencies.exists(newImagesDir)) {
				throw new Error("Campaign images folder already exists.");
			}
			await dependencies.renameWithRetry(oldImagesDir, newImagesDir);
		}
		await dependencies.updateCampaignImageSlugReferences(oldSlug, newSlug);
	}

	async function deleteCampaignData(slug, options = {}) {
		if (!slug) return;
		if (options.moveImagesToGeneral) {
			await dependencies.moveCampaignImagesToGeneral(slug);
		}
		await dependencies.removeCampaignDirectory(
			dependencies.campaignDir(slug),
		);
		if (!options.moveImagesToGeneral) {
			await dependencies.deleteCampaignImages(slug);
		}
	}

	return { deleteCampaignData, renameCampaignData };
}

const campaignLifecycleService = createCampaignLifecycleService();

module.exports = {
	...campaignLifecycleService,
	createCampaignLifecycleService,
};
