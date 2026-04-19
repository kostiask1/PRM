const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const CAMPAIGNS_DIR = path.join(DATA_DIR, "campaigns");
const BESTIARY_DIR = path.join(ROOT_DIR, "database", "bestiary");
const SPELLS_DIR = path.join(ROOT_DIR, "database", "spells");
const FAVORITES_PATH = path.join(DATA_DIR, "favorites.json");

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

function characterDir(campaignSlug, charSlug) {
	return path.join(campaignDir(campaignSlug), "characters", path.basename(charSlug));
}

function npcDir(campaignSlug, npcSlug) {
	return path.join(campaignDir(campaignSlug), "npc", path.basename(npcSlug));
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
	const slugs = [];

	for (const entry of entries) {
		if (entry.isDirectory()) {
			slugs.push(entry.name);
		} else if (entry.isSymbolicLink()) {
			const stats = await fs.stat(path.join(CAMPAIGNS_DIR, entry.name)).catch(() => null);
			if (stats?.isDirectory()) {
				slugs.push(entry.name);
			}
		}
	}

	return slugs;
}

async function getBestiaryIndex() {
	if (!(await exists(BESTIARY_DIR))) return new Map();

	const entries = await fs.readdir(BESTIARY_DIR, { withFileTypes: true });
	const files = entries.filter(
		(e) =>
			e.isFile() &&
			e.name.endsWith(".json") &&
			e.name !== "legendarygroups.json",
	);

	const index = new Map();
	for (const file of files) {
		const data = await readJson(path.join(BESTIARY_DIR, file.name));

		let fileSource = (
			data._meta?.sources?.[0]?.json ||
			path.parse(file.name).name.replace(/^bestiary-/i, "")
		).toUpperCase();

		const monsters = Array.isArray(data)
			? data
			: data.monster || data.monsters || data.results || [];

		for (const m of monsters) {
			if (!m.name) continue;
			const monsterSource = (m.source || fileSource).toUpperCase();
			const key = `${m.name.trim().toLowerCase()}|${monsterSource}`;
			index.set(key, { ...m, source: monsterSource });
		}
	}
	return index;
}

function resolveMonster(monster, index, depth = 0) {
	if (depth > 10 || !monster._copy) return monster;

	const baseName = monster._copy.name;
	const baseSource = (
		monster._copy.source ||
		monster.source ||
		""
	).toUpperCase();
	const baseKey = `${baseName.toLowerCase()}|${baseSource}`;

	let base = index.get(baseKey);
	if (!base) {
		const keys = Array.from(index.keys());
		const foundKey = keys.find((k) =>
			k.startsWith(`${baseName.toLowerCase()}|`),
		);
		if (foundKey) base = index.get(foundKey);
	}

	if (!base) return monster;

	const resolvedBase = resolveMonster(
		JSON.parse(JSON.stringify(base)),
		index,
		depth + 1,
	);

	let resolved = { ...resolvedBase };

	for (const key in monster) {
		if (key !== "_copy" && key !== "_mod") {
			resolved[key] = monster[key];
		}
	}

	if (monster._copy._mod) {
		const mods = monster._copy._mod;
		if (mods["*"]) {
			const globalMods = Array.isArray(mods["*"]) ? mods["*"] : [mods["*"]];
			globalMods.forEach((mod) => {
				if (mod.mode === "replaceTxt") {
					resolved = applyReplaceTxt(resolved, mod);
				}
			});
		}

		for (const prop in mods) {
			if (prop === "*") continue;
			const propMods = Array.isArray(mods[prop]) ? mods[prop] : [mods[prop]];
			propMods.forEach((mod) => {
				if (!resolved[prop]) resolved[prop] = [];
				if (mod.mode === "appendArr") {
					const items = Array.isArray(mod.items) ? mod.items : [mod.items];
					resolved[prop] = [...resolved[prop], ...items];
				} else if (mod.mode === "prependArr") {
					const items = Array.isArray(mod.items) ? mod.items : [mod.items];
					resolved[prop] = [...items, ...resolved[prop]];
				} else if (mod.mode === "replaceArr") {
					const items = Array.isArray(mod.items) ? mod.items : [mod.items];
					const toReplace = mod.replace;
					resolved[prop] = resolved[prop].map((item) =>
						item.name === toReplace ? items[0] : item,
					);
				} else if (mod.mode === "removeArr") {
					const toRemove = Array.isArray(mod.names) ? mod.names : [mod.names];
					resolved[prop] = resolved[prop].filter(
						(item) => !toRemove.includes(item.name),
					);
				}
			});
		}
	}

	return resolved;
}

function applyReplaceTxt(obj, mod) {
	try {
		const escapedReplace = mod.replace.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		let json = JSON.stringify(obj);
		const regex = new RegExp(escapedReplace, mod.flags || "g");
		json = json.replace(regex, mod.with);
		return JSON.parse(json);
	} catch (e) {
		return obj;
	}
}

