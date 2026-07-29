import type { ReactNode } from "react";
import Button from "./Button.tsx";
import Checkbox from "./Checkbox.tsx";
import Icon from "./Icon.tsx";
import { classNames, lang } from "../lib/index.js";
import {
	getModalPresentationPlan,
	type ModalPresentationPlan,
	type ModalProps,
} from "./modalModel.ts";
import type { ModalController } from "./useModalController.ts";

interface ModalViewProps extends ModalProps {
	controller: ModalController;
}

function ModalHeader({
	title,
	cancelDisabled,
	controller,
}: Pick<ModalProps, "title" | "cancelDisabled"> & {
	controller: ModalController;
}) {
	return (
		<div className="Modal__header">
			<h3>{title}</h3>
			<button
				className="Modal__close"
				disabled={cancelDisabled}
				onMouseDown={controller.suppressMouseEvent}
				onClick={controller.handleCloseButtonClick}
			>
				<Icon name="x" />
			</button>
		</div>
	);
}

function StandardModalBody({
	message,
	checkboxLabel,
	showInput,
	controller,
}: Pick<ModalProps, "message" | "checkboxLabel" | "showInput"> & {
	controller: ModalController;
}) {
	return (
		<>
			<p>{message}</p>
			{checkboxLabel && (
				<div className="Modal__option">
					<Checkbox
						checked={controller.checkboxValue}
						onChange={controller.setCheckboxValue}
						label={checkboxLabel}
					/>
				</div>
			)}
			{showInput && (
				<input
					className="Input"
					ref={controller.inputRef}
					value={controller.inputValue}
					onChange={(event) => controller.setInputValue(event.target.value)}
					placeholder={lang.t("Enter a value...")}
				/>
			)}
		</>
	);
}

function ModalBody({
	children,
	message,
	checkboxLabel,
	showInput,
	controller,
}: Pick<
	ModalProps,
	"children" | "message" | "checkboxLabel" | "showInput"
> & {
	controller: ModalController;
}) {
	if (children) return <div className="Modal__body">{children}</div>;
	return (
		<div className="Modal__body">
			<StandardModalBody
				message={message}
				checkboxLabel={checkboxLabel}
				showInput={showInput}
				controller={controller}
			/>
		</div>
	);
}

function getConfirmLabel(
	kind: ModalPresentationPlan["confirmLabelKind"],
	confirmLabel: ReactNode,
): ReactNode {
	if (kind === "custom") return confirmLabel;
	return lang.t(kind === "ok" ? "OK" : "Confirm");
}

function ModalFooter({
	plan,
	confirmLabel,
	cancelDisabled,
	controller,
}: {
	plan: ModalPresentationPlan;
	confirmLabel: ReactNode;
	cancelDisabled: boolean;
	controller: ModalController;
}) {
	if (!plan.showFooter) return null;
	return (
		<div className="Modal__footer">
			{plan.showCancel && (
				<Button
					variant="ghost"
					onMouseDown={controller.suppressMouseEvent}
					disabled={cancelDisabled}
					onClick={controller.handleCloseWithEvent}
				>
					{lang.t("Cancel")}
				</Button>
			)}
			<Button
				ref={controller.confirmButtonRef}
				variant={plan.confirmVariant}
				onClick={controller.handleConfirm}
			>
				{getConfirmLabel(plan.confirmLabelKind, confirmLabel)}
			</Button>
		</div>
	);
}

export function ModalView({
	title,
	message,
	type,
	onCancel,
	showInput,
	children,
	showFooter = true,
	confirmLabel,
	className = "",
	overlayClassName = "",
	checkboxLabel,
	cancelDisabled = false,
	controller,
}: ModalViewProps) {
	const plan = getModalPresentationPlan({
		showFooter,
		hasCancelHandler: Boolean(onCancel),
		type,
		hasConfirmLabel: Boolean(confirmLabel),
	});
	return (
		<div
			className={classNames("Modal__overlay", overlayClassName)}
			onClick={controller.handleOverlayClick}
			onMouseDown={controller.handleOverlayMouseDown}
		>
			<div
				className={classNames("Modal__card", `Modal__card__${type}`, className)}
				onClick={controller.stopMousePropagation}
			>
				<ModalHeader
					title={title}
					cancelDisabled={cancelDisabled}
					controller={controller}
				/>
				<ModalBody
					children={children}
					message={message}
					checkboxLabel={checkboxLabel}
					showInput={showInput}
					controller={controller}
				/>
				<ModalFooter
					plan={plan}
					confirmLabel={confirmLabel}
					cancelDisabled={cancelDisabled}
					controller={controller}
				/>
			</div>
		</div>
	);
}
