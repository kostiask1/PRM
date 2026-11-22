import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
	type KeyboardEvent,
	type ReactNode,
} from "react";
import { AI_FILE_ACCEPT, AI_IMAGE_ACCEPT } from "../../../../features/ai/index.js";
import { EditableField } from "../../../../features/editor/ui/index.js";
import { formatEntityMention } from "../../../../shared/lib/index.js";
import type {
	AiChatAttachment,
	AiContextAnchor,
	AiModelOption,
} from "../model/aiChatTypes.ts";
import {
	applyCommandAutocomplete,
	extractUsedCommands,
	findActiveCommandTrigger,
	getSuggestedAiCommands,
} from "../model/aiCommandAutocomplete.ts";
import { AI_MODELS } from "../model/aiModels.ts";
import AiCommandAutocompleteV2 from "./popovers/AiCommandAutocompleteV2.tsx";

interface AiChatComposerV2Props {
	value: string;
	onChange: (value: string) => void;
	onSend: () => void;
	onCancelSend?: () => void;
	isSending?: boolean;
	models?: readonly AiModelOption[];
	selectedModel: string;
	autoApply: boolean;
	onToggleAutoApply: (autoApply: boolean) => void;
	contextAnchorType?: AiContextAnchor["type"];
	isModelPickerOpen: boolean;
	onToggleModelPicker: () => void;
	isCommandsInfoOpen: boolean;
	onToggleCommandsInfo: () => void;
	attachments?: AiChatAttachment[];
	onAddAttachments?: (files: FileList) => void;
	onRemoveAttachment?: (id: string) => void;
	disabled?: boolean;
	commandsPopover?: ReactNode;
	modelPopover?: ReactNode;
}

const ZERO_WIDTH_REGEX = /[\u200B\uFEFF]/g;

function getCleanTextLength(text: string): number {
	return text.replace(ZERO_WIDTH_REGEX, "").length;
}

function getDomOffsetFromCleanDelta(rawText: string, cleanDelta: number): number {
	if (cleanDelta <= 0) return 0;
	let seenClean = 0;
	for (let i = 0; i < rawText.length; i += 1) {
		if (!ZERO_WIDTH_REGEX.test(rawText[i])) {
			seenClean += 1;
		}
		ZERO_WIDTH_REGEX.lastIndex = 0;
		if (seenClean >= cleanDelta) return i + 1;
	}
	return rawText.length;
}

function getMentionMarkdownLength(mentionElement: HTMLElement): number {
	const mentionName = mentionElement.dataset.mention || "";
	const visibleLabel = (mentionElement.textContent || "").replace(ZERO_WIDTH_REGEX, "").trim();
	if (!mentionName) return visibleLabel.length;
	return formatEntityMention(mentionName, visibleLabel || mentionName).length;
}

function readEditorMarkdownCaretOffset(editable: HTMLElement): number | null {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
		return null;
	}
	const { anchorNode, anchorOffset } = selection;
	if (!anchorNode || !editable.contains(anchorNode)) {
		return null;
	}

	let offset = 0;
	let found = false;
	let insideMention = false;

	const walkNode = (node: Node): void => {
		if (found) return;
		if (node === anchorNode) {
			if (node.nodeType === Node.TEXT_NODE) {
				offset += getCleanTextLength((node.textContent || "").slice(0, anchorOffset));
				found = true;
				return;
			}
			const limit = Math.min(anchorOffset, node.childNodes.length);
			for (let i = 0; i < limit; i += 1) {
				walkNode(node.childNodes[i]);
				if (found) return;
			}
			found = true;
			return;
		}

		if (node.nodeType === Node.TEXT_NODE) {
			offset += getCleanTextLength(node.textContent || "");
			return;
		}

		if (node instanceof HTMLElement && node.dataset.mention) {
			if (node.contains(anchorNode)) {
				insideMention = true;
				found = true;
				return;
			}
			offset += getMentionMarkdownLength(node);
			return;
		}

		for (let i = 0; i < node.childNodes.length; i += 1) {
			walkNode(node.childNodes[i]);
			if (found) return;
		}
	};

	const children = Array.from(editable.childNodes);
	if (anchorNode === editable) {
		const limit = Math.min(anchorOffset, children.length);
		for (let i = 0; i < limit; i += 1) {
			if (i > 0) offset += 1;
			walkNode(children[i]);
			if (found) break;
		}
		return insideMention ? null : offset;
	}

	for (let i = 0; i < children.length; i += 1) {
		if (i > 0) offset += 1;
		walkNode(children[i]);
		if (found) break;
	}

	return found && !insideMention ? offset : null;
}

