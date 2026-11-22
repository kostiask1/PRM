interface AiAssistantHeaderV2Props {
	sessionTitle: string;
	isHistoryOpen: boolean;
	onToggleHistory: () => void;
	onCreateNewChat: () => void;
	onCollapse: () => void;
}

export default function AiAssistantHeaderV2({
	sessionTitle,
	isHistoryOpen,
	onToggleHistory,
	onCreateNewChat,
	onCollapse,
}: AiAssistantHeaderV2Props) {
	return (
		<div className="AiAssistantHeaderV2">
			<div className="AiAssistantHeaderV2__left">
				<div className="AiAssistantHeaderV2__brand">
					<span className="AiAssistantHeaderV2__logo" aria-hidden="true">
						<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M12 2.5 14.4 9.6 21.5 12 14.4 14.4 12 21.5 9.6 14.4 2.5 12 9.6 9.6 12 2.5Z" />
						</svg>
					</span>
					<span className="AiAssistantHeaderV2__brandTitle">AI-асистент</span>
				</div>

				<button
					type="button"
					className={`AiAssistantHeaderV2__sessionTitleBtn ${isHistoryOpen ? "is-active" : ""}`}
					onClick={onToggleHistory}
					title="Переглянути історію діалогів"
					aria-label="Історія діалогів"
					aria-expanded={isHistoryOpen}
				>
					<span className="AiAssistantHeaderV2__sessionTitleText">{sessionTitle}</span>
					<svg
						className={`AiAssistantHeaderV2__chevron ${isHistoryOpen ? "is-open" : ""}`}
						width="13"
						height="13"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
					>
						<polyline points="6 9 12 15 18 9" />
					</svg>
				</button>
			</div>

			<div className="AiAssistantHeaderV2__right">
				<button
					type="button"
					className="AiAssistantHeaderV2__actionBtn"
					onClick={onCreateNewChat}
					title="Створити новий чат"
					aria-label="Створити новий чат"
				>
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="5" y1="12" x2="19" y2="12" />
					</svg>
				</button>

				<button
					type="button"
					className="AiAssistantHeaderV2__actionBtn AiAssistantHeaderV2__collapseBtn"
					onClick={onCollapse}
					title="Згорнути панель (Ctrl+J)"
					aria-label="Згорнути панель"
				>
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>
		</div>
	);
}
