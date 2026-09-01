const storage = require("./storage");
const { normalizeCustomMonster } = require("./aiCustomMonsterService");
const {
	coerceAiText: asText,
	sanitizeAiName: sanitizeEntityName,
} = require("./ai/textUtils");
const {
	getCharacterDisplayName,
	getLocationDisplayName,
} = require("./ai/entityDisplayUtils");

function makeId() {
	return storage.createId();
}

function hasOwn(value, key) {
	return Boolean(
		value &&
		typeof value === "object" &&
		Object.prototype.hasOwnProperty.call(value, key),
	);
}

function firstOwnedValue(value, keys) {
	for (const key of keys) {
		if (hasOwn(value, key)) return value[key];
	}
	return undefined;
}

function asNormalizationRecord(value) {
	return value && typeof value === "object" && !Array.isArray(value)
		? value
		: {};
}

function getExplicitNameParts(raw) {
	return {
		firstName: sanitizeEntityName(raw.firstName || raw.first_name),
		lastName: sanitizeEntityName(raw.lastName || raw.last_name),
	};
}

function hasExplicitNamePart(parts) {
	return Boolean(parts.firstName || parts.lastName);
}

function getFullNameParts(raw) {
	const fullName = sanitizeEntityName(raw.name || raw.fullName || raw.title);
	return fullName ? fullName.split(/\s+/).filter(Boolean) : [];
}

function projectFullNameParts(parts) {
	return {
		firstName: parts[0] || "",
		lastName: parts.slice(1).join(" "),
	};
}

function parseNameParts(raw = {}) {
	const source = asNormalizationRecord(raw);
	const explicit = getExplicitNameParts(source);
	return hasExplicitNamePart(explicit)
		? explicit
		: projectFullNameParts(getFullNameParts(source));
}

function isEmptyLevelString(value) {
	return typeof value === "string" && value.trim() === "";
}

function parseLevelNumber(value) {
	return Number.parseInt(String(value ?? "1"), 10);
}

function clampLevel(parsed) {
	return Number.isFinite(parsed) ? Math.min(20, Math.max(1, parsed)) : 1;
}

function normalizeLevel(rawLevel) {
	return isEmptyLevelString(rawLevel) ? "" : clampLevel(parseLevelNumber(rawLevel));
}

function buildStringNote(note) {
	return {
		id: makeId(),
		title: "",
		text: note.trim(),
		collapsed: false,
	};
}

function isNoteRecord(note) {
	return Boolean(note && typeof note === "object" && !Array.isArray(note));
}

function getNormalizedNoteTitle(note, simplifiedNotes) {
	return simplifiedNotes ? "" : asText(note.title || note.name);
}

function getNormalizedNoteText(note) {
	return String(note.text ?? note.description ?? note.content ?? "");
}

function buildObjectNote(note, simplifiedNotes) {
	return {
		id: note.id || makeId(),
		title: getNormalizedNoteTitle(note, simplifiedNotes),
		text: getNormalizedNoteText(note),
		collapsed: Boolean(note.collapsed),
	};
}

function normalizeNote(note, options = {}) {
	if (typeof note === "string") return buildStringNote(note);
	if (!isNoteRecord(note)) return null;
	return buildObjectNote(note, Boolean(options?.simplifiedNotes));
}

function normalizeNotes(
	notes,
	{ keepAtLeastOne = false, simplifiedNotes = false } = {},
) {
	const list = Array.isArray(notes) ? notes : [];
	const normalized = list
		.map((note) => normalizeNote(note, { simplifiedNotes }))
		.filter(
			(note) =>
				note &&
				(String(note.title || "").trim() || String(note.text || "").trim()),
		);
	if (keepAtLeastOne && normalized.length === 0) {
		normalized.push({ id: makeId(), title: "", text: "", collapsed: false });
	}
	return normalized;
}

function noteSignature(note = {}) {
	if (typeof note === "string") {
		return JSON.stringify({ title: "", text: note });
	}
	return JSON.stringify({
		title: asText(note.title),
		text: asText(note.text),
	});
}

function isAiIgnored(value = {}) {
	return Boolean(value?._aiIgnored);
}

function normalizeNotesPreservingExisting(
	notes,
	existingNotes = [],
	{ keepAtLeastOne = false, simplifiedNotes = false } = {},
) {
	const normalized = normalizeNotes(notes, { keepAtLeastOne, simplifiedNotes });
	const existingById = new Map(
		(existingNotes || [])
			.map((note) => [asText(note?.id), note])
			.filter(([id]) => Boolean(id)),
	);
	const existingByContent = new Map(
		(existingNotes || [])
			.map((note) => [noteSignature(note), note])
			.filter(([signature]) => signature !== noteSignature()),
	);

	return normalized.map((note) => {
		const existing =
			existingById.get(asText(note.id)) ||
			existingByContent.get(noteSignature(note));
		if (!existing) return note;
		return {
			...note,
			id: existing.id,
			collapsed: Boolean(existing.collapsed),
		};
	});
}

function asNoteCollection(value) {
	return Array.isArray(value) ? value : [];
}

function getNoteId(note) {
	return asText(note?.id);
}

function collectIgnoredNoteEntries(notes) {
	return notes.flatMap((note, originalIndex) =>
		isAiIgnored(note) ? [{ note, originalIndex }] : [],
	);
}

function getIgnoredNoteIds(entries) {
	return new Set(entries.map(({ note }) => getNoteId(note)).filter(Boolean));
}

function removeIgnoredIdCollisions(notes, ignoredIds) {
	return asNoteCollection(notes).filter((note) => {
		const id = getNoteId(note);
		return !id || !ignoredIds.has(id);
	});
}

function indexNotesById(notes) {
	return new Map(
		notes
			.map((note, index) => [getNoteId(note), index])
			.filter(([id]) => Boolean(id)),
	);
}

function findPreviousVisibleId(notes, originalIndex) {
	for (let index = originalIndex - 1; index >= 0; index -= 1) {
		const note = notes[index];
		const id = getNoteId(note);
		if (!isAiIgnored(note) && id) return id;
	}
	return "";
}

function findNextVisibleId(notes, originalIndex) {
	for (let index = originalIndex + 1; index < notes.length; index += 1) {
		const note = notes[index];
		const id = getNoteId(note);
		if (!isAiIgnored(note) && id) return id;
	}
	return "";
}

function getIgnoredNoteInsertionIndex(
	entry,
	existingNotes,
	visibleIndexById,
	visibleCount,
) {
	const previousIndex = visibleIndexById.get(
		findPreviousVisibleId(existingNotes, entry.originalIndex),
	);
	if (previousIndex !== undefined) return previousIndex + 1;

	const nextIndex = visibleIndexById.get(
		findNextVisibleId(existingNotes, entry.originalIndex),
	);
	return nextIndex ?? Math.min(entry.originalIndex, visibleCount);
}

function planIgnoredNoteInsertions(entries, existingNotes, visibleNotes) {
	const buckets = Array.from({ length: visibleNotes.length + 1 }, () => []);
	const visibleIndexById = indexNotesById(visibleNotes);
	for (const entry of entries) {
		const index = getIgnoredNoteInsertionIndex(
			entry,
			existingNotes,
			visibleIndexById,
			visibleNotes.length,
		);
		buckets[index].push(entry.note);
	}
	return buckets;
}

function materializeNoteInsertions(visibleNotes, buckets) {
	return visibleNotes
		.flatMap((note, index) => [...buckets[index], note])
		.concat(buckets[visibleNotes.length]);
}

function mergeAiIgnoredNotes(existingNotes = [], visibleNotes = []) {
	const existing = asNoteCollection(existingNotes);
	const ignoredEntries = collectIgnoredNoteEntries(existing);
	if (ignoredEntries.length === 0) return visibleNotes;

	const visible = removeIgnoredIdCollisions(
		visibleNotes,
		getIgnoredNoteIds(ignoredEntries),
	);
	const insertions = planIgnoredNoteInsertions(
		ignoredEntries,
		existing,
		visible,
	);
	return materializeNoteInsertions(visible, insertions);
}

const CHARACTER_NAME_KEYS = Object.freeze([
	"name",
	"fullName",
	"title",
	"firstName",
	"first_name",
	"lastName",
	"last_name",
]);

const CHARACTER_FIELD_ALIASES = Object.freeze({
	race: Object.freeze(["race", "species"]),
	class: Object.freeze(["class", "role"]),
	motivation: Object.freeze(["motivation", "goal"]),
	description: Object.freeze(["description", "bio", "backstory"]),
	trait: Object.freeze(["trait", "personality", "quirk"]),
});

function hasCharacterNameInput(raw) {
	return CHARACTER_NAME_KEYS.some((key) => hasOwn(raw, key));
}

function getExistingEntityNotes(existing) {
	return Array.isArray(existing?.notes) ? existing.notes : [];
}

function getEntityNotesSource(raw, existingNotes) {
	return Array.isArray(raw.notes) ? raw.notes : existingNotes;
}

function normalizeEntityNotes(raw, existing, simplifiedNotes) {
	const existingNotes = getExistingEntityNotes(existing);
	const notes = normalizeNotesPreservingExisting(
		getEntityNotesSource(raw, existingNotes),
		existingNotes,
		{ keepAtLeastOne: true, simplifiedNotes },
	);
	return mergeAiIgnoredNotes(existingNotes, notes);
}

function getCharacterNamePart(hasNameInput, parsedValue, existingValue) {
	return hasNameInput ? parsedValue : existingValue || "";
}

function getCharacterFieldValue(raw, aliases, existingValue) {
	const rawValue = firstOwnedValue(raw, aliases);
	return rawValue !== undefined ? asText(rawValue) : existingValue || "";
}

function getCharacterLevel(raw, existing) {
	return normalizeLevel(hasOwn(raw, "level") ? raw.level : existing?.level);
}

function getEntityBooleanState(raw, existing, key) {
	return Boolean(existing?.[key] ?? raw[key] ?? false);
}

