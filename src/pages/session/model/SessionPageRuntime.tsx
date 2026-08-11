import { createContext, useContext, type ReactNode } from "react";

import type { SessionSyncEvent } from "./contracts.ts";

export interface SessionPageActiveCampaign {
	slug: string;
}

export interface SessionPageMessage extends Record<string, unknown> {
	message: string;
	title: string;
}

export interface SessionPagePrompt extends SessionPageMessage {
	defaultValue?: unknown;
}

export interface SessionPageRuntime {
	activeCampaign: SessionPageActiveCampaign;
	activeSessionFileName: string | null;
	navigateToCampaign(campaignSlug: string): void;
	navigateToEncounter(
		campaignSlug: string,
		sessionFileName: string | null,
		encounterId: string | number,
		openInNewTab: boolean,
	): void;
	navigateToSession(
		campaignSlug: string,
		sessionFileName: string,
		replace: boolean,
	): void;
	refreshEntities(): void;
	requestCampaignReload(): void;
	requestConfirmation(copy: SessionPageMessage): Promise<unknown>;
	requestPrompt(copy: SessionPagePrompt): Promise<unknown>;
	setActiveSession(session: unknown): void;
	showMessage(message: SessionPageMessage): void;
	syncEvent: SessionSyncEvent | null;
}

export interface SessionPageRuntimeProviderProps {
	runtime: SessionPageRuntime;
	children?: ReactNode;
}

const SessionPageRuntimeContext = createContext<SessionPageRuntime | null>(
	null,
);

export function SessionPageRuntimeProvider({
	runtime,
	children,
}: SessionPageRuntimeProviderProps) {
	return (
		<SessionPageRuntimeContext.Provider value={runtime}>
			{children}
		</SessionPageRuntimeContext.Provider>
	);
}

export function useSessionPageRuntime(): SessionPageRuntime {
	const runtime = useContext(SessionPageRuntimeContext);
	if (runtime === null) {
		throw new Error(
			"SessionPageRuntimeProvider is required to render session controls",
		);
	}
	return runtime;
}
