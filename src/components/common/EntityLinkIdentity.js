import { createContext } from "react";
import { getEntityDisplayName } from "../../entities/campaign/model.js";

function normalizeIdentityPart(value) {
	return String(value || "").trim();
}

function getEntityIdentity(entity, type, scope = "") {
	return {
		scope: normalizeIdentityPart(scope || entity?._scope || entity?.scope),
		type: normalizeIdentityPart(type),
		id: normalizeIdentityPart(entity?.id),
		slug: normalizeIdentityPart(entity?.slug),
		name: getEntityDisplayName(entity, type).toLowerCase(),
	};
}

function isSameEntityIdentity(left, right) {
	if (!left || !right || left.type !== right.type) return false;
	if ((left.scope || right.scope) && left.scope !== right.scope) return false;
	if (left.id && right.id && left.id === right.id) return true;
	if (left.slug && right.slug && left.slug === right.slug) return true;
	return Boolean(left.name && right.name && left.name === right.name);
}

const EntityLinkContext = createContext(null);
const EntityLinkResolverContext = createContext(null);

export {
	EntityLinkContext,
	EntityLinkResolverContext,
	getEntityIdentity,
	isSameEntityIdentity,
};
