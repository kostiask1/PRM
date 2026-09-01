import {
	createContext,
	useContext,
	type ReactNode,
} from "react";

import type { RulesReferenceNavigationTarget } from "../model.js";

export interface RulesReferenceErrorNotice extends Record<string, unknown> {
	title: string;
	message: string;
}

export interface RulesReferenceRuntime {
	navigate(
		tab: RulesReferenceNavigationTarget["tab"],
		name: string,
	): void;
	reportError(error: RulesReferenceErrorNotice): void;
}

export interface RulesReferenceRuntimeProviderProps {
	runtime: RulesReferenceRuntime;
	children?: ReactNode;
}

const RulesReferenceRuntimeContext =
	createContext<RulesReferenceRuntime | null>(null);

export function RulesReferenceRuntimeProvider({
	runtime,
	children,
}: RulesReferenceRuntimeProviderProps) {
	return (
		<RulesReferenceRuntimeContext.Provider value={runtime}>
			{children}
		</RulesReferenceRuntimeContext.Provider>
	);
}

export function useRulesReferenceRuntime(): RulesReferenceRuntime {
	const runtime = useContext(RulesReferenceRuntimeContext);
	if (runtime === null) {
		throw new Error(
			"RulesReferenceRuntimeProvider is required to render rules-reference controls",
		);
	}
	return runtime;
}
