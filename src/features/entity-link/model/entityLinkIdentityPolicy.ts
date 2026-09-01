import {
	getEntityDisplayName,
	type CampaignEntity,
} from "../../../entities/campaign/index.js";
import type { EntityIdentity } from "./entityLinkContracts.ts";

const IDENTITY_MATCH_FIELDS = ["id", "slug", "name"] as const;

function normalizeIdentityPart(value: unknown): string {
	if (value === null || value === undefined) return "";
	return String(value).trim();
}

function getFirstIdentityPart(values: readonly unknown[]): string {
	for (const value of values) {
		const normalized = normalizeIdentityPart(value);
		if (normalized) return normalized;
	}
	return "";
}

function haveCompatibleIdentityScopes(
	left: EntityIdentity,
	right: EntityIdentity,
): boolean {
	return !left.scope && !right.scope ? true : left.scope === right.scope;
}

function haveMatchingIdentityField(
	left: EntityIdentity,
	right: EntityIdentity,
): boolean {
	return IDENTITY_MATCH_FIELDS.some(
		(field) => Boolean(left[field] && right[field] && left[field] === right[field]),
	);
}

export function getEntityIdentity(
	entity: CampaignEntity,
	type: string,
	scope = "",
): EntityIdentity {
	return {
		scope: getFirstIdentityPart([scope, entity?._scope, entity?.scope]),
		type: normalizeIdentityPart(type),
		id: normalizeIdentityPart(entity?.id),
		slug: normalizeIdentityPart(entity?.slug),
		name: normalizeIdentityPart(
			getEntityDisplayName(entity, type),
		).toLowerCase(),
	};
}

export function isSameEntityIdentity(
	left: EntityIdentity | null | undefined,
	right: EntityIdentity | null | undefined,
): boolean {
	return Boolean(
		left &&
			right &&
			left.type === right.type &&
			haveCompatibleIdentityScopes(left, right) &&
			haveMatchingIdentityField(left, right),
	);
}
