const path = require("path");

function hasArchiveImageFiles(files) {
	if (!Array.isArray(files)) return false;
	return files.length !== 0;
}

function getCampaignArchiveImageRoot(imagesDir, slug) {
	return path.join(imagesDir, path.basename(String(slug || "")));
}

function normalizeArchiveImageRelativePath(file) {
	return String(file?.relativePath || "")
		.replace(/\\/g, "/")
		.replace(/^\/+/, "");
}

function hasArchiveImagePayload(file, relativePath) {
	if (!relativePath) return false;
	return Boolean(file?.base64);
}

function isArchiveImageTargetWithinRoot(targetPath, resolvedRoot) {
	if (targetPath === resolvedRoot) return true;
	return targetPath.startsWith(`${resolvedRoot}${path.sep}`);
}

async function restoreArchiveImageFile({
	file,
	root,
	resolvedRoot,
	ensureDir,
	writeFile,
}) {
	const relativePath = normalizeArchiveImageRelativePath(file);
	if (!hasArchiveImagePayload(file, relativePath)) return;

	const targetPath = path.resolve(root, relativePath);
	if (!isArchiveImageTargetWithinRoot(targetPath, resolvedRoot)) return;

	await ensureDir(path.dirname(targetPath));
	await writeFile(targetPath, Buffer.from(file.base64, "base64"));
}

function createCampaignArchiveImageRestorer({
	imagesDir,
	ensureDir,
	writeFile,
}) {
	return async function restoreCampaignImagesFromArchive(slug, files = []) {
		if (!hasArchiveImageFiles(files)) return;

		const root = getCampaignArchiveImageRoot(imagesDir, slug);
		const resolvedRoot = path.resolve(root);
		for (const file of files) {
			await restoreArchiveImageFile({
				file,
				root,
				resolvedRoot,
				ensureDir,
				writeFile,
			});
		}
	};
}

module.exports = {
	createCampaignArchiveImageRestorer,
};
