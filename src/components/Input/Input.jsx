import { forwardRef, useRef, useLayoutEffect } from "react";
import "./Input.css";

const Input = forwardRef(({ type = "text", className = "", ...props }, ref) => {
	const internalRef = useRef(null);

	// Синхронізуємо висоту textarea з контентом
	useLayoutEffect(() => {
		if (type === "textarea" && internalRef.current) {
			const node = internalRef.current;
			node.style.height = "auto";
			node.style.height = `${node.scrollHeight}px`;
		}
	}, [props.value, type]);

	// Об'єднуємо зовнішній ref (від forwardRef) та внутрішній internalRef
	const setRefs = (node) => {
		internalRef.current = node;
		if (typeof ref === "function") ref(node);
		else if (ref) ref.current = node;
	};

	const handleKeyDown = (e) => {
		const isMod = e.ctrlKey || e.metaKey;
		const key = e.key.toLowerCase();

		// Підтримка Ctrl+B (Жирний) та Ctrl+I (Курсив) + укр розкладка
		if (isMod && (key === "b" || key === "и" || key === "i" || key === "ш")) {
			e.preventDefault();

			const tag = key === "b" || key === "и" ? "**" : "*";
			const { selectionStart, selectionEnd, value } = e.target;

			const before = value.substring(0, selectionStart);
			const selection = value.substring(selectionStart, selectionEnd);
			const after = value.substring(selectionEnd);

			const newValue = before + tag + selection + tag + after;

			// Викликаємо onChange для оновлення стану в батьківському компоненті
			if (props.onChange) {
				props.onChange({
					...e,
					target: { ...e.target, value: newValue },
				});
			}

			// Повертаємо фокус та виділення тексту після оновлення DOM
			setTimeout(() => {
				const node = internalRef.current;
				if (node) {
					node.focus();
					const newStart = selectionStart + tag.length;
					const newEnd = selectionEnd + tag.length;
					node.setSelectionRange(newStart, newEnd);
				}
			}, 0);
		}

		// Викликаємо оригінальний onKeyDown, якщо він був переданий
		if (props.onKeyDown) props.onKeyDown(e);
	};

	const baseClass = type === "textarea" ? "Input Input--textarea" : "Input";
	const combinedClassName = `${baseClass} ${className}`.trim();

	if (type === "textarea") {
		return (
			<textarea
				ref={setRefs}
				className={combinedClassName}
				onKeyDown={handleKeyDown}
				{...props}
			/>
		);
	}

	return (
		<input
			ref={setRefs}
			className={combinedClassName}
			type={type}
			onKeyDown={handleKeyDown}
			{...props}
		/>
	);
});

export default Input;
