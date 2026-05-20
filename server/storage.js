const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const CAMPAIGNS_DIR = path.join(DATA_DIR, "campaigns");
const BESTIARY_DIR = path.join(ROOT_DIR, "database", "bestiary");
const CUSTOM_BESTIARY_SOURCE = "CUSTOM";
const CUSTOM_BESTIARY_PATH = path.join(DATA_DIR, "custom-bestiary.json");
const SPELLS_DIR = path.join(ROOT_DIR, "database", "spells");
const FAVORITES_PATH = path.join(DATA_DIR, "favorites.json");
const IMAGES_DIR = path.join(DATA_DIR, "images");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");
const ENTITY_TYPES = Object.freeze(["characters", "npc", "locations"]);

const DEFAULT_APP_SETTINGS = Object.freeze({
	language: "uk",
	theme: "light",
	encounterViewMode: "grid",
	encounterGridColumns: 3,
	simplifiedNotes: false,
	aiBasePrompt: "",
	campaignAiBasePrompts: {},
	autoApplyAiChanges: false,
});

function todayString() {
	return new Date().toISOString().slice(0, 10);
}

function createId() {
	return crypto.randomUUID();
}

function hasOwn(value, key) {
	return Boolean(
		value &&
			typeof value === "object" &&
			Object.prototype.hasOwnProperty.call(value, key),
	);
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

function campaignImagesDir(slug, category, subcategory = "") {
	const safeSlug = path.basename(String(slug || "general"));
	const safeCat = String(category || "attachments");
	const safeSub = String(subcategory || "");
	return path.join(IMAGES_DIR, safeSlug, safeCat, safeSub);
}

function characterDir(campaignSlug, charSlug) {
	return path.join(
		campaignDir(campaignSlug),
		"characters",
		path.basename(charSlug),
	);
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

function stripUpdatedAtFields(value) {
	if (Array.isArray(value)) {
		return value.map(stripUpdatedAtFields);
	}
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value)
			.filter(([key]) => key !== "updatedAt")
			.map(([key, entryValue]) => [key, stripUpdatedAtFields(entryValue)]),
	);
}

async function readJson(filePath) {
	const raw = await fs.readFile(filePath, "utf8");
	return stripUpdatedAtFields(JSON.parse(raw));
}

async function writeJson(filePath, value) {
	await ensureDir(path.dirname(filePath));
	const content = JSON.stringify(stripUpdatedAtFields(value), null, 2);
	const tempPath = path.join(
		path.dirname(filePath),
		`.${path.basename(filePath)}.${process.pid}.${Date.now()}.${crypto
			.randomBytes(6)
			.toString("hex")}.tmp`,
	);
	try {
		await fs.writeFile(tempPath, content, "utf8");
		await fs.rename(tempPath, filePath);
	} catch (error) {
		await fs.rm(tempPath, { force: true }).catch(() => {});
		throw error;
	}
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
			const stats = await fs
				.stat(path.join(CAMPAIGNS_DIR, entry.name))
				.catch(() => null);
			if (stats?.isDirectory()) {
				slugs.push(entry.name);
			}
		}
	}

	return slugs;
}

