import { useEffect, useMemo, useRef, useState } from "react";
import { lang } from "../../../../shared/lib/index.js";
import { getContextualChatSuggestions } from "../model/aiChatSuggestions.ts";
import type { AiActionCard, AiWorkspaceContext, ChatMessage } from "../model/aiChatTypes.ts";
import AiChatMessageItemV2 from "./AiChatMessageItemV2.tsx";

interface AiChatMessagesListV2Props {
	messages: ChatMessage[];
	isLoadingChats?: boolean;
	isSending?: boolean;
	isLegacyArchive?: boolean;
	canGenerateImages?: boolean;
	workspaceContext?: AiWorkspaceContext;
	isBestiaryScope?: boolean;
	busyActionIds?: Set<string>;
	onApplyActionCard: (cardId: string) => void;
	onUndoActionCard?: (cardId: string) => void;
	onRejectActionCard?: (cardId: string) => void;
	onOpenDiff: (card: AiActionCard) => void;
	onSelectSuggestion?: (text: string) => void;
	onEditUserMessage?: (messageId: string, nextContent: string) => void;
	onRegenerateAssistant?: () => void;
	onGenerateImageFromPrompt?: (prompt: string) => void;
}

export default function AiChatMessagesListV2({
	messages,
	isLoadingChats = false,
	isSending = false,
	isLegacyArchive = false,
	canGenerateImages = false,
	workspaceContext,
	isBestiaryScope = false,
	busyActionIds,
	onApplyActionCard,
	onUndoActionCard,
	onRejectActionCard,
	onOpenDiff,
	onSelectSuggestion,
	onEditUserMessage,
	onRegenerateAssistant,
	onGenerateImageFromPrompt,
}: AiChatMessagesListV2Props) {
	const bottomRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const [isBestiaryModalOpen, setIsBestiaryModalOpen] = useState(() =>
		typeof document !== "undefined" ? Boolean(document.querySelector(".Bestiary")) : false,
	);

	useEffect(() => {
		if (typeof document === "undefined" || messages.length > 0) return;
		const syncBestiaryOpen = () => {
			setIsBestiaryModalOpen(Boolean(document.querySelector(".Bestiary")));
		};
		syncBestiaryOpen();
		const observer = new MutationObserver(syncBestiaryOpen);
		observer.observe(document.body, { childList: true, subtree: true });
		return () => observer.disconnect();
	}, [messages.length]);

	const currentLanguage = lang.getLanguage();
	const contextualSuggestions = useMemo(
		() =>
			getContextualChatSuggestions({
				viewType: workspaceContext?.viewType || (isBestiaryScope ? "bestiary" : "campaign"),
				activeSection: workspaceContext?.activeSection || "",
				isBestiaryScope,
				isBestiaryOpen: isBestiaryModalOpen,
				translate: lang.t,
			}),
		[
			workspaceContext?.viewType,
			workspaceContext?.activeSection,
			isBestiaryScope,
			isBestiaryModalOpen,
			currentLanguage,
		],
	);

	let lastUserMessageId: string | null = null;
	let lastAssistantMessageId: string | null = null;
	for (let i = messages.length - 1; i >= 0; i -= 1) {
		const m = messages[i];
		if (!lastAssistantMessageId && m.role === "assistant") {
			lastAssistantMessageId = m.id;
		}
		if (!lastUserMessageId && m.role === "user") {
			lastUserMessageId = m.id;
		}
		if (lastUserMessageId && lastAssistantMessageId) break;
	}

	useEffect(() => {
		if (bottomRef.current) {
			bottomRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages, messages.length]);

	return (
		<div className="AiChatMessagesListV2" ref={listRef}>
			{messages.length > 0 && (
				<div className="AiChatMessagesListV2__divider">
					<span>
						{isLegacyArchive
							? lang.t("Legacy assistant archive")
							: lang.t("Start of conversation")}
					</span>
				</div>
			)}

			{isLoadingChats && messages.length === 0 ? (
				<div className="AiChatMessagesListV2__loading">
					<span>{lang.t("Loading chat history...")}</span>
				</div>
			) : messages.length === 0 ? (
				<div className="AiChatMessagesListV2__empty">
					<div className="AiChatMessagesListV2__emptyIcon">
						<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
							<path d="M12 2.5 14.4 9.6 21.5 12 14.4 14.4 12 21.5 9.6 14.4 2.5 12 9.6 9.6 12 2.5Z" />
						</svg>
					</div>
					<h3>{lang.t("How can I help the Game Master?")}</h3>
					<p>{lang.t("Ask about the current context, use @commands, or press Ctrl+K to insert entities.")}</p>

					{onSelectSuggestion && contextualSuggestions.length > 0 && (
						<div className="AiChatMessagesListV2__suggestions">
							{contextualSuggestions.map((suggestion) => (
								<button
									key={suggestion.id}
									type="button"
									className="AiChatMessagesListV2__suggestionBtn"
									onClick={() => onSelectSuggestion(suggestion.prompt)}
								>
									{suggestion.label}
								</button>
							))}
						</div>
					)}
				</div>
			) : (
				messages.map((message, idx) => {
					const prevMsg = idx > 0 ? messages[idx - 1] : null;
					const isImagePromptReply =
						message.role === "assistant" &&
						prevMsg?.role === "user" &&
						/(^|\s)@image\b/i.test(prevMsg.content || "");
					return (
						<AiChatMessageItemV2
							key={message.id}
							message={message}
							isLastUserMessage={message.id === lastUserMessageId}
							isLastAssistantMessage={message.id === lastAssistantMessageId}
							isSending={isSending}
							isLegacyArchive={isLegacyArchive}
							canGenerateImages={canGenerateImages}
							isImagePromptReply={isImagePromptReply}
							busyActionIds={busyActionIds}
							onApplyActionCard={onApplyActionCard}
							onUndoActionCard={onUndoActionCard}
							onRejectActionCard={onRejectActionCard}
							onOpenDiff={onOpenDiff}
							onEditUserMessage={onEditUserMessage}
							onRegenerateAssistant={onRegenerateAssistant}
							onGenerateImageFromPrompt={onGenerateImageFromPrompt}
						/>
					);
				})
			)}

			<div ref={bottomRef} style={{ height: 1 }} />
		</div>
	);
}
