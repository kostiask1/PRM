import {
	createContext,
	useContext,
	type ReactNode,
} from "react";

export interface CampaignSearchRuntime {
	activeCampaign: unknown | null;
	navigateTo(
		campaignSlug: string,
		sessionFileName: string | null,
		encounterId: string | number | null,
	): void;
}

export interface CampaignSearchRuntimeProviderProps {
	runtime: CampaignSearchRuntime;
	children?: ReactNode;
}

const CampaignSearchRuntimeContext =
	createContext<CampaignSearchRuntime | null>(null);

export function CampaignSearchRuntimeProvider({
	runtime,
	children,
}: CampaignSearchRuntimeProviderProps) {
	return (
		<CampaignSearchRuntimeContext.Provider value={runtime}>
			{children}
		</CampaignSearchRuntimeContext.Provider>
	);
}

export function useCampaignSearchRuntime(): CampaignSearchRuntime {
	const runtime = useContext(CampaignSearchRuntimeContext);
	if (runtime === null) {
		throw new Error(
			"CampaignSearchRuntimeProvider is required to render campaign search",
		);
	}
	return runtime;
}
