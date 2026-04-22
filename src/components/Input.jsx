import { forwardRef, useRef, useLayoutEffect } from "react";
import "../assets/components/Input.css";
import Tooltip from "./Tooltip";
import classNames from "../utils/classNames";

function requestMentionSelection() {
	return new Promise((resolve) => {
		const detail = {
			handled: false,
			select: (name) => resolve({ status: "selected", name: name || "" }),
			cancel: () => resolve({ status: "cancelled" }),
		};

		window.dispatchEvent(new CustomEvent("open-mention-picker", { detail }));

		if (!detail.handled) {
			resolve({ status: "unhandled" });
		}
	});
}

function isRangeInsideSquareBrackets(value = "", start = 0, end = start) {
	const openIndex = value.lastIndexOf("[", Math.max(0, start - 1));
	if (openIndex === -1) return false;

	const closeIndex = value.indexOf("]", openIndex + 1);
	if (closeIndex === -1) return false;

	return start > openIndex && end <= closeIndex;
}

function resolveInitialCursorPosition(initialSelection, rawValue = "") {
	if (initialSelection == null) return rawValue.length;

	if (typeof initialSelection === "number") {
		return Math.min(Math.max(0, initialSelection), rawValue.length);
	}

	if (typeof initialSelection.index === "number") {
		return Math.min(Math.max(0, initialSelection.index), rawValue.length);
	}

	if (
		typeof initialSelection.previewOffset === "number" &&
		Array.isArray(initialSelection.previewToRaw)
	) {
		const { previewOffset, previewToRaw } = initialSelection;

		if (previewToRaw.length === 0) return 0;
		if (previewOffset <= 0) return Math.max(0, previewToRaw[0] ?? 0);

		if (previewOffset >= previewToRaw.length) {
			return rawValue.length;
		}

		const rawPos = previewToRaw[previewOffset];
		return Math.min(Math.max(0, rawPos ?? rawValue.length), rawValue.length);
	}

	return rawValue.length;
}

