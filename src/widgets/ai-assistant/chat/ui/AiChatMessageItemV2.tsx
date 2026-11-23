import {
	Children,
	cloneElement,
	createElement,
	isValidElement,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent,
	type ReactNode,
} from "react";
import Markdown from "react-markdown";
import { EditableField } from "../../../../features/editor/ui/index.js";
import { lang } from "../../../../shared/lib/index.js";
import { getChatDateLocale } from "../model/aiChatLocalization.ts";
import { renderChatMentionText } from "./renderChatMentionText.tsx";
import type { AiActionCard, ChatMessage } from "../model/aiChatTypes.ts";
import AiActionCardV2 from "./AiActionCardV2.tsx";

interface AiChatMessageItemV2Props {
	message: ChatMessage;
	isLastUserMessage?: boolean;
	isLastAssistantMessage?: boolean;
	isSending?: boolean;
	isLegacyArchive?: boolean;
	canGenerateImages?: boolean;
	isImagePromptReply?: boolean;
	busyActionIds?: Set<string>;
	onApplyActionCard: (cardId: string) => void;
	onUndoActionCard?: (cardId: string) => void;
	onRejectActionCard?: (cardId: string) => void;
	onOpenDiff: (card: AiActionCard) => void;
	onEditUserMessage?: (messageId: string, nextContent: string) => void;
	onRegenerateAssistant?: () => void;
	onGenerateImageFromPrompt?: (prompt: string) => void;
}

function renderMentionChildren(children: ReactNode): ReactNode {
	return Children.map(children, (child) => {
		if (typeof child === "string") {
			return renderChatMentionText(child);
		}
		if (isValidElement<{ children?: ReactNode }>(child) && child.props.children) {
			if (child.type === "code" || child.type === "pre") {
				return child;
			}
			return cloneElement(child, {
				...child.props,
				children: renderMentionChildren(child.props.children),
			});
		}
		return child;
	});
}

