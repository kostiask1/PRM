const CAMPAIGN_ENTITY_TYPES = Object.freeze(["characters", "npc", "locations"]);

function assertEntityType(type) {
	if (CAMPAIGN_ENTITY_TYPES.includes(type)) return;
	const error = new Error("Unknown entity type.");
	error.status = 400;
	throw error;
}

function getEntityDisplayName(entity, type) {
	if (type === "locations") {
		return String(entity?.name || entity?.title || "").trim();
	}
	const fullName = `${entity?.firstName || ""} ${entity?.lastName || ""}`.trim();
	return fullName || String(entity?.name || entity?.title || "").trim();
}

function createEntityData(type, payload, name, createId) {
	if (type === "locations") {
		return {
			description: "",
			notes: [],
			imageUrl: null,
			collapsed: false,
			isNotesCollapsed: false,
			...payload,
			id: createId(),
			name: payload.name || name,
		};
	}
	return {
		firstName: payload.firstName || name,
		lastName: payload.lastName || "",
		race: payload.race || "",
		class: payload.class || "",
		level: payload.level === "" ? "" : payload.level || 1,
		motivation: payload.motivation || "",
		description: payload.description || "",
		trait: payload.trait || "",
		notes: [],
		...payload,
		id: createId(),
	};
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
				type === "locations" ? payload.name : payload.firstName || payload.name,
			);
			if (!name) {
				const error = new Error("Name is required.");
				error.status = 400;
				throw error;
			}
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
			const requested = Array.isArray(entities) ? entities : [];
			const current = await repository.list(campaignSlug, type);
			const targetSlugs = new Set(
				requested
					.map((entity) =>
						repository.toSlug(
							entity?.slug || entity?.name || entity?.firstName,
						),
					)
					.filter(Boolean),
			);
			for (const entity of current) {
				if (!targetSlugs.has(entity.slug)) {
					await repository.delete(campaignSlug, type, entity.slug);
				}
			}
			for (const [order, entity] of requested.entries()) {
				const slug = repository.toSlug(
					entity?.slug || entity?.name || entity?.firstName,
				);
				if (!slug) continue;
				await repository.write(campaignSlug, type, slug, {
					...entity,
					order,
				});
			}
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
			if (
				!((type === "characters" && targetType === "npc") ||
					(type === "npc" && targetType === "characters"))
			) {
				const error = new Error(
					"Entity can only be moved between characters and NPC.",
				);
				error.status = 400;
				throw error;
			}
			return repository.move(campaignSlug, type, entitySlug, targetType);
		},
	};
}

module.exports = {
	CAMPAIGN_ENTITY_TYPES,
	createCampaignEntityCommands,
	getEntityDisplayName,
};
