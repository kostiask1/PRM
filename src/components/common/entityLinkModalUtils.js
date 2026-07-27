import { resolveEntityByName } from "../../entities/campaign/api.js";
import {
	getEntityIdentity,
	isSameEntityIdentity,
} from "./EntityLinkIdentity.js";

export async function openEntityLinkModal({
	campaignSlug,
	currentEntityIdentity,
	errorMessage,
	modalState,
	name,
	scopedEntityLinks,
	setModalState,
}) {
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
