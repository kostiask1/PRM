import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
	type ClipboardEvent,
	type KeyboardEvent,
	type ReactNode,
} from "react";
import {
	AI_FILE_ACCEPT,
	AI_IMAGE_ACCEPT,
	getSupportedAiImageMimeType,
} from "../../../../features/ai/index.js";
import { EditableField } from "../../../../features/editor/ui/index.js";
import { formatEntityMention, lang } from "../../../../shared/lib/index.js";
import type {
	AiChatAttachment,
	AiContextAnchor,
	AiModelOption,
} from "../model/aiChatTypes.ts";
import { localizeAiModelOption } from "../model/aiChatLocalization.ts";
import {
	applyCommandAutocomplete,
	extractUsedCommands,
	findActiveCommandTrigger,
	getSuggestedAiCommands,
} from "../model/aiCommandAutocomplete.ts";
import { AI_MODELS } from "../model/aiModels.ts";
import AiCommandAutocompleteV2 from "./popovers/AiCommandAutocompleteV2.tsx";
import AiAttachMenuPopoverV2 from "./popovers/AiAttachMenuPopoverV2.tsx";

interface AiChatComposerV2Props {
	value: string;
	onChange: (value: string) => void;
	onSend: () => void;
	onCancelSend?: () => void;
	isSending?: boolean;
	models?: readonly AiModelOption[];
	selectedModel: string;
	imageModels?: readonly AiModelOption[];
	selectedImageModel?: string;
	autoApply: boolean;
	onToggleAutoApply: (autoApply: boolean) => void;
	contextAnchorType?: AiContextAnchor["type"];
	isModelPickerOpen: boolean;
	onToggleModelPicker: () => void;
	isCommandsInfoOpen: boolean;
	onToggleCommandsInfo: () => void;
	isImageMode?: boolean;
	imageModeAction?: "generate" | "prompt";
	onToggleImageMode?: () => void;
	onExitImageMode?: () => void;
	onChangeImageModeAction?: (action: "generate" | "prompt") => void;
	isAttachMenuOpen?: boolean;
	onToggleAttachMenu?: () => void;
	onCloseAttachMenu?: () => void;
	onOpenGalleryPicker?: () => void;
	onRegisterFocus?: (fn: (() => void) | null) => void;
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
	models = [],
	selectedModel,
	imageModels = [],
	selectedImageModel = "",
	autoApply,
	onToggleAutoApply,
	contextAnchorType = "campaign",
	isModelPickerOpen,
	onToggleModelPicker,
	isCommandsInfoOpen,
	onToggleCommandsInfo,
	isImageMode = false,
	imageModeAction = "generate",
	onToggleImageMode,
	onExitImageMode,
	onChangeImageModeAction,
	isAttachMenuOpen = false,
	onToggleAttachMenu,
	onCloseAttachMenu,
	onOpenGalleryPicker,
	onRegisterFocus,
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

	const focusEditor = useCallback(() => {
		window.requestAnimationFrame(() => {
			getEditableElement()?.focus();
		});
	}, [getEditableElement]);

	useEffect(() => {
		onRegisterFocus?.(() => {
			getEditableElement()?.focus();
		});
		return () => {
			onRegisterFocus?.(null);
		};
	}, [onRegisterFocus, getEditableElement]);

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
		isEditorFocused &&
		!disabled &&
		!isSending &&
		!isCommandsInfoOpen &&
		!isModelPickerOpen &&
		!isAttachMenuOpen
			? findActiveCommandTrigger(value, effectiveCaret)
			: null;
	const triggerKey = activeTrigger ? `${activeTrigger.start}:${activeTrigger.rawToken}` : null;
	const isBestiaryOpen = activeTrigger ? Boolean(document.querySelector(".Bestiary")) : false;

