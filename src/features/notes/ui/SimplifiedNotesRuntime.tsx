import {
	createContext,
	useContext,
	type ReactNode,
} from "react";

export interface SimplifiedNotesProviderProps {
	simplifiedNotesEnabled: boolean;
	showAllCardNotes?: boolean;
	onShowAllCardNotesChange?: (showAll: boolean) => void;
	children?: ReactNode;
}

const CardNotesViewContext = createContext<{ showAll: boolean; setShowAll: (value: boolean) => void }>({ showAll: true, setShowAll: () => {} });

const SimplifiedNotesContext = createContext<boolean | null>(null);

export function SimplifiedNotesProvider({
	simplifiedNotesEnabled,
	showAllCardNotes = true,
	onShowAllCardNotesChange = () => {},
	children,
}: SimplifiedNotesProviderProps) {
	return (
		<SimplifiedNotesContext.Provider value={simplifiedNotesEnabled}>
			<CardNotesViewContext.Provider value={{ showAll: showAllCardNotes, setShowAll: onShowAllCardNotesChange }}>
			{children}
			</CardNotesViewContext.Provider>
		</SimplifiedNotesContext.Provider>
	);
}

export function useSimplifiedNotesEnabled(): boolean {
	const simplifiedNotesEnabled = useContext(SimplifiedNotesContext);
	if (simplifiedNotesEnabled === null) {
		throw new Error(
			"SimplifiedNotesProvider is required to render note presentation",
		);
	}
	return simplifiedNotesEnabled;
}

export function useCardNotesViewMode() { return useContext(CardNotesViewContext); }
