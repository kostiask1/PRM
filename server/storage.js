const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const {
	calculateDiceFormulaAverage,
	stripMentionBrackets,
} = require("../shared/bestiaryUtils.cjs");
const {
	createCampaignMentionReferenceUpdater,
} = require("./modules/campaign/infrastructure/campaignMentionReferences");
const {
	createCampaignArchiveImageRestorer,
} = require("./modules/backups/infrastructure/archiveImageRestoration");
const {
	createBestiaryAiHistoryMigration,
} = require("./modules/ai/infrastructure/bestiaryAiHistoryMigration");

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const CAMPAIGNS_DIR = path.join(DATA_DIR, "campaigns");
const BESTIARY_DIR = path.join(ROOT_DIR, "database", "bestiary");
const BESTIARY_TOKENS_DIR = path.join(BESTIARY_DIR, "tokens");
const CUSTOM_BESTIARY_SOURCE = "CUSTOM";
const CUSTOM_BESTIARY_PATH = path.join(DATA_DIR, "custom-bestiary.json");
const BESTIARY_AI_RESPONSES_PATH = path.join(
	DATA_DIR,
	"_aiResponses-bestiary.json",
);
const SPELLS_DIR = path.join(ROOT_DIR, "database", "spells");
const FAVORITES_PATH = path.join(DATA_DIR, "favorites.json");
const IMAGES_DIR = path.join(DATA_DIR, "images");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");
const ENTITY_TYPES = Object.freeze(["characters", "npc", "locations"]);
const IMAGE_FILE_RE = /\.(jpg|jpeg|png|webp|gif|svg)$/i;
const DEFAULT_IMAGE_PROMPT_BASE_PROMPT =
	"cinematic, photorealistic, ultra realistic, high detail, 8k, dramatic lighting, volumetric light, sharp focus, depth of field, film still, concept art";

const DEFAULT_APP_SETTINGS = Object.freeze({
	language: "en",
	theme: "light",
	encounterViewMode: "grid",
	encounterGridColumns: 3,
	simplifiedNotes: false,
	aiBasePrompt: "",
	imagePromptBasePrompt: DEFAULT_IMAGE_PROMPT_BASE_PROMPT,
	campaignAiBasePrompts: {},
	campaignImagePromptBasePrompts: {},
	ignoreSourcesList: [],
	autoApplyAiChanges: false,
	useSearchDebounce: true,
});

const jsonWriteQueues = new Map();

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

async function getFileSize(filePath) {
	try {
		const stats = await fs.stat(filePath);
		return stats.isFile() ? stats.size : 0;
	} catch {
		return 0;
	}
}

async function getDirectoryEntrySize(dirPath, entry) {
	const fullPath = path.join(dirPath, entry.name);
	if (entry.isDirectory()) return getDirectorySize(fullPath);
	if (entry.isFile()) return getFileSize(fullPath);
	return 0;
}

async function getDirectorySize(dirPath) {
	if (!(await exists(dirPath))) return 0;
	let total = 0;
	const entries = await fs.readdir(dirPath, { withFileTypes: true });
	for (const entry of entries) {
		total += await getDirectoryEntrySize(dirPath, entry);
	}
	return total;
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
	const resolvedPath = path.resolve(filePath);
	const previousWrite = jsonWriteQueues.get(resolvedPath) || Promise.resolve();
	const queuedWrite = previousWrite
		.catch(() => {})
		.then(() => writeJsonNow(resolvedPath, value));
	const storedWrite = queuedWrite
		.catch(() => {})
		.finally(() => {
			if (jsonWriteQueues.get(resolvedPath) === storedWrite) {
				jsonWriteQueues.delete(resolvedPath);
			}
		});
	jsonWriteQueues.set(resolvedPath, storedWrite);
	return queuedWrite;
}

async function writeJsonNow(filePath, value) {
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
		await renameWithRetry(tempPath, filePath);
	} catch (error) {
		await fs.rm(tempPath, { force: true }).catch(() => {});
		throw error;
	}
}

