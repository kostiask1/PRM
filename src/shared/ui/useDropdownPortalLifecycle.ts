import {
	type Dispatch,
	type RefObject,
	type SetStateAction,
	useEffect,
} from "react";

export interface DropdownPortalLifecycleOptions<
	TriggerElement extends HTMLElement,
	DropdownElement extends HTMLElement,
> {
	isOpen: boolean;
	triggerRef: RefObject<TriggerElement | null>;
	dropdownRef: RefObject<DropdownElement | null>;
	setIsOpen: Dispatch<SetStateAction<boolean>>;
	updatePosition: () => void;
}

export function useDropdownPortalLifecycle<
	TriggerElement extends HTMLElement,
	DropdownElement extends HTMLElement,
>({
	isOpen,
	triggerRef,
	dropdownRef,
	setIsOpen,
	updatePosition,
}: DropdownPortalLifecycleOptions<TriggerElement, DropdownElement>): void {
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node | null;
			const clickedInsideTrigger = triggerRef.current?.contains(target);
			const clickedInsideDropdown = dropdownRef.current?.contains(target);
			if (!clickedInsideTrigger && !clickedInsideDropdown) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [dropdownRef, setIsOpen, triggerRef]);

	useEffect(() => {
		if (!isOpen) return;
		updatePosition();
		window.addEventListener("resize", updatePosition);
		window.addEventListener("scroll", updatePosition, true);
		return () => {
			window.removeEventListener("resize", updatePosition);
			window.removeEventListener("scroll", updatePosition, true);
		};
	}, [isOpen, updatePosition]);
}
