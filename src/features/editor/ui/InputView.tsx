import type {
	ClipboardEvent,
	KeyboardEvent,
	ReactElement,
	ReactNode,
	TextareaHTMLAttributes,
} from "react";

import "../../../assets/components/Input.css";
import { classNames } from "../../../shared/lib/index.js";
import { Tooltip } from "../../../shared/ui/index.js";
import { getInputClassPresentation } from "./editorPresentation.ts";
import type {
	InputElement,
	InputNativeProps,
	InputProps,
} from "./inputTypes.ts";

interface InputViewProps {
	type: NonNullable<InputProps["type"]>;
	className: string;
	title: ReactNode;
	nativeProps: InputNativeProps;
	inputRef: (node: InputElement | null) => void;
	onKeyDown: (event: KeyboardEvent<InputElement>) => void;
	onPaste: (event: ClipboardEvent<InputElement>) => void;
}

interface NativeInputViewProps
	extends Pick<
		InputViewProps,
		"type" | "nativeProps" | "inputRef" | "onKeyDown" | "onPaste"
	> {
	className: string;
}

function renderNativeInput({
	type,
	nativeProps,
	inputRef,
	className,
	onKeyDown,
	onPaste,
}: NativeInputViewProps): ReactElement {
	if (type === "textarea") {
		const textareaProps =
			nativeProps as TextareaHTMLAttributes<HTMLTextAreaElement>;
		return (
			<textarea
				rows={1}
				{...textareaProps}
				ref={inputRef}
				className={className}
				onKeyDown={onKeyDown}
				onPaste={onPaste}
			/>
		);
	}
	return (
		<input
			{...nativeProps}
			ref={inputRef}
			className={className}
			type={type}
			onKeyDown={onKeyDown}
			onPaste={onPaste}
		/>
	);
}

function wrapInputWithTooltip(
	title: ReactNode,
	node: ReactElement,
): ReactElement {
	if (!title) return node;
	return (
		<Tooltip content={title} className="Input__tooltip">
			{node}
		</Tooltip>
	);
}

export default function InputView({
	type,
	className,
	title,
	nativeProps,
	inputRef,
	onKeyDown,
	onPaste,
}: InputViewProps): ReactElement {
	const presentation = getInputClassPresentation(type, nativeProps);
	const combinedClassName = classNames(
		presentation.baseClassName,
		className,
		presentation.mentionClassName,
	);
	const node = renderNativeInput({
		type,
		nativeProps,
		inputRef,
		className: combinedClassName,
		onKeyDown,
		onPaste,
	});
	return wrapInputWithTooltip(title, node);
}
