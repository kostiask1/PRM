import {
	useCallback,
	useContext,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import Button from "./Button";
import "../../assets/components/EditableField.css";
import classNames from "../../utils/classNames";
import { lang } from "../../services/localization";
import { openMentionPickerAction } from "../../actions/app";
import { useAppDispatch } from "../../store/appStore";
import { parseUrl } from "../../utils/navigation";
import EntityModal from "../common/EntityModal";
import Tooltip from "../common/Tooltip";
import { resolveEntityByName } from "../../services/entities.js";
import {
	EntityLinkContext,
	EntityLinkResolverContext,
	getEntityIdentity,
	isSameEntityIdentity,
} from "../common/EntityLinkIdentity";

const MENTION_CLASS = "mention_link EditableField__mention";
const MENTION_TOOLTIP_KEY = "Ctrl+click to open entity";
const TAB_CLASS = "EditableField__tab";
const INSERTION_MARKER_CLASS = "EditableField__insertionMarker";
const CARET_ANCHOR_CLASS = "EditableField__caretAnchor";

function requestMentionSelection(dispatch) {
	return new Promise((resolve) => {
		dispatch(
			openMentionPickerAction({
				select: (name) => resolve({ status: "selected", name: name || "" }),
				cancel: () => resolve({ status: "cancelled" }),
			}),
		);
	});
}

function escapeHtml(value = "") {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function escapeAttribute(value = "") {
	return escapeHtml(value).replace(/`/g, "&#96;");
}

function renderText(value = "") {
	return escapeHtml(value)
		.replace(
			/\t/g,
			`<span class="${TAB_CLASS}" data-tab="true" contenteditable="false">&nbsp;</span>`,
		)
		.replace(/\r?\n/g, "<br>");
}

function renderMention(name) {
	const safeName = String(name || "").trim();
	if (!safeName) return "";

	return `<span class="${MENTION_CLASS}" data-mention="${escapeAttribute(
		safeName,
	)}" data-mention-tooltip="${escapeAttribute(
		lang.t(MENTION_TOOLTIP_KEY),
	)}" contenteditable="false">${escapeHtml(safeName)}</span>`;
}

function withLeadingCaretAnchor(html = "") {
	if (!html.startsWith(`<span class="${MENTION_CLASS}"`)) return html;

	return `<span class="${CARET_ANCHOR_CLASS}" data-caret-anchor="true">\u200B</span>${html}`;
}

function renderInlineMarkdown(markdown = "") {
	const source = String(markdown || "");
	const tokenRegex =
		/(\[[^\]\n]+\])|(\*\*([^*\n]+)\*\*)|(__([^_\n]+)__)|(\*([^*\n]+)\*)|(_([^_\n]+)_)/g;
	let html = "";
	let lastIndex = 0;
	let match;

	while ((match = tokenRegex.exec(source)) !== null) {
		html += renderText(source.slice(lastIndex, match.index));

		if (match[1]) {
			html += renderMention(match[1].slice(1, -1));
		} else if (match[3] || match[5]) {
			html += `<strong>${renderInlineMarkdown(match[3] || match[5])}</strong>`;
		} else if (match[7] || match[9]) {
			html += `<em>${renderInlineMarkdown(match[7] || match[9])}</em>`;
		}

		lastIndex = match.index + match[0].length;
	}

	html += renderText(source.slice(lastIndex));
	return html;
}

function markdownToHtml(markdown = "", type = "text") {
	const source = String(markdown ?? "").replace(/\r\n?/g, "\n");

	if (type !== "textarea") {
		return renderText(source.replace(/\n+/g, " "));
	}

	if (!source) return "";

	const lines = source.split("\n");
	const html = [];
	let paragraph = [];

	const flushParagraph = () => {
		if (paragraph.length === 0) return;
		if (!paragraph.some((line) => line.trim() || line.includes("\t"))) {
			paragraph = [];
			return;
		}
		html.push(`<p>${renderInlineMarkdown(paragraph.join("\n"))}</p>`);
		paragraph = [];
	};

	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i];
		const headingMatch = line.match(/^(#{1,6})[ \t]+(.+)$/);
		const unorderedMatch = line.match(/^[ \t]*[-*+][ \t]+(.+)$/);
		const orderedMatch = line.match(/^[ \t]*\d+\.[ \t]+(.+)$/);
		const quoteMatch = line.match(/^[ \t]*>[ \t]?(.*)$/);

		if (!line.trim() && !line.includes("\t")) {
			paragraph.push("");
			continue;
		}

		if (headingMatch) {
			flushParagraph();
			const level = Math.min(headingMatch[1].length, 6);
			html.push(
				`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`,
			);
			continue;
		}

		if (unorderedMatch || orderedMatch) {
			flushParagraph();
			const isOrdered = Boolean(orderedMatch);
			const tag = isOrdered ? "ol" : "ul";
			const items = [];

			while (i < lines.length) {
				const itemMatch = isOrdered
					? lines[i].match(/^[ \t]*\d+\.[ \t]+(.+)$/)
					: lines[i].match(/^[ \t]*[-*+][ \t]+(.+)$/);
				if (!itemMatch) break;
				items.push(`<li>${renderInlineMarkdown(itemMatch[1])}</li>`);
				i += 1;
			}

			i -= 1;
			html.push(`<${tag}>${items.join("")}</${tag}>`);
			continue;
		}

		if (quoteMatch) {
			flushParagraph();
			const quoteLines = [];

			while (i < lines.length) {
				const currentQuote = lines[i].match(/^[ \t]*>[ \t]?(.*)$/);
				if (!currentQuote) break;
				quoteLines.push(currentQuote[1]);
				i += 1;
			}

			i -= 1;
			html.push(
				`<blockquote>${renderInlineMarkdown(quoteLines.join("\n"))}</blockquote>`,
			);
			continue;
		}

		paragraph.push(line);
	}

	flushParagraph();
	return withLeadingCaretAnchor(html.join(""));
}

