import { createContext, useContext, type ReactNode } from "react";

export interface AiAssistantNavigation {
	activeCampaignSlug: string | null;
	activeEncounterId: string | number | null;
	activeSessionFileName: string | null;
}

export interface AiAssistantMessage extends Record<string, unknown> {
	message: string;
	title: string;
}

export interface AiAssistantRuntime {
	activeCampaign: unknown | null;
	activeEncounter: unknown | null;
	activeSession: unknown | null;
	campaignAiBasePrompts: Record<string, string>;
	campaignImagePromptBasePrompts: Record<string, string>;
	currentLanguage: string;
	globalAiBasePrompt: string;
	imagePromptBasePrompt: string;
	navigation: AiAssistantNavigation;
	publishSyncEvent(event: Record<string, unknown>): void;
	refreshEntities(): void;
	requestCampaignReload(): void;
	requestConfirmation(copy: AiAssistantMessage): Promise<unknown>;
	setActiveCampaign(campaign: unknown): void;
	setActiveEncounter(encounter: unknown): void;
	setActiveSession(session: unknown): void;
	showMessage(message: AiAssistantMessage): void;
}

export interface AiAssistantRuntimeProviderProps {
	runtime: AiAssistantRuntime;
	children?: ReactNode;
}

const AiAssistantRuntimeContext = createContext<AiAssistantRuntime | null>(
	null,
);

export function AiAssistantRuntimeProvider({
	runtime,
	children,
}: AiAssistantRuntimeProviderProps) {
	return (
		<AiAssistantRuntimeContext.Provider value={runtime}>
			{children}
		</AiAssistantRuntimeContext.Provider>
	);
}

export function useAiAssistantRuntime(): AiAssistantRuntime {
	const runtime = useContext(AiAssistantRuntimeContext);
	if (runtime === null) {
		throw new Error(
			"AiAssistantRuntimeProvider is required to render AI assistant controls",
		);
	}
	return runtime;
}
