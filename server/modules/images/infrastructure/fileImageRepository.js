const fs = require("fs/promises");
const path = require("path");
const {
	createImageRepositoryPort,
} = require("../application/ports/imageRepository");

function createFileImageRepository(storage) {
	const imageDirectory = ({ slug, category, subcategory = "" }) =>
		storage.campaignImagesDir(slug, category, subcategory);

	return createImageRepositoryPort({
		ensureUploadDirectory: async (location) => {
			const directory = imageDirectory(location);
			await storage.ensureDir(directory);
			return directory;
		},
		resolveUploadFileName: async (location, originalName) => {
			const decodedName = Buffer.from(originalName, "latin1").toString("utf8");
			const extension = path.extname(decodedName);
			const baseName =
				storage.sanitizeName(path.parse(decodedName).name) || "image";
			const directory = imageDirectory(location);
			let candidate = `${baseName}${extension}`;
			let counter = 2;
			while (true) {
				try {
					await fs.access(path.join(directory, candidate));
					candidate = `${baseName}-${counter}${extension}`;
					counter += 1;
				} catch {
					return candidate;
				}
			}
		},
		list: (...args) => storage.listImages(...args),
		stats: (query) => storage.getImageGalleryStorageStats(query),
		listBestiaryTokens: (query) => storage.listBestiaryTokenAssets(query),
		search: (query) => storage.searchImageGalleryAssets(query),
		listSubcategories: (...args) => storage.listSubcategories(...args),
		createSubcategory: async (location) => {
			await storage.ensureDir(imageDirectory(location));
		},
		renameImage: (...args) => storage.renameImage(...args),
		renameSubcategory: (...args) => storage.renameSubcategory(...args),
		move: (...args) => storage.moveImages(...args),
		delete: (...args) => storage.deleteImages(...args),
	});
}

module.exports = { createFileImageRepository };
