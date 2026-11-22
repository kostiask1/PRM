import { useRef } from "react";
import type { AiChatSessionSummary } from "../../model/aiChatTypes.ts";
import { useDismissablePopover } from "./useDismissablePopover.ts";

interface AiChatHistoryDropdownV2Props {
	isOpen: boolean;
	onClose: () => void;
	sessions: AiChatSessionSummary[];
	activeSessionId: string;
	isLoading?: boolean;
	onSelectSession: (id: string) => void;
	onCreateNewChat: () => void;
	onDeleteSession: (id: string) => void;
}

function formatSessionDate(timestamp: number): string {
	const date = new Date(timestamp);
	const now = new Date();
	const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

	if (diffDays === 0) {
		return `Сьогодні, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
	}
	if (diffDays === 1) {
		return `Вчора, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
	}
	return date.toLocaleDateString([], { day: "numeric", month: "short" });
}

export default function AiChatHistoryDropdownV2({
	isOpen,
	onClose,
	sessions,
	activeSessionId,
	isLoading = false,
	onSelectSession,
	onCreateNewChat,
	onDeleteSession,
}: AiChatHistoryDropdownV2Props) {
	const ref = useRef<HTMLDivElement>(null);

	useDismissablePopover({
		isOpen,
		popoverRef: ref,
		triggerSelector: ".AiAssistantHeaderV2__sessionTitleBtn",
		onClose,
	});

	if (!isOpen) return null;

	return (
		<div className="AiChatHistoryDropdownV2" ref={ref}>
			<div className="AiChatHistoryDropdownV2__header">
				<span className="AiChatHistoryDropdownV2__title">Попередні чати</span>
				<button
					type="button"
					className="AiChatHistoryDropdownV2__newBtn"
					onClick={() => {
						onCreateNewChat();
						onClose();
					}}
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="5" y1="12" x2="19" y2="12" />
					</svg>
					<span>Новий чат</span>
				</button>
			</div>

			<div className="AiChatHistoryDropdownV2__list">
				{isLoading && sessions.length === 0 ? (
					<div className="AiChatHistoryDropdownV2__empty">Завантаження...</div>
				) : sessions.length === 0 ? (
					<div className="AiChatHistoryDropdownV2__empty">
						Ще немає збережених діалогів для цієї кампанії.
					</div>
				) : (
					sessions.map((session) => {
						const isActive = session.id === activeSessionId;
						const count = session.userMessageCount ?? 0;
						return (
							<div
								key={session.id}
								className={`AiChatHistoryDropdownV2__item ${isActive ? "is-active" : ""}`}
							>
								<button
									type="button"
									className="AiChatHistoryDropdownV2__itemBtn"
									onClick={() => {
										onSelectSession(session.id);
										onClose();
									}}
								>
									<div className="AiChatHistoryDropdownV2__itemTitle" title={session.title}>
										<span>{session.title}</span>
										{session.isLegacyArchive && (
											<span className="AiChatHistoryDropdownV2__archiveBadge">Архів</span>
										)}
									</div>
									<div className="AiChatHistoryDropdownV2__itemMeta">
										<span>{formatSessionDate(session.updatedAt || session.createdAt)}</span>
										<span>·</span>
										<span>{count} {count === 1 ? "запит" : count >= 2 && count <= 4 ? "запити" : "запитів"}</span>
									</div>
								</button>

								<button
									type="button"
									className="AiChatHistoryDropdownV2__deleteBtn"
									onClick={(e) => {
										e.stopPropagation();
										onDeleteSession(session.id);
									}}
									title="Видалити діалог"
									aria-label={`Видалити діалог ${session.title}`}
								>
									<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<line x1="18" y1="6" x2="6" y2="18" />
										<line x1="6" y1="6" x2="18" y2="18" />
									</svg>
								</button>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
