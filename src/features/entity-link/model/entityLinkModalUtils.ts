import { resolveEntityByName } from "../../../entities/campaign/index.js";
import {
	getEntityIdentity,
	isSameEntityIdentity,
	type EntityIdentity,
	type EntityLinkModalState,
	type EntityLinkResolver,
} from "./EntityLinkIdentity.ts";

export interface OpenEntityLinkModalOptions {
	campaignSlug: string | null;
	currentEntityIdentity: EntityIdentity | null;
	errorMessage: string;
	modalState: EntityLinkModalState | null;
	name: string;
	scopedEntityLinks?: EntityLinkResolver | null;
	setModalState: (value: EntityLinkModalState) => void;
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
		const found =
			scopedEntityLinks?.resolveEntityByName?.(name) ||
			(await resolveEntityByName(campaignSlug, name));
		if (!found) return;

		const foundIdentity = getEntityIdentity(
			found.entity,
			found.type,
			found.scope,
		);
		if (
			isSameEntityIdentity(foundIdentity, currentEntityIdentity) ||
			isSameEntityIdentity(
				foundIdentity,
				modalState
					? getEntityIdentity(
							modalState.entity,
							modalState.type,
							modalState.scope,
						)
					: null,
			)
		) {
			return;
		}

		setModalState({
			entity: found.entity,
			type: found.type,
		});
	} catch (error) {
		console.error(errorMessage, error);
	}
}
