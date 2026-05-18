import { lazy, Suspense, useContext } from "react";

import Modal from "./Modal";
import { EntityLinkScope } from "./EntityLinkContext";
import { EntityLinkResolverContext } from "./EntityLinkIdentity";
import { getEntityDisplayName } from "../../services/entities.js";
import { lang } from "../../services/localization";

const EntityModalContent = lazy(() => import("../modals/EntityModalContent"));

export default function EntityModal({ modalState, campaignSlug, onClose }) {
	const scopedEntityLinks = useContext(EntityLinkResolverContext);
	if (!modalState) return null;
	const scopedContent =
		modalState.scope &&
		scopedEntityLinks?.renderModalContent?.(modalState, onClose);

	return (
		<Modal
			title={lang
				.t("{type}: {name}", {
					type:
						modalState.type === "locations"
							? lang.t("Location/Faction")
							: modalState.type === "npc"
								? "NPC"
								: lang.t("Character"),
					name: getEntityDisplayName(modalState.entity, modalState.type),
				})
				.trim()}
			type={modalState.type === "locations" ? "location" : "character"}
			className={
				modalState.type === "locations" ? "EntityLinkModal__location" : ""
			}
			showFooter={false}
			onConfirm={onClose}
			onCancel={onClose}
		>
			<Suspense fallback={null}>
				<EntityLinkScope
					entity={modalState.entity}
					type={modalState.type}
					scope={modalState.scope}
				>
					{scopedContent || (
						<EntityModalContent
							initialEntity={modalState.entity}
							campaignSlug={campaignSlug}
							type={modalState.type}
							onClose={onClose}
						/>
					)}
				</EntityLinkScope>
			</Suspense>
		</Modal>
	);
}
