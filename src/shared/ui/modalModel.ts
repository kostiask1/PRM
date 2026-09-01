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

export interface ModalPresentationPlan {
	showFooter: boolean;
	showCancel: boolean;
	confirmVariant: "danger" | "primary";
	confirmLabelKind: "custom" | "ok" | "confirm";
}

export function getModalPresentationPlan({
	showFooter,
	hasCancelHandler,
	type,
	hasConfirmLabel,
}: {
	showFooter: boolean;
	hasCancelHandler: boolean;
	type?: ModalType;
	hasConfirmLabel: boolean;
}): ModalPresentationPlan {
	return {
		showFooter,
		showCancel: hasCancelHandler,
		confirmVariant: type === "error" ? "danger" : "primary",
		confirmLabelKind: hasConfirmLabel
			? "custom"
			: hasCancelHandler
				? "confirm"
				: "ok",
	};
}

export function executeModalClose({
	cancelDisabled,
	onCancel,
	onConfirm,
	blurActiveElement,
}: {
	cancelDisabled: boolean;
	onCancel?: (() => void) | null;
	onConfirm: () => void;
	blurActiveElement: () => void;
}): "blocked" | "cancel" | "confirm" {
	const action = getModalCloseAction(
		cancelDisabled,
		typeof onCancel === "function",
	);
	if (action === "blocked") return action;
	blurActiveElement();
	if (action === "cancel") onCancel?.();
	else onConfirm();
	return action;
}

export function executeModalKeyboardPlan(
	plan: ModalKeyboardPlan,
	{
		preventDefault,
		onClose,
		onConfirm,
	}: {
		preventDefault: () => void;
		onClose: () => void;
		onConfirm: () => void;
	},
): void {
	if (plan.preventDefault) preventDefault();
	if (plan.action === "close") onClose();
	if (plan.action === "confirm") onConfirm();
}