async function getBestiaryIndex() {
	const customMonsters = await readCustomBestiaryMonsters();
	if (!(await exists(BESTIARY_DIR))) {
		const customIndex = new Map();
		for (const m of customMonsters) {
			if (!m.name) continue;
			const monsterSource = String(m.source || "CUSTOM").toUpperCase();
			const key = `${m.name.trim().toLowerCase()}|${monsterSource}`;
			customIndex.set(key, { ...m, source: monsterSource });
		}
		return customIndex;
	}

	const allPath = path.join(BESTIARY_DIR, "all.json");
	if (await exists(allPath)) {
		const data = await readJson(allPath);
		const monsters = Array.isArray(data)
			? data
			: data.monster || data.monsters || data.results || [];
		const index = new Map();
		for (const m of monsters) {
			if (!m.name) continue;
			const monsterSource = String(m.source || "").toUpperCase();
			const key = `${m.name.trim().toLowerCase()}|${monsterSource}`;
			index.set(key, { ...m, source: monsterSource });
		}
		for (const m of customMonsters) {
			if (!m.name) continue;
			const monsterSource = String(m.source || "CUSTOM").toUpperCase();
			const key = `${m.name.trim().toLowerCase()}|${monsterSource}`;
			index.set(key, { ...m, source: monsterSource });
		}
		return index;
	}

	const entries = await fs.readdir(BESTIARY_DIR, { withFileTypes: true });
	const files = entries.filter(
		(e) =>
			e.isFile() &&
			e.name.endsWith(".json") &&
			e.name !== "all.json" &&
			e.name !== "index.json" &&
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
	for (const m of customMonsters) {
		if (!m.name) continue;
		const monsterSource = String(m.source || "CUSTOM").toUpperCase();
		const key = `${m.name.trim().toLowerCase()}|${monsterSource}`;
		index.set(key, { ...m, source: monsterSource });
	}
	return index;
}

async function readCustomBestiary() {
	if (!(await exists(CUSTOM_BESTIARY_PATH))) return { monster: [] };
	const data = await readJson(CUSTOM_BESTIARY_PATH);
	const monsters = Array.isArray(data)
		? data
		: data.monster || data.monsters || data.results || [];
	return {
		...(data && !Array.isArray(data) ? data : {}),
		monster: Array.isArray(monsters)
			? monsters.map((monster) => ({
					...monster,
					source: CUSTOM_BESTIARY_SOURCE,
				}))
			: [],
	};
}

async function readCustomBestiaryMonsters() {
	return (await readCustomBestiary()).monster;
}

function calculateDiceFormulaAverage(input) {
	const clean = String(input || "")
		.toLowerCase()
		.replace(/\s+/g, "");
	if (!clean) return null;

	const parts = clean.replace(/-/g, "+-").split("+").filter(Boolean);
	if (parts.length === 0) return null;

	let average = 0;
	for (const part of parts) {
		const dieMatch = part.match(/^(\d+)?d(\d+)([hl]\d+)?$/i);
		if (dieMatch) {
			const count = Number.parseInt(dieMatch[1], 10) || 1;
			const sides = Number.parseInt(dieMatch[2], 10);
			const keepSuffix = dieMatch[3];
			if (!Number.isFinite(count) || !Number.isFinite(sides) || sides < 1) {
				return null;
			}
			const keepCount = keepSuffix
				? Math.min(Number.parseInt(keepSuffix.slice(1), 10), count)
				: count;
			if (!Number.isFinite(keepCount) || keepCount < 0) return null;
			average += keepCount * ((sides + 1) / 2);
			continue;
		}

		if (/^[+-]?\d+$/.test(part)) {
			average += Number.parseInt(part, 10);
			continue;
		}

		return null;
	}

	return Math.max(1, Math.floor(average));
}

function stripMentionBrackets(value) {
	if (typeof value === "string") {
		return value.replace(/\[([^[\]]+)\]/g, "$1");
	}
	if (Array.isArray(value)) {
		return value.map(stripMentionBrackets);
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, entryValue]) => [
				key,
				stripMentionBrackets(entryValue),
			]),
		);
	}
	return value;
}

function normalizeCustomBestiaryEntryList(value) {
	return (Array.isArray(value) ? value : [])
		.map((entry) => {
			if (typeof entry === "string") {
				const text = entry.trim();
				return text ? { name: "", entries: [text] } : null;
			}
			if (!entry || typeof entry !== "object") return null;
			const entries = Array.isArray(entry.entries)
				? entry.entries
				: entry.text || entry.description || entry.content
					? [String(entry.text || entry.description || entry.content)]
					: [];
			return {
				...entry,
				name: String(entry.name || entry.title || "").trim(),
				entries,
			};
		})
		.filter((entry) => entry && entry.entries.length > 0);
}

function normalizeCustomBestiaryMonster(monster) {
	const next = stripMentionBrackets({
		...monster,
		name: String(monster.name || monster.title || "").trim(),
		source: CUSTOM_BESTIARY_SOURCE,
	});

	if (next.hp && typeof next.hp === "object" && !Array.isArray(next.hp)) {
		next.hp = { ...next.hp };
		const average = calculateDiceFormulaAverage(next.hp.formula);
		if (average !== null) {
			next.hp.average = average;
		} else if (hasOwn(next.hp, "average")) {
			const parsed = Number.parseInt(String(next.hp.average), 10);
			next.hp.average = Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
		}
	}

	if (next.spellcasting && !Array.isArray(next.spellcasting)) {
		next.spellcasting = [next.spellcasting];
	}

	for (const key of ["trait", "action", "bonus", "reaction", "legendary"]) {
		if (next[key] !== undefined) {
			const entries = normalizeCustomBestiaryEntryList(next[key]);
			if (entries.length > 0) next[key] = entries;
			else delete next[key];
		}
	}

	return next;
}

async function writeCustomBestiaryMonsters(monsters) {
	const normalized = (Array.isArray(monsters) ? monsters : [])
		.filter((monster) => monster && typeof monster === "object")
		.map(normalizeCustomBestiaryMonster)
		.filter((monster) => monster.name)
		.sort((a, b) => String(a.name).localeCompare(String(b.name), "uk"));
	await writeJson(CUSTOM_BESTIARY_PATH, {
		_meta: {
			sources: [
				{
					json: CUSTOM_BESTIARY_SOURCE,
					abbreviation: CUSTOM_BESTIARY_SOURCE,
					full: "Custom",
				},
			],
		},
		monster: normalized,
	});
	return normalized;
}