function getEntityImageUrl(raw, existing) {
	return existing?.imageUrl ?? raw.imageUrl ?? null;
}

function getExistingEntity(existing) {
	return existing || {};
}

function getEntityId(existing) {
	return existing.id || makeId();
}

function normalizeCharacter(
	raw,
	existing = null,
	{ simplifiedNotes = false } = {},
) {
	const previous = getExistingEntity(existing);
	const nameParts = parseNameParts(raw);
	const hasNameInput = hasCharacterNameInput(raw);
	return {
		id: getEntityId(previous),
		firstName: getCharacterNamePart(
			hasNameInput,
			nameParts.firstName,
			previous.firstName,
		),
		lastName: getCharacterNamePart(
			hasNameInput,
			nameParts.lastName,
			previous.lastName,
		),
		race: getCharacterFieldValue(
			raw,
			CHARACTER_FIELD_ALIASES.race,
			previous.race,
		),
		class: getCharacterFieldValue(
			raw,
			CHARACTER_FIELD_ALIASES.class,
			previous.class,
		),
		level: getCharacterLevel(raw, previous),
		motivation: getCharacterFieldValue(
			raw,
			CHARACTER_FIELD_ALIASES.motivation,
			previous.motivation,
		),
		description: getCharacterFieldValue(
			raw,
			CHARACTER_FIELD_ALIASES.description,
			previous.description,
		),
		trait: getCharacterFieldValue(
			raw,
			CHARACTER_FIELD_ALIASES.trait,
			previous.trait,
		),
		notes: normalizeEntityNotes(raw, previous, simplifiedNotes),
		collapsed: getEntityBooleanState(raw, previous, "collapsed"),
		isNotesCollapsed: getEntityBooleanState(
			raw,
			previous,
			"isNotesCollapsed",
		),
		imageUrl: getEntityImageUrl(raw, previous),
	};
}

const LOCATION_NAME_ALIASES = Object.freeze(["name", "title"]);
const LOCATION_DESCRIPTION_ALIASES = Object.freeze([
	"description",
	"summary",
	"text",
]);

function getLocationName(raw, existing) {
	const rawName = firstOwnedValue(raw, LOCATION_NAME_ALIASES);
	if (rawName === undefined) return existing.name || "";
	return sanitizeEntityName(rawName);
}

function getLocationDescription(raw, existing) {
	const rawDescription = firstOwnedValue(raw, LOCATION_DESCRIPTION_ALIASES);
	if (rawDescription === undefined) return existing.description || "";
	return asText(rawDescription);
}

function normalizeLocation(
	raw,
	existing = null,
	{ simplifiedNotes = false } = {},
) {
	const previous = getExistingEntity(existing);
	return {
		id: getEntityId(previous),
		name: getLocationName(raw, previous),
		description: getLocationDescription(raw, previous),
		notes: normalizeEntityNotes(raw, previous, simplifiedNotes),
		collapsed: getEntityBooleanState(raw, previous, "collapsed"),
		isNotesCollapsed: getEntityBooleanState(
			raw,
			previous,
			"isNotesCollapsed",
		),
		imageUrl: getEntityImageUrl(raw, previous),
	};
}

const SCENE_TEXT_FIELDS = Object.freeze([
	"summary",
	"goal",
	"stakes",
	"location",
]);

function getSceneTextSource(rawScene) {
	if (rawScene.texts && typeof rawScene.texts === "object") {
		return rawScene.texts;
	}
	return rawScene;
}

function getSceneTextValue(source, existingTexts, field) {
	if (hasOwn(source, field)) return asText(source[field]);
	return existingTexts?.[field] || "";
}

function normalizeSceneTexts(rawScene = {}, existingTexts = {}) {
	const source = getSceneTextSource(rawScene);
	return {
		summary: getSceneTextValue(source, existingTexts, "summary"),
		goal: getSceneTextValue(source, existingTexts, "goal"),
		stakes: getSceneTextValue(source, existingTexts, "stakes"),
		location: getSceneTextValue(source, existingTexts, "location"),
	};
}

function getSceneContentList(value) {
	return Array.isArray(value) ? value : [];
}

function hasSceneTextContent(scene) {
	const texts = scene.texts || {};
	return SCENE_TEXT_FIELDS.some((field) => Boolean(asText(texts?.[field])));
}

function hasAliasedSceneItemContent(item, primaryField, secondaryField) {
	return Boolean(asText(item?.[primaryField] || item?.[secondaryField]));
}

function hasSceneNoteContent(note) {
	return hasAliasedSceneItemContent(note, "title", "text");
}

function hasSceneNpcContent(npc) {
	return hasAliasedSceneItemContent(npc, "name", "description");
}

function hasSceneCollectionContent(value, predicate) {
	return getSceneContentList(value).some(predicate);
}

function hasSceneResourceContent(scene) {
	return Boolean(asText(scene.encounterId) || asText(scene.imageUrl));
}

function hasSceneContent(scene = {}) {
	return [
		hasSceneTextContent(scene),
		hasSceneCollectionContent(scene.notes, hasSceneNoteContent),
		hasSceneCollectionContent(scene.npcs, hasSceneNpcContent),
		hasSceneResourceContent(scene),
	].some(Boolean);
}

function createSceneNpc(name, description = "") {
	if (!name) return null;
	return { name, description };
}

function normalizeSceneNpcString(npc) {
	return createSceneNpc(asText(npc));
}

function normalizeSceneNpcObject(npc) {
	const name = asText(npc.name || npc.firstName);
	const description = asText(npc.description || npc.trait || "");
	return createSceneNpc(name, description);
}

function normalizeSceneNpc(npc) {
	if (typeof npc === "string") return normalizeSceneNpcString(npc);
	if (!npc || typeof npc !== "object") return null;
	return normalizeSceneNpcObject(npc);
}

function normalizeSceneNpcs(npcs) {
	return getSceneContentList(npcs).map(normalizeSceneNpc).filter(Boolean);
}

function getDirectSceneEncounterId(raw) {
	return asText(raw?.encounterId);
}

function getMappedSceneEncounterId(raw, clientIdMap) {
	const clientId = asText(raw?.encounterClientId);
	if (!clientId) return null;
	const mapped = clientIdMap.get(clientId);
	return mapped?.entity === "encounter" ? mapped.id : null;
}

function resolveEncounterId(raw, clientIdMap, existingEncounterId = "") {
	const direct = getDirectSceneEncounterId(raw);
	if (direct) return direct;
	const mapped = getMappedSceneEncounterId(raw, clientIdMap);
	return mapped !== null ? mapped : existingEncounterId || "";
}

function normalizeSceneNotes(scene, existing, simplifiedNotes) {
	const existingNotes = getSceneContentList(existing.notes);
	if (!Array.isArray(scene.notes)) return existingNotes;
	const notes = normalizeNotesPreservingExisting(scene.notes, existingNotes, {
		simplifiedNotes,
	});
	return mergeAiIgnoredNotes(existingNotes, notes);
}

function normalizeSceneParticipants(scene, existing) {
	if (!Array.isArray(scene.npcs)) return getSceneContentList(existing.npcs);
	return normalizeSceneNpcs(scene.npcs);
}

function getSceneBooleanState(existing, key) {
	return Boolean(existing[key]);
}

function normalizeScene(
	scene,
	existing,
	clientIdMap,
	{ simplifiedNotes = false } = {},
) {
	const previous = getExistingEntity(existing);
	return {
		id: getEntityId(previous),
		texts: normalizeSceneTexts(scene, previous.texts || {}),
		notes: normalizeSceneNotes(scene, previous, simplifiedNotes),
		isNotesCollapsed: getSceneBooleanState(previous, "isNotesCollapsed"),
		npcs: normalizeSceneParticipants(scene, previous),
		collapsed: getSceneBooleanState(previous, "collapsed"),
		encounterId: resolveEncounterId(
			scene,
			clientIdMap,
			previous.encounterId,
		),
		imageUrl: getEntityImageUrl(scene, previous),
	};
}

function getMonsterLookupName(monster) {
	return asText(monster?.monsterName || monster?.name);
}

function findBestiaryMonsterByName(bestiaryIndex, monsterName) {
	const searchPrefix = `${monsterName.toLowerCase()}|`;
	for (const [key, monster] of bestiaryIndex.entries()) {
		if (key.startsWith(searchPrefix)) return monster;
	}
	return null;
}

function createMonsterInstanceId(now = Date.now(), random = Math.random()) {
	return `inst-${now}-${Math.floor(random * 10000)}`;
}

function getMonsterInstanceId(monster, resolved) {
	return asText(monster?.id) || asText(resolved?.id) || makeId();
}

function getMonsterDisplayName(monster, resolved, fallbackName) {
	if (asText(monster?.name)) return asText(monster.name);
	return resolved ? resolved.name : fallbackName;
}

function getOriginalBestiaryName(resolved, fallbackName) {
	return resolved ? resolved.name : fallbackName;
}

function getMonsterSource(monster, resolved) {
	if (resolved) return resolved.source;
	return asText(monster?.source) || "Unknown";
}

function projectMonsterIdentity(monster, resolved, monsterName) {
	return {
		...resolved,
		id: getMonsterInstanceId(monster, resolved),
		instanceId: createMonsterInstanceId(),
		name: getMonsterDisplayName(monster, resolved, monsterName),
		originalBestiaryName: getOriginalBestiaryName(resolved, monsterName),
		source: getMonsterSource(monster, resolved),
	};
}

function getOfficialMonsterHp(monster) {
	if (monster.hp && typeof monster.hp === "object") {
		return monster.hp.average || 0;
	}
	return monster.hit_points || 0;
}

function getFirstArmorClass(monster) {
	if (!Array.isArray(monster.ac)) return null;
	return monster.ac[0] || null;
}

function getArmorClassValue(entry) {
	if (typeof entry !== "object") return entry;
	return entry.ac || 0;
}

function getOfficialMonsterArmorClass(monster) {
	const firstArmorClass = getFirstArmorClass(monster);
	if (!firstArmorClass) return monster.armor_class || 0;
	return getArmorClassValue(firstArmorClass);
}