function normalizeTextContent(value = "") {
	return String(value || "")
		.replace(/\u200B/g, "")
		.replace(/\uFEFF/g, "")
		.replace(/\u00A0/g, " ");
}

function normalizeMarkdown(value = "", type = "textarea") {
	const normalized = normalizeTextContent(value).replace(/\r\n?/g, "\n");

	if (type !== "textarea") {
		return normalized.replace(/\n+/g, " ").trim();
	}

	return normalized
		.split("\n")
		.map((line) => line.replace(/ +$/g, ""))
		.join("\n")
		.replace(/^\n+|\n+$/g, "");
}

function childrenToMarkdown(node, options = {}) {
	return Array.from(node.childNodes || [])
		.map((child) => nodeToMarkdown(child, options))
		.join("");
}

function blockMarkdown(content = "") {
	const normalized = normalizeTextContent(content)
		.split("\n")
		.map((line) => line.replace(/ +$/g, ""))
		.join("\n")
		.replace(/^\n/, "");

	if (!normalized.replace(/\n/g, "").trim()) return "";
	return normalized.endsWith("\n") ? `${normalized}\n` : `${normalized}\n\n`;
}

function headingMarkdown(content = "") {
	const normalized = normalizeTextContent(content)
		.split("\n")
		.map((line) => line.replace(/ +$/g, ""))
		.join("\n")
		.trim();

	return normalized ? `${normalized}\n` : "";
}

function inlineMarkdown(node, options = {}) {
	return childrenToMarkdown(node, { ...options, inline: true });
}

function serializeList(listNode, ordered = false) {
	const items = Array.from(listNode.children || []).filter(
		(child) => child.tagName?.toLowerCase() === "li",
	);

	return (
		items
			.map((item, index) => {
				const marker = ordered ? `${index + 1}.` : "-";
				const content = inlineMarkdown(item)
					.trim()
					.replace(/\n{2,}/g, "\n")
					.split("\n")
					.map((line, lineIndex) => (lineIndex === 0 ? line : `  ${line}`))
					.join("\n");
				return `${marker} ${content}`.trimEnd();
			})
			.join("\n") + "\n\n"
	);
}

function getHeaderLevelFromStyle(node) {
	const attrSize = node.getAttribute?.("size");
	if (attrSize) {
		const size = parseInt(attrSize, 10);
		if (size >= 6) return 1;
		if (size === 5) return 2;
		if (size === 4) return 3;
	}

	const fontSize = node.style?.fontSize;
	if (!fontSize) return 0;

	const value = parseFloat(fontSize);
	if (isNaN(value)) return 0;

	const isPt = fontSize.includes("pt");
	const size = isPt ? value : value * 0.75;

	if (size >= 20) return 1;
	if (size >= 16) return 2;
	if (size >= 13) return 3;
	return 0;
}

function hasNormalFontWeight(element) {
	const fontWeight = element.style?.fontWeight;
	if (!fontWeight) return false;

	const normalized = fontWeight.trim().toLowerCase();
	if (normalized === "normal" || normalized === "lighter") return true;

	const value = parseInt(normalized, 10);
	return Number.isFinite(value) && value < 600;
}

function hasNormalFontStyle(element) {
	const fontStyle = element.style?.fontStyle;
	if (!fontStyle) return false;

	return fontStyle.trim().toLowerCase() === "normal";
}