async function upsertCustomBestiaryMonsters(monsters) {
	const existing = await readCustomBestiaryMonsters();
	const byName = new Map(
		existing.map((monster) => [
			String(monster.name || "").trim().toLowerCase(),
			{ ...monster, source: CUSTOM_BESTIARY_SOURCE },
		]),
	);
	for (const monster of Array.isArray(monsters) ? monsters : []) {
		if (!monster?.name) continue;
		byName.set(String(monster.name).trim().toLowerCase(), {
			...monster,
			source: CUSTOM_BESTIARY_SOURCE,
		});
	}
	return writeCustomBestiaryMonsters([...byName.values()]);
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

function normalizeAiChangeResource(raw = {}) {
	if (!raw || typeof raw !== "object") return null;
	const kind = ["campaign", "session", "entity", "custom-bestiary"].includes(raw.kind)
		? raw.kind
		: null;
	if (!kind) return null;

	const before = hasOwn(raw, "before") ? raw.before : null;
	const after = hasOwn(raw, "after") ? raw.after : null;
	if (before === null && after === null) return null;

	const resource = {
		id: String(raw.id || createId()),
		kind,
		campaign: raw.campaign || null,
		label: String(raw.label || raw.id || kind),
		before,
		after,
		applyState: ["applied", "undone"].includes(raw.applyState)
			? raw.applyState
			: null,
		appliedAt: raw.appliedAt || null,
	};

	if (kind === "session") {
		resource.fileName = raw.fileName || null;
	} else if (kind === "entity") {
		resource.type = raw.type || null;
		resource.slug = raw.slug || null;
	}

	return resource;
}

function normalizeAiChanges(raw = {}) {
	if (!raw || typeof raw !== "object") {
		return { resources: [], summary: {} };
	}
	const resources = Array.isArray(raw.resources)
		? raw.resources.map(normalizeAiChangeResource).filter(Boolean)
		: [];
	return {
		resources,
		summary:
			raw.summary && typeof raw.summary === "object" ? raw.summary : {},
	};
}

function normalizeAiResponse(raw = {}) {
	const text = typeof raw.text === "string" ? raw.text : "";
	if (!text.trim()) return null;
	const rawRequest =
		raw.request && typeof raw.request === "object" ? raw.request : {};
	const userInstructions =
		typeof rawRequest.userInstructions === "string"
			? rawRequest.userInstructions
			: typeof raw.userInstructions === "string"
				? raw.userInstructions
				: "";
	const request = {
		userInstructions,
		options:
			rawRequest.options && typeof rawRequest.options === "object"
				? rawRequest.options
				: {},
		optionsSummary:
			typeof rawRequest.optionsSummary === "string"
				? rawRequest.optionsSummary
				: "",
		context:
			rawRequest.context && typeof rawRequest.context === "object"
				? rawRequest.context
				: {},
		contextSummary:
			typeof rawRequest.contextSummary === "string"
				? rawRequest.contextSummary
				: "",
	};
	const changes = normalizeAiChanges(raw.changes);
	const applyState = ["applied", "undone", "draft"].includes(raw.applyState)
		? raw.applyState
		: null;
	const status = raw.status === "failed" ? "failed" : "completed";

	return {
		id: String(raw.id || createId()),
		text,
		status,
		path:
			raw.path && typeof raw.path === "object"
				? {
						campaign: raw.path.campaign || null,
						session: raw.path.session || null,
						encounter: raw.path.encounter || null,
					}
				: null,
		type: raw.type || null,
		modelName: raw.modelName || null,
		language: raw.language || null,
		userInstructions,
		request,
		changes,
		applyState,
		appliedAt: raw.appliedAt || null,
		error:
			raw.error && typeof raw.error === "object"
				? {
						message: String(raw.error.message || ""),
						status: raw.error.status || null,
					}
				: null,
		retryPayload:
			raw.retryPayload && typeof raw.retryPayload === "object"
				? raw.retryPayload
				: null,
		createdAt: raw.createdAt || new Date().toISOString(),
	};
}

function normalizeCampaignSlug(slug) {
	const normalized = path.basename(String(slug || "").trim());
	return normalized || null;
}

async function readAiResponses(campaignSlugValue) {
	const slug = normalizeCampaignSlug(campaignSlugValue);
	if (!slug) return [];
	const responsesPath = campaignAiResponsesPath(slug);
	if (!(await exists(responsesPath))) return [];
	try {
		const saved = await readJson(responsesPath);
		const list = Array.isArray(saved) ? saved : saved?.responses || [];
		return list
			.map(normalizeAiResponse)
			.filter(Boolean)
			.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
	} catch {
		return [];
	}
}

async function writeAiResponses(campaignSlugValue, responses) {
	const slug = normalizeCampaignSlug(campaignSlugValue);
	if (!slug) return [];
	const normalized = (Array.isArray(responses) ? responses : [])
		.map(normalizeAiResponse)
		.filter(Boolean)
		.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
	await writeJson(campaignAiResponsesPath(slug), normalized);
	return normalized;
}

async function addAiResponse(payload) {
	const campaignSlugValue = payload?.path?.campaign;
	const responses = await readAiResponses(campaignSlugValue);
	const entry = normalizeAiResponse({
		...payload,
		id: createId(),
		createdAt: new Date().toISOString(),
	});
	if (!entry) {
		throw new Error("AI response text is required.");
	}
	await writeAiResponses(campaignSlugValue, [entry, ...responses]);
	return entry;
}

async function getAiResponse(campaignSlugValue, id) {
	const responses = await readAiResponses(campaignSlugValue);
	return responses.find((entry) => entry.id === String(id)) || null;
}

async function updateAiResponse(campaignSlugValue, id, patch = {}) {
	const responses = await readAiResponses(campaignSlugValue);
	let updatedEntry = null;
	const next = responses.map((entry) => {
		if (entry.id !== String(id)) return entry;
		updatedEntry = normalizeAiResponse({
			...entry,
			...patch,
			id: entry.id,
			createdAt: entry.createdAt,
		});
		return updatedEntry || entry;
	});
	await writeAiResponses(campaignSlugValue, next);
	return updatedEntry;
}

async function deleteAiResponse(campaignSlugValue, id) {
	const responses = await readAiResponses(campaignSlugValue);
	const next = responses.filter((entry) => entry.id !== String(id));
	await writeAiResponses(campaignSlugValue, next);
	return next;
}

async function clearAiResponses(campaignSlugValue) {
	await writeAiResponses(campaignSlugValue, []);
	return [];
}

function normalizeSettings(settings = {}) {
	const encounterGridColumns = Number.parseInt(settings.encounterGridColumns, 10);
	const campaignAiBasePrompts =
		settings.campaignAiBasePrompts &&
		typeof settings.campaignAiBasePrompts === "object" &&
		!Array.isArray(settings.campaignAiBasePrompts)
			? Object.fromEntries(
					Object.entries(settings.campaignAiBasePrompts)
						.map(([slug, prompt]) => [
							String(slug || "").trim(),
							String(prompt || ""),
						])
						.filter(([slug]) => slug),
				)
			: {};

	return {
		language: settings.language === "en" ? "en" : "uk",
		theme: settings.theme === "dark" ? "dark" : "light",
		encounterViewMode:
			settings.encounterViewMode === "grid" ? "grid" : "single",
		encounterGridColumns: Math.min(
			4,
			Math.max(
				1,
				Number.isFinite(encounterGridColumns) ? encounterGridColumns : 2,
			),
		),
		simplifiedNotes: Boolean(settings.simplifiedNotes),
		aiBasePrompt: String(settings.aiBasePrompt || ""),
		campaignAiBasePrompts,
		autoApplyAiChanges: settings.autoApplyAiChanges !== false,
	};
}

async function readSettings() {
	if (!(await exists(SETTINGS_PATH))) {
		await writeJson(SETTINGS_PATH, DEFAULT_APP_SETTINGS);
		return { ...DEFAULT_APP_SETTINGS };
	}

	try {
		const saved = await readJson(SETTINGS_PATH);
		const normalized = normalizeSettings(saved);
		if (JSON.stringify(saved) !== JSON.stringify(normalized)) {
			await writeJson(SETTINGS_PATH, normalized);
		}
		return normalized;
	} catch {
		await writeJson(SETTINGS_PATH, DEFAULT_APP_SETTINGS);
		return { ...DEFAULT_APP_SETTINGS };
	}
}

async function updateSettings(patch = {}) {
	const current = await readSettings();
	const next = normalizeSettings({
		...current,
		...patch,
	});
	await writeJson(SETTINGS_PATH, next);
	return next;
}

async function listEntities(campaignSlug, type) {
	const entitiesDir = path.join(campaignDir(campaignSlug), type);
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
	return result.sort((a, b) => {
		const aOrder = Number.isFinite(Number(a.order)) ? Number(a.order) : 0;
		const bOrder = Number.isFinite(Number(b.order)) ? Number(b.order) : 0;
		if (aOrder !== bOrder) return aOrder - bOrder;

		const aName = String(
			a.name || `${a.firstName || ""} ${a.lastName || ""}`.trim() || a.slug || "",
		);
		const bName = String(
			b.name || `${b.firstName || ""} ${b.lastName || ""}`.trim() || b.slug || "",
		);
		return aName.localeCompare(bName, "uk");
	});
}

async function readEntity(campaignSlug, type, entitySlug) {
	const infoPath = path.join(
		campaignDir(campaignSlug),
		type,
		entitySlug,
		"info.json",
	);
	return readJson(infoPath);
}

async function writeEntity(campaignSlug, type, entitySlug, data) {
	const entityPath = path.join(campaignDir(campaignSlug), type, entitySlug);
	await ensureDir(entityPath);
	const infoPath = path.join(entityPath, "info.json");
	const payload = {
		...data,
		slug: entitySlug,
	};
	await writeJson(infoPath, payload);
	return payload;
}

async function deleteEntity(campaignSlug, type, entitySlug) {
	const entityPath = path.join(campaignDir(campaignSlug), type, entitySlug);
	await fs.rm(entityPath, { recursive: true, force: true });
}

function normalizeMentionName(value) {
	return String(value || "")
		.trim()
		.replace(/\s+/g, " ")
		.toLowerCase();
}

function replaceBracketedMentionNames(value, oldName, newName) {
	if (typeof value !== "string") return value;
	const normalizedOldName = normalizeMentionName(oldName);
	const nextName = String(newName || "").trim().replace(/\s+/g, " ");
	if (!normalizedOldName || !nextName) return value;

	return value.replace(/\[([^[\]]+)\]/g, (fullMatch, rawName) => {
		if (normalizeMentionName(rawName) !== normalizedOldName) return fullMatch;
		return `[${nextName}]`;
	});
}

function replaceMentionsInValue(value, oldName, newName) {
	if (typeof value === "string") {
		return replaceBracketedMentionNames(value, oldName, newName);
	}
	if (Array.isArray(value)) {
		return value.map((item) => replaceMentionsInValue(item, oldName, newName));
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				replaceMentionsInValue(item, oldName, newName),
			]),
		);
	}
	return value;
}