const MARKDOWN_TAGS = [
	"p",
	"strong",
	"em",
	"del",
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

const MARKDOWN_COMPONENTS = Object.fromEntries(
	MARKDOWN_TAGS.map((tag) => [
		tag,
		({ children, ...tagProps }: { children?: ReactNode } & Record<string, unknown>) =>
			createElement(tag, tagProps, renderMentionChildren(children)),
	]),
);

function formatMessageTime(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleTimeString(getChatDateLocale(), {
		hour: "2-digit",
		minute: "2-digit",
	});
}

export default function AiChatMessageItemV2({
	message,
	isLastUserMessage = false,
	isLastAssistantMessage = false,
	isSending = false,
	isLegacyArchive = false,
	canGenerateImages = false,
	isImagePromptReply = false,
	busyActionIds,
	onApplyActionCard,
	onUndoActionCard,
	onRejectActionCard,
	onOpenDiff,
	onEditUserMessage,
	onRegenerateAssistant,
	onGenerateImageFromPrompt,
}: AiChatMessageItemV2Props) {
	const isUser = message.role === "user";
	const [isEditing, setIsEditing] = useState(false);
	const [draftText, setDraftText] = useState(message.content);
	const [isCopied, setIsCopied] = useState(false);
	const copyTimerRef = useRef<number | null>(null);
	const editBoxRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		return () => {
			if (copyTimerRef.current !== null) {
				window.clearTimeout(copyTimerRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (!isEditing) {
			setDraftText(message.content);
		}
	}, [message.content, isEditing]);

	const handleCopy = useCallback(() => {
		const text = String(message.content || "");
		if (!text || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
		void navigator.clipboard
			.writeText(text)
			.then(() => {
				setIsCopied(true);
				if (copyTimerRef.current !== null) {
					window.clearTimeout(copyTimerRef.current);
				}
				copyTimerRef.current = window.setTimeout(() => {
					setIsCopied(false);
					copyTimerRef.current = null;
				}, 1800);
			})
			.catch(() => {});
	}, [message.content]);

	const startEdit = useCallback(() => {
		setDraftText(message.content);
		setIsEditing(true);
		window.setTimeout(() => {
			const editable = editBoxRef.current?.querySelector<HTMLElement>(
				'.MarkdownView[contenteditable="true"]',
			);
			editable?.focus();
		}, 30);
	}, [message.content]);

	const cancelEdit = useCallback(() => {
		setDraftText(message.content);
		setIsEditing(false);
	}, [message.content]);

	const submitEdit = useCallback(() => {
		const trimmed = draftText.trim();
		if (!trimmed || isSending) return;
		setIsEditing(false);
		onEditUserMessage?.(message.id, trimmed);
	}, [draftText, isSending, message.id, onEditUserMessage]);

	useEffect(() => {
		const box = editBoxRef.current;
		if (!isEditing || !box) return;
		const handleCaptureEscape = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				cancelEdit();
			}
		};
		box.addEventListener("keydown", handleCaptureEscape, true);
		return () => {
			box.removeEventListener("keydown", handleCaptureEscape, true);
		};
	}, [isEditing, cancelEdit]);

	const handleEditKeyDown = useCallback(
		(event: KeyboardEvent<HTMLElement>) => {
			if (event.key === "Enter" && !event.shiftKey) {
				event.preventDefault();
				submitEdit();
			} else if (event.key === "Escape") {
				event.preventDefault();
				cancelEdit();
			}
		},
		[submitEdit, cancelEdit],
	);

	const renderedUserContent = useMemo(() => {
		if (!isUser) return null;
		return renderChatMentionText(message.content);
	}, [isUser, message.content]);

	if (isUser) {
		const canEdit = isLastUserMessage && !isSending && !isLegacyArchive && Boolean(onEditUserMessage);
		return (
			<div className="AiChatMessageItemV2 AiChatMessageItemV2--user">
				<div className={`AiChatMessageItemV2__bubble ${isEditing ? "is-editing" : ""}`}>
					{message.attachments && message.attachments.length > 0 && (
						<div className="AiChatMessageItemV2__attachments">
							{message.attachments.map((att, idx) => (
								<span key={att.id || idx} className="AiChatMessageItemV2__attachmentChip">
									<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
									</svg>
									<span>{att.name}</span>
								</span>
							))}
						</div>
					)}
					{isEditing ? (
						<div className="AiChatMessageItemV2__editBox" ref={editBoxRef}>
							<EditableField
								type="textarea"
								className="AiChatMessageItemV2__editEditor"
								campaignSlug="bestiary"
								aria-label={lang.t("Edit message")}
								value={draftText}
								onChange={(event) => setDraftText(event.target.value)}
								onKeyDown={handleEditKeyDown}
								disabled={isSending}
								showCopyButton={false}
							/>
							<div className="AiChatMessageItemV2__editActions">
								<button
									type="button"
									className="AiChatMessageItemV2__editBtn AiChatMessageItemV2__editBtn--cancel"
									onClick={cancelEdit}
									disabled={isSending}
								>
									{lang.t("Cancel")}
								</button>
								<button
									type="button"
									className="AiChatMessageItemV2__editBtn AiChatMessageItemV2__editBtn--submit"
									onClick={submitEdit}
									disabled={isSending || !draftText.trim()}
								>
									{lang.t("Send")}
								</button>
							</div>
						</div>
					) : (
						<>
							{message.content ? (
								<div className="AiChatMessageItemV2__content">{renderedUserContent}</div>
							) : null}
							<div className="AiChatMessageItemV2__userMetaRow">
								<div className="AiChatMessageItemV2__actions AiChatMessageItemV2__actions--user">
									{message.content && (
										<button
											type="button"
											className={`AiChatMessageItemV2__actionBtn ${isCopied ? "is-copied" : ""}`}
											onClick={handleCopy}
											title={isCopied ? lang.t("Copied") : lang.t("Copy prompt")}
											aria-label={lang.t("Copy prompt")}
										>
											{isCopied ? (
												<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
													<polyline points="20 6 9 17 4 12" />
												</svg>
											) : (
												<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
													<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
													<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
												</svg>
											)}
										</button>
									)}
									{canEdit && (
										<button
											type="button"
											className="AiChatMessageItemV2__actionBtn AiChatMessageItemV2__editTrigger"
											onClick={startEdit}
											title={lang.t("Edit last prompt")}
											aria-label={lang.t("Edit prompt")}
										>
											<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
												<path d="M12 20h9" />
												<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
											</svg>
										</button>
									)}
								</div>
								<div className="AiChatMessageItemV2__time">{formatMessageTime(message.timestamp)}</div>
							</div>
						</>
					)}
				</div>
			</div>
		);
	}

	const canRegenerate =
		isLastAssistantMessage && !isSending && !isLegacyArchive && Boolean(onRegenerateAssistant);
	const canGenerateFromPrompt =
		isImagePromptReply &&
		!message.imageUrl &&
		canGenerateImages &&
		!isSending &&
		Boolean(onGenerateImageFromPrompt);

	return (
		<div className="AiChatMessageItemV2 AiChatMessageItemV2--assistant">
			<div className="AiChatMessageItemV2__body">
				<div className="AiChatMessageItemV2__header">
					<span className="AiChatMessageItemV2__avatar" aria-hidden="true">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M12 2.5 14.4 9.6 21.5 12 14.4 14.4 12 21.5 9.6 14.4 2.5 12 9.6 9.6 12 2.5Z" />
						</svg>
					</span>
					<span className="AiChatMessageItemV2__sender">{lang.t("Assistant")}</span>
					<span className="AiChatMessageItemV2__time">{formatMessageTime(message.timestamp)}</span>
				</div>

				{message.imageUrl && (
					<div className="AiChatMessageItemV2__generatedImage">
						<a href={message.imageUrl} target="_blank" rel="noreferrer">
							<img src={message.imageUrl} alt={message.content || lang.t("Generated image")} />
						</a>
						<div className="AiChatMessageItemV2__generatedImageFooter">
							<span>{lang.t('Saved in gallery · "Attachments"')}</span>
							<a href={message.imageUrl} download>
								{lang.t("Download")}
							</a>
						</div>
					</div>
				)}

				{message.content ? (
					<div className="AiChatMessageItemV2__markdown Prose">
						<Markdown components={MARKDOWN_COMPONENTS}>{message.content}</Markdown>
					</div>
				) : null}

				{message.status === "streaming" && (
					<div className="AiChatMessageItemV2__streamStatusRow">
						<div className="AiChatMessageItemV2__typing" aria-label={lang.t("Assistant is typing")}>
							<span className="AiChatMessageItemV2__dot" />
							<span className="AiChatMessageItemV2__dot" />
							<span className="AiChatMessageItemV2__dot" />
						</div>
						{message.streamPhase === "preparing_actions" && (
							<span className="AiChatMessageItemV2__streamStatus">
								{lang.t("Preparing change proposals...")}
							</span>
						)}
					</div>
				)}

				{message.actionCards && message.actionCards.length > 0 && (
					<div className="AiChatMessageItemV2__actionCards">
						{message.actionCards.map((card) => (
							<AiActionCardV2
								key={card.id}
								card={card}
								isBusy={Boolean(busyActionIds?.has(card.id))}
								onApply={onApplyActionCard}
								onUndo={onUndoActionCard}
								onReject={onRejectActionCard}
								onOpenDiff={onOpenDiff}
							/>
						))}
					</div>
				)}

				{message.status !== "streaming" && (
					<div className="AiChatMessageItemV2__actions AiChatMessageItemV2__actions--assistant">
						{message.content && (
							<button
								type="button"
								className={`AiChatMessageItemV2__actionBtn ${isCopied ? "is-copied" : ""}`}
								onClick={handleCopy}
								title={isCopied ? lang.t("Copied") : lang.t("Copy response")}
								aria-label={lang.t("Copy response")}
							>
								{isCopied ? (
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
										<polyline points="20 6 9 17 4 12" />
									</svg>
								) : (
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
										<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
									</svg>
								)}
								<span>{isCopied ? lang.t("Copied") : lang.t("Copy text")}</span>
							</button>
						)}
						{canRegenerate && (
							<button
								type="button"
								className="AiChatMessageItemV2__actionBtn AiChatMessageItemV2__regenerateBtn"
								onClick={onRegenerateAssistant}
								title={lang.t("Regenerate response")}
								aria-label={lang.t("Regenerate response")}
							>
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<polyline points="23 4 23 10 17 10" />
									<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
								</svg>
								<span>{lang.t("Retry")}</span>
							</button>
						)}
						{canGenerateFromPrompt && (
							<button
								type="button"
								className="AiChatMessageItemV2__actionBtn AiChatMessageItemV2__generateImgBtn"
								onClick={() => onGenerateImageFromPrompt?.(message.content)}
								title={lang.t("Generate image from this prompt")}
							>
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
									<circle cx="8.5" cy="8.5" r="1.5" />
									<polyline points="21 15 16 10 5 21" />
								</svg>
								<span>{lang.t("Open in image mode")}</span>
							</button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