function nodeToMarkdown(node, options = {}) {
	if (node.nodeType === Node.TEXT_NODE) {
		return normalizeTextContent(node.textContent || "");
	}

	if (node.nodeType !== Node.ELEMENT_NODE) {
		return "";
	}

	const element = node;
	const tagName = element.tagName.toLowerCase();
	const mentionName = element.dataset?.mention;
	const childOptions = {
		...options,
		suppressBold: options.suppressBold || hasNormalFontWeight(element),
		suppressItalic: options.suppressItalic || hasNormalFontStyle(element),
	};

	if (element.dataset?.insertionMarker === "true") {
		return "";
	}

	if (element.dataset?.caretAnchor === "true") {
		return "";
	}

	if (element.dataset?.tab === "true") {
		return "\t";
	}

	if (mentionName) {
		return `[${normalizeTextContent(mentionName).trim()}]`;
	}

	if (tagName === "br") {
		return "\n";
	}

	if (tagName === "strong" || tagName === "b") {
		const content = inlineMarkdown(element, childOptions);
		return childOptions.suppressBold ? content : `**${content}**`;
	}

	if (tagName === "em" || tagName === "i") {
		const content = inlineMarkdown(element, childOptions);
		return childOptions.suppressItalic ? content : `*${content}*`;
	}

	if (tagName === "a" && element.classList.contains("mention_link")) {
		return `[${normalizeTextContent(element.textContent || "").trim()}]`;
	}

	if (tagName === "span" || tagName === "a") {
		return inlineMarkdown(element, childOptions);
	}

	if (tagName === "ul" || tagName === "ol") {
		return serializeList(element, tagName === "ol");
	}

	if (tagName === "li") {
		const content = inlineMarkdown(element, childOptions);
		return options.inline ? content : blockMarkdown(content);
	}

	const styledHeaderLevel = getHeaderLevelFromStyle(element);
	if (styledHeaderLevel > 0 && !/^h[1-6]$/.test(tagName)) {
		const content = inlineMarkdown(element, childOptions).trim();
		if (!content) return "";
		return headingMarkdown(`${"#".repeat(styledHeaderLevel)} ${content}`);
	}

	if (/^h[1-6]$/.test(tagName)) {
		const level = parseInt(tagName[1], 10);
		const content = inlineMarkdown(element, childOptions).trim();
		if (!content) return "";
		return headingMarkdown(`${"#".repeat(level)} ${content}`);
	}

	if (tagName === "blockquote") {
		const quote = normalizeMarkdown(
			childrenToMarkdown(element, childOptions),
			"textarea",
		);
		return blockMarkdown(
			quote
				.split("\n")
				.map((line) => `> ${line}`)
				.join("\n"),
		);
	}

	if (tagName === "p" || tagName === "div") {
		const content = inlineMarkdown(element, childOptions);
		if (
			!options.inline &&
			content.includes("\n") &&
			!normalizeTextContent(content).replace(/\n/g, "").trim()
		) {
			return "\n";
		}
		return options.inline ? content : blockMarkdown(content);
	}

	return childrenToMarkdown(element, childOptions);
}

function editorToMarkdown(editor, type = "text") {
	if (!editor) return "";

	if (type !== "textarea") {
		return normalizeMarkdown(editor.textContent || "", type);
	}

	return normalizeMarkdown(childrenToMarkdown(editor), type);
}

function convertHtmlToMarkdown(html) {
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");
	return normalizeMarkdown(childrenToMarkdown(doc.body), "textarea");
}

function createChangeEvent(sourceEvent, value) {
	return {
		...sourceEvent,
		target: {
			...sourceEvent.target,
			value,
		},
		currentTarget: {
			...sourceEvent.currentTarget,
			value,
		},
	};
}

function getSelectionRangeInside(editor) {
	const selection = window.getSelection?.();
	if (!selection || selection.rangeCount === 0) return null;

	const range = selection.getRangeAt(0);
	if (!editor.contains(range.commonAncestorContainer)) return null;

	return range;
}

function getElementFromNode(node) {
	if (!node) return null;
	return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
}

function getMentionFromSelection(editor, key = "") {
	const selection = window.getSelection?.();
	if (!selection || selection.rangeCount === 0 || !editor) return null;

	const range = selection.getRangeAt(0);
	if (!editor.contains(range.commonAncestorContainer)) return null;

	const anchorMention = getElementFromNode(selection.anchorNode)?.closest?.(
		"[data-mention]",
	);
	if (anchorMention && editor.contains(anchorMention)) return anchorMention;

	const focusMention = getElementFromNode(selection.focusNode)?.closest?.(
		"[data-mention]",
	);
	if (focusMention && editor.contains(focusMention)) return focusMention;

	const mentions = Array.from(editor.querySelectorAll("[data-mention]"));
	const intersectedMention = mentions.find((mention) => {
		try {
			return range.intersectsNode(mention);
		} catch {
			return false;
		}
	});
	if (intersectedMention) return intersectedMention;

	if (!range.collapsed) return null;

	const container = range.startContainer;
	const offset = range.startOffset;
	if (container.nodeType === Node.ELEMENT_NODE) {
		const child = container.childNodes[offset + (key === "backspace" ? -1 : 0)];
		return child?.nodeType === Node.ELEMENT_NODE && child.dataset?.mention
			? child
			: null;
	}

	if (key === "backspace" && offset === 0) {
		const prev = container.previousSibling;
		return prev?.nodeType === Node.ELEMENT_NODE && prev.dataset?.mention
			? prev
			: null;
	}

	if (key === "delete" && offset === (container.textContent || "").length) {
		const next = container.nextSibling;
		return next?.nodeType === Node.ELEMENT_NODE && next.dataset?.mention
			? next
			: null;
	}

	return null;
}

