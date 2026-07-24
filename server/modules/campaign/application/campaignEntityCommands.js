const CAMPAIGN_ENTITY_TYPES = Object.freeze(["characters", "npc", "locations"]);
const CHARACTER_TYPE_MOVE_TARGETS = Object.freeze({
	characters: "npc",
	npc: "characters",
});

function assertEntityType(type) {
	if (CAMPAIGN_ENTITY_TYPES.includes(type)) return;
	const error = new Error("Unknown entity type.");
	error.status = 400;
	throw error;
}

function isLocationEntityType(type) {
	return type === "locations";
}

function getOptionalEntityProperty(entity, property) {
	return entity?.[property];
}

function getFirstTruthyOptionalEntityProperty(
	entity,
	firstProperty,
	secondProperty,
) {
	const firstValue = getOptionalEntityProperty(entity, firstProperty);
	if (firstValue) return firstValue;
	return getOptionalEntityProperty(entity, secondProperty);
}

function normalizeEntityDisplayValue(value) {
	return String(value || "").trim();
}

function getLocationEntityDisplayName(entity) {
	return normalizeEntityDisplayValue(
		getFirstTruthyOptionalEntityProperty(entity, "name", "title"),
	);
}

function getPersonEntityNamePart(entity, property) {
	return getOptionalEntityProperty(entity, property) || "";
}

function getPersonEntityDisplayName(entity) {
	const fullName =
		`${getPersonEntityNamePart(entity, "firstName")} ${getPersonEntityNamePart(
			entity,
			"lastName",
		)}`.trim();
	if (fullName) return fullName;
	return getLocationEntityDisplayName(entity);
}

function getEntityDisplayName(entity, type) {
	return isLocationEntityType(type)
		? getLocationEntityDisplayName(entity)
		: getPersonEntityDisplayName(entity);
}

function getTruthyPayloadProperty(payload, property, fallbackValue) {
	return payload[property] || fallbackValue;
}

function getFirstTruthyPayloadProperty(
	payload,
	firstProperty,
	secondProperty,
) {
	const firstValue = payload[firstProperty];
	if (firstValue) return firstValue;
	return payload[secondProperty];
}

function getCreateEntityNameCandidate(type, payload) {
	if (isLocationEntityType(type)) return payload.name;
	return getFirstTruthyPayloadProperty(payload, "firstName", "name");
}

function assertEntityName(name) {
	if (name) return;
	const error = new Error("Name is required.");
	error.status = 400;
	throw error;
}

function getPersonEntityLevel(payload) {
	if (payload.level === "") return "";
	return payload.level || 1;
}

function createLocationEntityData(payload, name, createId) {
	return {
		description: "",
		notes: [],
		imageUrl: null,
		collapsed: false,
		isNotesCollapsed: false,
		...payload,
		id: createId(),
		name: getTruthyPayloadProperty(payload, "name", name),
	};
}

function createPersonEntityData(payload, name, createId) {
	return {
		firstName: getTruthyPayloadProperty(payload, "firstName", name),
		lastName: getTruthyPayloadProperty(payload, "lastName", ""),
		race: getTruthyPayloadProperty(payload, "race", ""),
		class: getTruthyPayloadProperty(payload, "class", ""),
		level: getPersonEntityLevel(payload),
		motivation: getTruthyPayloadProperty(payload, "motivation", ""),
		description: getTruthyPayloadProperty(payload, "description", ""),
		trait: getTruthyPayloadProperty(payload, "trait", ""),
		notes: [],
		...payload,
		id: createId(),
	};
}

function createEntityData(type, payload, name, createId) {
	return isLocationEntityType(type)
		? createLocationEntityData(payload, name, createId)
		: createPersonEntityData(payload, name, createId);
}

function getReplacementEntities(entities) {
	return Array.isArray(entities) ? entities : [];
}

