const fs = require("fs/promises");
const path = require("path");
const {
	ensureDir,
	exists,
	getFileSize,
	renameWithRetry,
} = require("../../infrastructure/jsonFileStore");
const {
	IMAGES_DIR,
	campaignImagesDir,
} = require("../../infrastructure/storagePaths");
const {
	updateAllImageReferences,
} = require("./imageReferenceService");

const IMAGE_FILE_RE = /\.(jpg|jpeg|png|webp|gif|svg)$/i;

function imageUrlFromParts(slug, relativeParts) {
	const [category, ...rest] = relativeParts;
	const fileName = rest.pop();
	const subcategory = rest.join("/");
	return `/api/images/${encodeURIComponent(slug)}/${encodeURIComponent(category)}${subcategory ? "/" + encodeURIComponent(subcategory) : ""}/${encodeURIComponent(fileName)}`;
}

function createImageAssetRepository(overrides = {}) {
	const dependencies = {
		campaignImagesDir,
		ensureDir,
		exists,
		getFileSize,
		imagesDir: IMAGES_DIR,
		readDir: fs.readdir,
		remove: fs.rm,
		rename: fs.rename,
		renameWithRetry,
		stat: fs.stat,
		updateAllImageReferences,
		...overrides,
	};

	function imageDirectory(slug, category, subcategory = "") {
		return dependencies.campaignImagesDir(
			slug,
			category,
			subcategory || "",
		);
	}

	async function ensureUniqueImagePath(filePath) {
		if (!(await dependencies.exists(filePath))) return filePath;
		const parsed = path.parse(filePath);
		let counter = 2;
		while (true) {
			const candidate = path.join(
				parsed.dir,
				`${parsed.name}-${counter}${parsed.ext}`,
			);
			if (!(await dependencies.exists(candidate))) return candidate;
			counter += 1;
		}
	}

	async function ensureUniqueImageFileName(
		slug,
		category,
		subcategory,
		baseName,
		extension,
	) {
		const directoryPath = imageDirectory(slug, category, subcategory);
		const filePath = await ensureUniqueImagePath(
			path.join(directoryPath, `${baseName}${extension}`),
		);
		return path.basename(filePath);
	}

	async function listImages(slug, category, subcategory = "") {
		const sub = subcategory || "";
		const directoryPath = imageDirectory(slug, category, sub);
		if (!(await dependencies.exists(directoryPath))) return [];
		const entries = await dependencies.readDir(directoryPath, {
			withFileTypes: true,
		});
		return Promise.all(
			entries
				.filter(
					(entry) =>
						entry.isFile() && IMAGE_FILE_RE.test(entry.name),
				)
				.map(async (entry) => ({
					name: entry.name,
					url: `/api/images/${encodeURIComponent(slug)}/${encodeURIComponent(category)}${sub ? "/" + encodeURIComponent(sub) : ""}/${encodeURIComponent(entry.name)}`,
					path: path.join(category, sub, entry.name),
					sizeBytes: await dependencies.getFileSize(
						path.join(directoryPath, entry.name),
					),
				})),
		);
	}

	async function listSubcategories(
		slug,
		category,
		subcategory = "",
		options = {},
	) {
		const directoryPath = imageDirectory(slug, category, subcategory);
		if (!(await dependencies.exists(directoryPath))) return [];
		const entries = await dependencies.readDir(directoryPath, {
			withFileTypes: true,
		});
		const subcategories = entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort((a, b) => a.localeCompare(b));
		if (!options.includeMeta) return subcategories;
		return Promise.all(
			subcategories.map(async (name) => {
				const entries = await dependencies.readDir(
					path.join(directoryPath, name),
					{ withFileTypes: true },
				);
				return {
					name,
					hasFiles: entries.some(
						(entry) =>
							entry.isFile() && IMAGE_FILE_RE.test(entry.name),
					),
				};
			}),
		);
	}

	async function createSubcategory(slug, category, name) {
		await dependencies.ensureDir(imageDirectory(slug, category, name));
	}

	async function moveImages(items = [], src, dest) {
		const sourceSlug = decodeURIComponent(src.slug);
		const destinationSlug = decodeURIComponent(dest.slug);
		const sourceSubcategory = src.subcategory || "";
		const destinationSubcategory = dest.subcategory || "";
		const sourceDirectory = imageDirectory(
			sourceSlug,
			src.category,
			sourceSubcategory,
		);
		const destinationDirectory = imageDirectory(
			destinationSlug,
			dest.category,
			destinationSubcategory,
		);
		if (sourceDirectory === destinationDirectory) return [];
		await dependencies.ensureDir(destinationDirectory);

		const results = [];
		for (const name of items) {
			const oldPath = path.join(sourceDirectory, name);
			const newPath = path.join(destinationDirectory, name);
			if (!(await dependencies.exists(oldPath))) continue;
			const isDirectory = (await dependencies.stat(oldPath)).isDirectory();
			const trackedFiles = [];
			if (isDirectory) {
				const walk = async (directoryPath, sub = "") => {
					const entries = await dependencies.readDir(directoryPath, {
						withFileTypes: true,
					});
					for (const entry of entries) {
						if (entry.isFile()) {
							trackedFiles.push(path.join(sub, entry.name));
						} else if (entry.isDirectory()) {
							await walk(
								path.join(directoryPath, entry.name),
								path.join(sub, entry.name),
							);
						}
					}
				};
				await walk(oldPath);
			} else {
				trackedFiles.push("");
			}
			await dependencies.renameWithRetry(oldPath, newPath);

			for (const relativePath of trackedFiles) {
				const fileName = isDirectory ? relativePath : name;
				const oldSubcategory = sourceSubcategory
					? isDirectory
						? path.join(sourceSubcategory, name, relativePath)
						: sourceSubcategory
					: isDirectory
						? path.join(name, relativePath)
						: "";
				const newSubcategory = destinationSubcategory
					? isDirectory
						? path.join(destinationSubcategory, name, relativePath)
						: destinationSubcategory
					: isDirectory
						? path.join(name, relativePath)
						: "";
				results.push({
					oldUrl: `/api/images/${encodeURIComponent(sourceSlug)}/${encodeURIComponent(src.category)}${oldSubcategory ? "/" + oldSubcategory.split(path.sep).join("/") : ""}${isDirectory ? "" : "/" + encodeURIComponent(fileName)}`,
					newUrl: `/api/images/${encodeURIComponent(destinationSlug)}/${encodeURIComponent(dest.category)}${newSubcategory ? "/" + newSubcategory.split(path.sep).join("/") : ""}${isDirectory ? "" : "/" + encodeURIComponent(fileName)}`,
				});
			}
		}
		await dependencies.updateAllImageReferences(results);
		return results;
	}

	async function renameImage(
		slug,
		category,
		subcategory,
		oldName,
		newName,
	) {
		const directoryPath = imageDirectory(slug, category, subcategory);
		const oldPath = path.join(directoryPath, oldName);
		const newPath = path.join(directoryPath, newName);
		if (!(await dependencies.exists(oldPath))) {
			throw new Error("File was not found.");
		}
		if (oldPath !== newPath && (await dependencies.exists(newPath))) {
			throw new Error("File already exists.");
		}
		await dependencies.renameWithRetry(oldPath, newPath);
		const sub = subcategory || "";
		const oldUrl = `/api/images/${encodeURIComponent(slug)}/${encodeURIComponent(category)}${sub ? "/" + sub.split(path.sep).join("/") : ""}/${encodeURIComponent(oldName)}`;
		const newUrl = `/api/images/${encodeURIComponent(slug)}/${encodeURIComponent(category)}${sub ? "/" + sub.split(path.sep).join("/") : ""}/${encodeURIComponent(newName)}`;
		await dependencies.updateAllImageReferences([{ oldUrl, newUrl }]);
		return { oldUrl, newUrl };
	}

	async function deleteImages(items = [], src, options = {}) {
		const extractFolderContents = Boolean(options.extractFolderContents);
		const slug = decodeURIComponent(src.slug);
		const category = src.category;
		const subcategory = src.subcategory || "";
		const directoryPath = imageDirectory(slug, category, subcategory);
		for (const name of items) {
			const target = path.join(directoryPath, name);
			if (!(await dependencies.exists(target))) continue;
			const stats = await dependencies.stat(target);
			if (!extractFolderContents || !stats.isDirectory()) {
				await dependencies.remove(target, {
					recursive: true,
					force: true,
				});
				continue;
			}
			const nestedItems = await dependencies.readDir(target);
			if (nestedItems.length > 0) {
				await moveImages(
					nestedItems,
					{
						slug,
						category,
						subcategory: subcategory
							? path.join(subcategory, name)
							: name,
					},
					{ slug, category, subcategory },
				);
			}
			await dependencies.remove(target, {
				recursive: true,
				force: true,
			});
		}
	}

	async function renameSubcategory(
		slug,
		category,
		oldName,
		newName,
	) {
		const root = path.join(
			dependencies.imagesDir,
			path.basename(slug),
			category,
		);
		const oldPath = path.join(root, oldName);
		const newPath = path.join(root, newName);
		if (!(await dependencies.exists(oldPath))) {
			throw new Error("Subcategory was not found.");
		}
		if (oldPath !== newPath && (await dependencies.exists(newPath))) {
			throw new Error("Subcategory already exists.");
		}
		await dependencies.rename(oldPath, newPath);
	}

	async function moveCampaignImagesToGeneral(slug) {
		const sourceSlug = path.basename(String(slug || ""));
		if (!sourceSlug || sourceSlug === "general") return [];
		const sourceRoot = path.join(dependencies.imagesDir, sourceSlug);
		if (!(await dependencies.exists(sourceRoot))) return [];
		const resolvedSourceRoot = path.resolve(sourceRoot);
		const results = [];

		const walk = async (directoryPath) => {
			const entries = await dependencies.readDir(directoryPath, {
				withFileTypes: true,
			});
			for (const entry of entries) {
				const oldPath = path.join(directoryPath, entry.name);
				if (entry.isDirectory()) {
					await walk(oldPath);
					continue;
				}
				if (!entry.isFile()) continue;
				const relativePath = path.relative(sourceRoot, oldPath);
				if (!relativePath || relativePath.startsWith("..")) continue;
				const relativeParts = relativePath.split(path.sep);
				if (relativeParts.length < 2) continue;
				const destinationDirectory = path.join(
					dependencies.imagesDir,
					"general",
					...relativeParts.slice(0, -1),
				);
				await dependencies.ensureDir(destinationDirectory);
				const newPath = await ensureUniqueImagePath(
					path.join(destinationDirectory, relativeParts.at(-1)),
				);
				await dependencies.renameWithRetry(oldPath, newPath);
				results.push({
					oldUrl: imageUrlFromParts(
						sourceSlug,
						path
							.relative(resolvedSourceRoot, oldPath)
							.split(path.sep)
							.filter(Boolean),
					),
					newUrl: imageUrlFromParts(
						"general",
						path
							.relative(
								path.join(dependencies.imagesDir, "general"),
								newPath,
							)
							.split(path.sep)
							.filter(Boolean),
					),
				});
			}
		};
		await walk(sourceRoot);
		await dependencies.remove(sourceRoot, {
			recursive: true,
			force: true,
		});
		await dependencies.updateAllImageReferences(results);
		return results;
	}

	async function campaignHasImages(slug) {
		const safeSlug = path.basename(String(slug || ""));
		if (!safeSlug) return false;
		const root = path.join(dependencies.imagesDir, safeSlug);
		if (!(await dependencies.exists(root))) return false;
		const walk = async (directoryPath) => {
			const entries = await dependencies.readDir(directoryPath, {
				withFileTypes: true,
			});
			for (const entry of entries) {
				if (entry.isFile()) return true;
				if (
					entry.isDirectory() &&
					(await walk(path.join(directoryPath, entry.name)))
				) {
					return true;
				}
			}
			return false;
		};
		return walk(root);
	}

	async function deleteCampaignImages(slug) {
		await dependencies.remove(
			path.join(dependencies.imagesDir, path.basename(slug)),
			{ recursive: true, force: true },
		);
	}

	return {
		campaignHasImages,
		createSubcategory,
		deleteCampaignImages,
		deleteImages,
		ensureUniqueImageFileName,
		imageDirectory,
		listImages,
		listSubcategories,
		moveCampaignImagesToGeneral,
		moveImages,
		renameImage,
		renameSubcategory,
	};
}

const imageAssetRepository = createImageAssetRepository();

module.exports = {
	...imageAssetRepository,
	IMAGE_FILE_RE,
	createImageAssetRepository,
	imageUrlFromParts,
};