function isRangeInsideEditor(editor, range) {
	if (!editor || !range) return false;
	return (
		editor.contains(range.startContainer) && editor.contains(range.endContainer)
	);
}

function selectRange(range) {
	const selection = window.getSelection?.();
	if (!selection || !range) return false;

	selection.removeAllRanges();
	selection.addRange(range);
	return true;
}

function getRangeMarkdownOffset(editor, range) {
	if (!isRangeInsideEditor(editor, range)) return null;

	const beforeRange = range.cloneRange();
	beforeRange.selectNodeContents(editor);
	beforeRange.setEnd(range.startContainer, range.startOffset);

	const container = document.createElement("div");
	container.append(beforeRange.cloneContents());
	return childrenToMarkdown(container).length;
}

function createRangeFromMarkdownOffset(editor, offset) {
	if (!Number.isFinite(offset)) return null;

	const range = document.createRange();
	let remaining = Math.max(0, offset);
	let fallbackNode = editor;

	const placeBefore = (node) => {
		range.setStartBefore(node);
		range.collapse(true);
		return range;
	};

	const placeAfter = (node) => {
		range.setStartAfter(node);
		range.collapse(true);
		fallbackNode = node;
		return range;
	};

	const walk = (node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = normalizeTextContent(node.textContent || "");
			if (remaining <= text.length) {
				range.setStart(node, Math.min(remaining, node.textContent.length));
				range.collapse(true);
				return range;
			}
			remaining -= text.length;
			fallbackNode = node;
			return null;
		}

		if (node.nodeType !== Node.ELEMENT_NODE) return null;

		const element = node;
		const atomicValue =
			element.dataset?.tab === "true"
				? "\t"
				: element.dataset?.mention
					? `[${normalizeTextContent(element.dataset.mention).trim()}]`
					: element.tagName?.toLowerCase() === "br"
						? "\n"
						: null;

		if (atomicValue !== null) {
			if (remaining <= 0) return placeBefore(element);
			if (remaining <= atomicValue.length) return placeAfter(element);
			remaining -= atomicValue.length;
			fallbackNode = element;
			return null;
		}

		for (const child of Array.from(element.childNodes || [])) {
			const found = walk(child);
			if (found) return found;
		}

		return null;
	};

	const found = walk(editor);
	if (found) return found;

	if (fallbackNode && fallbackNode !== editor) return placeAfter(fallbackNode);
	return createEndRange(editor);
}

function getInsertionRange(
	editor,
	preferredRange = null,
	preferredOffset = null,
) {
	if (isRangeInsideEditor(editor, preferredRange)) {
		return preferredRange.cloneRange();
	}

	const offsetRange = createRangeFromMarkdownOffset(editor, preferredOffset);
	if (offsetRange) return offsetRange;

	const selectionRange = getSelectionRangeInside(editor);
	if (selectionRange) return selectionRange.cloneRange();

	return createEndRange(editor);
}

function setCaretAfter(node) {
	const range = document.createRange();
	const selection = window.getSelection?.();
	if (!selection) return;

	range.setStartAfter(node);
	range.collapse(true);
	selection.removeAllRanges();
	selection.addRange(range);
}

function setCaretInsideTextNode(node, offset = 0) {
	const range = document.createRange();
	range.setStart(node, Math.min(offset, node.length));
	range.collapse(true);
	selectRange(range);
}

function selectTextNode(node) {
	const range = document.createRange();
	range.selectNodeContents(node);
	selectRange(range);
}

function createEndRange(editor) {
	const range = document.createRange();
	range.selectNodeContents(editor);
	range.collapse(false);
	return range;
}

function insertNodeAtSelection(
	editor,
	node,
	preferredRange = null,
	preferredOffset = null,
) {
	editor.focus({ preventScroll: true });

	const range = getInsertionRange(editor, preferredRange, preferredOffset);
	range.deleteContents();
	range.insertNode(node);
	setCaretAfter(node);
}

function createInsertionMarker(id) {
	const marker = document.createElement("span");
	marker.className = INSERTION_MARKER_CLASS;
	marker.dataset.insertionMarker = "true";
	marker.dataset.insertionMarkerId = id;
	marker.contentEditable = "false";
	marker.textContent = "\u200B";
	return marker;
}

function getInsertionMarker(editor, id) {
	if (!editor || !id) return null;
	return (
		Array.from(editor.querySelectorAll("[data-insertion-marker='true']")).find(
			(marker) => marker.dataset.insertionMarkerId === id,
		) || null
	);
}

function getInsertionMarkerRange(editor, id) {
	const marker = getInsertionMarker(editor, id);
	if (!marker) return null;

	const range = document.createRange();
	range.selectNode(marker);
	return range;
}

