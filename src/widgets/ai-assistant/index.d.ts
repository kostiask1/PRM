import type { BestiaryMonster } from "../../entities/bestiary/api/bestiaryApi.ts";

export interface AiAssistantPanelProps {
	isBestiary?: boolean;
	onRegisterImagePromptAction?: (
		handler: ((monster: BestiaryMonster) => void) | null,
	) => void;
}

export { default as AiAssistantPanel } from "./ui/AiAssistantPanel.jsx";
