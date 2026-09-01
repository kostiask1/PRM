import {
	useEffect,
	type Dispatch,
	type RefObject,
	type SetStateAction,
} from "react";

interface PointerDownOutsideDismissalOptions {
	containerRef: RefObject<HTMLElement | null>;
	isOpen: boolean;
	setIsOpen: Dispatch<SetStateAction<boolean>>;
}

export function usePointerDownOutsideDismissal({
	containerRef,
	isOpen,
	setIsOpen,
}: PointerDownOutsideDismissalOptions): void {
	useEffect(() => {
		if (!isOpen) return undefined;

		const handlePointerDown = (event: PointerEvent) => {
			if (
				event.target instanceof Node &&
				containerRef.current?.contains(event.target)
			) return;
			setIsOpen(false);
		};

		document.addEventListener("pointerdown", handlePointerDown);
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
		};
	}, [containerRef, isOpen, setIsOpen]);
}
