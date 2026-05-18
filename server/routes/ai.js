const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const router = express.Router();
const storage = require("../storage");
const aiService = require("../aiService");

const ENV_PATH = path.join(__dirname, "..", "..", ".env");

function normalizeApiKey(value) {
	return String(value || "").trim();
}

function updateEnvValue(envText, key, value) {
	const line = `${key}=${value}`;
	const eol = envText.includes("\r\n") ? "\r\n" : "\n";
	const matcher = new RegExp(`^${key}=.*$`, "m");

	if (matcher.test(envText)) {
		return envText.replace(matcher, line);
	}

	const suffix = envText && !envText.endsWith("\n") ? eol : "";
	return `${envText}${suffix}${line}${eol}`;
}

function makeId() {
	return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
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

	const notes = normalizeNotesPreservingExisting(notesSource, existing?.notes || [], {
		keepAtLeastOne: true,
		simplifiedNotes,
	});

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
		notes: mergeAiIgnoredNotes(existing?.notes || [], notes),
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

	const notes = normalizeNotesPreservingExisting(notesSource, existing?.notes || [], {
		keepAtLeastOne: true,
		simplifiedNotes,
	});

	return {
		id: existing?.id || raw.id || storage.createId(),
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

function shouldUseCampaignEntityScope(userInstructions) {
	const text = asText(userInstructions).toLowerCase();
	if (!text) return false;
	if (
		[
			"не в кампан",
			"не у кампан",
			"не до кампан",
			"not campaign",
			"session only",
			"only session",
		].some((hint) => text.includes(hint))
	) {
		return false;
	}
	return [
		"в кампан",
		"у кампан",
		"до кампан",
		"для кампан",
		"глобальн",
		"campaign scope",
		"campaign-wide",
		"to campaign",
		"in campaign",
		"global",
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

function applyGeneratedSessionEntities(
	existingEntities,
	type,
	generatedEntities,
	{
		contextEntities = null,
		allowFinalStateDelete = false,
		simplifiedNotes = false,
	} = {},
) {
	if (!Array.isArray(generatedEntities)) {
		return Array.isArray(existingEntities) ? existingEntities : [];
	}

	const existing = Array.isArray(existingEntities) ? existingEntities : [];
	const nameKeyFn = type === "locations" ? locationNameKey : entityNameKey;
	const normalizeFn = type === "locations" ? normalizeLocation : normalizeCharacter;
	const indexes = buildEntityIndexes(existing, nameKeyFn);
	const scope = entityScopeFromContext(contextEntities, nameKeyFn);
	const appendOnly = !scope;
	const returnedScopedIds = new Set();
	const returnedScopedSlugs = new Set();
	const deletedIds = new Set();
	const deletedSlugs = new Set();
	const updatesByIdentity = new Map();
	const existingSignatures = new Set(existing.map(nameKeyFn).filter(Boolean));
	const appended = [];

	for (const rawEntity of generatedEntities) {
		if (!rawEntity || typeof rawEntity !== "object") continue;
		const existingEntity = findExistingEntity(rawEntity, indexes, nameKeyFn);
		const existingIsScoped = existingEntity
			? isEntityInScope(existingEntity, scope, nameKeyFn)
			: false;

		if (existingEntity && appendOnly) continue;
		if (existingEntity && !existingIsScoped) continue;

		if (isDeleteMarker(rawEntity)) {
			if (existingEntity && existingIsScoped) {
				if (existingEntity.id) deletedIds.add(asText(existingEntity.id));
				if (existingEntity.slug) deletedSlugs.add(asText(existingEntity.slug));
			}
			continue;
		}

		const normalized = normalizeFn(rawEntity, existingEntity, {
			simplifiedNotes,
		});
		const normalizedKey = nameKeyFn(normalized);
		if (type === "locations" && !normalized.name) continue;
		if (type !== "locations" && !normalized.firstName && !normalized.lastName) {
			continue;
		}

		if (existingEntity) {
			const payload = {
				...existingEntity,
				...normalized,
				id: existingEntity.id,
				slug: existingEntity.slug,
				imageUrl: existingEntity.imageUrl ?? normalized.imageUrl ?? null,
			};
			const identity = asText(existingEntity.id || existingEntity.slug);
			if (identity) updatesByIdentity.set(identity, payload);
			if (existingEntity.id) returnedScopedIds.add(asText(existingEntity.id));
			if (existingEntity.slug) returnedScopedSlugs.add(asText(existingEntity.slug));
			indexes.byId.set(asText(payload.id), payload);
			if (payload.slug) indexes.bySlug.set(payload.slug, payload);
			if (normalizedKey) indexes.byName.set(normalizedKey, payload);
			continue;
		}

		if (normalizedKey && existingSignatures.has(normalizedKey)) continue;
		if (normalizedKey) existingSignatures.add(normalizedKey);
		const payload = {
			...normalized,
			id: normalized.id || storage.createId(),
			slug: normalized.slug || storage.campaignSlug(normalizedKey || type),
		};
		appended.push(payload);
		indexes.byId.set(asText(payload.id), payload);
		if (payload.slug) indexes.bySlug.set(payload.slug, payload);
		if (normalizedKey) indexes.byName.set(normalizedKey, payload);
	}

	const next = [];
	for (const entity of existing) {
		const id = asText(entity?.id);
		const slug = asText(entity?.slug);
		if ((id && deletedIds.has(id)) || (slug && deletedSlugs.has(slug))) {
			continue;
		}

		const isScoped = isEntityInScope(entity, scope, nameKeyFn);
		const identity = asText(entity?.id || entity?.slug);
		if (
			allowFinalStateDelete &&
			isScoped &&
			!(id && returnedScopedIds.has(id)) &&
			!(slug && returnedScopedSlugs.has(slug)) &&
			!updatesByIdentity.has(identity)
		) {
			continue;
		}
		next.push(updatesByIdentity.get(identity) || entity);
	}

	return [...next, ...appended];
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
		? mergeAiIgnoredNotes(
				existing?.notes || [],
				normalizeNotesPreservingExisting(scene.notes || [], existing?.notes || [], {
					simplifiedNotes,
				}),
			)
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

function isAiIgnored(value = {}) {
	return Boolean(value?._aiIgnored);
}

function filterEntitiesByContext(entities = [], entityConfig, getKey) {
	const visibleEntities = entities.filter((entity) => !isAiIgnored(entity));
	if (!entityConfig) return [];
	if (entityConfig === true) return visibleEntities;
	if (entityConfig.included === false) return [];

	const items = entityConfig.items || {};
	const selectedKeys = Object.entries(items)
		.filter(([, included]) => included !== false)
		.map(([key]) => key);

	if (Object.keys(items).length === 0) return visibleEntities;

	const selected = new Set(selectedKeys);
	return visibleEntities.filter((entity) => selected.has(getKey(entity)));
}

function filterNotesForAiContext(notes = []) {
	return (Array.isArray(notes) ? notes : []).filter((note) => !isAiIgnored(note));
}

function filterSessionDataForAiContext(data = {}) {
	return {
		...data,
		notes: filterNotesForAiContext(data.notes),
		npcs: (Array.isArray(data.npcs) ? data.npcs : []).filter(
			(entity) => !isAiIgnored(entity),
		),
		locations: (Array.isArray(data.locations) ? data.locations : []).filter(
			(entity) => !isAiIgnored(entity),
		),
		scenes: (Array.isArray(data.scenes) ? data.scenes : []).map((scene) => ({
			...scene,
			notes: filterNotesForAiContext(scene.notes),
		})),
	};
}

function filterLocationsByContext(locations = [], locationConfig) {
	return filterEntitiesByContext(
		locations,
		locationConfig,
		getLocationContextKey,
	);
}

function normalizeComparableText(value) {
	return asText(value).replace(/\s+/g, " ").toLowerCase();
}

function noteSignatures(notes = []) {
	return (Array.isArray(notes) ? notes : [])
		.map(noteSignature)
		.filter((signature) => signature !== noteSignature());
}

function notesMatchExactly(leftNotes = [], rightNotes = []) {
	const left = noteSignatures(leftNotes);
	const right = noteSignatures(rightNotes);
	return (
		left.length === right.length &&
		left.every((signature, index) => signature === right[index])
	);
}

function generatedEntityLooksLikeExcludedCopy(entity = {}, excluded = {}, type) {
	if (type === "locations") {
		return (
			normalizeComparableText(entity.description) ===
				normalizeComparableText(excluded.description) &&
			notesMatchExactly(entity.notes, excluded.notes)
		);
	}

	return (
		normalizeComparableText(entity.race) === normalizeComparableText(excluded.race) &&
		normalizeComparableText(entity.class) === normalizeComparableText(excluded.class) &&
		normalizeComparableText(entity.level) === normalizeComparableText(excluded.level) &&
		normalizeComparableText(entity.description) ===
			normalizeComparableText(excluded.description) &&
		normalizeComparableText(entity.motivation) ===
			normalizeComparableText(excluded.motivation) &&
		normalizeComparableText(entity.trait) === normalizeComparableText(excluded.trait) &&
		notesMatchExactly(entity.notes, excluded.notes)
	);
}

function filterGeneratedEntitiesOutsideScope(
	generatedEntities,
	excludedEntities,
	allowedEntities = [],
	nameKeyFn = entityNameKey,
	type = "npc",
) {
	if (!Array.isArray(generatedEntities)) return generatedEntities;
	const excludedList = Array.isArray(excludedEntities) ? excludedEntities : [];
	const allowedList = Array.isArray(allowedEntities) ? allowedEntities : [];
	const excludedIds = new Set(
		excludedList
			.map((entity) => asText(entity?.id))
			.filter(Boolean),
	);
	const excludedSlugs = new Set(
		excludedList
			.map((entity) => asText(entity?.slug))
			.filter(Boolean),
	);
	const allowedIds = new Set(
		allowedList
			.map((entity) => asText(entity?.id))
			.filter(Boolean),
	);
	const allowedSlugs = new Set(
		allowedList
			.map((entity) => asText(entity?.slug))
			.filter(Boolean),
	);
	const allowedNames = new Set(allowedList.map(nameKeyFn).filter(Boolean));
	const excludedByName = new Map(
		excludedList
			.map((entity) => [nameKeyFn(entity), entity])
			.filter(([key]) => Boolean(key)),
	);

	return generatedEntities.filter((entity) => {
		const id = asText(entity?.id);
		const slug = asText(entity?.slug);
		const nameKey = nameKeyFn(entity);
		const isAllowedSessionEntity =
			(id && allowedIds.has(id)) ||
			(slug && allowedSlugs.has(slug)) ||
			(nameKey && allowedNames.has(nameKey));
		if (isAllowedSessionEntity) return true;
		if ((id && excludedIds.has(id)) || (slug && excludedSlugs.has(slug))) {
			return false;
		}
		const excludedBySameName = nameKey ? excludedByName.get(nameKey) : null;
		return !(
			excludedBySameName &&
			generatedEntityLooksLikeExcludedCopy(entity, excludedBySameName, type)
		);
	});
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
	const currentSessionData =
		currentSessionContext?.data || contextData.currentSession?.data || {};
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
		sessionNpcs: Array.isArray(currentSessionData.npcs)
			? currentSessionData.npcs
			: null,
		sessionLocations: Array.isArray(currentSessionData.locations)
			? currentSessionData.locations
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
		`entity-scope: ${options.entityScope || "campaign"}`,
		`encounters: ${options.encounterGeneration ? "on" : "off"}`,
		`context: ${options.contextEnabled ? "on" : "off"}`,
	];
	if (options.modelName) parts.push(`model: ${options.modelName}`);
	if (options.sceneId) parts.push(`scene: ${options.sceneId}`);
	if (options.imageTarget) {
		parts.push(
			`image-target: ${[options.imageTarget.type, options.imageTarget.name]
				.filter(Boolean)
				.join(": ")}`,
		);
	}
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
	imageTarget,
	parseAIResponse,
	shouldParseAIResponse,
	generateEncounters,
	generateCharacters,
	generateNpcs,
	generateLocations,
	entityScope,
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
		entityScope: entityScope || "campaign",
		encounterGeneration: Boolean(generateEncounters),
		contextEnabled: Boolean(contextConfig),
		sceneId: sceneId || null,
		imageTarget:
			imageTarget && typeof imageTarget === "object"
				? {
						type: asText(imageTarget.type),
						name: asText(imageTarget.name),
					}
				: null,
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

function cloneSnapshotValue(value) {
	if (value === undefined) return null;
	return JSON.parse(JSON.stringify(value));
}

function snapshotValueChanged(before, after) {
	return JSON.stringify(before ?? null) !== JSON.stringify(after ?? null);
}

function getEntityResourceLabel(campaignSlug, type, slug) {
	return `${campaignSlug}/${type}/${slug}/info.json`;
}

function buildAiChangeSummary(resources) {
	return resources.reduce(
		(summary, resource) => {
			if (resource.before === null && resource.after !== null) {
				summary.added += 1;
			} else if (resource.before !== null && resource.after === null) {
				summary.deleted += 1;
			} else {
				summary.modified += 1;
			}
			summary.total += 1;
			return summary;
		},
		{ added: 0, deleted: 0, modified: 0, total: 0 },
	);
}

function pushAiChange(resources, resource) {
	if (!snapshotValueChanged(resource.before, resource.after)) return;
	resources.push({
		...resource,
		before: cloneSnapshotValue(resource.before),
		after: cloneSnapshotValue(resource.after),
	});
}

function buildAiChangeSet(beforeBundle, afterBundle, campaignSlug) {
	if (!beforeBundle || !afterBundle) {
		return { resources: [], summary: buildAiChangeSummary([]) };
	}

	const resources = [];
	pushAiChange(resources, {
		id: `campaign:${campaignSlug}`,
		kind: "campaign",
		campaign: campaignSlug,
		label: `${campaignSlug}/_campaign.json`,
		before: beforeBundle.meta ?? null,
		after: afterBundle.meta ?? null,
	});

	const beforeSessions = new Map(
		(beforeBundle.sessions || []).map((session) => [
			session.fileName,
			session.content,
		]),
	);
	const afterSessions = new Map(
		(afterBundle.sessions || []).map((session) => [
			session.fileName,
			session.content,
		]),
	);
	for (const fileName of new Set([
		...beforeSessions.keys(),
		...afterSessions.keys(),
	])) {
		pushAiChange(resources, {
			id: `session:${fileName}`,
			kind: "session",
			campaign: campaignSlug,
			fileName,
			label: `${campaignSlug}/sessions/${fileName}`,
			before: beforeSessions.has(fileName) ? beforeSessions.get(fileName) : null,
			after: afterSessions.has(fileName) ? afterSessions.get(fileName) : null,
		});
	}

	for (const type of storage.ENTITY_TYPES) {
		const beforeEntities = new Map(
			(beforeBundle.entities?.[type] || []).map((entity) => [
				entity.slug,
				entity,
			]),
		);
		const afterEntities = new Map(
			(afterBundle.entities?.[type] || []).map((entity) => [
				entity.slug,
				entity,
			]),
		);
		for (const slug of new Set([
			...beforeEntities.keys(),
			...afterEntities.keys(),
		])) {
			pushAiChange(resources, {
				id: `entity:${type}:${slug}`,
				kind: "entity",
				campaign: campaignSlug,
				type,
				slug,
				label: getEntityResourceLabel(campaignSlug, type, slug),
				before: beforeEntities.has(slug) ? beforeEntities.get(slug) : null,
				after: afterEntities.has(slug) ? afterEntities.get(slug) : null,
			});
		}
	}

	resources.sort((a, b) => a.label.localeCompare(b.label, "uk"));
	return {
		resources,
		summary: buildAiChangeSummary(resources),
	};
}

function formatGeneratedContentForHistory(generatedContent) {
	if (typeof generatedContent === "string") return generatedContent;
	return [
		"Parsed AI response",
		"",
		"```json",
		JSON.stringify(generatedContent ?? null, null, 2),
		"```",
	].join("\n");
}

async function saveParsedAiResponse({
	beforeApplyBundle,
	generatedContent,
	path,
	type,
	modelName,
	language,
	userInstructions,
	requestSnapshot,
}) {
	const afterApplyBundle = await storage.exportCampaignBundle(path.campaign);
	const changes = buildAiChangeSet(
		beforeApplyBundle,
		afterApplyBundle,
		path.campaign,
	);
	const appliedAt = new Date().toISOString();
	return storage.addAiResponse({
		text: formatGeneratedContentForHistory(generatedContent),
		path,
		type,
		modelName,
		language,
		userInstructions,
		request: requestSnapshot,
		changes,
		applyState: "applied",
		appliedAt,
	});
}

async function writeAiResourceSnapshot(resource, snapshotValue) {
	const campaignSlug = resource.campaign;
	if (!campaignSlug) {
		throw new Error("AI response change has no campaign target.");
	}

	if (resource.kind === "campaign") {
		if (snapshotValue === null) {
			throw new Error("Campaign deletion cannot be restored from AI history.");
		}
		await storage.writeJson(storage.campaignMetaPath(campaignSlug), snapshotValue);
		return;
	}

	if (resource.kind === "session") {
		const fileName = path.basename(String(resource.fileName || ""));
		if (!fileName) throw new Error("AI response change has no session target.");
		const fullPath = storage.sessionPath(campaignSlug, fileName);
		if (snapshotValue === null) {
			await fs.rm(fullPath, { force: true });
		} else {
			await storage.writeJson(fullPath, snapshotValue);
		}
		return;
	}

	if (resource.kind === "entity") {
		const type = resource.type;
		const slug = path.basename(String(resource.slug || ""));
		if (!storage.ENTITY_TYPES.includes(type) || !slug) {
			throw new Error("AI response change has invalid entity target.");
		}
		if (snapshotValue === null) {
			await storage.deleteEntity(campaignSlug, type, slug);
		} else {
			await storage.writeJson(
				path.join(storage.campaignDir(campaignSlug), type, slug, "info.json"),
				{ ...snapshotValue, slug },
			);
		}
		return;
	}

	throw new Error("AI response change has unknown target type.");
}

async function readUpdatedObjectForAiResponse(entry) {
	const targetPath = entry?.path || {};
	if (!targetPath.campaign) return null;

	if (targetPath.session) {
		const sessionFile = storage.sessionPath(
			targetPath.campaign,
			targetPath.session,
		);
		if (await storage.exists(sessionFile)) {
			const session = await storage.readJson(sessionFile);
			return { ...session, fileName: targetPath.session };
		}
	}

	const metaPath = storage.campaignMetaPath(targetPath.campaign);
	if (await storage.exists(metaPath)) {
		return storage.readJson(metaPath);
	}
	return null;
}

async function restoreAiResponseSnapshot(entry, snapshotKey) {
	const resources = entry?.changes?.resources || [];
	if (!resources.length) {
		const error = new Error("This AI response has no saved changes.");
		error.status = 400;
		throw error;
	}

	for (const resource of resources) {
		await writeAiResourceSnapshot(resource, resource[snapshotKey] ?? null);
	}

	const campaignSlug = entry?.path?.campaign;
	const response = await storage.updateAiResponse(
		campaignSlug,
		entry.id,
		{
			applyState: snapshotKey === "after" ? "applied" : "undone",
			appliedAt: new Date().toISOString(),
		},
	);
	return {
		response,
		responses: await storage.readAiResponses(campaignSlug),
		updated: await readUpdatedObjectForAiResponse(response || entry),
	};
}

function getAiHistoryCampaignSlug(req) {
	return String(req.query?.campaign || req.body?.campaign || "")
		.trim();
}

function collectMentionCandidates(generatedContent, contextData = {}) {
	const names = [];
	const campaignContext = contextData?.campaign || {};
	const currentSessionData = contextData?.currentSession?.data || {};

	if (Array.isArray(campaignContext.characters)) {
		names.push(...campaignContext.characters.map(getCharacterDisplayName));
	}
	if (Array.isArray(campaignContext.npcs)) {
		names.push(...campaignContext.npcs.map(getCharacterDisplayName));
	}
	if (Array.isArray(campaignContext.locations)) {
		names.push(...campaignContext.locations.map(getLocationDisplayName));
	}
	if (Array.isArray(currentSessionData.npcs)) {
		names.push(...currentSessionData.npcs.map(getCharacterDisplayName));
	}
	if (Array.isArray(currentSessionData.locations)) {
		names.push(...currentSessionData.locations.map(getLocationDisplayName));
	}
	if (Array.isArray(currentSessionData.scenes)) {
		for (const scene of currentSessionData.scenes) {
			for (const npc of scene?.npcs || []) {
				names.push(asText(npc?.name));
			}
		}
	}

	for (const sessionContext of contextData?.sessions || []) {
		const conf = sessionContext?.conf || {};
		const data = sessionContext?.data || {};
		if (!conf.included) continue;

		if (Array.isArray(data.npcs)) {
			names.push(...data.npcs.map(getCharacterDisplayName));
		}
		if (Array.isArray(data.locations)) {
			names.push(...data.locations.map(getLocationDisplayName));
		}
		if (!Array.isArray(data.scenes)) continue;

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

router.get("/responses", async (req, res, next) => {
	try {
		const campaignSlug = getAiHistoryCampaignSlug(req);
		if (!campaignSlug) {
			return res.status(400).json({ error: "campaign is required." });
		}
		res.json(await storage.readAiResponses(campaignSlug));
	} catch (error) {
		next(error);
	}
});

router.delete("/responses/:id", async (req, res, next) => {
	try {
		const campaignSlug = getAiHistoryCampaignSlug(req);
		if (!campaignSlug) {
			return res.status(400).json({ error: "campaign is required." });
		}
		res.json(await storage.deleteAiResponse(campaignSlug, req.params.id));
	} catch (error) {
		next(error);
	}
});

router.delete("/responses", async (req, res, next) => {
	try {
		const campaignSlug = getAiHistoryCampaignSlug(req);
		if (!campaignSlug) {
			return res.status(400).json({ error: "campaign is required." });
		}
		res.json(await storage.clearAiResponses(campaignSlug));
	} catch (error) {
		next(error);
	}
});

router.post("/responses/:id/apply", async (req, res, next) => {
	try {
		const campaignSlug = getAiHistoryCampaignSlug(req);
		if (!campaignSlug) {
			return res.status(400).json({ error: "campaign is required." });
		}
		const entry = await storage.getAiResponse(campaignSlug, req.params.id);
		if (!entry) {
			return res.status(404).json({ error: "AI response not found." });
		}
		res.json(await restoreAiResponseSnapshot(entry, "after"));
	} catch (error) {
		if (error.status) {
			return res.status(error.status).json({ error: error.message });
		}
		next(error);
	}
});

router.post("/responses/:id/undo", async (req, res, next) => {
	try {
		const campaignSlug = getAiHistoryCampaignSlug(req);
		if (!campaignSlug) {
			return res.status(400).json({ error: "campaign is required." });
		}
		const entry = await storage.getAiResponse(campaignSlug, req.params.id);
		if (!entry) {
			return res.status(404).json({ error: "AI response not found." });
		}
		res.json(await restoreAiResponseSnapshot(entry, "before"));
	} catch (error) {
		if (error.status) {
			return res.status(error.status).json({ error: error.message });
		}
		next(error);
	}
});

router.post("/api-key", async (req, res, next) => {
	try {
		const apiKey = normalizeApiKey(req.body?.apiKey);
		if (!apiKey) {
			return res.status(400).json({ error: "GEMINI_API_KEY не може бути порожнім." });
		}
		if (/[\r\n]/.test(apiKey)) {
			return res.status(400).json({ error: "GEMINI_API_KEY має бути одним рядком." });
		}

		let envText = "";
		try {
			envText = await fs.readFile(ENV_PATH, "utf8");
		} catch (error) {
			if (error.code !== "ENOENT") {
				throw error;
			}
		}

		await fs.writeFile(
			ENV_PATH,
			updateEnvValue(envText, "GEMINI_API_KEY", apiKey),
			"utf8",
		);
		process.env.GEMINI_API_KEY = apiKey;
		aiService.clearModelCache();
		res.json({ ok: true });
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
			imageTarget,
			parseAIResponse,
			generateCharacters,
			generateNpcs,
			generateLocations,
			generateEncounters,
			entityScope,
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
		const entityTargetScope =
			path?.session &&
			!path?.encounter &&
			entityScope !== "campaign" &&
			!shouldUseCampaignEntityScope(userInstructions)
				? "session"
				: "campaign";
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
		const includeCampaignScopedEntities = entityTargetScope !== "session";
		if (contextConfig) {
			if (contextConfig.campaignNotes)
				contextData.campaign.notes = filterNotesForAiContext(campaign.notes);
			if (isContextListIncluded(contextConfig.campaignCharacters)) {
				const chars = await storage.listEntities(path.campaign, "characters");
				contextData.campaign.characters = filterEntitiesByContext(
					chars,
					contextConfig.campaignCharacters,
					getCharacterContextKey,
				);
			}
			if (
				includeCampaignScopedEntities &&
				(isContextListIncluded(contextConfig.campaignNpcs) ||
					(contextConfig.campaignNpcs === undefined &&
						isContextListIncluded(contextConfig.campaignCharacters)))
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
			if (
				includeCampaignScopedEntities &&
				isContextListIncluded(contextConfig.campaignLocations)
			) {
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
						data: filterSessionDataForAiContext(sData.data),
					});
				}
			}
		}
		if (entityTargetScope === "session" && session) {
			contextData.currentSession = {
				slug: path.session,
				fileName: path.session,
				name: session.name,
				data: filterSessionDataForAiContext(session.data),
			};
		}

		const campaignScopeEntities =
			entityTargetScope === "session"
				? {
						npcs: await storage.listEntities(path.campaign, "npc"),
						locations: await storage.listEntities(path.campaign, "locations"),
					}
				: { npcs: [], locations: [] };
		const aiApplyScope = buildAiApplyScope(contextData, path);
		if (entityTargetScope === "session") {
			aiApplyScope.sessionNpcs = Array.isArray(session?.data?.npcs)
				? session.data.npcs.filter((entity) => !isAiIgnored(entity))
				: null;
			aiApplyScope.sessionLocations = Array.isArray(session?.data?.locations)
				? session.data.locations.filter((entity) => !isAiIgnored(entity))
				: null;
		}
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
			imageTarget,
			parseAIResponse: shouldParseAIResponse,
			contextData,
			generateCharacters: characterGenerationEnabled,
			generateNpcs: npcGenerationEnabled,
			generateLocations: locationGenerationEnabled,
			generateEncounters: encounterGenerationEnabled,
			entityScope: entityTargetScope,
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
			entityTargetScope === "session" &&
			generatedContent &&
			typeof generatedContent === "object"
		) {
			generatedContent.npcs = filterGeneratedEntitiesOutsideScope(
				generatedContent.npcs,
				campaignScopeEntities.npcs,
				aiApplyScope.sessionNpcs,
				entityNameKey,
				"npc",
			);
			generatedContent.locations = filterGeneratedEntitiesOutsideScope(
				generatedContent.locations,
				campaignScopeEntities.locations,
				aiApplyScope.sessionLocations,
				locationNameKey,
				"locations",
			);
		}

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

		const requestSnapshot = buildAiRequestSnapshot({
			type,
			modelName,
			userInstructions,
			path,
			sceneId,
			imageTarget,
			parseAIResponse,
			shouldParseAIResponse,
			generateCharacters: characterGenerationEnabled,
			generateNpcs: npcGenerationEnabled,
			generateLocations: locationGenerationEnabled,
			generateEncounters: encounterGenerationEnabled,
			entityScope: entityTargetScope,
			contextConfig,
			contextData,
			language: responseLanguage,
		});

		if (!shouldParseAIResponse) {
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

		const beforeApplyBundle = await storage.exportCampaignBundle(path.campaign);
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
							updatedObject = { ...sessionData, fileName: path.session };
							const aiResponse = await saveParsedAiResponse({
								beforeApplyBundle,
								generatedContent,
								path,
								type,
								modelName,
								language: responseLanguage,
								userInstructions,
								requestSnapshot,
							});
							return res.json({
								generated: generatedContent,
								updated: updatedObject,
								aiResponse,
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
				if (entityTargetScope === "campaign") {
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
				} else {
					if (Array.isArray(generatedContent.npcs)) {
						sessionData.data.npcs = applyGeneratedSessionEntities(
							sessionData.data.npcs,
							"npc",
							generatedContent.npcs,
							{
								contextEntities: aiApplyScope.sessionNpcs,
								allowFinalStateDelete,
								simplifiedNotes: simplifiedNotesEnabled,
							},
						);
					}
					if (Array.isArray(generatedContent.locations)) {
						sessionData.data.locations = applyGeneratedSessionEntities(
							sessionData.data.locations,
							"locations",
							generatedContent.locations,
							{
								contextEntities: aiApplyScope.sessionLocations,
								allowFinalStateDelete,
								simplifiedNotes: simplifiedNotesEnabled,
							},
						);
					}
				}

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
						? mergeAiIgnoredNotes(sessionData.data.notes || [], normalizedNotes)
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
							? mergeAiIgnoredNotes(meta.notes || [], normalizedNotes)
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

		const aiResponse = await saveParsedAiResponse({
			beforeApplyBundle,
			generatedContent,
			path,
			type,
			modelName,
			language: responseLanguage,
			userInstructions,
			requestSnapshot,
		});

		res.json({ generated: generatedContent, updated: updatedObject, aiResponse });
	} catch (error) {
		next(error);
	}
});

Object.defineProperty(router, "__test", {
	value: {
		applyGeneratedScenes,
		applyGeneratedSessionEntities,
		asText,
		filterGeneratedEntitiesOutsideScope,
		mergeAiIgnoredNotes,
	},
});

module.exports = router;