	const currentLanguage = lang.getLanguage();
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
						translate: lang.t,
					})
				: [],
		[activeTrigger, contextAnchorType, isBestiaryOpen, usedCommands, currentLanguage],
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

	const fallbackModels = useMemo(
		() => AI_MODELS.map(localizeAiModelOption),
		[currentLanguage],
	);
	const modelList = models.length > 0 ? models : fallbackModels;
	const currentModelInfo =
		modelList.find((m) => m.id === selectedModel) ||
		fallbackModels.find((m) => m.id === selectedModel) ||
		modelList[0];
	const currentImageModelInfo =
		imageModels.find((m) => m.id === selectedImageModel) || imageModels[0];
	const isGenerateImageAction = isImageMode && imageModeAction === "generate";
	const hasImageModels = imageModels.length > 0;
	const canSend = isGenerateImageAction
		? Boolean(value.trim()) && hasImageModels && !disabled && !isSending
		: (Boolean(value.trim()) || attachments.length > 0) && !disabled && !isSending;

	const handlePaste = useCallback(
		(e: ClipboardEvent<HTMLElement>) => {
			if (disabled || isSending) return;
			const items = Array.from(e.clipboardData?.items || []);
			const imageFiles: File[] = [];
			for (const item of items) {
				if (item.kind !== "file") continue;
				const file = item.getAsFile();
				if (!file) continue;
				if (
					getSupportedAiImageMimeType(file) ||
					file.type.toLowerCase().startsWith("image/")
				) {
					imageFiles.push(file);
				}
			}
			if (imageFiles.length === 0) return;
			e.preventDefault();
			if (typeof DataTransfer !== "undefined") {
				const transfer = new DataTransfer();
				imageFiles.forEach((file) => transfer.items.add(file));
				onAddAttachments?.(transfer.files);
			}
		},
		[disabled, isSending, onAddAttachments],
	);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLElement>) => {
			if (isAutocompleteOpen) return;
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				if (canSend) {
					onSend();
				}
			}
		},
		[isAutocompleteOpen, canSend, onSend],
	);

	const editorPlaceholder = isImageMode
		? isGenerateImageAction
			? lang.t("Describe the image to generate...")
			: lang.t("Describe the scene to compose a ready @image prompt...")
		: lang.t("Ask anything, type @command, or press Ctrl+K for an entity...");

	const modelPillLabel = isGenerateImageAction
		? currentImageModelInfo?.name || selectedImageModel || lang.t("No models found")
		: currentModelInfo?.name || selectedModel;

	return (
		<div className={`AiChatComposerV2 ${isImageMode ? "is-image-mode" : ""}`}>
			{isImageMode && (
				<div className="AiChatComposerV2__imageModeBanner">
					<div className="AiChatComposerV2__imageModeTitleGroup">
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							aria-hidden="true"
						>
							<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
							<circle cx="8.5" cy="8.5" r="1.5" />
							<polyline points="21 15 16 10 5 21" />
						</svg>
						<span>{lang.t("Image mode")}</span>
					</div>
					<div className="AiChatComposerV2__imageModeControls">
						<div
							className="AiChatComposerV2__actionSwitch"
							role="group"
							aria-label={lang.t("Image mode action")}
						>
							<button
								type="button"
								className={`AiChatComposerV2__actionSwitchBtn ${
									imageModeAction === "generate" ? "is-active" : ""
								}`}
								onClick={() => {
									onChangeImageModeAction?.("generate");
									focusEditor();
								}}
								disabled={isSending}
							>
								{lang.t("Picture")}
							</button>
							<button
								type="button"
								className={`AiChatComposerV2__actionSwitchBtn ${
									imageModeAction === "prompt" ? "is-active" : ""
								}`}
								onClick={() => {
									onChangeImageModeAction?.("prompt");
									focusEditor();
								}}
								disabled={isSending}
							>
								@image
							</button>
						</div>
						<button
							type="button"
							className="AiChatComposerV2__imageModeClose"
							onClick={onExitImageMode}
							disabled={isSending}
							title={lang.t("Exit image mode")}
							aria-label={lang.t("Exit image mode")}
						>
							<svg
								width="13"
								height="13"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.2"
							>
								<line x1="18" y1="6" x2="6" y2="18" />
								<line x1="6" y1="6" x2="18" y2="18" />
							</svg>
						</button>
					</div>
				</div>
			)}

			{attachments.length > 0 && (
				<div className="AiChatComposerV2__attachments">
					{attachments.map((att) => (
						<div key={att.id} className="AiChatComposerV2__attachmentChip">
							<span className="AiChatComposerV2__attachmentIcon" aria-hidden="true">
								{att.kind === "image" ? (
									<svg
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
									>
										<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
										<circle cx="8.5" cy="8.5" r="1.5" />
										<polyline points="21 15 16 10 5 21" />
									</svg>
								) : (
									<svg
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
									>
										<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
										<polyline points="14 2 14 8 20 8" />
									</svg>
								)}
							</span>
							<span className="AiChatComposerV2__attachmentName" title={att.name}>
								{att.name}
							</span>
							<button
								type="button"
								className="AiChatComposerV2__attachmentRemove"
								onClick={() => onRemoveAttachment?.(att.id)}
								aria-label={lang.t("Remove attachment {name}", { name: att.name })}
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
				onPaste={handlePaste}
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
					aria-label={
						isImageMode
							? lang.t("Image description for AI assistant")
							: lang.t("Message for AI assistant")
					}
					placeholder={editorPlaceholder}
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

			{isImageMode && (
				<div
					className={`AiChatComposerV2__helperHint ${
						isGenerateImageAction && !hasImageModels ? "is-warning" : ""
					}`}
				>
					{isGenerateImageAction && !hasImageModels
						? lang.t(
								"No image generation models available. Switch to @image to compose a prompt.",
							)
						: lang.t("Ctrl+K for entities · Ctrl+V to paste a photo")}
				</div>
			)}

			<input
				ref={fileInputRef}
				type="file"
				multiple
				accept={
					isGenerateImageAction
						? AI_IMAGE_ACCEPT
						: `${AI_IMAGE_ACCEPT},${AI_FILE_ACCEPT}`
				}
				style={{ display: "none" }}
				onChange={handleFileChange}
			/>

			<div className="AiChatComposerV2__toolbar">
				{commandsPopover}
				{modelPopover}
				<AiAttachMenuPopoverV2
					isOpen={isAttachMenuOpen}
					onClose={() => onCloseAttachMenu?.()}
					onChooseFromGallery={() => onOpenGalleryPicker?.()}
					onChooseFromDevice={() => fileInputRef.current?.click()}
					imageOnly={isGenerateImageAction}
					disabled={disabled || isSending}
				/>
				<div className="AiChatComposerV2__toolsLeft">
					<button
						type="button"
						className={`AiChatComposerV2__iconBtn AiChatComposerV2__attachBtn ${
							isAttachMenuOpen ? "is-active" : ""
						}`}
						onClick={onToggleAttachMenu}
						disabled={disabled || isSending}
						title={lang.t("Attach image or document")}
						aria-label={lang.t("Attach file")}
						aria-expanded={isAttachMenuOpen}
						aria-haspopup="menu"
					>
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
						</svg>
					</button>

					{onToggleImageMode && (
						<button
							type="button"
							className={`AiChatComposerV2__iconBtn AiChatComposerV2__imageBtn ${
								isImageMode ? "is-mode-active" : ""
							}`}
							onClick={onToggleImageMode}
							disabled={disabled || isSending}
							title={isImageMode ? lang.t("Exit image mode") : lang.t("Image mode")}
							aria-label={lang.t("Image mode")}
							aria-pressed={isImageMode}
						>
							<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
								<circle cx="8.5" cy="8.5" r="1.5" />
								<polyline points="21 15 16 10 5 21" />
							</svg>
						</button>
					)}

					{!isImageMode && (
						<>
							<button
								type="button"
								className={`AiChatComposerV2__iconBtn AiChatComposerV2__infoBtn ${isCommandsInfoOpen ? "is-active" : ""}`}
								onClick={onToggleCommandsInfo}
								title={lang.t("Quick commands guide (@scene, @npc, @encounter...)")}
								aria-label={lang.t("Commands guide")}
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
								title={lang.t("Change AI model")}
								aria-expanded={isModelPickerOpen}
								disabled={isSending}
							>
								<span className="AiChatComposerV2__modelSparkle">✦</span>
								<span className="AiChatComposerV2__modelName">
									{modelPillLabel}
								</span>
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
									<polyline points="6 9 12 15 18 9" />
								</svg>
							</button>

							<label
								className="AiChatComposerV2__autoApply"
								title={lang.t("Automatically apply safe AI suggestions (except deletions) without extra confirmation")}
							>
								<input
									type="checkbox"
									checked={autoApply}
									onChange={(e) => onToggleAutoApply(e.target.checked)}
									disabled={isSending}
								/>
								<span>{lang.t("Auto-apply")}</span>
							</label>
						</>
					)}
				</div>

				<div className="AiChatComposerV2__toolsRight">
					{isImageMode && (
						<button
							type="button"
							className={`AiChatComposerV2__modelPill ${isModelPickerOpen ? "is-active" : ""}`}
							onClick={onToggleModelPicker}
							title={
								isGenerateImageAction
									? lang.t("Change image model")
									: lang.t("Change AI model")
							}
							aria-expanded={isModelPickerOpen}
							disabled={isSending}
						>
							<span className="AiChatComposerV2__modelSparkle">✦</span>
							<span className="AiChatComposerV2__modelName">
								{modelPillLabel}
							</span>
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
								<polyline points="6 9 12 15 18 9" />
							</svg>
						</button>
					)}

					{isSending ? (
						<button
							type="button"
							className="AiChatComposerV2__stopBtn"
							onClick={onCancelSend}
							title={lang.t("Stop generation")}
							aria-label={lang.t("Stop generation")}
						>
							<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
								<rect x="4" y="4" width="16" height="16" rx="2" />
							</svg>
						</button>
					) : isImageMode ? (
						<button
							type="button"
							className={`AiChatComposerV2__generateBtn ${canSend ? "is-ready" : ""}`}
							onClick={onSend}
							disabled={!canSend}
							title={
								isGenerateImageAction
									? lang.t("Generate image (Enter)")
									: lang.t("Compose image prompt (Enter)")
							}
						>
							<span>
								{isGenerateImageAction ? lang.t("Generate") : lang.t("Compose")}
							</span>
							<svg
								width="13"
								height="13"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.4"
								aria-hidden="true"
							>
								<line x1="12" y1="19" x2="12" y2="5" />
								<polyline points="5 12 12 5 19 12" />
							</svg>
						</button>
					) : (
						<button
							type="button"
							className={`AiChatComposerV2__sendBtn ${canSend ? "is-ready" : ""}`}
							onClick={onSend}
							disabled={!canSend}
							title={lang.t("Send message (Enter)")}
							aria-label={lang.t("Send message")}
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
