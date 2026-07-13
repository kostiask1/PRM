import { useContext } from "react";

import { Modal } from "../../modal/index.js";
import { EntityLinkScope } from "./EntityLinkContext.jsx";
import { EntityLinkResolverContext } from "../model/EntityLinkIdentity.js";
import { getEntityDisplayName } from "../../../entities/campaign/index.js";
import { lang } from "../../../shared/lib/index.js";

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
