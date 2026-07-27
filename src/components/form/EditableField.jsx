import {
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { $generateHtmlFromNodes } from "@lexical/html";
import {
	$convertFromMarkdownString,
	$convertToMarkdownString,
	BOLD_STAR,
	BOLD_UNDERSCORE,
	HEADING,
	ITALIC_STAR,
	ITALIC_UNDERSCORE,
	ORDERED_LIST,
	QUOTE,
	UNORDERED_LIST,
} from "@lexical/markdown";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import {
	$createParagraphNode,
	$createTabNode,
	$createTextNode,
	$getRoot,
	$getSelection,
	$isRangeSelection,
	$applyNodeReplacement,
	COMMAND_PRIORITY_HIGH,
	FORMAT_TEXT_COMMAND,
	KEY_DOWN_COMMAND,
	OUTDENT_CONTENT_COMMAND,
	TextNode,
} from "lexical";
import {
	$createHeadingNode,
	$createQuoteNode,
	$isHeadingNode,
	$isQuoteNode,
	HeadingNode,
	QuoteNode,
} from "@lexical/rich-text";
import {
	INSERT_UNORDERED_LIST_COMMAND,
	ListItemNode,
	ListNode,
	REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { $setBlocksType } from "@lexical/selection";
import Button from "./Button";
import "../../assets/components/EditableField.css";
import classNames from "../../utils/classNames";
import { lang } from "../../services/localization";
import { useAppDispatch } from "../../store/appStore";
import { parseUrl } from "../../utils/navigation";
import { requestMentionSelection } from "../../utils/mentionPicker";
import {
	createMentionBoundaryNode,
	handleSpaceAfterMention,
} from "../../utils/mentionEditor";
import EntityModal from "../common/EntityModal";
import Tooltip from "../common/Tooltip";
import {
	EntityLinkContext,
	EntityLinkResolverContext,
} from "../common/EntityLinkIdentity";
import { openEntityLinkModal } from "../common/entityLinkModalUtils";

const MENTION_CLASS = "mention_link EditableField__mention";
const MENTION_TOOLTIP_KEY = "Ctrl+click to open entity";
const TAB_CLASS = "EditableField__tab";
const EDITOR_NAMESPACE = "EditableField";
const EXTERNAL_UPDATE_TAG = "editable-field:external";
const TEXTAREA_TYPE = "textarea";
const EDITOR_MODULE_VERSION = (() => {
	if (!import.meta.hot) return "static";

	const data = import.meta.hot.data;
	data.editableFieldVersion = (data.editableFieldVersion || 0) + 1;
	return String(data.editableFieldVersion);
})();
const BOLD_SHORTCUT_CODES = new Set(["KeyB"]);
const ITALIC_SHORTCUT_CODES = new Set(["KeyI"]);
const MENTION_SHORTCUT_CODES = new Set(["KeyK"]);
const LIST_SHORTCUT_CODES = new Set(["BracketRight"]);
const OUTDENT_SHORTCUT_CODES = new Set(["BracketLeft"]);
const QUOTE_SHORTCUT_CODES = new Set(["KeyQ"]);
const HISTORY_SHORTCUT_CODES = new Set(["KeyZ", "KeyY"]);
const EDITABLE_FIELD_THEME = {
	heading: {
		h1: "MarkdownView__heading MarkdownView__heading_h1",
		h2: "MarkdownView__heading MarkdownView__heading_h2",
		h3: "MarkdownView__heading MarkdownView__heading_h3",
		h4: "MarkdownView__heading MarkdownView__heading_h4",
		h5: "MarkdownView__heading MarkdownView__heading_h5",
		h6: "MarkdownView__heading MarkdownView__heading_h6",
	},
	list: {
		listitem: "MarkdownView__list_item",
		nested: {
			listitem: "MarkdownView__nested_list_item",
		},
		ol: "MarkdownView__ordered_list",
		ul: "MarkdownView__unordered_list",
	},
	quote: "MarkdownView__quote",
	tab: TAB_CLASS,
	text: {
		bold: "MarkdownView__bold",
		italic: "MarkdownView__italic",
	},
};

function isTextareaType(type) {
	return type === TEXTAREA_TYPE;
}

function setMentionDomAttributes(element, mentionName) {
	element.dataset.mention = mentionName;
	element.setAttribute("data-mention-tooltip", lang.t(MENTION_TOOLTIP_KEY));
}

class MentionNode extends TextNode {
	static getType() {
		return "mention";
	}

	static clone(node) {
		return new MentionNode(node.__text, node.__key);
	}

	static importJSON(serializedNode) {
		return $createMentionNode(serializedNode.text)
			.updateFromJSON(serializedNode)
			.setMode("token");
	}

	createDOM(config) {
		const element = super.createDOM(config);
		element.className = `${element.className} ${MENTION_CLASS}`.trim();
		setMentionDomAttributes(element, this.getTextContent());
		element.spellcheck = false;
		return element;
	}

	updateDOM(prevNode, dom, config) {
		const shouldReplace = super.updateDOM(prevNode, dom, config);
		if (!shouldReplace) {
			setMentionDomAttributes(dom, this.getTextContent());
		}
		return shouldReplace;
	}

	exportJSON() {
		return {
			...super.exportJSON(),
			type: "mention",
			version: 1,
		};
	}

	canInsertTextBefore() {
		return false;
	}

	canInsertTextAfter() {
		return false;
	}

	isTextEntity() {
		return true;
	}
}

const EDITOR_NODES = [
	HeadingNode,
	QuoteNode,
	ListNode,
	ListItemNode,
	MentionNode,
];

function $createMentionNode(name = "") {
	return $applyNodeReplacement(new MentionNode(String(name).trim())).setMode(
		"token",
	);
}

function $isMentionNode(node) {
	return node instanceof MentionNode;
}

const MENTION_TRANSFORMER = {
	dependencies: [MentionNode],
	export: (node) => {
		if (!$isMentionNode(node)) return null;
		const mentionName = normalizeTextContent(node.getTextContent()).trim();
		return mentionName ? `[${mentionName}]` : "";
	},
	importRegExp: /\[([^\]\n]+)\]/,
	regExp: /\[([^\]\n]+)\]$/,
	replace: (textNode, match) => {
		const mentionName = normalizeTextContent(match[1]).trim();
		if (!mentionName) return;

		const mentionNode = $createMentionNode(mentionName);
		mentionNode.setFormat(textNode.getFormat());
		textNode.replace(mentionNode);
		mentionNode.insertAfter(createMentionBoundaryNode());
		return mentionNode;
	},
	trigger: "]",
	type: "text-match",
};

