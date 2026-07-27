const path = require("path");

const ROOT_DIR = path.join(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const CAMPAIGNS_DIR = path.join(DATA_DIR, "campaigns");
const BESTIARY_DIR = path.join(ROOT_DIR, "database", "bestiary");
const BESTIARY_TOKENS_DIR = path.join(BESTIARY_DIR, "tokens");
const CUSTOM_BESTIARY_PATH = path.join(DATA_DIR, "custom-bestiary.json");
const BESTIARY_AI_RESPONSES_PATH = path.join(
	DATA_DIR,
	"_aiResponses-bestiary.json",
);
const SPELLS_DIR = path.join(ROOT_DIR, "database", "spells");
const FAVORITES_PATH = path.join(DATA_DIR, "favorites.json");
const IMAGES_DIR = path.join(DATA_DIR, "images");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");

function todayString() {
	return new Date().toISOString().slice(0, 10);
}

function sanitizeName(name) {
	const cleaned = String(name || "")
		.trim()
		.replace(/[<>:"/\\|?*]/g, "")
		.replace(/\.+$/g, "")
		.replace(/\s+/g, " ")
		.slice(0, 120);
	return [...cleaned].filter((char) => char.charCodeAt(0) >= 32).join("");
}

function campaignSlug(name) {
	return (
		sanitizeName(name)
			.toLowerCase()
			.normalize("NFKD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[^\p{L}\p{N}]+/gu, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 80) || `campaign-${Date.now()}`
	);
}

function sessionFileName(name) {
	const safe = sanitizeName(name);
	return `${safe || todayString()}.json`;
}

function campaignDir(slug) {
	return path.join(CAMPAIGNS_DIR, path.basename(slug));
}

function campaignMetaPath(slug) {
	return path.join(campaignDir(slug), "_campaign.json");
}

function campaignAiResponsesPath(slug) {
	return path.join(campaignDir(slug), "_aiResponses.json");
}

function aiResponsesPath(slug) {
	return slug === "bestiary"
		? BESTIARY_AI_RESPONSES_PATH
		: campaignAiResponsesPath(slug);
}

function campaignImagesDir(slug, category, subcategory = "") {
	const safeSlug = path.basename(String(slug || "general"));
	const safeCat = String(category || "attachments");
	const safeSub = String(subcategory || "");
	return path.join(IMAGES_DIR, safeSlug, safeCat, safeSub);
}

function sessionPath(slug, fileName) {
	return path.join(campaignDir(slug), "sessions", path.basename(fileName));
}

function encodeUrlPathSegments(...parts) {
	return parts
		.flatMap((part) =>
			String(part || "")
				.split(/[\\/]+/)
				.filter(Boolean),
		)
		.map((part) => encodeURIComponent(part))
		.join("/");
}

function normalizePathSegments(value) {
	return String(value || "")
		.split(/[\\/]+/)
		.map((part) => part.trim())
		.filter(Boolean)
		.filter((part) => part !== "." && part !== ".." && part === path.basename(part));
}

module.exports = {
	BESTIARY_AI_RESPONSES_PATH,
	BESTIARY_DIR,
	BESTIARY_TOKENS_DIR,
	CAMPAIGNS_DIR,
	CUSTOM_BESTIARY_PATH,
	DATA_DIR,
	FAVORITES_PATH,
	IMAGES_DIR,
	ROOT_DIR,
	SETTINGS_PATH,
	SPELLS_DIR,
	aiResponsesPath,
	campaignAiResponsesPath,
	campaignDir,
	campaignImagesDir,
	campaignMetaPath,
	campaignSlug,
	encodeUrlPathSegments,
	normalizePathSegments,
	sanitizeName,
	sessionFileName,
	sessionPath,
	todayString,
};
