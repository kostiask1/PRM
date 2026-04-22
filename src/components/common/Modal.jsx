import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Button from "../form/Button";
import Checkbox from "../form/Checkbox";
import Input from "../form/Input";
import "../../assets/components/Modal.css";
import classNames from "../../utils/classNames";

function createModalApi(setModalConfig) {
	const open = (config) =>
		new Promise((resolve) => {
			setModalConfig({
				...config,
				onConfirm: (value) => {
					setModalConfig(null);
					resolve(value);
				},
				onCancel: config.isAlert
					? null
					: () => {
							setModalConfig(null);
							resolve(null);
						},
			});
		});

	const close = () => setModalConfig(null);

	const alert = (title, message, status = null) => {
		const fullMessage = status ? `[Статус: ${status}] ${message}` : message;
		return open({
			title,
			message: fullMessage,
			type: "error",
			isAlert: true,
		});
	};

	const success = (title, message) =>
		open({
			title,
			message,
			type: "success",
			isAlert: true,
		});

	const confirm = (title, message, status = null) => {
		const fullMessage = status ? `[Статус: ${status}] ${message}` : message;
		return open({ title, message: fullMessage, type: "confirm" });
	};

	const prompt = (title, message, defaultValue = "") =>
		open({
			title,
			message,
			type: "confirm",
			showInput: true,
			defaultValue,
		});

	return { open, close, alert, success, confirm, prompt };
}

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
	checkboxLabel,
	checkboxDefaultChecked = false,
	getConfirmValue,
}) {
	const [inputValue, setInputValue] = useState(defaultValue || "");
	const [checkboxValue, setCheckboxValue] = useState(Boolean(checkboxDefaultChecked));
	const inputRef = useRef(null);
	const confirmButtonRef = useRef(null);

	function resolveConfirmValue() {
		const value = showInput ? inputValue : true;
		if (typeof getConfirmValue === "function") {
			return getConfirmValue(value, checkboxValue);
		}
		return value;
	}

	useEffect(() => {
		if (!children) {
			// Only manage focus for standard modals
			if (showInput && inputRef.current) {
				inputRef.current.focus();
				inputRef.current.select();
			} else if (!showInput && confirmButtonRef.current) {
				confirmButtonRef.current.focus();
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [showInput]);

	useEffect(() => {
		const handleGlobalKeyDown = (e) => {
			if (e.key === "Escape") {
				handleClose();
			} else if (e.key === "Enter") {
				e.preventDefault();
				if (!children) onConfirm(resolveConfirmValue()); // Only confirm on Enter for standard modals
			}
		};

		window.addEventListener("keydown", handleGlobalKeyDown);
		return () => window.removeEventListener("keydown", handleGlobalKeyDown);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [onCancel, onConfirm, showInput, inputValue]);

	function handleClose() {
		if (onCancel) {
			onCancel();
		} else {
			onConfirm();
		}
	}

	const isAlert = !onCancel;

	return createPortal(
		<div className="Modal__overlay" onClick={handleClose}>
			<div
				className={classNames("Modal__card", `Modal__card--${type}`, className)}
				onClick={(e) => e.stopPropagation()}>
				<div className="Modal__header">
					<h3>{title}</h3>
					<button
						className="Modal__close"
						onClick={() => onCancel && onCancel()}>
						&times;
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
								<Input
									ref={inputRef}
									value={inputValue}
									onChange={(e) => setInputValue(e.target.value)}
									placeholder="Введіть значення..."
								/>
							)}
						</>
					)}
				</div>
				{showFooter && (
					<div className="Modal__footer">
						{onCancel && (
							<Button variant="ghost" onClick={onCancel}>
								Скасувати
							</Button>
						)}
						<Button
							ref={confirmButtonRef}
							variant={type === "error" ? "danger" : "primary"}
							onClick={() => onConfirm(resolveConfirmValue())}>
							{confirmLabel || (isAlert ? "ОК" : "Підтвердити")}
						</Button>
					</div>
				)}
			</div>
		</div>,
		document.body
	);
}

Modal.createApi = createModalApi;

export default Modal;
