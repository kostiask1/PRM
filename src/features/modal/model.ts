import type { ReactNode } from "react";

export type ModalType = string;
export type ModalConfirmInput = string | boolean;

export interface ModalProps {
	title?: ReactNode;
	message?: ReactNode;
	type?: ModalType;
	defaultValue?: string;
	onConfirm: (value?: unknown) => void;
	onCancel?: (() => void) | null;
	showInput?: boolean;
	children?: ReactNode;
	showFooter?: boolean;
	confirmLabel?: ReactNode;
	className?: string;
	overlayClassName?: string;
	checkboxLabel?: ReactNode;
	checkboxDefaultChecked?: boolean;
	getConfirmValue?: (
		value: ModalConfirmInput,
		checked: boolean,
	) => unknown;
	cancelDisabled?: boolean;
}

export interface ModalApiConfig
	extends Omit<ModalProps, "onCancel" | "onConfirm"> {
	isAlert?: boolean;
}

export interface ResolvedModalApiConfig extends ModalApiConfig {
	onConfirm: (value?: unknown) => void;
	onCancel: (() => void) | null;
}

export type SetModalApiConfig = (
	config: ResolvedModalApiConfig | null,
) => void;

export interface ModalApi {
	open: (config: ModalApiConfig) => Promise<unknown>;
	close: () => void;
	alert: (
		title: string,
		message: string,
		status?: string | null,
	) => Promise<unknown>;
	success: (title: string, message: string) => Promise<unknown>;
	confirm: (
		title: string,
		message: string,
		status?: string | null,
	) => Promise<unknown>;
	prompt: (
		title: string,
		message: string,
		defaultValue?: string,
	) => Promise<unknown>;
}

export function formatModalStatusMessage(
	message: string,
	status: string | null | undefined,
	statusLabel: string,
): string {
	return status ? `[${statusLabel}: ${status}] ${message}` : message;
}

export function createModalApi(
	setModalConfig: SetModalApiConfig,
	statusLabel: () => string,
): ModalApi {
	const open = (config: ModalApiConfig): Promise<unknown> =>
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
	const alert = (
		title: string,
		message: string,
		status: string | null = null,
	) =>
		open({
			title,
			message: status
				? formatModalStatusMessage(message, status, statusLabel())
				: message,
			type: "error",
			isAlert: true,
		});
	const success = (title: string, message: string) =>
		open({ title, message, type: "success", isAlert: true });
	const confirm = (
		title: string,
		message: string,
		status: string | null = null,
	) =>
		open({
			title,
			message: status
				? formatModalStatusMessage(message, status, statusLabel())
				: message,
			type: "confirm",
		});
	const prompt = (
		title: string,
		message: string,
		defaultValue = "",
	) =>
		open({
			title,
			message,
			type: "confirm",
			showInput: true,
			defaultValue,
		});

	return { open, close, alert, success, confirm, prompt };
}

export function resolveModalConfirmValue({
	showInput,
	inputValue,
	checkboxValue,
	getConfirmValue,
}: {
	showInput: boolean;
	inputValue: string;
	checkboxValue: boolean;
	getConfirmValue?: ModalProps["getConfirmValue"];
}): unknown {
	const value: ModalConfirmInput = showInput ? inputValue : true;
	return getConfirmValue
		? getConfirmValue(value, checkboxValue)
		: value;
}

export type ModalFocusTarget = "confirm" | "input" | null;

export function getModalFocusTarget(
	hasChildren: boolean,
	showInput: boolean,
): ModalFocusTarget {
	if (hasChildren) return null;
	return showInput ? "input" : "confirm";
}

export interface ModalKeyboardPlan {
	preventDefault: boolean;
	action: "close" | "confirm" | null;
}

export function getModalKeyboardPlan(
	key: string,
	defaultPrevented: boolean,
	hasChildren: boolean,
): ModalKeyboardPlan {
	if (defaultPrevented) return { preventDefault: false, action: null };
	if (key === "Escape") return { preventDefault: false, action: "close" };
	if (key === "Enter") {
		return {
			preventDefault: true,
			action: hasChildren ? null : "confirm",
		};
	}
	return { preventDefault: false, action: null };
}

export function getModalCloseAction(
	cancelDisabled: boolean,
	hasCancelHandler: boolean,
): "blocked" | "cancel" | "confirm" {
	if (cancelDisabled) return "blocked";
	return hasCancelHandler ? "cancel" : "confirm";
}
