import { Modal } from "../../../../shared/ui/index.js";
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
	if (!isOpen) return null;

	return (
		<Modal
			title="AI-асистент"
			onConfirm={() => {}}
			onCancel={onClose}
			showFooter={false}
			type="custom"
			className="AiAssistantModalV2__card"
			overlayClassName="AiAssistantModalOverlayV2"
		>
			<AiAssistantPanelV2 state={state} onClose={onClose} ResponseModal={ResponseModal} />
		</Modal>
	);
}