async function readCampaign(slug) {
	return readJson(campaignMetaPath(slug));
}

async function readFavorites() {
	if (!(await exists(FAVORITES_PATH))) return [];
	return readJson(FAVORITES_PATH);
}

async function writeFavorites(favorites) {
	await writeJson(FAVORITES_PATH, favorites);
}

async function listEntities(campaignSlug, type) {
	const entitiesDir = path.join(campaignDir(campaignSlug), type); // type: 'characters' or 'npc'
	await ensureDir(entitiesDir);
	const entries = await fs.readdir(entitiesDir, { withFileTypes: true });
	const result = [];

	for (const entry of entries) {
		if (entry.isDirectory()) {
			const infoPath = path.join(entitiesDir, entry.name, "info.json");
			if (await exists(infoPath)) {
				const data = await readJson(infoPath);
				result.push({ ...data, slug: entry.name });
			}
		}
	}
	return result;
}

async function readEntity(campaignSlug, type, entitySlug) {
	const infoPath = path.join(campaignDir(campaignSlug), type, entitySlug, "info.json");
	return readJson(infoPath);
}

async function writeEntity(campaignSlug, type, entitySlug, data) {
	const entityPath = path.join(campaignDir(campaignSlug), type, entitySlug);
	await ensureDir(entityPath);
	const infoPath = path.join(entityPath, "info.json");
	await writeJson(infoPath, {
		...data,
		slug: entitySlug,
		updatedAt: new Date().toISOString()
	});
	return data;
}

async function deleteEntity(campaignSlug, type, entitySlug) {
	const entityPath = path.join(campaignDir(campaignSlug), type, entitySlug);
	await fs.rm(entityPath, { recursive: true, force: true });
}

async function readSession(slug, fileName) {
	return readJson(sessionPath(slug, fileName));
}

async function listSessions(slug) {
	const sessionsDir = path.join(campaignDir(slug), "sessions");
	await ensureDir(sessionsDir);
	const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		if (!entry.name.endsWith(".json")) continue;
		if (entry.isFile()) {
			files.push(entry.name);
		} else if (entry.isSymbolicLink()) {
			const stats = await fs.stat(path.join(sessionsDir, entry.name)).catch(() => null);
			if (stats?.isFile()) {
				files.push(entry.name);
			}
		}
	}
	files.sort();

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
	return result.sort(
		(a, b) =>
			(a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name, "uk"),
	);
}

async function listCampaignsDetailed() {
	const slugs = await listCampaignSlugs();
	const campaignPromises = slugs.map(async (slug) => {
		try {
			const meta = await readCampaign(slug);
			const sessions = await listSessions(slug);
			return { ...meta, slug, sessionCount: sessions.length };
		} catch (error) {
			return null;
		}
	});
	const result = (await Promise.all(campaignPromises)).filter(Boolean);
	return result.sort(
		(a, b) =>
			(a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name, "uk"),
	);
}

async function exportCampaignBundle(slug) {
	const meta = await readCampaign(slug);
	const sessionFiles = await listSessions(slug);
	const sessions = await Promise.all(
		sessionFiles.map(async (s) => {
			const content = await readSession(slug, s.fileName);
			return { fileName: s.fileName, content };
		}),
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

async function ensureUniqueSessionFile(
	slug,
	desiredName,
	ignoreFileName = null,
) {
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
	const newMeta = {
		...meta,
		slug,
		createdAt: meta.createdAt || now,
		updatedAt: now,
	};
	await ensureDir(path.join(campaignDir(slug), "sessions"));
	await writeJson(campaignMetaPath(slug), newMeta);
	for (const session of sessions) {
		const fileName = await ensureUniqueSessionFile(slug, session.content.name);
		await writeJson(sessionPath(slug, fileName), {
			...session.content,
			updatedAt: now,
		});
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
	CAMPAIGNS_DIR,
	BESTIARY_DIR,
	SPELLS_DIR,
	createId,
	sanitizeName,
	campaignSlug,
	sessionFileName,
	campaignDir,
	characterDir,
	npcDir,
	campaignMetaPath,
	sessionPath,
	ensureDir,
	exists,
	readJson,
	writeJson,
	renameWithRetry,
	listEntities,
	readEntity,
	writeEntity,
	deleteEntity,
	readFavorites,
	writeFavorites,
	listCampaignSlugs,
	readCampaign,
	readSession,
	listSessions,
	listCampaignsDetailed,
	exportCampaignBundle,
	importCampaignBundle,
	ensureUniqueCampaignSlug,
	ensureUniqueSessionFile,
	makeDefaultSessionData,
	getBestiaryIndex,
	resolveMonster,
};