const MARKDOWN_TRANSFORMERS = [
	HEADING,
	QUOTE,
	UNORDERED_LIST,
	ORDERED_LIST,
	BOLD_STAR,
	BOLD_UNDERSCORE,
	ITALIC_STAR,
	ITALIC_UNDERSCORE,
	MENTION_TRANSFORMER,
];

function normalizeTextContent(value = "") {
	return String(value || "")
		.replace(/\u200B/g, "")
		.replace(/\uFEFF/g, "")
		.replace(/\u00A0/g, " ");
}

function normalizeMarkdown(value = "", type = "textarea") {
	const normalized = normalizeTextContent(value).replace(/\r\n?/g, "\n");

	if (!isTextareaType(type)) {
		return normalized.replace(/\n+/g, " ").trim();
	}

	return normalized
		.split("\n")
		.map((line) => line.replace(/ +$/g, ""))
		.join("\n")
		.replace(/^\n+|\n+$/g, "");
}

function createChangeEvent(sourceEvent, value) {
	const target = sourceEvent?.target || {};
	const currentTarget = sourceEvent?.currentTarget || target;

	return {
		...(sourceEvent || {}),
		currentTarget: {
			...currentTarget,
			value,
		},
		target: {
			...target,
			value,
		},
	};
}

function isShortcutCode(event, codes) {
	return Boolean(event.ctrlKey || event.metaKey) && codes.has(event.code);
}

function $loadMarkdownValue(markdownValue, type = "textarea") {
	const root = $getRoot();
	root.clear();

	if (!isTextareaType(type)) {
		const paragraph = $createParagraphNode();
		const text = normalizeTextContent(markdownValue)
			.replace(/\r\n?/g, "\n")
			.replace(/\n+/g, " ");
		if (text) paragraph.append($createTextNode(text));
		root.append(paragraph);
		return;
	}

	$convertFromMarkdownString(
		normalizeMarkdown(markdownValue, type),
		MARKDOWN_TRANSFORMERS,
		undefined,
		true,
		false,
	);
}