async function updateCampaignMentionReferences(campaignSlug, oldName, newName) {
	if (
		!normalizeMentionName(oldName) ||
		!String(newName || "").trim() ||
		normalizeMentionName(oldName) === normalizeMentionName(newName)
	) {
		return;
	}

	const metaPath = campaignMetaPath(campaignSlug);
	if (await exists(metaPath)) {
		const meta = await readJson(metaPath);
		const nextMeta = replaceMentionsInValue(meta, oldName, newName);
		if (JSON.stringify(nextMeta) !== JSON.stringify(meta)) {
			await writeJson(metaPath, nextMeta);
		}
	}

	for (const type of ENTITY_TYPES) {
		const entities = await listEntities(campaignSlug, type);
		for (const entity of entities) {
			const nextEntity = replaceMentionsInValue(entity, oldName, newName);
			if (JSON.stringify(nextEntity) !== JSON.stringify(entity)) {
				await writeEntity(campaignSlug, type, entity.slug, nextEntity);
			}
		}
	}

	const sessions = await listSessions(campaignSlug);
	for (const session of sessions) {
		const filePath = sessionPath(campaignSlug, session.fileName);
		const sessionData = await readJson(filePath);
		const nextSessionData = replaceMentionsInValue(sessionData, oldName, newName);
		if (JSON.stringify(nextSessionData) !== JSON.stringify(sessionData)) {
			await writeJson(filePath, nextSessionData);
		}
	}
}

