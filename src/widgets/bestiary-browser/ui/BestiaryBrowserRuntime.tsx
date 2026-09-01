import { createContext, useContext, type ReactNode } from "react";

import type { CampaignSourceSettings } from "../../../entities/reference/index.js";

export interface BestiaryBrowserConfirmation extends Record<string, unknown> {
	message: string;
	title: string;
}

export interface BestiaryBrowserMessage extends Record<string, unknown> {
	message: string;
	title: string;
}

export interface BestiaryBrowserRuntime {
	activeCampaign: CampaignSourceSettings | null;
	activeCampaignSlug: string | null;
	currentLanguage: string;
	globalIgnoreSourcesList: string[];
	requestConfirmation(
		copy: BestiaryBrowserConfirmation,
	): Promise<unknown>;
	replaceCampaigns(campaigns: unknown[]): void;
	showMessage(message: BestiaryBrowserMessage): void;
	setGlobalIgnoreSourcesList(ignoreSourcesList: string[]): void;
	syncEvent: unknown;
	useSearchDebounce: boolean;
}

export interface BestiaryBrowserRuntimeProviderProps {
	runtime: BestiaryBrowserRuntime;
	children?: ReactNode;
}

const BestiaryBrowserRuntimeContext =
	createContext<BestiaryBrowserRuntime | null>(null);

export function BestiaryBrowserRuntimeProvider({
	runtime,
	children,
}: BestiaryBrowserRuntimeProviderProps) {
	return (
		<BestiaryBrowserRuntimeContext.Provider value={runtime}>
			{children}
		</BestiaryBrowserRuntimeContext.Provider>
	);
}

export function useBestiaryBrowserRuntime(): BestiaryBrowserRuntime {
	const runtime = useContext(BestiaryBrowserRuntimeContext);
	if (runtime === null) {
		throw new Error(
			"BestiaryBrowserRuntimeProvider is required to render bestiary controls",
		);
	}
	return runtime;
}
