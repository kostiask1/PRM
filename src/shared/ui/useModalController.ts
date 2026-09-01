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
}: {
	hasChildren: boolean;
	showInput: boolean;
	inputRef: React.RefObject<HTMLInputElement | null>;
	confirmButtonRef: React.RefObject<HTMLButtonElement | null>;
}): void {
	useEffect(() => {
		const focusTarget = getModalFocusTarget(hasChildren, showInput);
		if (focusTarget === "input" && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
		if (focusTarget === "confirm" && confirmButtonRef.current) {
			confirmButtonRef.current.focus();
		}
	}, [confirmButtonRef, hasChildren, inputRef, showInput]);
}

function useModalKeyboard({
	hasChildren,
	onClose,
	onConfirm,
}: {
	hasChildren: boolean;
	onClose: () => void;
	onConfirm: () => void;
}): void {
	useEffect(() => {
		const handleGlobalKeyDown = (event: KeyboardEvent) => {
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
	}, [hasChildren, onClose, onConfirm]);
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

	useModalInitialFocus({
		hasChildren,
		showInput: Boolean(showInput),
		inputRef,
		confirmButtonRef,
	});
	useModalKeyboard({
		hasChildren,
		onClose: handleClose,
		onConfirm: handleConfirm,
	});

	return {
		inputValue,
		setInputValue,
		checkboxValue,
		setCheckboxValue,
		inputRef,
		confirmButtonRef,
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