async function moveEntity(campaignSlug, sourceType, entitySlug, targetType) {
	if (sourceType === targetType) {
		return readEntity(campaignSlug, sourceType, entitySlug);
	}
	if (!ENTITY_TYPES.includes(sourceType) || !ENTITY_TYPES.includes(targetType)) {
		throw new Error("Invalid entity type");
	}

	const safeSlug = path.basename(entitySlug);
	const sourcePath = path.join(campaignDir(campaignSlug), sourceType, safeSlug);
	const current = await readEntity(campaignSlug, sourceType, safeSlug);
	const targetSlug = await ensureUniqueEntitySlug(
		campaignSlug,
		targetType,
		safeSlug,
	);
	const targetPath = path.join(campaignDir(campaignSlug), targetType, targetSlug);

	await ensureDir(path.dirname(targetPath));
	await fs.rename(sourcePath, targetPath);
	return writeEntity(campaignSlug, targetType, targetSlug, {
		...current,
		slug: targetSlug,
	});
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
			const stats = await fs
				.stat(path.join(sessionsDir, entry.name))
				.catch(() => null);
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
			order: data.order || 0,
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
	const entities = Object.fromEntries(
		await Promise.all(
			ENTITY_TYPES.map(async (type) => [type, await listEntities(slug, type)]),
		),
	);
	const aiResponses = await readAiResponses(slug);
	return { meta, sessions, entities, aiResponses };
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
		const infoPath = path.join(
			campaignDir(campaignSlugValue),
			type,
			slug,
			"info.json",
		);
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

function imageUrlFromParts(slug, relParts) {
	const [category, ...rest] = relParts;
	const fileName = rest.pop();
	const subcategory = rest.join("/");
	return `/api/images/${encodeURIComponent(slug)}/${encodeURIComponent(category)}${subcategory ? "/" + encodeURIComponent(subcategory) : ""}/${encodeURIComponent(fileName)}`;
}

async function ensureUniqueImagePath(filePath) {
	if (!(await exists(filePath))) return filePath;

	const parsed = path.parse(filePath);
	let counter = 2;
	while (true) {
		const candidate = path.join(
			parsed.dir,
			`${parsed.name}-${counter}${parsed.ext}`,
		);
		if (!(await exists(candidate))) return candidate;
		counter += 1;
	}
}

async function moveCampaignImagesToGeneral(slug) {
	const sourceSlug = path.basename(String(slug || ""));
	if (!sourceSlug || sourceSlug === "general") return [];

	const sourceRoot = path.join(IMAGES_DIR, sourceSlug);
	if (!(await exists(sourceRoot))) return [];

	const resolvedSourceRoot = path.resolve(sourceRoot);
	const results = [];

	async function walk(dir) {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const oldPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				await walk(oldPath);
				continue;
			}
			if (!entry.isFile()) continue;

			const relPath = path.relative(sourceRoot, oldPath);
			if (!relPath || relPath.startsWith("..")) continue;

			const relParts = relPath.split(path.sep);
			if (relParts.length < 2) continue;
			const destDir = path.join(IMAGES_DIR, "general", ...relParts.slice(0, -1));
			await ensureDir(destDir);

			const newPath = await ensureUniqueImagePath(
				path.join(destDir, relParts.at(-1)),
			);
			await renameWithRetry(oldPath, newPath);

			const oldParts = path
				.relative(resolvedSourceRoot, oldPath)
				.split(path.sep)
				.filter(Boolean);
			const newParts = path
				.relative(path.join(IMAGES_DIR, "general"), newPath)
				.split(path.sep)
				.filter(Boolean);

			results.push({
				oldUrl: imageUrlFromParts(sourceSlug, oldParts),
				newUrl: imageUrlFromParts("general", newParts),
			});
		}
	}

	await walk(sourceRoot);
	await fs.rm(sourceRoot, { recursive: true, force: true });
	await updateAllImageReferences(results);
	return results;
}

