const { SCOPE_TYPES, entityKey } = require("./campaignEntityScopeCommands");

function fail(message, status = 400) {
	const error = new Error(message);
	error.status = status;
	throw error;
}

function requireSegment(value, label) {
	if (typeof value !== "string" || !value.trim() || value === "." || value === ".." || /[\\/\0]/.test(value)) {
		fail(`${label} is invalid.`);
	}
	return value;
}

function normalizeEndpoint(endpoint, defaultCampaign) {
	if (!endpoint || typeof endpoint !== "object" || Array.isArray(endpoint)) fail("Invalid entity scope.");
	const campaignSlug = requireSegment(endpoint.campaignSlug || defaultCampaign, "Campaign");
	if (endpoint.scope !== "campaign" && endpoint.scope !== "session") fail("Invalid entity scope.");
	return {
		campaignSlug,
		scope: endpoint.scope,
		fileName: endpoint.scope === "session" ? requireSegment(endpoint.fileName, "Session") : null,
	};
}

function getEntityName(type, entity) {
	if (type === "locations") return entity.name || entity.title || "";
	return `${entity.firstName || ""} ${entity.lastName || ""}`.trim() || entity.name || entity.title || "";
}

function updateSession(session, key, items) {
	return { ...session, data: { ...session.data, [key]: items } };
}

function createTransferCampaignEntity(repository) {
	return async function transferCampaignEntity({ campaignSlug, type, source, target }) {
		if (!SCOPE_TYPES.includes(type)) fail("Only NPC and location entities can change scope.");
		const from = normalizeEndpoint(source, campaignSlug);
		const to = normalizeEndpoint(target, campaignSlug);
		if (from.campaignSlug !== campaignSlug) fail("Source campaign does not match request.");
		if (from.campaignSlug.toLowerCase() === to.campaignSlug.toLowerCase() && from.scope === to.scope && String(from.fileName || "").toLowerCase() === String(to.fileName || "").toLowerCase()) fail("Source and destination are the same.");
		await repository.readCampaign(from.campaignSlug);
		if (to.campaignSlug !== from.campaignSlug) await repository.readCampaign(to.campaignSlug);
		const key = entityKey(type);
		let sourceSession;
		let sourceSlug;
		let entity;
		if (from.scope === "campaign") {
			sourceSlug = requireSegment(source.entitySlug, "Entity");
			entity = await repository.readEntity(from.campaignSlug, type, sourceSlug);
		} else {
			if (source.entityId === undefined || source.entityId === null || source.entityId === "") fail("Entity ID is required.");
			sourceSession = await repository.readSession(from.campaignSlug, from.fileName);
			const items = Array.isArray(sourceSession.data?.[key]) ? sourceSession.data[key] : [];
			entity = items.find((item) => String(item.id) === String(source.entityId));
			if (!entity) fail("Session entity not found.", 404);
		}
		if (!entity || typeof entity !== "object" || entity.id === undefined || entity.id === null) fail("Entity has no ID.");
		const cleaned = Object.fromEntries(Object.entries(entity).filter(([name]) => !name.startsWith("_")));
		let targetSession;
		let targetSlug;
		let savedEntity = cleaned;
		if (to.scope === "campaign") {
			const entities = await repository.listEntities(to.campaignSlug, type);
			if (entities.some((item) => String(item.id) === String(entity.id))) fail("Destination already contains this entity ID.", 409);
			const name = repository.sanitizeName(getEntityName(type, entity));
			if (!name) fail("Name is required.");
			targetSlug = await repository.ensureUniqueSlug(to.campaignSlug, type, repository.toSlug(name));
			try {
				savedEntity = await repository.writeEntity(to.campaignSlug, type, targetSlug, cleaned);
			} catch (error) {
				await repository.deleteEntity(to.campaignSlug, type, targetSlug).catch(() => {});
				throw error;
			}
		} else {
			targetSession = await repository.readSession(to.campaignSlug, to.fileName);
			const items = Array.isArray(targetSession.data?.[key]) ? targetSession.data[key] : [];
			if (items.some((item) => String(item.id) === String(entity.id))) fail("Destination already contains this entity ID.", 409);
			try {
				await repository.writeSession(to.campaignSlug, to.fileName, updateSession(targetSession, key, [...items, cleaned]));
			} catch (error) {
				await repository.writeSession(to.campaignSlug, to.fileName, targetSession).catch(() => {});
				throw error;
			}
		}
		let updatedSourceSession = null;
		try {
			if (from.scope === "campaign") await repository.deleteEntity(from.campaignSlug, type, sourceSlug);
			else {
				const items = Array.isArray(sourceSession.data?.[key]) ? sourceSession.data[key] : [];
				updatedSourceSession = updateSession(sourceSession, key, items.filter((item) => String(item.id) !== String(entity.id)));
				await repository.writeSession(from.campaignSlug, from.fileName, updatedSourceSession);
			}
		} catch (error) {
			try {
				if (from.scope === "campaign") await repository.writeEntity(from.campaignSlug, type, sourceSlug, entity);
				else await repository.writeSession(from.campaignSlug, from.fileName, sourceSession);
				if (to.scope === "campaign") await repository.deleteEntity(to.campaignSlug, type, targetSlug);
				else await repository.writeSession(to.campaignSlug, to.fileName, targetSession);
			} catch (rollbackError) {
				error.rollbackError = rollbackError;
			}
			throw error;
		}
		return { entity: savedEntity, source: from, target: to, sourceSession: updatedSourceSession ? { ...updatedSourceSession, fileName: from.fileName } : null };
	};
}

module.exports = { createTransferCampaignEntity };
