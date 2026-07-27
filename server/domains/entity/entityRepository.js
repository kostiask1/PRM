const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const {
	ensureDir,
	exists,
	readJson,
	writeJson,
} = require("../../infrastructure/jsonFileStore");
const {
	campaignDir,
	campaignMetaPath,
	campaignSlug,
	sanitizeName,
	sessionPath,
} = require("../../infrastructure/storagePaths");
const {
	listSessions,
} = require("../session/sessionRepository");

const ENTITY_TYPES = Object.freeze(["characters", "npc", "locations"]);

function normalizeMentionName(value) {
	return String(value || "")
		.trim()
		.replace(/\s+/g, " ")
		.toLowerCase();
}

function replaceBracketedMentionNames(value, oldName, newName) {
	if (typeof value !== "string") return value;
	const normalizedOldName = normalizeMentionName(oldName);
	const nextName = String(newName || "")
		.trim()
		.replace(/\s+/g, " ");
	if (!normalizedOldName || !nextName) return value;
	return value.replace(/\[([^[\]]+)\]/g, (fullMatch, rawName) =>
		normalizeMentionName(rawName) === normalizedOldName
			? `[${nextName}]`
			: fullMatch,
	);
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

function getEntityDisplayName(entity, type) {
	if (type === "locations") {
		return String(entity?.name || entity?.title || "").trim();
	}
	const fullName =
		`${entity?.firstName || ""} ${entity?.lastName || ""}`.trim();
	return fullName || String(entity?.name || entity?.title || "").trim();
}

function createEntityRepository(overrides = {}) {
	const dependencies = {
		campaignDir,
		campaignMetaPath,
		campaignSlug,
		createId: () => crypto.randomUUID(),
		ensureDir,
		exists,
		listSessions,
		now: () => Date.now(),
		readDir: fs.readdir,
		readJson,
		removeDirectory: (directoryPath) =>
			fs.rm(directoryPath, { recursive: true, force: true }),
		renameDirectory: fs.rename,
		sanitizeName,
		sessionPath,
		writeJson,
		...overrides,
	};

	function entityDirectory(campaignSlugValue, type, entitySlug) {
		return path.join(
			dependencies.campaignDir(campaignSlugValue),
			type,
			entitySlug,
		);
	}

	function entityInfoPath(campaignSlugValue, type, entitySlug) {
		return path.join(
			entityDirectory(campaignSlugValue, type, entitySlug),
			"info.json",
		);
	}

	async function listEntities(campaignSlugValue, type) {
		const entitiesDir = path.join(
			dependencies.campaignDir(campaignSlugValue),
			type,
		);
		await dependencies.ensureDir(entitiesDir);
		const entries = await dependencies.readDir(entitiesDir, {
			withFileTypes: true,
		});
		const entities = [];
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const infoPath = entityInfoPath(campaignSlugValue, type, entry.name);
			if (await dependencies.exists(infoPath)) {
				const data = await dependencies.readJson(infoPath);
				entities.push({ ...data, slug: entry.name });
			}
		}
		return entities.sort((a, b) => {
			const aOrder = Number.isFinite(Number(a.order)) ? Number(a.order) : 0;
			const bOrder = Number.isFinite(Number(b.order)) ? Number(b.order) : 0;
			if (aOrder !== bOrder) return aOrder - bOrder;
			return getEntityDisplayName(a, type).localeCompare(
				getEntityDisplayName(b, type),
			);
		});
	}

	async function readEntity(campaignSlugValue, type, entitySlug) {
		return dependencies.readJson(
			entityInfoPath(campaignSlugValue, type, entitySlug),
		);
	}

	async function writeEntity(campaignSlugValue, type, entitySlug, data) {
		const directoryPath = entityDirectory(
			campaignSlugValue,
			type,
			entitySlug,
		);
		await dependencies.ensureDir(directoryPath);
		const payload = { ...data, slug: entitySlug };
		await dependencies.writeJson(
			entityInfoPath(campaignSlugValue, type, entitySlug),
			payload,
		);
		return payload;
	}

	async function deleteEntity(campaignSlugValue, type, entitySlug) {
		await dependencies.removeDirectory(
			entityDirectory(campaignSlugValue, type, entitySlug),
		);
	}

	async function ensureUniqueEntitySlug(
		campaignSlugValue,
		type,
		baseSlug,
	) {
		const normalizedBase =
			path.basename(String(baseSlug || "")) ||
			`${type}-${dependencies.now()}`;
		let slug = normalizedBase;
		let counter = 2;
		while (
			await dependencies.exists(
				entityInfoPath(campaignSlugValue, type, slug),
			)
		) {
			slug = `${normalizedBase}-${counter}`;
			counter += 1;
		}
		return slug;
	}

	async function createEntity(campaignSlugValue, type, input = {}) {
		const isLocation = type === "locations";
		const name = dependencies.sanitizeName(
			isLocation ? input.name : input.firstName || input.name,
		);
		if (!name) return null;
		const entitySlug = await ensureUniqueEntitySlug(
			campaignSlugValue,
			type,
			dependencies.campaignSlug(name),
		);
		const data = isLocation
			? {
					description: "",
					notes: [],
					imageUrl: null,
					collapsed: false,
					isNotesCollapsed: false,
					...input,
					id: dependencies.createId(),
					name: input.name || name,
				}
			: {
					firstName: input.firstName || name,
					lastName: input.lastName || "",
					race: input.race || "",
					class: input.class || "",
					level: input.level === "" ? "" : input.level || 1,
					motivation: input.motivation || "",
					description: input.description || "",
					trait: input.trait || "",
					notes: [],
					...input,
					id: dependencies.createId(),
				};
		return writeEntity(campaignSlugValue, type, entitySlug, data);
	}

	async function replaceEntities(campaignSlugValue, type, entities = []) {
		const current = await listEntities(campaignSlugValue, type);
		const normalized = Array.isArray(entities) ? entities : [];
		const targetSlugs = new Set(
			normalized
				.map((entity) =>
					dependencies.campaignSlug(
						entity?.slug || entity?.name || entity?.firstName,
					),
				)
				.filter(Boolean),
		);
		for (const entity of current) {
			if (!targetSlugs.has(entity.slug)) {
				await deleteEntity(campaignSlugValue, type, entity.slug);
			}
		}
		for (const [index, entity] of normalized.entries()) {
			const slug = dependencies.campaignSlug(
				entity?.slug || entity?.name || entity?.firstName,
			);
			if (!slug) continue;
			await writeEntity(campaignSlugValue, type, slug, {
				...entity,
				order: index,
			});
		}
		return listEntities(campaignSlugValue, type);
	}

	async function updateCampaignMentionReferences(
		campaignSlugValue,
		oldName,
		newName,
	) {
		if (
			!normalizeMentionName(oldName) ||
			!String(newName || "").trim() ||
			normalizeMentionName(oldName) === normalizeMentionName(newName)
		) {
			return;
		}
		const metaPath = dependencies.campaignMetaPath(campaignSlugValue);
		if (await dependencies.exists(metaPath)) {
			const meta = await dependencies.readJson(metaPath);
			const nextMeta = replaceMentionsInValue(meta, oldName, newName);
			if (JSON.stringify(nextMeta) !== JSON.stringify(meta)) {
				await dependencies.writeJson(metaPath, nextMeta);
			}
		}
		for (const type of ENTITY_TYPES) {
			for (const entity of await listEntities(campaignSlugValue, type)) {
				const nextEntity = replaceMentionsInValue(
					entity,
					oldName,
					newName,
				);
				if (JSON.stringify(nextEntity) !== JSON.stringify(entity)) {
					await writeEntity(
						campaignSlugValue,
						type,
						entity.slug,
						nextEntity,
					);
				}
			}
		}
		for (const session of await dependencies.listSessions(campaignSlugValue)) {
			const filePath = dependencies.sessionPath(
				campaignSlugValue,
				session.fileName,
			);
			const data = await dependencies.readJson(filePath);
			const nextData = replaceMentionsInValue(data, oldName, newName);
			if (JSON.stringify(nextData) !== JSON.stringify(data)) {
				await dependencies.writeJson(filePath, nextData);
			}
		}
	}

	async function updateEntity(
		campaignSlugValue,
		type,
		entitySlug,
		input = {},
	) {
		const {
			_updateMentionReferences: shouldUpdateMentions,
			_mentionOldName: mentionOldName,
			...patch
		} = input;
		const current = await readEntity(campaignSlugValue, type, entitySlug);
		const oldDisplayName =
			String(mentionOldName || "").trim() ||
			getEntityDisplayName(current, type);
		const saved = await writeEntity(campaignSlugValue, type, entitySlug, {
			...current,
			...patch,
			id: current.id,
			slug: current.slug,
		});
		if (shouldUpdateMentions) {
			await updateCampaignMentionReferences(
				campaignSlugValue,
				oldDisplayName,
				getEntityDisplayName(saved, type),
			);
		}
		return readEntity(campaignSlugValue, type, saved.slug);
	}

	async function moveEntity(
		campaignSlugValue,
		sourceType,
		entitySlug,
		targetType,
	) {
		if (sourceType === targetType) {
			return readEntity(campaignSlugValue, sourceType, entitySlug);
		}
		if (
			!ENTITY_TYPES.includes(sourceType) ||
			!ENTITY_TYPES.includes(targetType)
		) {
			throw new Error("Invalid entity type");
		}
		const safeSlug = path.basename(entitySlug);
		const current = await readEntity(
			campaignSlugValue,
			sourceType,
			safeSlug,
		);
		const targetSlug = await ensureUniqueEntitySlug(
			campaignSlugValue,
			targetType,
			safeSlug,
		);
		const sourcePath = entityDirectory(
			campaignSlugValue,
			sourceType,
			safeSlug,
		);
		const targetPath = entityDirectory(
			campaignSlugValue,
			targetType,
			targetSlug,
		);
		await dependencies.ensureDir(path.dirname(targetPath));
		await dependencies.renameDirectory(sourcePath, targetPath);
		return writeEntity(campaignSlugValue, targetType, targetSlug, {
			...current,
			slug: targetSlug,
		});
	}

	return {
		createEntity,
		deleteEntity,
		ensureUniqueEntitySlug,
		listEntities,
		moveEntity,
		readEntity,
		replaceEntities,
		updateCampaignMentionReferences,
		updateEntity,
		writeEntity,
	};
}

const entityRepository = createEntityRepository();

module.exports = {
	ENTITY_TYPES,
	...entityRepository,
	createEntityRepository,
	getEntityDisplayName,
	normalizeMentionName,
	replaceBracketedMentionNames,
	replaceMentionsInValue,
};