async function campaignHasImages(slug) {
	const safeSlug = path.basename(String(slug || ""));
	if (!safeSlug) return false;

	const root = path.join(IMAGES_DIR, safeSlug);
	if (!(await exists(root))) return false;

	async function walk(dir) {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isFile()) return true;
			if (entry.isDirectory() && (await walk(fullPath))) return true;
		}
		return false;
	}

	return walk(root);
}

async function deleteCampaignData(slug, options = {}) {
	if (!slug) return;
	if (options.moveImagesToGeneral) {
		await moveCampaignImagesToGeneral(slug);
	}
	await fs.rm(campaignDir(slug), { recursive: true, force: true });
	if (!options.moveImagesToGeneral) {
		await fs.rm(path.join(IMAGES_DIR, path.basename(slug)), {
			recursive: true,
			force: true,
		});
	}
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

function replaceCampaignSlugFields(value, oldSlug, newSlug) {
	if (!value || !oldSlug || !newSlug || oldSlug === newSlug) return value;
	if (Array.isArray(value)) {
		return value.map((item) => replaceCampaignSlugFields(item, oldSlug, newSlug));
	}
	if (typeof value !== "object") return value;

	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => {
			const shouldReplace =
				["slug", "campaign"].includes(key) && item === oldSlug;
			return [
				key,
				shouldReplace
					? newSlug
					: replaceCampaignSlugFields(item, oldSlug, newSlug),
			];
		}),
	);
}

function normalizeImportedAiResponse(entry, sourceSlug, slug) {
	const withImageRefs = replaceImageSlugReferences(entry, sourceSlug, slug);
	const withCampaignRefs = replaceCampaignSlugFields(
		withImageRefs,
		sourceSlug,
		slug,
	);
	return {
		...withCampaignRefs,
		path:
			withCampaignRefs?.path && typeof withCampaignRefs.path === "object"
				? { ...withCampaignRefs.path, campaign: slug }
				: { campaign: slug, session: null, encounter: null },
		changes: {
			...(withCampaignRefs?.changes || {}),
			resources: Array.isArray(withCampaignRefs?.changes?.resources)
				? withCampaignRefs.changes.resources.map((resource) => ({
						...resource,
						campaign: slug,
						label:
							typeof resource.label === "string"
								? resource.label.replace(sourceSlug, slug)
								: resource.label,
					}))
				: [],
		},
	};
}

