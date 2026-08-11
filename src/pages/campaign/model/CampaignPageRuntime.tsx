import { createContext, useContext, type ReactNode } from "react";

import type { CampaignSyncEvent } from "./contracts.ts";

export interface CampaignPageMessage extends Record<string, unknown> {
	message: string;
	title: string;
}

export interface CampaignPagePrompt extends CampaignPageMessage {
	defaultValue?: unknown;
}

export interface CampaignGraphNoteModalConfig extends Record<string, unknown> {
	children: ReactNode;
	showFooter: false;
	title: string;
	type: "note";
}

export interface CampaignPageRuntime {
	activeCampaign: unknown;
	currentLanguage: string;
	entityRefreshVersion: number;
	navigateToCampaignList(): void;
	navigateToRenamedCampaign(campaignSlug: string): void;
	navigateToSession(campaignSlug: string, sessionFileName: string): void;
	openModal(config: CampaignGraphNoteModalConfig): Promise<unknown>;
	requestCampaignReload(): void;
	requestConfirmation(copy: CampaignPageMessage): Promise<unknown>;
	requestPrompt(copy: CampaignPagePrompt): Promise<unknown>;
	showMessage(message: CampaignPageMessage): void;
	syncEvent: CampaignSyncEvent | null;
	theme: "light" | "dark";
}

export interface CampaignPageRuntimeProviderProps {
	runtime: CampaignPageRuntime;
	children?: ReactNode;
}

const CampaignPageRuntimeContext = createContext<CampaignPageRuntime | null>(
	null,
);

export function CampaignPageRuntimeProvider({
	runtime,
	children,
}: CampaignPageRuntimeProviderProps) {
	return (
		<CampaignPageRuntimeContext.Provider value={runtime}>
			{children}
		</CampaignPageRuntimeContext.Provider>
	);
}

export function useCampaignPageRuntime(): CampaignPageRuntime {
	const runtime = useContext(CampaignPageRuntimeContext);
	if (runtime === null) {
		throw new Error(
			"CampaignPageRuntimeProvider is required to render campaign controls",
		);
	}
	return runtime;
}