function projectMonsterCombatStats(resolved) {
	if (!resolved) {
		return { currentHp: 0, hit_points: 0, armor_class: 0 };
	}
	const hitPoints = getOfficialMonsterHp(resolved);
	return {
		currentHp: hitPoints,
		hit_points: hitPoints,
		armor_class: getOfficialMonsterArmorClass(resolved),
	};
}

function buildMonsterInstance(monster, bestiaryIndex) {
	const monsterName = getMonsterLookupName(monster);
	if (!monsterName) return null;
	const resolved = findBestiaryMonsterByName(bestiaryIndex, monsterName);
	return {
		...projectMonsterIdentity(monster, resolved, monsterName),
		...projectMonsterCombatStats(resolved),
	};
}

function normalizeEncounterFromAi(rawEncounter, bestiaryIndex, fallbackName) {
	const monsters = (
		Array.isArray(rawEncounter?.monsters) ? rawEncounter.monsters : []
	)
		.map((monster) => buildMonsterInstance(monster, bestiaryIndex))
		.filter(Boolean);

	return {
		name: asText(rawEncounter?.name) || fallbackName,
		monsters,
	};
}

function entityNameKey(raw) {
	const nameParts = parseNameParts(raw || {});
	return `${nameParts.firstName.toLowerCase()} ${nameParts.lastName.toLowerCase()}`.trim();
}

function locationNameKey(raw = {}) {
	return sanitizeEntityName(raw.name || raw.title)
		.toLowerCase()
		.trim();
}

function entityTypeFromOperation(entity) {
	const value = asText(entity).toLowerCase();
	if (["character", "characters", "pc", "player-character"].includes(value)) {
		return "characters";
	}
	if (["npc", "npcs"].includes(value)) return "npc";
	if (["location", "locations", "faction", "factions"].includes(value)) {
		return "locations";
	}
	return "";
}

function entityKindFromStorageType(type) {
	if (type === "characters") return "character";
	if (type === "npc") return "npc";
	if (type === "locations") return "location";
	return type;
}

function getEntityNameKey(type, entity) {
	return type === "locations" ? locationNameKey(entity) : entityNameKey(entity);
}

function getEntityDisplayName(type, entity) {
	return type === "locations"
		? getLocationDisplayName(entity)
		: getCharacterDisplayName(entity);
}

function mapClientIdToEntity(clientIdMap, operation, type, scope, entity) {
	if (!operation.clientId || !entity) return;
	clientIdMap.set(asText(operation.clientId), {
		entity: entityKindFromStorageType(type),
		scope,
		id: entity.id,
		slug: entity.slug,
		name: getEntityDisplayName(type, entity),
	});
}

function asEntityRecord(value) {
	return value && typeof value === "object" && !Array.isArray(value)
		? value
		: {};
}

function firstIdentityValue(...values) {
	for (const value of values) {
		if (asText(value)) return value;
	}
	return undefined;
}

function firstIdentityText(...values) {
	return asText(firstIdentityValue(...values));
}

function normalizeEntityIdentity(identity, type) {
	const source = asEntityRecord(identity);
	const name = firstIdentityText(source.name, source.targetName);
	return {
		id: firstIdentityText(source.id, source.targetId),
		slug: asText(source.slug),
		nameKey: name
			? getEntityNameKey(type, { name, fullName: name })
			: "",
	};
}

function findIdentityValue(items, expected, readValue) {
	if (!expected) return null;
	return items.find((item) => readValue(item) === expected) || null;
}

function findByIdentity(items = [], identity, type) {
	const list = Array.isArray(items) ? items : [];
	const normalized = normalizeEntityIdentity(identity, type);
	return (
		findIdentityValue(list, normalized.id, (item) => asText(item?.id)) ||
		findIdentityValue(list, normalized.slug, (item) => asText(item?.slug)) ||
		findIdentityValue(list, normalized.nameKey, (item) =>
			getEntityNameKey(type, item),
		) ||
		null
	);
}

function getOperationTargetIdentity(operation = {}, clientIdMap = null) {
	const source = asEntityRecord(operation);
	const ownerClientId = firstIdentityText(
		source.targetClientId,
		source.ownerClientId,
	);
	const mapped =
		ownerClientId && typeof clientIdMap?.get === "function"
			? clientIdMap.get(ownerClientId)
			: null;
	return {
		id: firstIdentityValue(mapped?.id, source.id, source.targetId),
		slug: source.slug,
		name: firstIdentityValue(source.name, source.targetName),
	};
}

function normalizeEntityPayload(type, raw, existing, options) {
	return type === "locations"
		? normalizeLocation(raw, existing, options)
		: normalizeCharacter(raw, existing, options);
}

function mergeEntityPatch(existing, patch = {}) {
	const current = asEntityRecord(existing);
	const changes = asEntityRecord(patch);
	return {
		...current,
		...changes,
		id: firstIdentityValue(current.id, changes.id),
		slug: firstIdentityValue(current.slug, changes.slug),
		imageUrl: current.imageUrl ?? changes.imageUrl ?? null,
	};
}

async function readCampaignEntityList(campaignSlug, type) {
	return storage.listEntities(campaignSlug, type);
}

function getLocationEntityBaseName(payload) {
	return payload.name || "locations";
}

function getCharacterEntityBaseName(payload, type) {
	return payload.firstName || payload.name || type;
}

function getCampaignEntityBaseName(type, payload) {
	return type === "locations"
		? getLocationEntityBaseName(payload)
		: getCharacterEntityBaseName(payload, type);
}

function getCampaignEntitySuppliedSlug(payload, existing) {
	if (existing?.slug) return existing.slug;
	return payload.slug;
}

async function allocateCampaignEntitySlug(campaignSlug, type, payload) {
	const baseName = getCampaignEntityBaseName(type, payload);
	const baseSlug = storage.campaignSlug(baseName);
	return storage.ensureUniqueEntitySlug(campaignSlug, type, baseSlug);
}

async function resolveCampaignEntitySlug(
	campaignSlug,
	type,
	payload,
	existing,
) {
	const supplied = getCampaignEntitySuppliedSlug(payload, existing);
	return supplied || allocateCampaignEntitySlug(campaignSlug, type, payload);
}

function buildCampaignEntityWritePayload(payload, entitySlug) {
	return {
		...payload,
		slug: entitySlug,
	};
}

async function writeCampaignEntity(
	campaignSlug,
	type,
	payload,
	existing = null,
) {
	const entitySlug = await resolveCampaignEntitySlug(
		campaignSlug,
		type,
		payload,
		existing,
	);
	const persisted = buildCampaignEntityWritePayload(payload, entitySlug);
	return storage.writeEntity(campaignSlug, type, entitySlug, persisted);
}

function buildDuplicateIdentity(type, rawData) {
	return {
		slug: rawData.slug,
		name: getEntityDisplayName(type, rawData),
	};
}

function asExistingEntityRecord(value) {
	return value && typeof value === "object" && !Array.isArray(value)
		? value
		: null;
}

function buildNewEntityNormalizationSource(source, current) {
	return {
		...source,
		id: firstIdentityValue(current.id, source.id) ?? makeId(),
	};
}

function projectNewEntityVersion(current, source, normalized) {
	return {
		...current,
		...normalized,
		id: firstIdentityValue(current.id, normalized.id),
		slug: firstIdentityValue(current.slug, normalized.slug, source.slug),
		imageUrl: normalized.imageUrl ?? current.imageUrl ?? null,
	};
}

function mergeNewEntityVersion(type, rawData, existing, options) {
	const source = asEntityRecord(rawData);
	const current = asEntityRecord(existing);
	const normalized = normalizeEntityPayload(
		type,
		buildNewEntityNormalizationSource(source, current),
		asExistingEntityRecord(existing),
		options,
	);
	return projectNewEntityVersion(current, source, normalized);
}

function buildSessionEntityFromPayload(type, payload) {
	return {
		...payload,
		slug:
			payload.slug ||
			storage.campaignSlug(
				type === "locations"
					? payload.name || "locations"
					: getCharacterDisplayName(payload) || type,
			),
	};
}

function replaceSessionEntity(sessionData, type, existing, replacement) {
	const list = getSessionEntityList(sessionData, type);
	const index = list.indexOf(existing);
	if (index >= 0) {
		list[index] = replacement;
	} else {
		list.push(replacement);
	}
	return replacement;
}

function removeSessionEntity(sessionData, type, existing) {
	const list = getSessionEntityList(sessionData, type);
	setSessionEntityList(
		sessionData,
		type,
		list.filter((item) => item !== existing),
	);
}

function getSessionEntityList(sessionData, type) {
	sessionData.data = sessionData.data || {};
	const key = type === "locations" ? "locations" : "npcs";
	if (!Array.isArray(sessionData.data[key])) sessionData.data[key] = [];
	return sessionData.data[key];
}

function setSessionEntityList(sessionData, type, list) {
	sessionData.data = sessionData.data || {};
	const key = type === "locations" ? "locations" : "npcs";
	sessionData.data[key] = list;
}

function getSessionScenes(sessionData) {
	sessionData.data = sessionData.data || {};
	if (!Array.isArray(sessionData.data.scenes)) sessionData.data.scenes = [];
	return sessionData.data.scenes;
}

function getSessionEncounters(sessionData) {
	sessionData.data = sessionData.data || {};
	if (!Array.isArray(sessionData.data.encounters)) {
		sessionData.data.encounters = [];
	}
	return sessionData.data.encounters;
}

function getNoteList(target) {
	if (!Array.isArray(target.notes)) target.notes = [];
	return target.notes;
}

function appendNote(target, note, options) {
	const normalized = normalizeNote(note, options);
	if (!normalized) return null;
	getNoteList(target).push(normalized);
	return normalized;
}

