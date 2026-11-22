import { renderChatMentionText } from "./renderChatMentionText.tsx";
import type { AiActionCard } from "../model/aiChatTypes.ts";

interface AiActionCardV2Props {
	card: AiActionCard;
	isBusy?: boolean;
	onApply: (cardId: string) => void;
	onUndo?: (cardId: string) => void;
	onReject?: (cardId: string) => void;
	onOpenDiff: (card: AiActionCard) => void;
}

export default function AiActionCardV2({
	card,
	isBusy = false,
	onApply,
	onUndo,
	onReject,
	onOpenDiff,
}: AiActionCardV2Props) {
	const isAtomic = card.type === "atomic";
	const isApplied = card.status === "applied";
	const isRejected = card.status === "rejected";
	const isUndone = card.status === "undone";
	const canApply = !isApplied && !isRejected;
	const hasDiffPreview = Boolean(
		(card.diffResources && card.diffResources.length > 0) ||
			card.aiResponseId ||
			(card.diffSnippet && (card.diffSnippet.before || card.diffSnippet.after)),
	);

	return (
		<div
			className={`AiActionCardV2 ${
				isAtomic ? "AiActionCardV2--atomic" : "AiActionCardV2--diff"
			} ${isApplied ? "is-applied" : ""} ${isRejected ? "is-rejected" : ""}`}
		>
			<div className="AiActionCardV2__header">
				<div
					className={`AiActionCardV2__iconBadge ${
						!isAtomic ? "AiActionCardV2__iconBadge--diff" : ""
					}`}
				>
					{isAtomic ? (
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
							<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
						</svg>
					) : (
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
							<polyline points="14 2 14 8 20 8" />
							<line x1="16" y1="13" x2="8" y2="13" />
							<line x1="16" y1="17" x2="8" y2="17" />
						</svg>
					)}
				</div>

				<div className="AiActionCardV2__titleGroup">
					<span className="AiActionCardV2__title">{card.title}</span>
					{card.subtitle && (
						<span className="AiActionCardV2__subtitle">
							{card.subtitle}
							{isUndone ? " · Скасовано" : ""}
						</span>
					)}
				</div>

				{canApply && onReject && (
					<button
						type="button"
						className="AiActionCardV2__dismissBtn"
						disabled={isBusy}
						onClick={() => onReject(card.id)}
						title="Відхилити пропозицію"
						aria-label="Відхилити пропозицію"
					>
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				)}
			</div>

			{card.stats && card.stats.length > 0 && (
				<div className="AiActionCardV2__stats">
					{card.stats.map((stat, idx) => (
						<span
							key={idx}
							className={`AiActionCardV2__statPill AiActionCardV2__statPill--${stat.type || "neutral"}`}
						>
							{stat.value}
						</span>
					))}
				</div>
			)}

			{card.description && (
				<div className="AiActionCardV2__description">
					{renderChatMentionText(card.description)}
				</div>
			)}

			<div className="AiActionCardV2__actions">
				{isApplied ? (
					<div className="AiActionCardV2__appliedRow">
						<div className="AiActionCardV2__appliedStatus">
							<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
								<polyline points="20 6 9 17 4 12" />
							</svg>
							<span>{isAtomic ? "Застосовано" : "Зміни збережено"}</span>
						</div>
						<div className="AiActionCardV2__appliedBtns">
							{hasDiffPreview && (
								<button
									type="button"
									className="AiActionCardV2__btn AiActionCardV2__btn--ghost"
									disabled={isBusy}
									onClick={() => onOpenDiff(card)}
									title="Переглянути деталі / картку"
								>
									Деталі
								</button>
							)}
							{card.aiResponseId && onUndo && (
								<button
									type="button"
									className="AiActionCardV2__btn AiActionCardV2__btn--ghost"
									disabled={isBusy}
									onClick={() => onUndo(card.id)}
									title="Скасувати ці зміни"
								>
									{isBusy ? "Скасування..." : "Скасувати"}
								</button>
							)}
						</div>
					</div>
				) : isRejected ? (
					<div className="AiActionCardV2__rejectedStatus">
						<span>Пропозицію відхилено</span>
					</div>
				) : (
					<>
						<button
							type="button"
							className="AiActionCardV2__btn AiActionCardV2__btn--primary"
							disabled={isBusy}
							onClick={() => onApply(card.id)}
						>
							<span>
								{isBusy
									? "Виконується..."
									: isAtomic
										? "Виконати дію"
										: "Застосувати"}
							</span>
						</button>
						{hasDiffPreview && (
							<button
								type="button"
								className="AiActionCardV2__btn AiActionCardV2__btn--secondary"
								disabled={isBusy}
								onClick={() => onOpenDiff(card)}
							>
								<span>Переглянути Diff</span>
							</button>
						)}
					</>
				)}
			</div>
		</div>
	);
}
