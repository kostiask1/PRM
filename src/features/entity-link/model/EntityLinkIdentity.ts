import { createContext, type ReactNode } from "react";
import {
	getEntityDisplayName,
	type CampaignEntity,
} from "../../../entities/campaign/index.js";

export interface EntityIdentity {
	scope: string;
	type: string;
	id: string;
	slug: string;
	name: string;
}

export interface EntityLinkModalState {
	entity: CampaignEntity;
	type: string;
	scope?: string;
}

export interface EntityLinkResolver {
	resolveEntityByName?: (
		name: string,
	) => EntityLinkModalState | null | undefined;
	renderModalContent?: (
		modalState: EntityLinkModalState,
		onClose: () => void,
	) => ReactNode;
}

function normalizeIdentityPart(value: unknown): string {
	return String(value || "").trim();
}

function getEntityIdentity(
	entity: CampaignEntity,
	type: string,
	scope = "",
): EntityIdentity {
	return {
		scope: normalizeIdentityPart(scope || entity?._scope || entity?.scope),
		type: normalizeIdentityPart(type),
		id: normalizeIdentityPart(entity?.id),
		slug: normalizeIdentityPart(entity?.slug),
		name: getEntityDisplayName(entity, type).toLowerCase(),
	};
}

function isSameEntityIdentity(
	left: EntityIdentity | null | undefined,
	right: EntityIdentity | null | undefined,
): boolean {
	if (!left || !right || left.type !== right.type) return false;
	if ((left.scope || right.scope) && left.scope !== right.scope) return false;
	if (left.id && right.id && left.id === right.id) return true;
	if (left.slug && right.slug && left.slug === right.slug) return true;
	return Boolean(left.name && right.name && left.name === right.name);
}

const EntityLinkContext = createContext<EntityIdentity | null>(null);
const EntityLinkResolverContext = createContext<EntityLinkResolver | null>(null);

export {
	EntityLinkContext,
	EntityLinkResolverContext,
	getEntityIdentity,
	isSameEntityIdentity,
};