function $readMarkdownValue(type = "textarea") {
	if (!isTextareaType(type)) {
		return normalizeMarkdown($getRoot().getTextContent(), type);
	}

	return normalizeMarkdown(
		$convertToMarkdownString(MARKDOWN_TRANSFORMERS, undefined, true),
		type,
	);
}

function $getSelectedTopLevelElement() {
	const selection = $getSelection();
	if (!$isRangeSelection(selection)) return null;

	const anchorNode = selection.anchor.getNode();
	return anchorNode.getTopLevelElement?.() || null;
}

function $selectEditorEnd() {
	const root = $getRoot();
	if (root.getChildrenSize() === 0) {
		const paragraph = $createParagraphNode();
		root.append(paragraph);
		paragraph.selectEnd();
	} else {
		root.selectEnd();
	}
	return $getSelection();
}

function $insertMentionAtSelection(name) {
	const mentionName = normalizeTextContent(name).trim();
	let selection = $getSelection();

	if (!$isRangeSelection(selection)) {
		selection = $selectEditorEnd();
	}
	if (!mentionName || !$isRangeSelection(selection)) return;

	const boundaryNode = createMentionBoundaryNode();
	selection.insertNodes([$createMentionNode(mentionName), boundaryNode]);
	boundaryNode.select(1, 1);
}

function $insertTabAtSelection() {
	const selection = $getSelection();
	if (!$isRangeSelection(selection)) return;

	selection.insertNodes([$createTabNode()]);
}

function $toggleHeading(tag) {
	const selection = $getSelection();
	if (!$isRangeSelection(selection)) return;

	const currentBlock = $getSelectedTopLevelElement();
	const isSameHeading =
		$isHeadingNode(currentBlock) && currentBlock.getTag() === tag;

	$setBlocksType(selection, () =>
		isSameHeading ? $createParagraphNode() : $createHeadingNode(tag),
	);
}

function $toggleQuote() {
	const selection = $getSelection();
	if (!$isRangeSelection(selection)) return;

	const currentBlock = $getSelectedTopLevelElement();
	$setBlocksType(selection, () =>
		$isQuoteNode(currentBlock) ? $createParagraphNode() : $createQuoteNode(),
	);
}

function createInitialConfig({ isDisabled, markdownValue, type }) {
	return {
		editable: !isDisabled,
		editorState: () => $loadMarkdownValue(markdownValue, type),
		namespace: EDITOR_NAMESPACE,
		nodes: EDITOR_NODES,
		onError(error) {
			console.error("Lexical EditableField error:", error);
		},
		theme: EDITABLE_FIELD_THEME,
	};
}

function EditableStatePlugin({ isDisabled }) {
	const [editor] = useLexicalComposerContext();

	useLayoutEffect(() => {
		editor.setEditable(!isDisabled);
	}, [editor, isDisabled]);

	return null;
}

function EditorRefPlugin({ editorRef }) {
	const [editor] = useLexicalComposerContext();

	useLayoutEffect(() => {
		editorRef.current = editor;
		return () => {
			if (editorRef.current === editor) editorRef.current = null;
		};
	}, [editor, editorRef]);

	return null;
}

function MarkdownValuePlugin({ lastValueRef, markdownValue, type }) {
	const [editor] = useLexicalComposerContext();
	const normalizedValue = useMemo(
		() => normalizeMarkdown(markdownValue, type),
		[markdownValue, type],
	);

	useLayoutEffect(() => {
		if (normalizedValue === lastValueRef.current) return;

		editor.update(
			() => {
				$loadMarkdownValue(normalizedValue, type);
			},
			{ tag: EXTERNAL_UPDATE_TAG },
		);
		lastValueRef.current = normalizedValue;
	}, [editor, lastValueRef, normalizedValue, type]);

	return null;
}

