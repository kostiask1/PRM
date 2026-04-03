const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const CAMPAIGNS_DIR = path.join(DATA_DIR, "campaigns");
const BESTIARY_DIR = path.join(ROOT_DIR, "database", "bestiary");
const SPELLS_DIR = path.join(ROOT_DIR, "database", "spells");

function todayString() {
	return new Date().toISOString().slice(0, 10);
}

function createId() {
	return crypto.randomUUID();
}

function sanitizeName(name) {
	return String(name || "")
		.trim()
		.replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
		.replace(/\.+$/g, "")
		.replace(/\s+/g, " ")
		.slice(0, 120);
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

function sessionPath(slug, fileName) {
	return path.join(campaignDir(slug), "sessions", path.basename(fileName));
}

async function ensureDir(dirPath) {
	await fs.mkdir(dirPath, { recursive: true });
}

async function exists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function readJson(filePath) {
	const raw = await fs.readFile(filePath, "utf8");
	return JSON.parse(raw);
}

async function writeJson(filePath, value) {
	await ensureDir(path.dirname(filePath));
	const content = JSON.stringify(value, null, 2);
	await fs.writeFile(filePath, content, "utf8");
}

async function renameWithRetry(oldPath, newPath, retries = 3, delay = 50) {
	for (let i = 0; i < retries; i++) {
		try {
			await fs.rename(oldPath, newPath);
			return;
		} catch (err) {
			const isLocked = ["EPERM", "EBUSY"].includes(err.code);
			if (isLocked && i < retries - 1) {
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}
			throw err;
		}
	}
}

async function listCampaignSlugs() {
	const entries = await fs.readdir(CAMPAIGNS_DIR, { withFileTypes: true });
	return entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);
}

async function readCampaign(slug) {
	return readJson(campaignMetaPath(slug));
}

async function readSession(slug, fileName) {
	return readJson(sessionPath(slug, fileName));
}

async function listSessions(slug) {
	const sessionsDir = path.join(campaignDir(slug), "sessions");
	await ensureDir(sessionsDir);
	const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
	const files = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
		.map((entry) => entry.name)
		.sort();

	const sessionPromises = files.map(async (file) => {
		const data = await readSession(slug, file);
		return {
			id: data.id,
			name: data.name,
			fileName: file,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt,
			completed: Boolean(data.completed),
			order: data.order || 0,
			completedAt: data.completedAt || null,
		};
	});

	const result = await Promise.all(sessionPromises);
	return result.sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name, "uk"));
}

async function listCampaignsDetailed() {
	const slugs = await listCampaignSlugs();
	const campaignPromises = slugs.map(async (slug) => {
		const meta = await readCampaign(slug);
		const sessions = await listSessions(slug);
		return { ...meta, slug, sessionCount: sessions.length };
	});
	const result = await Promise.all(campaignPromises);
	return result.sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name, "uk"));
}

async function exportCampaignBundle(slug) {
	const meta = await readCampaign(slug);
	const sessionFiles = await listSessions(slug);
	const sessions = await Promise.all(
		sessionFiles.map(async (s) => {
			const content = await readSession(slug, s.fileName);
			return { fileName: s.fileName, content };
		})
	);
	return { meta, sessions };
}

async function ensureUniqueCampaignSlug(baseSlug, ignoreSlug = null) {
	let slug = baseSlug;
	let counter = 2;
	while (true) {
		const dir = campaignDir(slug);
		const taken = await exists(dir);
		if (!taken || slug === ignoreSlug) return slug;
		slug = `${baseSlug}-${counter}`;
		counter += 1;
	}
}

async function ensureUniqueSessionFile(slug, desiredName, ignoreFileName = null) {
	const parsed = path.parse(sessionFileName(desiredName));
	let fileName = `${parsed.name}${parsed.ext || ".json"}`;
	let counter = 2;
	while (true) {
		const fullPath = sessionPath(slug, fileName);
		const taken = await exists(fullPath);
		if (!taken || fileName === ignoreFileName) return fileName;
		fileName = `${parsed.name}-${counter}.json`;
		counter += 1;
	}
}

async function importCampaignBundle(bundle) {
	const { meta, sessions } = bundle;
	if (!meta || !meta.name) throw new Error("Невірний формат бандла");
	const slug = await ensureUniqueCampaignSlug(campaignSlug(meta.name));
	const now = new Date().toISOString();
	const newMeta = { ...meta, slug, createdAt: meta.createdAt || now, updatedAt: now };
	await ensureDir(path.join(campaignDir(slug), "sessions"));
	await writeJson(campaignMetaPath(slug), newMeta);
	for (const session of sessions) {
		const fileName = await ensureUniqueSessionFile(slug, session.content.name);
		await writeJson(sessionPath(slug, fileName), { ...session.content, updatedAt: now });
	}
	return newMeta;
}

function makeDefaultSessionData(name) {
	return {
		id: createId(),
		name: sanitizeName(name) || todayString(),
		completed: false,
		order: 0,
		completedAt: null,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		data: {},
	};
}

module.exports = {
	CAMPAIGNS_DIR, BESTIARY_DIR, SPELLS_DIR,
	createId, sanitizeName, campaignSlug, sessionFileName, 
	campaignDir, campaignMetaPath, sessionPath,
	ensureDir, exists, readJson, writeJson, renameWithRetry,
	listCampaignSlugs, readCampaign, readSession, listSessions, 
	listCampaignsDetailed, exportCampaignBundle, importCampaignBundle,
	ensureUniqueCampaignSlug, ensureUniqueSessionFile, makeDefaultSessionData
};