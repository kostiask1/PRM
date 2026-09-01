import type { ReactNode } from "react";

import { lang } from "../../../../shared/lib/index.js";
import { Modal } from "../../../../shared/ui/index.js";
import type { EncounterViewParticipant } from "../../model/contracts.ts";

interface EncounterBestiaryOverlayProps {
	open: boolean;
	onClose: () => void;
	onAdd: (monster: EncounterViewParticipant) => void;
	renderBestiary: (
		onAdd: EncounterBestiaryOverlayProps["onAdd"],
	) => ReactNode;
}

export default function EncounterBestiaryOverlay({
	open,
	onClose,
	onAdd,
	renderBestiary,
}: EncounterBestiaryOverlayProps) {
	if (!open) return null;
	return (
		<Modal
			onConfirm={() => {}}
			title={lang.t("Choose monster")}
			onCancel={onClose}
			showFooter={false}
			type="custom"
		>
			{renderBestiary(onAdd)}
		</Modal>
	);
}
