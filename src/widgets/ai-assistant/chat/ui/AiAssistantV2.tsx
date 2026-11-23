import "../../../../assets/components/AiAssistantV2.css";
import type { AiResponseModalComponent } from "../../../../features/ai/ui/index.js";
import { useAiChatLayout } from "../model/useAiChatLayout.ts";
import { useAiChatState } from "../model/useAiChatState.ts";
import AiAssistantPanelV2 from "./AiAssistantPanelV2.tsx";
import AiCollapsedRailV2 from "./AiCollapsedRailV2.tsx";
import AiFloatingTriggerV2 from "./AiFloatingTriggerV2.tsx";
import AiAssistantModalV2 from "./AiAssistantModalV2.tsx";

interface AiAssistantV2Props {
	campaignTitle?: string;
	sessionTitle?: string;
	sceneTitle?: string;
	onOpenBestiaryCreature?: (name: string) => void;
	ResponseModal?: AiResponseModalComponent;
}

export default function AiAssistantV2({
	campaignTitle,
	sessionTitle,
	sceneTitle,
	onOpenBestiaryCreature,
	ResponseModal,
}: AiAssistantV2Props) {
	const layout = useAiChatLayout();
	const chatState = useAiChatState({
		campaignTitle,
		sessionTitle,
		sceneTitle,
	});

	const {
		isDesktop,
		isCollapsed,
		isMobileOpen,
		expandDesktop,
		collapseDesktop,
		openMobile,
		closeMobile,
	} = layout;

	if (isDesktop) {
		if (isCollapsed) {
			return <AiCollapsedRailV2 onExpand={expandDesktop} />;
		}

		return (
			<aside className="AiAssistantSidebarV2">
				<AiAssistantPanelV2
					state={chatState}
					onClose={collapseDesktop}
					onOpenBestiaryCreature={onOpenBestiaryCreature}
					ResponseModal={ResponseModal}
				/>
			</aside>
		);
	}

	// Mobile and narrower viewports (<= 1400px)
	return (
		<>
			{!isMobileOpen && <AiFloatingTriggerV2 onClick={openMobile} isOpen={false} />}
			<AiAssistantModalV2
				isOpen={isMobileOpen}
				onClose={closeMobile}
				state={chatState}
				onOpenBestiaryCreature={onOpenBestiaryCreature}
				ResponseModal={ResponseModal}
			/>
		</>
	);
}