function getReplacementSlugCandidate(entity) {
	const explicitSlug = getOptionalEntityProperty(entity, "slug");
	if (explicitSlug) return explicitSlug;
	const name = getOptionalEntityProperty(entity, "name");
	if (name) return name;
	return getOptionalEntityProperty(entity, "firstName");
}

function getReplacementSlug(repository, entity) {
	return repository.toSlug(getReplacementSlugCandidate(entity));
}

function createTargetSlugSet(repository, requested) {
	const slugs = requested.map((entity) =>
		getReplacementSlug(repository, entity),
	);
	return new Set(slugs.filter(Boolean));
}

async function deleteStaleEntities({
	repository,
	campaignSlug,
	type,
	current,
	targetSlugs,
}) {
	for (const entity of current) {
		if (!targetSlugs.has(entity.slug)) {
			await repository.delete(campaignSlug, type, entity.slug);
		}
	}
}

async function writeReplacementEntities({
	repository,
	campaignSlug,
	type,
	requested,
}) {
	for (const [order, entity] of requested.entries()) {
		const slug = getReplacementSlug(repository, entity);
		if (!slug) continue;
		await repository.write(campaignSlug, type, slug, {
			...entity,
			order,
		});
	}
}

function assertCharacterTypeMove(type, targetType) {
	if (CHARACTER_TYPE_MOVE_TARGETS[type] === targetType) return;
	const error = new Error(
		"Entity can only be moved between characters and NPC.",
	);
	error.status = 400;
	throw error;
}

function createCampaignEntityCommands(repository) {
	return {
		async list({ campaignSlug, type }) {
			assertEntityType(type);
			return repository.list(campaignSlug, type);
		},
		async create({ campaignSlug, type, payload = {} }) {
			assertEntityType(type);
			const name = repository.sanitizeName(
				getCreateEntityNameCandidate(type, payload),
			);
			assertEntityName(name);
			const entitySlug = await repository.ensureUniqueSlug(
				campaignSlug,
				type,
				repository.toSlug(name),
			);
			return repository.write(
				campaignSlug,
				type,
				entitySlug,
				createEntityData(type, payload, name, repository.createId),
			);
		},
		async update({ campaignSlug, type, entitySlug, payload = {} }) {
			assertEntityType(type);
			const {
				_updateMentionReferences: updateMentionReferences,
				_mentionOldName: mentionOldName,
				...patch
			} = payload;
			const current = await repository.read(campaignSlug, type, entitySlug);
			const oldDisplayName =
				String(mentionOldName || "").trim() || getEntityDisplayName(current, type);
			const saved = await repository.write(campaignSlug, type, entitySlug, {
				...current,
				...patch,
				id: current.id,
				slug: current.slug,
			});
			if (updateMentionReferences) {
				await repository.updateMentionReferences(
					campaignSlug,
					oldDisplayName,
					getEntityDisplayName(saved, type),
				);
			}
			return repository.read(campaignSlug, type, saved.slug);
		},
		async delete({ campaignSlug, type, entitySlug }) {
			assertEntityType(type);
			await repository.delete(campaignSlug, type, entitySlug);
		},
		async replaceAll({ campaignSlug, type, entities = [] }) {
			assertEntityType(type);
			const requested = getReplacementEntities(entities);
			const current = await repository.list(campaignSlug, type);
			const targetSlugs = createTargetSlugSet(repository, requested);
			await deleteStaleEntities({
				repository,
				campaignSlug,
				type,
				current,
				targetSlugs,
			});
			await writeReplacementEntities({
				repository,
				campaignSlug,
				type,
				requested,
			});
			return repository.list(campaignSlug, type);
		},
		async moveBetweenCharacterTypes({
			campaignSlug,
			type,
			entitySlug,
			targetType,
		}) {
			assertEntityType(type);
			assertEntityType(targetType);
			assertCharacterTypeMove(type, targetType);
			return repository.move(campaignSlug, type, entitySlug, targetType);
		},
	};
}

module.exports = {
	CAMPAIGN_ENTITY_TYPES,
	createCampaignEntityCommands,
	getEntityDisplayName,
};
