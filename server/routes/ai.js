const express = require("express");
const router = express.Router();
const storage = require("../storage");
const aiService = require("../aiService");

function makeId() {
	return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function asText(value) {
	return typeof value === "string" ? value.trim() : "";
}

function hasOwn(value, key) {
	return Boolean(
		value &&
			typeof value === "object" &&
			Object.prototype.hasOwnProperty.call(value, key),
	);
}

function hasAnyOwn(value, keys) {
	return keys.some((key) => hasOwn(value, key));
}

function firstOwnedValue(value, keys) {
	for (const key of keys) {
		if (hasOwn(value, key)) return value[key];
	}
	return undefined;
}

function isDeleteMarker(value) {
	if (!value || typeof value !== "object") return false;
	return Boolean(value.delete || value.deleted || value._delete);
}

function sanitizeEntityName(value) {
	let name = asText(value);
	if (!name) return "";

	// Remove any outer mention brackets from structured name fields: [John] -> John
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

function normalizeCharacter(raw, existing = null, { simplifiedNotes = false } = {}) {
	const nameParts = parseNameParts(raw);
	const rawHasName = hasAnyOwn(raw, [
		"name",
		"fullName",
		"title",
		"firstName",
		"first_name",
		"lastName",
		"last_name",
	]);
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

	return {
		id: existing?.id || raw.id || storage.createId(),
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
		notes: normalizeNotesPreservingExisting(notesSource, existing?.notes || [], {
			keepAtLeastOne: true,
			simplifiedNotes,
		}),
		collapsed: Boolean(existing?.collapsed ?? raw.collapsed ?? false),
		isNotesCollapsed: Boolean(
			existing?.isNotesCollapsed ?? raw.isNotesCollapsed ?? false,
		),
		// Never overwrite existing image links with AI output.
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

	return {
		id: existing?.id || raw.id || storage.createId(),
		name:
			rawName !== undefined
				? sanitizeEntityName(rawName)
				: existing?.name || "",
		description: fallbackDescription,
		notes: normalizeNotesPreservingExisting(notesSource, existing?.notes || [], {
			keepAtLeastOne: true,
			simplifiedNotes,
		}),
		collapsed: Boolean(existing?.collapsed ?? raw.collapsed ?? false),
		isNotesCollapsed: Boolean(
			existing?.isNotesCollapsed ?? raw.isNotesCollapsed ?? false,
		),
		imageUrl: existing?.imageUrl ?? raw.imageUrl ?? null,
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

function entityScopeFromContext(items = [], nameKeyFn) {
	if (!Array.isArray(items)) return null;
	return {
		ids: new Set(items.map((item) => asText(item?.id)).filter(Boolean)),
		slugs: new Set(items.map((item) => asText(item?.slug)).filter(Boolean)),
		names: new Set(items.map((item) => nameKeyFn(item)).filter(Boolean)),
	};
}

function isEntityInScope(entity, scope, nameKeyFn) {
	if (!scope) return false;
	const id = asText(entity?.id);
	const slug = asText(entity?.slug);
	const nameKey = nameKeyFn(entity);
	return (
		(id && scope.ids.has(id)) ||
		(slug && scope.slugs.has(slug)) ||
		(nameKey && scope.names.has(nameKey))
	);
}

function buildEntityIndexes(existing = [], nameKeyFn) {
	return {
		byId: new Map(
			existing
				.map((entity) => [asText(entity.id), entity])
				.filter(([id]) => Boolean(id)),
		),
		bySlug: new Map(existing.map((entity) => [entity.slug, entity])),
		byName: new Map(
			existing
				.map((entity) => ({ key: nameKeyFn(entity), entity }))
				.filter(({ key }) => Boolean(key))
				.map(({ key, entity }) => [key, entity]),
		),
	};
}

function findExistingEntity(rawEntity, indexes, nameKeyFn) {
	const id = asText(rawEntity?.id);
	const slug = asText(rawEntity?.slug);
	const nameKey = nameKeyFn(rawEntity);
	return (
		(id ? indexes.byId.get(id) : null) ||
		(slug ? indexes.bySlug.get(slug) : null) ||
		(nameKey ? indexes.byName.get(nameKey) : null) ||
		null
	);
}

function shouldAllowFinalStateDelete(userInstructions) {
	const text = asText(userInstructions).toLowerCase();
	if (!text) return false;
	return [
		"видали",
		"видалити",
		"прибери",
		"прибрати",
		"вилучи",
		"вилучити",
		"залиш тільки",
		"залишити тільки",
		"delete",
		"remove",
		"drop",
		"erase",
		"only keep",
	].some((hint) => text.includes(hint));
}

async function upsertGeneratedEntities(
	campaignSlug,
	type,
	generatedEntities,
	{
		contextEntities = null,
		allowFinalStateDelete = false,
		simplifiedNotes = false,
	} = {},
) {
	if (!Array.isArray(generatedEntities)) return;

	const existing = await storage.listEntities(campaignSlug, type);
	const indexes = buildEntityIndexes(existing, entityNameKey);
	const scope = entityScopeFromContext(contextEntities, entityNameKey);
	const appendOnly = !scope;
	const returnedScopedSlugs = new Set();
	const deletedSlugs = new Set();

	for (const rawEntity of generatedEntities) {
		if (!rawEntity || typeof rawEntity !== "object") continue;
		const nameParts = parseNameParts(rawEntity);
		const fullNameKey = entityNameKey(rawEntity);
		const baseSlug = storage.campaignSlug(
			nameParts.firstName || rawEntity.name || type,
		);

		const existingEntity = findExistingEntity(
			rawEntity,
			indexes,
			entityNameKey,
		);
		const existingIsScoped = existingEntity
			? isEntityInScope(existingEntity, scope, entityNameKey)
			: false;

		if (existingEntity && appendOnly) {
			continue;
		}

		if (existingEntity && !existingIsScoped) {
			continue;
		}

		if (isDeleteMarker(rawEntity)) {
			if (existingEntity && existingIsScoped) {
				await storage.deleteEntity(campaignSlug, type, existingEntity.slug);
				deletedSlugs.add(existingEntity.slug);
			}
			continue;
		}

		const normalized = normalizeCharacter(rawEntity, existingEntity, {
			simplifiedNotes,
		});
		if (!existingEntity && !normalized.firstName && !normalized.lastName) {
			continue;
		}

		if (existingEntity) {
			const oldDisplayName = getCharacterDisplayName(existingEntity);
			const payload = {
				...existingEntity,
				...normalized,
				slug: existingEntity.slug,
				id: existingEntity.id,
				imageUrl: existingEntity.imageUrl ?? normalized.imageUrl ?? null,
			};
			await storage.writeEntity(
				campaignSlug,
				type,
				existingEntity.slug,
				payload,
			);
			const newDisplayName = getCharacterDisplayName(payload);
			await storage.updateCampaignMentionReferences(
				campaignSlug,
				oldDisplayName,
				newDisplayName,
			);
			indexes.bySlug.set(existingEntity.slug, payload);
			if (payload.id) indexes.byId.set(payload.id, payload);
			if (fullNameKey) indexes.byName.set(fullNameKey, payload);
			returnedScopedSlugs.add(existingEntity.slug);
			continue;
		}

		if (!baseSlug) continue;
		const uniqueSlug = await storage.ensureUniqueEntitySlug(
			campaignSlug,
			type,
			baseSlug,
		);
		const payload = {
			...normalized,
			slug: uniqueSlug,
		};
		await storage.writeEntity(campaignSlug, type, uniqueSlug, payload);
		indexes.bySlug.set(uniqueSlug, payload);
		if (payload.id) indexes.byId.set(payload.id, payload);
		if (fullNameKey) indexes.byName.set(fullNameKey, payload);
	}

	if (scope && allowFinalStateDelete) {
		for (const entity of existing) {
			if (deletedSlugs.has(entity.slug)) continue;
			if (!isEntityInScope(entity, scope, entityNameKey)) continue;
			if (returnedScopedSlugs.has(entity.slug)) continue;
			await storage.deleteEntity(campaignSlug, type, entity.slug);
		}
	}
}

async function upsertGeneratedLocations(
	campaignSlug,
	generatedLocations,
	{
		contextLocations = null,
		allowFinalStateDelete = false,
		simplifiedNotes = false,
	} = {},
) {
	if (!Array.isArray(generatedLocations)) return;

	const existing = await storage.listEntities(campaignSlug, "locations");
	const indexes = buildEntityIndexes(existing, locationNameKey);
	const scope = entityScopeFromContext(contextLocations, locationNameKey);
	const appendOnly = !scope;
	const returnedScopedSlugs = new Set();
	const deletedSlugs = new Set();

	for (const rawLocation of generatedLocations) {
		if (!rawLocation || typeof rawLocation !== "object") continue;

		const fullNameKey = locationNameKey(rawLocation);

		const existingLocation = findExistingEntity(
			rawLocation,
			indexes,
			locationNameKey,
		);
		const existingIsScoped = existingLocation
			? isEntityInScope(existingLocation, scope, locationNameKey)
			: false;

		if (existingLocation && appendOnly) {
			continue;
		}

		if (existingLocation && !existingIsScoped) {
			continue;
		}

		if (isDeleteMarker(rawLocation)) {
			if (existingLocation && existingIsScoped) {
				await storage.deleteEntity(
					campaignSlug,
					"locations",
					existingLocation.slug,
				);
				deletedSlugs.add(existingLocation.slug);
			}
			continue;
		}

		const normalized = normalizeLocation(rawLocation, existingLocation, {
			simplifiedNotes,
		});
		if (!normalized.name) continue;

		if (existingLocation) {
			const oldDisplayName = getLocationDisplayName(existingLocation);
			const payload = {
				...existingLocation,
				...normalized,
				slug: existingLocation.slug,
				id: existingLocation.id,
				imageUrl: existingLocation.imageUrl ?? normalized.imageUrl ?? null,
			};
			await storage.writeEntity(
				campaignSlug,
				"locations",
				existingLocation.slug,
				payload,
			);
			const newDisplayName = getLocationDisplayName(payload);
			await storage.updateCampaignMentionReferences(
				campaignSlug,
				oldDisplayName,
				newDisplayName,
			);
			indexes.bySlug.set(existingLocation.slug, payload);
			if (payload.id) indexes.byId.set(payload.id, payload);
			if (fullNameKey) indexes.byName.set(fullNameKey, payload);
			returnedScopedSlugs.add(existingLocation.slug);
			continue;
		}

		const uniqueSlug = await storage.ensureUniqueEntitySlug(
			campaignSlug,
			"locations",
			storage.campaignSlug(normalized.name || "locations"),
		);
		const payload = {
			...normalized,
			slug: uniqueSlug,
		};
		await storage.writeEntity(campaignSlug, "locations", uniqueSlug, payload);
		indexes.bySlug.set(uniqueSlug, payload);
		if (payload.id) indexes.byId.set(payload.id, payload);
		if (fullNameKey) indexes.byName.set(fullNameKey, payload);
	}

	if (scope && allowFinalStateDelete) {
		for (const location of existing) {
			if (deletedSlugs.has(location.slug)) continue;
			if (!isEntityInScope(location, scope, locationNameKey)) continue;
			if (returnedScopedSlugs.has(location.slug)) continue;
			await storage.deleteEntity(campaignSlug, "locations", location.slug);
		}
	}
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

function normalizeScene(
	scene,
	existing,
	encounterMap,
	{ simplifiedNotes = false } = {},
) {
	let encounterId = existing?.encounterId || "";
	if (
		scene.encounterIndex !== undefined &&
		encounterMap.has(scene.encounterIndex)
	) {
		encounterId = encounterMap.get(scene.encounterIndex);
	} else if (hasOwn(scene, "encounterId")) {
		encounterId = asText(scene.encounterId);
	}

	const hasNotes = Array.isArray(scene.notes);
	const notesFromAi = hasNotes
		? normalizeNotesPreservingExisting(scene.notes || [], existing?.notes || [], {
				simplifiedNotes,
			})
		: existing?.notes || [];
	const hasNpcs = Array.isArray(scene.npcs);

	return {
		id: existing?.id || scene.id || storage.createId(),
		texts: normalizeSceneTexts(scene, existing?.texts || {}),
		notes: hasNotes
			? notesFromAi.length > 0
				? notesFromAi
				: []
			: notesFromAi,
		isNotesCollapsed: Boolean(existing?.isNotesCollapsed),
		npcs: hasNpcs ? normalizeSceneNpcs(scene.npcs) : existing?.npcs || [],
		collapsed: Boolean(existing?.collapsed),
		encounterId,
		// Keep existing scene image reference unchanged unless scene is new.
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

function escapeRegExp(value) {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCharacterDisplayName(entity = {}) {
	const firstName = asText(entity.firstName || entity.first_name);
	const lastName = asText(entity.lastName || entity.last_name);
	const combined = `${firstName} ${lastName}`.trim();
	if (combined) return combined;
	return asText(entity.name || entity.title);
}

function getCharacterContextKey(entity = {}) {
	return asText(entity.slug || entity.id || getCharacterDisplayName(entity));
}

function getLocationDisplayName(entity = {}) {
	return asText(entity.name || entity.title);
}

function getLocationContextKey(entity = {}) {
	return asText(entity.slug || entity.id || getLocationDisplayName(entity));
}

function isContextListIncluded(contextConfig) {
	if (!contextConfig) return false;
	if (contextConfig === true) return true;
	if (typeof contextConfig !== "object") return Boolean(contextConfig);
	return contextConfig.included !== false;
}

function filterEntitiesByContext(entities = [], entityConfig, getKey) {
	if (!entityConfig) return [];
	if (entityConfig === true) return entities;
	if (entityConfig.included === false) return [];

	const items = entityConfig.items || {};
	const selectedKeys = Object.entries(items)
		.filter(([, included]) => included !== false)
		.map(([key]) => key);

	if (Object.keys(items).length === 0) return entities;

	const selected = new Set(selectedKeys);
	return entities.filter((entity) => selected.has(getKey(entity)));
}

function filterLocationsByContext(locations = [], locationConfig) {
	return filterEntitiesByContext(
		locations,
		locationConfig,
		getLocationContextKey,
	);
}

function normalizeMentionCandidates(names = []) {
	return Array.from(
		new Set(
			names.map((name) => asText(name)).filter((name) => name.length >= 2),
		),
	).sort((a, b) => b.length - a.length);
}

function wrapMentionsInText(text, names) {
	if (!text || !names.length) return text;
	let output = String(text);

	for (const name of names) {
		const pattern = new RegExp(
			`(?<![\\p{L}\\p{N}_\\[])${escapeRegExp(name)}(?![\\p{L}\\p{N}_\\]])`,
			"giu",
		);
		output = output.replace(pattern, (match, offset, source) => {
			const before = source[offset - 1];
			const after = source[offset + match.length];
			if (before === "[" && after === "]") return match;
			return `[${match}]`;
		});
	}

	return output;
}

function collapseNestedMentionBrackets(text) {
	if (typeof text !== "string" || !text) return text;
	let output = text;

	// Collapse repeated opening/closing mention brackets: [[Name]] -> [Name]
	for (let i = 0; i < 5; i += 1) {
		const next = output.replace(/\[\s*\[+/g, "[").replace(/\]+\s*\]/g, "]");
		if (next === output) break;
		output = next;
	}

	return output;
}

function normalizeNameForMatch(value) {
	return String(value || "")
		.toLowerCase()
		.replace(/[`'’]/g, "")
		.replace(/[^\p{L}\p{N}\s-]+/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function resolveCanonicalName(rawName, canonicalNames) {
	const raw = asText(rawName);
	if (!raw || !canonicalNames.length) return null;

	const exact = canonicalNames.find(
		(name) => normalizeNameForMatch(name) === normalizeNameForMatch(raw),
	);
	if (exact) return exact;

	return null;
}

function canonicalizeBracketedMentions(text, names) {
	if (!text || !names.length) return text;
	return String(text).replace(/\[([^[\]]+)\]/g, (_full, rawName) => {
		const canonical = resolveCanonicalName(rawName, names);
		return canonical ? `[${canonical}]` : rawName;
	});
}

function processGeneratedTextMentions(text, names) {
	if (typeof text !== "string") return text;
	const wrapped = wrapMentionsInText(text, names);
	const canonicalized = canonicalizeBracketedMentions(wrapped, names);
	return collapseNestedMentionBrackets(canonicalized);
}

function sceneTextSignature(texts = {}) {
	return {
		summary: asText(texts.summary),
		goal: asText(texts.goal),
		stakes: asText(texts.stakes),
		location: asText(texts.location),
	};
}

function sceneNotesSignature(notes = []) {
	return (Array.isArray(notes) ? notes : [])
		.map((note) => ({
			title: asText(note?.title),
			text: asText(note?.text),
		}))
		.filter((note) => note.title || note.text);
}

function sceneNpcsSignature(npcs = []) {
	return (Array.isArray(npcs) ? npcs : [])
		.map((npc) => ({
			name: asText(npc?.name),
			description: asText(npc?.description),
		}))
		.filter((npc) => npc.name || npc.description);
}

function sceneSignature(scene) {
	const payload = {
		texts: sceneTextSignature(scene?.texts),
		notes: sceneNotesSignature(scene?.notes),
		npcs: sceneNpcsSignature(scene?.npcs),
		encounterId: asText(scene?.encounterId),
	};
	return JSON.stringify(payload);
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

function appendNormalizedNotes(existingNotes = [], generatedNotes = []) {
	const signatures = new Set((existingNotes || []).map(noteSignature));
	const appended = [];
	for (const note of generatedNotes) {
		const signature = noteSignature(note);
		if (signatures.has(signature)) continue;
		signatures.add(signature);
		appended.push(note);
	}
	return [...(existingNotes || []), ...appended];
}

function processGeneratedNoteMentions(note, names) {
	if (typeof note === "string") {
		return processGeneratedTextMentions(note, names);
	}
	if (!note || typeof note !== "object") return note;
	const next = { ...note };
	for (const key of ["title", "text", "description", "content"]) {
		if (typeof next[key] === "string") {
			next[key] = processGeneratedTextMentions(next[key], names);
		}
	}
	return next;
}

function buildAiApplyScope(contextData = {}, path = {}) {
	const sessions = Array.isArray(contextData.sessions)
		? contextData.sessions
		: [];
	const currentSessionContext = sessions.find(
		(sessionContext) =>
			asText(sessionContext?.slug || sessionContext?.fileName) ===
			asText(path.session),
	);
	const currentSessionConf = currentSessionContext?.conf || {};
	const currentSessionData = currentSessionContext?.data || {};
	const sceneIds = new Set();
	let hasSceneContext = false;

	if (
		currentSessionConf.included &&
		Array.isArray(currentSessionData.scenes)
	) {
		const sceneConfig = currentSessionConf.scenes || {};
		const hasSceneConfig =
			sceneConfig &&
			typeof sceneConfig === "object" &&
			Object.keys(sceneConfig).length > 0;
		for (const scene of currentSessionData.scenes) {
			if (hasSceneConfig && !sceneConfig[scene.id]?.included) continue;
			sceneIds.add(asText(scene.id));
		}
		hasSceneContext = sceneIds.size > 0;
	}

	return {
		campaignNotes: Array.isArray(contextData.campaign?.notes),
		characters: Array.isArray(contextData.campaign?.characters)
			? contextData.campaign.characters
			: null,
		npcs: Array.isArray(contextData.campaign?.npcs)
			? contextData.campaign.npcs
			: null,
		locations: Array.isArray(contextData.campaign?.locations)
			? contextData.campaign.locations
			: null,
		sessionNotes: Boolean(currentSessionConf.included && currentSessionConf.notes),
		sceneIds: hasSceneContext ? sceneIds : null,
	};
}

function applyGeneratedScenes(
	existingScenes,
	generatedScenes,
	sceneIdsInContext,
	encounterMap,
	{ allowFinalStateDelete = false, simplifiedNotes = false } = {},
) {
	const existing = Array.isArray(existingScenes) ? existingScenes : [];
	const existingById = new Map(
		existing
			.map((scene) => [asText(scene.id), scene])
			.filter(([id]) => Boolean(id)),
	);
	const existingSignatures = new Set(existing.map(sceneSignature));
	const scopedIds = sceneIdsInContext instanceof Set ? sceneIdsInContext : null;
	const appendOnly = !scopedIds;
	const returnedScopedIds = new Set();
	const deletedScopedIds = new Set();
	const appendedScenes = [];
	const updatesById = new Map();

	for (const scene of generatedScenes) {
		if (!scene || typeof scene !== "object") continue;
		const sceneId = asText(scene.id);
		const existingScene = sceneId ? existingById.get(sceneId) : null;
		const isScoped = Boolean(existingScene && scopedIds?.has(sceneId));

		if (existingScene && appendOnly) continue;
		if (existingScene && !isScoped) continue;

		if (isDeleteMarker(scene)) {
			if (existingScene && isScoped) deletedScopedIds.add(sceneId);
			continue;
		}

		if (existingScene) {
			const normalized = normalizeScene(scene, existingScene, encounterMap, {
				simplifiedNotes,
			});
			updatesById.set(sceneId, normalized);
			returnedScopedIds.add(sceneId);
			continue;
		}

		const normalized = normalizeScene(scene, null, encounterMap, {
			simplifiedNotes,
		});
		const signature = sceneSignature(normalized);
		if (existingSignatures.has(signature)) continue;
		existingSignatures.add(signature);
		appendedScenes.push(normalized);
	}

	const nextScenes = [];
	for (const scene of existing) {
		const sceneId = asText(scene.id);
		const isScoped = Boolean(scopedIds?.has(sceneId));
		if (deletedScopedIds.has(sceneId)) continue;
		if (
			allowFinalStateDelete &&
			isScoped &&
			!returnedScopedIds.has(sceneId) &&
			!updatesById.has(sceneId)
		) {
			continue;
		}
		nextScenes.push(updatesById.get(sceneId) || scene);
	}
	return [...nextScenes, ...appendedScenes];
}

function applyMentionsToGeneratedContent(generatedContent, names) {
	if (
		!generatedContent ||
		typeof generatedContent !== "object" ||
		!names.length
	) {
		return generatedContent;
	}

	if (typeof generatedContent.description === "string") {
		generatedContent.description = processGeneratedTextMentions(
			generatedContent.description,
			names,
		);
	}

	if (Array.isArray(generatedContent.notes)) {
		generatedContent.notes = generatedContent.notes.map((note) =>
			processGeneratedNoteMentions(note, names),
		);
	}

	if (Array.isArray(generatedContent.characters)) {
		generatedContent.characters = generatedContent.characters.map(
			(character) => {
				if (!character || typeof character !== "object") return character;
				const next = { ...character };
				for (const key of ["description", "motivation", "trait"]) {
					if (typeof next[key] === "string") {
						next[key] = processGeneratedTextMentions(next[key], names);
					}
				}
				if (Array.isArray(next.notes)) {
					next.notes = next.notes.map((note) =>
						processGeneratedNoteMentions(note, names),
					);
				}
				return next;
			},
		);
	}

	if (Array.isArray(generatedContent.npcs)) {
		generatedContent.npcs = generatedContent.npcs.map((npc) => {
			if (!npc || typeof npc !== "object") return npc;
			const next = { ...npc };
			for (const key of ["description", "motivation", "trait"]) {
				if (typeof next[key] === "string") {
					next[key] = processGeneratedTextMentions(next[key], names);
				}
			}
			if (Array.isArray(next.notes)) {
				next.notes = next.notes.map((note) =>
					processGeneratedNoteMentions(note, names),
				);
			}
			return next;
		});
	}

	if (Array.isArray(generatedContent.locations)) {
		generatedContent.locations = generatedContent.locations.map((location) => {
			if (!location || typeof location !== "object") return location;
			const next = { ...location };
			if (typeof next.description === "string") {
				next.description = processGeneratedTextMentions(
					next.description,
					names,
				);
			}
			if (Array.isArray(next.notes)) {
				next.notes = next.notes.map((note) =>
					processGeneratedNoteMentions(note, names),
				);
			}
			return next;
		});
	}

	if (Array.isArray(generatedContent.scenes)) {
		generatedContent.scenes = generatedContent.scenes.map((scene) => {
			if (!scene || typeof scene !== "object") return scene;
			const nextScene = { ...scene };

			if (nextScene.texts && typeof nextScene.texts === "object") {
				nextScene.texts = { ...nextScene.texts };
				for (const key of ["summary", "goal", "stakes", "location"]) {
					if (typeof nextScene.texts[key] === "string") {
						nextScene.texts[key] = processGeneratedTextMentions(
							nextScene.texts[key],
							names,
						);
					}
				}
			}

			if (Array.isArray(nextScene.notes)) {
				nextScene.notes = nextScene.notes.map((note) =>
					processGeneratedNoteMentions(note, names),
				);
			}

			if (Array.isArray(nextScene.npcs)) {
				nextScene.npcs = nextScene.npcs.map((npc) => {
					if (!npc || typeof npc !== "object") return npc;
					const nextNpc = { ...npc };
					if (typeof nextNpc.description === "string") {
						nextNpc.description = processGeneratedTextMentions(
							nextNpc.description,
							names,
						);
					}
					return nextNpc;
				});
			}

			return nextScene;
		});
	}

	return generatedContent;
}

function enforceEntityGenerationScope(generatedContent, type) {
	if (
		!generatedContent ||
		typeof generatedContent !== "object" ||
		!["character", "npc", "location"].includes(type)
	) {
		return generatedContent;
	}

	if (type === "character") {
		delete generatedContent.npcs;
		delete generatedContent.locations;
	} else if (type === "npc") {
		delete generatedContent.characters;
		delete generatedContent.locations;
	} else {
		delete generatedContent.characters;
		delete generatedContent.npcs;
	}

	delete generatedContent.description;
	delete generatedContent.notes;
	delete generatedContent.scenes;
	delete generatedContent.encounters;
	return generatedContent;
}

function stripSceneEntityFields(scene, { allowNpcs, allowEncounters }) {
	if (!scene || typeof scene !== "object") return scene;
	const next = { ...scene };
	if (!allowNpcs) {
		delete next.npcs;
	}
	if (!allowEncounters) {
		delete next.encounterId;
		delete next.encounterIndex;
		delete next.monsters;
	}
	return next;
}

function enforceAiGenerationPermissions(
	generatedContent,
	{ allowCharacters, allowNpcs, allowLocations, allowEncounters },
) {
	if (!generatedContent || typeof generatedContent !== "object") {
		return generatedContent;
	}

	if (!allowCharacters) {
		delete generatedContent.characters;
	}
	if (!allowNpcs) {
		delete generatedContent.npcs;
	}
	if (!allowLocations) {
		delete generatedContent.locations;
	}
	if (!allowEncounters) {
		delete generatedContent.encounters;
	}
	if (Array.isArray(generatedContent.scenes)) {
		generatedContent.scenes = generatedContent.scenes.map((scene) =>
			stripSceneEntityFields(scene, { allowNpcs, allowEncounters }),
		);
	}
	return generatedContent;
}

function getAiRequestMode(type, path = {}) {
	if (type) return type;
	if (path.encounter) return "encounter";
	if (path.session) return "session";
	return "campaign";
}

function buildAiOptionsSummary(options) {
	const parts = [
		`mode: ${options.mode}`,
		`parse: ${options.responseParsing ? "on" : "off"}`,
		`characters: ${options.characterGeneration ? "on" : "off"}`,
		`npcs: ${options.npcGeneration ? "on" : "off"}`,
		`locations: ${options.locationGeneration ? "on" : "off"}`,
		`encounters: ${options.encounterGeneration ? "on" : "off"}`,
		`context: ${options.contextEnabled ? "on" : "off"}`,
	];
	if (options.modelName) parts.push(`model: ${options.modelName}`);
	if (options.sceneId) parts.push(`scene: ${options.sceneId}`);
	return parts.join("; ");
}

function buildAiContextSummary(contextConfig, contextData = {}) {
	if (!contextConfig) {
		return {
			enabled: false,
			campaignNotes: 0,
			campaignCharacters: 0,
			campaignNpcs: 0,
			campaignLocations: 0,
			sessions: 0,
			scenes: 0,
			summary: "context: off",
		};
	}

	const sessions = Array.isArray(contextData.sessions)
		? contextData.sessions
		: [];
	const scenes = sessions.reduce(
		(total, session) =>
			total + (Array.isArray(session?.data?.scenes) ? session.data.scenes.length : 0),
		0,
	);
	const campaignNotes = Array.isArray(contextData.campaign?.notes)
		? contextData.campaign.notes.length
		: 0;
	const campaignCharacters = Array.isArray(contextData.campaign?.characters)
		? contextData.campaign.characters.length
		: 0;
	const campaignNpcs = Array.isArray(contextData.campaign?.npcs)
		? contextData.campaign.npcs.length
		: 0;
	const campaignLocations = Array.isArray(contextData.campaign?.locations)
		? contextData.campaign.locations.length
		: 0;

	const parts = [];
	if (contextConfig.campaignNotes) parts.push(`notes: ${campaignNotes}`);
	if (isContextListIncluded(contextConfig.campaignCharacters))
		parts.push(`characters: ${campaignCharacters}`);
	if (
		isContextListIncluded(contextConfig.campaignNpcs) ||
		(contextConfig.campaignNpcs === undefined &&
			isContextListIncluded(contextConfig.campaignCharacters))
	) {
		parts.push(`npcs: ${campaignNpcs}`);
	}
	if (isContextListIncluded(contextConfig.campaignLocations))
		parts.push(`locations: ${campaignLocations}`);
	if (sessions.length) parts.push(`sessions: ${sessions.length}`);
	if (scenes) parts.push(`scenes: ${scenes}`);

	return {
		enabled: true,
		campaignNotes,
		campaignCharacters,
		campaignNpcs,
		campaignLocations,
		sessions: sessions.length,
		scenes,
		summary: parts.length ? `context: ${parts.join(", ")}` : "context: empty",
	};
}

function buildAiRequestSnapshot({
	type,
	modelName,
	userInstructions,
	path,
	sceneId,
	parseAIResponse,
	shouldParseAIResponse,
	generateEncounters,
	generateCharacters,
	generateNpcs,
	generateLocations,
	contextConfig,
	contextData,
	language,
}) {
	const options = {
		mode: getAiRequestMode(type, path),
		modelName: modelName || null,
		language,
		responseParsing: Boolean(shouldParseAIResponse),
		requestedResponseParsing: Boolean(parseAIResponse),
		characterGeneration: Boolean(generateCharacters),
		npcGeneration: Boolean(generateNpcs),
		locationGeneration: Boolean(generateLocations),
		encounterGeneration: Boolean(generateEncounters),
		contextEnabled: Boolean(contextConfig),
		sceneId: sceneId || null,
	};
	const context = buildAiContextSummary(contextConfig, contextData);

	return {
		userInstructions: asText(userInstructions),
		options,
		optionsSummary: buildAiOptionsSummary(options),
		context,
		contextSummary: context.summary,
	};
}

function collectMentionCandidates(generatedContent, contextData = {}) {
	const names = [];
	const campaignContext = contextData?.campaign || {};

	if (Array.isArray(campaignContext.characters)) {
		names.push(...campaignContext.characters.map(getCharacterDisplayName));
	}
	if (Array.isArray(campaignContext.npcs)) {
		names.push(...campaignContext.npcs.map(getCharacterDisplayName));
	}
	if (Array.isArray(campaignContext.locations)) {
		names.push(...campaignContext.locations.map(getLocationDisplayName));
	}

	for (const sessionContext of contextData?.sessions || []) {
		const conf = sessionContext?.conf || {};
		const data = sessionContext?.data || {};
		if (!conf.included || !Array.isArray(data.scenes)) continue;

		const hasSceneConfig =
			conf.scenes &&
			typeof conf.scenes === "object" &&
			Object.keys(conf.scenes).length > 0;

		for (const scene of data.scenes) {
			if (hasSceneConfig && !conf.scenes[scene.id]?.included) continue;
			for (const npc of scene?.npcs || []) {
				names.push(asText(npc?.name));
			}
		}
	}

	if (Array.isArray(generatedContent?.characters)) {
		for (const character of generatedContent.characters) {
			if (isDeleteMarker(character)) continue;
			names.push(getCharacterDisplayName(character));
		}
	}

	if (Array.isArray(generatedContent?.npcs)) {
		for (const npc of generatedContent.npcs) {
			if (isDeleteMarker(npc)) continue;
			names.push(getCharacterDisplayName(npc));
		}
	}

	if (Array.isArray(generatedContent?.locations)) {
		for (const location of generatedContent.locations) {
			if (isDeleteMarker(location)) continue;
			names.push(getLocationDisplayName(location));
		}
	}

	if (Array.isArray(generatedContent?.scenes)) {
		for (const scene of generatedContent.scenes) {
			if (isDeleteMarker(scene)) continue;
			for (const npc of scene?.npcs || []) {
				names.push(asText(npc?.name));
			}
		}
	}

	return normalizeMentionCandidates(names);
}

router.get("/models", async (_req, res, next) => {
	try {
		const result = await aiService.listAvailableModels();
		res.json(result);
	} catch (error) {
		next(error);
	}
});

router.get("/responses", async (_req, res, next) => {
	try {
		res.json(await storage.readAiResponses());
	} catch (error) {
		next(error);
	}
});

router.delete("/responses/:id", async (req, res, next) => {
	try {
		res.json(await storage.deleteAiResponse(req.params.id));
	} catch (error) {
		next(error);
	}
});

router.delete("/responses", async (_req, res, next) => {
	try {
		res.json(await storage.clearAiResponses());
	} catch (error) {
		next(error);
	}
});

router.post("/generate", async (req, res, next) => {
	try {
		const {
			type,
			modelName,
			userInstructions,
			path,
			sceneId,
			parseAIResponse,
			generateCharacters,
			generateNpcs,
			generateLocations,
			generateEncounters,
			contextConfig,
			language,
		} = req.body;
		const responseLanguage = String(language || "")
			.trim()
			.toLowerCase();
		if (!responseLanguage) {
			return res.status(400).json({ error: "language is required." });
		}
		if (!process.env.GEMINI_API_KEY) {
			return res.status(500).json({ error: "GEMINI_API_KEY не налаштовано." });
		}
		const encounterGenerationEnabled = Boolean(generateEncounters);
		const characterGenerationEnabled = generateCharacters !== false;
		const npcGenerationEnabled = generateNpcs !== false;
		const locationGenerationEnabled = generateLocations !== false;
		const shouldParseAIResponse =
			Boolean(parseAIResponse || encounterGenerationEnabled) &&
			(!path.encounter || encounterGenerationEnabled);
		const settings = await storage.readSettings();
		const simplifiedNotesEnabled = Boolean(settings.simplifiedNotes);

		const campaign = await storage.readCampaign(path.campaign);
		const session = await storage
			.readSession(path.campaign, path.session)
			.catch(() => null);

		const contextData = { campaign: {}, sessions: [] };
		if (contextConfig) {
			if (contextConfig.campaignNotes)
				contextData.campaign.notes = campaign.notes;
			if (isContextListIncluded(contextConfig.campaignCharacters)) {
				const chars = await storage.listEntities(path.campaign, "characters");
				contextData.campaign.characters = filterEntitiesByContext(
					chars,
					contextConfig.campaignCharacters,
					getCharacterContextKey,
				);
			}
			if (
				isContextListIncluded(contextConfig.campaignNpcs) ||
				(contextConfig.campaignNpcs === undefined &&
					isContextListIncluded(contextConfig.campaignCharacters))
			) {
				const npcs = await storage.listEntities(path.campaign, "npc");
				contextData.campaign.npcs = filterEntitiesByContext(
					npcs,
					contextConfig.campaignNpcs === undefined
						? true
						: contextConfig.campaignNpcs,
					getCharacterContextKey,
				);
			}
			if (isContextListIncluded(contextConfig.campaignLocations)) {
				const locations = await storage.listEntities(path.campaign, "locations");
				contextData.campaign.locations = filterLocationsByContext(
					locations,
					contextConfig.campaignLocations,
				);
			}

			if (contextConfig.sessions) {
				for (const [slug, conf] of Object.entries(contextConfig.sessions)) {
					if (!conf.included) continue;
					const sData = await storage.readSession(path.campaign, slug);
					contextData.sessions.push({
						slug,
						fileName: slug,
						name: sData.name,
						conf,
						data: sData.data,
					});
				}
			}
		}

		const aiApplyScope = buildAiApplyScope(contextData, path);
		const allowFinalStateDelete =
			shouldAllowFinalStateDelete(userInstructions);

		const generatedContent = await aiService.generateContent({
			type,
			session,
			campaign,
			userInstructions,
			modelName,
			encounterId: path.encounter,
			sceneId,
			parseAIResponse: shouldParseAIResponse,
			contextData,
			generateCharacters: characterGenerationEnabled,
			generateNpcs: npcGenerationEnabled,
			generateLocations: locationGenerationEnabled,
			generateEncounters: encounterGenerationEnabled,
			language: responseLanguage,
			simplifiedNotes: simplifiedNotesEnabled,
		});

		enforceEntityGenerationScope(generatedContent, type);
		enforceAiGenerationPermissions(generatedContent, {
			allowCharacters: characterGenerationEnabled,
			allowNpcs: npcGenerationEnabled,
			allowLocations: locationGenerationEnabled,
			allowEncounters: encounterGenerationEnabled,
		});

		if (
			shouldParseAIResponse &&
			generatedContent &&
			typeof generatedContent === "object"
		) {
			const mentionNames = collectMentionCandidates(
				generatedContent,
				contextData,
			);
			applyMentionsToGeneratedContent(generatedContent, mentionNames);
		}

		if (
			shouldParseAIResponse &&
			session &&
			!path.encounter &&
			!encounterGenerationEnabled &&
			generatedContent &&
			typeof generatedContent === "object"
		) {
			if (Array.isArray(generatedContent.encounters)) {
				delete generatedContent.encounters;
			}
			if (Array.isArray(generatedContent.scenes)) {
				generatedContent.scenes = generatedContent.scenes.map((scene) => {
					if (!scene || typeof scene !== "object") return scene;
					const { encounterId, encounterIndex, monsters, ...safeScene } = scene;
					return safeScene;
				});
			}
		}

		if (generatedContent.error) return res.status(500).json(generatedContent);
		if (!shouldParseAIResponse) {
			const requestSnapshot = buildAiRequestSnapshot({
				type,
				modelName,
				userInstructions,
				path,
				sceneId,
				parseAIResponse,
				shouldParseAIResponse,
				generateCharacters: characterGenerationEnabled,
				generateNpcs: npcGenerationEnabled,
				generateLocations: locationGenerationEnabled,
				generateEncounters: encounterGenerationEnabled,
				contextConfig,
				contextData,
				language: responseLanguage,
			});
			const aiResponse = await storage.addAiResponse({
				text: generatedContent,
				path,
				type,
				modelName,
				language: responseLanguage,
				userInstructions,
				request: requestSnapshot,
			});
			return res.json({ prompt: generatedContent, aiResponse });
		}

		let updatedObject = null;
		if (campaign) {
			if (session) {
				const fullPath = storage.sessionPath(path.campaign, path.session);
				const sessionData = await storage.readJson(fullPath);
				sessionData.data = sessionData.data || {};

				if (path.encounter) {
					sessionData.data.encounters = sessionData.data.encounters || [];
					const encIdx = sessionData.data.encounters.findIndex(
						(e) => String(e.id) === String(path.encounter),
					);

					if (encIdx !== -1) {
						let aiEncounter = null;
						if (Array.isArray(generatedContent?.monsters)) {
							aiEncounter = generatedContent;
						} else if (
							Array.isArray(generatedContent?.encounters) &&
							generatedContent.encounters[0]
						) {
							aiEncounter = generatedContent.encounters[0];
						}

						if (aiEncounter) {
							const bestiaryIndex = await storage.getBestiaryIndex();
							const normalized = normalizeEncounterFromAi(
								aiEncounter,
								bestiaryIndex,
								sessionData.data.encounters[encIdx].name || "Бій",
							);
							sessionData.data.encounters[encIdx].name = normalized.name;
							sessionData.data.encounters[encIdx].monsters =
								normalized.monsters;
							sessionData.updatedAt = new Date().toISOString();
							await storage.writeJson(fullPath, sessionData);
							return res.json({
								generated: generatedContent,
								updated: { ...sessionData, fileName: path.session },
							});
						}
					}
				}

				await upsertGeneratedEntities(
					path.campaign,
					"characters",
					generatedContent.characters,
					{
						contextEntities: aiApplyScope.characters,
						allowFinalStateDelete,
						simplifiedNotes: simplifiedNotesEnabled,
					},
				);
				await upsertGeneratedEntities(
					path.campaign,
					"npc",
					generatedContent.npcs,
					{
						contextEntities: aiApplyScope.npcs,
						allowFinalStateDelete,
						simplifiedNotes: simplifiedNotesEnabled,
					},
				);
				await upsertGeneratedLocations(
					path.campaign,
					generatedContent.locations,
					{
						contextLocations: aiApplyScope.locations,
						allowFinalStateDelete,
						simplifiedNotes: simplifiedNotesEnabled,
					},
				);

				const encounterMap = new Map();
				if (Array.isArray(generatedContent.encounters)) {
					sessionData.data.encounters = sessionData.data.encounters || [];
					const bestiaryIndex = await storage.getBestiaryIndex();

					for (const [index, enc] of generatedContent.encounters.entries()) {
						const normalized = normalizeEncounterFromAi(
							enc,
							bestiaryIndex,
							`Бій ${sessionData.data.encounters.length + 1}`,
						);
						const newId = storage.createId();
						sessionData.data.encounters.push({
							id: newId,
							name: normalized.name,
							monsters: normalized.monsters,
						});
						encounterMap.set(index, newId);
					}
				}

				if (Array.isArray(generatedContent.scenes)) {
					const existingScenes = Array.isArray(sessionData.data.scenes)
						? sessionData.data.scenes
						: [];
					sessionData.data.scenes = applyGeneratedScenes(
						existingScenes,
						generatedContent.scenes,
						aiApplyScope.sceneIds,
						encounterMap,
						{
							allowFinalStateDelete,
							simplifiedNotes: simplifiedNotesEnabled,
						},
					);
				}

				if (Array.isArray(generatedContent.notes)) {
					const normalizedNotes = normalizeNotesPreservingExisting(
						generatedContent.notes,
						sessionData.data.notes || [],
						{
							keepAtLeastOne: true,
							simplifiedNotes: simplifiedNotesEnabled,
						},
					);
					sessionData.data.notes = aiApplyScope.sessionNotes
						? normalizedNotes
						: appendNormalizedNotes(sessionData.data.notes || [], normalizedNotes);
				}

				sessionData.updatedAt = new Date().toISOString();
				await storage.writeJson(fullPath, sessionData);
				updatedObject = { ...sessionData, fileName: path.session };
			} else {
				const metaPath = storage.campaignMetaPath(path.campaign);
				const meta = await storage.readJson(metaPath);

				if (type === "character") {
					await upsertGeneratedEntities(
						path.campaign,
						"characters",
						generatedContent.characters,
						{
							contextEntities: aiApplyScope.characters,
							allowFinalStateDelete,
							simplifiedNotes: simplifiedNotesEnabled,
						},
					);
				} else if (type === "npc") {
					await upsertGeneratedEntities(
						path.campaign,
						"npc",
						generatedContent.npcs,
						{
							contextEntities: aiApplyScope.npcs,
							allowFinalStateDelete,
							simplifiedNotes: simplifiedNotesEnabled,
						},
					);
				} else if (type === "location") {
					await upsertGeneratedLocations(
						path.campaign,
						generatedContent.locations,
						{
							contextLocations: aiApplyScope.locations,
							allowFinalStateDelete,
							simplifiedNotes: simplifiedNotesEnabled,
						},
					);
				} else {
					if (contextConfig && asText(generatedContent.description)) {
						meta.description = generatedContent.description;
					}

					if (Array.isArray(generatedContent.notes)) {
						const normalizedNotes = normalizeNotesPreservingExisting(
							generatedContent.notes,
							meta.notes || [],
							{ simplifiedNotes: simplifiedNotesEnabled },
						);
						meta.notes = aiApplyScope.campaignNotes
							? normalizedNotes
							: appendNormalizedNotes(meta.notes || [], normalizedNotes);
					}

					await upsertGeneratedEntities(
						path.campaign,
						"characters",
						generatedContent.characters,
						{
							contextEntities: aiApplyScope.characters,
							allowFinalStateDelete,
							simplifiedNotes: simplifiedNotesEnabled,
						},
					);
					await upsertGeneratedEntities(
						path.campaign,
						"npc",
						generatedContent.npcs,
						{
							contextEntities: aiApplyScope.npcs,
							allowFinalStateDelete,
							simplifiedNotes: simplifiedNotesEnabled,
						},
					);
					await upsertGeneratedLocations(
						path.campaign,
						generatedContent.locations,
						{
							contextLocations: aiApplyScope.locations,
							allowFinalStateDelete,
							simplifiedNotes: simplifiedNotesEnabled,
						},
					);
				}

				meta.updatedAt = new Date().toISOString();
				await storage.writeJson(metaPath, meta);
				updatedObject = meta;
			}
		}

		res.json({ generated: generatedContent, updated: updatedObject });
	} catch (error) {
		next(error);
	}
});

module.exports = router;
