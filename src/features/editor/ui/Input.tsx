import {
	forwardRef,
	type ClipboardEvent,
	type ForwardedRef,
	type KeyboardEvent,
	type MutableRefObject,
	useLayoutEffect,
	useRef,
} from "react";

import { useAppDispatch } from "../../../shared/model/index.js";
import { requestMentionSelection } from "../model/mentionPicker.ts";
import {
	getInitialInputSelectionPosition,
	getInputBracketPasteEdit,
	getInputMentionCursorPosition,
	getInputMentionInsertion,
	getInputRawValue,
	getInputShortcutAction,
	getInputShortcutExecutionPlan,
	isRangeInsideSquareBrackets,
	type InputTextEdit,
} from "./editorPresentation.ts";
import InputView from "./InputView.tsx";
import type {
	InputElement,
	InputProps,
	InputValueChangeEvent,
} from "./inputTypes.ts";

export type { InputProps, InputValueChangeEvent } from "./inputTypes.ts";

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

interface InputSelectionState {
	value: string;
	selectionStart: number;
	selectionEnd: number;
}

function getInputSelectionState(target: InputElement): InputSelectionState {
	const value = target.value;
	const selectionStart = target.selectionStart ?? 0;
	return {
		value,
		selectionStart,
		selectionEnd: target.selectionEnd ?? selectionStart,
	};
}

function delegateInputPaste(
	props: Pick<InputProps, "onPaste">,
	event: ClipboardEvent<InputElement>,
): void {
	props.onPaste?.(event);
}

const Input = forwardRef<InputElement, InputProps>(function Input(
	{ type = "text", className = "", initialSelection, title, ...props },
	forwardedRef,
) {
	const dispatch = useAppDispatch();
	const internalRef = useRef<InputElement | null>(null);
	const hasAppliedInitialSelectionRef = useRef(false);
	const rawValue = getInputRawValue(props);

	useLayoutEffect(() => {
		if (type !== "textarea") return;
		const node = internalRef.current;
		if (!(node instanceof HTMLTextAreaElement)) return;
		node.style.height = "auto";
		node.style.height = `${node.scrollHeight}px`;
	}, [props.value, type]);

	useLayoutEffect(() => {
		const node = internalRef.current;
		if (!node) return;
		const position = getInitialInputSelectionPosition(
			hasAppliedInitialSelectionRef.current,
			initialSelection,
			type,
			rawValue,
		);
		if (position === null) return;
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
		const {
			value,
			selectionStart: cursorStart,
			selectionEnd: cursorEnd,
		} = getInputSelectionState(event.currentTarget);
		const result = await requestMentionSelection(dispatch);
		const insertion = getInputMentionInsertion(
			value,
			cursorStart,
			cursorEnd,
			result,
		);
		if (!insertion) return;
		props.onChange?.(createInputChangeEvent(event, insertion.value));
		const nextCursor = getInputMentionCursorPosition(
			cursorStart,
			result,
			insertion.mention,
		);
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
		const { value, selectionStart, selectionEnd } = getInputSelectionState(
			event.currentTarget,
		);
		const execution = getInputShortcutExecutionPlan(
			action,
			value,
			selectionStart,
			selectionEnd,
		);
		if (execution.kind === "mention-picker") {
			void insertMentionWithoutSelection(event);
			return;
		}
		applyTextEdit(event, execution.edit);
	};

	const handlePaste = (event: ClipboardEvent<InputElement>) => {
		if (type !== "textarea") {
			delegateInputPaste(props, event);
			return;
		}
		const { value, selectionStart, selectionEnd } = getInputSelectionState(
			event.currentTarget,
		);
		if (
			!isRangeInsideSquareBrackets(value, selectionStart, selectionEnd)
		) {
			delegateInputPaste(props, event);
			return;
		}
		event.preventDefault();
		const plainText = event.clipboardData.getData("text/plain");
		const edit = getInputBracketPasteEdit(
			value,
			selectionStart,
			selectionEnd,
			plainText,
		);
		applyTextEdit(event, edit);
	};

	return (
		<InputView
			type={type}
			className={className}
			title={title}
			nativeProps={props}
			inputRef={setRefs}
			onKeyDown={handleKeyDown}
			onPaste={handlePaste}
		/>
	);
});

Input.displayName = "Input";

export default Input;