function updateNote(target, noteId, patch = {}, options) {
	const notes = getNoteList(target);
	const index = notes.findIndex((note) => asText(note?.id) === asText(noteId));
	if (index < 0) return null;
	const normalized = normalizeNote(
		{ ...notes[index], ...patch, id: notes[index].id },
		options,
	);
	if (!normalized) return null;
	notes[index] = { ...notes[index], ...normalized, id: notes[index].id };
	return notes[index];
}

function deleteNote(target, noteId) {
	const notes = getNoteList(target);
	const index = notes.findIndex((note) => asText(note?.id) === asText(noteId));
	if (index < 0) return null;
	const [deleted] = notes.splice(index, 1);
	return deleted;
}

const ENTITY_SCOPES = new Set(["campaign", "session"]);

function normalizeEntityScope(value) {
	const scope = asText(value).toLowerCase();
	return ENTITY_SCOPES.has(scope) ? scope : "";
}

function getMappedOperationEntity(operation, clientIdMap) {
	const source = asEntityRecord(operation);
	const ownerClientId = firstIdentityText(
		source.targetClientId,
		source.ownerClientId,
	);
	return ownerClientId && typeof clientIdMap?.get === "function"
		? clientIdMap.get(ownerClientId)
		: null;
}

function operationScope(operation, defaultScope, clientIdMap = null) {
	const source = asEntityRecord(operation);
	const explicitScope = normalizeEntityScope(source.scope);
	const mappedScope = normalizeEntityScope(
		getMappedOperationEntity(source, clientIdMap)?.scope,
	);
	return (
		explicitScope ||
		mappedScope ||
		normalizeEntityScope(defaultScope) ||
		"campaign"
	);
}

function isOperationAllowed(type, permissions) {
	if (type === "characters") return permissions.allowCharacters !== false;
	if (type === "npc") return permissions.allowNpcs !== false;
	if (type === "locations") return permissions.allowLocations !== false;
	return true;
}

const OPERATION_DATA_KEYS = Object.freeze(["data", "value", "patch"]);
const OPERATION_PATCH_KEYS = Object.freeze(["patch", "data"]);
const SCENE_LINK_OPERATION_NAMES = new Set(["create", "update"]);
const SCENE_OPERATION_ENTITIES = new Set(["scene", "scenes"]);

function getObjectOperationPayload(operation, key) {
	const payload = operation?.[key];
	return payload && typeof payload === "object" ? payload : null;
}

function firstObjectOperationPayload(operation, keys) {
	for (const key of keys) {
		const payload = getObjectOperationPayload(operation, key);
		if (payload) return payload;
	}
	return {};
}

function operationData(operation) {
	return firstObjectOperationPayload(operation, OPERATION_DATA_KEYS);
}

function operationPatch(operation) {
	return firstObjectOperationPayload(operation, OPERATION_PATCH_KEYS);
}

function isSceneEncounterLinkOperation(operation) {
	if (!operation || typeof operation !== "object") return false;
	const operationName = asText(operation.op).toLowerCase();
	const entity = asText(operation.entity).toLowerCase();
	return (
		SCENE_LINK_OPERATION_NAMES.has(operationName) &&
		SCENE_OPERATION_ENTITIES.has(entity)
	);
}

function getSceneEncounterClientId(operation) {
	const data = operationData(operation);
	const patch = operationPatch(operation);
	return asText(data.encounterClientId || patch.encounterClientId);
}

function collectSceneEncounterClientIds(operations = []) {
	const ids = new Set();
	for (const operation of operations) {
		if (!isSceneEncounterLinkOperation(operation)) continue;
		const encounterClientId = getSceneEncounterClientId(operation);
		if (encounterClientId) ids.add(encounterClientId);
	}
	return ids;
}

function queuePendingSceneEncounterLink(state, scene, raw) {
	const encounterClientId = asText(raw?.encounterClientId);
	if (!encounterClientId || !scene?.id) return;
	state.pendingSceneEncounterLinks.push({
		sceneId: asText(scene.id),
		encounterClientId,
	});
}

function hasPendingSceneEncounterLinks(state) {
	return Boolean(
		state.sessionData && state.pendingSceneEncounterLinks.length > 0,
	);
}

function getMappedEncounter(clientIdMap, encounterClientId) {
	const mapped = clientIdMap.get(encounterClientId);
	return mapped?.entity === "encounter" && mapped.id ? mapped : null;
}

function addUnresolvedSceneEncounterWarning(warnings, encounterClientId) {
	warnings.push(
		`Scene encounterClientId "${encounterClientId}" could not be resolved to a created encounter.`,
	);
}

function findPendingLinkScene(scenes, sceneId) {
	return scenes.find((scene) => asText(scene.id) === sceneId) || null;
}

function applySceneEncounterLink(scene, encounterId) {
	if (scene.encounterId === encounterId) return false;
	scene.encounterId = encounterId;
	return true;
}

function resolvePendingSceneEncounterLink(state, scenes, link) {
	const mapped = getMappedEncounter(
		state.clientIdMap,
		link.encounterClientId,
	);
	if (!mapped) {
		addUnresolvedSceneEncounterWarning(
			state.warnings,
			link.encounterClientId,
		);
		return false;
	}
	const scene = findPendingLinkScene(scenes, link.sceneId);
	return scene ? applySceneEncounterLink(scene, mapped.id) : false;
}

function resolvePendingSceneEncounterLinks(state) {
	if (!hasPendingSceneEncounterLinks(state)) return false;
	const scenes = getSessionScenes(state.sessionData);
	let changed = false;
	for (const link of state.pendingSceneEncounterLinks) {
		changed = resolvePendingSceneEncounterLink(state, scenes, link) || changed;
	}
	return changed;
}

function removeCreatedUnlinkedEncounters(state) {
	const { sessionData, createdEncounterIds, warnings } = state;
	if (!sessionData || createdEncounterIds.size === 0) return false;
	const scenes = getSessionScenes(sessionData);
	const linkedEncounterIds = new Set(
		scenes.map((scene) => asText(scene.encounterId)).filter(Boolean),
	);
	const encounters = getSessionEncounters(sessionData);
	const nextEncounters = encounters.filter((encounter) => {
		const id = asText(encounter.id);
		return !createdEncounterIds.has(id) || linkedEncounterIds.has(id);
	});
	if (nextEncounters.length === encounters.length) return false;
	const removedCount = encounters.length - nextEncounters.length;
	sessionData.data.encounters = nextEncounters;
	warnings.push(
		`Removed ${removedCount} newly created encounter${
			removedCount === 1 ? "" : "s"
		} without a final scene link.`,
	);
	return true;
}

function canApplyCampaignEntityOperation(state, operation, type) {
	if (isOperationAllowed(type, state.permissions)) return true;
	state.warnings.push(`Skipped ${operation.op} for disabled ${type}.`);
	return false;
}

async function getCampaignEntityOperationContext(
	state,
	operation,
	type,
	options,
) {
	const existingList = await readCampaignEntityList(state.campaignSlug, type);
	return {
		state,
		operation,
		type,
		options,
		existingList,
		existing: findByIdentity(
			existingList,
			getOperationTargetIdentity(operation, state.clientIdMap),
			type,
		),
	};
}

function isValidEntityPayload(type, payload) {
	if (type === "locations") return Boolean(payload.name);
	return Boolean(payload.firstName || payload.lastName);
}

function createCampaignEntityRawData(operation) {
	return { ...operationData(operation), id: makeId() };
}

function findCampaignCreateDuplicate(context, rawData) {
	return findByIdentity(
		context.existingList,
		buildDuplicateIdentity(context.type, rawData),
		context.type,
	);
}

function findDuplicateInSessionEntityList(context, rawData) {
	const sessionList = context.state.sessionData
		? getSessionEntityList(context.state.sessionData, context.type)
		: [];
	return findByIdentity(
		sessionList,
		buildDuplicateIdentity(context.type, rawData),
		context.type,
	);
}

function mapCampaignEntityClientId(context, saved) {
	mapClientIdToEntity(
		context.state.clientIdMap,
		context.operation,
		context.type,
		"campaign",
		saved,
	);
}

function addCampaignEntityCreateWarning(context, action, saved) {
	context.state.warnings.push(
		`${action} ${context.type} with new AI version for "${getEntityDisplayName(
			context.type,
			saved,
		)}".`,
	);
}

async function replaceDuplicateCampaignEntity(context, rawData, duplicate) {
	const payload = mergeNewEntityVersion(
		context.type,
		rawData,
		duplicate,
		context.options,
	);
	if (!isValidEntityPayload(context.type, payload)) return null;
	const saved = await writeCampaignEntity(
		context.state.campaignSlug,
		context.type,
		payload,
		duplicate,
	);
	mapCampaignEntityClientId(context, saved);
	addCampaignEntityCreateWarning(
		context,
		"Replaced duplicate campaign",
		saved,
	);
	return { type: context.type, scope: "campaign", saved };
}

async function promoteDuplicateSessionEntity(context, rawData, duplicate) {
	const payload = mergeNewEntityVersion(
		context.type,
		rawData,
		duplicate,
		context.options,
	);
	if (!isValidEntityPayload(context.type, payload)) return null;
	const saved = await writeCampaignEntity(
		context.state.campaignSlug,
		context.type,
		payload,
	);
	removeSessionEntity(context.state.sessionData, context.type, duplicate);
	mapCampaignEntityClientId(context, saved);
	addCampaignEntityCreateWarning(
		context,
		"Moved duplicate session",
		saved,
	);
	return {
		type: context.type,
		scope: "campaign",
		saved,
		sessionChanged: true,
	};
}

async function createNewCampaignEntity(context, rawData) {
	const normalized = normalizeEntityPayload(
		context.type,
		rawData,
		null,
		context.options,
	);
	if (!isValidEntityPayload(context.type, normalized)) return null;
	const saved = await writeCampaignEntity(
		context.state.campaignSlug,
		context.type,
		normalized,
	);
	mapCampaignEntityClientId(context, saved);
	return { type: context.type, scope: "campaign", saved };
}

