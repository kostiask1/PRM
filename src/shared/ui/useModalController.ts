import {
	type MouseEvent as ReactMouseEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	executeModalClose,
	executeModalKeyboardPlan,
	getModalFocusTarget,
	getModalKeyboardPlan,
	resolveModalConfirmValue,
	type ModalProps,
} from "./modalModel.ts";

type ControlledMouseEvent = Pick<
	ReactMouseEvent<HTMLElement>,
	"preventDefault" | "stopPropagation"
>;

type OverlayMouseEvent = ControlledMouseEvent &
	Pick<ReactMouseEvent<HTMLElement>, "currentTarget" | "target">;

export function getTopModal(): HTMLElement | null {
	const dialogs = document.querySelectorAll<HTMLElement>(".Modal__card[role='dialog']");
	let top: HTMLElement | null = null;
	let topLayer = -Infinity;
	for (const dialog of dialogs) {
		const overlay = dialog.closest<HTMLElement>(".Modal__overlay");
		if (!overlay) continue;
		const layer = Number.parseFloat(window.getComputedStyle(overlay).zIndex);
		const resolvedLayer = Number.isFinite(layer) ? layer : 0;
		if (resolvedLayer >= topLayer) {
			top = dialog;
			topLayer = resolvedLayer;
		}
	}
	return top;
}

function isTopModal(card: HTMLElement | null): boolean {
	return Boolean(card && getTopModal() === card);
}

function useModalFocusBoundary(cardRef: React.RefObject<HTMLDivElement | null>): void {
	useEffect(() => {
		const card = cardRef.current;
		if (!card) return;
		const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		if (isTopModal(card) && !card.contains(document.activeElement)) card.focus({ preventScroll: true });
		const handleTab = (event: KeyboardEvent) => {
			if (event.key !== "Tab" || event.defaultPrevented || !isTopModal(card)) return;
			const portals = Array.from(document.querySelectorAll<HTMLElement>("[data-modal-owner]"))
				.filter((element) => element.dataset.modalOwner === card.id);
			const focusable = [card, ...portals].flatMap((root) => Array.from(root.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]',
			))).filter((element) => !element.closest('[inert], [aria-hidden="true"]') && element.getClientRects().length > 0);
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (!first || !last) {
				event.preventDefault();
				card.focus();
			} else if (document.activeElement === card || ![card, ...portals].some((root) => root.contains(document.activeElement)) || (event.shiftKey && document.activeElement === first)) {
				event.preventDefault();
				(event.shiftKey ? last : first).focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};
		window.addEventListener("keydown", handleTab);
		return () => {
			window.removeEventListener("keydown", handleTab);
			queueMicrotask(() => {
				const top = getTopModal();
				if (!top) return;
				const active = document.activeElement;
				const portal = active instanceof Element ? active.closest("[data-modal-owner]") : null;
				if (!top.contains(active) && portal?.getAttribute("data-modal-owner") !== top.id) {
					top.focus({ preventScroll: true });
				}
			});
			if (!previousFocus?.isConnected) return;
			const top = getTopModal();
			const previousPortal = previousFocus.closest("[data-modal-owner]");
			if (top && top !== card && !top.contains(previousFocus) && previousPortal?.getAttribute("data-modal-owner") !== top.id) return;
			previousFocus.focus({ preventScroll: true });
		};
	}, [cardRef]);
}

function blurActiveElement(): void {
	const activeElement = document.activeElement;
	if (
		activeElement &&
		"blur" in activeElement &&
		typeof activeElement.blur === "function"
	) {
		activeElement.blur();
	}
}

function suppressMouseEvent(event: ControlledMouseEvent): void {
	event.preventDefault();
	event.stopPropagation();
}

