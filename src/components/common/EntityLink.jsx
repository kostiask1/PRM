import { useCallback, useContext, useMemo, useState } from "react";

import { parseUrl } from "../../shared/lib/navigation.js";
import EntityModal from "./EntityModal";
import classNames from "../../shared/lib/classNames.js";
import {
	EntityLinkContext,
	EntityLinkResolverContext,
} from "./EntityLinkIdentity";
import { openEntityLinkModal } from "./entityLinkModalUtils";

export default function EntityLink({ name, children, className = "" }) {
	const [modalState, setModalState] = useState(null);
	const currentEntityIdentity = useContext(EntityLinkContext);
	const scopedEntityLinks = useContext(EntityLinkResolverContext);

	const resolvedCampaignSlug = useMemo(() => parseUrl().campaign, []);

	const handleCloseModal = useCallback(() => setModalState(null), []);

	const handleOpenModal = useCallback(
		async (e) => {
			e.preventDefault();
			e.stopPropagation();

			await openEntityLinkModal({
				campaignSlug: resolvedCampaignSlug,
				currentEntityIdentity,
				errorMessage: "Failed to open entity link modal",
				modalState,
				name,
				scopedEntityLinks,
				setModalState,
			});
		},
		[
			name,
			resolvedCampaignSlug,
			currentEntityIdentity,
			modalState,
			scopedEntityLinks,
		],
	);

	return (
		<>
			<a
				href="#"
				className={classNames("mention_link", className)}
				onClick={handleOpenModal}
			>
				{children || name}
			</a>
			<EntityModal
				modalState={modalState}
				onClose={handleCloseModal}
			/>
		</>
	);
}
