import { lang } from "../../../../shared/lib/index.js";
import type { AiContextAnchor } from "../model/aiChatTypes.ts";

interface AiContextAnchorBarV2Props {
	contextAnchor: AiContextAnchor;
	isSettingsOpen: boolean;
	onToggleSettings: () => void;
	onTogglePin?: () => void;
	onResyncAnchor?: () => void;
}

export default function AiContextAnchorBarV2({
	contextAnchor,
	isSettingsOpen,
	onToggleSettings,
	onTogglePin,
	onResyncAnchor,
}: AiContextAnchorBarV2Props) {
	return (
		<div className="AiContextAnchorBarV2">
			<div className="AiContextAnchorBarV2__left">
				<button
					type="button"
					className={`AiContextAnchorBarV2__pinBtn ${contextAnchor.pinned ? "is-pinned" : ""}`}
					onClick={onTogglePin}
					title={
						contextAnchor.pinned
							? lang.t("Context is pinned. Click to automatically follow the editor")
							: lang.t("Pin current context to this chat")
					}
					aria-label={contextAnchor.pinned ? lang.t("Unpin context") : lang.t("Pin context")}
				>
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
						<line x1="12" y1="17" x2="12" y2="22" />
						<path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
					</svg>
				</button>

				<span className="AiContextAnchorBarV2__title" title={contextAnchor.title}>
					{contextAnchor.title}
				</span>

				{contextAnchor.synced ? (
					<span
						className="AiContextAnchorBarV2__syncBadge"
						title={
							contextAnchor.subtitle ||
							lang.t("Context updates automatically with the editor")
						}
					>
						<span className="AiContextAnchorBarV2__syncDot" />
						<span>{contextAnchor.pinned ? lang.t("Pinned") : lang.t("Synced")}</span>
					</span>
				) : (
					<button
						type="button"
						className="AiContextAnchorBarV2__resyncBtn"
						onClick={onResyncAnchor}
						title={lang.t("Chat is pinned to another page. Click to attach it to the current screen")}
					>
						<span>{lang.t("Sync anchor")}</span>
					</button>
				)}
			</div>

			<div className="AiContextAnchorBarV2__right">
				<button
					type="button"
					className={`AiContextAnchorBarV2__settingsBtn ${isSettingsOpen ? "is-active" : ""}`}
					onClick={onToggleSettings}
					title={lang.t("Context and model memory settings")}
					aria-label={lang.t("Context settings")}
					aria-expanded={isSettingsOpen}
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<line x1="4" y1="21" x2="4" y2="14" />
						<line x1="4" y1="10" x2="4" y2="3" />
						<line x1="12" y1="21" x2="12" y2="12" />
						<line x1="12" y1="8" x2="12" y2="3" />
						<line x1="20" y1="21" x2="20" y2="16" />
						<line x1="20" y1="12" x2="20" y2="3" />
						<line x1="1" y1="14" x2="7" y2="14" />
						<line x1="9" y1="8" x2="15" y2="8" />
						<line x1="17" y1="16" x2="23" y2="16" />
					</svg>
				</button>
			</div>
		</div>
	);
}
