import {
	forwardRef,
	type ClipboardEvent,
	type ChangeEvent,
	type ForwardedRef,
	type HTMLInputTypeAttribute,
	type InputHTMLAttributes,
	type KeyboardEvent,
	type MutableRefObject,
	type ReactNode,
	type TextareaHTMLAttributes,
	useLayoutEffect,
	useRef,
} from "react";

import "../../../assets/components/Input.css";
import { classNames } from "../../../shared/lib/index.js";
import { useAppDispatch } from "../../../shared/model/index.js";
import { Tooltip } from "../../../shared/ui/index.js";
import { requestMentionSelection } from "../model/mentionPicker.ts";
import {
	applyInputBlockEdit,
	getInputShortcutAction,
	insertInputTab,
	isRangeInsideSquareBrackets,
	resolveInitialCursorPosition,
	supportsSelectionRange,
	toggleInputFormat,
	toggleInputMention,
	type InputSelectionPreview,
	type InputTextEdit,
} from "./editorPresentation.ts";

type InputElement = HTMLInputElement | HTMLTextAreaElement;
export type InputValueChangeEvent = ChangeEvent<InputElement>;
type BivariantEventHandler<Event> = {
	bivarianceHack(event: Event): void;
}["bivarianceHack"];

export interface InputProps
	extends Omit<
		InputHTMLAttributes<HTMLInputElement>,
		"className" | "onChange" | "onKeyDown" | "onPaste" | "title" | "type" | "value"
	> {
	type?: HTMLInputTypeAttribute | "textarea";
	className?: string;
	initialSelection?: number | InputSelectionPreview | null;
	title?: ReactNode;
	value?: string | number | readonly string[];
	onChange?: BivariantEventHandler<InputValueChangeEvent>;
	onKeyDown?: BivariantEventHandler<KeyboardEvent<InputElement>>;
	onPaste?: BivariantEventHandler<ClipboardEvent<InputElement>>;
}

function assignInputRef(
	forwardedRef: ForwardedRef<InputElement>,
	node: InputElement | null,
) {
	if (typeof forwardedRef === "function") forwardedRef(node);
	else if (forwardedRef) {
		(forwardedRef as MutableRefObject<InputElement | null>).current = node;
	}
}

function createInputChangeEvent(
	event: KeyboardEvent<InputElement> | ClipboardEvent<InputElement>,
	value: string,
): InputValueChangeEvent {
	return {
		...event,
		currentTarget: { ...event.currentTarget, value },
		target: { ...event.currentTarget, value },
	} as unknown as InputValueChangeEvent;
}