async function applyCampaignEntityCreate(context) {
	const rawData = createCampaignEntityRawData(context.operation);
	const campaignDuplicate = findCampaignCreateDuplicate(context, rawData);
	if (campaignDuplicate) {
		return replaceDuplicateCampaignEntity(
			context,
			rawData,
			campaignDuplicate,
		);
	}
	const sessionDuplicate = findDuplicateInSessionEntityList(context, rawData);
	if (sessionDuplicate) {
		return promoteDuplicateSessionEntity(context, rawData, sessionDuplicate);
	}
	return createNewCampaignEntity(context, rawData);
}

async function applyCampaignEntityDelete(context) {
	if (!context.existing) return null;
	await storage.deleteEntity(
		context.state.campaignSlug,
		context.type,
		context.existing.slug,
	);
	return {
		type: context.type,
		scope: "campaign",
		deleted: context.existing,
	};
}

function buildCampaignEntityUpdatePayload(context) {
	const raw = mergeEntityPatch(
		context.existing,
		operationPatch(context.operation),
	);
	const normalized = normalizeEntityPayload(
		context.type,
		raw,
		context.existing,
		context.options,
	);
	return {
		...context.existing,
		...normalized,
		id: context.existing.id,
		slug: context.existing.slug,
		imageUrl:
			context.existing.imageUrl ?? normalized.imageUrl ?? null,
	};
}

async function updateCampaignEntityMentionReferences(
	context,
	oldDisplayName,
	saved,
) {
	const newDisplayName = getEntityDisplayName(context.type, saved);
	if (!oldDisplayName || !newDisplayName || oldDisplayName === newDisplayName) {
		return;
	}
	await storage.updateCampaignMentionReferences(
		context.state.campaignSlug,
		oldDisplayName,
		newDisplayName,
	);
}

async function applyCampaignEntityUpdate(context) {
	if (!context.existing) return null;
	const oldDisplayName = getEntityDisplayName(context.type, context.existing);
	const saved = await writeCampaignEntity(
		context.state.campaignSlug,
		context.type,
		buildCampaignEntityUpdatePayload(context),
		context.existing,
	);
	await updateCampaignEntityMentionReferences(context, oldDisplayName, saved);
	return { type: context.type, scope: "campaign", saved };
}

const CAMPAIGN_ENTITY_OPERATION_HANDLERS = new Map([
	["create", applyCampaignEntityCreate],
	["update", applyCampaignEntityUpdate],
	["delete", applyCampaignEntityDelete],
]);

async function applyCampaignEntityOperation(state, operation, type, options) {
	if (!canApplyCampaignEntityOperation(state, operation, type)) return null;
	const context = await getCampaignEntityOperationContext(
		state,
		operation,
		type,
		options,
	);
	const handler = CAMPAIGN_ENTITY_OPERATION_HANDLERS.get(
		asText(operation.op).toLowerCase(),
	);
	return handler ? handler(context) : null;
}

function canApplySessionEntityOperation(state, operation, type) {
	if (!state.sessionData) {
		state.warnings.push(`Skipped session ${operation.op}; no session target.`);
		return false;
	}
	if (!isOperationAllowed(type, state.permissions)) {
		state.warnings.push(`Skipped ${operation.op} for disabled ${type}.`);
		return false;
	}
	return true;
}

function getSessionEntityOperationContext(state, operation, type, options) {
	const list = getSessionEntityList(state.sessionData, type);
	return {
		state,
		operation,
		type,
		options,
		list,
		existing: findByIdentity(
			list,
			getOperationTargetIdentity(operation, state.clientIdMap),
			type,
		),
	};
}

function createSessionEntityRawData(operation) {
	return {
		...operationData(operation),
		id: makeId(),
	};
}

function buildSessionEntityVersion(context, rawData, existing) {
	const payload = mergeNewEntityVersion(
		context.type,
		rawData,
		existing,
		context.options,
	);
	return isValidEntityPayload(context.type, payload) ? payload : null;
}

function mapSessionEntityClientId(context, saved) {
	mapClientIdToEntity(
		context.state.clientIdMap,
		context.operation,
		context.type,
		"session",
		saved,
	);
}

function addSessionEntityCreateWarning(context, prefix, saved, scopePhrase = "") {
	context.state.warnings.push(
		`${prefix} ${context.type}${scopePhrase} with new AI version for "${getEntityDisplayName(
			context.type,
			saved,
		)}".`,
	);
}

function findSessionCreateDuplicate(context, rawData) {
	return findByIdentity(
		context.list,
		buildDuplicateIdentity(context.type, rawData),
		context.type,
	);
}

async function readCampaignEntitiesForSessionCreate(context) {
	if (!context.state.campaignSlug) return [];
	return storage
		.listEntities(context.state.campaignSlug, context.type)
		.catch(() => []);
}

async function findCampaignCreateDuplicateForSession(context, rawData) {
	const campaignEntities = await readCampaignEntitiesForSessionCreate(context);
	return findByIdentity(
		campaignEntities,
		buildDuplicateIdentity(context.type, rawData),
		context.type,
	);
}

function replaceDuplicateSessionEntity(context, rawData, duplicate) {
	const payload = buildSessionEntityVersion(context, rawData, duplicate);
	if (!payload) return null;
	const saved = replaceSessionEntity(
		context.state.sessionData,
		context.type,
		duplicate,
		buildSessionEntityFromPayload(context.type, payload),
	);
	mapSessionEntityClientId(context, saved);
	addSessionEntityCreateWarning(
		context,
		"Replaced duplicate session",
		saved,
	);
	return { type: context.type, scope: "session", saved };
}

async function appendSessionEntityAndDeleteCampaignDuplicate(
	context,
	saved,
	duplicate,
) {
	context.list.push(saved);
	try {
		await storage.deleteEntity(
			context.state.campaignSlug,
			context.type,
			duplicate.slug,
		);
	} catch (error) {
		const index = context.list.indexOf(saved);
		if (index >= 0) context.list.splice(index, 1);
		throw error;
	}
}

async function moveDuplicateCampaignEntityToSession(
	context,
	rawData,
	duplicate,
) {
	const payload = buildSessionEntityVersion(context, rawData, duplicate);
	if (!payload) return null;
	const saved = buildSessionEntityFromPayload(context.type, payload);
	await appendSessionEntityAndDeleteCampaignDuplicate(context, saved, duplicate);
	mapSessionEntityClientId(context, saved);
	addSessionEntityCreateWarning(
		context,
		"Moved duplicate campaign",
		saved,
		" to session",
	);
	return { type: context.type, scope: "session", saved };
}

function createNewSessionEntity(context, rawData) {
	const normalized = normalizeEntityPayload(
		context.type,
		rawData,
		null,
		context.options,
	);
	if (!isValidEntityPayload(context.type, normalized)) return null;
	const saved = buildSessionEntityFromPayload(context.type, normalized);
	context.list.push(saved);
	mapSessionEntityClientId(context, saved);
	return { type: context.type, scope: "session", saved };
}

async function applySessionEntityCreate(context) {
	const rawData = createSessionEntityRawData(context.operation);
	const sessionDuplicate = findSessionCreateDuplicate(context, rawData);
	if (sessionDuplicate) {
		return replaceDuplicateSessionEntity(context, rawData, sessionDuplicate);
	}
	const campaignDuplicate = await findCampaignCreateDuplicateForSession(
		context,
		rawData,
	);
	return campaignDuplicate
		? moveDuplicateCampaignEntityToSession(
				context,
				rawData,
				campaignDuplicate,
			)
		: createNewSessionEntity(context, rawData);
}

function applySessionEntityDelete(context) {
	if (!context.existing) return null;
	setSessionEntityList(
		context.state.sessionData,
		context.type,
		context.list.filter((item) => item !== context.existing),
	);
	return {
		type: context.type,
		scope: "session",
		deleted: context.existing,
	};
}

function buildSessionEntityUpdate(context) {
	const raw = mergeEntityPatch(
		context.existing,
		operationPatch(context.operation),
	);
	const normalized = normalizeEntityPayload(
		context.type,
		raw,
		context.existing,
		context.options,
	);
	return {
		...context.existing,
		...normalized,
		id: context.existing.id,
		slug: context.existing.slug,
		imageUrl: context.existing.imageUrl ?? normalized.imageUrl ?? null,
	};
}

function applySessionEntityUpdate(context) {
	if (!context.existing) return null;
	const saved = buildSessionEntityUpdate(context);
	const index = context.list.indexOf(context.existing);
	context.list[index] = saved;
	return { type: context.type, scope: "session", saved };
}

const SESSION_ENTITY_OPERATION_HANDLERS = new Map([
	["create", applySessionEntityCreate],
	["update", applySessionEntityUpdate],
	["delete", applySessionEntityDelete],
]);

async function applySessionEntityOperation(state, operation, type, options) {
	if (!canApplySessionEntityOperation(state, operation, type)) return null;
	const context = getSessionEntityOperationContext(
		state,
		operation,
		type,
		options,
	);
	const handler = SESSION_ENTITY_OPERATION_HANDLERS.get(
		asText(operation.op).toLowerCase(),
	);
	return handler ? handler(context) : null;
}

function hasMoveScopeSession(state) {
	if (!state.sessionData) {
		state.warnings.push("Skipped moveScope; no session target.");
		return false;
	}
	return true;
}

function readMoveScopes(operation) {
	return {
		from: asText(operation.from || operation.scope).toLowerCase(),
		to: asText(operation.to || operation.targetScope).toLowerCase(),
	};
}

function hasValidMoveScopes(state, scopes) {
	if (!ENTITY_SCOPES.has(scopes.from) || !ENTITY_SCOPES.has(scopes.to)) {
		state.warnings.push("Skipped moveScope with invalid scope.");
		return false;
	}
	return true;
}

function getMoveScopeContext(state, operation, type, options) {
	if (!hasMoveScopeSession(state)) return null;
	const scopes = readMoveScopes(operation);
	if (!hasValidMoveScopes(state, scopes) || scopes.from === scopes.to) {
		return null;
	}
	return { state, operation, type, options, ...scopes };
}

