import {
	createContext,
	useContext,
	type ReactNode,
} from "react";

import type { DiceRollPayload } from "../model.ts";

export interface DiceRequestRuntime {
	requestRoll(payload: DiceRollPayload): void;
}

export interface DiceRequestRuntimeProviderProps {
	runtime: DiceRequestRuntime;
	children?: ReactNode;
}

const DiceRequestRuntimeContext = createContext<DiceRequestRuntime | null>(null);

export function DiceRequestRuntimeProvider({
	runtime,
	children,
}: DiceRequestRuntimeProviderProps) {
	return (
		<DiceRequestRuntimeContext.Provider value={runtime}>
			{children}
		</DiceRequestRuntimeContext.Provider>
	);
}

export function useDiceRequestRuntime(): DiceRequestRuntime {
	const runtime = useContext(DiceRequestRuntimeContext);
	if (runtime === null) {
		throw new Error(
			"DiceRequestRuntimeProvider is required to render dice controls",
		);
	}
	return runtime;
}
