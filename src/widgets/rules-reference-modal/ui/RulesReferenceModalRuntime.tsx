import { createContext, useContext, type ReactNode } from "react";

export interface RulesReferenceModalNavigationRequest {
	requestId: number;
	tabId: string;
	name: string;
	forceTab: boolean;
}

export interface RulesReferenceModalHistoryEntry {
	tabId: string;
	name: string;
}

export interface RulesReferenceModalNavigationHistory {
	entries: RulesReferenceModalHistoryEntry[];
	index: number;
}

export interface RulesReferenceModalOpenConfig extends Record<string, unknown> {
	children: ReactNode;
	showFooter: false;
	title: string;
	type: "custom";
}

export interface RulesReferenceModalErrorNotice extends Record<string, unknown> {
	message: string;
	title: string;
}

export interface RulesReferenceModalRuntime {
	navigationRequest: RulesReferenceModalNavigationRequest | null;
	navigationHistory: RulesReferenceModalNavigationHistory;
	isOpen: boolean;
	openModal(config: RulesReferenceModalOpenConfig): Promise<unknown>;
	reportError(error: RulesReferenceModalErrorNotice): void;
	setModalOpen(isOpen: boolean): void;
	recordHistoryEntry(tabId: string, name: string): void;
	setHistoryIndex(index: number): void;
}

export interface RulesReferenceModalRuntimeProviderProps {
	runtime: RulesReferenceModalRuntime;
	children?: ReactNode;
}

const RulesReferenceModalRuntimeContext =
	createContext<RulesReferenceModalRuntime | null>(null);

export function RulesReferenceModalRuntimeProvider({
	runtime,
	children,
}: RulesReferenceModalRuntimeProviderProps) {
	return (
		<RulesReferenceModalRuntimeContext.Provider value={runtime}>
			{children}
		</RulesReferenceModalRuntimeContext.Provider>
	);
}

export function useRulesReferenceModalRuntime(): RulesReferenceModalRuntime {
	const runtime = useContext(RulesReferenceModalRuntimeContext);
	if (runtime === null) {
		throw new Error(
			"RulesReferenceModalRuntimeProvider is required to render rules-reference modal controls",
		);
	}
	return runtime;
}
