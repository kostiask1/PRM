import { createContext, useContext, type ReactNode } from "react";

export interface MonsterStatBlockModalConfig extends Record<string, unknown> {
	children: ReactNode;
	showFooter: false;
	title: string;
	type: "confirm";
}

export interface MonsterStatBlockErrorNotice extends Record<string, unknown> {
	message: string;
	title: string;
}

export interface MonsterStatBlockRuntime {
	campaigns: unknown[];
	openModal(config: MonsterStatBlockModalConfig): Promise<unknown>;
	reportError(error: MonsterStatBlockErrorNotice): void;
	requestCampaignsReload(): void;
	closeModal(value: boolean): void;
	requestDiceRoll(formula: string): void;
}

export interface MonsterStatBlockRuntimeProviderProps {
	runtime: MonsterStatBlockRuntime;
	children?: ReactNode;
}

const MonsterStatBlockRuntimeContext =
	createContext<MonsterStatBlockRuntime | null>(null);

export function MonsterStatBlockRuntimeProvider({
	runtime,
	children,
}: MonsterStatBlockRuntimeProviderProps) {
	return (
		<MonsterStatBlockRuntimeContext.Provider value={runtime}>
			{children}
		</MonsterStatBlockRuntimeContext.Provider>
	);
}

export function useMonsterStatBlockRuntime(): MonsterStatBlockRuntime {
	const runtime = useContext(MonsterStatBlockRuntimeContext);
	if (runtime === null) {
		throw new Error(
			"MonsterStatBlockRuntimeProvider is required to render monster stat block controls",
		);
	}
	return runtime;
}