function useModalInitialFocus({
	hasChildren,
	showInput,
	inputRef,
	confirmButtonRef,
	cardRef,
}: {
	hasChildren: boolean;
	showInput: boolean;
	inputRef: React.RefObject<HTMLInputElement | null>;
	confirmButtonRef: React.RefObject<HTMLButtonElement | null>;
	cardRef: React.RefObject<HTMLDivElement | null>;
}): void {
	useEffect(() => {
		if (!isTopModal(cardRef.current)) return;
		const focusTarget = getModalFocusTarget(hasChildren, showInput);
		if (focusTarget === "input" && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
		if (focusTarget === "confirm" && confirmButtonRef.current) {
			confirmButtonRef.current.focus();
		}
	}, [cardRef, confirmButtonRef, hasChildren, inputRef, showInput]);
}

function useModalKeyboard({
	hasChildren,
	onClose,
	onConfirm,
	cardRef,
}: {
	hasChildren: boolean;
	onClose: () => void;
	onConfirm: () => void;
	cardRef: React.RefObject<HTMLDivElement | null>;
}): void {
	useEffect(() => {
		const handleGlobalKeyDown = (event: KeyboardEvent) => {
			if (!isTopModal(cardRef.current)) return;
			const portal = event.target instanceof Element ? event.target.closest("[data-modal-owner]") : null;
			if (portal?.getAttribute("data-modal-owner") === cardRef.current?.id) return;
			executeModalKeyboardPlan(
				getModalKeyboardPlan(event.key, event.defaultPrevented, hasChildren),
				{
					preventDefault: () => event.preventDefault(),
					onClose,
					onConfirm,
				},
			);
		};

		window.addEventListener("keydown", handleGlobalKeyDown);
		return () => window.removeEventListener("keydown", handleGlobalKeyDown);
	}, [cardRef, hasChildren, onClose, onConfirm]);
}

export function useModalController({
	defaultValue,
	onConfirm,
	onCancel,
	showInput,
	children,
	checkboxDefaultChecked,
	getConfirmValue,
	cancelDisabled,
}: Pick<
	ModalProps,
	| "defaultValue"
	| "onConfirm"
	| "onCancel"
	| "showInput"
	| "children"
	| "checkboxDefaultChecked"
	| "getConfirmValue"
	| "cancelDisabled"
>) {
	const [inputValue, setInputValue] = useState(defaultValue || "");
	const [checkboxValue, setCheckboxValue] = useState(
		Boolean(checkboxDefaultChecked),
	);
	const inputRef = useRef<HTMLInputElement>(null);
	const confirmButtonRef = useRef<HTMLButtonElement>(null);
	const cardRef = useRef<HTMLDivElement>(null);
	const hasChildren = Boolean(children);
	const hasCancelHandler = Boolean(onCancel);

	const getResolvedConfirmValue = useCallback(
		() =>
			resolveModalConfirmValue({
				showInput: Boolean(showInput),
				inputValue,
				checkboxValue,
				getConfirmValue,
			}),
		[checkboxValue, getConfirmValue, inputValue, showInput],
	);

	const handleConfirm = useCallback(() => {
		onConfirm(getResolvedConfirmValue());
	}, [getResolvedConfirmValue, onConfirm]);

	const handleClose = useCallback(() => {
		executeModalClose({
			cancelDisabled: Boolean(cancelDisabled),
			onCancel,
			onConfirm: () => onConfirm(),
			blurActiveElement,
		});
	}, [cancelDisabled, onCancel, onConfirm]);

	const handleCloseWithEvent = useCallback(
		(event: ControlledMouseEvent) => {
			suppressMouseEvent(event);
			handleClose();
		},
		[handleClose],
	);

	const handleOverlayClick = useCallback(
		(event: OverlayMouseEvent) => {
			if (event.target !== event.currentTarget) return;
			handleCloseWithEvent(event);
		},
		[handleCloseWithEvent],
	);

	const handleOverlayMouseDown = useCallback((event: OverlayMouseEvent) => {
		if (event.target === event.currentTarget) event.preventDefault();
	}, []);

	const handleCloseButtonClick = useCallback(
		(event: ControlledMouseEvent) => {
			if (!hasCancelHandler) return;
			handleCloseWithEvent(event);
		},
		[handleCloseWithEvent, hasCancelHandler],
	);

	useModalFocusBoundary(cardRef);
	useModalInitialFocus({
		hasChildren,
		showInput: Boolean(showInput),
		inputRef,
		confirmButtonRef,
		cardRef,
	});
	useModalKeyboard({
		hasChildren,
		onClose: handleClose,
		onConfirm: handleConfirm,
		cardRef,
	});

	return {
		inputValue,
		setInputValue,
		checkboxValue,
		setCheckboxValue,
		inputRef,
		confirmButtonRef,
		cardRef,
		handleConfirm,
		handleCloseWithEvent,
		handleOverlayClick,
		handleOverlayMouseDown,
		handleCloseButtonClick,
		suppressMouseEvent,
		stopMousePropagation: (event: ControlledMouseEvent) =>
			event.stopPropagation(),
	};
}

export type ModalController = ReturnType<typeof useModalController>;
