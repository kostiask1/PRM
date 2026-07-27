const {
	coerceAiText: asText,
	sanitizeAiName: sanitizeEntityName,
} = require("../../ai/textUtils");
const {
	getCharacterDisplayName,
	getLocationDisplayName,
} = require("../../ai/entityDisplayUtils");

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

function findByIdentity(items = [], identity, type) {
	const id = asText(identity?.id || identity?.targetId);
	const slug = asText(identity?.slug);
	const name = asText(identity?.name || identity?.targetName);
	const key = name ? getEntityNameKey(type, { name, fullName: name }) : "";
	return (
		(items || []).find((item) => {
			const itemId = asText(item?.id);
			const itemSlug = asText(item?.slug);
			const itemName = getEntityNameKey(type, item);
			return (
				(id && itemId === id) ||
				(slug && itemSlug === slug) ||
				(key && itemName === key)
			);
		}) || null
	);
}

function getOperationTargetIdentity(operation = {}, clientIdMap = null) {
	const ownerClientId = asText(
		operation.targetClientId || operation.ownerClientId,
	);
	const mapped =
		ownerClientId && clientIdMap ? clientIdMap.get(ownerClientId) : null;
	return {
		id: mapped?.id || operation.id || operation.targetId,
		slug: operation.slug,
		name: operation.name || operation.targetName,
	};
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

function operationScope(operation, defaultScope, clientIdMap = null) {
	const scope = asText(operation.scope).toLowerCase();
	if (scope === "campaign" || scope === "session") return scope;
	const ownerClientId = asText(
		operation.targetClientId || operation.ownerClientId,
	);
	const mapped =
		ownerClientId && clientIdMap ? clientIdMap.get(ownerClientId) : null;
	if (mapped?.scope === "campaign" || mapped?.scope === "session") {
		return mapped.scope;
	}
	return defaultScope || "campaign";
}

module.exports = {
	entityKindFromStorageType,
	entityTypeFromOperation,
	findByIdentity,
	getEntityDisplayName,
	getEntityNameKey,
	getOperationTargetIdentity,
	getSessionEntityList,
	mapClientIdToEntity,
	operationScope,
	parseNameParts,
	setSessionEntityList,
};
