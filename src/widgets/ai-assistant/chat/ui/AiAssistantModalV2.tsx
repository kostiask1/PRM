import { useEffect } from "react";
import type { AiResponseModalComponent } from "../../../../features/ai/ui/index.js";
import type { useAiChatState } from "../model/useAiChatState.ts";
import AiAssistantPanelV2 from "./AiAssistantPanelV2.tsx";

interface AiAssistantModalV2Props {
	isOpen: boolean;
	onClose: () => void;
	state: ReturnType<typeof useAiChatState>;
	ResponseModal?: AiResponseModalComponent;
}

export default function AiAssistantModalV2({
	isOpen,
	onClose,
	state,
	ResponseModal,
}: AiAssistantModalV2Props) {
	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	return (
		<div className="AiAssistantModalOverlayV2">
			<div className="AiAssistantModalOverlayV2__backdrop" onClick={onClose} />
			<div className="AiAssistantModalOverlayV2__drawer">
				<AiAssistantPanelV2 state={state} onClose={onClose} ResponseModal={ResponseModal} />
			</div>
		</div>
	);
}
