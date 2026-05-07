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
import Modal from "../common/Modal";
import EntityModalContent from "../modals/EntityModalContent";
import { EntityLinkScope } from "../common/EntityLinkContext";
import {
	getEntityDisplayName,
	resolveEntityByName,
} from "../common/entityLinkUtils.js";
import {
	EntityLinkContext,
	getEntityIdentity,
	isSameEntityIdentity,
} from "../common/EntityLinkIdentity";

const MENTION_CLASS = "mention-link EditableField__mention";
const MENTION_TOOLTIP_KEY = "Ctrl+click to open entity";
const TAB_CLASS = "EditableField__tab";

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
	)}" title="${escapeAttribute(
		lang.t(MENTION_TOOLTIP_KEY),
	)}" contenteditable="false">${escapeHtml(safeName)}</span>`;
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

	const lines = source.split("\n");
	const html = [];
	let paragraph = [];

	const flushParagraph = () => {
		if (paragraph.length === 0) return;
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
			flushParagraph();
			continue;
		}

		if (headingMatch) {
			flushParagraph();
			const level = Math.min(headingMatch[1].length, 6);
			html.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
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
			html.push(`<blockquote>${renderInlineMarkdown(quoteLines.join("\n"))}</blockquote>`);
			continue;
		}

		paragraph.push(line);
	}

	flushParagraph();
	return html.join("");
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
		.replace(/\n{3,}/g, "\n\n")
		.replace(/^\n+|\n+$/g, "");
}

function childrenToMarkdown(node, options = {}) {
	return Array.from(node.childNodes || [])
		.map((child) => nodeToMarkdown(child, options))
		.join("");
}

function blockMarkdown(content = "") {
	const clean = normalizeTextContent(content).replace(/^\n+|\n+$/g, "");
	return clean ? `${clean}\n\n` : "";
}

function inlineMarkdown(node) {
	return childrenToMarkdown(node, { inline: true });
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
		return `**${inlineMarkdown(element)}**`;
	}

	if (tagName === "em" || tagName === "i") {
		return `*${inlineMarkdown(element)}*`;
	}

	if (tagName === "a" && element.classList.contains("mention-link")) {
		return `[${normalizeTextContent(element.textContent || "").trim()}]`;
	}

	if (tagName === "span" || tagName === "a") {
		return inlineMarkdown(element);
	}

	if (tagName === "ul" || tagName === "ol") {
		return serializeList(element, tagName === "ol");
	}

	if (tagName === "li") {
		return options.inline ? inlineMarkdown(element) : blockMarkdown(inlineMarkdown(element));
	}

	const styledHeaderLevel = getHeaderLevelFromStyle(element);
	if (styledHeaderLevel > 0 && !/^h[1-6]$/.test(tagName)) {
		return blockMarkdown(`${"#".repeat(styledHeaderLevel)} ${inlineMarkdown(element)}`);
	}

	if (/^h[1-6]$/.test(tagName)) {
		const level = parseInt(tagName[1], 10);
		return blockMarkdown(`${"#".repeat(level)} ${inlineMarkdown(element)}`);
	}

	if (tagName === "blockquote") {
		const quote = normalizeMarkdown(childrenToMarkdown(element), "textarea");
		return blockMarkdown(
			quote
				.split("\n")
				.map((line) => `> ${line}`)
				.join("\n"),
		);
	}

	if (tagName === "p" || tagName === "div") {
		const content = inlineMarkdown(element);
		return options.inline ? content : blockMarkdown(content);
	}

	return childrenToMarkdown(element, options);
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

function setCaretAfter(node) {
	const range = document.createRange();
	const selection = window.getSelection?.();
	if (!selection) return;

	range.setStartAfter(node);
	range.collapse(true);
	selection.removeAllRanges();
	selection.addRange(range);
}

function createEndRange(editor) {
	const range = document.createRange();
	range.selectNodeContents(editor);
	range.collapse(false);
	return range;
}

