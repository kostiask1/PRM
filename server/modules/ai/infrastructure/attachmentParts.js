const fs = require("fs/promises");
const path = require("path");
const storage = require("../../../storage");

const MAX_AI_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_AI_IMAGES = 4;
const MAX_AI_FILE_BYTES = 10 * 1024 * 1024;
const MAX_AI_FILES = 4;
const AI_IMAGE_MIME_TYPES = Object.freeze({
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".png": "image/png",
	".webp": "image/webp",
	".gif": "image/gif",
});
const AI_ALLOWED_IMAGE_MIME_TYPES = new Set(Object.values(AI_IMAGE_MIME_TYPES));
const AI_FILE_MIME_TYPES = Object.freeze({
	".csv": "text/csv",
	".css": "text/css",
	".htm": "text/html",
	".html": "text/html",
	".js": "text/javascript",
	".json": "application/json",
	".md": "text/markdown",
	".markdown": "text/markdown",
	".pdf": "application/pdf",
	".scss": "text/css",
	".txt": "text/plain",
	".xml": "application/xml",
	".yaml": "application/x-yaml",
	".yml": "application/x-yaml",
});
const AI_TEXT_FILE_MIME_TYPES = new Set([
	"application/json",
	"application/x-yaml",
	"application/xml",
	"text/css",
	"text/csv",
	"text/html",
	"text/javascript",
	"text/markdown",
	"text/plain",
	"text/xml",
]);
const AI_ALLOWED_FILE_MIME_TYPES = new Set([
	...Object.values(AI_FILE_MIME_TYPES),
	"text/xml",
]);

const UNSAFE_IMAGE_PATH_PARTS = new Set(["", ".", ".."]);
const LOCAL_IMAGE_ROUTE_PREFIX = Object.freeze(["api", "images"]);

function getCappedAttachmentList(value, limit) {
	return Array.isArray(value) ? value.slice(0, limit) : [];
}

function appendCollectedImageUrl(output, item) {
	if (item?.url) output.push(String(item.url).trim());
}

function hasCollectedMaximumImages(output) {
	return output.length >= MAX_AI_IMAGES;
}

function collectImageUrls(value, output = []) {
	if (!Array.isArray(value)) return output;
	for (const item of value) {
		appendCollectedImageUrl(output, item);
		if (hasCollectedMaximumImages(output)) break;
	}
	return output;
}

function toAttachmentString(value) {
	return String(value || "");
}

function hasImagePathSeparator(part) {
	return ["/", "\\"].some((separator) => part.includes(separator));
}

function isSafeImagePathPart(value) {
	const part = toAttachmentString(value);
	if (UNSAFE_IMAGE_PATH_PARTS.has(part)) return false;
	return !hasImagePathSeparator(part);
}

function getLocalImageUrlPathname(imageUrl) {
	try {
		return new URL(toAttachmentString(imageUrl), "http://local").pathname;
	} catch {
		return toAttachmentString(imageUrl);
	}
}

function decodeLocalImagePathParts(pathname) {
	return pathname
		.split("/")
		.filter(Boolean)
		.map((part) => decodeURIComponent(part));
}

function hasLocalImageRoutePrefix(parts) {
	return (
		parts[0] === LOCAL_IMAGE_ROUTE_PREFIX[0] &&
		parts[1] === LOCAL_IMAGE_ROUTE_PREFIX[1]
	);
}

function hasCompleteLocalImageRoute(parts) {
	return parts.length >= 5 && hasLocalImageRoutePrefix(parts);
}

function projectLocalImageRoute(parts) {
	const [, , slug, category, ...relativeParts] = parts;
	return { slug, category, relativeParts };
}

function hasCompleteLocalImageLocation(location) {
	return Boolean(
		location.slug &&
		location.category &&
		location.relativeParts.length > 0,
	);
}

function hasSafeLocalImageLocation(location) {
	return [
		location.slug,
		location.category,
		...location.relativeParts,
	].every(isSafeImagePathPart);
}

function getValidLocalImageLocation(parts) {
	if (!hasCompleteLocalImageRoute(parts)) return null;
	const location = projectLocalImageRoute(parts);
	if (!hasCompleteLocalImageLocation(location)) return null;
	if (!hasSafeLocalImageLocation(location)) return null;
	return location;
}

function resolveLocalImageFilePath(location) {
	return path.resolve(
		storage.IMAGES_DIR,
		location.slug,
		location.category,
		...location.relativeParts,
	);
}

function isWithinLocalImageRoot(filePath) {
	const rootPath = path.resolve(storage.IMAGES_DIR);
	return (
		filePath === rootPath ||
		filePath.startsWith(`${rootPath}${path.sep}`)
	);
}

function getImageMimeTypeForPath(filePath) {
	return AI_IMAGE_MIME_TYPES[path.extname(filePath).toLowerCase()];
}

function resolveLocalImageLocation(location) {
	const filePath = resolveLocalImageFilePath(location);
	if (!isWithinLocalImageRoot(filePath)) return null;
	const mimeType = getImageMimeTypeForPath(filePath);
	return mimeType ? { filePath, mimeType } : null;
}

function resolveLocalImageUrl(imageUrl) {
	const pathname = getLocalImageUrlPathname(imageUrl);
	const parts = decodeLocalImagePathParts(pathname);
	const location = getValidLocalImageLocation(parts);
	return location ? resolveLocalImageLocation(location) : null;
}