function MarkdownChangePlugin({ lastEventRef, lastValueRef, onChange, type }) {
	const handleChange = useCallback(
		(editorState, editor, tags) => {
			if (tags.has(EXTERNAL_UPDATE_TAG)) return;

			let nextValue = "";
			editorState.read(() => {
				nextValue = $readMarkdownValue(type);
			});

			if (nextValue === lastValueRef.current) return;

			lastValueRef.current = nextValue;
			onChange?.(createChangeEvent(lastEventRef.current, nextValue));
		},
		[lastEventRef, lastValueRef, onChange, type],
	);

	return <OnChangePlugin ignoreSelectionChange onChange={handleChange} />;
}

function EditablePlaceholder({ placeholder }) {
	if (!placeholder) return null;
	return <div className="MarkdownView__placeholder">{placeholder}</div>;
}

function EditorContentPlugin({ editableNode, placeholder, type }) {
	const pluginProps = {
		contentEditable: editableNode,
		placeholder: <EditablePlaceholder placeholder={placeholder} />,
		ErrorBoundary: LexicalErrorBoundary,
	};

	return isTextareaType(type) ? (
		<RichTextPlugin {...pluginProps} />
	) : (
		<PlainTextPlugin {...pluginProps} />
	);
}

function useCommandHandlers({
	dispatch,
	enableHistory,
	isDisabled,
	onKeyDown,
	type,
}) {
	const [editor] = useLexicalComposerContext();

	const handleMentionShortcut = useCallback(
		async (event) => {
			event.preventDefault();
			event.stopPropagation();

			const selection = $getSelection();
			if ($isRangeSelection(selection) && !selection.isCollapsed()) {
				const selectedText = normalizeTextContent(
					selection.getTextContent(),
				).trim();
				if (selectedText) {
					$insertMentionAtSelection(selectedText);
					return;
				}
			}

			const result = await requestMentionSelection(dispatch);
			if (result.status !== "selected" || !result.name) return;

			editor.focus();
			editor.update(() => {
				$insertMentionAtSelection(result.name);
			});
		},
		[dispatch, editor],
	);

	const handleKeyDown = useCallback(
		(event) => {
			const key = event.key.toLowerCase();

			if (!enableHistory && isShortcutCode(event, HISTORY_SHORTCUT_CODES)) {
				onKeyDown?.(event);
				return;
			}

			event.stopPropagation();

			if (isDisabled) {
				onKeyDown?.(event);
				return;
			}

			if (!isTextareaType(type) && event.key === "Enter") {
				event.preventDefault();
				editor.blur();
				return;
			}

			if (!isTextareaType(type) && (event.ctrlKey || event.metaKey)) {
				onKeyDown?.(event);
				return;
			}

			if (isTextareaType(type) && key === "tab") {
				event.preventDefault();
				editor.update(() => $insertTabAtSelection());
				return;
			}

			if (
				isTextareaType(type) &&
				handleSpaceAfterMention(event, $isMentionNode)
			) {
				return;
			}

			if (isTextareaType(type) && isShortcutCode(event, BOLD_SHORTCUT_CODES)) {
				event.preventDefault();
				editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
				return;
			}

			if (
				isTextareaType(type) &&
				isShortcutCode(event, ITALIC_SHORTCUT_CODES)
			) {
				event.preventDefault();
				editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
				return;
			}

			if (
				isTextareaType(type) &&
				isShortcutCode(event, MENTION_SHORTCUT_CODES)
			) {
				handleMentionShortcut(event);
				return;
			}

			if (isTextareaType(type) && isShortcutCode(event, LIST_SHORTCUT_CODES)) {
				event.preventDefault();
				editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
				return;
			}

			if (
				isTextareaType(type) &&
				isShortcutCode(event, OUTDENT_SHORTCUT_CODES)
			) {
				event.preventDefault();
				if (!editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)) {
					editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
				}
				return;
			}

			if (
				isTextareaType(type) &&
				(event.ctrlKey || event.metaKey) &&
				key >= "1" &&
				key <= "6"
			) {
				event.preventDefault();
				editor.update(() => $toggleHeading(`h${key}`));
				return;
			}

			if (isTextareaType(type) && isShortcutCode(event, QUOTE_SHORTCUT_CODES)) {
				event.preventDefault();
				editor.update(() => $toggleQuote());
				return;
			}

			onKeyDown?.(event);
		},
		[editor, enableHistory, handleMentionShortcut, isDisabled, onKeyDown, type],
	);

	useLayoutEffect(() => {
		return editor.registerCommand(
			KEY_DOWN_COMMAND,
			(event) => {
				handleKeyDown(event);
				return event.defaultPrevented;
			},
			COMMAND_PRIORITY_HIGH,
		);
	}, [editor, handleKeyDown]);
}