function insertNodeAtSelection(editor, node) {
	editor.focus({ preventScroll: true });

	const range = getSelectionRangeInside(editor) || createEndRange(editor);
	range.deleteContents();
	range.insertNode(node);
	setCaretAfter(node);
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

function insertTabAtSelection(editor) {
	insertNodeAtSelection(editor, createTabNode());
}

function insertMentionAtSelection(editor, name) {
	const safeName = String(name || "").trim();
	if (!safeName) return;

	const mention = document.createElement("span");
	mention.className = MENTION_CLASS;
	mention.dataset.mention = safeName;
	mention.dataset.mentionTooltip = lang.t(MENTION_TOOLTIP_KEY);
	mention.title = lang.t(MENTION_TOOLTIP_KEY);
	mention.contentEditable = "false";
	mention.textContent = safeName;

	insertNodeAtSelection(editor, mention);
	insertTextAtSelection(editor, " ");
}

function getSelectionElement(editor) {
	const selection = window.getSelection?.();
	if (!selection || selection.rangeCount === 0) return null;

	const node = selection.anchorNode;
	const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
	if (!element || !editor.contains(element)) return null;

	return element;
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
	clone.querySelectorAll("[data-mention]").forEach((node) => {
		node.removeAttribute("data-mention");
	});
	clone.querySelectorAll("[data-mention-tooltip]").forEach((node) => {
		node.removeAttribute("data-mention-tooltip");
		node.removeAttribute("title");
	});
	return clone.innerHTML;
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
	const [isActive, setIsActive] = useState(false);
	const [copied, setCopied] = useState(false);
	const [modalState, setModalState] = useState(null);
	const editorRef = useRef(null);
	const lastValueRef = useRef("");
	const markdownValue = value || value === 0 ? String(value) : "";
	const isDisabled = Boolean(disabled || readOnly);

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
				const found = await resolveEntityByName(
					resolvedCampaignSlug,
					mentionName,
				);
				if (!found) return;

				const foundIdentity = getEntityIdentity(found.entity, found.type);
				if (
					isSameEntityIdentity(foundIdentity, currentEntityIdentity) ||
					isSameEntityIdentity(
						foundIdentity,
						modalState
							? getEntityIdentity(modalState.entity, modalState.type)
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
		[resolvedCampaignSlug, currentEntityIdentity, modalState],
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

	const handleMentionShortcut = async (event) => {
		const editor = editorRef.current;
		if (!editor) return;

		event.preventDefault();

		const selection = window.getSelection?.();
		const selectedText =
			selection && editor.contains(selection.anchorNode)
				? selection.toString().trim()
				: "";

		if (selectedText) {
			insertMentionAtSelection(editor, selectedText);
			emitChange(event);
			return;
		}

		const result = await requestMentionSelection(dispatch);
		if (result.status !== "selected") return;

		insertMentionAtSelection(editor, result.name);
		emitChange(event);
	};

	const handleKeyDown = (event) => {
		event.stopPropagation();

		if (isDisabled) {
			onKeyDown?.(event);
			return;
		}

		const key = event.key.toLowerCase();
		const isMod = event.ctrlKey || event.metaKey;

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
			runCommand(event, "formatBlock", nextTag);
			return;
		}

		if (type === "textarea" && isMod && (key === "q" || key === "й")) {
			const nextTag = isSelectionInsideTag(editorRef.current, "blockquote")
				? "p"
				: "blockquote";
			runCommand(event, "formatBlock", nextTag);
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

	return (
		<div
			{...domProps}
			className={classNames("EditableField", className, {
				"EditableField--active": isActive,
				"EditableField--disabled": isDisabled,
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
					className="EditableField__copy-btn"
					onClick={handleCopy}
					title={lang.t("Copy formatted text for Word")}
				/>
			)}
			<div
				ref={editorRef}
				className={classNames("MarkdownView", "MarkdownView--editable", {
					"MarkdownView--active": isActive,
					"MarkdownView--disabled": isDisabled,
				})}
				contentEditable={!isDisabled}
				suppressContentEditableWarning
				role="textbox"
				aria-multiline={type === "textarea"}
				data-placeholder={placeholder}
				tabIndex={isDisabled ? -1 : 0}
				title={typeof title === "string" ? title : undefined}
				onBlur={handleBlur}
				onClick={handleClick}
				onFocus={handleFocus}
				onInput={handleInput}
				onKeyDown={handleKeyDown}
				onMouseDown={stopEditorEvent}
				onPaste={handlePaste}
			/>
			{modalState && (
				<Modal
					title={lang
						.t("{type}: {name}", {
							type:
								modalState.type === "locations"
									? lang.t("Location/Faction")
									: modalState.type === "npc"
										? "NPC"
										: lang.t("Character"),
							name: getEntityDisplayName(
								modalState.entity,
								modalState.type,
							),
						})
						.trim()}
					type={modalState.type === "locations" ? "location" : "character"}
					className={
						modalState.type === "locations" ? "EntityLinkModal--location" : ""
					}
					showFooter={false}
					onConfirm={handleCloseMentionModal}
					onCancel={handleCloseMentionModal}
				>
					<EntityLinkScope entity={modalState.entity} type={modalState.type}>
						<EntityModalContent
							initialEntity={modalState.entity}
							campaignSlug={resolvedCampaignSlug}
							type={modalState.type}
							onClose={handleCloseMentionModal}
						/>
					</EntityLinkScope>
				</Modal>
			)}
		</div>
	);
}