function setEditorMarkdownCaretOffset(editable: HTMLElement, targetOffset: number): void {
	editable.focus();
	const selection = window.getSelection();
	if (!selection) return;

	let offset = 0;
	let placed = false;

	const placeAt = (node: Node, domOffset: number) => {
		const range = document.createRange();
		range.setStart(node, domOffset);
		range.collapse(true);
		selection.removeAllRanges();
		selection.addRange(range);
		placed = true;
	};

	const walkNode = (node: Node): void => {
		if (placed) return;
		if (node.nodeType === Node.TEXT_NODE) {
			const raw = node.textContent || "";
			const cleanLen = getCleanTextLength(raw);
			if (offset + cleanLen >= targetOffset) {
				placeAt(node, getDomOffsetFromCleanDelta(raw, targetOffset - offset));
				return;
			}
			offset += cleanLen;
			return;
		}

		if (node instanceof HTMLElement && node.dataset.mention) {
			offset += getMentionMarkdownLength(node);
			if (offset >= targetOffset && node.parentNode) {
				const siblings = Array.from(node.parentNode.childNodes);
				const idx = siblings.indexOf(node);
				if (idx !== -1) {
					placeAt(node.parentNode, idx + 1);
				}
			}
			return;
		}

		for (let i = 0; i < node.childNodes.length; i += 1) {
			walkNode(node.childNodes[i]);
			if (placed) return;
		}
	};

	const children = Array.from(editable.childNodes);
	for (let i = 0; i < children.length; i += 1) {
		if (i > 0) {
			offset += 1;
			if (offset >= targetOffset) {
				placeAt(children[i], 0);
				break;
			}
		}
		walkNode(children[i]);
		if (placed) break;
	}

	if (!placed) {
		const range = document.createRange();
		range.selectNodeContents(editable);
		range.collapse(false);
		selection.removeAllRanges();
		selection.addRange(range);
	}
}

