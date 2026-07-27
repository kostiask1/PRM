import { useContext } from "react";

import Modal from "./Modal";
import { EntityLinkScope } from "./EntityLinkContext";
import { EntityLinkResolverContext } from "./EntityLinkIdentity";
import { getEntityDisplayName } from "../../services/entities.js";
import { lang } from "../../services/localization";

export default function EntityModal({ modalState, onClose }) {
	const scopedEntityLinks = useContext(EntityLinkResolverContext);
	if (!modalState) return null;
	const content = scopedEntityLinks?.renderModalContent?.(modalState, onClose);

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
			<EntityLinkScope
				entity={modalState.entity}
				type={modalState.type}
				scope={modalState.scope}
			>
				{content || null}
			</EntityLinkScope>
		</Modal>
	);
}
