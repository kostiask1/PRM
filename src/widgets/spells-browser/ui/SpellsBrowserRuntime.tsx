import { createContext, useContext, type ReactNode } from "react";

import type { CampaignRecord } from "../../../entities/campaign/index.js";

export interface SpellsBrowserErrorNotice extends Record<string, unknown> {
	message: string;
	title: string;
}

export interface SpellsBrowserRuntime {
	useSearchDebounce: boolean;
	activeCampaignSlug: string | null;
	activeCampaign: unknown | null;
	globalIgnoreSourcesList: string[];
	replaceCampaigns(campaigns: CampaignRecord[]): void;
	setGlobalIgnoreSourcesList(ignoreSourcesList: string[]): void;
	reportError(error: SpellsBrowserErrorNotice): void;
}

export interface SpellsBrowserRuntimeProviderProps {
	runtime: SpellsBrowserRuntime;
	children?: ReactNode;
}

const SpellsBrowserRuntimeContext =
	createContext<SpellsBrowserRuntime | null>(null);

export function SpellsBrowserRuntimeProvider({
	runtime,
	children,
}: SpellsBrowserRuntimeProviderProps) {
	return (
		<SpellsBrowserRuntimeContext.Provider value={runtime}>
			{children}
		</SpellsBrowserRuntimeContext.Provider>
	);
}

export function useSpellsBrowserRuntime(): SpellsBrowserRuntime {
	const runtime = useContext(SpellsBrowserRuntimeContext);
	if (runtime === null) {
		throw new Error(
			"SpellsBrowserRuntimeProvider is required to render spells browser controls",
		);
	}
	return runtime;
}
