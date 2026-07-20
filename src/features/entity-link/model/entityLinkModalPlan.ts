import type {
	EntityIdentity,
	EntityLinkModalState,
} from "./entityLinkContracts.ts";
import {
	getEntityIdentity,
	isSameEntityIdentity,
} from "./entityLinkIdentityPolicy.ts";

export type EntityLinkModalTargetPlan =
	| {
			status: "ignored";
			reason: "not-found" | "same-entity";
	  }
	| {
			status: "open";
			modalState: EntityLinkModalState;
	  };

function getModalIdentity(
	modalState: EntityLinkModalState | null,
): EntityIdentity | null {
	return modalState
		? getEntityIdentity(
				modalState.entity,
				modalState.type,
				modalState.scope,
			)
		: null;
}

export function buildEntityLinkModalTargetPlan({
	found,
	currentEntityIdentity,
	modalState,
}: {
	found: EntityLinkModalState | null | undefined;
	currentEntityIdentity: EntityIdentity | null;
	modalState: EntityLinkModalState | null;
}): EntityLinkModalTargetPlan {
	if (!found) return { status: "ignored", reason: "not-found" };
	const foundIdentity = getEntityIdentity(
		found.entity,
		found.type,
		found.scope,
	);
	const blockedIdentities = [
		currentEntityIdentity,
		getModalIdentity(modalState),
	];
	if (
		blockedIdentities.some((identity) =>
			isSameEntityIdentity(foundIdentity, identity),
		)
	) {
		return { status: "ignored", reason: "same-entity" };
	}
	return {
		status: "open",
		modalState: {
			entity: found.entity,
			type: found.type,
			...(found.scope ? { scope: found.scope } : {}),
		},
	};
}
