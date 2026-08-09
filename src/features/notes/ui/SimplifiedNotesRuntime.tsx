import {
	createContext,
	useContext,
	type ReactNode,
} from "react";

export interface SimplifiedNotesProviderProps {
	simplifiedNotesEnabled: boolean;
	children?: ReactNode;
}

const SimplifiedNotesContext = createContext<boolean | null>(null);

export function SimplifiedNotesProvider({
	simplifiedNotesEnabled,
	children,
}: SimplifiedNotesProviderProps) {
	return (
		<SimplifiedNotesContext.Provider value={simplifiedNotesEnabled}>
			{children}
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