function LexicalEditableField({
	dispatch,
	enableHistory,
	isActive,
	isDisabled,
	lastEventRef,
	lastValueRef,
	markdownValue,
	onBlur,
	onChange,
	onClick,
	onFocus,
	onInput,
	onKeyDown,
	onMentionHover,
	onPaste,
	openMentionModal,
	placeholder,
	type,
}) {
	const [editor] = useLexicalComposerContext();
	useCommandHandlers({
		dispatch,
		enableHistory,
		isDisabled,
		onKeyDown,
		type,
	});

	const handleFocus = useCallback(
		(event) => {
			event.stopPropagation();
			onFocus?.(event);
		},
		[onFocus],
	);

	const handleBlur = useCallback(
		(event) => {
			event.stopPropagation();
			onBlur?.(event);
		},
		[onBlur],
	);

	const handleClick = useCallback(
		(event) => {
			const mention = event.target.closest?.("[data-mention]");
			if (mention && (event.ctrlKey || event.metaKey)) {
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
		},
		[onClick, openMentionModal],
	);

	const handleInput = useCallback(
		(event) => {
			event.stopPropagation();
			lastEventRef.current = event;
			onInput?.(event);
		},
		[lastEventRef, onInput],
	);

	const handleKeyDown = useCallback(
		(event) => {
			lastEventRef.current = event;
		},
		[lastEventRef],
	);

	const handlePaste = useCallback(
		(event) => {
			event.stopPropagation();
			lastEventRef.current = event;
			onPaste?.(event);
		},
		[lastEventRef, onPaste],
	);

	const handleMouseMove = useCallback(
		(event) => {
			const mention = event.target.closest?.("[data-mention]");
			if (mention) {
				const rootElement = editor.getRootElement();
				if (rootElement?.contains(mention)) {
					onMentionHover({
						anchor: mention,
						content:
							mention.dataset.mentionTooltip || lang.t(MENTION_TOOLTIP_KEY),
					});
					return;
				}
			}

			onMentionHover({ anchor: null, content: null });
		},
		[editor, onMentionHover],
	);

	const handleMouseDown = useCallback((event) => {
		event.stopPropagation();
	}, []);

	const editableNode = (
		<ContentEditable
			className={classNames("MarkdownView", "MarkdownView__editable", {
				MarkdownView__active: isActive,
				MarkdownView__disabled: isDisabled,
			})}
			role="textbox"
			aria-multiline={isTextareaType(type)}
			aria-placeholder={placeholder}
			data-app-history-shortcuts={enableHistory ? undefined : "true"}
			data-placeholder={placeholder}
			tabIndex={isDisabled ? -1 : 0}
			onBlur={handleBlur}
			onClick={handleClick}
			onFocus={handleFocus}
			onInput={handleInput}
			onKeyDown={handleKeyDown}
			onMouseDown={handleMouseDown}
			onMouseLeave={() => onMentionHover({ anchor: null, content: null })}
			onMouseMove={handleMouseMove}
			onPaste={handlePaste}
		/>
	);

	return (
		<>
			<EditorContentPlugin
				editableNode={editableNode}
				placeholder={placeholder}
				type={type}
			/>
			{enableHistory && <HistoryPlugin />}
			<MarkdownValuePlugin
				lastValueRef={lastValueRef}
				markdownValue={markdownValue}
				type={type}
			/>
			<MarkdownChangePlugin
				lastEventRef={lastEventRef}
				lastValueRef={lastValueRef}
				onChange={onChange}
				type={type}
			/>
			<EditableStatePlugin isDisabled={isDisabled} />
			{isTextareaType(type) && (
				<>
					<ListPlugin />
					<MarkdownShortcutPlugin transformers={MARKDOWN_TRANSFORMERS} />
				</>
			)}
		</>
	);
}

export default function EditableField({
	value,
	onChange,
	placeholder,
	className,
	type = "text",
	enableHistory = true,
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
	const lastEventRef = useRef(null);
	const copyTimeoutRef = useRef(null);
	const markdownValue = value || value === 0 ? String(value) : "";
	const normalizedMarkdownValue = normalizeMarkdown(markdownValue, type);
	const lastValueRef = useRef(normalizedMarkdownValue);
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

	const editorKey = `${EDITOR_NAMESPACE}:${EDITOR_MODULE_VERSION}:${type}`;
	const initialConfig = useMemo(
		() =>
			createInitialConfig({
				isDisabled,
				markdownValue: normalizedMarkdownValue,
				type,
			}),
		[isDisabled, normalizedMarkdownValue, type],
	);

	useEffect(() => {
		return () => {
			if (copyTimeoutRef.current) {
				clearTimeout(copyTimeoutRef.current);
			}
		};
	}, []);

	const handleCopy = useCallback(
		async (event) => {
			event.preventDefault();
			event.stopPropagation();

			const editor = editorRef.current;
			if (!editor || !normalizedMarkdownValue) return;

			try {
				let html = "";
				editor.getEditorState().read(() => {
					html = $generateHtmlFromNodes(editor);
				});

				await navigator.clipboard.write([
					new ClipboardItem({
						"text/html": new Blob([html], { type: "text/html" }),
						"text/plain": new Blob([normalizedMarkdownValue], {
							type: "text/plain",
						}),
					}),
				]);
				setCopied(true);
				if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
				copyTimeoutRef.current = setTimeout(() => {
					setCopied(false);
					copyTimeoutRef.current = null;
				}, 2000);
			} catch (error) {
				console.error("Failed to copy formatted text:", error);
			}
		},
		[normalizedMarkdownValue],
	);

	const handleFocus = useCallback(
		(event) => {
			setIsActive(true);
			onFocus?.(event);
		},
		[onFocus],
	);

	const handleBlur = useCallback(
		(event) => {
			setIsActive(false);
			onBlur?.(event);
		},
		[onBlur],
	);

	const handleCloseMentionModal = useCallback(() => setModalState(null), []);

	const openMentionModal = useCallback(
		async (mentionName) => {
			await openEntityLinkModal({
				campaignSlug: resolvedCampaignSlug,
				currentEntityIdentity,
				errorMessage: "Failed to open entity mention modal",
				modalState,
				name: mentionName,
				scopedEntityLinks,
				setModalState,
			});
		},
		[
			resolvedCampaignSlug,
			currentEntityIdentity,
			modalState,
			scopedEntityLinks,
		],
	);

	const handleMentionHover = useCallback(({ anchor, content }) => {
		setMentionTooltip((current) =>
			current.content === content && current.anchor === anchor
				? current
				: { content, anchor },
		);
	}, []);

	const stopContainerEvent = useCallback((event) => {
		event.stopPropagation();
	}, []);

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
			{normalizedMarkdownValue && showCopyButton && (
				<Button
					key="copy"
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon={copied ? "check" : "copy"}
					className="EditableField__copy_btn"
					onClick={handleCopy}
					title={lang.t("Copy formatted text for Word")}
				/>
			)}
			<Tooltip
				key="editor"
				content={tooltipContent}
				disabled={!tooltipContent}
				className="EditableField__tooltip"
				anchorElement={tooltipAnchor}
			>
				<div className="EditableField__editor_shell">
					<LexicalComposer key={editorKey} initialConfig={initialConfig}>
						<EditorRefPlugin editorRef={editorRef} />
						<LexicalEditableField
							dispatch={dispatch}
							enableHistory={enableHistory}
							isActive={isActive}
							isDisabled={isDisabled}
							lastEventRef={lastEventRef}
							lastValueRef={lastValueRef}
							markdownValue={normalizedMarkdownValue}
							onBlur={handleBlur}
							onChange={onChange}
							onClick={onClick}
							onFocus={handleFocus}
							onInput={onInput}
							onKeyDown={onKeyDown}
							onMentionHover={handleMentionHover}
							onPaste={onPaste}
							openMentionModal={openMentionModal}
							placeholder={placeholder}
							type={type}
						/>
					</LexicalComposer>
				</div>
			</Tooltip>
			<EntityModal
				key="entity-modal"
				modalState={modalState}
				onClose={handleCloseMentionModal}
			/>
		</div>
	);
}