function readLocalImageStats(filePath) {
	return fs.stat(filePath).catch(() => null);
}

function isReadableLocalImage(stats) {
	if (!stats?.isFile()) return false;
	return stats.size <= MAX_AI_IMAGE_BYTES;
}

function createInlinePart(buffer, mimeType) {
	return {
		inlineData: {
			data: buffer.toString("base64"),
			mimeType,
		},
	};
}

async function imageUrlToInlinePart(imageUrl) {
	const resolved = resolveLocalImageUrl(imageUrl);
	if (!resolved) return null;
	const stats = await readLocalImageStats(resolved.filePath);
	if (!isReadableLocalImage(stats)) return null;
	const data = await fs.readFile(resolved.filePath);
	return createInlinePart(data, resolved.mimeType);
}

function extensionFromName(fileName) {
	return path.extname(toAttachmentString(fileName)).toLowerCase();
}

function normalizeDeclaredMimeType(mimeType) {
	return toAttachmentString(mimeType).trim().toLowerCase();
}

function normalizeAttachedImageMimeType(image = {}) {
	const mimeType = normalizeDeclaredMimeType(image.mimeType);
	if (AI_ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) return mimeType;
	return AI_IMAGE_MIME_TYPES[extensionFromName(image.name)] || "";
}

function stripAttachedDataUrlPrefix(value) {
	const commaIndex = value.indexOf(",");
	return value.startsWith("data:") && commaIndex !== -1
		? value.slice(commaIndex + 1)
		: value;
}

function normalizeAttachedData(data) {
	const value = toAttachmentString(data).trim();
	return value ? stripAttachedDataUrlPrefix(value) : "";
}

function decodeAttachedBase64(data) {
	try {
		return Buffer.from(data, "base64");
	} catch {
		return null;
	}
}

function hasAllowedAttachmentSize(buffer, maximumBytes) {
	if (!buffer?.length) return false;
	return buffer.length <= maximumBytes;
}

function attachedImageToInlinePart(image = {}) {
	const mimeType = normalizeAttachedImageMimeType(image);
	if (!mimeType) return null;
	const data = normalizeAttachedData(image.data);
	if (!data) return null;
	const buffer = decodeAttachedBase64(data);
	if (!hasAllowedAttachmentSize(buffer, MAX_AI_IMAGE_BYTES)) return null;
	return createInlinePart(buffer, mimeType);
}

function getAttachedImageUrl(image) {
	return toAttachmentString(image?.url).trim();
}

async function getUrlBackedImagePart(image, seenUrls) {
	const url = getAttachedImageUrl(image);
	if (!url || seenUrls.has(url)) return null;
	seenUrls.add(url);
	return imageUrlToInlinePart(url);
}

async function getAttachedImagePart(image, seenUrls) {
	const inlinePart = attachedImageToInlinePart(image);
	return inlinePart || getUrlBackedImagePart(image, seenUrls);
}

async function appendAttachedImagePart(parts, image, seenUrls) {
	const part = await getAttachedImagePart(image, seenUrls);
	if (part) parts.push(part);
}

async function buildImageParts(attachedImages = []) {
	const images = getCappedAttachmentList(attachedImages, MAX_AI_IMAGES);
	const parts = [];
	const seenUrls = new Set();
	for (const image of images) {
		await appendAttachedImagePart(parts, image, seenUrls);
	}
	return parts;
}

function normalizeAttachedFileMimeType(file = {}) {
	const byExtension = AI_FILE_MIME_TYPES[extensionFromName(file.name)];
	if (byExtension) return byExtension;
	const mimeType = normalizeDeclaredMimeType(file.mimeType);
	return AI_ALLOWED_FILE_MIME_TYPES.has(mimeType) ? mimeType : "";
}

function attachmentNameForPrompt(name) {
	return toAttachmentString(name || "attached-file")
		.replace(/[\r\n]+/g, " ")
		.trim();
}

function createTextFileParts(name, mimeType, buffer) {
	return [
		{
			text: `ATTACHED FILE: ${name} (${mimeType})\n\n${buffer.toString("utf8")}`,
		},
	];
}

function createBinaryFileParts(name, mimeType, buffer) {
	return [
		{ text: `ATTACHED FILE: ${name} (${mimeType})` },
		createInlinePart(buffer, mimeType),
	];
}

function createAttachedFileParts(name, mimeType, buffer) {
	return AI_TEXT_FILE_MIME_TYPES.has(mimeType)
		? createTextFileParts(name, mimeType, buffer)
		: createBinaryFileParts(name, mimeType, buffer);
}

function attachedFileToPart(file = {}) {
	const mimeType = normalizeAttachedFileMimeType(file);
	if (!mimeType) return [];
	const data = normalizeAttachedData(file.data);
	if (!data) return [];
	const buffer = decodeAttachedBase64(data);
	if (!hasAllowedAttachmentSize(buffer, MAX_AI_FILE_BYTES)) return [];
	const name = attachmentNameForPrompt(file.name);
	return createAttachedFileParts(name, mimeType, buffer);
}

function buildFileParts(attachedFiles = []) {
	return getCappedAttachmentList(attachedFiles, MAX_AI_FILES).flatMap(
		attachedFileToPart,
	);
}

module.exports = {
	buildFileParts,
	buildImageParts,
	collectImageUrls,
	resolveLocalImageUrl,
};
