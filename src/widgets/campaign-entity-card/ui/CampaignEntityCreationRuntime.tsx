import {
	createContext,
	useContext,
	type ReactNode,
} from "react";

export interface CampaignEntityCreationError extends Record<string, unknown> {
	message: string;
	title: string;
}

export interface CampaignEntityCreationRuntime {
	notifyError(payload: CampaignEntityCreationError): void;
	refreshEntities(): void;
}

export interface CampaignEntityCreationRuntimeProviderProps {
	runtime: CampaignEntityCreationRuntime;
	children?: ReactNode;
}

const CampaignEntityCreationRuntimeContext =
	createContext<CampaignEntityCreationRuntime | null>(null);

export function CampaignEntityCreationRuntimeProvider({
	runtime,
	children,
}: CampaignEntityCreationRuntimeProviderProps) {
	return (
		<CampaignEntityCreationRuntimeContext.Provider value={runtime}>
			{children}
		</CampaignEntityCreationRuntimeContext.Provider>
	);
}

export function useCampaignEntityCreationRuntime(): CampaignEntityCreationRuntime {
	const runtime = useContext(CampaignEntityCreationRuntimeContext);
	if (runtime === null) {
		throw new Error(
			"CampaignEntityCreationRuntimeProvider is required to render creation controls",
		);
	}
	return runtime;
}