const Input = forwardRef<InputElement, InputProps>(function Input(
	{ type = "text", className = "", initialSelection, title, ...props },
	forwardedRef,
) {
	const dispatch = useAppDispatch();
	const internalRef = useRef<InputElement | null>(null);
	const hasAppliedInitialSelectionRef = useRef(false);
	const rawValue = Array.isArray(props.value)
		? props.value.join(",")
		: String(props.value ?? "");

	useLayoutEffect(() => {
		if (type !== "textarea") return;
		const node = internalRef.current;
		if (!(node instanceof HTMLTextAreaElement)) return;
		node.style.height = "auto";
		node.style.height = `${node.scrollHeight}px`;
	}, [props.value, type]);

	useLayoutEffect(() => {
		const node = internalRef.current;
		if (!node || hasAppliedInitialSelectionRef.current) return;
		if (initialSelection == null || !supportsSelectionRange(type)) return;
		const position = resolveInitialCursorPosition(initialSelection, rawValue);
		node.focus({ preventScroll: true });
		node.setSelectionRange(position, position);
		hasAppliedInitialSelectionRef.current = true;
	}, [initialSelection, rawValue, type]);

	const setRefs = (node: InputElement | null) => {
		internalRef.current = node;
		assignInputRef(forwardedRef, node);
	};

	const applyTextEdit = (
		event: KeyboardEvent<InputElement> | ClipboardEvent<InputElement>,
		edit: InputTextEdit,
	) => {
		props.onChange?.(createInputChangeEvent(event, edit.value));
		setTimeout(() => {
			const node = internalRef.current;
			if (!node) return;
			node.focus();
			node.setSelectionRange(
				Math.max(0, edit.selectionStart),
				Math.max(0, edit.selectionEnd),
			);
		}, 0);
	};

	const insertMentionWithoutSelection = async (
		event: KeyboardEvent<InputElement>,
	) => {
		const target = event.currentTarget;
		const value = target.value;
		const cursorStart = target.selectionStart ?? 0;
		const cursorEnd = target.selectionEnd ?? cursorStart;
		const result = await requestMentionSelection(dispatch);
		if (result.status === "cancelled") return;
		const mention = result.name ? `[${result.name}]` : "[]";
		const nextValue =
			value.substring(0, cursorStart) +
			mention +
			value.substring(cursorEnd);
		props.onChange?.(createInputChangeEvent(event, nextValue));
		const nextCursor =
			cursorStart + (result.status === "selected" ? mention.length : 1);
		setTimeout(() => {
			const node = internalRef.current;
			if (!node) return;
			node.focus();
			node.setSelectionRange(nextCursor, nextCursor);
		}, 0);
	};

	const handleKeyDown = (event: KeyboardEvent<InputElement>) => {
		const action = getInputShortcutAction({
			ctrlKey: event.ctrlKey,
			key: event.key,
			metaKey: event.metaKey,
			type,
		});
		if (!action) {
			props.onKeyDown?.(event);
			return;
		}
		event.preventDefault();
		const target = event.currentTarget;
		const value = target.value;
		const selectionStart = target.selectionStart ?? 0;
		const selectionEnd = target.selectionEnd ?? selectionStart;
		if (action.kind === "tab") {
			applyTextEdit(event, insertInputTab(value, selectionStart, selectionEnd));
			return;
		}
		if (action.kind === "mention") {
			if (selectionEnd === selectionStart) {
				void insertMentionWithoutSelection(event);
			} else {
				applyTextEdit(
					event,
					toggleInputMention(value, selectionStart, selectionEnd),
				);
			}
			return;
		}
		if (action.kind === "format") {
			applyTextEdit(
				event,
				toggleInputFormat(
					value,
					selectionStart,
					selectionEnd,
					action.marker,
				),
			);
			return;
		}
		applyTextEdit(
			event,
			applyInputBlockEdit(value, selectionStart, selectionEnd, action),
		);
	};

	const handlePaste = (event: ClipboardEvent<InputElement>) => {
		if (type !== "textarea") {
			props.onPaste?.(event);
			return;
		}
		const target = event.currentTarget;
		const selectionStart = target.selectionStart ?? 0;
		const selectionEnd = target.selectionEnd ?? selectionStart;
		if (
			!isRangeInsideSquareBrackets(
				target.value,
				selectionStart,
				selectionEnd,
			)
		) {
			props.onPaste?.(event);
			return;
		}
		event.preventDefault();
		const plainText = event.clipboardData
			.getData("text/plain")
			.replace(/\r\n/g, "\n");
		applyTextEdit(event, {
			value:
				target.value.substring(0, selectionStart) +
				plainText +
				target.value.substring(selectionEnd),
			selectionStart: selectionStart + plainText.length,
			selectionEnd: selectionStart + plainText.length,
		});
	};

	const combinedClassName = classNames(
		type === "textarea" ? "Input Input__textarea" : "Input",
		className,
		typeof props.value === "string" && props.value.includes("[") && "has-mentions",
	);
	const nativeProps = props as unknown as TextareaHTMLAttributes<HTMLTextAreaElement>;
	const node =
		type === "textarea" ? (
			<textarea
				rows={1}
				{...nativeProps}
				ref={setRefs}
				className={combinedClassName}
				onKeyDown={handleKeyDown}
				onPaste={handlePaste}
			/>
		) : (
			<input
				{...props}
				ref={setRefs}
				className={combinedClassName}
				type={type}
				onKeyDown={handleKeyDown}
				onPaste={handlePaste}
			/>
		);

	return title ? (
		<Tooltip content={title} className="Input__tooltip">
			{node}
		</Tooltip>
	) : (
		node
	);
});

Input.displayName = "Input";

export default Input;
