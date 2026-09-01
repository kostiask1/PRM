import { createContext, useContext, type ReactNode } from "react";

import type { PlayerQuestionsDiceRollRequest } from "../../../features/player-questions/index.js";
import type { SettingsModalRuntime } from "../../../features/settings/ui/index.js";

export interface SidebarModalConfig extends Record<string, unknown> {
	children: ReactNode;
	className?: string;
	showFooter: false;
	title: string;
	type: "confirm";
}

export interface SidebarErrorNotice extends Record<string, unknown> {
	message: string;
	title: string;
}

export interface SidebarRulesReferenceNavigationOptions {
	forceTab?: boolean;
}

export interface SidebarRuntime extends Pick<
		SettingsModalRuntime,
		| "activeCampaignSlug"
		| "autoApplyAiChanges"
		| "availableLanguages"
		| "currentLanguage"
		| "currentTheme"
		| "patchUiSettings"
		| "setCampaigns"
		| "setLanguage"
		| "simplifiedNotesEnabled"
		| "storedAiBasePrompt"
		| "storedCampaignAiBasePrompts"
		| "storedCampaignImagePromptBasePrompts"
		| "storedCampaigns"
		| "storedIgnoreSourcesList"
		| "storedImagePromptBasePrompt"
		| "useSearchDebounce"
	> {
	activeEncounterId: string | number | null;
	activeSessionFileName: string | null;
	closeModal(value?: unknown): void;
	openModal(config: SidebarModalConfig): Promise<unknown>;
	reportError(error: SidebarErrorNotice): void;
	requestDiceRoll(request: PlayerQuestionsDiceRollRequest): void;
	requestRulesReferenceNavigation(
		tab: string,
		name: string,
		options: SidebarRulesReferenceNavigationOptions,
	): void;
	rolledResult: unknown;
	syncEvent: { version?: string | number | null } | null;
}

export interface SidebarRuntimeProviderProps {
	runtime: SidebarRuntime;
	children?: ReactNode;
}

const SidebarRuntimeContext = createContext<SidebarRuntime | null>(null);

export function SidebarRuntimeProvider({
	runtime,
	children,
}: SidebarRuntimeProviderProps) {
	return (
		<SidebarRuntimeContext.Provider value={runtime}>
			{children}
		</SidebarRuntimeContext.Provider>
	);
}

export function useSidebarRuntime(): SidebarRuntime {
	const runtime = useContext(SidebarRuntimeContext);
	if (runtime === null) {
		throw new Error(
			"SidebarRuntimeProvider is required to render sidebar controls",
		);
	}
	return runtime;
}
