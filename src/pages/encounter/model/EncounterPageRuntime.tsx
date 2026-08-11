import { createContext, useContext, type ReactNode } from "react";

import type { EncounterSyncEvent } from "./contracts.ts";

export interface EncounterPageActiveCampaign {
	slug: string;
}

export interface EncounterPageMessage extends Record<string, unknown> {
	message: string;
	title: string;
}

export interface EncounterPagePrompt extends EncounterPageMessage {
	defaultValue?: unknown;
}

export interface EncounterPageDiceResult {
	resultId?: string | number;
	result?: { total?: unknown };
	context?: {
		kind?: string;
		campaignSlug?: string;
		sessionId?: string;
		encounterId?: string;
		instanceId?: string;
	};
}

export interface EncounterPageDiceRollRequest {
	formula: string;
	context: {
		kind: "encounter_hp";
		campaignSlug: string;
		sessionId: string;
		encounterId: string;
		instanceId: string;
	};
}

export interface EncounterPageUiSettingsPatch {
	encounterViewMode?: "grid" | "single";
	encounterGridColumns?: number;
}

export interface EncounterPageRuntime {
	activeCampaign: EncounterPageActiveCampaign;
	activeEncounterId: string | number | null;
	activeSessionFileName: string | null;
	currentLanguage: string;
	diceRolledResult: EncounterPageDiceResult | null;
	encounterGridColumns: unknown;
	encounterViewMode: unknown;
	navigateToSession(campaignSlug: string, sessionFileName: string): void;
	patchUiSettings(patch: EncounterPageUiSettingsPatch): void;
	refreshEntities(): void;
	requestCampaignReload(): void;
	requestDiceRoll(request: EncounterPageDiceRollRequest): void;
	requestPrompt(copy: EncounterPagePrompt): Promise<unknown>;
	setActiveEncounter(encounter: unknown): void;
	setActiveSession(session: unknown): void;
	showMessage(message: EncounterPageMessage): void;
	syncEvent: EncounterSyncEvent | null;
	theme: "light" | "dark";
}

export interface EncounterPageRuntimeProviderProps {
	runtime: EncounterPageRuntime;
	children?: ReactNode;
}

const EncounterPageRuntimeContext = createContext<EncounterPageRuntime | null>(
	null,
);

export function EncounterPageRuntimeProvider({
	runtime,
	children,
}: EncounterPageRuntimeProviderProps) {
	return (
		<EncounterPageRuntimeContext.Provider value={runtime}>
			{children}
		</EncounterPageRuntimeContext.Provider>
	);
}

export function useEncounterPageRuntime(): EncounterPageRuntime {
	const runtime = useContext(EncounterPageRuntimeContext);
	if (runtime === null) {
		throw new Error(
			"EncounterPageRuntimeProvider is required to render encounter controls",
		);
	}
	return runtime;
}
