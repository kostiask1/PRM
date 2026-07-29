import { forwardRef, type InputHTMLAttributes } from "react";

import "../../assets/components/Input.css";

export type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
	function TextInput({ className = "", ...props }, ref) {
		return (
			<input
				{...props}
				ref={ref}
				className={className ? `Input ${className}` : "Input"}
			/>
		);
	},
);

TextInput.displayName = "TextInput";

export default TextInput;