function getMoveScopeTarget(context, items) {
	return findByIdentity(
		items,
		getOperationTargetIdentity(
			context.operation,
			context.state.clientIdMap,
		),
		context.type,
	);
}

function findMoveScopeDuplicate(context, items, source) {
	return findByIdentity(
		items,
		buildDuplicateIdentity(context.type, source),
		context.type,
	);
}

function buildMoveScopePayload(context, source, duplicate) {
	return mergeNewEntityVersion(
		context.type,
		source,
		duplicate || source,
		context.options,
	);
}

function registerScopeMoveRollback(state, rollback) {
	state.scopeMoveRollbacks.push(rollback);
}

function restoreSessionEntityAtIndex(context, entity, index) {
	registerScopeMoveRollback(context.state, async () => {
		const list = getSessionEntityList(context.state.sessionData, context.type);
		if (list.includes(entity)) return;
		list.splice(Math.min(index, list.length), 0, entity);
	});
}

function rollbackCampaignEntityWrite(context, duplicate, saved) {
	registerScopeMoveRollback(context.state, async () => {
		if (!duplicate) {
			await storage.deleteEntity(
				context.state.campaignSlug,
				context.type,
				saved.slug,
			);
			return;
		}
		await storage.writeEntity(
			context.state.campaignSlug,
			context.type,
			duplicate.slug,
			{ ...duplicate, slug: duplicate.slug },
		);
	});
}

function addMoveScopeDuplicateWarning(context, scope, saved) {
	context.state.warnings.push(
		`Replaced duplicate ${scope} ${context.type} during moveScope with "${getEntityDisplayName(
			context.type,
			saved,
		)}".`,
	);
}

async function moveSessionEntityToCampaign(context) {
	const sessionList = getSessionEntityList(
		context.state.sessionData,
		context.type,
	);
	const existing = getMoveScopeTarget(context, sessionList);
	if (!existing) return null;
	const campaignEntities = await storage.listEntities(
		context.state.campaignSlug,
		context.type,
	);
	const duplicate = findMoveScopeDuplicate(
		context,
		campaignEntities,
		existing,
	);
	const saved = await writeCampaignEntity(
		context.state.campaignSlug,
		context.type,
		buildMoveScopePayload(context, existing, duplicate),
		duplicate,
	);
	rollbackCampaignEntityWrite(context, duplicate, saved);
	restoreSessionEntityAtIndex(context, existing, sessionList.indexOf(existing));
	removeSessionEntity(
		context.state.sessionData,
		context.type,
		existing,
	);
	if (duplicate) {
		addMoveScopeDuplicateWarning(context, "campaign", saved);
	}
	return {
		type: context.type,
		moved: true,
		from: context.from,
		to: context.to,
		saved,
	};
}

function applyCampaignToSessionMutation(context, payload, duplicate) {
	const list = getSessionEntityList(context.state.sessionData, context.type);
	const saved = buildSessionEntityFromPayload(context.type, payload);
	if (!duplicate) {
		list.push(saved);
		return {
			saved,
			rollback: () => {
				const index = list.indexOf(saved);
				if (index >= 0) list.splice(index, 1);
			},
		};
	}
	const index = list.indexOf(duplicate);
	list[index] = saved;
	return {
		saved,
		rollback: () => {
			list[index] = duplicate;
		},
	};
}

function restoreDeletedCampaignEntity(context, existing) {
	registerScopeMoveRollback(context.state, async () => {
		await storage.writeEntity(
			context.state.campaignSlug,
			context.type,
			existing.slug,
			{ ...existing, slug: existing.slug },
		);
	});
}

async function moveCampaignEntityToSession(context) {
	const campaignEntities = await storage.listEntities(
		context.state.campaignSlug,
		context.type,
	);
	const existing = getMoveScopeTarget(context, campaignEntities);
	if (!existing) return null;
	const sessionList = getSessionEntityList(
		context.state.sessionData,
		context.type,
	);
	const duplicate = findMoveScopeDuplicate(context, sessionList, existing);
	const mutation = applyCampaignToSessionMutation(
		context,
		buildMoveScopePayload(context, existing, duplicate),
		duplicate,
	);
	try {
		await storage.deleteEntity(
			context.state.campaignSlug,
			context.type,
			existing.slug,
		);
	} catch (error) {
		mutation.rollback();
		throw error;
	}
	restoreDeletedCampaignEntity(context, existing);
	registerScopeMoveRollback(context.state, async () => mutation.rollback());
	if (duplicate) {
		addMoveScopeDuplicateWarning(context, "session", mutation.saved);
	}
	return {
		type: context.type,
		moved: true,
		from: context.from,
		to: context.to,
		saved: mutation.saved,
	};
}

const MOVE_SCOPE_HANDLERS = new Map([
	["session:campaign", moveSessionEntityToCampaign],
	["campaign:session", moveCampaignEntityToSession],
]);

async function applyMoveScopeOperation(state, operation, type, options) {
	const context = getMoveScopeContext(state, operation, type, options);
	if (!context) return null;
	const handler = MOVE_SCOPE_HANDLERS.get(`${context.from}:${context.to}`);
	return handler ? handler(context) : null;
}

const SCOPED_ENTITY_OPERATION_HANDLERS = new Map([
	["campaign", applyCampaignEntityOperation],
	["session", applySessionEntityOperation],
]);

function isMoveScopeOperation(operation) {
	return asText(operation?.op).toLowerCase() === "movescope";
}

function getDefaultEntityOperationScope(state, type) {
	return type === "characters" ? "campaign" : state.defaultEntityScope;
}

function getScopedEntityOperationHandler(type, scope) {
	const route = scope === "session" && type !== "characters"
		? "session"
		: "campaign";
	return SCOPED_ENTITY_OPERATION_HANDLERS.get(route);
}

function createEntityOperationRoute(state, operation) {
	const type = entityTypeFromOperation(operation.entity);
	if (!type) return null;
	if (isMoveScopeOperation(operation)) {
		return { type, handler: applyMoveScopeOperation };
	}
	const defaultScope = getDefaultEntityOperationScope(state, type);
	const scope = operationScope(operation, defaultScope, state.clientIdMap);
	return { type, handler: getScopedEntityOperationHandler(type, scope) };
}

function applyEntityOperation(state, operation, options) {
	const route = createEntityOperationRoute(state, operation);
	return route
		? route.handler(state, operation, route.type, options)
		: null;
}

function findScene(sessionData, operation, clientIdMap = null) {
	const scenes = getSessionScenes(sessionData);
	const identity = getOperationTargetIdentity(operation, clientIdMap);
	const id = asText(identity.id);
	return scenes.find((scene) => asText(scene.id) === id) || null;
}

function getSceneOperationContext(state, operation, options) {
	return {
		state,
		operation,
		options,
		sessionData: state.sessionData,
		scenes: getSessionScenes(state.sessionData),
	};
}

function applySceneDelete(context) {
	const { state, operation, sessionData, scenes } = context;
	const existing = findScene(sessionData, operation, state.clientIdMap);
	if (!existing) return null;
	sessionData.data.scenes = scenes.filter((scene) => scene !== existing);
	return { type: "scene", deleted: existing };
}

function sanitizeSceneCreateData(data, permissions) {
	return permissions.allowEncounters === false
		? { ...data, encounterId: "", encounterClientId: "" }
		: data;
}

function registerSceneClientId(clientIdMap, operation, scene) {
	if (!operation.clientId) return;
	clientIdMap.set(asText(operation.clientId), {
		entity: "scene",
		scope: "session",
		id: scene.id,
	});
}

function applySceneCreate(context) {
	const { state, operation, options, scenes } = context;
	const safeData = sanitizeSceneCreateData(
		operationData(operation),
		state.permissions,
	);
	const saved = normalizeScene(
		safeData,
		null,
		state.clientIdMap,
		options,
	);
	if (!hasSceneContent(saved)) {
		state.warnings.push("Skipped empty scene create.");
		return null;
	}
	scenes.push(saved);
	queuePendingSceneEncounterLink(state, saved, safeData);
	registerSceneClientId(state.clientIdMap, operation, saved);
	return { type: "scene", saved };
}

function getScenePatchTexts(patch) {
	return patch.texts && typeof patch.texts === "object" ? patch.texts : {};
}

function buildSceneUpdateData(existing, patch) {
	return {
		...existing,
		...patch,
		texts: {
			...(existing.texts || {}),
			...getScenePatchTexts(patch),
		},
		id: existing.id,
		imageUrl: existing.imageUrl ?? patch.imageUrl ?? null,
	};
}

function sanitizeSceneUpdateData(raw, existing, permissions) {
	return permissions.allowEncounters === false
		? { ...raw, encounterId: existing.encounterId || "" }
		: raw;
}

function replaceScene(scenes, existing, saved) {
	const index = scenes.indexOf(existing);
	scenes[index] = saved;
}

function applySceneUpdate(context) {
	const { state, operation, options, sessionData, scenes } = context;
	const existing = findScene(sessionData, operation, state.clientIdMap);
	if (!existing) return null;
	const raw = buildSceneUpdateData(existing, operationPatch(operation));
	const safeRaw = sanitizeSceneUpdateData(raw, existing, state.permissions);
	const saved = normalizeScene(
		safeRaw,
		existing,
		state.clientIdMap,
		options,
	);
	replaceScene(scenes, existing, saved);
	queuePendingSceneEncounterLink(state, saved, safeRaw);
	return { type: "scene", saved };
}

const SCENE_OPERATION_HANDLERS = new Map([
	["create", applySceneCreate],
	["update", applySceneUpdate],
	["delete", applySceneDelete],
]);

function applySceneOperation(state, operation, options) {
	if (!state.sessionData) {
		state.warnings.push(`Skipped scene ${operation.op}; no session target.`);
		return null;
	}
	const operationName = asText(operation.op).toLowerCase();
	const handler = SCENE_OPERATION_HANDLERS.get(operationName);
	return handler
		? handler(getSceneOperationContext(state, operation, options))
		: null;
}

