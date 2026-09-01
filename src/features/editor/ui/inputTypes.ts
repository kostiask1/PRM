import type {
	ClipboardEvent,
	ChangeEvent,
	HTMLInputTypeAttribute,
	InputHTMLAttributes,
	KeyboardEvent,
	ReactNode,
} from "react";

import type { InputSelectionPreview } from "./editorPresentation.ts";

export type InputElement = HTMLInputElement | HTMLTextAreaElement;
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

export type InputNativeProps = Omit<
	InputProps,
	"className" | "initialSelection" | "title" | "type"
>;
