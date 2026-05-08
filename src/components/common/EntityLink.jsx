import { useCallback, useContext, useMemo, useState } from "react";

import { parseUrl } from "../../utils/navigation";
import EntityModal from "./EntityModal";
import classNames from "../../utils/classNames";
import { resolveEntityByName } from "../../services/entities.js";
import {
	EntityLinkContext,
	getEntityIdentity,
	isSameEntityIdentity,
} from "./EntityLinkIdentity";

export default function EntityLink({
	name,
	children,
	className = "",
}) {
	const [modalState, setModalState] = useState(null);
	const currentEntityIdentity = useContext(EntityLinkContext);

	const resolvedCampaignSlug = useMemo(
		() => parseUrl().campaign,
		[],
	);

	const handleCloseModal = useCallback(() => setModalState(null), []);

	const handleOpenModal = useCallback(
		async (e) => {
			e.preventDefault();
			e.stopPropagation();

			if (!resolvedCampaignSlug || !name) return;

			try {
				const found = await resolveEntityByName(resolvedCampaignSlug, name);
				if (!found) return;
				const foundIdentity = getEntityIdentity(found.entity, found.type);
				if (
					isSameEntityIdentity(foundIdentity, currentEntityIdentity) ||
					isSameEntityIdentity(
						foundIdentity,
						modalState
							? getEntityIdentity(modalState.entity, modalState.type)
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
				console.error("Failed to open entity link modal", error);
			}
		},
		[name, resolvedCampaignSlug, currentEntityIdentity, modalState],
	);

	return (
		<>
			<a
				href="#"
				className={classNames("mention-link", className)}
				onClick={handleOpenModal}
			>
				{children || name}
			</a>
			<EntityModal
				modalState={modalState}
				campaignSlug={resolvedCampaignSlug}
				onClose={handleCloseModal}
			/>
		</>
	);
}