function canApplyEncounterOperation(state, operation) {
	if (!state.sessionData) {
		state.warnings.push(
			`Skipped encounter ${operation.op}; no session target.`,
		);
		return false;
	}
	if (state.permissions.allowEncounters === false) {
		state.warnings.push(
			`Skipped encounter ${operation.op}; encounter generation disabled.`,
		);
		return false;
	}
	return true;
}

function getEncounterOperationTargetId(state, operation) {
	return asText(operation.id || operation.targetId || state.encounterId);
}

function findEncounterById(encounters, id) {
	if (!id) return null;
	return (
		encounters.find((encounter) => asText(encounter.id) === id) || null
	);
}

async function prepareEncounterOperationContext(state, operation) {
	const encounters = getSessionEncounters(state.sessionData);
	const targetId = getEncounterOperationTargetId(state, operation);
	return {
		state,
		operation,
		sessionData: state.sessionData,
		encounters,
		existing: findEncounterById(encounters, targetId),
		bestiaryIndex: await storage.getBestiaryIndex(),
	};
}

function applyEncounterDelete(context) {
	if (!context.existing) return null;
	context.sessionData.data.encounters = context.encounters.filter(
		(encounter) => encounter !== context.existing,
	);
	return { type: "encounter", deleted: context.existing };
}

function getEncounterCreateRequest(context) {
	const { state, operation, encounters } = context;
	const clientId = asText(operation.clientId);
	const data = operationData(operation);
	const fallbackName = `Encounter ${encounters.length + 1}`;
	const name = asText(data.name) || fallbackName;
	if (!clientId) {
		state.warnings.push(
			`Skipped encounter create "${name}"; new encounters must use clientId and be linked from a scene with encounterClientId.`,
		);
		return null;
	}
	if (!state.linkedEncounterClientIds.has(clientId)) {
		state.warnings.push(
			`Skipped encounter create "${name}" without matching scene encounterClientId "${clientId}".`,
		);
		return null;
	}
	return { clientId, data, fallbackName };
}

function registerCreatedEncounter(state, clientId, encounter) {
	state.createdEncounterIds.add(encounter.id);
	state.clientIdMap.set(clientId, {
		entity: "encounter",
		scope: "session",
		id: encounter.id,
	});
}

function applyEncounterCreate(context) {
	const request = getEncounterCreateRequest(context);
	if (!request) return null;
	const normalized = normalizeEncounterFromAi(
		request.data,
		context.bestiaryIndex,
		request.fallbackName,
	);
	const saved = {
		id: makeId(),
		name: normalized.name,
		monsters: normalized.monsters,
	};
	context.encounters.push(saved);
	registerCreatedEncounter(context.state, request.clientId, saved);
	return { type: "encounter", saved };
}

function getEncounterUpdateData(existing, patch) {
	return {
		name: hasOwn(patch, "name") ? patch.name : existing.name,
		monsters: Array.isArray(patch.monsters)
			? patch.monsters
			: existing.monsters || [],
	};
}

function applyEncounterUpdate(context) {
	if (!context.existing) return null;
	const normalized = normalizeEncounterFromAi(
		getEncounterUpdateData(
			context.existing,
			operationPatch(context.operation),
		),
		context.bestiaryIndex,
		context.existing.name || "Encounter",
	);
	context.existing.name = normalized.name;
	context.existing.monsters = normalized.monsters;
	return { type: "encounter", saved: context.existing };
}

const ENCOUNTER_OPERATION_HANDLERS = new Map([
	["create", applyEncounterCreate],
	["update", applyEncounterUpdate],
	["delete", applyEncounterDelete],
]);

async function applyEncounterOperation(state, operation) {
	if (!canApplyEncounterOperation(state, operation)) return null;
	const context = await prepareEncounterOperationContext(state, operation);
	const operationName = asText(operation.op).toLowerCase();
	const handler = ENCOUNTER_OPERATION_HANDLERS.get(operationName);
	return handler ? handler(context) : null;
}

async function ensureCampaignEntityCache(state, type) {
	if (!state.campaignEntityCache.has(type)) {
		state.campaignEntityCache.set(
			type,
			await storage.listEntities(state.campaignSlug, type),
		);
	}
	return state.campaignEntityCache.get(type);
}

function getNoteTargetScope(state, operation, type) {
	if (!type) return "";
	return operationScope(
		operation,
		type === "characters" ? "campaign" : state.defaultEntityScope,
		state.clientIdMap,
	);
}

async function prepareNoteTargetContext(state, operation) {
	const entity = asText(operation.entity).toLowerCase();
	const type = entityTypeFromOperation(entity);
	if (type) await ensureCampaignEntityCache(state, type);
	return {
		entity,
		type,
		scope: getNoteTargetScope(state, operation, type),
		identity: getOperationTargetIdentity(operation, state.clientIdMap),
	};
}

const DIRECT_NOTE_TARGET_READERS = new Map([
	["campaign", (state) => state.campaignMeta],
	["session", (state) => state.sessionData?.data || null],
	[
		"scene",
		(state, operation) =>
			state.sessionData
				? findScene(state.sessionData, operation, state.clientIdMap)
				: null,
	],
]);

function getSessionEntityNoteTarget(state, context) {
	if (!state.sessionData) return null;
	const list = getSessionEntityList(state.sessionData, context.type);
	return findByIdentity(list, context.identity, context.type);
}

function getCampaignEntityNoteTarget(state, context) {
	const cached = state.campaignEntityCache.get(context.type) || [];
	return findByIdentity(cached, context.identity, context.type);
}

function resolveNoteTarget(state, operation, context) {
	const directReader = DIRECT_NOTE_TARGET_READERS.get(context.entity);
	if (directReader) return directReader(state, operation);
	if (!context.type) return null;
	if (context.scope === "session" && context.type !== "characters") {
		return getSessionEntityNoteTarget(state, context);
	}
	return getCampaignEntityNoteTarget(state, context);
}

const NOTE_MUTATION_HANDLERS = new Map([
	[
		"appendnote",
		(target, operation, options) =>
			appendNote(
				target,
				operation.note || operationData(operation),
				options,
			),
	],
	[
		"updatenote",
		(target, operation, options) =>
			updateNote(
				target,
				operation.noteId || operation.id,
				operation.patch || operation.note || operationData(operation),
				options,
			),
	],
	[
		"deletenote",
		(target, operation) =>
			deleteNote(target, operation.noteId || operation.id),
	],
]);

function applyNoteMutation(target, operation, options) {
	const operationName = asText(operation.op).toLowerCase();
	const handler = NOTE_MUTATION_HANDLERS.get(operationName);
	return handler ? handler(target, operation, options) : null;
}

function replaceCachedCampaignEntity(state, context, target, saved) {
	const cached = state.campaignEntityCache.get(context.type) || [];
	const index = cached.findIndex((item) => item === target);
	if (index >= 0) cached[index] = saved;
}

async function persistCampaignEntityNote(state, context, target, result) {
	if (!result || !context.type || context.scope === "session") return;
	const saved = await writeCampaignEntity(
		state.campaignSlug,
		context.type,
		target,
		target,
	);
	replaceCachedCampaignEntity(state, context, target, saved);
}

async function applyNoteOperation(state, operation, options) {
	const context = await prepareNoteTargetContext(state, operation);
	const target = resolveNoteTarget(state, operation, context);
	if (!target) return null;
	const result = applyNoteMutation(target, operation, options);
	await persistCampaignEntityNote(state, context, target, result);
	return result;
}

function applyCampaignOperation(state, operation) {
	const op = asText(operation.op).toLowerCase();
	if (op !== "update") return null;
	const patch = operationPatch(operation);
	if (hasOwn(patch, "description")) {
		state.campaignMeta.description = asText(patch.description);
		return { type: "campaign", saved: state.campaignMeta };
	}
	return null;
}

function hasMonstersWithoutIds(monsters) {
	return monsters.some((monster) => !asText(monster?.id));
}

async function readMaterializedCustomMonsters() {
	const monsters = await storage.readCustomBestiaryMonsters();
	return hasMonstersWithoutIds(monsters)
		? storage.writeCustomBestiaryMonsters(monsters)
		: monsters;
}

function getMonsterOperationIdentity(operation) {
	return {
		id: asText(operation.id || operation.targetId),
		name: asText(operation.name || operation.targetName || operation.id),
	};
}

function findMonsterIndexById(monsters, id) {
	if (!id) return -1;
	return monsters.findIndex((monster) => asText(monster.id) === id);
}

function findMonsterIndexByName(monsters, name) {
	if (!name) return -1;
	const normalizedName = name.toLowerCase();
	return monsters.findIndex(
		(monster) => asText(monster.name).toLowerCase() === normalizedName,
	);
}

function findMonsterOperationIndex(monsters, operation) {
	const identity = getMonsterOperationIdentity(operation);
	const idIndex = findMonsterIndexById(monsters, identity.id);
	return idIndex >= 0
		? idIndex
		: findMonsterIndexByName(monsters, identity.name);
}

function markChangedMonster(state, monster) {
	state.changedMonsters.push(monster);
	state.hasChanges = true;
}

function applyMonsterDelete(state, operation) {
	const index = findMonsterOperationIndex(state.monsters, operation);
	if (index < 0) return;
	state.monsters.splice(index, 1);
	state.hasChanges = true;
}

function getMonsterNameKey(monster) {
	return asText(monster?.name).toLowerCase();
}

function applyMonsterCreate(state, operation) {
	const data = { ...operationData(operation) };
	delete data.id;
	const normalized = normalizeCustomMonster(data);
	if (!normalized) return;
	const nameKey = getMonsterNameKey(normalized);
	state.monsters = state.monsters.filter(
		(monster) => getMonsterNameKey(monster) !== nameKey,
	);
	state.monsters.push(normalized);
	markChangedMonster(state, normalized);
}

function applyMonsterUpdate(state, operation) {
	const index = findMonsterOperationIndex(state.monsters, operation);
	if (index < 0) return;
	const existing = state.monsters[index];
	const patch = operationPatch(operation);
	const normalized = normalizeCustomMonster({
		...existing,
		...patch,
		id: existing.id,
		name: patch.name || existing.name,
	});
	if (!normalized) return;
	state.monsters[index] = normalized;
	markChangedMonster(state, normalized);
}

