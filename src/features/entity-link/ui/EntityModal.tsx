import { useContext } from "react";

import { Modal } from "../../../shared/ui/index.js";
import { EntityLinkScope } from "./EntityLinkContext.tsx";
import {
	EntityLinkResolverContext,
	type EntityLinkModalState,
} from "../model/EntityLinkIdentity.ts";
import { getEntityDisplayName } from "../../../entities/campaign/index.js";
import { lang } from "../../../shared/lib/index.js";
import { getEntityModalPresentation } from "../model/entityLinkModalUtils.ts";

export interface EntityModalProps {
	modalState: EntityLinkModalState | null;
	onClose: () => void;
}

export default function EntityModal({
	modalState,
	onClose,
}: EntityModalProps) {
	const scopedEntityLinks = useContext(EntityLinkResolverContext);
	if (!modalState) return null;
	const content = scopedEntityLinks?.renderModalContent?.(modalState, onClose);
	const presentation = getEntityModalPresentation(modalState.type);
	const typeLabel =
		presentation.titleKind === "location"
			? lang.t("Location/Faction")
			: presentation.titleKind === "npc"
				? "NPC"
				: lang.t("Character");

	return (
		<Modal
			title={lang
				.t("{type}: {name}", {
					type: typeLabel,
					name: getEntityDisplayName(modalState.entity, modalState.type),
				})
				.trim()}
			type={presentation.modalType}
			className={presentation.className}
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