export default function AiChatComposerV2({
	value,
	onChange,
	onSend,
	onCancelSend,
	isSending = false,
	models = AI_MODELS,
	selectedModel,
	autoApply,
	onToggleAutoApply,
	contextAnchorType = "campaign",
	isModelPickerOpen,
	onToggleModelPicker,
	isCommandsInfoOpen,
	onToggleCommandsInfo,
	attachments = [],
	onAddAttachments,
	onRemoveAttachment,
	disabled = false,
	commandsPopover,
	modelPopover,
}: AiChatComposerV2Props) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const inputWrapRef = useRef<HTMLDivElement>(null);
	const [isEditorFocused, setIsEditorFocused] = useState(false);
	const [caretOffset, setCaretOffset] = useState<number | null>(null);
	const [activeIndex, setActiveIndex] = useState(0);
	const [dismissedKey, setDismissedKey] = useState<string | null>(null);

	const getEditableElement = useCallback((): HTMLElement | null => {
		return (
			inputWrapRef.current?.querySelector<HTMLElement>('.MarkdownView[contenteditable="true"]') ||
			null
		);
	}, []);

	const syncCaretFromDom = useCallback(() => {
		const editable = getEditableElement();
		if (!editable) return;
		const measured = readEditorMarkdownCaretOffset(editable);
		if (measured !== null) {
			setCaretOffset(measured);
		}
	}, [getEditableElement]);

	const effectiveCaret = caretOffset ?? value.length;
	const activeTrigger =
		isEditorFocused && !disabled && !isSending && !isCommandsInfoOpen && !isModelPickerOpen
			? findActiveCommandTrigger(value, effectiveCaret)
			: null;
	const triggerKey = activeTrigger ? `${activeTrigger.start}:${activeTrigger.rawToken}` : null;
	const isBestiaryOpen = activeTrigger ? Boolean(document.querySelector(".Bestiary")) : false;

	const usedCommands = useMemo(
		() => (activeTrigger ? extractUsedCommands(value, activeTrigger) : new Set<string>()),
		[activeTrigger, value],
	);

	const suggestions = useMemo(
		() =>
			activeTrigger
				? getSuggestedAiCommands({
						query: activeTrigger.query,
						anchorType: contextAnchorType,
						isBestiaryOpen,
						usedCommands,
					})
				: [],
		[activeTrigger, contextAnchorType, isBestiaryOpen, usedCommands],
	);

	const isAutocompleteOpen = Boolean(
		activeTrigger && triggerKey !== dismissedKey && suggestions.length > 0,
	);
	const safeActiveIndex =
		suggestions.length > 0 ? Math.max(0, Math.min(activeIndex, suggestions.length - 1)) : 0;

	useEffect(() => {
		setActiveIndex(0);
		if (!triggerKey) {
			setDismissedKey(null);
		}
	}, [triggerKey]);

	const handleSelectAutocomplete = useCallback(
		(command: string) => {
			if (!activeTrigger) return;
			const { nextValue, nextCaretOffset } = applyCommandAutocomplete(
				value,
				activeTrigger,
				command,
			);
			setCaretOffset(nextCaretOffset);
			setActiveIndex(0);
			setDismissedKey(null);
			onChange(nextValue);
			window.setTimeout(() => {
				const editable = getEditableElement();
				if (editable) {
					setEditorMarkdownCaretOffset(editable, nextCaretOffset);
				}
			}, 20);
		},
		[activeTrigger, getEditableElement, onChange, value],
	);

	useEffect(() => {
		const wrap = inputWrapRef.current;
		if (!wrap || !isAutocompleteOpen) return;

		const handleCaptureKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				event.stopPropagation();
				setActiveIndex((prev) => (prev + 1) % suggestions.length);
				return;
			}
			if (event.key === "ArrowUp") {
				event.preventDefault();
				event.stopPropagation();
				setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
				return;
			}
			if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
				event.preventDefault();
				event.stopPropagation();
				const chosen = suggestions[safeActiveIndex];
				if (chosen) {
					handleSelectAutocomplete(chosen.item.command);
				}
				return;
			}
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				setDismissedKey(triggerKey);
			}
		};

		wrap.addEventListener("keydown", handleCaptureKeyDown, true);
		return () => {
			wrap.removeEventListener("keydown", handleCaptureKeyDown, true);
		};
	}, [isAutocompleteOpen, suggestions, safeActiveIndex, triggerKey, handleSelectAutocomplete]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLElement>) => {
			if (isAutocompleteOpen) return;
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				if ((value.trim() || attachments.length > 0) && !disabled && !isSending) {
					onSend();
				}
			}
		},
		[isAutocompleteOpen, value, attachments.length, disabled, isSending, onSend],
	);

	const handleEditorChange = useCallback(
		(nextValue: string) => {
			const editable = getEditableElement();
			const measured = editable ? readEditorMarkdownCaretOffset(editable) : null;
			if (measured !== null) {
				setCaretOffset(measured);
			} else if (nextValue.length >= value.length && nextValue.startsWith(value)) {
				setCaretOffset(nextValue.length);
			} else {
				setCaretOffset(nextValue.length);
			}
			onChange(nextValue);
			window.requestAnimationFrame(syncCaretFromDom);
		},
		[getEditableElement, onChange, syncCaretFromDom, value],
	);

	const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			onAddAttachments?.(e.target.files);
		}
		e.target.value = "";
	};

	const modelList = models.length > 0 ? models : AI_MODELS;
	const currentModelInfo =
		modelList.find((m) => m.id === selectedModel) ||
		AI_MODELS.find((m) => m.id === selectedModel) ||
		modelList[0];
	const canSend =
		(Boolean(value.trim()) || attachments.length > 0) && !disabled && !isSending;

	return (
		<div className="AiChatComposerV2">
			{attachments.length > 0 && (
				<div className="AiChatComposerV2__attachments">
					{attachments.map((att) => (
						<div key={att.id} className="AiChatComposerV2__attachmentChip">
							<span className="AiChatComposerV2__attachmentKind">
								{att.kind === "image" ? "IMG" : "FILE"}
							</span>
							<span className="AiChatComposerV2__attachmentName" title={att.name}>
								{att.name}
							</span>
							<button
								type="button"
								className="AiChatComposerV2__attachmentRemove"
								onClick={() => onRemoveAttachment?.(att.id)}
								aria-label={`Видалити вкладення ${att.name}`}
								disabled={isSending}
							>
								<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
									<line x1="18" y1="6" x2="6" y2="18" />
									<line x1="6" y1="6" x2="18" y2="18" />
								</svg>
							</button>
						</div>
					))}
				</div>
			)}

			<div
				className="AiChatComposerV2__inputWrap"
				ref={inputWrapRef}
				onKeyUp={syncCaretFromDom}
				onClick={syncCaretFromDom}
			>
				<AiCommandAutocompleteV2
					isOpen={isAutocompleteOpen}
					items={suggestions}
					activeIndex={safeActiveIndex}
					onHoverIndex={setActiveIndex}
					onSelect={handleSelectAutocomplete}
					onClose={() => setDismissedKey(triggerKey)}
				/>
				<EditableField
					type="textarea"
					className="AiChatComposerV2__editor"
					aria-label="Повідомлення для AI-асистента"
					placeholder="Запитайте що завгодно, введіть @команду або Ctrl+K для сутності..."
					value={value}
					onChange={(event) => handleEditorChange(event.target.value)}
					onFocus={() => {
						setIsEditorFocused(true);
						window.requestAnimationFrame(syncCaretFromDom);
					}}
					onBlur={() => setIsEditorFocused(false)}
					onKeyDown={handleKeyDown}
					disabled={disabled || isSending}
					showCopyButton={false}
				/>
			</div>

			<input
				ref={fileInputRef}
				type="file"
				multiple
				accept={`${AI_IMAGE_ACCEPT},${AI_FILE_ACCEPT}`}
				style={{ display: "none" }}
				onChange={handleFileChange}
			/>

			<div className="AiChatComposerV2__toolbar">
				{commandsPopover}
				{modelPopover}
				<div className="AiChatComposerV2__toolsLeft">
					<button
						type="button"
						className="AiChatComposerV2__iconBtn"
						onClick={() => fileInputRef.current?.click()}
						disabled={disabled || isSending}
						title="Прикріпити зображення або документ"
						aria-label="Прикріпити файл"
					>
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
						</svg>
					</button>

					<button
						type="button"
						className={`AiChatComposerV2__iconBtn AiChatComposerV2__infoBtn ${isCommandsInfoOpen ? "is-active" : ""}`}
						onClick={onToggleCommandsInfo}
						title="Довідка по швидких командах (@scene, @npc, @encounter...)"
						aria-label="Довідка по командах"
						aria-expanded={isCommandsInfoOpen}
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<circle cx="12" cy="12" r="9.5" />
							<line x1="12" y1="11.5" x2="12" y2="16.5" />
							<circle cx="12" cy="8" r="1.15" fill="currentColor" stroke="none" />
						</svg>
					</button>

					<button
						type="button"
						className={`AiChatComposerV2__modelPill ${isModelPickerOpen ? "is-active" : ""}`}
						onClick={onToggleModelPicker}
						title="Змінити модель штучного інтелекту"
						aria-expanded={isModelPickerOpen}
						disabled={isSending}
					>
						<span className="AiChatComposerV2__modelSparkle">✦</span>
						<span className="AiChatComposerV2__modelName">
							{currentModelInfo?.name || selectedModel}
						</span>
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
							<polyline points="6 9 12 15 18 9" />
						</svg>
					</button>

					<label
						className="AiChatComposerV2__autoApply"
						title="Автоматично застосовувати безпечні пропозиції ШІ (крім видалення) без додаткового підтвердження"
					>
						<input
							type="checkbox"
							checked={autoApply}
							onChange={(e) => onToggleAutoApply(e.target.checked)}
							disabled={isSending}
						/>
						<span>Авто-дії</span>
					</label>
				</div>

				<div className="AiChatComposerV2__toolsRight">
					{isSending ? (
						<button
							type="button"
							className="AiChatComposerV2__stopBtn"
							onClick={onCancelSend}
							title="Зупинити генерацію"
							aria-label="Зупинити генерацію"
						>
							<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
								<rect x="4" y="4" width="16" height="16" rx="2" />
							</svg>
						</button>
					) : (
						<button
							type="button"
							className={`AiChatComposerV2__sendBtn ${canSend ? "is-ready" : ""}`}
							onClick={onSend}
							disabled={!canSend}
							title="Надіслати повідомлення (Enter)"
							aria-label="Надіслати повідомлення"
						>
							<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
								<line x1="12" y1="19" x2="12" y2="5" />
								<polyline points="5 12 12 5 19 12" />
							</svg>
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
