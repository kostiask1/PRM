const fs = require("fs/promises");
const path = require("path");
const {
	exists,
	getDirectorySize,
	getFileSize,
} = require("../../infrastructure/jsonFileStore");
const {
	BESTIARY_TOKENS_DIR,
	IMAGES_DIR,
	encodeUrlPathSegments,
	normalizePathSegments,
} = require("../../infrastructure/storagePaths");
const {
	normalizeSourceList,
} = require("../settings/settingsRepository");
const { IMAGE_FILE_RE } = require("./imageAssetRepository");

function createImageGalleryReadService(overrides = {}) {
	const dependencies = {
		bestiaryTokensDir: BESTIARY_TOKENS_DIR,
		encodeUrlPathSegments,
		exists,
		getDirectorySize,
		getFileSize,
		imagesDir: IMAGES_DIR,
		normalizePathSegments,
		normalizeSourceList,
		readDir: fs.readdir,
		...overrides,
	};

	async function listBestiaryTokenAssets({
		subcategory = "",
		search = "",
		recursive = false,
		ignoreSourcesList = [],
	} = {}) {
		const subParts = dependencies.normalizePathSegments(subcategory);
		const query = String(search || "").trim().toLowerCase();
		const ignoredSources = new Set(
			dependencies.normalizeSourceList(ignoreSourcesList),
		);
		const isIgnoredSourcePath = (relativeParts = []) => {
			const source = String(relativeParts[0] || "")
				.trim()
				.toUpperCase();
			return Boolean(source && ignoredSources.has(source));
		};
		if (subParts.length > 0 && isIgnoredSourcePath(subParts)) {
			return { subcategories: [], images: [] };
		}
		const baseDir = path.join(dependencies.bestiaryTokensDir, ...subParts);
		if (!(await dependencies.exists(baseDir))) {
			return { subcategories: [], images: [] };
		}

		const makeImage = async (filePath, relativeParts) => {
			const fileName = relativeParts.at(-1);
			const folderParts = relativeParts.slice(0, -1);
			const cleanName = path.parse(fileName).name;
			return {
				name: fileName,
				displayName:
					query && folderParts.length > 0
						? `${cleanName} (${folderParts.join("/")})`
						: fileName,
				url: `/api/bestiary/tokens/${dependencies.encodeUrlPathSegments(...relativeParts)}`,
				path: path.join("bestiary", "tokens", ...relativeParts),
				sizeBytes: await dependencies.getFileSize(filePath),
				readonly: true,
				source: "bestiary",
			};
		};

		if (query || recursive) {
			const images = [];
			const walk = async (directoryPath, relativeParts = []) => {
				const entries = await dependencies.readDir(directoryPath, {
					withFileTypes: true,
				});
				for (const entry of entries) {
					const nextRelativeParts = [...relativeParts, entry.name];
					const nextPath = path.join(directoryPath, entry.name);
					if (isIgnoredSourcePath(nextRelativeParts)) continue;
					if (entry.isDirectory()) {
						await walk(nextPath, nextRelativeParts);
					} else if (
						entry.isFile() &&
						IMAGE_FILE_RE.test(entry.name) &&
						(!query ||
							nextRelativeParts
								.join("/")
								.toLowerCase()
								.includes(query))
					) {
						images.push(
							await makeImage(nextPath, nextRelativeParts),
						);
					}
				}
			};
			await walk(baseDir, subParts);
			images.sort((a, b) => a.displayName.localeCompare(b.displayName));
			return { subcategories: [], images };
		}

		const entries = await dependencies.readDir(baseDir, {
			withFileTypes: true,
		});
		const subcategories = entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.filter((name) => !isIgnoredSourcePath([...subParts, name]))
			.sort((a, b) => a.localeCompare(b));
		const images = await Promise.all(
			entries
				.filter(
					(entry) =>
						entry.isFile() && IMAGE_FILE_RE.test(entry.name),
				)
				.map((entry) =>
					makeImage(path.join(baseDir, entry.name), [
						...subParts,
						entry.name,
					]),
				),
		);
		images.sort((a, b) => a.name.localeCompare(b.name));
		return { subcategories, images };
	}

	async function searchImageGalleryAssets({
		search = "",
		source = "",
		category = "",
		subcategory = "",
		categories = [],
		ignoreSourcesList = [],
	} = {}) {
		const query = String(search || "").trim().toLowerCase();
		const sourceFilter = String(source || "").trim();
		const selectedCategory = String(category || "").trim();
		const selectedSubcategory =
			dependencies.normalizePathSegments(subcategory).join("/");
		const categoryFilter = new Set(
			(Array.isArray(categories) ? categories : [])
				.map((item) => String(item || "").trim())
				.filter(Boolean),
		);
		const shouldIncludeCategory = (categoryName) =>
			(selectedCategory ? categoryName === selectedCategory : true) &&
			(categoryFilter.size === 0 || categoryFilter.has(categoryName));
		const images = [];

		const addUserImage = async (
			sourceName,
			categoryName,
			subcategoryName,
			entryName,
			filePath,
		) => {
			const searchText = [
				entryName,
				sourceName,
				categoryName,
				subcategoryName,
			]
				.filter(Boolean)
				.join("/")
				.toLowerCase();
			if (query && !searchText.includes(query)) return;
			const urlSub = subcategoryName
				? `/${dependencies.encodeUrlPathSegments(subcategoryName)}`
				: "";
			images.push({
				name: entryName,
				displayName: path.parse(entryName).name,
				url: `/api/images/${encodeURIComponent(sourceName)}/${encodeURIComponent(categoryName)}${urlSub}/${encodeURIComponent(entryName)}`,
				path: path.join(categoryName, subcategoryName, entryName),
				sizeBytes: await dependencies.getFileSize(filePath),
				source: sourceName,
				category: categoryName,
				subcategory: subcategoryName,
				locationLabel: [sourceName, categoryName, subcategoryName]
					.filter(Boolean)
					.join(" / "),
				readonly: false,
				globalSearch: true,
			});
		};

		if (await dependencies.exists(dependencies.imagesDir)) {
			const sourceEntries = await dependencies.readDir(
				dependencies.imagesDir,
				{ withFileTypes: true },
			);
			for (const sourceEntry of sourceEntries) {
				if (!sourceEntry.isDirectory()) continue;
				const sourceName = sourceEntry.name;
				if (sourceFilter && sourceName !== sourceFilter) continue;
				const sourceDir = path.join(
					dependencies.imagesDir,
					sourceName,
				);
				const categoryEntries = await dependencies.readDir(sourceDir, {
					withFileTypes: true,
				});
				for (const categoryEntry of categoryEntries) {
					if (!categoryEntry.isDirectory()) continue;
					const categoryName = categoryEntry.name;
					if (!shouldIncludeCategory(categoryName)) continue;
					const categoryDir = path.join(
						sourceDir,
						categoryName,
						...dependencies.normalizePathSegments(
							selectedSubcategory,
						),
					);
					if (!(await dependencies.exists(categoryDir))) continue;
					const walk = async (directoryPath, subParts = []) => {
						const entries = await dependencies.readDir(
							directoryPath,
							{ withFileTypes: true },
						);
						for (const entry of entries) {
							const nextPath = path.join(
								directoryPath,
								entry.name,
							);
							if (entry.isDirectory()) {
								await walk(nextPath, [
									...subParts,
									entry.name,
								]);
							} else if (
								entry.isFile() &&
								IMAGE_FILE_RE.test(entry.name)
							) {
								const fullSubParts = [
									...dependencies.normalizePathSegments(
										selectedSubcategory,
									),
									...subParts,
								];
								await addUserImage(
									sourceName,
									categoryName,
									fullSubParts.join("/"),
									entry.name,
									nextPath,
								);
							}
						}
					};
					await walk(categoryDir);
				}
			}
		}

		if (
			(!sourceFilter || sourceFilter === "general") &&
			shouldIncludeCategory("tokens")
		) {
			const officialAssets = await listBestiaryTokenAssets({
				subcategory:
					selectedCategory === "tokens" ? selectedSubcategory : "",
				search: query,
				ignoreSourcesList,
			});
			for (const image of officialAssets.images) {
				const relativeParts = String(image.path || "")
					.split(/[\\/]+/)
					.filter(Boolean)
					.slice(2);
				const officialSubcategory = relativeParts
					.slice(0, -1)
					.join("/");
				images.push({
					...image,
					assetSource: image.source,
					source: "general",
					category: "tokens",
					subcategory: officialSubcategory,
					locationLabel: [
						"general",
						"tokens",
						officialSubcategory,
					]
						.filter(Boolean)
						.join(" / "),
					globalSearch: true,
				});
			}
		}

		images.sort((a, b) =>
			String(a.displayName || a.name).localeCompare(
				String(b.displayName || b.name),
			),
		);
		return { images };
	}

	async function getImageGalleryStorageStats({
		source = "general",
		category = "",
		subcategory = "",
		categories = [],
	} = {}) {
		const sourceSlug = path.basename(String(source || "general"));
		const sourceDir = path.join(dependencies.imagesDir, sourceSlug);
		const categoryIds = Array.isArray(categories)
			? categories.map((item) => String(item || "")).filter(Boolean)
			: [];
		const sourceEntries = (await dependencies.exists(dependencies.imagesDir))
			? await dependencies.readDir(dependencies.imagesDir, {
					withFileTypes: true,
				})
			: [];
		const sourceSizes = {};
		for (const entry of sourceEntries) {
			if (!entry.isDirectory()) continue;
			sourceSizes[entry.name] = await dependencies.getDirectorySize(
				path.join(dependencies.imagesDir, entry.name),
			);
		}
		const categoryNames =
			categoryIds.length > 0
				? categoryIds
				: (await dependencies.exists(sourceDir))
					? (
							await dependencies.readDir(sourceDir, {
								withFileTypes: true,
							})
						)
							.filter((entry) => entry.isDirectory())
							.map((entry) => entry.name)
					: [];
		const categorySizes = {};
		for (const categoryName of categoryNames) {
			categorySizes[categoryName] =
				await dependencies.getDirectorySize(
					path.join(sourceDir, categoryName),
				);
		}
		return {
			totalBytes: await dependencies.getDirectorySize(
				dependencies.imagesDir,
			),
			sourceBytes: await dependencies.getDirectorySize(sourceDir),
			categoryBytes: category
				? await dependencies.getDirectorySize(
						path.join(sourceDir, category),
					)
				: 0,
			subcategoryBytes: category
				? await dependencies.getDirectorySize(
						path.join(sourceDir, category, subcategory),
					)
				: 0,
			sourceSizes,
			categorySizes,
		};
	}

	return {
		getImageGalleryStorageStats,
		listBestiaryTokenAssets,
		searchImageGalleryAssets,
	};
}

const imageGalleryReadService = createImageGalleryReadService();

module.exports = {
	...imageGalleryReadService,
	createImageGalleryReadService,
};