function wait(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function renameWithRetry(oldPath, newPath, retries = 12, delay = 50) {
	for (let i = 0; i < retries; i++) {
		try {
			await fs.rename(oldPath, newPath);
			return;
		} catch (err) {
			const isLocked = ["EPERM", "EBUSY", "EACCES"].includes(err.code);
			if (isLocked && i < retries - 1) {
				await wait(delay * (i + 1));
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

function addMonstersToBestiaryIndex(index, monsters, fallbackSource = "") {
	for (const monster of monsters) {
		const entry = getBestiaryIndexEntry(monster, fallbackSource);
		if (entry) index.set(...entry);
	}
}

function getBestiaryIndexEntry(monster, fallbackSource) {
	if (!monster.name) return null;
	const monsterSource = String(monster.source || fallbackSource).toUpperCase();
	const key = `${monster.name.trim().toLowerCase()}|${monsterSource}`;
	return [key, { ...monster, source: monsterSource }];
}

function createBestiaryIndex(monsters, fallbackSource = "") {
	const index = new Map();
	addMonstersToBestiaryIndex(index, monsters, fallbackSource);
	return index;
}

function getBestiaryEnvelopeMonsters(data) {
	return data.monster || data.monsters || data.results || [];
}

function getBestiaryMonsters(data) {
	return Array.isArray(data) ? data : getBestiaryEnvelopeMonsters(data);
}

function appendCustomBestiaryMonsters(index, customMonsters) {
	addMonstersToBestiaryIndex(index, customMonsters, CUSTOM_BESTIARY_SOURCE);
	return index;
}

async function readAggregateBestiaryIndex(allPath, customMonsters) {
	const data = await readJson(allPath);
	const index = createBestiaryIndex(getBestiaryMonsters(data));
	return appendCustomBestiaryMonsters(index, customMonsters);
}

function hasBestiaryJsonExtension(entry) {
	return entry.name.endsWith(".json");
}

function isBestiaryAggregateFile(entry) {
	return entry.name === "all.json";
}

function isBestiaryIndexFile(entry) {
	return entry.name === "index.json";
}

function isBestiaryLegendaryGroupsFile(entry) {
	return entry.name === "legendarygroups.json";
}

function isBestiaryControlFile(entry) {
	if (isBestiaryAggregateFile(entry)) return true;
	if (isBestiaryIndexFile(entry)) return true;
	return isBestiaryLegendaryGroupsFile(entry);
}

function isBundledBestiaryFile(entry) {
	if (!entry.isFile()) return false;
	if (!hasBestiaryJsonExtension(entry)) return false;
	return !isBestiaryControlFile(entry);
}

function getBestiaryFileFallbackSource(fileName) {
	return path.parse(fileName).name.replace(/^bestiary-/i, "");
}

function getBestiaryFileSource(data, fileName) {
	const source =
		data._meta?.sources?.[0]?.json ||
		getBestiaryFileFallbackSource(fileName);
	return source.toUpperCase();
}

async function addBestiaryFileToIndex(index, file) {
	const data = await readJson(path.join(BESTIARY_DIR, file.name));
	const source = getBestiaryFileSource(data, file.name);
	addMonstersToBestiaryIndex(index, getBestiaryMonsters(data), source);
}

async function readSplitBestiaryIndex(customMonsters) {
	const entries = await fs.readdir(BESTIARY_DIR, { withFileTypes: true });
	const files = entries.filter(isBundledBestiaryFile);
	const index = new Map();
	for (const file of files) {
		await addBestiaryFileToIndex(index, file);
	}
	return appendCustomBestiaryMonsters(index, customMonsters);
}

async function getBestiaryIndex() {
	const customMonsters = await readCustomBestiaryMonsters();
	if (!(await exists(BESTIARY_DIR))) {
		return createBestiaryIndex(customMonsters, CUSTOM_BESTIARY_SOURCE);
	}
	const allPath = path.join(BESTIARY_DIR, "all.json");
	if (await exists(allPath)) {
		return readAggregateBestiaryIndex(allPath, customMonsters);
	}
	return readSplitBestiaryIndex(customMonsters);
}

function getCustomBestiaryEnvelope(data) {
	return data && !Array.isArray(data) ? data : {};
}

function forceCustomBestiarySource(monster) {
	return {
		...monster,
		source: CUSTOM_BESTIARY_SOURCE,
	};
}

function getCustomBestiaryReadMonsters(monsters) {
	return Array.isArray(monsters)
		? monsters.map(forceCustomBestiarySource)
		: [];
}

function projectCustomBestiary(data) {
	const monsters = getBestiaryMonsters(data);
	return {
		...getCustomBestiaryEnvelope(data),
		monster: getCustomBestiaryReadMonsters(monsters),
	};
}

async function readCustomBestiary() {
	if (!(await exists(CUSTOM_BESTIARY_PATH))) return { monster: [] };
	const data = await readJson(CUSTOM_BESTIARY_PATH);
	return projectCustomBestiary(data);
}

async function readCustomBestiaryMonsters() {
	return (await readCustomBestiary()).monster;
}

function normalizeCustomBestiaryStringEntry(entry) {
	const text = entry.trim();
	return text ? { name: "", entries: [text] } : null;
}

function isCustomBestiaryEntryRecord(entry) {
	return Boolean(entry) && typeof entry === "object";
}

function getCustomBestiaryEntryContent(entry) {
	return entry.text || entry.description || entry.content;
}

function getCustomBestiaryEntryEntries(entry) {
	if (Array.isArray(entry.entries)) return entry.entries;
	if (!getCustomBestiaryEntryContent(entry)) return [];
	return [String(getCustomBestiaryEntryContent(entry))];
}

function normalizeCustomBestiaryRecordEntry(entry) {
	return {
		...entry,
		name: String(entry.name || entry.title || "").trim(),
		entries: getCustomBestiaryEntryEntries(entry),
	};
}

function normalizeCustomBestiaryEntry(entry) {
	if (typeof entry === "string") {
		return normalizeCustomBestiaryStringEntry(entry);
	}
	if (!isCustomBestiaryEntryRecord(entry)) return null;
	return normalizeCustomBestiaryRecordEntry(entry);
}

function hasCustomBestiaryEntryContent(entry) {
	return Boolean(entry) && entry.entries.length > 0;
}

function normalizeCustomBestiaryEntryList(value) {
	return (Array.isArray(value) ? value : [])
		.map(normalizeCustomBestiaryEntry)
		.filter(hasCustomBestiaryEntryContent);
}

function createCustomBestiaryMonsterBase(monster) {
	return stripMentionBrackets({
		...monster,
		id: String(monster.id || createId()),
		name: String(monster.name || monster.title || "").trim(),
		source: CUSTOM_BESTIARY_SOURCE,
	});
}

function isCustomBestiaryHp(value) {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStoredCustomBestiaryHpAverage(value) {
	const parsed = Number.parseInt(String(value), 10);
	return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}

function normalizeCustomBestiaryHp(monster) {
	if (!isCustomBestiaryHp(monster.hp)) return;
	monster.hp = { ...monster.hp };
	const average = calculateDiceFormulaAverage(monster.hp.formula);
	if (average !== null) {
		monster.hp.average = average;
		return;
	}
	if (hasOwn(monster.hp, "average")) {
		monster.hp.average = normalizeStoredCustomBestiaryHpAverage(
			monster.hp.average,
		);
	}
}

function normalizeCustomBestiarySpellcasting(monster) {
	if (monster.spellcasting && !Array.isArray(monster.spellcasting)) {
		monster.spellcasting = [monster.spellcasting];
	}
}

function normalizeCustomBestiaryActionFamily(monster, key) {
	if (monster[key] === undefined) return;
	const entries = normalizeCustomBestiaryEntryList(monster[key]);
	if (entries.length > 0) {
		monster[key] = entries;
		return;
	}
	delete monster[key];
}

function normalizeCustomBestiaryMonster(monster) {
	const next = createCustomBestiaryMonsterBase(monster);
	normalizeCustomBestiaryHp(next);
	normalizeCustomBestiarySpellcasting(next);
	for (const key of ["trait", "action", "bonus", "reaction", "legendary"]) {
		normalizeCustomBestiaryActionFamily(next, key);
	}
	return next;
}

async function writeCustomBestiaryMonsters(monsters) {
	const seenIds = new Set();
	const normalized = (Array.isArray(monsters) ? monsters : [])
		.filter((monster) => monster && typeof monster === "object")
		.map((monster) => {
			const normalizedMonster = normalizeCustomBestiaryMonster(monster);
			if (seenIds.has(normalizedMonster.id)) {
				normalizedMonster.id = createId();
			}
			seenIds.add(normalizedMonster.id);
			return normalizedMonster;
		})
		.filter((monster) => monster.name)
		.sort((a, b) => String(a.name).localeCompare(String(b.name)));
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

const AI_CHANGE_KINDS = new Set([
	"campaign",
	"session",
	"entity",
	"custom-bestiary",
	"custom-monster",
]);
const AI_RESOURCE_APPLY_STATES = new Set(["applied", "undone"]);
const AI_RESPONSE_APPLY_STATES = new Set(["applied", "undone", "draft"]);

function isObjectLike(value) {
	return Boolean(value && typeof value === "object");
}

function normalizeAiChangeKind(value) {
	return AI_CHANGE_KINDS.has(value) ? value : null;
}

function normalizeAiChangeSnapshot(raw, key) {
	return hasOwn(raw, key) ? raw[key] : null;
}

function hasAiChangeSnapshot(before, after) {
	return before !== null || after !== null;
}

function normalizeGeneratedId(value) {
	return String(value || createId());
}

function normalizeAiResourceApplyState(value) {
	return AI_RESOURCE_APPLY_STATES.has(value) ? value : null;
}

function createAiChangeResource(raw, kind, before, after) {
	return {
		id: normalizeGeneratedId(raw.id),
		kind,
		campaign: raw.campaign || null,
		label: String(raw.label || raw.id || kind),
		before,
		after,
		applyState: normalizeAiResourceApplyState(raw.applyState),
		appliedAt: raw.appliedAt || null,
	};
}

function projectSessionChangeIdentity(resource, raw) {
	resource.fileName = raw.fileName || null;
}

function projectEntityChangeIdentity(resource, raw) {
	resource.type = raw.type || null;
	resource.slug = raw.slug || null;
}

function projectCustomMonsterChangeIdentity(resource, raw) {
	resource.name = raw.name || raw.after?.name || raw.before?.name || null;
}

const AI_CHANGE_IDENTITY_PROJECTORS = new Map([
	["session", projectSessionChangeIdentity],
	["entity", projectEntityChangeIdentity],
	["custom-monster", projectCustomMonsterChangeIdentity],
]);

function projectAiChangeIdentity(resource, raw) {
	AI_CHANGE_IDENTITY_PROJECTORS.get(resource.kind)?.(resource, raw);
}

function normalizeAiChangeResource(raw = {}) {
	if (!isObjectLike(raw)) return null;
	const kind = normalizeAiChangeKind(raw.kind);
	if (!kind) return null;
	const before = normalizeAiChangeSnapshot(raw, "before");
	const after = normalizeAiChangeSnapshot(raw, "after");
	if (!hasAiChangeSnapshot(before, after)) return null;
	const resource = createAiChangeResource(raw, kind, before, after);
	projectAiChangeIdentity(resource, raw);
	return resource;
}

function normalizeAiChanges(raw = {}) {
	if (!isObjectLike(raw)) {
		return { resources: [], summary: {} };
	}
	const resources = Array.isArray(raw.resources)
		? raw.resources.map(normalizeAiChangeResource).filter(Boolean)
		: [];
	return {
		resources,
		summary: isObjectLike(raw.summary) ? raw.summary : {},
	};
}

function normalizeAiResponseText(raw) {
	return typeof raw.text === "string" ? raw.text : "";
}

function normalizeAiRequestSource(raw) {
	return isObjectLike(raw.request) ? raw.request : {};
}

function normalizeAiUserInstructions(rawRequest, raw) {
	if (typeof rawRequest.userInstructions === "string") {
		return rawRequest.userInstructions;
	}
	return typeof raw.userInstructions === "string" ? raw.userInstructions : "";
}

function normalizeAiRequest(rawRequest, userInstructions) {
	return {
		userInstructions,
		options: isObjectLike(rawRequest.options) ? rawRequest.options : {},
		optionsSummary:
			typeof rawRequest.optionsSummary === "string"
				? rawRequest.optionsSummary
				: "",
		context: isObjectLike(rawRequest.context) ? rawRequest.context : {},
		contextSummary:
			typeof rawRequest.contextSummary === "string"
				? rawRequest.contextSummary
				: "",
	};
}

function normalizeAiResponseApplyState(value) {
	return AI_RESPONSE_APPLY_STATES.has(value) ? value : null;
}

function normalizeAiResponseStatus(value) {
	return value === "failed" ? "failed" : "completed";
}

function normalizeAiResponsePath(value) {
	if (!isObjectLike(value)) return null;
	return {
		campaign: value.campaign || null,
		session: value.session || null,
		encounter: value.encounter || null,
	};
}

function normalizeAiResponseError(value) {
	if (!isObjectLike(value)) return null;
	return {
		message: String(value.message || ""),
		status: value.status || null,
	};
}

function normalizeAiRetryPayload(value) {
	return isObjectLike(value) ? value : null;
}

function normalizeNullableAiMetadata(value) {
	return value || null;
}

function normalizeAiResponseCreatedAt(value) {
	return value || new Date().toISOString();
}

function createNormalizedAiResponse(raw, text, rawRequest, userInstructions) {
	return {
		id: normalizeGeneratedId(raw.id),
		text,
		status: normalizeAiResponseStatus(raw.status),
		path: normalizeAiResponsePath(raw.path),
		type: normalizeNullableAiMetadata(raw.type),
		modelName: normalizeNullableAiMetadata(raw.modelName),
		language: normalizeNullableAiMetadata(raw.language),
		userInstructions,
		request: normalizeAiRequest(rawRequest, userInstructions),
		changes: normalizeAiChanges(raw.changes),
		applyState: normalizeAiResponseApplyState(raw.applyState),
		appliedAt: normalizeNullableAiMetadata(raw.appliedAt),
		error: normalizeAiResponseError(raw.error),
		retryPayload: normalizeAiRetryPayload(raw.retryPayload),
		createdAt: normalizeAiResponseCreatedAt(raw.createdAt),
	};
}

function normalizeAiResponse(raw = {}) {
	if (!isObjectLike(raw)) return null;
	const text = normalizeAiResponseText(raw);
	if (!text.trim()) return null;
	const rawRequest = normalizeAiRequestSource(raw);
	const userInstructions = normalizeAiUserInstructions(rawRequest, raw);
	return createNormalizedAiResponse(raw, text, rawRequest, userInstructions);
}

function normalizeCampaignSlug(slug) {
	const normalized = path.basename(String(slug || "").trim());
	return normalized || null;
}

function normalizeSourceList(value) {
	const seen = new Set();
	const sourceList = Array.isArray(value) ? value : [];
	for (const source of sourceList) {
		const normalized = String(source || "").trim().toUpperCase();
		if (normalized) seen.add(normalized);
	}
	return [...seen].sort((a, b) => a.localeCompare(b));
}

function getLegacyAiResponsesPath(slug) {
	return slug === "bestiary" ? campaignAiResponsesPath(slug) : null;
}

async function shouldUsePrimaryAiResponsesPath(
	responsesPath,
	legacyResponsesPath,
) {
	if (await exists(responsesPath)) return true;
	if (!legacyResponsesPath) return true;
	return !(await exists(legacyResponsesPath));
}

async function resolveAiResponsesReadPath(slug) {
	const responsesPath = aiResponsesPath(slug);
	const legacyResponsesPath = getLegacyAiResponsesPath(slug);
	return (await shouldUsePrimaryAiResponsesPath(
		responsesPath,
		legacyResponsesPath,
	))
		? responsesPath
		: legacyResponsesPath;
}

function getSavedAiResponseList(saved) {
	return Array.isArray(saved) ? saved : saved?.responses || [];
}

function compareAiResponsesByCreatedAt(a, b) {
	return String(b.createdAt).localeCompare(String(a.createdAt));
}

function normalizeSavedAiResponses(saved) {
	return getSavedAiResponseList(saved)
		.map(normalizeAiResponse)
		.filter(Boolean)
		.sort(compareAiResponsesByCreatedAt);
}

const bestiaryAiHistoryMigration = createBestiaryAiHistoryMigration({
	aiResponsesPath,
	campaignAiResponsesPath,
	exists,
	normalizeResponses: normalizeSavedAiResponses,
	readJson,
	writeJson,
});

async function resolveAiResponsesReadState(slug) {
	if (slug === "bestiary") {
		return bestiaryAiHistoryMigration.ensureCanonicalAiResponses(slug);
	}
	return { responsesPath: await resolveAiResponsesReadPath(slug) };
}

async function readNormalizedAiResponses(readablePath) {
	try {
		return normalizeSavedAiResponses(await readJson(readablePath));
	} catch {
		return [];
	}
}

async function readAiResponses(campaignSlugValue) {
	const slug = normalizeCampaignSlug(campaignSlugValue);
	if (!slug) return [];
	const readState = await resolveAiResponsesReadState(slug);
	if (readState.responses) return readState.responses;
	if (!(await exists(readState.responsesPath))) return [];
	return readNormalizedAiResponses(readState.responsesPath);
}

async function getAiResponsesStorageStats(campaignSlugValue) {
	const slug = normalizeCampaignSlug(campaignSlugValue);
	if (!slug) return { bytes: 0 };
	const readState = await resolveAiResponsesReadState(slug);
	return { bytes: await getFileSize(readState.responsesPath) };
}

async function writeAiResponses(campaignSlugValue, responses) {
	const slug = normalizeCampaignSlug(campaignSlugValue);
	if (!slug) return [];
	const normalized = (Array.isArray(responses) ? responses : [])
		.map(normalizeAiResponse)
		.filter(Boolean)
		.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
	if (slug === "bestiary") {
		await bestiaryAiHistoryMigration.writeCanonicalAiResponses(
			slug,
			normalized,
		);
	} else {
		await writeJson(aiResponsesPath(slug), normalized);
	}
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
	if (!updatedEntry) return null;
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

function getNormalizedSettingsGridColumns(settings) {
	const parsed = Number.parseInt(settings.encounterGridColumns, 10);
	const finiteValue = Number.isFinite(parsed) ? parsed : 2;
	return Math.min(4, Math.max(1, finiteValue));
}

function isSettingsPromptMap(settings, key) {
	return (
		settings[key] &&
		typeof settings[key] === "object" &&
		!Array.isArray(settings[key])
	);
}

function normalizeSettingsPromptEntry([slug, prompt]) {
	return [String(slug || "").trim(), String(prompt || "")];
}

function hasSettingsPromptSlug([slug]) {
	return slug;
}

function normalizeSettingsPromptMap(settings, key) {
	if (!isSettingsPromptMap(settings, key)) return {};
	return Object.fromEntries(
		Object.entries(settings[key])
			.map(normalizeSettingsPromptEntry)
			.filter(hasSettingsPromptSlug),
	);
}

function getNormalizedSettingsLanguage(settings) {
	return settings.language === "uk" ? "uk" : "en";
}

function getNormalizedSettingsTheme(settings) {
	return settings.theme === "dark" ? "dark" : "light";
}

function getNormalizedEncounterViewMode(settings) {
	return settings.encounterViewMode === "grid" ? "grid" : "single";
}

function getNormalizedImagePrompt(settings) {
	if (settings.imagePromptBasePrompt === undefined) {
		return DEFAULT_IMAGE_PROMPT_BASE_PROMPT;
	}
	return String(settings.imagePromptBasePrompt || "");
}

function normalizeSettings(settings = {}) {
	const encounterGridColumns = getNormalizedSettingsGridColumns(settings);
	const campaignAiBasePrompts = normalizeSettingsPromptMap(
		settings,
		"campaignAiBasePrompts",
	);
	const campaignImagePromptBasePrompts = normalizeSettingsPromptMap(
		settings,
		"campaignImagePromptBasePrompts",
	);
	return {
		language: getNormalizedSettingsLanguage(settings),
		theme: getNormalizedSettingsTheme(settings),
		encounterViewMode: getNormalizedEncounterViewMode(settings),
		encounterGridColumns,
		simplifiedNotes: Boolean(settings.simplifiedNotes),
		aiBasePrompt: String(settings.aiBasePrompt || ""),
		imagePromptBasePrompt: getNormalizedImagePrompt(settings),
		campaignAiBasePrompts,
		campaignImagePromptBasePrompts,
		ignoreSourcesList: normalizeSourceList(settings.ignoreSourcesList),
		autoApplyAiChanges: settings.autoApplyAiChanges !== false,
		useSearchDebounce: settings.useSearchDebounce !== false,
	};
}

function cloneDefaultAppSettings() {
	return { ...DEFAULT_APP_SETTINGS };
}

async function writeDefaultAppSettings() {
	await writeJson(SETTINGS_PATH, DEFAULT_APP_SETTINGS);
	return cloneDefaultAppSettings();
}

function settingsNeedRewrite(saved, normalized) {
	return JSON.stringify(saved) !== JSON.stringify(normalized);
}

async function readExistingSettings() {
	try {
		const saved = await readJson(SETTINGS_PATH);
		const normalized = normalizeSettings(saved);
		if (settingsNeedRewrite(saved, normalized)) {
			await writeJson(SETTINGS_PATH, normalized);
		}
		return normalized;
	} catch {
		return writeDefaultAppSettings();
	}
}

async function readSettings() {
	if (!(await exists(SETTINGS_PATH))) {
		return writeDefaultAppSettings();
	}
	return readExistingSettings();
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

function getEntityListOrder(entity) {
	return Number.isFinite(Number(entity.order)) ? Number(entity.order) : 0;
}

function getEntityListPersonName(entity) {
	return `${entity.firstName || ""} ${entity.lastName || ""}`.trim();
}

function getEntityListName(entity) {
	return String(
		entity.name || getEntityListPersonName(entity) || entity.slug || "",
	);
}

function compareEntityListItems(a, b) {
	const aOrder = getEntityListOrder(a);
	const bOrder = getEntityListOrder(b);
	if (aOrder !== bOrder) return aOrder - bOrder;
	return getEntityListName(a).localeCompare(getEntityListName(b));
}

async function readEntityListEntry(entitiesDir, entry) {
	if (!entry.isDirectory()) return null;
	const infoPath = path.join(entitiesDir, entry.name, "info.json");
	if (!(await exists(infoPath))) return null;
	const data = await readJson(infoPath);
	return { ...data, slug: entry.name };
}

async function listEntities(campaignSlug, type) {
	const entitiesDir = path.join(campaignDir(campaignSlug), type);
	await ensureDir(entitiesDir);
	const entries = await fs.readdir(entitiesDir, { withFileTypes: true });
	const result = [];
	for (const entry of entries) {
		const entity = await readEntityListEntry(entitiesDir, entry);
		if (entity) result.push(entity);
	}
	return result.sort(compareEntityListItems);
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

const updateCampaignMentionReferences = createCampaignMentionReferenceUpdater({
	entityTypes: ENTITY_TYPES,
	campaignMetaPath,
	exists,
	readJson,
	writeJson,
	listEntities,
	writeEntity,
	listSessions,
	sessionPath,
});

async function moveEntity(campaignSlug, sourceType, entitySlug, targetType) {
	if (sourceType === targetType) {
		return readEntity(campaignSlug, sourceType, entitySlug);
	}
	if (
		!ENTITY_TYPES.includes(sourceType) ||
		!ENTITY_TYPES.includes(targetType)
	) {
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
	const targetPath = path.join(
		campaignDir(campaignSlug),
		targetType,
		targetSlug,
	);

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
			(a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name),
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
			(a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name),
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
		const imagesDir = path.join(IMAGES_DIR, path.basename(slug));
		const taken = (await exists(dir)) || (await exists(imagesDir));
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

function importedSessionFileName(session) {
	const rawFileName = String(session?.fileName || "").trim();
	if (rawFileName) {
		const parsed = path.parse(path.basename(rawFileName));
		const name = sanitizeName(parsed.name);
		if (name) return `${name}.json`;
	}
	return sessionFileName(session?.content?.name || todayString());
}

async function resolvePartialImportSessionFileName(targetSlug, session) {
	const incomingId = session?.content?.id;
	if (incomingId != null) {
		const existingSessions = await listSessions(targetSlug);
		const existing = existingSessions.find(
			(item) => item.id != null && String(item.id) === String(incomingId),
		);
		if (existing?.fileName) return existing.fileName;
	}
	return importedSessionFileName(session);
}

const IMPORTED_ENTITY_DOT_SEGMENTS = new Set([".", ".."]);

function getImportedEntityProperty(entity, property) {
	if (entity == null) return undefined;
	return entity[property];
}

function getImportedEntityRawSlug(entity) {
	return String(getImportedEntityProperty(entity, "slug") || "").trim();
}

function getImportedEntityPathSlug(rawSlug) {
	if (!rawSlug) return null;
	const slug = path.basename(rawSlug);
	return slug && !IMPORTED_ENTITY_DOT_SEGMENTS.has(slug) ? slug : null;
}

function getImportedEntityFallbackName(type, entity) {
	const firstName = getImportedEntityProperty(entity, "firstName");
	if (firstName) return firstName;
	const name = getImportedEntityProperty(entity, "name");
	if (name) return name;
	return type;
}

function importedEntitySlug(type, entity) {
	const pathSlug = getImportedEntityPathSlug(
		getImportedEntityRawSlug(entity),
	);
	return pathSlug || campaignSlug(getImportedEntityFallbackName(type, entity));
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
			const destDir = path.join(
				IMAGES_DIR,
				"general",
				...relParts.slice(0, -1),
			);
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

function getSafeCampaignImageSlug(slug) {
	return path.basename(String(slug || ""));
}

async function campaignImageEntryHasFiles(directory, entry) {
	const fullPath = path.join(directory, entry.name);
	if (entry.isFile()) return true;
	if (!entry.isDirectory()) return false;
	return campaignImageDirectoryHasFiles(fullPath);
}

async function campaignImageDirectoryHasFiles(directory) {
	const entries = await fs.readdir(directory, { withFileTypes: true });
	for (const entry of entries) {
		if (await campaignImageEntryHasFiles(directory, entry)) return true;
	}
	return false;
}

async function campaignHasImages(slug) {
	const safeSlug = getSafeCampaignImageSlug(slug);
	if (!safeSlug) return false;
	const root = path.join(IMAGES_DIR, safeSlug);
	if (!(await exists(root))) return false;
	return campaignImageDirectoryHasFiles(root);
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

function canReplaceImageSlugReferences(value, oldSlug, newSlug) {
	return Boolean(value && oldSlug && newSlug && oldSlug !== newSlug);
}

function getCampaignImageUrlSegment(slug) {
	return `/api/images/${encodeURIComponent(slug)}/`;
}

function replaceSerializedImageSlugReferences(
	serialized,
	oldSegment,
	newSegment,
) {
	return serialized.split(oldSegment).join(newSegment);
}

function replaceImageSlugReferences(value, oldSlug, newSlug) {
	if (!canReplaceImageSlugReferences(value, oldSlug, newSlug)) return value;
	const oldSegment = getCampaignImageUrlSegment(oldSlug);
	const newSegment = getCampaignImageUrlSegment(newSlug);
	const serialized = JSON.stringify(value);
	if (!serialized.includes(oldSegment)) return value;
	return JSON.parse(
		replaceSerializedImageSlugReferences(
			serialized,
			oldSegment,
			newSegment,
		),
	);
}

async function updateExistingJsonImageSlugReferences(
	filePath,
	oldSlug,
	newSlug,
) {
	if (!(await exists(filePath))) return;
	const value = await readJson(filePath);
	const normalized = replaceImageSlugReferences(value, oldSlug, newSlug);
	if (normalized !== value) await writeJson(filePath, normalized);
}

async function updateCampaignEntityImageSlugReference(
	campaignSlug,
	type,
	entity,
	oldSlug,
	newSlug,
) {
	const normalized = replaceImageSlugReferences(entity, oldSlug, newSlug);
	if (normalized === entity) return;
	await writeEntity(
		campaignSlug,
		type,
		normalized.slug,
		normalized,
	);
}

async function updateCampaignEntityTypeImageSlugReferences(
	campaignSlug,
	type,
	oldSlug,
	newSlug,
) {
	const entities = await listEntities(campaignSlug, type);
	for (const entity of entities) {
		await updateCampaignEntityImageSlugReference(
			campaignSlug,
			type,
			entity,
			oldSlug,
			newSlug,
		);
	}
}

async function updateCampaignEntityImageSlugReferences(
	campaignSlug,
	oldSlug,
	newSlug,
) {
	for (const type of ENTITY_TYPES) {
		await updateCampaignEntityTypeImageSlugReferences(
			campaignSlug,
			type,
			oldSlug,
			newSlug,
		);
	}
}

async function updateCampaignSessionImageSlugReference(
	campaignSlug,
	session,
	oldSlug,
	newSlug,
) {
	const filePath = sessionPath(campaignSlug, session.fileName);
	const sessionData = await readJson(filePath);
	const normalized = replaceImageSlugReferences(
		sessionData,
		oldSlug,
		newSlug,
	);
	if (normalized !== sessionData) await writeJson(filePath, normalized);
}

async function updateCampaignSessionImageSlugReferences(
	campaignSlug,
	oldSlug,
	newSlug,
) {
	const sessions = await listSessions(campaignSlug);
	for (const session of sessions) {
		await updateCampaignSessionImageSlugReference(
			campaignSlug,
			session,
			oldSlug,
			newSlug,
		);
	}
}

async function updateSingleCampaignImageSlugReferences(
	campaignSlug,
	oldSlug,
	newSlug,
) {
	await updateExistingJsonImageSlugReferences(
		campaignMetaPath(campaignSlug),
		oldSlug,
		newSlug,
	);
	await updateCampaignEntityImageSlugReferences(
		campaignSlug,
		oldSlug,
		newSlug,
	);
	await updateCampaignSessionImageSlugReferences(
		campaignSlug,
		oldSlug,
		newSlug,
	);
	await updateExistingJsonImageSlugReferences(
		campaignAiResponsesPath(campaignSlug),
		oldSlug,
		newSlug,
	);
}

function canUpdateCampaignImageSlugReferences(oldSlug, newSlug) {
	return Boolean(oldSlug && newSlug && oldSlug !== newSlug);
}

async function updateCampaignImageSlugReferences(oldSlug, newSlug) {
	if (!canUpdateCampaignImageSlugReferences(oldSlug, newSlug)) return;
	const campaigns = await listCampaignSlugs();
	for (const campaignSlug of campaigns) {
		await updateSingleCampaignImageSlugReferences(
			campaignSlug,
			oldSlug,
			newSlug,
		);
	}
}

function getCampaignImageRenamePaths(oldSlug, newSlug) {
	const oldImagesDir = path.join(IMAGES_DIR, path.basename(oldSlug));
	const newImagesDir = path.join(IMAGES_DIR, path.basename(newSlug));
	return { oldImagesDir, newImagesDir };
}

async function renameCampaignImageDirectory(oldSlug, newSlug) {
	const { oldImagesDir, newImagesDir } = getCampaignImageRenamePaths(
		oldSlug,
		newSlug,
	);
	if (!(await exists(oldImagesDir))) return;
	if (await exists(newImagesDir)) {
		throw new Error("Campaign images folder already exists.");
	}
	await renameWithRetry(oldImagesDir, newImagesDir);
}

async function renameCampaignData(oldSlug, newSlug) {
	if (!oldSlug || !newSlug || oldSlug === newSlug) return;
	await renameWithRetry(campaignDir(oldSlug), campaignDir(newSlug));
	await renameCampaignImageDirectory(oldSlug, newSlug);
	await updateCampaignImageSlugReferences(oldSlug, newSlug);
}

const CAMPAIGN_SLUG_FIELDS = new Set(["slug", "campaign"]);

function canReplaceCampaignSlug(value, oldSlug, newSlug) {
	if (!value || !oldSlug || !newSlug) return false;
	return oldSlug !== newSlug;
}

function replaceCampaignSlugEntry(entry, oldSlug, newSlug) {
	const [key, value] = entry;
	if (CAMPAIGN_SLUG_FIELDS.has(key) && value === oldSlug) {
		return [key, newSlug];
	}
	return [key, replaceCampaignSlugFields(value, oldSlug, newSlug)];
}

function replaceCampaignSlugFields(value, oldSlug, newSlug) {
	if (!canReplaceCampaignSlug(value, oldSlug, newSlug)) return value;
	if (Array.isArray(value)) {
		return value.map((item) =>
			replaceCampaignSlugFields(item, oldSlug, newSlug),
		);
	}
	if (typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value).map((entry) =>
			replaceCampaignSlugEntry(entry, oldSlug, newSlug),
		),
	);
}

function importedAiResponsePath(response, slug) {
	const responsePath = response?.path;
	if (responsePath && typeof responsePath === "object") {
		return { ...responsePath, campaign: slug };
	}
	return { campaign: slug, session: null, encounter: null };
}

function normalizeImportedAiResource(resource, sourceSlug, slug) {
	return {
		...resource,
		campaign: slug,
		label:
			typeof resource.label === "string"
				? resource.label.replace(sourceSlug, slug)
				: resource.label,
	};
}

function importedAiResponseResources(response, sourceSlug, slug) {
	const resources = response?.changes?.resources;
	if (!Array.isArray(resources)) return [];
	return resources.map((resource) =>
		normalizeImportedAiResource(resource, sourceSlug, slug),
	);
}

function importedAiResponseChanges(response, sourceSlug, slug) {
	return {
		...(response?.changes || {}),
		resources: importedAiResponseResources(response, sourceSlug, slug),
	};
}

function normalizeImportedAiResponse(entry, sourceSlug, slug) {
	const withImageRefs = replaceImageSlugReferences(entry, sourceSlug, slug);
	const response = replaceCampaignSlugFields(withImageRefs, sourceSlug, slug);
	return {
		...response,
		path: importedAiResponsePath(response, slug),
		changes: importedAiResponseChanges(response, sourceSlug, slug),
	};
}

function importedCampaignMeta(bundle) {
	const meta = bundle && bundle.meta;
	if (!meta || !meta.name) throw new Error("Invalid bundle format.");
	return meta;
}

function importedCampaignCollection(value) {
	return Array.isArray(value) ? value : [];
}

function importedCampaignEntityMap(value) {
	if (!value || typeof value !== "object") return {};
	return value;
}

function normalizeCampaignImportBundle(bundle) {
	const meta = importedCampaignMeta(bundle);
	return {
		meta,
		sessions: importedCampaignCollection(bundle.sessions),
		entities: importedCampaignEntityMap(bundle.entities),
		aiResponses: importedCampaignCollection(bundle.aiResponses),
	};
}

function normalizeCampaignImportOptions(options) {
	if (options === null || options === undefined) return {};
	return Object(options);
}

function importedCampaignSourceSlug(meta) {
	return meta.slug || campaignSlug(meta.name);
}

function importedCampaignForcedSlug(options) {
	if (!options.forcedSlug) return null;
	return path.basename(options.forcedSlug);
}

async function importedCampaignTargetSlug(meta, forcedSlug) {
	if (forcedSlug) return forcedSlug;
	return ensureUniqueCampaignSlug(campaignSlug(meta.name));
}

async function createCampaignImportContext(bundle, rawOptions) {
	const normalizedBundle = normalizeCampaignImportBundle(bundle);
	const options = normalizeCampaignImportOptions(rawOptions);
	const sourceSlug = importedCampaignSourceSlug(normalizedBundle.meta);
	const forcedSlug = importedCampaignForcedSlug(options);
	const slug = await importedCampaignTargetSlug(
		normalizedBundle.meta,
		forcedSlug,
	);
	return {
		...normalizedBundle,
		options,
		sourceSlug,
		forcedSlug,
		slug,
		newMeta: null,
	};
}

function shouldReplaceImportedCampaign(context) {
	if (!context.forcedSlug) return false;
	return Boolean(context.options.replaceExisting);
}

async function prepareCampaignImportTarget(context) {
	if (!shouldReplaceImportedCampaign(context)) return;
	if (!(await exists(campaignDir(context.slug)))) return;
	await deleteCampaignData(context.slug);
}

function projectImportedCampaignMeta(context) {
	return {
		...replaceImageSlugReferences(
			context.meta,
			context.sourceSlug,
			context.slug,
		),
		slug: context.slug,
		createdAt: context.meta.createdAt || new Date().toISOString(),
	};
}

async function restoreImportedCampaignMeta(context) {
	context.newMeta = projectImportedCampaignMeta(context);
	await ensureDir(path.join(campaignDir(context.slug), "sessions"));
	await writeJson(campaignMetaPath(context.slug), context.newMeta);
}

function importedSessionDesiredName(session) {
	if (session.fileName) return session.fileName;
	return `${sanitizeName(session.content?.name) || todayString()}.json`;
}

async function restoreImportedSession(context, session) {
	const desiredName = importedSessionDesiredName(session);
	const fileName = await ensureUniqueSessionFile(context.slug, desiredName);
	const content = replaceImageSlugReferences(
		session.content || {},
		context.sourceSlug,
		context.slug,
	);
	await writeJson(sessionPath(context.slug, fileName), content);
}

async function restoreImportedSessions(context) {
	for (const session of context.sessions) {
		await restoreImportedSession(context, session);
	}
}

function importedEntityDesiredSlug(type, entity) {
	if (entity.slug) return entity.slug;
	return campaignSlug(entity.firstName || entity.name || type);
}

function importedEntitiesOfType(context, type) {
	const entities = context.entities[type];
	return Array.isArray(entities) ? entities : [];
}

async function restoreImportedEntity(context, type, entity) {
	const desiredSlug = importedEntityDesiredSlug(type, entity);
	const entitySlug = await ensureUniqueEntitySlug(
		context.slug,
		type,
		desiredSlug,
	);
	const normalized = replaceImageSlugReferences(
		entity,
		context.sourceSlug,
		context.slug,
	);
	await writeEntity(context.slug, type, entitySlug, {
		...normalized,
		slug: entitySlug,
	});
}

async function restoreImportedEntitiesOfType(context, type) {
	for (const entity of importedEntitiesOfType(context, type)) {
		await restoreImportedEntity(context, type, entity);
	}
}

async function restoreImportedEntities(context) {
	for (const type of ENTITY_TYPES) {
		await restoreImportedEntitiesOfType(context, type);
	}
}

async function restoreImportedAiResponses(context) {
	if (context.aiResponses.length === 0) return;
	const responses = context.aiResponses.map((entry) =>
		normalizeImportedAiResponse(entry, context.sourceSlug, context.slug),
	);
	await writeAiResponses(context.slug, responses);
}

async function importCampaignBundle(bundle, options = {}) {
	const context = await createCampaignImportContext(bundle, options);
	await prepareCampaignImportTarget(context);
	await restoreImportedCampaignMeta(context);
	await restoreImportedSessions(context);
	await restoreImportedEntities(context);
	await restoreImportedAiResponses(context);
	return context.newMeta;
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

const restoreCampaignImagesFromArchive = createCampaignArchiveImageRestorer({
	imagesDir: IMAGES_DIR,
	ensureDir,
	writeFile: (targetPath, buffer) => fs.writeFile(targetPath, buffer),
});

async function exportCampaignArchiveBundle(slug) {
	return {
		bundle: await exportCampaignBundle(slug),
		images: await listCampaignImagesForArchive(slug),
	};
}

async function exportApplicationDataArchiveBundle() {
	const [settings, customBestiary, favorites, bestiaryAiResponses, images] =
		await Promise.all([
			readSettings(),
			readCustomBestiary(),
			readFavorites(),
			readAiResponses("bestiary"),
			listCampaignImagesForArchive(""),
		]);
	return { settings, customBestiary, favorites, bestiaryAiResponses, images };
}

async function importApplicationDataArchiveBundle(applicationData) {
	if (!applicationData || typeof applicationData !== "object") return;
	if (applicationData.settings !== undefined) {
		await writeJson(SETTINGS_PATH, normalizeSettings(applicationData.settings));
	}
	if (applicationData.customBestiary !== undefined) {
		await writeJson(CUSTOM_BESTIARY_PATH, applicationData.customBestiary);
	}
	if (applicationData.favorites !== undefined) {
		await writeFavorites(applicationData.favorites);
	}
	if (applicationData.bestiaryAiResponses !== undefined) {
		await writeAiResponses("bestiary", applicationData.bestiaryAiResponses);
	}
	if (applicationData.images !== undefined) {
		await restoreCampaignImagesFromArchive("", applicationData.images);
	}
}

function normalizePartialArchiveSections(sections = []) {
	const allowed = new Set([
		"sessions",
		"npc",
		"locations",
		"images",
		"aiHistory",
	]);
	const selected = (
		Array.isArray(sections) ? sections : String(sections).split(",")
	)
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
		images: selected.includes("images")
			? await listCampaignImagesForArchive(slug)
			: [],
	};
}

const PARTIAL_IMPORT_SECTION_ORDER = Object.freeze([
	"sessions",
	"npc",
	"locations",
	"aiHistory",
	"images",
]);

function normalizePartialImportTarget(targetSlug) {
	return path.basename(String(targetSlug || ""));
}

async function assertPartialImportTargetExists(target) {
	if (target && (await exists(campaignMetaPath(target)))) return;
	throw new Error("Campaign for import was not found.");
}

function getPartialImportBundle(archiveBundle) {
	return archiveBundle?.bundle || {};
}

function getPartialImportSourceSlug(bundle, archiveBundle, target) {
	return bundle.meta?.slug || archiveBundle?.sourceSlug || target;
}

function createPartialImportCounters() {
	return {
		sessions: 0,
		npc: 0,
		locations: 0,
		images: 0,
		aiHistory: 0,
	};
}

function createPartialImportContext(target, archiveBundle) {
	const sections = normalizePartialArchiveSections(
		archiveBundle?.sections || [],
	);
	const bundle = getPartialImportBundle(archiveBundle);
	return {
		target,
		archiveBundle,
		sections,
		bundle,
		sourceSlug: getPartialImportSourceSlug(bundle, archiveBundle, target),
		imported: createPartialImportCounters(),
	};
}

function getPartialImportSessions(bundle) {
	return Array.isArray(bundle.sessions) ? bundle.sessions : [];
}

async function restorePartialImportSession(context, session) {
	const fileName = await resolvePartialImportSessionFileName(
		context.target,
		session,
	);
	const normalizedContent = replaceImageSlugReferences(
		session.content || {},
		context.sourceSlug,
		context.target,
	);
	await writeJson(
		sessionPath(context.target, fileName),
		normalizedContent,
	);
	context.imported.sessions += 1;
}

async function restorePartialImportSessions(context) {
	await ensureDir(path.join(campaignDir(context.target), "sessions"));
	for (const session of getPartialImportSessions(context.bundle)) {
		await restorePartialImportSession(context, session);
	}
}

function getPartialImportEntities(bundle, type) {
	return Array.isArray(bundle.entities?.[type]) ? bundle.entities[type] : [];
}

async function restorePartialImportEntity(context, type, entity) {
	const entitySlug = importedEntitySlug(type, entity);
	const normalizedEntity = replaceImageSlugReferences(
		entity,
		context.sourceSlug,
		context.target,
	);
	await writeEntity(context.target, type, entitySlug, {
		...normalizedEntity,
		slug: entitySlug,
	});
	context.imported[type] += 1;
}

async function restorePartialImportEntities(context, type) {
	for (const entity of getPartialImportEntities(context.bundle, type)) {
		await restorePartialImportEntity(context, type, entity);
	}
}

async function restorePartialImportNpcs(context) {
	await restorePartialImportEntities(context, "npc");
}

async function restorePartialImportLocations(context) {
	await restorePartialImportEntities(context, "locations");
}

function getPartialImportAiResponses(bundle) {
	return Array.isArray(bundle.aiResponses) ? bundle.aiResponses : [];
}

function normalizePartialImportAiResponse(context, entry) {
	return {
		...normalizeImportedAiResponse(
			entry,
			context.sourceSlug,
			context.target,
		),
		id: createId(),
	};
}

async function restorePartialImportAiHistory(context) {
	const existing = await readAiResponses(context.target);
	const incoming = getPartialImportAiResponses(context.bundle).map((entry) =>
		normalizePartialImportAiResponse(context, entry),
	);
	if (incoming.length === 0) return;
	await writeAiResponses(context.target, [...existing, ...incoming]);
	context.imported.aiHistory = incoming.length;
}

function getPartialImportImages(archiveBundle) {
	return Array.isArray(archiveBundle?.images) ? archiveBundle.images : [];
}

async function restorePartialImportImages(context) {
	const images = getPartialImportImages(context.archiveBundle);
	await restoreCampaignImagesFromArchive(context.target, images);
	context.imported.images = images.length;
}

const PARTIAL_IMPORT_SECTION_COMMANDS = new Map([
	["sessions", restorePartialImportSessions],
	["npc", restorePartialImportNpcs],
	["locations", restorePartialImportLocations],
	["aiHistory", restorePartialImportAiHistory],
	["images", restorePartialImportImages],
]);

async function executePartialImportSections(context) {
	for (const section of PARTIAL_IMPORT_SECTION_ORDER) {
		if (!context.sections.includes(section)) continue;
		await PARTIAL_IMPORT_SECTION_COMMANDS.get(section)(context);
	}
}

function partialImportResult(context) {
	return {
		ok: true,
		imported: context.imported,
		sections: context.sections,
	};
}

async function importCampaignPartialArchiveBundle(targetSlug, archiveBundle) {
	const target = normalizePartialImportTarget(targetSlug);
	await assertPartialImportTargetExists(target);
	const context = createPartialImportContext(target, archiveBundle);
	await executePartialImportSections(context);
	return partialImportResult(context);
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
	const sub = subcategory || ""; // Guard against null/undefined.
	const dir = campaignImagesDir(slug, category, sub);
	if (!(await exists(dir))) return [];
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const files = entries
		.filter((e) => e.isFile() && IMAGE_FILE_RE.test(e.name))
		.map(async (e) => ({
			name: e.name,
			url: `/api/images/${encodeURIComponent(slug)}/${encodeURIComponent(category)}${sub ? "/" + encodeURIComponent(sub) : ""}/${encodeURIComponent(e.name)}`,
			path: path.join(category, sub, e.name),
			sizeBytes: await getFileSize(path.join(dir, e.name)),
		}));
	return Promise.all(files);
}

function createBestiaryTokenListContext({
	subcategory,
	search,
	recursive,
	ignoreSourcesList,
}) {
	const subParts = normalizePathSegments(subcategory);
	return {
		subParts,
		query: String(search || "").trim().toLowerCase(),
		recursive,
		ignoredSources: new Set(normalizeSourceList(ignoreSourcesList)),
		baseDir: path.join(BESTIARY_TOKENS_DIR, ...subParts),
	};
}

function getBestiaryTokenRootSource(relativeParts) {
	return String(relativeParts[0] || "").trim().toUpperCase();
}

function isIgnoredBestiaryTokenPath(context, relativeParts) {
	const rootSource = getBestiaryTokenRootSource(relativeParts);
	return Boolean(rootSource && context.ignoredSources.has(rootSource));
}

function emptyBestiaryTokenAssets() {
	return { subcategories: [], images: [] };
}

async function hasReadableBestiaryTokenRoot(context) {
	if (
		context.subParts.length > 0 &&
		isIgnoredBestiaryTokenPath(context, context.subParts)
	) {
		return false;
	}
	return exists(context.baseDir);
}

function getBestiaryTokenDisplayName(context, fileName, folderParts) {
	if (context.query && folderParts.length > 0) {
		return `${path.parse(fileName).name} (${folderParts.join("/")})`;
	}
	return fileName;
}

async function projectBestiaryTokenImage(
	context,
	filePath,
	relativeParts,
) {
	const fileName = relativeParts[relativeParts.length - 1];
	const folderParts = relativeParts.slice(0, -1);
	return {
		name: fileName,
		displayName: getBestiaryTokenDisplayName(
			context,
			fileName,
			folderParts,
		),
		url: `/api/bestiary/tokens/${encodeUrlPathSegments(...relativeParts)}`,
		path: path.join("bestiary", "tokens", ...relativeParts),
		sizeBytes: await getFileSize(filePath),
		readonly: true,
		source: "bestiary",
	};
}

function isBestiaryTokenImageEntry(entry) {
	return entry.isFile() && IMAGE_FILE_RE.test(entry.name);
}

function matchesBestiaryTokenQuery(context, relativeParts) {
	if (!context.query) return true;
	return relativeParts.join("/").toLowerCase().includes(context.query);
}

function shouldCollectRecursiveBestiaryToken(context, entry, relativeParts) {
	return (
		isBestiaryTokenImageEntry(entry) &&
		matchesBestiaryTokenQuery(context, relativeParts)
	);
}

async function visitRecursiveBestiaryTokenEntry(
	context,
	directory,
	relativeParts,
	images,
	entry,
) {
	const nextRelativeParts = [...relativeParts, entry.name];
	if (isIgnoredBestiaryTokenPath(context, nextRelativeParts)) return;
	const nextPath = path.join(directory, entry.name);
	if (entry.isDirectory()) {
		await walkBestiaryTokenDirectory(
			context,
			nextPath,
			nextRelativeParts,
			images,
		);
		return;
	}
	if (!shouldCollectRecursiveBestiaryToken(context, entry, nextRelativeParts)) {
		return;
	}
	images.push(
		await projectBestiaryTokenImage(context, nextPath, nextRelativeParts),
	);
}

async function walkBestiaryTokenDirectory(
	context,
	directory,
	relativeParts,
	images,
) {
	const entries = await fs.readdir(directory, { withFileTypes: true });
	for (const entry of entries) {
		await visitRecursiveBestiaryTokenEntry(
			context,
			directory,
			relativeParts,
			images,
			entry,
		);
	}
}

async function collectRecursiveBestiaryTokenAssets(context) {
	const images = [];
	await walkBestiaryTokenDirectory(
		context,
		context.baseDir,
		context.subParts,
		images,
	);
	images.sort((left, right) =>
		left.displayName.localeCompare(right.displayName),
	);
	return { subcategories: [], images };
}

function collectDirectBestiaryTokenSubcategories(context, entries) {
	const subcategories = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		if (
			isIgnoredBestiaryTokenPath(context, [
				...context.subParts,
				entry.name,
			])
		) {
			continue;
		}
		subcategories.push(entry.name);
	}
	return subcategories.sort((left, right) => left.localeCompare(right));
}

async function collectDirectBestiaryTokenImages(context, entries) {
	const images = await Promise.all(
		entries.filter(isBestiaryTokenImageEntry).map((entry) =>
			projectBestiaryTokenImage(
				context,
				path.join(context.baseDir, entry.name),
				[...context.subParts, entry.name],
			),
		),
	);
	return images.sort((left, right) => left.name.localeCompare(right.name));
}

async function collectDirectBestiaryTokenAssets(context) {
	const entries = await fs.readdir(context.baseDir, { withFileTypes: true });
	return {
		subcategories: collectDirectBestiaryTokenSubcategories(context, entries),
		images: await collectDirectBestiaryTokenImages(context, entries),
	};
}

function shouldRecursivelyListBestiaryTokens(context) {
	return Boolean(context.query || context.recursive);
}

async function listBestiaryTokenAssets({
	subcategory = "",
	search = "",
	recursive = false,
	ignoreSourcesList = [],
} = {}) {
	const context = createBestiaryTokenListContext({
		subcategory,
		search,
		recursive,
		ignoreSourcesList,
	});
	if (!(await hasReadableBestiaryTokenRoot(context))) {
		return emptyBestiaryTokenAssets();
	}
	if (shouldRecursivelyListBestiaryTokens(context)) {
		return collectRecursiveBestiaryTokenAssets(context);
	}
	return collectDirectBestiaryTokenAssets(context);
}

function normalizeImageSearchCategoryFilter(categories) {
	return new Set(
		(Array.isArray(categories) ? categories : [])
			.map((category) => String(category || "").trim())
			.filter(Boolean),
	);
}

function createImageSearchContext({
	search,
	source,
	category,
	subcategory,
	categories,
	ignoreSourcesList,
}) {
	const selectedSubParts = normalizePathSegments(subcategory);
	return {
		query: String(search || "").trim().toLowerCase(),
		sourceFilter: String(source || "").trim(),
		selectedCategory: String(category || "").trim(),
		selectedSubcategory: selectedSubParts.join("/"),
		selectedSubParts,
		categoryFilter: normalizeImageSearchCategoryFilter(categories),
		ignoreSourcesList,
		images: [],
	};
}

function isImageSearchCategoryIncluded(context, category) {
	if (context.selectedCategory && category !== context.selectedCategory) {
		return false;
	}
	return context.categoryFilter.size === 0 || context.categoryFilter.has(category);
}

function matchesUserImageSearch(
	context,
	entryName,
	source,
	category,
	subcategory,
) {
	const searchText = [entryName, source, category, subcategory]
		.filter(Boolean)
		.join("/")
		.toLowerCase();
	return !context.query || searchText.includes(context.query);
}

async function projectUserSearchImage(
	context,
	source,
	category,
	subcategory,
	entryName,
	filePath,
) {
	if (
		!matchesUserImageSearch(
			context,
			entryName,
			source,
			category,
			subcategory,
		)
	) {
		return null;
	}
	const urlSub = subcategory
		? `/${encodeUrlPathSegments(subcategory)}`
		: "";
	return {
		name: entryName,
		displayName: path.parse(entryName).name,
		url: `/api/images/${encodeURIComponent(source)}/${encodeURIComponent(category)}${urlSub}/${encodeURIComponent(entryName)}`,
		path: path.join(category, subcategory, entryName),
		sizeBytes: await getFileSize(filePath),
		source,
		category,
		subcategory,
		locationLabel: [source, category, subcategory].filter(Boolean).join(" / "),
		readonly: false,
		globalSearch: true,
	};
}

function isUserSearchImageEntry(entry) {
	return entry.isFile() && IMAGE_FILE_RE.test(entry.name);
}

async function visitUserImageSearchEntry(context, traversal, entry) {
	const nextPath = path.join(traversal.directory, entry.name);
	if (entry.isDirectory()) {
		await walkUserImageSearchDirectory(context, {
			...traversal,
			directory: nextPath,
			nestedSubParts: [...traversal.nestedSubParts, entry.name],
		});
		return;
	}
	if (!isUserSearchImageEntry(entry)) return;
	const fullSubParts = [
		...context.selectedSubParts,
		...traversal.nestedSubParts,
	];
	const image = await projectUserSearchImage(
		context,
		traversal.source,
		traversal.category,
		fullSubParts.join("/"),
		entry.name,
		nextPath,
	);
	if (image) context.images.push(image);
}

async function walkUserImageSearchDirectory(context, traversal) {
	const entries = await fs.readdir(traversal.directory, {
		withFileTypes: true,
	});
	for (const entry of entries) {
		await visitUserImageSearchEntry(context, traversal, entry);
	}
}

async function visitImageSearchCategory(context, sourceTraversal, entry) {
	if (!entry.isDirectory()) return;
	const category = entry.name;
	if (!isImageSearchCategoryIncluded(context, category)) return;
	const directory = path.join(
		sourceTraversal.directory,
		category,
		...context.selectedSubParts,
	);
	if (!(await exists(directory))) return;
	await walkUserImageSearchDirectory(context, {
		directory,
		source: sourceTraversal.source,
		category,
		nestedSubParts: [],
	});
}

function isIncludedImageSearchSource(context, entry) {
	if (!entry.isDirectory()) return false;
	return !context.sourceFilter || entry.name === context.sourceFilter;
}

async function visitImageSearchSource(context, entry) {
	if (!isIncludedImageSearchSource(context, entry)) return;
	const source = entry.name;
	const directory = path.join(IMAGES_DIR, source);
	const categoryEntries = await fs.readdir(directory, { withFileTypes: true });
	for (const categoryEntry of categoryEntries) {
		await visitImageSearchCategory(
			context,
			{ directory, source },
			categoryEntry,
		);
	}
}

async function collectUserImageSearchResults(context) {
	if (!(await exists(IMAGES_DIR))) return;
	const sourceEntries = await fs.readdir(IMAGES_DIR, { withFileTypes: true });
	for (const sourceEntry of sourceEntries) {
		await visitImageSearchSource(context, sourceEntry);
	}
}

function shouldIncludeOfficialImageSearch(context) {
	if (context.sourceFilter && context.sourceFilter !== "general") return false;
	return isImageSearchCategoryIncluded(context, "tokens");
}

function getOfficialImageSearchSubcategory(context) {
	return context.selectedCategory === "tokens"
		? context.selectedSubcategory
		: "";
}

function projectOfficialSearchImage(image) {
	const relativeParts = String(image.path || "")
		.split(/[\\/]+/)
		.filter(Boolean)
		.slice(2);
	const subcategory = relativeParts.slice(0, -1).join("/");
	return {
		...image,
		assetSource: image.source,
		source: "general",
		category: "tokens",
		subcategory,
		locationLabel: ["general", "tokens", subcategory]
			.filter(Boolean)
			.join(" / "),
		globalSearch: true,
	};
}

async function collectOfficialImageSearchResults(context) {
	if (!shouldIncludeOfficialImageSearch(context)) return;
	const officialAssets = await listBestiaryTokenAssets({
		subcategory: getOfficialImageSearchSubcategory(context),
		search: context.query,
		ignoreSourcesList: context.ignoreSourcesList,
	});
	for (const image of officialAssets.images) {
		context.images.push(projectOfficialSearchImage(image));
	}
}

function imageSearchSortName(image) {
	return String(image.displayName || image.name);
}

function sortImageSearchResults(images) {
	images.sort((left, right) =>
		imageSearchSortName(left).localeCompare(imageSearchSortName(right)),
	);
}

async function searchImageGalleryAssets({
	search = "",
	source = "",
	category = "",
	subcategory = "",
	categories = [],
	ignoreSourcesList = [],
} = {}) {
	const context = createImageSearchContext({
		search,
		source,
		category,
		subcategory,
		categories,
		ignoreSourcesList,
	});
	await collectUserImageSearchResults(context);
	await collectOfficialImageSearchResults(context);
	sortImageSearchResults(context.images);
	return { images: context.images };
}

function normalizeImageGalleryStatsCategoryIds(categories) {
	if (!Array.isArray(categories)) return [];
	return categories.map((item) => String(item || "")).filter(Boolean);
}

function createImageGalleryStatsContext({
	source,
	category,
	subcategory,
	categories,
}) {
	const sourceSlug = path.basename(String(source || "general"));
	return {
		rootDir: IMAGES_DIR,
		sourceSlug,
		sourceDir: path.join(IMAGES_DIR, sourceSlug),
		selectedCategory: String(category || ""),
		selectedSubcategory: String(subcategory || ""),
		categoryIds: normalizeImageGalleryStatsCategoryIds(categories),
	};
}

async function listDirectoryNames(directory) {
	if (!(await exists(directory))) return [];
	const entries = await fs.readdir(directory, { withFileTypes: true });
	return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

async function measureNamedDirectories(directory, names) {
	const sizes = {};
	for (const name of names) {
		sizes[name] = await getDirectorySize(path.join(directory, name));
	}
	return sizes;
}

async function getImageGalleryStatsCategoryNames(context) {
	if (context.categoryIds.length > 0) return context.categoryIds;
	return listDirectoryNames(context.sourceDir);
}

async function getSelectedImageGalleryCategorySize(context) {
	if (!context.selectedCategory) return 0;
	return getDirectorySize(
		path.join(context.sourceDir, context.selectedCategory),
	);
}

async function getSelectedImageGallerySubcategorySize(context) {
	if (!context.selectedCategory) return 0;
	return getDirectorySize(
		path.join(
			context.sourceDir,
			context.selectedCategory,
			context.selectedSubcategory,
		),
	);
}

async function projectImageGalleryStorageStats(
	context,
	sourceSizes,
	categorySizes,
) {
	return {
		totalBytes: await getDirectorySize(context.rootDir),
		sourceBytes: await getDirectorySize(context.sourceDir),
		categoryBytes: await getSelectedImageGalleryCategorySize(context),
		subcategoryBytes: await getSelectedImageGallerySubcategorySize(context),
		sourceSizes,
		categorySizes,
	};
}

async function getImageGalleryStorageStats({
	source = "general",
	category = "",
	subcategory = "",
	categories = [],
} = {}) {
	const context = createImageGalleryStatsContext({
		source,
		category,
		subcategory,
		categories,
	});
	const sourceNames = await listDirectoryNames(context.rootDir);
	const sourceSizes = await measureNamedDirectories(
		context.rootDir,
		sourceNames,
	);
	const categoryNames = await getImageGalleryStatsCategoryNames(context);
	const categorySizes = await measureNamedDirectories(
		context.sourceDir,
		categoryNames,
	);
	return projectImageGalleryStorageStats(context, sourceSizes, categorySizes);
}

async function listSubcategories(slug, category, subcategory = "", options = {}) {
	const dir = campaignImagesDir(slug, category, subcategory);
	if (!(await exists(dir))) return [];
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const subcategories = entries
		.filter((e) => e.isDirectory())
		.map((e) => e.name)
		.sort((a, b) => a.localeCompare(b));
	if (!options.includeMeta) return subcategories;

	return Promise.all(
		subcategories.map(async (name) => {
			const subDir = path.join(dir, name);
			const subEntries = await fs.readdir(subDir, { withFileTypes: true });
			return {
				name,
				hasFiles: subEntries.some(
					(entry) => entry.isFile() && IMAGE_FILE_RE.test(entry.name),
				),
			};
		}),
	);
}

function replaceExactImageUrl(target, moveResults) {
	let changed = false;
	for (const result of moveResults) {
		if (target.imageUrl !== result.oldUrl) continue;
		target.imageUrl = result.newUrl;
		changed = true;
	}
	return changed;
}

function replaceSerializedImageUrls(value, moveResults) {
	let json = JSON.stringify(value);
	let changed = false;
	for (const result of moveResults) {
		if (!json.includes(result.oldUrl)) continue;
		json = json.split(result.oldUrl).join(result.newUrl);
		changed = true;
	}
	return changed ? JSON.parse(json) : null;
}

async function updateCampaignMetadataImageReferences(slug, moveResults) {
	const metaPath = campaignMetaPath(slug);
	if (!(await exists(metaPath))) return;
	const metadata = await readJson(metaPath);
	if (replaceExactImageUrl(metadata, moveResults)) {
		await writeJson(metaPath, metadata);
	}
}

async function updateCampaignEntityImageReferences(slug, type, moveResults) {
	const entities = await listEntities(slug, type);
	for (const entity of entities) {
		if (replaceExactImageUrl(entity, moveResults)) {
			await writeEntity(slug, type, entity.slug, entity);
		}
	}
}

async function updateCampaignEntitiesImageReferences(slug, moveResults) {
	for (const type of ENTITY_TYPES) {
		await updateCampaignEntityImageReferences(slug, type, moveResults);
	}
}

async function updateCampaignSessionImageReferences(slug, moveResults) {
	const sessions = await listSessions(slug);
	for (const session of sessions) {
		const targetPath = sessionPath(slug, session.fileName);
		const sessionData = await readJson(targetPath);
		const updatedSession = replaceSerializedImageUrls(sessionData, moveResults);
		if (updatedSession) await writeJson(targetPath, updatedSession);
	}
}

async function updateCampaignImageReferences(slug, moveResults) {
	await updateCampaignMetadataImageReferences(slug, moveResults);
	await updateCampaignEntitiesImageReferences(slug, moveResults);
	await updateCampaignSessionImageReferences(slug, moveResults);
}

async function updateAllImageReferences(moveResults) {
	if (!moveResults.length) return;
	const campaigns = await listCampaignSlugs();
	for (const slug of campaigns) {
		await updateCampaignImageReferences(slug, moveResults);
	}
}

function createImageMoveContext(src, dest) {
	const sourceSlug = decodeURIComponent(src.slug);
	const destinationSlug = decodeURIComponent(dest.slug);
	const sourceSubcategory = src.subcategory || "";
	const destinationSubcategory = dest.subcategory || "";
	return {
		src,
		dest,
		sourceSlug,
		destinationSlug,
		sourceSubcategory,
		destinationSubcategory,
		sourceDir: campaignImagesDir(
			sourceSlug,
			src.category,
			sourceSubcategory,
		),
		destinationDir: campaignImagesDir(
			destinationSlug,
			dest.category,
			destinationSubcategory,
		),
	};
}

async function collectNestedDirectoryFiles(dir, subcategory = "", files = []) {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const relativePath = path.join(subcategory, entry.name);
		if (entry.isFile()) files.push(relativePath);
		else if (entry.isDirectory()) {
			await collectNestedDirectoryFiles(path.join(dir, entry.name), relativePath, files);
		}
	}
	return files;
}

function getMovedImageSubcategory(base, name, relativePath, isDirectory) {
	if (!isDirectory) return base;
	return base
		? path.join(base, name, relativePath)
		: path.join(name, relativePath);
}

function createMovedImageUrl(slug, category, subcategory, fileName, isDirectory) {
	const urlSubcategory = subcategory
		? `/${subcategory.split(path.sep).join("/")}`
		: "";
	const urlFileName = isDirectory ? "" : `/${encodeURIComponent(fileName)}`;
	return `/api/images/${encodeURIComponent(slug)}/${encodeURIComponent(category)}${urlSubcategory}${urlFileName}`;
}

function projectMovedImageResult(context, name, relativePath, isDirectory) {
	const fileName = isDirectory ? relativePath : name;
	const sourceSubcategory = getMovedImageSubcategory(
		context.sourceSubcategory,
		name,
		relativePath,
		isDirectory,
	);
	const destinationSubcategory = getMovedImageSubcategory(
		context.destinationSubcategory,
		name,
		relativePath,
		isDirectory,
	);
	return {
		oldUrl: createMovedImageUrl(
			context.sourceSlug,
			context.src.category,
			sourceSubcategory,
			fileName,
			isDirectory,
		),
		newUrl: createMovedImageUrl(
			context.destinationSlug,
			context.dest.category,
			destinationSubcategory,
			fileName,
			isDirectory,
		),
	};
}

async function getMovedItemFiles(oldPath, isDirectory) {
	return isDirectory ? collectNestedDirectoryFiles(oldPath) : [""];
}

async function moveImageItem(name, context) {
	const oldPath = path.join(context.sourceDir, name);
	if (!(await exists(oldPath))) return [];
	const newPath = path.join(context.destinationDir, name);
	const isDirectory = (await fs.stat(oldPath)).isDirectory();
	const filesToTrack = await getMovedItemFiles(oldPath, isDirectory);
	await renameWithRetry(oldPath, newPath);
	return filesToTrack.map((relativePath) =>
		projectMovedImageResult(context, name, relativePath, isDirectory),
	);
}

async function moveImages(items, src, dest) {
	const context = createImageMoveContext(src, dest);
	if (context.sourceDir === context.destinationDir) return [];
	await ensureDir(context.destinationDir);
	const results = [];
	for (const name of items) {
		results.push(...(await moveImageItem(name, context)));
	}
	await updateAllImageReferences(results);
	return results;
}

function createImageFileUrl(slug, category, subcategory, fileName) {
	const urlSubcategory = subcategory
		? `/${subcategory.split(path.sep).join("/")}`
		: "";
	return `/api/images/${encodeURIComponent(slug)}/${encodeURIComponent(category)}${urlSubcategory}/${encodeURIComponent(fileName)}`;
}

async function validateImageRename(oldPath, newPath) {
	if (!(await exists(oldPath))) throw new Error("File was not found.");
	if (oldPath !== newPath && (await exists(newPath))) {
		throw new Error("File already exists.");
	}
}

async function renameImage(slug, category, subcategory, oldName, newName) {
	const dir = campaignImagesDir(slug, category, subcategory);
	const oldPath = path.join(dir, oldName);
	const newPath = path.join(dir, newName);
	await validateImageRename(oldPath, newPath);
	await renameWithRetry(oldPath, newPath);
	const normalizedSubcategory = subcategory || "";
	const result = {
		oldUrl: createImageFileUrl(slug, category, normalizedSubcategory, oldName),
		newUrl: createImageFileUrl(slug, category, normalizedSubcategory, newName),
	};
	await updateAllImageReferences([result]);
	return result;
}

function createImageDeleteContext(src, options) {
	const slug = decodeURIComponent(src.slug);
	const subcategory = src.subcategory || "";
	return {
		slug,
		category: src.category,
		subcategory,
		dir: campaignImagesDir(slug, src.category, subcategory),
		extractFolderContents: Boolean(options.extractFolderContents),
	};
}

async function extractImageFolderContents(name, target, context) {
	const nestedItems = await fs.readdir(target);
	if (nestedItems.length === 0) return;
	const nestedSubcategory = context.subcategory
		? path.join(context.subcategory, name)
		: name;
	await moveImages(
		nestedItems,
		{
			slug: context.slug,
			category: context.category,
			subcategory: nestedSubcategory,
		},
		{
			slug: context.slug,
			category: context.category,
			subcategory: context.subcategory,
		},
	);
}

async function deleteImageItem(name, context) {
	const target = path.join(context.dir, name);
	if (!(await exists(target))) return;
	const stats = await fs.stat(target);
	if (context.extractFolderContents && stats.isDirectory()) {
		await extractImageFolderContents(name, target, context);
	}
	await fs.rm(target, { recursive: true, force: true });
}

async function deleteImages(items, src, options = {}) {
	const context = createImageDeleteContext(src, options);
	for (const name of items) {
		await deleteImageItem(name, context);
	}
}

async function renameSubcategory(slug, category, oldName, newName) {
	const root = path.join(IMAGES_DIR, path.basename(slug), category);
	const oldPath = path.join(root, oldName);
	const newPath = path.join(root, newName);

	if (!(await exists(oldPath))) {
		throw new Error("Subcategory was not found.");
	}
	if (oldPath !== newPath && (await exists(newPath))) {
		throw new Error("Subcategory already exists.");
	}
	await fs.rename(oldPath, newPath);
}

module.exports = {
	DATA_DIR,
	CAMPAIGNS_DIR,
	BESTIARY_DIR,
	CUSTOM_BESTIARY_SOURCE,
	SPELLS_DIR,
	IMAGES_DIR,
	ENTITY_TYPES,
	createId,
	sanitizeName,
	campaignSlug,
	sessionFileName,
	campaignDir,
	campaignAiResponsesPath,
	aiResponsesPath,
	campaignImagesDir,
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
	getAiResponsesStorageStats,
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
	exportApplicationDataArchiveBundle,
	exportCampaignPartialArchiveBundle,
	importCampaignBundle,
	importCampaignArchiveBundleWithStrategy,
	importApplicationDataArchiveBundle,
	importCampaignPartialArchiveBundle,
	findCampaignSlugById,
	campaignHasImages,
	deleteCampaignData,
	renameCampaignData,
	replaceImageSlugReferences,
	clearAllCampaignData,
	ensureUniqueCampaignSlug,
	ensureUniqueSessionFile,
	ensureUniqueEntitySlug,
	makeDefaultSessionData,
	getBestiaryIndex,
	readCustomBestiary,
	readCustomBestiaryMonsters,
	normalizeCustomBestiaryMonster,
	normalizeSourceList,
	writeCustomBestiaryMonsters,
	listImages,
	listBestiaryTokenAssets,
	searchImageGalleryAssets,
	getImageGalleryStorageStats,
	listSubcategories,
	moveImages,
	renameSubcategory,
	renameImage,
	deleteImages,
};
