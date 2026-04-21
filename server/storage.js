const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const CAMPAIGNS_DIR = path.join(DATA_DIR, "campaigns");
const BESTIARY_DIR = path.join(ROOT_DIR, "database", "bestiary");
const SPELLS_DIR = path.join(ROOT_DIR, "database", "spells");
const FAVORITES_PATH = path.join(DATA_DIR, "favorites.json");
const IMAGES_DIR = path.join(DATA_DIR, "images");

function todayString() {
	return new Date().toISOString().slice(0, 10);
}

function createId() {
	return crypto.randomUUID();
}

function sanitizeName(name) {
	const cleaned = String(name || "")
		.trim()
		.replace(/[<>:"/\\|?*]/g, "")
		.replace(/\.+$/g, "")
		.replace(/\s+/g, " ")
		.slice(0, 120);
	return [...cleaned]
		.filter((char) => char.charCodeAt(0) >= 32)
		.join("");
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

function campaignImagesDir(slug, category, subcategory = "") {
	const safeSlug = path.basename(String(slug || "general"));
	const safeCat = String(category || "attachments");
	const safeSub = String(subcategory || "");
	return path.join(IMAGES_DIR, safeSlug, safeCat, safeSub);
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
	} catch {
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
		} catch {
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
	const entities = {
		characters: await listEntities(slug, "characters"),
		npc: await listEntities(slug, "npc"),
	};
	return { meta, sessions, entities };
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

async function ensureUniqueEntitySlug(campaignSlugValue, type, baseSlug) {
	const normalizedBase =
		path.basename(String(baseSlug || "")) || `${type}-${Date.now()}`;
	let slug = normalizedBase;
	let counter = 2;
	while (true) {
		const infoPath = path.join(campaignDir(campaignSlugValue), type, slug, "info.json");
		if (!(await exists(infoPath))) return slug;
		slug = `${normalizedBase}-${counter}`;
		counter += 1;
	}
}

async function findCampaignSlugById(campaignId) {
	if (!campaignId) return null;
	const slugs = await listCampaignSlugs();
	for (const slug of slugs) {
		const metaPath = campaignMetaPath(slug);
		if (!(await exists(metaPath))) continue;
		const meta = await readJson(metaPath);
		if (String(meta.id) === String(campaignId)) {
			return slug;
		}
	}
	return null;
}

async function deleteCampaignData(slug) {
	if (!slug) return;
	await fs.rm(campaignDir(slug), { recursive: true, force: true });
	await fs.rm(path.join(IMAGES_DIR, path.basename(slug)), {
		recursive: true,
		force: true,
	});
}

async function clearAllCampaignData() {
	await fs.rm(CAMPAIGNS_DIR, { recursive: true, force: true });
	await fs.rm(IMAGES_DIR, { recursive: true, force: true });
	await ensureDir(CAMPAIGNS_DIR);
	await ensureDir(IMAGES_DIR);
}

function replaceImageSlugReferences(value, oldSlug, newSlug) {
	if (!value || !oldSlug || !newSlug || oldSlug === newSlug) return value;
	const oldSegment = `/api/images/${encodeURIComponent(oldSlug)}/`;
	const newSegment = `/api/images/${encodeURIComponent(newSlug)}/`;
	const serialized = JSON.stringify(value);
	if (!serialized.includes(oldSegment)) return value;
	return JSON.parse(serialized.split(oldSegment).join(newSegment));
}

async function importCampaignBundle(bundle, options = {}) {
	const { meta, sessions = [], entities = {} } = bundle;
	if (!meta || !meta.name) throw new Error("Невірний формат бандла");
	const sourceSlug = meta.slug || campaignSlug(meta.name);
	const forcedSlug = options.forcedSlug ? path.basename(options.forcedSlug) : null;
	const slug = forcedSlug
		? forcedSlug
		: await ensureUniqueCampaignSlug(campaignSlug(meta.name));

	if (forcedSlug && options.replaceExisting && (await exists(campaignDir(slug)))) {
		await deleteCampaignData(slug);
	}
	const now = new Date().toISOString();
	const newMeta = {
		...replaceImageSlugReferences(meta, sourceSlug, slug),
		slug,
		createdAt: meta.createdAt || now,
		updatedAt: now,
	};
	await ensureDir(path.join(campaignDir(slug), "sessions"));
	await writeJson(campaignMetaPath(slug), newMeta);

	for (const session of sessions) {
		const desiredName =
			session.fileName ||
			`${sanitizeName(session.content?.name) || todayString()}.json`;
		const fileName = await ensureUniqueSessionFile(slug, desiredName);
		const normalizedContent = replaceImageSlugReferences(
			session.content || {},
			sourceSlug,
			slug,
		);
		await writeJson(sessionPath(slug, fileName), {
			...normalizedContent,
			updatedAt: now,
		});
	}

	for (const type of ["characters", "npc"]) {
		const list = Array.isArray(entities[type]) ? entities[type] : [];
		for (const entity of list) {
			const desiredSlug =
				entity.slug ||
				campaignSlug(entity.firstName || entity.name || type);
			const entitySlug = await ensureUniqueEntitySlug(slug, type, desiredSlug);
			const normalizedEntity = replaceImageSlugReferences(
				entity,
				sourceSlug,
				slug,
			);
			await writeEntity(slug, type, entitySlug, {
				...normalizedEntity,
				slug: entitySlug,
			});
		}
	}

	return newMeta;
}

async function listCampaignImagesForArchive(slug) {
	const root = path.join(IMAGES_DIR, path.basename(String(slug || "")));
	if (!(await exists(root))) return [];

	const files = [];
	async function walk(dir) {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				await walk(fullPath);
				continue;
			}
			if (!entry.isFile()) continue;
			const relPath = path.relative(root, fullPath).split(path.sep).join("/");
			const buf = await fs.readFile(fullPath);
			files.push({
				relativePath: relPath,
				base64: buf.toString("base64"),
			});
		}
	}

	await walk(root);
	return files;
}

async function restoreCampaignImagesFromArchive(slug, files = []) {
	if (!Array.isArray(files) || files.length === 0) return;

	const root = path.join(IMAGES_DIR, path.basename(String(slug || "")));
	const resolvedRoot = path.resolve(root);

	for (const file of files) {
		const rel = String(file?.relativePath || "")
			.replace(/\\/g, "/")
			.replace(/^\/+/, "");
		if (!rel || !file?.base64) continue;

		const targetPath = path.resolve(root, rel);
		if (
			targetPath !== resolvedRoot &&
			!targetPath.startsWith(`${resolvedRoot}${path.sep}`)
		) {
			continue;
		}

		await ensureDir(path.dirname(targetPath));
		await fs.writeFile(targetPath, Buffer.from(file.base64, "base64"));
	}
}

async function exportCampaignArchiveBundle(slug) {
	return {
		bundle: await exportCampaignBundle(slug),
		images: await listCampaignImagesForArchive(slug),
	};
}

async function importCampaignArchiveBundle(archiveBundle) {
	const importedMeta = await importCampaignBundle(
		archiveBundle.bundle || archiveBundle,
	);
	await restoreCampaignImagesFromArchive(importedMeta.slug, archiveBundle.images || []);
	return importedMeta;
}

async function importCampaignArchiveBundleWithStrategy(
	archiveBundle,
	strategy = "append",
) {
	if (strategy === "replace_by_id") {
		const bundle = archiveBundle.bundle || archiveBundle;
		const campaignId = bundle?.meta?.id;
		const existingSlug = await findCampaignSlugById(campaignId);
		if (existingSlug) {
			const importedMeta = await importCampaignBundle(bundle, {
				forcedSlug: existingSlug,
				replaceExisting: true,
			});
			await restoreCampaignImagesFromArchive(
				importedMeta.slug,
				archiveBundle.images || [],
			);
			return importedMeta;
		}
	}
	return importCampaignArchiveBundle(archiveBundle);
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

async function listImages(slug, category, subcategory = "") {
	const sub = subcategory || ""; // Захист від null/undefined
	const dir = campaignImagesDir(slug, category, sub);
	if (!(await exists(dir))) return [];
	const entries = await fs.readdir(dir, { withFileTypes: true });
	return entries
		.filter((e) => e.isFile() && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(e.name))
		.map((e) => ({
			name: e.name,
			url: `/api/images/${encodeURIComponent(slug)}/${encodeURIComponent(category)}${sub ? "/" + encodeURIComponent(sub) : ""}/${encodeURIComponent(e.name)}`,
			path: path.join(category, sub, e.name)
		}));
}

async function listSubcategories(slug, category, subcategory = "") {
	const dir = campaignImagesDir(slug, category, subcategory);
	if (!(await exists(dir))) return [];
	const entries = await fs.readdir(dir, { withFileTypes: true });
	return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function updateAllImageReferences(moveResults) {
	if (!moveResults.length) return;
	
	const campaigns = await listCampaignSlugs();
	for (const slug of campaigns) {
		// 1. Оновлення мети кампанії
		const metaPath = campaignMetaPath(slug);
		if (await exists(metaPath)) {
			let meta = await readJson(metaPath);
			let changed = false;
			for (const res of moveResults) {
				if (meta.imageUrl === res.oldUrl) { meta.imageUrl = res.newUrl; changed = true; }
			}
			if (changed) await writeJson(metaPath, meta);
		}

		// 2. Оновлення персонажів та NPC
		for (const type of ["characters", "npc"]) {
			const entities = await listEntities(slug, type);
			for (const entity of entities) {
				let changed = false;
				for (const res of moveResults) {
					if (entity.imageUrl === res.oldUrl) { entity.imageUrl = res.newUrl; changed = true; }
				}
				if (changed) {
					await writeEntity(slug, type, entity.slug, entity);
				}
			}
		}

		// 3. Оновлення сесій (тексти сцен, опис)
		const sessions = await listSessions(slug);
		for (const s of sessions) {
			const sPath = sessionPath(slug, s.fileName);
			let sessionData = await readJson(sPath);
			let json = JSON.stringify(sessionData);
			let changed = false;
			for (const res of moveResults) {
				if (json.includes(res.oldUrl)) {
					json = json.split(res.oldUrl).join(res.newUrl);
					changed = true;
				}
			}
			if (changed) await writeJson(sPath, JSON.parse(json));
		}
	}
}

async function moveImages(items, src, dest) {
	const sSlug = decodeURIComponent(src.slug);
	const dSlug = decodeURIComponent(dest.slug);
	const sSub = src.subcategory || "";
	const dSub = dest.subcategory || "";

	const srcDir = campaignImagesDir(sSlug, src.category, sSub);
	const destDir = campaignImagesDir(dSlug, dest.category, dSub);

	if (srcDir === destDir) return [];
	await ensureDir(destDir);

	const results = [];
	for (const name of items) {
		const oldPath = path.join(srcDir, name);
		const newPath = path.join(destDir, name);

		if (await exists(oldPath)) {
			const isDir = (await fs.stat(oldPath)).isDirectory();
			
			// Збираємо список файлів для оновлення посилань
			const filesToTrack = [];
			if (isDir) {
				const walk = async (dir, sub = "") => {
					const entries = await fs.readdir(dir, { withFileTypes: true });
					for (const e of entries) {
						if (e.isFile()) filesToTrack.push(path.join(sub, e.name));
						else if (e.isDirectory()) await walk(path.join(dir, e.name), path.join(sub, e.name));
					}
				};
				await walk(oldPath);
			} else {
				filesToTrack.push("");
			}

			await renameWithRetry(oldPath, newPath);

			for (const relPath of filesToTrack) {
				const fileName = isDir ? relPath : name;
				const oldSub = sSub ? (isDir ? path.join(sSub, name, relPath) : sSub) : (isDir ? path.join(name, relPath) : "");
				const newSub = dSub ? (isDir ? path.join(dSub, name, relPath) : dSub) : (isDir ? path.join(name, relPath) : "");
				
				results.push({
					oldUrl: `/api/images/${encodeURIComponent(sSlug)}/${encodeURIComponent(src.category)}${oldSub ? "/" + oldSub.split(path.sep).join("/") : ""}${isDir ? "" : "/" + encodeURIComponent(fileName)}`,
					newUrl: `/api/images/${encodeURIComponent(dSlug)}/${encodeURIComponent(dest.category)}${newSub ? "/" + newSub.split(path.sep).join("/") : ""}${isDir ? "" : "/" + encodeURIComponent(fileName)}`
				});
			}
		}
	}
	
	await updateAllImageReferences(results);
	return results;
}

async function renameImage(slug, category, subcategory, oldName, newName) {
	const dir = campaignImagesDir(slug, category, subcategory);
	const oldPath = path.join(dir, oldName);
	const newPath = path.join(dir, newName);

	if (!(await exists(oldPath))) throw new Error(`Файл '${oldName}' не знайдено.`);
	if (oldPath !== newPath && (await exists(newPath))) throw new Error(`Файл '${newName}' вже існує.`);

	await renameWithRetry(oldPath, newPath);

	const sSub = subcategory || "";
	const oldUrl = `/api/images/${encodeURIComponent(slug)}/${encodeURIComponent(category)}${sSub ? "/" + sSub.split(path.sep).join("/") : ""}/${encodeURIComponent(oldName)}`;
	const newUrl = `/api/images/${encodeURIComponent(slug)}/${encodeURIComponent(category)}${sSub ? "/" + sSub.split(path.sep).join("/") : ""}/${encodeURIComponent(newName)}`;

	await updateAllImageReferences([{ oldUrl, newUrl }]);
	return { oldUrl, newUrl };
}

async function deleteImages(items, src) {
	const dir = campaignImagesDir(src.slug, src.category, src.subcategory);
	for (const name of items) {
		const target = path.join(dir, name);
		await fs.rm(target, { recursive: true, force: true });
	}
}

async function renameSubcategory(slug, category, oldName, newName) {
	const root = path.join(IMAGES_DIR, path.basename(slug), category);
	const oldPath = path.join(root, oldName);
	const newPath = path.join(root, newName);

	if (!(await exists(oldPath))) {
		throw new Error(`Підкатегорія '${oldName}' не знайдена.`);
	}
	if (oldPath !== newPath && await exists(newPath)) {
		throw new Error(`Підкатегорія '${newName}' вже існує.`);
	}
	await fs.rename(oldPath, newPath);
}

module.exports = {
	CAMPAIGNS_DIR,
	BESTIARY_DIR,
	SPELLS_DIR,
	IMAGES_DIR,
	createId,
	sanitizeName,
	campaignSlug,
	sessionFileName,
	campaignDir,
	campaignImagesDir,
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
	exportCampaignArchiveBundle,
	importCampaignBundle,
	importCampaignArchiveBundle,
	importCampaignArchiveBundleWithStrategy,
	findCampaignSlugById,
	deleteCampaignData,
	clearAllCampaignData,
	ensureUniqueCampaignSlug,
	ensureUniqueSessionFile,
	makeDefaultSessionData,
	getBestiaryIndex,
	resolveMonster,
	listImages,
	listSubcategories,
	moveImages,
	renameSubcategory,
	renameImage,
	deleteImages,
};
