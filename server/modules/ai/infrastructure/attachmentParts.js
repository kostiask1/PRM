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

function collectImageUrls(value, output = []) {
	if (!Array.isArray(value)) return output;
	if (Array.isArray(value)) {
		for (const item of value) {
			if (item?.url) output.push(String(item.url).trim());
			if (output.length >= MAX_AI_IMAGES) break;
		}
	}
	return output;
}

function isSafeImagePathPart(value) {
	const part = String(value || "");
	return (
		part &&
		part !== "." &&
		part !== ".." &&
		!part.includes("/") &&
		!part.includes("\\")
	);
}

function resolveLocalImageUrl(imageUrl) {
	let pathname = "";
	try {
		pathname = new URL(String(imageUrl || ""), "http://local").pathname;
	} catch {
		pathname = String(imageUrl || "");
	}

	const parts = pathname
		.split("/")
		.filter(Boolean)
		.map((part) => decodeURIComponent(part));
	if (parts.length < 5 || parts[0] !== "api" || parts[1] !== "images") {
		return null;
	}

	const [, , slug, category, ...relativeParts] = parts;
	if (!slug || !category || relativeParts.length === 0) return null;
	if (![slug, category, ...relativeParts].every(isSafeImagePathPart)) {
		return null;
	}

	const filePath = path.resolve(
		storage.IMAGES_DIR,
		slug,
		category,
		...relativeParts,
	);
	const rootPath = path.resolve(storage.IMAGES_DIR);
	if (filePath !== rootPath && !filePath.startsWith(`${rootPath}${path.sep}`)) {
		return null;
	}

	const mimeType = AI_IMAGE_MIME_TYPES[path.extname(filePath).toLowerCase()];
	if (!mimeType) return null;
	return { filePath, mimeType };
}

async function imageUrlToInlinePart(imageUrl) {
	const resolved = resolveLocalImageUrl(imageUrl);
	if (!resolved) return null;

	const stats = await fs.stat(resolved.filePath).catch(() => null);
	if (!stats?.isFile() || stats.size > MAX_AI_IMAGE_BYTES) return null;

	const data = await fs.readFile(resolved.filePath);
	return {
		inlineData: {
			data: data.toString("base64"),
			mimeType: resolved.mimeType,
		},
	};
}

function normalizeAttachedImageMimeType(image = {}) {
	const mimeType = String(image.mimeType || "")
		.trim()
		.toLowerCase();
	if (AI_ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) return mimeType;
	const byExtension = AI_IMAGE_MIME_TYPES[extensionFromName(image.name)];
	return byExtension || "";
}

function normalizeAttachedImageData(data) {
	const value = String(data || "").trim();
	if (!value) return "";
	const commaIndex = value.indexOf(",");
	return value.startsWith("data:") && commaIndex !== -1
		? value.slice(commaIndex + 1)
		: value;
}

function attachedImageToInlinePart(image = {}) {
	const mimeType = normalizeAttachedImageMimeType(image);
	if (!mimeType) return null;

	const data = normalizeAttachedImageData(image.data);
	if (!data) return null;

	let buffer;
	try {
		buffer = Buffer.from(data, "base64");
	} catch {
		return null;
	}
	if (!buffer.length || buffer.length > MAX_AI_IMAGE_BYTES) return null;

	return {
		inlineData: {
			data: buffer.toString("base64"),
			mimeType,
		},
	};
}

async function buildImageParts(attachedImages = []) {
	const images = Array.isArray(attachedImages)
		? attachedImages.slice(0, MAX_AI_IMAGES)
		: [];
	const parts = [];
	const seenUrls = new Set();
	for (const image of images) {
		const inlinePart = attachedImageToInlinePart(image);
		if (inlinePart) {
			parts.push(inlinePart);
			continue;
		}

		const url = String(image?.url || "").trim();
		if (!url || seenUrls.has(url)) continue;
		seenUrls.add(url);
		const urlPart = await imageUrlToInlinePart(url);
		if (urlPart) parts.push(urlPart);
	}
	return parts;
}

function extensionFromName(fileName) {
	return path.extname(String(fileName || "")).toLowerCase();
}

function normalizeAttachedFileMimeType(file = {}) {
	const byExtension = AI_FILE_MIME_TYPES[extensionFromName(file.name)];
	if (byExtension) return byExtension;
	const mimeType = String(file.mimeType || "")
		.trim()
		.toLowerCase();
	return AI_ALLOWED_FILE_MIME_TYPES.has(mimeType) ? mimeType : "";
}

function normalizeAttachedFileData(data) {
	const value = String(data || "").trim();
	if (!value) return "";
	const commaIndex = value.indexOf(",");
	return value.startsWith("data:") && commaIndex !== -1
		? value.slice(commaIndex + 1)
		: value;
}

function attachmentNameForPrompt(name) {
	return String(name || "attached-file").replace(/[\r\n]+/g, " ").trim();
}

function attachedFileToPart(file = {}) {
	const mimeType = normalizeAttachedFileMimeType(file);
	if (!mimeType) return [];

	const data = normalizeAttachedFileData(file.data);
	if (!data) return [];

	let buffer;
	try {
		buffer = Buffer.from(data, "base64");
	} catch {
		return [];
	}
	if (!buffer.length || buffer.length > MAX_AI_FILE_BYTES) return [];

	const name = attachmentNameForPrompt(file.name);
	if (AI_TEXT_FILE_MIME_TYPES.has(mimeType)) {
		return [
			{
				text: `ATTACHED FILE: ${name} (${mimeType})\n\n${buffer.toString("utf8")}`,
			},
		];
	}

	return [
		{ text: `ATTACHED FILE: ${name} (${mimeType})` },
		{
			inlineData: {
				data: buffer.toString("base64"),
				mimeType,
			},
		},
	];
}

function buildFileParts(attachedFiles = []) {
	const files = Array.isArray(attachedFiles)
		? attachedFiles.slice(0, MAX_AI_FILES)
		: [];
	return files.flatMap(attachedFileToPart);
}

module.exports = {
	buildFileParts,
	buildImageParts,
	collectImageUrls,
	resolveLocalImageUrl,
};
