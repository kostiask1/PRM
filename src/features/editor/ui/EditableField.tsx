import {
	type ClipboardEvent,
	type FocusEvent,
	type FormEvent,
	type HTMLAttributes,
	type KeyboardEvent,
	type MouseEvent,
	type MutableRefObject,
	type ReactElement,
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
	type TextMatchTransformer,
	type Transformer,
} from "@lexical/markdown";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import {
	LexicalComposer,
	type InitialConfigType,
} from "@lexical/react/LexicalComposer";
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
	type EditorConfig,
	type EditorState,
	type LexicalEditor,
	type LexicalNode,
	type SerializedTextNode,
} from "lexical";
import {
	$createHeadingNode,
	$createQuoteNode,
	$isHeadingNode,
	$isQuoteNode,
	HeadingNode,
	QuoteNode,
	type HeadingTagType,
} from "@lexical/rich-text";
import {
	INSERT_UNORDERED_LIST_COMMAND,
	ListItemNode,
	ListNode,
	REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { $setBlocksType } from "@lexical/selection";
import { Button, Tooltip } from "../../../shared/ui/index.js";
import "../../../assets/components/EditableField.css";
import { classNames } from "../../../shared/lib/index.js";
import { lang } from "../../../shared/lib/index.js";
import { useAppDispatch } from "../../../shared/model/index.js";
import { parseUrl } from "../../../shared/lib/index.js";
import { requestMentionSelection } from "../model/mentionPicker.ts";
import {
	createMentionBoundaryNode,
	handleSpaceAfterMention,
} from "../model/mentionEditor.ts";
import {
	EntityLinkContext,
	EntityLinkResolverContext,
	EntityModal,
	openEntityLinkModal,
} from "../../entity-link/index.js";
import type {
	EntityLinkModalState,
} from "../../entity-link/index.js";
import {
	getEditableShortcutAction,
	normalizeEditableMarkdown,
	normalizeEditableText,
	shouldDelegateEditableHistory,
	type EditableShortcutAction,
	type EditableFieldType,
} from "./editorPresentation.ts";

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

function isTextareaType(type: EditableFieldType): boolean {
	return type === TEXTAREA_TYPE;
}

function setMentionDomAttributes(
	element: HTMLElement,
	mentionName: string,
) {
	element.dataset.mention = mentionName;
	element.setAttribute("data-mention-tooltip", lang.t(MENTION_TOOLTIP_KEY));
}

class MentionNode extends TextNode {
	static getType() {
		return "mention";
	}

	static clone(node: MentionNode): MentionNode {
		return new MentionNode(node.__text, node.__key);
	}

	static importJSON(serializedNode: SerializedTextNode): MentionNode {
		return $createMentionNode(serializedNode.text)
			.updateFromJSON(serializedNode)
			.setMode("token") as MentionNode;
	}

	createDOM(config: EditorConfig): HTMLElement {
		const element = super.createDOM(config);
		element.className = `${element.className} ${MENTION_CLASS}`.trim();
		setMentionDomAttributes(element, this.getTextContent());
		element.spellcheck = false;
		return element;
	}

	updateDOM(
		prevNode: this,
		dom: HTMLElement,
		config: EditorConfig,
	): boolean {
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

function $createMentionNode(name = ""): MentionNode {
	return $applyNodeReplacement(new MentionNode(String(name).trim())).setMode(
		"token",
	);
}

function $isMentionNode(
	node: LexicalNode | null | undefined,
): node is MentionNode {
	return node instanceof MentionNode;
}

const MENTION_TRANSFORMER: TextMatchTransformer = {
	dependencies: [MentionNode],
	export: (node) => {
		if (!$isMentionNode(node)) return null;
		const mentionName = normalizeEditableText(node.getTextContent()).trim();
		return mentionName ? `[${mentionName}]` : "";
	},
	importRegExp: /\[([^\]\n]+)\]/,
	regExp: /\[([^\]\n]+)\]$/,
	replace: (textNode, match) => {
		const mentionName = normalizeEditableText(match[1]).trim();
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

const MARKDOWN_TRANSFORMERS: Transformer[] = [
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


export interface EditableFieldChangeEvent {
	target: { value: string; [key: string]: unknown };
	currentTarget?: { value: string; [key: string]: unknown };
	[key: string]: unknown;
}

function createChangeEvent(
	sourceEvent: unknown,
	value: string,
): EditableFieldChangeEvent {
	const source =
		sourceEvent && typeof sourceEvent === "object"
			? (sourceEvent as Record<string, unknown>)
			: {};
	const target =
		source.target && typeof source.target === "object"
			? (source.target as Record<string, unknown>)
			: {};
	const currentTarget =
		source.currentTarget && typeof source.currentTarget === "object"
			? (source.currentTarget as Record<string, unknown>)
			: target;

	return {
		...source,
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

function $loadMarkdownValue(
	markdownValue: string,
	type: EditableFieldType = "textarea",
) {
	const root = $getRoot();
	root.clear();

	if (!isTextareaType(type)) {
		const paragraph = $createParagraphNode();
		const text = normalizeEditableText(markdownValue)
			.replace(/\r\n?/g, "\n")
			.replace(/\n+/g, " ");
		if (text) paragraph.append($createTextNode(text));
		root.append(paragraph);
		return;
	}

	$convertFromMarkdownString(
		normalizeEditableMarkdown(markdownValue, type),
		MARKDOWN_TRANSFORMERS,
		undefined,
		true,
		false,
	);
}

function $readMarkdownValue(type: EditableFieldType = "textarea"): string {
	if (!isTextareaType(type)) {
		return normalizeEditableMarkdown($getRoot().getTextContent(), type);
	}

	return normalizeEditableMarkdown(
		$convertToMarkdownString(MARKDOWN_TRANSFORMERS, undefined, true),
		type,
	);
}

function $getSelectedTopLevelElement(): LexicalNode | null {
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

function $insertMentionAtSelection(name: string) {
	const mentionName = normalizeEditableText(name).trim();
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

function $toggleHeading(tag: HeadingTagType) {
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

function createInitialConfig({
	isDisabled,
	markdownValue,
	type,
}: {
	isDisabled: boolean;
	markdownValue: string;
	type: EditableFieldType;
}): InitialConfigType {
	return {
		editable: !isDisabled,
		editorState: () => $loadMarkdownValue(markdownValue, type),
		namespace: EDITOR_NAMESPACE,
		nodes: EDITOR_NODES,
		onError(error: Error) {
			console.error("Lexical EditableField error:", error);
		},
		theme: EDITABLE_FIELD_THEME,
	};
}

interface EditableStatePluginProps {
	isDisabled: boolean;
}

function EditableStatePlugin({ isDisabled }: EditableStatePluginProps) {
	const [editor] = useLexicalComposerContext();

	useLayoutEffect(() => {
		editor.setEditable(!isDisabled);
	}, [editor, isDisabled]);

	return null;
}

type LexicalEditorRef = MutableRefObject<LexicalEditor | null>;

function EditorRefPlugin({ editorRef }: { editorRef: LexicalEditorRef }) {
	const [editor] = useLexicalComposerContext();

	useLayoutEffect(() => {
		editorRef.current = editor;
		return () => {
			if (editorRef.current === editor) editorRef.current = null;
		};
	}, [editor, editorRef]);

	return null;
}

interface MarkdownValuePluginProps {
	lastValueRef: MutableRefObject<string>;
	markdownValue: string;
	type: EditableFieldType;
}

function MarkdownValuePlugin({
	lastValueRef,
	markdownValue,
	type,
}: MarkdownValuePluginProps) {
	const [editor] = useLexicalComposerContext();
	const normalizedValue = useMemo(
		() => normalizeEditableMarkdown(markdownValue, type),
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

interface MarkdownChangePluginProps {
	lastEventRef: MutableRefObject<unknown>;
	lastValueRef: MutableRefObject<string>;
	onChange?: (event: EditableFieldChangeEvent) => void;
	type: EditableFieldType;
}

function MarkdownChangePlugin({
	lastEventRef,
	lastValueRef,
	onChange,
	type,
}: MarkdownChangePluginProps) {
	const handleChange = useCallback(
		(editorState: EditorState, _editor: LexicalEditor, tags: Set<string>) => {
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

function EditablePlaceholder({ placeholder }: { placeholder?: string }) {
	if (!placeholder) return null;
	return <div className="MarkdownView__placeholder">{placeholder}</div>;
}

function EditorContentPlugin({
	editableNode,
	placeholder,
	type,
}: {
	editableNode: ReactElement;
	placeholder?: string;
	type: EditableFieldType;
}) {
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

interface CommandHandlerOptions {
	dispatch: Parameters<typeof requestMentionSelection>[0];
	enableHistory: boolean;
	isDisabled: boolean;
	onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
	type: EditableFieldType;
}

function runEditableOutdent(editor: LexicalEditor): void {
	if (!editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)) {
		editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
	}
}

function runEditableHeading(
	editor: LexicalEditor,
	action: `heading-${1 | 2 | 3 | 4 | 5 | 6}`,
): void {
	editor.update(() =>
		$toggleHeading(`h${action.slice(-1)}` as HeadingTagType),
	);
}

interface ExecuteEditableShortcutOptions {
	action: Exclude<EditableShortcutAction, "delegate">;
	delegateKeyDown: (event: globalThis.KeyboardEvent) => void;
	editor: LexicalEditor;
	event: globalThis.KeyboardEvent;
	handleMentionShortcut: (event: globalThis.KeyboardEvent) => Promise<void>;
}

function executeEditableShortcut({
	action,
	delegateKeyDown,
	editor,
	event,
	handleMentionShortcut,
}: ExecuteEditableShortcutOptions): void {
	const handlers: Partial<Record<EditableShortcutAction, () => void>> = {
		blur: () => editor.blur(),
		"space-after-mention": () => {
			if (!handleSpaceAfterMention(event, $isMentionNode)) {
				delegateKeyDown(event);
			}
		},
		tab: () => editor.update(() => $insertTabAtSelection()),
		bold: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold"),
		italic: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic"),
		mention: () => void handleMentionShortcut(event),
		list: () => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
		outdent: () => runEditableOutdent(editor),
		quote: () => editor.update(() => $toggleQuote()),
	};
	if (action !== "space-after-mention") event.preventDefault();
	if (action.startsWith("heading-")) {
		runEditableHeading(
			editor,
			action as `heading-${1 | 2 | 3 | 4 | 5 | 6}`,
		);
		return;
	}
	handlers[action]?.();
}

function useCommandHandlers({
	dispatch,
	enableHistory,
	isDisabled,
	onKeyDown,
	type,
}: CommandHandlerOptions) {
	const [editor] = useLexicalComposerContext();
	const delegateKeyDown = useCallback(
		(event: globalThis.KeyboardEvent) =>
			onKeyDown?.(event as unknown as KeyboardEvent<HTMLElement>),
		[onKeyDown],
	);

	const handleMentionShortcut = useCallback(
		async (event: globalThis.KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();

			const selection = $getSelection();
			if ($isRangeSelection(selection) && !selection.isCollapsed()) {
				const selectedText = normalizeEditableText(
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
		(event: globalThis.KeyboardEvent) => {
			const modified = event.ctrlKey || event.metaKey;
			const action = getEditableShortcutAction({
				code: event.code,
				ctrlKey: event.ctrlKey,
				enableHistory,
				isDisabled,
				key: event.key,
				metaKey: event.metaKey,
				type,
			});
			if (shouldDelegateEditableHistory(event.code, modified, enableHistory)) {
				delegateKeyDown(event);
				return;
			}
			event.stopPropagation();
			if (!action || action === "delegate") {
				delegateKeyDown(event);
				return;
			}
			executeEditableShortcut({
				action,
				delegateKeyDown,
				editor,
				event,
				handleMentionShortcut,
			});
		},
		[
			delegateKeyDown,
			editor,
			enableHistory,
			handleMentionShortcut,
			isDisabled,
			type,
		],
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

interface MentionTooltipState {
	anchor: HTMLElement | null;
	content: string | null;
}

interface LexicalEditableFieldProps {
	dispatch: Parameters<typeof requestMentionSelection>[0];
	enableHistory: boolean;
	isActive: boolean;
	isDisabled: boolean;
	lastEventRef: MutableRefObject<unknown>;
	lastValueRef: MutableRefObject<string>;
	markdownValue: string;
	onBlur?: (event: FocusEvent<HTMLElement>) => void;
	onChange?: (event: EditableFieldChangeEvent) => void;
	onClick?: (event: MouseEvent<HTMLElement>) => void;
	onFocus?: (event: FocusEvent<HTMLElement>) => void;
	onInput?: (event: FormEvent<HTMLElement>) => void;
	onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
	onMentionHover: (state: MentionTooltipState) => void;
	onPaste?: (event: ClipboardEvent<HTMLElement>) => void;
	openMentionModal: (mentionName: string) => void | Promise<void>;
	placeholder?: string;
	type: EditableFieldType;
}

function getEventTargetElement(event: { target: EventTarget | null }) {
	return event.target instanceof Element ? event.target : null;
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
}: LexicalEditableFieldProps) {
	const [editor] = useLexicalComposerContext();
	useCommandHandlers({
		dispatch,
		enableHistory,
		isDisabled,
		onKeyDown,
		type,
	});

	const handleFocus = useCallback(
		(event: FocusEvent<HTMLElement>) => {
			event.stopPropagation();
			onFocus?.(event);
		},
		[onFocus],
	);

	const handleBlur = useCallback(
		(event: FocusEvent<HTMLElement>) => {
			event.stopPropagation();
			onBlur?.(event);
		},
		[onBlur],
	);

	const handleClick = useCallback(
		(event: MouseEvent<HTMLElement>) => {
			const target = getEventTargetElement(event);
			const mention = target?.closest<HTMLElement>("[data-mention]");
			if (mention && (event.ctrlKey || event.metaKey)) {
				event.preventDefault();
				event.stopPropagation();
				openMentionModal(mention.dataset.mention || "");
				return;
			}

			if (target?.closest("a")) {
				event.preventDefault();
			}

			event.stopPropagation();
			onClick?.(event);
		},
		[onClick, openMentionModal],
	);

	const handleInput = useCallback(
		(event: FormEvent<HTMLElement>) => {
			event.stopPropagation();
			lastEventRef.current = event;
			onInput?.(event);
		},
		[lastEventRef, onInput],
	);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLElement>) => {
			lastEventRef.current = event;
		},
		[lastEventRef],
	);

	const handlePaste = useCallback(
		(event: ClipboardEvent<HTMLElement>) => {
			event.stopPropagation();
			lastEventRef.current = event;
			onPaste?.(event);
		},
		[lastEventRef, onPaste],
	);

	const handleMouseMove = useCallback(
		(event: MouseEvent<HTMLElement>) => {
			const target = getEventTargetElement(event);
			const mention = target?.closest<HTMLElement>("[data-mention]");
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

	const handleMouseDown = useCallback((event: MouseEvent<HTMLElement>) => {
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

export interface EditableFieldProps
	extends Omit<
		HTMLAttributes<HTMLDivElement>,
		| "children"
		| "onBlur"
		| "onChange"
		| "onClick"
		| "onFocus"
		| "onInput"
		| "onKeyDown"
		| "onPaste"
		| "placeholder"
	> {
	value?: string | number | null;
	onChange?: (event: EditableFieldChangeEvent) => void;
	placeholder?: string;
	type?: EditableFieldType;
	enableHistory?: boolean;
	showCopyButton?: boolean;
	campaignSlug?: string | null;
	disabled?: boolean;
	readOnly?: boolean;
	onBlur?: (event: FocusEvent<HTMLElement>) => void;
	onClick?: (event: MouseEvent<HTMLElement>) => void;
	onFocus?: (event: FocusEvent<HTMLElement>) => void;
	onInput?: (event: FormEvent<HTMLElement>) => void;
	onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
	onPaste?: (event: ClipboardEvent<HTMLElement>) => void;
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
}: EditableFieldProps) {
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
	const [modalState, setModalState] = useState<EntityLinkModalState | null>(null);
	const [mentionTooltip, setMentionTooltip] = useState<MentionTooltipState>({
		content: null,
		anchor: null,
	});
	const editorRef = useRef<LexicalEditor | null>(null);
	const lastEventRef = useRef<unknown>(null);
	const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const markdownValue = value || value === 0 ? String(value) : "";
	const normalizedMarkdownValue = normalizeEditableMarkdown(markdownValue, type);
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
		async (event: MouseEvent<HTMLButtonElement>) => {
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
		(event: FocusEvent<HTMLElement>) => {
			setIsActive(true);
			onFocus?.(event);
		},
		[onFocus],
	);

	const handleBlur = useCallback(
		(event: FocusEvent<HTMLElement>) => {
			setIsActive(false);
			onBlur?.(event);
		},
		[onBlur],
	);

	const handleCloseMentionModal = useCallback(() => setModalState(null), []);

	const openMentionModal = useCallback(
		async (mentionName: string) => {
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

	const handleMentionHover = useCallback(({ anchor, content }: MentionTooltipState) => {
		setMentionTooltip((current) =>
			current.content === content && current.anchor === anchor
				? current
				: { content, anchor },
		);
	}, []);

	const stopContainerEvent = useCallback((event: MouseEvent<HTMLDivElement>) => {
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
