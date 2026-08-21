import { useEffect, type RefObject } from "react";

export function useEncounterHeaderDismissal(
	isOpen: boolean,
	actionsRef: RefObject<HTMLDivElement | null>,
	onClose: () => void,
) {
	useEffect(() => {
		if (!isOpen) return undefined;
		const handlePointerDown = (event: PointerEvent) => {
			if (!actionsRef.current?.contains(event.target as Node)) onClose();
		};
		document.addEventListener("pointerdown", handlePointerDown);
		return () => document.removeEventListener("pointerdown", handlePointerDown);
	}, [isOpen, onClose]);
}
