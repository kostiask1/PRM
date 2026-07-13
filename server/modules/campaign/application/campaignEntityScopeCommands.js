const SCOPE_TYPES = Object.freeze(["npc", "locations"]);

function fail(message, status) {
	const error = new Error(message);
	error.status = status;
	throw error;
}

function assertScopeType(type) {
	if (!SCOPE_TYPES.includes(type)) {
		fail("Only NPC and location entities can change scope.", 400);
	}
}

function entityKey(type) {
	return type === "locations" ? "locations" : "npcs";
}

function idsEqual(left, right) {
	return String(left ?? "") === String(right ?? "");
}

function displayName(type, entity = {}) {
	if (type === "locations") return entity.name || entity.title || "";
	return (
		`${entity.firstName || ""} ${entity.lastName || ""}`.trim() ||
		entity.name ||
		entity.title ||
		""
	);
}

function cleanEntity(entity = {}) {
	return Object.fromEntries(
		Object.entries(entity).filter(([key]) => !key.startsWith("_")),
	);
}

function createCampaignEntityScopeCommands(repository) {
	async function moveToSession({ campaignSlug, fileName, type, entitySlug }) {
		if (!entitySlug) fail("Campaign entity slug is required.", 400);
		const [session, storedEntity] = await Promise.all([
			repository.readSession(campaignSlug, fileName),
			repository.readEntity(campaignSlug, type, entitySlug),
		]);
		const entity = cleanEntity(storedEntity);
		const key = entityKey(type);
		const current = Array.isArray(session.data?.[key]) ? session.data[key] : [];
		const nextSession = {
			...session,
			data: {
				...session.data,
				[key]: [
					...current.filter(
						(item) =>
							!idsEqual(item.id, entity.id) && item.slug !== entity.slug,
					),
					entity,
				],
			},
		};
		await repository.writeSession(campaignSlug, fileName, nextSession);
		try {
			await repository.deleteEntity(campaignSlug, type, entitySlug);
		} catch (error) {
			await repository.writeSession(campaignSlug, fileName, session).catch(() => {});
			throw error;
		}
		return { entity, session: { ...nextSession, fileName } };
	}

	async function moveToCampaign({ campaignSlug, fileName, type, entityId }) {
		const session = await repository.readSession(campaignSlug, fileName);
		const key = entityKey(type);
		const current = Array.isArray(session.data?.[key]) ? session.data[key] : [];
		const entity = current.find((item) => idsEqual(item.id, entityId));
		if (!entity) fail("Session entity not found.", 404);
		const name = repository.sanitizeName(displayName(type, entity));
		if (!name) fail("Name is required.", 400);
		const slug = await repository.ensureUniqueSlug(
			campaignSlug,
			type,
			repository.toSlug(name),
		);
		const savedEntity = await repository.writeEntity(
			campaignSlug,
			type,
			slug,
			{ ...cleanEntity(entity), id: entity.id },
		);
		const nextSession = {
			...session,
			data: {
				...session.data,
				[key]: current.filter((item) => !idsEqual(item.id, entityId)),
			},
		};
		try {
			await repository.writeSession(campaignSlug, fileName, nextSession);
		} catch (error) {
			await repository.deleteEntity(campaignSlug, type, slug).catch(() => {});
			throw error;
		}
		return { entity: savedEntity, session: { ...nextSession, fileName } };
	}

	return {
		async move(input) {
			assertScopeType(input.type);
			if (input.targetScope === "session") return moveToSession(input);
			if (input.targetScope === "campaign") return moveToCampaign(input);
			return fail("Invalid target scope.", 400);
		},
	};
}

module.exports = {
	SCOPE_TYPES,
	createCampaignEntityScopeCommands,
	entityKey,
};
