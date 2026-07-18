import {
	type MouseEvent,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

import { classNames, parseUrl } from "../../../shared/lib/index.js";
import {
	EntityLinkContext,
	EntityLinkResolverContext,
	type EntityLinkModalState,
} from "../model/EntityLinkIdentity.ts";
import { openEntityLinkModal } from "../model/entityLinkModalUtils.ts";
import EntityModal from "./EntityModal.tsx";

export interface EntityLinkProps {
	name: string;
	children?: ReactNode;
	className?: string;
}

export default function EntityLink({
	name,
	children,
	className = "",
}: EntityLinkProps) {
	const [modalState, setModalState] =
		useState<EntityLinkModalState | null>(null);
	const currentEntityIdentity = useContext(EntityLinkContext);
	const scopedEntityLinks = useContext(EntityLinkResolverContext);

	const resolvedCampaignSlug = useMemo(() => parseUrl().campaign, []);

	const handleCloseModal = useCallback(() => setModalState(null), []);

	const handleOpenModal = useCallback(
		async (event: MouseEvent<HTMLAnchorElement>) => {
			event.preventDefault();
			event.stopPropagation();

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
