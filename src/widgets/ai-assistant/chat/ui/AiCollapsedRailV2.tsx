import { lang } from "../../../../shared/lib/index.js";

interface AiCollapsedRailV2Props {
	onExpand: () => void;
	unreadCount?: number;
}

export default function AiCollapsedRailV2({
	onExpand,
	unreadCount,
}: AiCollapsedRailV2Props) {
	return (
		<aside
			className="AiCollapsedRailV2"
			onClick={onExpand}
			title={lang.t("Expand AI chat (Ctrl+J)")}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onExpand();
				}
			}}
		>
			<button
				type="button"
				className="AiCollapsedRailV2__expandBtn"
				onClick={(e) => {
					e.stopPropagation();
					onExpand();
				}}
				title={lang.t("Expand AI chat (Ctrl+J)")}
				aria-label={lang.t("Expand AI chat")}
			>
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
					<polyline points="15 18 9 12 15 6" />
				</svg>
			</button>

			<div className="AiCollapsedRailV2__iconBadge">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M12 2.5 14.4 9.6 21.5 12 14.4 14.4 12 21.5 9.6 14.4 2.5 12 9.6 9.6 12 2.5Z" />
				</svg>
				{unreadCount && unreadCount > 0 ? (
					<span className="AiCollapsedRailV2__badge">{unreadCount}</span>
				) : null}
			</div>

			<span className="AiCollapsedRailV2__label">{lang.t("AI chat")}</span>
		</aside>
	);
}