const Input = forwardRef(
	(
		{ type = "text", className = "", initialSelection, title, ...props },
		ref,
	) => {
		const internalRef = useRef(null);

		// Синхронізуємо висоту textarea з контентом
		useLayoutEffect(() => {
			if (type === "textarea" && internalRef.current) {
				const node = internalRef.current;

				node.style.height = "auto";
				node.style.height = `${node.scrollHeight}px`;
			}
		}, [props.value, type]);

		// Встановлюємо фокус, висоту та каретку
		useLayoutEffect(() => {
			if (internalRef.current) {
				const node = internalRef.current;

				const pos = resolveInitialCursorPosition(
					initialSelection,
					props.value || "",
				);

				node.focus({ preventScroll: true });
				node.setSelectionRange(pos, pos);
			}
		}, [initialSelection]);

		const setRefs = (node) => {
			internalRef.current = node;
			if (typeof ref === "function") ref(node);
			else if (ref) ref.current = node;
		};

		const handleKeyDown = (e) => {
			const isMod = e.ctrlKey || e.metaKey;
			const key = e.key.toLowerCase();

			if (type === "textarea" && key === "tab") {
				e.preventDefault();

				const { selectionStart, selectionEnd, value } = e.target;
				const left = value.substring(0, selectionStart);
				const right = value.substring(selectionEnd);
				const newValue = left + "\t" + right;

				if (props.onChange) {
					props.onChange({
						...e,
						target: { ...e.target, value: newValue },
					});
				}

				setTimeout(() => {
					const node = internalRef.current;
					if (node) {
						node.focus();
						node.setSelectionRange(
							Math.max(0, selectionStart + 1),
							Math.max(0, selectionStart + 1),
						);
					}
				}, 0);

				return;
			}

			// Підтримка Ctrl+K (Посилання/Mention) + укр розкладка
			if (type === "textarea" && isMod && (key === "k" || key === "л")) {
				e.preventDefault();

				const { selectionStart, selectionEnd, value } = e.target;
				const hasSelection = selectionEnd > selectionStart;
				const targetNode = e.target;
				const initialValue = value;
				const initialSelectionStart = selectionStart;
				const initialSelectionEnd = selectionEnd;

				if (!hasSelection) {
					requestMentionSelection().then((result) => {
						if (result.status === "cancelled") return;

						const cursorStart = initialSelectionStart;
						const cursorEnd = initialSelectionEnd;
						const sourceValue = initialValue;

						const mentionText =
							result.status === "selected" && result.name
								? `[${result.name}]`
								: "[]";
						const nextValue =
							sourceValue.substring(0, cursorStart) +
							mentionText +
							sourceValue.substring(cursorEnd);

						props.onChange?.({
							...e,
							target: { ...targetNode, value: nextValue },
						});

						const newCursor =
							cursorStart +
							(result.status === "selected" ? mentionText.length : 1);
						setTimeout(() => {
							const activeNode = internalRef.current;
							if (!activeNode) return;
							activeNode.focus();
							activeNode.setSelectionRange(newCursor, newCursor);
						}, 0);
					});
					return;
				}

				const selection = value.substring(selectionStart, selectionEnd);
				const hasWrappedSelection =
					selection.startsWith("[") &&
					selection.endsWith("]") &&
					selection.length >= 2;
				const hasWrappedAroundSelection =
					selectionStart > 0 &&
					selectionEnd < value.length &&
					value[selectionStart - 1] === "[" &&
					value[selectionEnd] === "]";

				if (hasWrappedSelection) {
					const unwrappedSelection = selection.substring(
						1,
						selection.length - 1,
					);
					const newValue =
						value.substring(0, selectionStart) +
						unwrappedSelection +
						value.substring(selectionEnd);

					if (props.onChange) {
						props.onChange({
							...e,
							target: { ...e.target, value: newValue },
						});
					}

					setTimeout(() => {
						const node = internalRef.current;
						if (node) {
							node.focus();
							node.setSelectionRange(selectionStart, selectionEnd - 2);
						}
					}, 0);
					return;
				}

				if (hasWrappedAroundSelection) {
					const newValue =
						value.substring(0, selectionStart - 1) +
						selection +
						value.substring(selectionEnd + 1);

					if (props.onChange) {
						props.onChange({
							...e,
							target: { ...e.target, value: newValue },
						});
					}

					setTimeout(() => {
						const node = internalRef.current;
						if (node) {
							node.focus();
							node.setSelectionRange(selectionStart - 1, selectionEnd - 1);
						}
					}, 0);
					return;
				}

				const newValue =
					value.substring(0, selectionStart) +
					"[" +
					selection +
					"]" +
					value.substring(selectionEnd);

				if (props.onChange) {
					props.onChange({
						...e,
						target: { ...e.target, value: newValue },
					});
				}

				setTimeout(() => {
					const node = internalRef.current;
					if (node) {
						node.focus();
						node.setSelectionRange(selectionStart + 1, selectionEnd + 1);
					}
				}, 0);

				return;
			}

			// Підтримка Ctrl+B (Жирний) та Ctrl+I (Курсив) + укр розкладка
			if (
				type === "textarea" &&
				isMod &&
				(key === "b" || key === "и" || key === "i" || key === "ш")
			) {
				e.preventDefault();

				const tag = key === "b" || key === "и" ? "**" : "*";
				const { selectionStart, selectionEnd, value } = e.target;
				const selection = value.substring(selectionStart, selectionEnd);

				let newValue;
				let newStart, newEnd;

				const isItalic = tag === "*";
				const isInsideItalicConflict =
					isItalic &&
					selection.startsWith("**") &&
					!selection.startsWith("***");
				const isOutsideItalicConflict =
					isItalic &&
					value.substring(selectionStart - 2, selectionStart) === "**" &&
					value.substring(selectionStart - 3, selectionStart) !== "***";

				if (
					selection.startsWith(tag) &&
					selection.endsWith(tag) &&
					selection.length >= tag.length * 2 &&
					!isInsideItalicConflict
				) {
					newValue =
						value.substring(0, selectionStart) +
						selection.substring(tag.length, selection.length - tag.length) +
						value.substring(selectionEnd);
					newStart = selectionStart;
					newEnd = selectionEnd - tag.length * 2;
				} else if (
					selectionStart >= tag.length &&
					value.substring(selectionStart - tag.length, selectionStart) ===
						tag &&
					value.substring(selectionEnd, selectionEnd + tag.length) === tag &&
					!isOutsideItalicConflict
				) {
					newValue =
						value.substring(0, selectionStart - tag.length) +
						selection +
						value.substring(selectionEnd + tag.length);
					newStart = selectionStart - tag.length;
					newEnd = selectionEnd - tag.length;
				} else {
					newValue =
						value.substring(0, selectionStart) +
						tag +
						selection +
						tag +
						value.substring(selectionEnd);
					newStart = selectionStart + tag.length;
					newEnd = selectionEnd + tag.length;
				}

				if (props.onChange) {
					props.onChange({
						...e,
						target: { ...e.target, value: newValue },
					});
				}

				setTimeout(() => {
					const node = internalRef.current;
					if (node) {
						node.focus();
						node.setSelectionRange(newStart, newEnd);
					}
				}, 0);

				return;
			}

			// Підтримка Ctrl + ] / Ctrl + [
			const isListAdd = key === "]" || key === "ї";
			const isListRemove = key === "[" || key === "х";

			if (type === "textarea" && isMod && (isListAdd || isListRemove)) {
				e.preventDefault();
				const { selectionStart, selectionEnd, value } = e.target;

				const startOfFirstLine =
					value.lastIndexOf("\n", selectionStart - 1) + 1;
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
					}

					if (line.startsWith("- ")) {
						totalShift -= 2;
						if (idx === 0) firstLineShift = -2;
						return line.slice(2);
					}

					return line;
				});

				const newValue = before + newLines.join("\n") + after;

				if (newValue !== value) {
					if (props.onChange) {
						props.onChange({
							...e,
							target: { ...e.target, value: newValue },
						});
					}

					setTimeout(() => {
						const node = internalRef.current;
						if (node) {
							node.focus();
							node.setSelectionRange(
								Math.max(0, selectionStart + firstLineShift),
								Math.max(0, selectionEnd + totalShift),
							);
						}
					}, 0);
				}

				return;
			}

			// Ctrl + 1..6
			const isHeader = !isNaN(key) && key >= "1" && key <= "6";

			if (type === "textarea" && isMod && isHeader) {
				e.preventDefault();
				const level = parseInt(key, 10);
				const headerTag = "#".repeat(level) + " ";
				const { selectionStart, selectionEnd, value } = e.target;

				const startOfFirstLine =
					value.lastIndexOf("\n", selectionStart - 1) + 1;
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
						props.onChange({
							...e,
							target: { ...e.target, value: newValue },
						});
					}

					setTimeout(() => {
						const node = internalRef.current;
						if (node) {
							node.focus();
							node.setSelectionRange(
								Math.max(0, selectionStart + firstLineShift),
								Math.max(0, selectionEnd + totalShift),
							);
						}
					}, 0);
				}

				return;
			}

			// Ctrl + Q
			if (type === "textarea" && isMod && (key === "q" || key === "й")) {
				e.preventDefault();
				const { selectionStart, selectionEnd, value } = e.target;

				const startOfFirstLine =
					value.lastIndexOf("\n", selectionStart - 1) + 1;
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
						props.onChange({
							...e,
							target: { ...e.target, value: newValue },
						});
					}

					setTimeout(() => {
						const node = internalRef.current;
						if (node) {
							node.focus();
							node.setSelectionRange(
								Math.max(0, selectionStart + firstLineShift),
								Math.max(0, selectionEnd + totalShift),
							);
						}
					}, 0);
				}

				return;
			}

			props.onKeyDown?.(e);
		};

		const handlePaste = (e) => {
			if (type !== "textarea") {
				props.onPaste?.(e);
				return;
			}

			const { selectionStart, selectionEnd, value } = e.target;
			const shouldPastePlainText = isRangeInsideSquareBrackets(
				value,
				selectionStart,
				selectionEnd,
			);

			if (!shouldPastePlainText) {
				props.onPaste?.(e);
				return;
			}

			e.preventDefault();

			const plainText = (e.clipboardData.getData("text/plain") || "").replace(
				/\r\n/g,
				"\n",
			);
			const newValue =
				value.substring(0, selectionStart) +
				plainText +
				value.substring(selectionEnd);

			if (props.onChange) {
				props.onChange({
					...e,
					target: { ...e.target, value: newValue },
				});
			}

			const cursor = selectionStart + plainText.length;
			setTimeout(() => {
				const node = internalRef.current;
				if (node) {
					node.focus();
					node.setSelectionRange(cursor, cursor);
				}
			}, 0);
		};

		const baseClass = type === "textarea" ? "Input Input--textarea" : "Input";
		// Додаємо клас для підсвітки спеціального синтаксису, якщо потрібно
		const combinedClassName = classNames(
			baseClass,
			className,
			typeof props.value === "string" &&
				props.value?.includes("[") &&
				"has-mentions",
		);

		if (type === "textarea") {
			const textareaNode = (
				<textarea
					rows={1}
					{...props}
					ref={setRefs}
					className={combinedClassName}
					onKeyDown={handleKeyDown}
					onPaste={handlePaste}
				/>
			);
			if (title) {
				return (
					<Tooltip content={title} className="Input__tooltip">
						{textareaNode}
					</Tooltip>
				);
			}
			return textareaNode;
		}

		const inputNode = (
			<input
				{...props}
				ref={setRefs}
				className={combinedClassName}
				type={type}
				onKeyDown={handleKeyDown}
				onPaste={handlePaste}
			/>
		);
		if (title) {
			return (
				<Tooltip content={title} className="Input__tooltip">
					{inputNode}
				</Tooltip>
			);
		}
		return inputNode;
	},
);

export default Input;

Input.displayName = "Input";