function removeInsertionMarker(editor, id) {
	const marker = getInsertionMarker(editor, id);
	marker?.remove();
}

function insertInsertionMarker(editor, id, preferredRange = null) {
	if (!editor || !id) return;
	insertNodeAtSelection(editor, createInsertionMarker(id), preferredRange);
}

function insertHtmlAtSelection(editor, html) {
	if (!html) return;

	editor.focus({ preventScroll: true });

	const range = getSelectionRangeInside(editor) || createEndRange(editor);
	const template = document.createElement("template");
	template.innerHTML = html;
	const fragment = template.content;
	const lastNode = fragment.lastChild;

	range.deleteContents();
	range.insertNode(fragment);
	if (lastNode) setCaretAfter(lastNode);
}

function insertTextAtSelection(editor, text) {
	if (!text) return;

	insertNodeAtSelection(editor, document.createTextNode(text));
}

function createTabNode() {
	const tab = document.createElement("span");
	tab.className = TAB_CLASS;
	tab.dataset.tab = "true";
	tab.contentEditable = "false";
	tab.innerHTML = "&nbsp;";
	return tab;
}

function insertTabAtSelection(
	editor,
	preferredRange = null,
	preferredOffset = null,
) {
	if (!editor) return;

	editor.focus({ preventScroll: true });

	const tab = createTabNode();
	const caretNode = document.createTextNode("\u200B");
	const range = getInsertionRange(editor, preferredRange, preferredOffset);
	const fragment = document.createDocumentFragment();
	fragment.append(tab, caretNode);

	range.deleteContents();
	range.insertNode(fragment);
	setCaretInsideTextNode(caretNode, caretNode.length);
}

function insertMentionAtSelection(
	editor,
	name,
	preferredRange = null,
	preferredOffset = null,
) {
	const safeName = String(name || "").trim();
	if (!editor || !safeName) return;

	const mention = document.createElement("span");
	mention.className = MENTION_CLASS;
	mention.dataset.mention = safeName;
	mention.dataset.mentionTooltip = lang.t(MENTION_TOOLTIP_KEY);
	mention.contentEditable = "false";
	mention.textContent = safeName;

	const trailingSpace = document.createTextNode(" ");
	const range = getInsertionRange(editor, preferredRange, preferredOffset);
	const fragment = document.createDocumentFragment();
	fragment.append(mention, trailingSpace);

	editor.focus({ preventScroll: true });
	range.deleteContents();
	range.insertNode(fragment);
	setCaretAfter(trailingSpace);
}

function unwrapMention(editor, mention, { selectText = false } = {}) {
	if (!editor || !mention?.dataset?.mention) return false;

	const text = normalizeTextContent(
		mention.dataset.mention || mention.textContent || "",
	);
	const textNode = document.createTextNode(text);
	mention.replaceWith(textNode);
	editor.focus({ preventScroll: true });
	if (selectText) {
		selectTextNode(textNode);
	} else {
		setCaretInsideTextNode(textNode, textNode.length);
	}
	return true;
}

function removeMention(editor, mention) {
	if (!editor || !mention?.dataset?.mention) return false;

	const range = document.createRange();
	range.setStartBefore(mention);
	range.collapse(true);
	mention.remove();
	editor.focus({ preventScroll: true });
	selectRange(range);
	return true;
}

function setCaretFromTabClick(tab, event) {
	if (!tab) return;

	const rect = tab.getBoundingClientRect();
	const range = document.createRange();
	const setBefore = event.clientX < rect.left + rect.width / 2;

	if (setBefore) {
		range.setStartBefore(tab);
	} else {
		const next = tab.nextSibling;
		if (next?.nodeType === Node.TEXT_NODE && next.textContent === "\u200B") {
			range.setStart(next, next.length);
		} else {
			range.setStartAfter(tab);
		}
	}

	range.collapse(true);
	selectRange(range);
}

function getSelectionElement(editor) {
	const selection = window.getSelection?.();
	if (!selection || selection.rangeCount === 0) return null;

	const node = selection.anchorNode;
	const element =
		node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
	if (!element || !editor.contains(element)) return null;

	return element;
}

function getCurrentBlockElement(editor) {
	const element = getSelectionElement(editor);
	if (!element) return null;

	const block = element.closest?.("p, h1, h2, h3, h4, h5, h6, blockquote");
	if (block && editor.contains(block)) return block;

	return element === editor ? null : element;
}

function isSelectionInsideTag(editor, tagName) {
	const element = getSelectionElement(editor);
	return Boolean(element?.closest?.(tagName));
}

function isSelectionInsideList(editor) {
	const element = getSelectionElement(editor);
	return element?.closest?.("ul, ol") || null;
}

