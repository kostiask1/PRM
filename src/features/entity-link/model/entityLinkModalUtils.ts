import { resolveEntityByName } from "../../../entities/campaign/index.js";
import {
	getEntityIdentity,
	isSameEntityIdentity,
	type EntityIdentity,
	type EntityLinkModalState,
	type EntityLinkResolver,
} from "./EntityLinkIdentity.ts";

interface OpenEntityLinkModalOptions {
	campaignSlug: string;
	currentEntityIdentity: EntityIdentity | null;
	errorMessage: string;
	modalState: EntityLinkModalState | null;
	name: string;
	scopedEntityLinks?: EntityLinkResolver | null;
	setModalState: (value: EntityLinkModalState) => void;
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
