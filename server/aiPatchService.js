const storage = require("./storage");
const { normalizeCustomMonster } = require("./aiCustomMonsterService");

function makeId() {
	return storage.createId();
}

function asText(value) {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value.trim();
	if (
		typeof value === "number" ||
		typeof value === "bigint" ||
		typeof value === "boolean"
	) {
		return String(value).trim();
	}
	return "";
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

function sanitizeEntityName(value) {
	let name = asText(value);
	if (!name) return "";

	while (name.startsWith("[") && name.endsWith("]")) {
		name = name.slice(1, -1).trim();
	}

	return name.replace(/\s+/g, " ");
}

function parseNameParts(raw = {}) {
	const firstName = sanitizeEntityName(raw.firstName || raw.first_name);
	const lastName = sanitizeEntityName(raw.lastName || raw.last_name);
	if (firstName || lastName) {
		return { firstName, lastName };
	}

	const fullName = sanitizeEntityName(raw.name || raw.fullName || raw.title);
	if (!fullName) return { firstName: "", lastName: "" };
	const parts = fullName.split(/\s+/).filter(Boolean);
	if (parts.length === 1) return { firstName: parts[0], lastName: "" };
	return {
		firstName: parts[0],
		lastName: parts.slice(1).join(" "),
	};
}

function normalizeLevel(rawLevel) {
	if (typeof rawLevel === "string" && rawLevel.trim() === "") return "";
	const parsed = Number.parseInt(String(rawLevel ?? "1"), 10);
	if (!Number.isFinite(parsed)) return 1;
	if (parsed < 1) return 1;
	if (parsed > 20) return 20;
	return parsed;
}

function normalizeNote(note, { simplifiedNotes = false } = {}) {
	if (typeof note === "string") {
		const text = note.trim();
		return {
			id: makeId(),
			title: "",
			text,
			collapsed: false,
		};
	}

	if (!note || typeof note !== "object") {
		return null;
	}

	const rawTitle = simplifiedNotes ? "" : asText(note.title || note.name);
	const rawText = String(
		note.text ?? note.description ?? note.content ?? "",
	);

	return {
		id: note.id || makeId(),
		title: rawTitle,
		text: rawText,
		collapsed: Boolean(note.collapsed),
	};
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

function mergeAiIgnoredNotes(existingNotes = [], visibleNotes = []) {
	const existing = Array.isArray(existingNotes) ? existingNotes : [];
	if (!existing.some(isAiIgnored)) return visibleNotes;
	const ignoredNotes = existing.filter(isAiIgnored);
	const ignoredIds = new Set(
		ignoredNotes.map((note) => asText(note?.id)).filter(Boolean),
	);
	const result = (Array.isArray(visibleNotes) ? visibleNotes : []).filter(
		(note) => {
			const id = asText(note?.id);
			return !id || !ignoredIds.has(id);
		},
	);
	const visibleIndexById = () =>
		new Map(
			result
				.map((note, index) => [asText(note?.id), index])
				.filter(([id]) => Boolean(id)),
		);

	for (const ignoredNote of ignoredNotes) {
		const originalIndex = existing.indexOf(ignoredNote);
		const previousVisible = [...existing.slice(0, originalIndex)]
			.reverse()
			.find((note) => !isAiIgnored(note) && asText(note?.id));
		const nextVisible = existing
			.slice(originalIndex + 1)
			.find((note) => !isAiIgnored(note) && asText(note?.id));
		const indexes = visibleIndexById();
		const previousIndex = indexes.get(asText(previousVisible?.id));
		const nextIndex = indexes.get(asText(nextVisible?.id));

		if (previousIndex !== undefined) {
			result.splice(previousIndex + 1, 0, ignoredNote);
		} else if (nextIndex !== undefined) {
			result.splice(nextIndex, 0, ignoredNote);
		} else {
			result.splice(Math.min(originalIndex, result.length), 0, ignoredNote);
		}
	}

	return result;
}

function normalizeCharacter(raw, existing = null, { simplifiedNotes = false } = {}) {
	const nameParts = parseNameParts(raw);
	const rawHasName = [
		"name",
		"fullName",
		"title",
		"firstName",
		"first_name",
		"lastName",
		"last_name",
	].some((key) => hasOwn(raw, key));
	const fallbackDescription = asText(
		raw.description || raw.bio || raw.backstory,
	);
	const notesSource = Array.isArray(raw.notes)
		? raw.notes
		: existing
			? existing.notes || []
			: fallbackDescription
				? [fallbackDescription]
				: [];
	const rawRace = firstOwnedValue(raw, ["race", "species"]);
	const rawClass = firstOwnedValue(raw, ["class", "role"]);
	const rawMotivation = firstOwnedValue(raw, [
		"motivation",
		"goal",
		"description",
	]);
	const rawTrait = firstOwnedValue(raw, ["trait", "personality", "quirk"]);

	const notes = normalizeNotesPreservingExisting(notesSource, existing?.notes || [], {
		keepAtLeastOne: true,
		simplifiedNotes,
	});

	return {
		id: existing?.id || makeId(),
		firstName: rawHasName ? nameParts.firstName : existing?.firstName || "",
		lastName: rawHasName ? nameParts.lastName : existing?.lastName || "",
		race: rawRace !== undefined ? asText(rawRace) : existing?.race || "",
		class: rawClass !== undefined ? asText(rawClass) : existing?.class || "",
		level: hasOwn(raw, "level")
			? normalizeLevel(raw.level)
			: normalizeLevel(existing?.level),
		motivation:
			rawMotivation !== undefined
				? asText(rawMotivation)
				: existing?.motivation || "",
		trait: rawTrait !== undefined ? asText(rawTrait) : existing?.trait || "",
		notes: mergeAiIgnoredNotes(existing?.notes || [], notes),
		collapsed: Boolean(existing?.collapsed ?? raw.collapsed ?? false),
		isNotesCollapsed: Boolean(
			existing?.isNotesCollapsed ?? raw.isNotesCollapsed ?? false,
		),
		imageUrl: existing?.imageUrl ?? raw.imageUrl ?? null,
	};
}

function normalizeLocation(raw, existing = null, { simplifiedNotes = false } = {}) {
	const rawName = firstOwnedValue(raw, ["name", "title"]);
	const rawDescription = firstOwnedValue(raw, [
		"description",
		"summary",
		"text",
	]);
	const fallbackDescription =
		rawDescription !== undefined
			? asText(rawDescription)
			: existing?.description || "";
	const notesSource = Array.isArray(raw.notes)
		? raw.notes
		: existing
			? existing.notes || []
			: [];

	const notes = normalizeNotesPreservingExisting(notesSource, existing?.notes || [], {
		keepAtLeastOne: true,
		simplifiedNotes,
	});

	return {
		id: existing?.id || makeId(),
		name:
			rawName !== undefined
				? sanitizeEntityName(rawName)
				: existing?.name || "",
		description: fallbackDescription,
		notes: mergeAiIgnoredNotes(existing?.notes || [], notes),
		collapsed: Boolean(existing?.collapsed ?? raw.collapsed ?? false),
		isNotesCollapsed: Boolean(
			existing?.isNotesCollapsed ?? raw.isNotesCollapsed ?? false,
		),
		imageUrl: existing?.imageUrl ?? raw.imageUrl ?? null,
	};
}

function normalizeSceneTexts(rawScene = {}, existingTexts = {}) {
	const source =
		rawScene.texts && typeof rawScene.texts === "object"
			? rawScene.texts
			: rawScene;
	return {
		summary: hasOwn(source, "summary")
			? asText(source.summary)
			: existingTexts?.summary || "",
		goal: hasOwn(source, "goal") ? asText(source.goal) : existingTexts?.goal || "",
		stakes: hasOwn(source, "stakes")
			? asText(source.stakes)
			: existingTexts?.stakes || "",
		location: hasOwn(source, "location")
			? asText(source.location)
			: existingTexts?.location || "",
	};
}

function normalizeSceneNpcs(npcs) {
	if (!Array.isArray(npcs)) return [];
	return npcs
		.map((npc) => {
			if (typeof npc === "string") {
				const name = asText(npc);
				return name ? { name, description: "" } : null;
			}
			if (!npc || typeof npc !== "object") return null;
			const name = asText(npc.name || npc.firstName);
			if (!name) return null;
			return {
				name,
				description: asText(npc.description || npc.trait || ""),
			};
		})
		.filter(Boolean);
}

function resolveEncounterId(raw, clientIdMap, existingEncounterId = "") {
	const direct = asText(raw?.encounterId);
	if (direct) return direct;
	const clientId = asText(raw?.encounterClientId);
	if (clientId) {
		const mapped = clientIdMap.get(clientId);
		if (mapped?.entity === "encounter") return mapped.id;
	}
	return existingEncounterId || "";
}

function normalizeScene(
	scene,
	existing,
	clientIdMap,
	{ simplifiedNotes = false } = {},
) {
	const hasNotes = Array.isArray(scene.notes);
	const notesFromAi = hasNotes
		? mergeAiIgnoredNotes(
				existing?.notes || [],
				normalizeNotesPreservingExisting(scene.notes || [], existing?.notes || [], {
					simplifiedNotes,
				}),
			)
		: existing?.notes || [];
	const hasNpcs = Array.isArray(scene.npcs);

	return {
		id: existing?.id || makeId(),
		texts: normalizeSceneTexts(scene, existing?.texts || {}),
		notes: hasNotes ? notesFromAi : existing?.notes || [],
		isNotesCollapsed: Boolean(existing?.isNotesCollapsed),
		npcs: hasNpcs ? normalizeSceneNpcs(scene.npcs) : existing?.npcs || [],
		collapsed: Boolean(existing?.collapsed),
		encounterId: resolveEncounterId(scene, clientIdMap, existing?.encounterId),
		imageUrl: existing?.imageUrl ?? scene.imageUrl ?? null,
	};
}

function buildMonsterInstance(monster, bestiaryIndex) {
	const monsterName = asText(monster?.monsterName || monster?.name);
	if (!monsterName) return null;

	let foundBase = null;
	const searchKey = monsterName.toLowerCase();
	for (const [key, data] of bestiaryIndex.entries()) {
		if (key.startsWith(`${searchKey}|`)) {
			foundBase = data;
			break;
		}
	}

	const resolved = foundBase || null;
	const instance = {
		...(resolved || {}),
		instanceId: `inst-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
		name: asText(monster?.name) || (resolved ? resolved.name : monsterName),
		originalBestiaryName: resolved ? resolved.name : monsterName,
		source: resolved ? resolved.source : asText(monster?.source) || "Unknown",
	};

	if (resolved) {
		const hpVal =
			typeof resolved.hp === "object"
				? resolved.hp.average || 0
				: resolved.hit_points || 0;
		instance.currentHp = hpVal;
		instance.hit_points = hpVal;

		let acVal = resolved.armor_class || 0;
		if (Array.isArray(resolved.ac) && resolved.ac[0]) {
			const entry = resolved.ac[0];
			acVal = typeof entry === "object" ? entry.ac || 0 : entry;
		}
		instance.armor_class = acVal;
	} else {
		instance.currentHp = 0;
		instance.hit_points = 0;
		instance.armor_class = 0;
	}

	return instance;
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

function getCharacterDisplayName(entity = {}) {
	const firstName = asText(entity.firstName || entity.first_name);
	const lastName = asText(entity.lastName || entity.last_name);
	const combined = `${firstName} ${lastName}`.trim();
	if (combined) return combined;
	return asText(entity.name || entity.title);
}

function getLocationDisplayName(entity = {}) {
	return asText(entity.name || entity.title);
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

function findByIdentity(items = [], identity, type) {
	const id = asText(identity?.id || identity?.targetId);
	const slug = asText(identity?.slug);
	const name = asText(identity?.name || identity?.targetName);
	const key = name ? getEntityNameKey(type, { name, fullName: name }) : "";
	return (items || []).find((item) => {
		const itemId = asText(item?.id);
		const itemSlug = asText(item?.slug);
		const itemName = getEntityNameKey(type, item);
		return (
			(id && itemId === id) ||
			(slug && itemSlug === slug) ||
			(key && itemName === key)
		);
	}) || null;
}

function getOperationTargetIdentity(operation = {}, clientIdMap = null) {
	const ownerClientId = asText(operation.targetClientId || operation.ownerClientId);
	const mapped = ownerClientId && clientIdMap ? clientIdMap.get(ownerClientId) : null;
	return {
		id: mapped?.id || operation.id || operation.targetId,
		slug: operation.slug,
		name: operation.name || operation.targetName,
	};
}

function normalizeEntityPayload(type, raw, existing, options) {
	return type === "locations"
		? normalizeLocation(raw, existing, options)
		: normalizeCharacter(raw, existing, options);
}

function mergeEntityPatch(existing, patch = {}) {
	return {
		...(existing || {}),
		...(patch && typeof patch === "object" ? patch : {}),
		id: existing?.id || patch?.id,
		slug: existing?.slug || patch?.slug,
		imageUrl: existing?.imageUrl ?? patch?.imageUrl ?? null,
	};
}

async function readCampaignEntityList(campaignSlug, type) {
	return storage.listEntities(campaignSlug, type);
}

async function writeCampaignEntity(campaignSlug, type, payload, existing = null) {
	const baseName =
		type === "locations"
			? payload.name || "locations"
			: payload.firstName || payload.name || type;
	const entitySlug =
		existing?.slug ||
		payload.slug ||
		(await storage.ensureUniqueEntitySlug(
			campaignSlug,
			type,
			storage.campaignSlug(baseName),
		));
	const saved = await storage.writeEntity(campaignSlug, type, entitySlug, {
		...payload,
		slug: entitySlug,
	});
	return saved;
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
	const normalized = normalizeNote({ ...notes[index], ...patch, id: notes[index].id }, options);
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

function operationScope(operation, defaultScope) {
	const scope = asText(operation.scope).toLowerCase();
	if (scope === "campaign" || scope === "session") return scope;
	return defaultScope || "campaign";
}

function isOperationAllowed(type, permissions) {
	if (type === "characters") return permissions.allowCharacters !== false;
	if (type === "npc") return permissions.allowNpcs !== false;
	if (type === "locations") return permissions.allowLocations !== false;
	return true;
}

function operationData(operation) {
	if (operation.data && typeof operation.data === "object") return operation.data;
	if (operation.value && typeof operation.value === "object") return operation.value;
	if (operation.patch && typeof operation.patch === "object") return operation.patch;
	return {};
}

function operationPatch(operation) {
	if (operation.patch && typeof operation.patch === "object") return operation.patch;
	if (operation.data && typeof operation.data === "object") return operation.data;
	return {};
}

async function applyCampaignEntityOperation(
	state,
	operation,
	type,
	options,
) {
	const { campaignSlug, clientIdMap, permissions, warnings } = state;
	if (!isOperationAllowed(type, permissions)) {
		warnings.push(`Skipped ${operation.op} for disabled ${type}.`);
		return null;
	}
	const existingList = await readCampaignEntityList(campaignSlug, type);
	const existing = findByIdentity(
		existingList,
		getOperationTargetIdentity(operation, clientIdMap),
		type,
	);
	const normalizedOp = asText(operation.op).toLowerCase();

	if (normalizedOp === "delete") {
		if (!existing) return null;
		await storage.deleteEntity(campaignSlug, type, existing.slug);
		return { type, scope: "campaign", deleted: existing };
	}

	if (normalizedOp === "create") {
		const rawData = {
			...operationData(operation),
			id: makeId(),
		};
		const normalized = normalizeEntityPayload(type, rawData, null, options);
		if (type === "locations" && !normalized.name) return null;
		if (type !== "locations" && !normalized.firstName && !normalized.lastName) {
			return null;
		}
		const saved = await writeCampaignEntity(campaignSlug, type, normalized);
		if (operation.clientId) {
			clientIdMap.set(asText(operation.clientId), {
				entity: entityKindFromStorageType(type),
				scope: "campaign",
				id: saved.id,
				slug: saved.slug,
				name: getEntityDisplayName(type, saved),
			});
		}
		return { type, scope: "campaign", saved };
	}

	if (normalizedOp === "update") {
		if (!existing) return null;
		const oldDisplayName = getEntityDisplayName(type, existing);
		const raw = mergeEntityPatch(existing, operationPatch(operation));
		const normalized = normalizeEntityPayload(type, raw, existing, options);
		const payload = {
			...existing,
			...normalized,
			id: existing.id,
			slug: existing.slug,
			imageUrl: existing.imageUrl ?? normalized.imageUrl ?? null,
		};
		const saved = await writeCampaignEntity(campaignSlug, type, payload, existing);
		const newDisplayName = getEntityDisplayName(type, saved);
		if (oldDisplayName && newDisplayName && oldDisplayName !== newDisplayName) {
			await storage.updateCampaignMentionReferences(
				campaignSlug,
				oldDisplayName,
				newDisplayName,
			);
		}
		return { type, scope: "campaign", saved };
	}

	return null;
}

function applySessionEntityOperation(state, operation, type, options) {
	const { sessionData, clientIdMap, permissions, warnings } = state;
	if (!sessionData) {
		warnings.push(`Skipped session ${operation.op}; no session target.`);
		return null;
	}
	if (!isOperationAllowed(type, permissions)) {
		warnings.push(`Skipped ${operation.op} for disabled ${type}.`);
		return null;
	}

	const list = getSessionEntityList(sessionData, type);
	const existing = findByIdentity(
		list,
		getOperationTargetIdentity(operation, clientIdMap),
		type,
	);
	const normalizedOp = asText(operation.op).toLowerCase();

	if (normalizedOp === "delete") {
		if (!existing) return null;
		setSessionEntityList(
			sessionData,
			type,
			list.filter((item) => item !== existing),
		);
		return { type, scope: "session", deleted: existing };
	}

	if (normalizedOp === "create") {
		const rawData = {
			...operationData(operation),
			id: makeId(),
		};
		const normalized = normalizeEntityPayload(type, rawData, null, options);
		if (type === "locations" && !normalized.name) return null;
		if (type !== "locations" && !normalized.firstName && !normalized.lastName) {
			return null;
		}
		const saved = {
			...normalized,
			id: normalized.id,
			slug: normalized.slug || storage.campaignSlug(
				type === "locations"
					? normalized.name || "locations"
					: getCharacterDisplayName(normalized) || type,
			),
		};
		list.push(saved);
		if (operation.clientId) {
			clientIdMap.set(asText(operation.clientId), {
				entity: entityKindFromStorageType(type),
				scope: "session",
				id: saved.id,
				slug: saved.slug,
				name: getEntityDisplayName(type, saved),
			});
		}
		return { type, scope: "session", saved };
	}

	if (normalizedOp === "update") {
		if (!existing) return null;
		const raw = mergeEntityPatch(existing, operationPatch(operation));
		const normalized = normalizeEntityPayload(type, raw, existing, options);
		const saved = {
			...existing,
			...normalized,
			id: existing.id,
			slug: existing.slug,
			imageUrl: existing.imageUrl ?? normalized.imageUrl ?? null,
		};
		const index = list.indexOf(existing);
		list[index] = saved;
		return { type, scope: "session", saved };
	}

	return null;
}

async function applyMoveScopeOperation(state, operation, type, options) {
	const { campaignSlug, sessionData, warnings } = state;
	if (!sessionData) {
		warnings.push("Skipped moveScope; no session target.");
		return null;
	}
	const from = asText(operation.from || operation.scope).toLowerCase();
	const to = asText(operation.to || operation.targetScope).toLowerCase();
	if (!["campaign", "session"].includes(from) || !["campaign", "session"].includes(to)) {
		warnings.push("Skipped moveScope with invalid scope.");
		return null;
	}
	if (from === to) return null;

	if (from === "session") {
		const list = getSessionEntityList(sessionData, type);
		const existing = findByIdentity(
			list,
			getOperationTargetIdentity(operation, state.clientIdMap),
			type,
		);
		if (!existing) return null;
		const normalized = normalizeEntityPayload(type, existing, existing, options);
		const saved = await writeCampaignEntity(campaignSlug, type, normalized);
		setSessionEntityList(
			sessionData,
			type,
			list.filter((item) => item !== existing),
		);
		return { type, moved: true, from, to, saved };
	}

	const campaignEntities = await storage.listEntities(campaignSlug, type);
	const existing = findByIdentity(
		campaignEntities,
		getOperationTargetIdentity(operation, state.clientIdMap),
		type,
	);
	if (!existing) return null;
	const list = getSessionEntityList(sessionData, type);
	const normalized = normalizeEntityPayload(type, existing, existing, options);
	const saved = {
		...normalized,
		id: normalized.id,
		slug: normalized.slug || existing.slug || storage.campaignSlug(
			type === "locations"
				? normalized.name || "locations"
				: getCharacterDisplayName(normalized) || type,
		),
	};
	list.push(saved);
	await storage.deleteEntity(campaignSlug, type, existing.slug);
	return { type, moved: true, from, to, saved };
}

async function applyEntityOperation(state, operation, options) {
	const type = entityTypeFromOperation(operation.entity);
	if (!type) return null;
	if (asText(operation.op).toLowerCase() === "movescope") {
		return applyMoveScopeOperation(state, operation, type, options);
	}
	const defaultScope =
		type === "characters" ? "campaign" : state.defaultEntityScope;
	const scope = operationScope(operation, defaultScope);
	if (scope === "session" && type !== "characters") {
		return applySessionEntityOperation(state, operation, type, options);
	}
	return applyCampaignEntityOperation(state, operation, type, options);
}

function findScene(sessionData, operation, clientIdMap = null) {
	const scenes = getSessionScenes(sessionData);
	const identity = getOperationTargetIdentity(operation, clientIdMap);
	const id = asText(identity.id);
	return scenes.find((scene) => asText(scene.id) === id) || null;
}

function applySceneOperation(state, operation, options) {
	const { sessionData, clientIdMap, permissions, warnings } = state;
	if (!sessionData) {
		warnings.push(`Skipped scene ${operation.op}; no session target.`);
		return null;
	}
	const normalizedOp = asText(operation.op).toLowerCase();
	const scenes = getSessionScenes(sessionData);

	if (normalizedOp === "delete") {
		const existing = findScene(sessionData, operation, clientIdMap);
		if (!existing) return null;
		sessionData.data.scenes = scenes.filter((scene) => scene !== existing);
		return { type: "scene", deleted: existing };
	}

	if (normalizedOp === "create") {
		const data = operationData(operation);
		const safeData = permissions.allowEncounters === false
			? { ...data, encounterId: "", encounterClientId: "" }
			: data;
		const saved = normalizeScene(safeData, null, clientIdMap, options);
		scenes.push(saved);
		if (operation.clientId) {
			clientIdMap.set(asText(operation.clientId), {
				entity: "scene",
				scope: "session",
				id: saved.id,
			});
		}
		return { type: "scene", saved };
	}

	if (normalizedOp === "update") {
		const existing = findScene(sessionData, operation, clientIdMap);
		if (!existing) return null;
		const patch = operationPatch(operation);
		const raw = {
			...existing,
			...patch,
			texts: {
				...(existing.texts || {}),
				...(patch.texts && typeof patch.texts === "object" ? patch.texts : {}),
			},
			id: existing.id,
			imageUrl: existing.imageUrl ?? patch.imageUrl ?? null,
		};
		const safeRaw = permissions.allowEncounters === false
			? { ...raw, encounterId: existing.encounterId || "" }
			: raw;
		const saved = normalizeScene(safeRaw, existing, clientIdMap, options);
		const index = scenes.indexOf(existing);
		scenes[index] = saved;
		return { type: "scene", saved };
	}

	return null;
}

async function applyEncounterOperation(state, operation) {
	const { sessionData, clientIdMap, permissions, warnings } = state;
	if (!sessionData) {
		warnings.push(`Skipped encounter ${operation.op}; no session target.`);
		return null;
	}
	if (permissions.allowEncounters === false) {
		warnings.push(`Skipped encounter ${operation.op}; encounter generation disabled.`);
		return null;
	}
	const encounters = getSessionEncounters(sessionData);
	const id = asText(operation.id || operation.targetId || state.encounterId);
	const existing = id
		? encounters.find((encounter) => asText(encounter.id) === id)
		: null;
	const normalizedOp = asText(operation.op).toLowerCase();
	const bestiaryIndex = await storage.getBestiaryIndex();

	if (normalizedOp === "delete") {
		if (!existing) return null;
		sessionData.data.encounters = encounters.filter((encounter) => encounter !== existing);
		return { type: "encounter", deleted: existing };
	}

	if (normalizedOp === "create") {
		const normalized = normalizeEncounterFromAi(
			operationData(operation),
			bestiaryIndex,
			`Бій ${encounters.length + 1}`,
		);
		const saved = {
			id: makeId(),
			name: normalized.name,
			monsters: normalized.monsters,
		};
		encounters.push(saved);
		if (operation.clientId) {
			clientIdMap.set(asText(operation.clientId), {
				entity: "encounter",
				scope: "session",
				id: saved.id,
			});
		}
		return { type: "encounter", saved };
	}

	if (normalizedOp === "update") {
		if (!existing) return null;
		const patch = operationPatch(operation);
		const normalized = normalizeEncounterFromAi(
			{
				name: hasOwn(patch, "name") ? patch.name : existing.name,
				monsters: Array.isArray(patch.monsters)
					? patch.monsters
					: existing.monsters || [],
			},
			bestiaryIndex,
			existing.name || "Бій",
		);
		existing.name = normalized.name;
		existing.monsters = normalized.monsters;
		return { type: "encounter", saved: existing };
	}

	return null;
}

function getNotesTarget(state, operation) {
	const entity = asText(operation.entity).toLowerCase();
	if (entity === "campaign") return state.campaignMeta;
	if (entity === "session") return state.sessionData?.data || null;
	if (entity === "scene") {
		return state.sessionData
			? findScene(state.sessionData, operation, state.clientIdMap)
			: null;
	}
	const type = entityTypeFromOperation(entity);
	if (!type) return null;
	const scope = operationScope(
		operation,
		type === "characters" ? "campaign" : state.defaultEntityScope,
	);
	if (scope === "session" && type !== "characters") {
		if (!state.sessionData) return null;
		const list = getSessionEntityList(state.sessionData, type);
		return findByIdentity(
			list,
			getOperationTargetIdentity(operation, state.clientIdMap),
			type,
		);
	}
	return state.campaignEntityCache.get(type)?.find((item) => {
		const target = findByIdentity(
			[item],
			getOperationTargetIdentity(operation, state.clientIdMap),
			type,
		);
		return Boolean(target);
	}) || null;
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

async function applyNoteOperation(state, operation, options) {
	const entity = asText(operation.entity).toLowerCase();
	const type = entityTypeFromOperation(entity);
	if (type) await ensureCampaignEntityCache(state, type);
	const target = getNotesTarget(state, operation);
	if (!target) return null;
	const normalizedOp = asText(operation.op).toLowerCase();
	const scope = type
		? operationScope(
				operation,
				type === "characters" ? "campaign" : state.defaultEntityScope,
			)
		: "";
	let result = null;
	if (normalizedOp === "appendnote") {
		result = appendNote(target, operation.note || operationData(operation), options);
	} else if (normalizedOp === "updatenote") {
		result = updateNote(
			target,
			operation.noteId || operation.id,
			operation.patch || operation.note || operationData(operation),
			options,
		);
	} else if (normalizedOp === "deletenote") {
		result = deleteNote(target, operation.noteId || operation.id);
	}
	if (result && type && scope !== "session") {
		const saved = await writeCampaignEntity(state.campaignSlug, type, target, target);
		const cached = state.campaignEntityCache.get(type) || [];
		const index = cached.findIndex((item) => item === target);
		if (index >= 0) cached[index] = saved;
	}
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

async function applyMonsterOperations(operations) {
	let existing = await storage.readCustomBestiaryMonsters();
	if (existing.some((monster) => !asText(monster?.id))) {
		existing = await storage.writeCustomBestiaryMonsters(existing);
	}
	let next = [...existing];
	const changedMonsters = [];
	let hasChanges = false;

	for (const operation of operations) {
		const entity = asText(operation.entity).toLowerCase();
		if (!["monster", "custom-monster", "custommonster"].includes(entity)) {
			continue;
		}
		const op = asText(operation.op).toLowerCase();
		const targetId = asText(operation.id || operation.targetId);
		const name = asText(operation.name || operation.targetName || operation.id);
		const index = next.findIndex((monster) => {
			if (targetId && asText(monster.id) === targetId) return true;
			return name && asText(monster.name).toLowerCase() === name.toLowerCase();
		});

		if (op === "delete") {
			if (index >= 0) {
				next.splice(index, 1);
				hasChanges = true;
			}
			continue;
		}

		if (op === "create") {
			const data = { ...operationData(operation) };
			delete data.id;
			const normalized = normalizeCustomMonster(data);
			if (!normalized) continue;
			next = next.filter(
				(monster) =>
					asText(monster.name).toLowerCase() !==
					asText(normalized.name).toLowerCase(),
			);
			next.push(normalized);
			changedMonsters.push(normalized);
			hasChanges = true;
			continue;
		}

		if (op === "update") {
			if (index < 0) continue;
			const normalized = normalizeCustomMonster({
				...next[index],
				...operationPatch(operation),
				id: next[index].id,
				name: operationPatch(operation).name || next[index].name,
			});
			if (!normalized) continue;
			next[index] = normalized;
			changedMonsters.push(normalized);
			hasChanges = true;
		}
	}

	const after = await storage.writeCustomBestiaryMonsters(next);
	return { before: existing, after, changedMonsters, hasChanges };
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
	const operations = Array.isArray(payload?.operations) ? payload.operations : [];
	const defaultEntityScope =
		sessionFile && entityScope !== "campaign" ? "session" : "campaign";
	const campaignMeta =
		campaignSlug && campaignSlug !== "bestiary"
			? await storage.readCampaign(campaignSlug)
			: null;
	const sessionData =
		campaignSlug && sessionFile
			? await storage.readSession(campaignSlug, sessionFile).catch(() => null)
			: null;
	const clientIdMap = new Map();
	const warnings = [];
	const state = {
		campaignSlug,
		sessionData,
		campaignMeta,
		clientIdMap,
		defaultEntityScope,
		encounterId,
		permissions,
		warnings,
		campaignEntityCache: new Map(),
	};
	const normalizerOptions = { simplifiedNotes };
	let campaignDataChanged = false;
	const monsterOperations = operations.filter((operation) =>
		["monster", "custom-monster", "custommonster"].includes(
			asText(operation.entity).toLowerCase(),
		),
	);
	let customBestiaryChange = null;

	if (monsterOperations.length > 0) {
		customBestiaryChange = await applyMonsterOperations(monsterOperations);
	}

	for (const operation of operations) {
		if (!operation || typeof operation !== "object") continue;
		const op = asText(operation.op).toLowerCase();
		const entity = asText(operation.entity).toLowerCase();
		if (["monster", "custom-monster", "custommonster"].includes(entity)) {
			continue;
		}

		if (["appendnote", "updatenote", "deletenote"].includes(op)) {
			const result = await applyNoteOperation(state, operation, normalizerOptions);
			campaignDataChanged = Boolean(result) || campaignDataChanged;
			continue;
		}

		if (entity === "campaign") {
			const result = applyCampaignOperation(state, operation);
			campaignDataChanged = Boolean(result) || campaignDataChanged;
			continue;
		}
		if (["scene", "scenes"].includes(entity)) {
			const result = applySceneOperation(state, operation, normalizerOptions);
			campaignDataChanged = Boolean(result) || campaignDataChanged;
			continue;
		}
		if (["encounter", "encounters"].includes(entity)) {
			const result = await applyEncounterOperation(state, operation);
			campaignDataChanged = Boolean(result) || campaignDataChanged;
			continue;
		}
		if (entityTypeFromOperation(entity)) {
			const result = await applyEntityOperation(state, operation, normalizerOptions);
			campaignDataChanged = Boolean(result) || campaignDataChanged;
		}
	}

	let updated = null;
	if (campaignDataChanged && campaignMeta && !sessionData) {
		await storage.writeJson(storage.campaignMetaPath(campaignSlug), campaignMeta);
		updated = campaignMeta;
	}
	if (campaignDataChanged && sessionData) {
		await storage.writeJson(storage.sessionPath(campaignSlug, sessionFile), sessionData);
		updated = { ...sessionData, fileName: sessionFile };
	} else if (customBestiaryChange?.hasChanges && !campaignMeta) {
		updated = { monsters: customBestiaryChange.after };
	}

	return {
		updated,
		warnings,
		customBestiaryChange,
		changedMonsters: customBestiaryChange?.changedMonsters || [],
	};
}

module.exports = {
	applyAiOperations,
	applyMonsterOperations,
	asText,
	mergeAiIgnoredNotes,
	normalizeCharacter,
	normalizeLocation,
	normalizeNote,
	normalizeScene,
};
