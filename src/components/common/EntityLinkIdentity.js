import { createContext } from "react";

function normalizeIdentityPart(value) {
	return String(value || "").trim();
}

function getEntityDisplayName(entity, type) {
	if (type === "locations") {
		return String(entity?.name || entity?.title || "").trim();
	}
	return (
		`${entity?.firstName || ""} ${entity?.lastName || ""}`.trim() ||
		String(entity?.name || entity?.title || "").trim()
	);
}

function getEntityIdentity(entity, type) {
	return {
		type: normalizeIdentityPart(type),
		id: normalizeIdentityPart(entity?.id),
		slug: normalizeIdentityPart(entity?.slug),
		name: getEntityDisplayName(entity, type).toLowerCase(),
	};
}

function isSameEntityIdentity(left, right) {
	if (!left || !right || left.type !== right.type) return false;
	if (left.id && right.id && left.id === right.id) return true;
	if (left.slug && right.slug && left.slug === right.slug) return true;
	return Boolean(left.name && right.name && left.name === right.name);
}

const EntityLinkContext = createContext(null);

export { EntityLinkContext, getEntityIdentity, isSameEntityIdentity };
