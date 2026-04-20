import { createContext, useContext } from "react";

export const ModalContext = createContext(null);

export function useModal() {
	const modal = useContext(ModalContext);
	if (!modal) {
		throw new Error("useModal must be used within ModalContext.Provider");
	}
	return modal;
}

