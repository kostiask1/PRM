import { lazy, Suspense } from "react";

import Modal from "./Modal";
import { EntityLinkScope } from "./EntityLinkContext";
import { getEntityDisplayName } from "../../services/entities.js";
import { lang } from "../../services/localization";

const EntityModalContent = lazy(() => import("../modals/EntityModalContent"));

export default function EntityModal({ modalState, campaignSlug, onClose }) {
	if (!modalState) return null;

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
				modalState.type === "locations" ? "EntityLinkModal--location" : ""
			}
			showFooter={false}
			onConfirm={onClose}
			onCancel={onClose}
		>
			<Suspense fallback={null}>
				<EntityLinkScope entity={modalState.entity} type={modalState.type}>
					<EntityModalContent
						initialEntity={modalState.entity}
						campaignSlug={campaignSlug}
						type={modalState.type}
						onClose={onClose}
					/>
				</EntityLinkScope>
			</Suspense>
		</Modal>
	);
}