const MONSTER_OPERATION_HANDLERS = new Map([
	["create", applyMonsterCreate],
	["update", applyMonsterUpdate],
	["delete", applyMonsterDelete],
]);

function applyMonsterOperation(state, operation) {
	if (!isMonsterOperation(operation)) return;
	const operationName = asText(operation.op).toLowerCase();
	MONSTER_OPERATION_HANDLERS.get(operationName)?.(state, operation);
}

async function applyMonsterOperations(operations) {
	const before = await readMaterializedCustomMonsters();
	const state = {
		monsters: [...before],
		changedMonsters: [],
		hasChanges: false,
	};
	for (const operation of operations) applyMonsterOperation(state, operation);
	const after = await storage.writeCustomBestiaryMonsters(state.monsters);
	return {
		before,
		after,
		changedMonsters: state.changedMonsters,
		hasChanges: state.hasChanges,
	};
}

const MONSTER_OPERATION_ENTITIES = new Set([
	"monster",
	"custom-monster",
	"custommonster",
]);
const NOTE_OPERATION_NAMES = new Set([
	"appendnote",
	"updatenote",
	"deletenote",
]);

function getAiOperations(payload) {
	return Array.isArray(payload?.operations) ? payload.operations : [];
}

function isMonsterOperation(operation) {
	return MONSTER_OPERATION_ENTITIES.has(
		asText(operation?.entity).toLowerCase(),
	);
}

function getDefaultEntityScope(sessionFile, entityScope) {
	return sessionFile && entityScope !== "campaign" ? "session" : "campaign";
}

async function loadAiOperationTargets(campaignSlug, sessionFile) {
	const campaignMeta =
		campaignSlug && campaignSlug !== "bestiary"
			? await storage.readCampaign(campaignSlug)
			: null;
	const sessionData =
		campaignSlug && sessionFile
			? await storage.readSession(campaignSlug, sessionFile).catch(() => null)
			: null;
	return { campaignMeta, sessionData };
}

function createAiOperationState({
	operations,
	campaignSlug,
	sessionFile,
	entityScope,
	encounterId,
	permissions,
	campaignMeta,
	sessionData,
}) {
	return {
		campaignSlug,
		sessionData,
		campaignMeta,
		clientIdMap: new Map(),
		defaultEntityScope: getDefaultEntityScope(sessionFile, entityScope),
		encounterId,
		permissions,
		warnings: [],
		campaignEntityCache: new Map(),
		linkedEncounterClientIds: collectSceneEncounterClientIds(operations),
		pendingSceneEncounterLinks: [],
		createdEncounterIds: new Set(),
		scopeMoveRollbacks: [],
	};
}

function operationOutcome(applied, campaignChanged = false, sessionChanged = false) {
	const didApply = Boolean(applied);
	return {
		applied: didApply,
		campaignChanged: didApply && campaignChanged,
		sessionChanged: didApply && sessionChanged,
	};
}

function getNoteOperationScope(state, operation, entity) {
	const type = entityTypeFromOperation(entity);
	return getNoteTargetScope(state, operation, type);
}

function isSessionNoteTarget(entity, scope) {
	return (
		entity === "session" ||
		SCENE_OPERATION_ENTITIES.has(entity) ||
		scope === "session"
	);
}

function getNoteOperationOutcome(state, operation, result) {
	if (!result) return operationOutcome(false);
	const entity = asText(operation.entity).toLowerCase();
	const scope = getNoteOperationScope(state, operation, entity);
	return operationOutcome(
		true,
		entity === "campaign",
		isSessionNoteTarget(entity, scope),
	);
}

async function dispatchNoteOperation(state, operation, options) {
	const result = await applyNoteOperation(state, operation, options);
	return getNoteOperationOutcome(state, operation, result);
}

function dispatchCampaignOperation(state, operation) {
	return operationOutcome(applyCampaignOperation(state, operation), true, false);
}

function dispatchSceneOperation(state, operation, options) {
	return operationOutcome(
		applySceneOperation(state, operation, options),
		false,
		true,
	);
}

async function dispatchEncounterOperation(state, operation) {
	const result = await applyEncounterOperation(state, operation);
	return operationOutcome(result, false, true);
}

async function dispatchEntityOperation(state, operation, options) {
	const result = await applyEntityOperation(state, operation, options);
	const sessionChanged = Boolean(
		result && (result.scope === "session" || result.moved || result.sessionChanged),
	);
	return operationOutcome(result, false, sessionChanged);
}

const ENTITY_OPERATION_DISPATCHERS = new Map([
	["campaign", dispatchCampaignOperation],
	["scene", dispatchSceneOperation],
	["scenes", dispatchSceneOperation],
	["encounter", dispatchEncounterOperation],
	["encounters", dispatchEncounterOperation],
]);

function isDispatchableAiOperation(operation) {
	if (!operation || typeof operation !== "object") return false;
	return !isMonsterOperation(operation);
}

function getEntityOperationDispatcher(entity) {
	const dispatcher = ENTITY_OPERATION_DISPATCHERS.get(entity);
	if (dispatcher) return dispatcher;
	return entityTypeFromOperation(entity) ? dispatchEntityOperation : null;
}

function getAiOperationDispatcher(operation) {
	if (!isDispatchableAiOperation(operation)) return null;
	const op = asText(operation.op).toLowerCase();
	if (NOTE_OPERATION_NAMES.has(op)) return dispatchNoteOperation;
	const entity = asText(operation.entity).toLowerCase();
	return getEntityOperationDispatcher(entity);
}

async function dispatchAiOperation(state, operation, options) {
	const dispatcher = getAiOperationDispatcher(operation);
	return dispatcher
		? dispatcher(state, operation, options)
		: operationOutcome(false);
}

function mergeOperationOutcome(changes, outcome) {
	changes.hasAppliedChanges ||= outcome.applied;
	changes.campaignMetaChanged ||= outcome.campaignChanged;
	changes.sessionDataChanged ||= outcome.sessionChanged;
}

function applyPendingEncounterLinks(state) {
	const linksResolved = resolvePendingSceneEncounterLinks(state);
	const encountersRemoved = removeCreatedUnlinkedEncounters(state);
	return operationOutcome(
		linksResolved || encountersRemoved,
		false,
		linksResolved || encountersRemoved,
	);
}

async function persistChangedCampaignMeta(state, changes) {
	if (changes.campaignMetaChanged && state.campaignMeta) {
		await storage.writeJson(
			storage.campaignMetaPath(state.campaignSlug),
			state.campaignMeta,
		);
	}
}

async function persistChangedSession(state, changes, sessionFile) {
	if (changes.sessionDataChanged && state.sessionData) {
		await storage.writeJson(
			storage.sessionPath(state.campaignSlug, sessionFile),
			state.sessionData,
		);
		return { ...state.sessionData, fileName: sessionFile };
	}
	return null;
}

function getChangedCampaignResource(state, changes) {
	return changes.hasAppliedChanges && state.campaignMeta
		? state.campaignMeta
		: null;
}

async function persistAiOperationChanges(state, changes, sessionFile) {
	await persistChangedCampaignMeta(state, changes);
	const sessionResource = await persistChangedSession(
		state,
		changes,
		sessionFile,
	);
	return sessionResource || getChangedCampaignResource(state, changes);
}

async function rollbackPendingScopeMoves(state) {
	const rollbacks = state.scopeMoveRollbacks.splice(0).reverse();
	for (const rollback of rollbacks) {
		await rollback().catch(() => {});
	}
}

function clearPendingScopeMoveRollbacks(state) {
	state.scopeMoveRollbacks.length = 0;
}

async function applyAndPersistRegularOperations(
	state,
	operations,
	options,
	changes,
	sessionFile,
) {
	try {
		for (const operation of operations) {
			const outcome = await dispatchAiOperation(state, operation, options);
			mergeOperationOutcome(changes, outcome);
		}
		mergeOperationOutcome(changes, applyPendingEncounterLinks(state));
		const persisted = await persistAiOperationChanges(
			state,
			changes,
			sessionFile,
		);
		clearPendingScopeMoveRollbacks(state);
		return persisted;
	} catch (error) {
		await rollbackPendingScopeMoves(state);
		throw error;
	}
}

function getUpdatedAiResource(updated, customBestiaryChange, campaignMeta) {
	if (updated) return updated;
	return customBestiaryChange?.hasChanges && !campaignMeta
		? { monsters: customBestiaryChange.after }
		: null;
}

async function applyAiOperations({
	payload,
	campaignSlug,
	sessionFile,
	encounterId,
	entityScope,
	simplifiedNotes = false,
	permissions = {},
}) {
	const operations = getAiOperations(payload);
	const targets = await loadAiOperationTargets(campaignSlug, sessionFile);
	const state = createAiOperationState({
		operations,
		campaignSlug,
		sessionFile,
		entityScope,
		encounterId,
		permissions,
		...targets,
	});
	const normalizerOptions = { simplifiedNotes };
	const changes = {
		hasAppliedChanges: false,
		campaignMetaChanged: false,
		sessionDataChanged: false,
	};
	const monsterOperations = operations.filter(isMonsterOperation);
	let customBestiaryChange = null;

	if (monsterOperations.length > 0) {
		customBestiaryChange = await applyMonsterOperations(monsterOperations);
	}

	const persistedResource = await applyAndPersistRegularOperations(
		state,
		operations,
		normalizerOptions,
		changes,
		sessionFile,
	);
	const updated = getUpdatedAiResource(
		persistedResource,
		customBestiaryChange,
		state.campaignMeta,
	);

	return {
		updated,
		warnings: state.warnings,
		customBestiaryChange,
		changedMonsters: customBestiaryChange?.changedMonsters || [],
	};
}

module.exports = {
	applyAiOperations,
	mergeAiIgnoredNotes,
};
