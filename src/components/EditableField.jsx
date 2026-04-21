import React, { useMemo, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import Input from "./Input";
import Button from "./Button";
import "../assets/components/EditableField.css";

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

		// markdown на початку рядка: #, >, -, *, +, 1.
		if (lineStart) {
			// Детектуємо маркери блоків (заголовки, списки, цитати).
			// Пропускаємо весь префікс (відступ + маркер + пробіли після нього),
			// бо ReactMarkdown не включає їх у текстові вузли контенту.
			const markerMatch = rawValue
				.slice(i)
				.match(/^([ \t]*)(#{1,6}[ \t]+|[-*+][ \t]+|\d+\.[ \t]+|> ?)/);
			if (markerMatch) {
				i += markerMatch[0].length;
				lineStart = false;
				continue;
			}
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

		// жирний ** або __
		if (
			rawValue.slice(i, i + 2) === "**" ||
			rawValue.slice(i, i + 2) === "__"
		) {
			i += 2;
			lineStart = false;
			continue;
		}

		// курсив * або _
		if (char === "*" || char === "_") {
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

/**
 * Конвертує базовий HTML (з Word/LibreOffice) у Markdown.
 */
function convertHtmlToMarkdown(html) {
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");
	return nodesToMarkdown(doc.body)
		.replace(/\u00A0\u00A0\u00A0\u00A0/g, "\t") // Пробуємо детектувати "таби" з пробілів Word
		.replace(/\u00A0/g, " ")
		.replace(/[ \t]+\n/g, "\n") // Видаляємо пробіли в кінці рядків
		.replace(/ {2,}/g, " ") // Схлопуємо лише звичайні пробіли, не чіпаючи \t
		.replace(/\n{3,}/g, "\n\n") // Схлопуємо 3+ переноси до двох
		.replace(/\s+$/g, "") // Чистимо кінець
		.trim();
}

/**
 * Визначає рівень заголовка на основі інлайнового стилю font-size або атрибуту size.
 * Корисно для тексту з Word/LibreOffice, де заголовки часто приходять як <p> або <span> зі стилями.
 */
function getHeaderLevelFromStyle(node) {
	// Підтримка атрибуту size (для <font size="...">)
	const attrSize = node.getAttribute?.("size");
	if (attrSize) {
		const s = parseInt(attrSize);
		if (s >= 6) return 1;
		if (s === 5) return 2;
		if (s === 4) return 3;
	}

	const fontSize = node.style?.fontSize;
	if (!fontSize) return 0;

	const val = parseFloat(fontSize);
	if (isNaN(val)) return 0;

	// Word зазвичай шле pt (поінти). 12pt — звичайний текст.
	// Якщо браузер перерахував у px, 1pt ≈ 1.33px.
	const isPt = fontSize.includes("pt");
	const size = isPt ? val : val * 0.75; // Приводимо px до масштабу pt для порівняння

	if (size >= 20) return 1;
	if (size >= 16) return 2;
	if (size >= 13) return 3;
	return 0;
}

function nodesToMarkdown(node) {
	let result = "";
	node.childNodes.forEach((child) => {
		if (child.nodeType === Node.TEXT_NODE) {
			// Замінюємо переноси рядків на пробіли, щоб уникнути злипання слів при вставці з Word
			result += child.textContent.replace(/\r?\n|\r/g, " ");
		} else if (child.nodeType === Node.ELEMENT_NODE) {
			const tagName = child.tagName.toLowerCase();
			const styleHeaderLevel = getHeaderLevelFromStyle(child);

			// Визначаємо наявність табуляції через стилі (Word часто шле margin/padding)
			const style = child.style || {};
			const indent =
				parseFloat(style.marginLeft || 0) +
				parseFloat(style.paddingLeft || 0) +
				parseFloat(style.textIndent || 0);
			const hasIndent = indent > 15;

			let rawContent = nodesToMarkdown(child);

			// Видаляємо лише вертикальні переноси на початку/в кінці, щоб зберегти \t всередині контенту
			const content = rawContent.replace(/^[\n\r]+|[\n\r]+$/g, "");

			// Відокремлюємо існуючу табуляцію або пробіли на початку тексту
			const leadingWsMatch = content.match(/^([ \t]+)/);
			const leadingWs = leadingWsMatch ? leadingWsMatch[1] : "";
			const actualText = content.slice(leadingWs.length).trim();

			if (!actualText && tagName !== "br") return;

			// Фінальний префікс: комбінуємо відступ стилю та відступ з тексту
			const prefix =
				hasIndent && !leadingWs.includes("\t") ? "\t" + leadingWs : leadingWs;

			if (styleHeaderLevel > 0 && !tagName.match(/^h[1-6]$/)) {
				result += `\n\n${prefix}${"#".repeat(styleHeaderLevel)} ${actualText}\n\n`;
				return;
			}

			switch (tagName) {
				// case "strong":
				case "b":
					result += `${prefix}**${actualText}**`;
					break;
				case "em":
				case "i":
					result += `${prefix}*${actualText}*`;
					break;
				case "h1":
				case "h2":
				case "h3":
				case "h4":
				case "h5":
				case "h6": {
					const level = parseInt(tagName[1]);
					result += `\n\n${prefix}${"#".repeat(level)} ${actualText}\n\n`;
					break;
				}
				case "p":
				case "div":
					result += `\n\n${prefix}${actualText}\n\n`;
					break;
				case "blockquote":
					result += `\n\n${prefix}> ${actualText}\n\n`;
					break;
				case "br":
					result += `\n`;
					break;
				case "ul":
				case "ol":
					result += `\n\n${rawContent}\n\n`;
					break;
				case "li":
					result += `\n- ${prefix}${actualText}`;
					break;
				case "a":
					result += `${prefix}${actualText}`;
					break;
				default:
					result +=
						(hasIndent && !rawContent.startsWith("\t") ? "\t" : "") +
						rawContent;
			}
		}
	});
	return result;
}

export default function EditableField({
	value,
	onChange,
	placeholder,
	className,
	type,
	showCopyButton = false,
	...props
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [initialSelection, setInitialSelection] = useState(null);
	const [copied, setCopied] = useState(false);
	const viewRef = useRef(null);

	const previewMap = useMemo(() => buildPreviewMap(value || ""), [value]);

	const handleCopy = async (e) => {
		e.stopPropagation();
		if (!viewRef.current || !value) return;

		try {
			// Отримуємо відрендерений HTML для Word
			const html = viewRef.current.innerHTML;
			// Markdown як звичайний текст для блокнотів
			const text = value;

			const data = [
				new ClipboardItem({
					"text/html": new Blob([html], { type: "text/html" }),
					"text/plain": new Blob([text], { type: "text/plain" }),
				}),
			];

			await navigator.clipboard.write(data);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy formatted text:", err);
		}
	};

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

			setInitialSelection(selectionData);
			setIsEditing(true);
		}

		props.onClick?.(e);
	};

	const handleKeyDown = (e) => {
		// Для звичайних полів (input) Enter завершує редагування
		if (type !== "textarea" && e.key === "Enter") {
			e.preventDefault();
			setIsEditing(false);
		}
	};

	const handlePaste = (e) => {
		const html = e.clipboardData.getData("text/html");

		if (!html) return; // Якщо немає HTML, працює стандартна вставка тексту

		e.preventDefault();
		const markdown = convertHtmlToMarkdown(html);
		const { selectionStart, selectionEnd, value } = e.target;
		const newValue =
			value.substring(0, selectionStart) +
			markdown +
			value.substring(selectionEnd);

		if (onChange) {
			onChange({
				...e,
				target: { ...e.target, value: newValue },
			});
		}
	};

	const renderMentionText = (text, keyPrefix = "mention") => {
		const parts = text.split(/(\[[^\]]+\])/g);
		return parts.map((part, index) => {
			if (part.startsWith("[") && part.endsWith("]")) {
				const name = part.slice(1, -1);
				return (
					<a
						key={`${keyPrefix}-${index}`}
						className="mention-link"
						onClick={(e) => {
							e.stopPropagation();
							window.dispatchEvent(
								new CustomEvent("open-entity-modal", { detail: { name } }),
							);
						}}>
						{name}
					</a>
				);
			}
			return part;
		});
	};

	const renderMentionChildren = (children, keyPrefix = "mention-node") =>
		React.Children.map(children, (child, index) => {
			const nextKey = `${keyPrefix}-${index}`;
			if (typeof child === "string") {
				return renderMentionText(child, nextKey);
			}
			if (React.isValidElement(child) && child.props?.children) {
				return React.cloneElement(child, {
					...child.props,
					children: renderMentionChildren(child.props.children, nextKey),
				});
			}
			return child;
		});

	const markdownTagsWithMentions = [
		"p",
		"strong",
		"em",
		"del",
		"code",
		"blockquote",
		"li",
		"h1",
		"h2",
		"h3",
		"h4",
		"h5",
		"h6",
		"td",
		"th",
		"a",
		"span",
	];

	const components = Object.fromEntries(
		markdownTagsWithMentions.map((tag) => [
			tag,
			({ children, ...tagProps }) =>
				React.createElement(
					tag,
					tagProps,
					renderMentionChildren(children, `mention-${tag}`),
				),
		]),
	);

	const shortcutsHelp = [
		"Гарячі клавіші:",
		"Ctrl+B — Жирний",
		"Ctrl+I — Курсив",
		"Ctrl+1-6 — Заголовки",
		"Ctrl+] — Список",
		"Ctrl+[ — Зняти список",
		"Ctrl+Q — Цитата",
		"Ctrl+K — Додати посилання на персонажа",
	].map((info) => <div key={info}>{info}</div>);

	if (isEditing) {
		return (
			<Input
				{...props}
				type={type}
				value={value}
				onChange={onChange}
				placeholder={placeholder}
				title={type === "textarea" ? shortcutsHelp : props.title}
				onBlur={() => setIsEditing(false)}
				className={className}
				initialSelection={initialSelection}
				onPaste={handlePaste}
				onClick={handleClick}
				onKeyDown={handleKeyDown}
			/>
		);
	}

	return (
		<div
			className={`EditableField ${className || ""}`}
			onClick={handleClick}
			style={{ position: "relative" }}>
			{!isEditing && value && showCopyButton && (
				<Button
					variant="ghost"
					size="small"
					icon={copied ? "check" : "copy"}
					className="EditableField__copy-btn"
					onClick={handleCopy}
					title="Копіювати форматований текст для Word"
				/>
			)}
			<div className="MarkdownView" ref={viewRef}>
				{value || value === 0 ? (
					type === "textarea" ? (
						<ReactMarkdown components={components}>
							{String(value)
								.replace(
									/(?<!(?:^|\n)- {2}[^\n]*\n)\n(?!\n)|(?<!(?:^|\n)- {2}[^\n]*)\n(?=\n)/g,
									"&nbsp;\n\n",
								)
								.replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;")}
						</ReactMarkdown>
					) : (
						<span>{value}</span>
					)
				) : (
					<span className="muted">{placeholder}</span>
				)}
			</div>
		</div>
	);
}
