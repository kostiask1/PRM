import { useState } from "react";
import ReactMarkdown from "react-markdown";
import Input from "../Input/Input";

/**
 * Допоміжний компонент для редагування однорядкового тексту по кліку
 */
export default function EditableField({
	value,
	onChange,
	placeholder,
	className,
	type,
	...props
}) {
	const [isEditing, setIsEditing] = useState(false);

	const handleClick = (e) => {
		e.stopPropagation();

		if (!isEditing) {
			setIsEditing(true);
		}

		props.onClick && props.onClick(e);
	};

	if (isEditing) {
		return (
			<Input
				{...props}
				onClick={handleClick}
				type={type}
				value={value}
				onChange={onChange}
				placeholder={placeholder}
				onBlur={() => setIsEditing(false)}
				autoFocus
				className={className}
			/>
		);
	}

	return (
		<div className={`EditableField ${className || ""}`} onClick={handleClick}>
			<div className="MarkdownView">
				{value ? (
					<ReactMarkdown>{value}</ReactMarkdown>
				) : (
					<span className="muted">{placeholder}</span>
				)}
			</div>
		</div>
	);
}
