import {
	type MouseEvent as ReactMouseEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { Button, Checkbox, Icon } from "../../../shared/ui/index.js";
import { classNames, lang } from "../../../shared/lib/index.js";
import "../../../assets/components/Modal.css";
import {
	createModalApi,
	getModalCloseAction,
	getModalFocusTarget,
	getModalKeyboardPlan,
	resolveModalConfirmValue,
	type ModalProps,
	type SetModalApiConfig,
} from "../model.ts";

function Modal({
	title,
	message,
	type,
	defaultValue,
	onConfirm,
	onCancel,
	showInput,
	children,
	showFooter = true,
	confirmLabel,
	className = "",
	overlayClassName = "",
	checkboxLabel,
	checkboxDefaultChecked = false,
	getConfirmValue,
	cancelDisabled = false,
}: ModalProps) {
	const [inputValue, setInputValue] = useState(defaultValue || "");
	const [checkboxValue, setCheckboxValue] = useState(
		Boolean(checkboxDefaultChecked),
	);
	const inputRef = useRef<HTMLInputElement>(null);
	const confirmButtonRef = useRef<HTMLButtonElement>(null);
	const hasChildren = Boolean(children);

	function resolveConfirmValue() {
		return resolveModalConfirmValue({
			showInput: Boolean(showInput),
			inputValue,
			checkboxValue,
			getConfirmValue,
		});
	}

	useEffect(() => {
		const focusTarget = getModalFocusTarget(hasChildren, Boolean(showInput));
		if (focusTarget === "input" && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		} else if (focusTarget === "confirm" && confirmButtonRef.current) {
			confirmButtonRef.current.focus();
		}
	}, [showInput]);

	useEffect(() => {
		const handleGlobalKeyDown = (event: KeyboardEvent) => {
			const plan = getModalKeyboardPlan(
				event.key,
				event.defaultPrevented,
				hasChildren,
			);
			if (plan.preventDefault) event.preventDefault();
			if (plan.action === "close") handleClose();
			if (plan.action === "confirm") onConfirm(resolveConfirmValue());
		};

		window.addEventListener("keydown", handleGlobalKeyDown);
		return () => window.removeEventListener("keydown", handleGlobalKeyDown);
	}, [onCancel, onConfirm, showInput, inputValue]);

	function handleClose() {
		const action = getModalCloseAction(
			cancelDisabled,
			typeof onCancel === "function",
		);
		if (action === "blocked") return;

		const activeElement = document.activeElement;
		if (
			activeElement &&
			"blur" in activeElement &&
			typeof activeElement.blur === "function"
		) {
			activeElement.blur();
		}

		if (action === "cancel") {
			onCancel?.();
		} else {
			onConfirm();
		}
	}

	function handleCloseWithEvent(
		event?: Pick<
			ReactMouseEvent<HTMLElement>,
			"preventDefault" | "stopPropagation"
		>,
	) {
		event?.preventDefault?.();
		event?.stopPropagation?.();
		handleClose();
	}

	const isAlert = !onCancel;

	return createPortal(
		<div
			className={classNames("Modal__overlay", overlayClassName)}
			onClick={(event) => {
				if (event.target !== event.currentTarget) return;
				handleCloseWithEvent(event);
			}}
			onMouseDown={(event) => {
				if (event.target !== event.currentTarget) return;
				event.preventDefault();
			}}
		>
			<div
				className={classNames("Modal__card", `Modal__card__${type}`, className)}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="Modal__header">
					<h3>{title}</h3>
					<button
						className="Modal__close"
						disabled={cancelDisabled}
						onMouseDown={(event) => {
							event.preventDefault();
							event.stopPropagation();
						}}
						onClick={(event) => {
							if (!onCancel) return;
							handleCloseWithEvent(event);
						}}
					>
						<Icon name="x" />
					</button>
				</div>
				<div className="Modal__body">
					{children ? (
						children
					) : (
						<>
							<p>{message}</p>
							{checkboxLabel && (
								<div className="Modal__option">
									<Checkbox
										checked={checkboxValue}
										onChange={setCheckboxValue}
										label={checkboxLabel}
									/>
								</div>
							)}
							{showInput && (
								<input
									className="Input"
									ref={inputRef}
									value={inputValue}
									onChange={(e) => setInputValue(e.target.value)}
									placeholder={lang.t("Enter a value...")}
								/>
							)}
						</>
					)}
				</div>
				{showFooter && (
					<div className="Modal__footer">
						{onCancel && (
							<Button
								variant="ghost"
								onMouseDown={(event) => {
									event.preventDefault();
									event.stopPropagation();
								}}
								disabled={cancelDisabled}
								onClick={(event) => handleCloseWithEvent(event)}
							>
								{lang.t("Cancel")}
							</Button>
						)}
						<Button
							ref={confirmButtonRef}
							variant={type === "error" ? "danger" : "primary"}
							onClick={() => onConfirm(resolveConfirmValue())}
						>
							{confirmLabel || (isAlert ? lang.t("OK") : lang.t("Confirm"))}
						</Button>
					</div>
				)}
			</div>
		</div>,
		document.body,
	);
}

const ModalWithApi = Object.assign(Modal, {
	createApi: (setModalConfig: SetModalApiConfig) =>
		createModalApi(setModalConfig, () => lang.t("Status")),
});

export default ModalWithApi;