function cloneEditorHtml(editor) {
	const clone = editor.cloneNode(true);
	clone.removeAttribute("contenteditable");
	clone.querySelectorAll("[contenteditable]").forEach((node) => {
		node.removeAttribute("contenteditable");
	});
	clone.querySelectorAll("[data-insertion-marker]").forEach((node) => {
		node.remove();
	});
	clone.querySelectorAll("[data-mention]").forEach((node) => {
		node.removeAttribute("data-mention");
	});
	clone.querySelectorAll("[data-mention-tooltip]").forEach((node) => {
		node.removeAttribute("data-mention-tooltip");
		node.removeAttribute("title");
	});
	return clone.innerHTML;
}

function replaceElementTag(element, tagName) {
	if (!element || element.tagName?.toLowerCase() === tagName) return element;

	const replacement = document.createElement(tagName);
	while (element.firstChild) {
		replacement.appendChild(element.firstChild);
	}
	element.replaceWith(replacement);
	return replacement;
}

export default function EditableField({
	value,
	onChange,
	placeholder,
	className,
	type = "text",
	showCopyButton = false,
	campaignSlug,
	...props
}) {
	const {
		onBlur,
		onClick,
		onFocus,
		onInput,
		onKeyDown,
		onPaste,
		title,
		disabled,
		readOnly,
		...domProps
	} = props;
	const dispatch = useAppDispatch();
	const currentEntityIdentity = useContext(EntityLinkContext);
	const scopedEntityLinks = useContext(EntityLinkResolverContext);
	const [isActive, setIsActive] = useState(false);
	const [copied, setCopied] = useState(false);
	const [modalState, setModalState] = useState(null);
	const [mentionTooltip, setMentionTooltip] = useState({
		content: null,
		anchor: null,
	});
	const editorRef = useRef(null);
	const lastValueRef = useRef("");
	const mentionInsertionRangeRef = useRef(null);
	const mentionInsertionOffsetRef = useRef(null);
	const mentionInsertionMarkerIdRef = useRef(null);
	const markdownValue = value || value === 0 ? String(value) : "";
	const isDisabled = Boolean(disabled || readOnly);
	const fieldTooltipContent = useMemo(() => {
		if (typeof title === "string" && title.trim()) return title;
		return null;
	}, [title]);
	const tooltipContent = mentionTooltip.content || fieldTooltipContent;
	const tooltipAnchor = mentionTooltip.anchor || null;

	const resolvedCampaignSlug = useMemo(
		() => campaignSlug || parseUrl().campaign,
		[campaignSlug],
	);

	const htmlValue = useMemo(
		() => markdownToHtml(markdownValue, type),
		[markdownValue, type],
	);

	const emitChange = useCallback(
		(sourceEvent) => {
			const editor = editorRef.current;
			if (!editor) return;

			const nextValue = editorToMarkdown(editor, type);
			if (!nextValue) editor.innerHTML = "";
			if (nextValue === lastValueRef.current) return;

			lastValueRef.current = nextValue;
			onChange?.(createChangeEvent(sourceEvent, nextValue));
		},
		[onChange, type],
	);

	useLayoutEffect(() => {
		lastValueRef.current = markdownValue;
	}, [markdownValue]);

	useLayoutEffect(() => {
		const editor = editorRef.current;
		if (!editor) return;

		if (
			mentionInsertionMarkerIdRef.current &&
			getInsertionMarker(editor, mentionInsertionMarkerIdRef.current)
		) {
			return;
		}

		const isFocused = document.activeElement === editor;
		const currentValue = editorToMarkdown(editor, type);

		if (isActive && isFocused && currentValue === markdownValue) return;
		if (editor.innerHTML !== htmlValue) {
			editor.innerHTML = htmlValue;
		}
	}, [htmlValue, isActive, markdownValue, type]);

	const handleCopy = async (event) => {
		event.preventDefault();
		event.stopPropagation();

		const editor = editorRef.current;
		if (!editor || !markdownValue) return;

		try {
			const html = cloneEditorHtml(editor);
			const text = markdownValue;

			await navigator.clipboard.write([
				new ClipboardItem({
					"text/html": new Blob([html], { type: "text/html" }),
					"text/plain": new Blob([text], { type: "text/plain" }),
				}),
			]);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (error) {
			console.error("Failed to copy formatted text:", error);
		}
	};

	const handleFocus = (event) => {
		event.stopPropagation();
		setIsActive(true);
		onFocus?.(event);
	};

	const handleBlur = (event) => {
		emitChange(event);
		setIsActive(false);
		onBlur?.(event);
	};

	const handleCloseMentionModal = useCallback(() => setModalState(null), []);

	const openMentionModal = useCallback(
		async (mentionName) => {
			if (!resolvedCampaignSlug || !mentionName) return;

			try {
				const found =
					scopedEntityLinks?.resolveEntityByName?.(mentionName) ||
					(await resolveEntityByName(resolvedCampaignSlug, mentionName));
				if (!found) return;

				const foundIdentity = getEntityIdentity(
					found.entity,
					found.type,
					found.scope,
				);
				if (
					isSameEntityIdentity(foundIdentity, currentEntityIdentity) ||
					isSameEntityIdentity(
						foundIdentity,
						modalState
							? getEntityIdentity(
									modalState.entity,
									modalState.type,
									modalState.scope,
								)
							: null,
					)
				) {
					return;
				}

				setModalState({
					entity: found.entity,
					type: found.type,
				});
			} catch (error) {
				console.error("Failed to open entity mention modal", error);
			}
		},
		[
			resolvedCampaignSlug,
			currentEntityIdentity,
			modalState,
			scopedEntityLinks,
		],
	);

	const handleClick = (event) => {
		const mention = event.target.closest?.("[data-mention]");
		if (
			mention &&
			editorRef.current?.contains(mention) &&
			(event.ctrlKey || event.metaKey)
		) {
			event.preventDefault();
			event.stopPropagation();
			openMentionModal(mention.dataset.mention);
			return;
		}

		if (event.target.closest?.("a")) {
			event.preventDefault();
		}
		event.stopPropagation();
		onClick?.(event);
	};

	const stopEditorEvent = (event) => {
		event.stopPropagation();
	};

	const handleInput = (event) => {
		event.stopPropagation();
		emitChange(event);
		onInput?.(event);
	};

	const runCommand = (event, command, commandValue = null) => {
		event.preventDefault();
		document.execCommand(command, false, commandValue);
		emitChange(event);
	};

	const runFormatBlockCommand = (event, tagName) => {
		runCommand(event, "formatBlock", `<${tagName}>`);
	};

	const replaceCurrentBlock = (event, tagName) => {
		event.preventDefault();

		const editor = editorRef.current;
		const block = getCurrentBlockElement(editor);
		if (!block || block === editor) {
			document.execCommand("formatBlock", false, `<${tagName}>`);
			emitChange(event);
			return;
		}

		const range = getSelectionRangeInside(editor)?.cloneRange();
		const nextBlock = replaceElementTag(block, tagName);
		if (range) {
			selectRange(range);
		} else {
			const nextRange = document.createRange();
			nextRange.selectNodeContents(nextBlock);
			nextRange.collapse(false);
			selectRange(nextRange);
		}
		emitChange(event);
	};

	const handleMentionShortcut = async (event) => {
		const editor = editorRef.current;
		if (!editor) return;

		event.preventDefault();

		const selectedMention = getMentionFromSelection(editor);
		if (selectedMention) {
			unwrapMention(editor, selectedMention, { selectText: true });
			emitChange(event);
			return;
		}

		const currentRange = getSelectionRangeInside(editor);
		const insertionRange = currentRange?.cloneRange() || null;
		const insertionOffset = getRangeMarkdownOffset(editor, insertionRange);
		const selection = window.getSelection?.();
		const selectedText =
			selection && editor.contains(selection.anchorNode)
				? selection.toString().trim()
				: "";

		if (selectedText) {
			insertMentionAtSelection(
				editor,
				selectedText,
				insertionRange,
				insertionOffset,
			);
			emitChange(event);
			return;
		}

		const markerId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
		insertInsertionMarker(editor, markerId, insertionRange);
		mentionInsertionRangeRef.current = insertionRange;
		mentionInsertionOffsetRef.current = insertionOffset;
		mentionInsertionMarkerIdRef.current = markerId;
		const result = await requestMentionSelection(dispatch);
		const savedMarkerId = mentionInsertionMarkerIdRef.current;
		const savedRange = mentionInsertionRangeRef.current;
		const savedOffset = mentionInsertionOffsetRef.current;
		mentionInsertionRangeRef.current = null;
		mentionInsertionOffsetRef.current = null;
		mentionInsertionMarkerIdRef.current = null;

		if (result.status !== "selected") {
			removeInsertionMarker(editor, savedMarkerId);
			return;
		}

		const markerRange = getInsertionMarkerRange(editor, savedMarkerId);
		insertMentionAtSelection(
			editor,
			result.name,
			markerRange || savedRange,
			savedOffset,
		);
		emitChange(event);
	};

	const handleKeyDown = (event) => {
		const key = event.key.toLowerCase();
		const isMod = event.ctrlKey || event.metaKey;
		const isHistoryShortcut =
			isMod && (key === "z" || key === "я" || key === "y" || key === "н");

		if (isHistoryShortcut) {
			onKeyDown?.(event);
			return;
		}

		event.stopPropagation();

		if (isDisabled) {
			onKeyDown?.(event);
			return;
		}

		if (type !== "textarea" && event.key === "Enter") {
			event.preventDefault();
			editorRef.current?.blur();
			return;
		}

		if (type === "textarea" && key === "tab") {
			event.preventDefault();
			insertTabAtSelection(editorRef.current);
			emitChange(event);
			return;
		}

		if (type === "textarea" && (key === "backspace" || key === "delete")) {
			const mention = getMentionFromSelection(editorRef.current, key);
			if (mention) {
				event.preventDefault();
				removeMention(editorRef.current, mention);
				emitChange(event);
				return;
			}
		}

		if (type === "textarea" && isMod && (key === "b" || key === "и")) {
			runCommand(event, "bold");
			return;
		}

		if (type === "textarea" && isMod && (key === "i" || key === "ш")) {
			runCommand(event, "italic");
			return;
		}

		if (type === "textarea" && isMod && (key === "k" || key === "л")) {
			handleMentionShortcut(event);
			return;
		}

		if (type === "textarea" && isMod && (key === "]" || key === "ї")) {
			runCommand(event, "insertUnorderedList");
			return;
		}

		if (type === "textarea" && isMod && (key === "[" || key === "х")) {
			event.preventDefault();
			const list = isSelectionInsideList(editorRef.current);
			if (list?.tagName?.toLowerCase() === "ol") {
				document.execCommand("insertOrderedList", false);
			} else if (list) {
				document.execCommand("insertUnorderedList", false);
			} else {
				document.execCommand("outdent", false);
			}
			emitChange(event);
			return;
		}

		if (type === "textarea" && isMod && key >= "1" && key <= "6") {
			const tag = `h${key}`;
			const nextTag = isSelectionInsideTag(editorRef.current, tag) ? "p" : tag;
			replaceCurrentBlock(event, nextTag);
			return;
		}

		if (type === "textarea" && isMod && (key === "q" || key === "й")) {
			const nextTag = isSelectionInsideTag(editorRef.current, "blockquote")
				? "p"
				: "blockquote";
			runFormatBlockCommand(event, nextTag);
			return;
		}

		onKeyDown?.(event);
	};

	const handlePaste = (event) => {
		event.stopPropagation();

		if (isDisabled) {
			onPaste?.(event);
			return;
		}

		event.preventDefault();

		const editor = editorRef.current;
		const html = event.clipboardData.getData("text/html");
		const plainText = event.clipboardData
			.getData("text/plain")
			.replace(/\r\n?/g, "\n");

		if (type !== "textarea") {
			insertTextAtSelection(editor, plainText.replace(/\n+/g, " "));
			emitChange(event);
			onPaste?.(event);
			return;
		}

		const markdown = html ? convertHtmlToMarkdown(html) : plainText;
		insertHtmlAtSelection(editor, markdownToHtml(markdown, type));
		emitChange(event);
		onPaste?.(event);
	};

	const stopContainerEvent = (event) => {
		event.stopPropagation();
	};

	const clearMentionTooltip = () => {
		setMentionTooltip((current) =>
			current.content || current.anchor
				? { content: null, anchor: null }
				: current,
		);
	};

	const handleMouseMove = (event) => {
		const mention = event.target.closest?.("[data-mention]");
		if (mention && editorRef.current?.contains(mention)) {
			const content =
				mention.dataset.mentionTooltip || lang.t(MENTION_TOOLTIP_KEY);
			setMentionTooltip((current) =>
				current.content === content && current.anchor === mention
					? current
					: { content, anchor: mention },
			);
			return;
		}

		clearMentionTooltip();
	};

	const handleMouseDown = (event) => {
		const tab = event.target.closest?.("[data-tab]");
		if (tab && editorRef.current?.contains(tab)) {
			event.preventDefault();
			event.stopPropagation();
			editorRef.current.focus({ preventScroll: true });
			setCaretFromTabClick(tab, event);
			return;
		}

		stopEditorEvent(event);
	};

	const editorNode = (
		<div
			ref={editorRef}
			className={classNames("MarkdownView", "MarkdownView__editable", {
				MarkdownView__active: isActive,
				MarkdownView__disabled: isDisabled,
			})}
			contentEditable={!isDisabled}
			suppressContentEditableWarning
			role="textbox"
			aria-multiline={type === "textarea"}
			data-placeholder={placeholder}
			tabIndex={isDisabled ? -1 : 0}
			onBlur={handleBlur}
			onClick={handleClick}
			onFocus={handleFocus}
			onInput={handleInput}
			onKeyDown={handleKeyDown}
			onMouseDown={handleMouseDown}
			onMouseLeave={clearMentionTooltip}
			onMouseMove={handleMouseMove}
			onPaste={handlePaste}
		/>
	);

	return (
		<div
			{...domProps}
			className={classNames("EditableField", className, {
				EditableField__active: isActive,
				EditableField__disabled: isDisabled,
			})}
			onClick={stopContainerEvent}
			onMouseDown={stopContainerEvent}
			style={{ position: "relative", ...domProps.style }}
		>
			{markdownValue && showCopyButton && (
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon={copied ? "check" : "copy"}
					className="EditableField__copy_btn"
					onClick={handleCopy}
					title={lang.t("Copy formatted text for Word")}
				/>
			)}
			<Tooltip
				content={tooltipContent}
				disabled={!tooltipContent}
				className="EditableField__tooltip"
				anchorElement={tooltipAnchor}
			>
				{editorNode}
			</Tooltip>
			<EntityModal
				modalState={modalState}
				campaignSlug={resolvedCampaignSlug}
				onClose={handleCloseMentionModal}
			/>
		</div>
	);
}
