import {
	Children,
	cloneElement,
	createElement,
	isValidElement,
	useMemo,
	type ReactNode,
} from "react";
import Markdown from "react-markdown";
import { renderChatMentionText } from "./renderChatMentionText.tsx";
import type { AiActionCard, ChatMessage } from "../model/aiChatTypes.ts";
import AiActionCardV2 from "./AiActionCardV2.tsx";

interface AiChatMessageItemV2Props {
	message: ChatMessage;
	busyActionIds?: Set<string>;
	onApplyActionCard: (cardId: string) => void;
	onUndoActionCard?: (cardId: string) => void;
	onRejectActionCard?: (cardId: string) => void;
	onOpenDiff: (card: AiActionCard) => void;
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
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AiChatMessageItemV2({
	message,
	busyActionIds,
	onApplyActionCard,
	onUndoActionCard,
	onRejectActionCard,
	onOpenDiff,
}: AiChatMessageItemV2Props) {
	const isUser = message.role === "user";

	const renderedUserContent = useMemo(() => {
		if (!isUser) return null;
		return renderChatMentionText(message.content);
	}, [isUser, message.content]);

	if (isUser) {
		return (
			<div className="AiChatMessageItemV2 AiChatMessageItemV2--user">
				<div className="AiChatMessageItemV2__bubble">
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
					{message.content ? (
						<div className="AiChatMessageItemV2__content">{renderedUserContent}</div>
					) : null}
					<div className="AiChatMessageItemV2__time">{formatMessageTime(message.timestamp)}</div>
				</div>
			</div>
		);
	}

	return (
		<div className="AiChatMessageItemV2 AiChatMessageItemV2--assistant">
			<div className="AiChatMessageItemV2__body">
				<div className="AiChatMessageItemV2__header">
					<span className="AiChatMessageItemV2__avatar" aria-hidden="true">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M12 2.5 14.4 9.6 21.5 12 14.4 14.4 12 21.5 9.6 14.4 2.5 12 9.6 9.6 12 2.5Z" />
						</svg>
					</span>
					<span className="AiChatMessageItemV2__sender">Асистент</span>
					<span className="AiChatMessageItemV2__time">{formatMessageTime(message.timestamp)}</span>
				</div>

				{message.content ? (
					<div className="AiChatMessageItemV2__markdown Prose">
						<Markdown components={MARKDOWN_COMPONENTS}>{message.content}</Markdown>
					</div>
				) : null}

				{message.status === "streaming" && (
					<div className="AiChatMessageItemV2__streamStatusRow">
						<div className="AiChatMessageItemV2__typing" aria-label="Асистент друкує відповідь">
							<span className="AiChatMessageItemV2__dot" />
							<span className="AiChatMessageItemV2__dot" />
							<span className="AiChatMessageItemV2__dot" />
						</div>
						{message.streamPhase === "preparing_actions" && (
							<span className="AiChatMessageItemV2__streamStatus">
								Готую пропозиції змін...
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
			</div>
		</div>
	);
}
