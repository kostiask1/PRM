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
			const selection = value.substring(selectionStart, selectionEnd);

			let newValue;
			let newStart, newEnd;

			// Перевірка на конфлікт: чи не намагаємось ми зняти курсив з тексту, який насправді жирний (**)
			const isItalic = tag === "*";
			const isInsideItalicConflict = isItalic && selection.startsWith("**") && !selection.startsWith("***");
			const isOutsideItalicConflict = isItalic && value.substring(selectionStart - 2, selectionStart) === "**" && value.substring(selectionStart - 3, selectionStart) !== "***";

			// 1. Якщо теги всередині виділення: [**текст**] -> [текст]
			if (selection.startsWith(tag) && selection.endsWith(tag) && selection.length >= tag.length * 2 && !isInsideItalicConflict) {
				newValue = value.substring(0, selectionStart) + 
						   selection.substring(tag.length, selection.length - tag.length) + 
						   value.substring(selectionEnd);
				newStart = selectionStart;
				newEnd = selectionEnd - (tag.length * 2);
			}
			// 2. Якщо теги зовні виділення: **[текст]** -> [текст]
			else if (
				selectionStart >= tag.length &&
				value.substring(selectionStart - tag.length, selectionStart) === tag &&
				value.substring(selectionEnd, selectionEnd + tag.length) === tag && !isOutsideItalicConflict
			) {
				newValue = value.substring(0, selectionStart - tag.length) + 
						   selection + 
						   value.substring(selectionEnd + tag.length);
				newStart = selectionStart - tag.length;
				newEnd = selectionEnd - tag.length;
			}
			// 3. Додаємо форматування
			else {
				newValue = value.substring(0, selectionStart) + tag + selection + tag + value.substring(selectionEnd);
				newStart = selectionStart + tag.length;
				newEnd = selectionEnd + tag.length;
			}

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
					node.setSelectionRange(newStart, newEnd);
				}
			}, 0);
		}

		// Підтримка Ctrl + ] (Додати список) та Ctrl + [ (Видалити список) + укр розкладка
		const isListAdd = key === "]" || key === "ї";
		const isListRemove = key === "[" || key === "х";

		if (isMod && (isListAdd || isListRemove)) {
			e.preventDefault();
			const { selectionStart, selectionEnd, value } = e.target;

			// Знаходимо початок першого та кінець останнього виділеного рядка
			const startOfFirstLine = value.lastIndexOf("\n", selectionStart - 1) + 1;
			let endOfLastLine = value.indexOf("\n", selectionEnd);
			if (endOfLastLine === -1) endOfLastLine = value.length;

			const before = value.substring(0, startOfFirstLine);
			const after = value.substring(endOfLastLine);
			const block = value.substring(startOfFirstLine, endOfLastLine);

			const lines = block.split("\n");
			let firstLineShift = 0;
			let totalShift = 0;

			const newLines = lines.map((line, idx) => {
				if (isListAdd) {
					totalShift += 2;
					if (idx === 0) firstLineShift = 2;
					return "- " + line;
				} else {
					if (line.startsWith("- ")) {
						totalShift -= 2;
						if (idx === 0) firstLineShift = -2;
						return line.slice(2);
					}
					return line;
				}
			});

			const newValue = before + newLines.join("\n") + after;

			if (newValue !== value) {
				if (props.onChange) {
					props.onChange({ ...e, target: { ...e.target, value: newValue } });
				}
				setTimeout(() => {
					const node = internalRef.current;
					if (node) {
						node.focus();
						node.setSelectionRange(
							Math.max(0, selectionStart + firstLineShift),
							Math.max(0, selectionEnd + totalShift)
						);
					}
				}, 0);
			}
		}

		// Підтримка Ctrl + 1-6 (Заголовки)
		const isHeader = !isNaN(key) && key >= "1" && key <= "6";

		if (isMod && isHeader) {
			e.preventDefault();
			const level = parseInt(key);
			const headerTag = "#".repeat(level) + " ";
			const { selectionStart, selectionEnd, value } = e.target;

			const startOfFirstLine = value.lastIndexOf("\n", selectionStart - 1) + 1;
			let endOfLastLine = value.indexOf("\n", selectionEnd);
			if (endOfLastLine === -1) endOfLastLine = value.length;

			const before = value.substring(0, startOfFirstLine);
			const after = value.substring(endOfLastLine);
			const block = value.substring(startOfFirstLine, endOfLastLine);

			const lines = block.split("\n");
			let firstLineShift = 0;
			let totalShift = 0;

			const newLines = lines.map((line, idx) => {
				const existingHeaderMatch = line.match(/^#{1,6} /);
				let newLine = line;
				let shift = 0;

				if (existingHeaderMatch) {
					const existingHeader = existingHeaderMatch[0];
					if (existingHeader === headerTag) {
						newLine = line.slice(existingHeader.length);
						shift = -existingHeader.length;
					} else {
						newLine = headerTag + line.slice(existingHeader.length);
						shift = headerTag.length - existingHeader.length;
					}
				} else {
					newLine = headerTag + line;
					shift = headerTag.length;
				}

				if (idx === 0) firstLineShift = shift;
				totalShift += shift;
				return newLine;
			});

			const newValue = before + newLines.join("\n") + after;

			if (newValue !== value) {
				if (props.onChange) {
					props.onChange({ ...e, target: { ...e.target, value: newValue } });
				}
				setTimeout(() => {
					const node = internalRef.current;
					if (node) {
						node.focus();
						node.setSelectionRange(
							Math.max(0, selectionStart + firstLineShift),
							Math.max(0, selectionEnd + totalShift)
						);
					}
				}, 0);
			}
		}

		// Підтримка Ctrl + Q (Цитата/Blockquote) + укр розкладка
		if (isMod && (key === "q" || key === "й")) {
			e.preventDefault();
			const { selectionStart, selectionEnd, value } = e.target;

			const startOfFirstLine = value.lastIndexOf("\n", selectionStart - 1) + 1;
			let endOfLastLine = value.indexOf("\n", selectionEnd);
			if (endOfLastLine === -1) endOfLastLine = value.length;

			const before = value.substring(0, startOfFirstLine);
			const after = value.substring(endOfLastLine);
			const block = value.substring(startOfFirstLine, endOfLastLine);

			const lines = block.split("\n");
			let firstLineShift = 0;
			let totalShift = 0;

			const newLines = lines.map((line, idx) => {
				let newLine = line;
				let shift = 0;

				if (line.startsWith("> ")) {
					newLine = line.slice(2);
					shift = -2;
				} else {
					newLine = "> " + line;
					shift = 2;
				}

				if (idx === 0) firstLineShift = shift;
				totalShift += shift;
				return newLine;
			});

			const newValue = before + newLines.join("\n") + after;

			if (newValue !== value) {
				if (props.onChange) {
					props.onChange({ ...e, target: { ...e.target, value: newValue } });
				}
				setTimeout(() => {
					const node = internalRef.current;
					if (node) {
						node.focus();
						node.setSelectionRange(
							Math.max(0, selectionStart + firstLineShift),
							Math.max(0, selectionEnd + totalShift)
						);
					}
				}, 0);
			}
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
