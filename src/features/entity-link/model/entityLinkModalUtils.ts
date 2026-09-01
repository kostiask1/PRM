import { resolveEntityByName } from "../../../entities/campaign/index.js";
import {
	type EntityIdentity,
	type EntityLinkModalState,
	type EntityLinkResolver,
} from "./EntityLinkIdentity.ts";
import {
	buildEntityLinkModalTargetPlan,
} from "./entityLinkModalPlan.ts";

export interface OpenEntityLinkModalOptions {
	campaignSlug: string | null;
	currentEntityIdentity: EntityIdentity | null;
	errorMessage: string;
	modalState: EntityLinkModalState | null;
	name: string;
	scopedEntityLinks?: EntityLinkResolver | null;
	setModalState: (value: EntityLinkModalState) => void;
}

async function resolveEntityLinkModalTarget(
	campaignSlug: string,
	name: string,
	scopedEntityLinks?: EntityLinkResolver | null,
): Promise<EntityLinkModalState | null | undefined> {
	const scopedTarget = await scopedEntityLinks?.resolveEntityByName?.(name);
	return scopedTarget || resolveEntityByName(campaignSlug, name);
}

export type EntityModalTitleKind = "character" | "location" | "npc";

export interface EntityModalPresentation {
	titleKind: EntityModalTitleKind;
	modalType: "character" | "location";
	className: string;
}

export function getEntityModalPresentation(
	entityType: string,
): EntityModalPresentation {
	if (entityType === "locations") {
		return {
			titleKind: "location",
			modalType: "location",
			className: "EntityLinkModal__location",
		};
	}
	return {
		titleKind: entityType === "npc" ? "npc" : "character",
		modalType: "character",
		className: "",
	};
}

export async function openEntityLinkModal({
	campaignSlug,
	currentEntityIdentity,
	errorMessage,
	modalState,
	name,
	scopedEntityLinks,
	setModalState,
}: OpenEntityLinkModalOptions): Promise<void> {
	if (!campaignSlug || !name) return;

	try {
		const found = await resolveEntityLinkModalTarget(
			campaignSlug,
			name,
			scopedEntityLinks,
		);
		const plan = buildEntityLinkModalTargetPlan({
			found,
			currentEntityIdentity,
			modalState,
		});
		if (plan.status === "open") setModalState(plan.modalState);
	} catch (error) {
		console.error(errorMessage, error);
	}
}

export {
	buildEntityLinkModalTargetPlan,
	type EntityLinkModalTargetPlan,
} from "./entityLinkModalPlan.ts";
