import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import Input from "./Input";

const TAB_PREVIEW = "       "; // 7 пробілів, як у тебе зараз

function normalizePreviewText(text = "") {
	return text.replace(/&nbsp;/g, "\u00A0");
}

/**
 * Будує мапу previewOffset -> rawOffset
 * Зберігає твоє поточне preview-представлення:
 * \n => \u00A0 + \n
 * \t => 7 пробілів
 *
 * Також намагається пропускати markdown-маркери,
 * які не видно в preview:
 * **, *, заголовки #, blockquote >, список -
 */
function buildPreviewMap(rawValue = "") {
	const previewToRaw = [];
	let previewText = "";

	let i = 0;
	let lineStart = true;

	const pushPreviewChar = (char, rawIndex) => {
		previewText += char;
		previewToRaw.push(rawIndex);
	};

	while (i < rawValue.length) {
		const char = rawValue[i];

		// \n => NBSP + \n
		if (char === "\n") {
			pushPreviewChar("\u00A0", i);
			pushPreviewChar("\n", i);
			i += 1;
			lineStart = true;
			continue;
		}

		// \t => 7 пробілів
		if (char === "\t") {
			for (let k = 0; k < TAB_PREVIEW.length; k++) {
				pushPreviewChar(" ", i);
			}
			i += 1;
			lineStart = false;
			continue;
		}

		// markdown на початку рядка: #, >, -
		if (lineStart) {
			// heading: #{1,6} + пробіл
			const headingMatch = rawValue.slice(i).match(/^(#{1,6})\s/);
			if (headingMatch) {
				i += headingMatch[0].length;
				lineStart = false;
				continue;
			}

			// quote: >
			if (rawValue.slice(i, i + 2) === "> ") {
				i += 2;
				lineStart = false;
				continue;
			}

			// list: -
			if (rawValue.slice(i, i + 2) === "- ") {
				i += 2;
				lineStart = false;
				continue;
			}
		}

		// жирний **
		if (rawValue.slice(i, i + 2) === "**") {
			i += 2;
			lineStart = false;
			continue;
		}

		// курсив *
		if (char === "*") {
			i += 1;
			lineStart = false;
			continue;
		}

		pushPreviewChar(char, i);
		lineStart = false;
		i += 1;
	}

	return { previewText, previewToRaw };
}

function getCaretDataFromPoint(x, y) {
	if (document.caretRangeFromPoint) {
		const range = document.caretRangeFromPoint(x, y);
		if (!range) return null;

		return {
			node: range.startContainer,
			offset: range.startOffset,
		};
	}

	if (document.caretPositionFromPoint) {
		const pos = document.caretPositionFromPoint(x, y);
		if (!pos) return null;

		return {
			node: pos.offsetNode,
			offset: pos.offset,
		};
	}

	return null;
}

function getAbsolutePreviewOffset(container, targetNode, targetOffset) {
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
	let total = 0;
	let current;

	while ((current = walker.nextNode())) {
		const text = normalizePreviewText(current.textContent || "");

		if (current === targetNode) {
			const localOffset = normalizePreviewText(
				(current.textContent || "").slice(0, targetOffset),
			).length;
			return total + localOffset;
		}

		total += text.length;
	}

	return total;
}

export default function EditableField({
	value,
	onChange,
	placeholder,
	className,
	type,
	...props
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [initialSelection, setInitialSelection] = useState(null);
	const [initialHeight, setInitialHeight] = useState(null);

	const previewMap = useMemo(() => buildPreviewMap(value || ""), [value]);

	const handleClick = (e) => {
		e.stopPropagation();

		if (!isEditing) {
			const container = e.currentTarget.querySelector(".MarkdownView");
			const caret = getCaretDataFromPoint(e.clientX, e.clientY);

			let selectionData = { index: value?.length || 0 };

			if (
				container &&
				caret &&
				caret.node &&
				container.contains(caret.node) &&
				caret.node.nodeType === Node.TEXT_NODE
			) {
				const previewOffset = getAbsolutePreviewOffset(
					container,
					caret.node,
					caret.offset,
				);

				selectionData = {
					previewOffset: Math.max(0, previewOffset),
					previewToRaw: previewMap.previewToRaw,
				};
			}

			const rect = e.currentTarget.getBoundingClientRect();
			setInitialHeight(rect.height);
			setInitialSelection(selectionData);
			setIsEditing(true);
		}

		props.onClick?.(e);
	};

	const shortcutsHelp = [
		"Гарячі клавіші:",
		"Ctrl+B — Жирний",
		"Ctrl+I — Курсив",
		"Ctrl+1-6 — Заголовки",
		"Ctrl+] — Список",
		"Ctrl+[ — Зняти список",
		"Ctrl+Q — Цитата",
	].join("\n");

	if (isEditing) {
		return (
			<Input
				{...props}
				type={type}
				value={value}
				onChange={onChange}
				placeholder={placeholder}
				title={shortcutsHelp}
				onBlur={() => setIsEditing(false)}
				className={className}
				initialSelection={initialSelection}
				initialHeight={initialHeight}
			/>
		);
	}

	return (
		<div className={`EditableField ${className || ""}`} onClick={handleClick}>
			<div className="MarkdownView">
				{value ? (
					<ReactMarkdown>
						{value
							.replace(/\n/g, "&nbsp; \n")
							.replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;")}
					</ReactMarkdown>
				) : (
					<span className="muted">{placeholder}</span>
				)}
			</div>
		</div>
	);
}
