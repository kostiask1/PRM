import { useCallback, useContext, useMemo, useState } from "react";

import { parseUrl } from "../../utils/navigation";
import Modal from "./Modal";
import EntityModalContent from "../modals/EntityModalContent";
import classNames from "../../utils/classNames";
import { lang } from "../../services/localization";
import { EntityLinkScope } from "./EntityLinkContext";
import {
	getEntityDisplayName,
	resolveEntityByName,
} from "./entityLinkUtils.js";
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
			{modalState && (
				<Modal
					title={lang
						.t("{type}: {name}", {
							type:
								modalState.type === "locations"
									? lang.t("Location/Faction")
									: modalState.type === "npc"
										? "NPC"
										: lang.t("Character"),
							name: getEntityDisplayName(
								modalState.entity,
								modalState.type,
							),
						})
						.trim()}
					type={modalState.type === "locations" ? "location" : "character"}
					className={
						modalState.type === "locations" ? "EntityLinkModal--location" : ""
					}
					showFooter={false}
					onConfirm={handleCloseModal}
					onCancel={handleCloseModal}
				>
					<EntityLinkScope entity={modalState.entity} type={modalState.type}>
						<EntityModalContent
							initialEntity={modalState.entity}
							campaignSlug={resolvedCampaignSlug}
							type={modalState.type}
							onClose={handleCloseModal}
						/>
					</EntityLinkScope>
				</Modal>
			)}
		</>
	);
}