async function importCampaignBundle(bundle, options = {}) {
	const { meta, sessions = [], entities = {}, aiResponses = [] } = bundle;
	if (!meta || !meta.name) throw new Error("Невірний формат бандла");
	const sourceSlug = meta.slug || campaignSlug(meta.name);
	const forcedSlug = options.forcedSlug
		? path.basename(options.forcedSlug)
		: null;
	const slug = forcedSlug
		? forcedSlug
		: await ensureUniqueCampaignSlug(campaignSlug(meta.name));

	if (
		forcedSlug &&
		options.replaceExisting &&
		(await exists(campaignDir(slug)))
	) {
		await deleteCampaignData(slug);
	}
	const now = new Date().toISOString();
	const newMeta = {
		...replaceImageSlugReferences(meta, sourceSlug, slug),
		slug,
		createdAt: meta.createdAt || now,
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
		await writeJson(sessionPath(slug, fileName), normalizedContent);
	}

	for (const type of ENTITY_TYPES) {
		const list = Array.isArray(entities[type]) ? entities[type] : [];
		for (const entity of list) {
			const desiredSlug =
				entity.slug || campaignSlug(entity.firstName || entity.name || type);
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

	if (Array.isArray(aiResponses) && aiResponses.length > 0) {
		await writeAiResponses(
			slug,
			aiResponses.map((entry) =>
				normalizeImportedAiResponse(entry, sourceSlug, slug),
			),
		);
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

function normalizePartialArchiveSections(sections = []) {
	const allowed = new Set([
		"sessions",
		"npc",
		"locations",
		"customMonsters",
		"images",
		"aiHistory",
	]);
	const selected = (Array.isArray(sections) ? sections : String(sections).split(","))
		.map((section) => String(section || "").trim())
		.filter((section) => allowed.has(section));
	return [...new Set(selected)];
}

async function exportCampaignPartialArchiveBundle(slug, sections = []) {
	const selected = normalizePartialArchiveSections(sections);
	const meta = await readCampaign(slug);
	const bundle = { meta, sessions: [], entities: {}, aiResponses: [] };

	if (selected.includes("sessions")) {
		const sessionFiles = await listSessions(slug);
		bundle.sessions = await Promise.all(
			sessionFiles.map(async (session) => ({
				fileName: session.fileName,
				content: await readSession(slug, session.fileName),
			})),
		);
	}

	if (selected.includes("npc")) {
		bundle.entities.npc = await listEntities(slug, "npc");
	}
	if (selected.includes("locations")) {
		bundle.entities.locations = await listEntities(slug, "locations");
	}
	if (selected.includes("aiHistory")) {
		bundle.aiResponses = await readAiResponses(slug);
	}

	return {
		version: 2,
		scope: "campaign-partial",
		sourceSlug: slug,
		sourceName: meta.name,
		sections: selected,
		bundle,
		customMonsters: selected.includes("customMonsters")
			? await readCustomBestiaryMonsters()
			: [],
		images: selected.includes("images")
			? await listCampaignImagesForArchive(slug)
			: [],
	};
}

async function importCampaignPartialArchiveBundle(targetSlug, archiveBundle) {
	const target = path.basename(String(targetSlug || ""));
	if (!target || !(await exists(campaignMetaPath(target)))) {
		throw new Error("Кампанію для імпорту не знайдено.");
	}

	const sections = normalizePartialArchiveSections(archiveBundle?.sections || []);
	const bundle = archiveBundle?.bundle || {};
	const sourceMeta = bundle.meta || {};
	const sourceSlug = sourceMeta.slug || archiveBundle?.sourceSlug || target;
	const imported = {
		sessions: 0,
		npc: 0,
		locations: 0,
		customMonsters: 0,
		images: 0,
		aiHistory: 0,
	};

	if (sections.includes("sessions")) {
		await ensureDir(path.join(campaignDir(target), "sessions"));
		for (const session of Array.isArray(bundle.sessions) ? bundle.sessions : []) {
			const desiredName =
				session.fileName ||
				`${sanitizeName(session.content?.name) || todayString()}.json`;
			const fileName = await ensureUniqueSessionFile(target, desiredName);
			const normalizedContent = replaceImageSlugReferences(
				session.content || {},
				sourceSlug,
				target,
			);
			await writeJson(sessionPath(target, fileName), normalizedContent);
			imported.sessions += 1;
		}
	}

	for (const type of ["npc", "locations"]) {
		if (!sections.includes(type)) continue;
		const list = Array.isArray(bundle.entities?.[type])
			? bundle.entities[type]
			: [];
		for (const entity of list) {
			const desiredSlug =
				entity.slug || campaignSlug(entity.firstName || entity.name || type);
			const entitySlug = await ensureUniqueEntitySlug(target, type, desiredSlug);
			const normalizedEntity = replaceImageSlugReferences(
				entity,
				sourceSlug,
				target,
			);
			await writeEntity(target, type, entitySlug, {
				...normalizedEntity,
				slug: entitySlug,
			});
			imported[type] += 1;
		}
	}

	if (sections.includes("aiHistory")) {
		const existing = await readAiResponses(target);
		const incoming = (Array.isArray(bundle.aiResponses) ? bundle.aiResponses : [])
			.map((entry) => ({
				...normalizeImportedAiResponse(entry, sourceSlug, target),
				id: createId(),
			}));
		if (incoming.length > 0) {
			await writeAiResponses(target, [...existing, ...incoming]);
			imported.aiHistory = incoming.length;
		}
	}

	if (sections.includes("customMonsters")) {
		const monsters = Array.isArray(archiveBundle?.customMonsters)
			? archiveBundle.customMonsters
			: [];
		if (monsters.length > 0) {
			await upsertCustomBestiaryMonsters(monsters);
			imported.customMonsters = monsters.length;
		}
	}

	if (sections.includes("images")) {
		const images = Array.isArray(archiveBundle?.images) ? archiveBundle.images : [];
		await restoreCampaignImagesFromArchive(target, images);
		imported.images = images.length;
	}

	return { ok: true, imported, sections };
}

async function importCampaignArchiveBundle(archiveBundle) {
	const importedMeta = await importCampaignBundle(
		archiveBundle.bundle || archiveBundle,
	);
	await restoreCampaignImagesFromArchive(
		importedMeta.slug,
		archiveBundle.images || [],
	);
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
		order: 0,
		createdAt: new Date().toISOString(),
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
			path: path.join(category, sub, e.name),
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
				if (meta.imageUrl === res.oldUrl) {
					meta.imageUrl = res.newUrl;
					changed = true;
				}
			}
			if (changed) await writeJson(metaPath, meta);
		}

		// 2. Оновлення персонажів, NPC та локацій
		for (const type of ENTITY_TYPES) {
			const entities = await listEntities(slug, type);
			for (const entity of entities) {
				let changed = false;
				for (const res of moveResults) {
					if (entity.imageUrl === res.oldUrl) {
						entity.imageUrl = res.newUrl;
						changed = true;
					}
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
						else if (e.isDirectory())
							await walk(path.join(dir, e.name), path.join(sub, e.name));
					}
				};
				await walk(oldPath);
			} else {
				filesToTrack.push("");
			}

			await renameWithRetry(oldPath, newPath);

			for (const relPath of filesToTrack) {
				const fileName = isDir ? relPath : name;
				const oldSub = sSub
					? isDir
						? path.join(sSub, name, relPath)
						: sSub
					: isDir
						? path.join(name, relPath)
						: "";
				const newSub = dSub
					? isDir
						? path.join(dSub, name, relPath)
						: dSub
					: isDir
						? path.join(name, relPath)
						: "";

				results.push({
					oldUrl: `/api/images/${encodeURIComponent(sSlug)}/${encodeURIComponent(src.category)}${oldSub ? "/" + oldSub.split(path.sep).join("/") : ""}${isDir ? "" : "/" + encodeURIComponent(fileName)}`,
					newUrl: `/api/images/${encodeURIComponent(dSlug)}/${encodeURIComponent(dest.category)}${newSub ? "/" + newSub.split(path.sep).join("/") : ""}${isDir ? "" : "/" + encodeURIComponent(fileName)}`,
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

	if (!(await exists(oldPath)))
		throw new Error(`Файл '${oldName}' не знайдено.`);
	if (oldPath !== newPath && (await exists(newPath)))
		throw new Error(`Файл '${newName}' вже існує.`);

	await renameWithRetry(oldPath, newPath);

	const sSub = subcategory || "";
	const oldUrl = `/api/images/${encodeURIComponent(slug)}/${encodeURIComponent(category)}${sSub ? "/" + sSub.split(path.sep).join("/") : ""}/${encodeURIComponent(oldName)}`;
	const newUrl = `/api/images/${encodeURIComponent(slug)}/${encodeURIComponent(category)}${sSub ? "/" + sSub.split(path.sep).join("/") : ""}/${encodeURIComponent(newName)}`;

	await updateAllImageReferences([{ oldUrl, newUrl }]);
	return { oldUrl, newUrl };
}

async function deleteImages(items, src, options = {}) {
	const extractFolderContents = Boolean(options.extractFolderContents);
	const slug = decodeURIComponent(src.slug);
	const category = src.category;
	const subcategory = src.subcategory || "";
	const dir = campaignImagesDir(slug, category, subcategory);

	for (const name of items) {
		const target = path.join(dir, name);
		if (!(await exists(target))) continue;

		const stats = await fs.stat(target);
		if (!extractFolderContents || !stats.isDirectory()) {
			await fs.rm(target, { recursive: true, force: true });
			continue;
		}

		const nestedItems = await fs.readdir(target);
		if (nestedItems.length > 0) {
			const nestedSubcategory = subcategory
				? path.join(subcategory, name)
				: name;
			await moveImages(
				nestedItems,
				{
					slug,
					category,
					subcategory: nestedSubcategory,
				},
				{
					slug,
					category,
					subcategory,
				},
			);
		}
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
	if (oldPath !== newPath && (await exists(newPath))) {
		throw new Error(`Підкатегорія '${newName}' вже існує.`);
	}
	await fs.rename(oldPath, newPath);
}

module.exports = {
	CAMPAIGNS_DIR,
	BESTIARY_DIR,
	CUSTOM_BESTIARY_SOURCE,
	CUSTOM_BESTIARY_PATH,
	SPELLS_DIR,
	IMAGES_DIR,
	SETTINGS_PATH,
	ENTITY_TYPES,
	DEFAULT_APP_SETTINGS,
	createId,
	sanitizeName,
	campaignSlug,
	sessionFileName,
	campaignDir,
	campaignAiResponsesPath,
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
	updateCampaignMentionReferences,
	moveEntity,
	readFavorites,
	writeFavorites,
	readAiResponses,
	addAiResponse,
	getAiResponse,
	updateAiResponse,
	deleteAiResponse,
	clearAiResponses,
	readSettings,
	updateSettings,
	listCampaignSlugs,
	readCampaign,
	readSession,
	listSessions,
	listCampaignsDetailed,
	exportCampaignBundle,
	exportCampaignArchiveBundle,
	exportCampaignPartialArchiveBundle,
	importCampaignBundle,
	importCampaignArchiveBundle,
	importCampaignArchiveBundleWithStrategy,
	importCampaignPartialArchiveBundle,
	findCampaignSlugById,
	moveCampaignImagesToGeneral,
	campaignHasImages,
	deleteCampaignData,
	clearAllCampaignData,
	ensureUniqueCampaignSlug,
	ensureUniqueSessionFile,
	ensureUniqueEntitySlug,
	makeDefaultSessionData,
	getBestiaryIndex,
	readCustomBestiary,
	readCustomBestiaryMonsters,
	normalizeCustomBestiaryMonster,
	writeCustomBestiaryMonsters,
	upsertCustomBestiaryMonsters,
	listImages,
	listSubcategories,
	moveImages,
	renameSubcategory,
	renameImage,
	deleteImages,
};
