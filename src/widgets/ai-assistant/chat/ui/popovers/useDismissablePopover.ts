import { useEffect, type RefObject } from "react";

interface UseDismissablePopoverOptions {
	isOpen: boolean;
	popoverRef: RefObject<HTMLElement | null>;
	triggerSelector: string;
	onClose: () => void;
}

/** Dismisses an open popover on outside pointer clicks (capture phase) or Escape, while sparing its trigger button so click toggles cleanly. */
export function useDismissablePopover({
	isOpen,
	popoverRef,
	triggerSelector,
	onClose,
}: UseDismissablePopoverOptions): void {
	useEffect(() => {
		if (!isOpen) return;

		const handlePointerDown = (event: MouseEvent) => {
			const target = event.target as Node | null;
			if (popoverRef.current && target && popoverRef.current.contains(target)) {
				return;
			}
			const element = target instanceof Element ? target : target?.parentElement ?? null;
			if (triggerSelector && element?.closest(triggerSelector)) {
				return;
			}
			onClose();
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				onClose();
			}
		};

		document.addEventListener("mousedown", handlePointerDown, true);
		document.addEventListener("keydown", handleKeyDown, true);
		return () => {
			document.removeEventListener("mousedown", handlePointerDown, true);
			document.removeEventListener("keydown", handleKeyDown, true);
		};
	}, [isOpen, popoverRef, triggerSelector, onClose]);
}
