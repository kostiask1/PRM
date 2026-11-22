import { useRef } from "react";
import type { AiContextAnchor, AiContextSettings } from "../../model/aiChatTypes.ts";
import { useDismissablePopover } from "./useDismissablePopover.ts";

interface AiContextSettingsPopoverV2Props {
	isOpen: boolean;
	onClose: () => void;
	contextAnchor: AiContextAnchor;
	settings: AiContextSettings;
	onUpdateSettings: (settings: AiContextSettings) => void;
}

export default function AiContextSettingsPopoverV2({
	isOpen,
	onClose,
	contextAnchor,
	settings,
	onUpdateSettings,
}: AiContextSettingsPopoverV2Props) {
	const ref = useRef<HTMLDivElement>(null);

	useDismissablePopover({
		isOpen,
		popoverRef: ref,
		triggerSelector: ".AiContextAnchorBarV2__settingsBtn",
		onClose,
	});

	if (!isOpen) return null;

	const maxTokens = contextAnchor.maxTokens > 0 ? contextAnchor.maxTokens : 1000000;
	const percent = Math.min(100, Math.round((contextAnchor.tokenEstimate / maxTokens) * 100));
	const maxTokensLabel =
		maxTokens >= 1000000
			? `${Number.isInteger(maxTokens / 1000000) ? maxTokens / 1000000 : (maxTokens / 1000000).toFixed(1)}M`
			: maxTokens >= 1000
				? `${Math.round(maxTokens / 1000)}K`
				: String(maxTokens);

	const toggleSource = (key: keyof Pick<
		AiContextSettings,
		| "includeCurrentScene"
		| "includeCampaignNpc"
		| "includeCampaignLocations"
		| "includeRecentSessionHistory"
		| "includeBestiary"
	>) => {
		onUpdateSettings({
			...settings,
			[key]: !settings[key],
		});
	};

	const setMutationPermission = (permission: "diff_only" | "direct_mutation") => {
		onUpdateSettings({
			...settings,
			mutationPermission: permission,
		});
	};

	const setResponseTone = (tone: "concise" | "narrative" | "rules_strict") => {
		onUpdateSettings({
			...settings,
			responseTone: tone,
		});
	};

	return (
		<div className="AiContextSettingsPopoverV2" ref={ref}>
			<div className="AiContextSettingsPopoverV2__header">
				<div className="AiContextSettingsPopoverV2__title">
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
					<span>Налаштування контексту</span>
				</div>
				<button
					type="button"
					className="AiContextSettingsPopoverV2__closeBtn"
					onClick={onClose}
					aria-label="Закрити налаштування"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<div className="AiContextSettingsPopoverV2__body">
				{/* Token Usage Bar */}
				<div className="AiContextSettingsPopoverV2__tokenSection">
					<div className="AiContextSettingsPopoverV2__tokenLabelRow">
						<span>Використання пам'яті моделі</span>
						<strong>~{contextAnchor.tokenEstimate.toLocaleString()} / {maxTokensLabel} токенів</strong>
					</div>
					<div className="AiContextSettingsPopoverV2__progressBarBg">
						<div
							className="AiContextSettingsPopoverV2__progressBarFill"
							style={{ width: `${Math.max(percent, 2)}%` }}
						/>
					</div>
				</div>

				{/* Context Sources Checklist */}
				<div className="AiContextSettingsPopoverV2__section">
					<span className="AiContextSettingsPopoverV2__sectionHeading">Джерела контексту для ШІ</span>
					<div className="AiContextSettingsPopoverV2__checklist">
						<label className="AiContextSettingsPopoverV2__checkItem">
							<input
								type="checkbox"
								checked={settings.includeCurrentScene}
								onChange={() => toggleSource("includeCurrentScene")}
							/>
							<span>Поточна сцена та нотатки (пріоритет)</span>
						</label>

						<label className="AiContextSettingsPopoverV2__checkItem">
							<input
								type="checkbox"
								checked={settings.includeCampaignNpc}
								onChange={() => toggleSource("includeCampaignNpc")}
							/>
							<span>Персонажі та NPC кампанії</span>
						</label>

						<label className="AiContextSettingsPopoverV2__checkItem">
							<input
								type="checkbox"
								checked={settings.includeCampaignLocations}
								onChange={() => toggleSource("includeCampaignLocations")}
							/>
							<span>Локації та фракції</span>
						</label>

						<label className="AiContextSettingsPopoverV2__checkItem">
							<input
								type="checkbox"
								checked={settings.includeRecentSessionHistory}
								onChange={() => toggleSource("includeRecentSessionHistory")}
							/>
							<span>Історія попередніх сесій (останні 3)</span>
						</label>

						<label className="AiContextSettingsPopoverV2__checkItem">
							<input
								type="checkbox"
								checked={settings.includeBestiary}
								onChange={() => toggleSource("includeBestiary")}
							/>
							<span>Бестіарій кампанії та монстри</span>
						</label>
					</div>
				</div>

				{/* Mutation Permissions */}
				<div className="AiContextSettingsPopoverV2__section">
					<span className="AiContextSettingsPopoverV2__sectionHeading">Дозволи на зміни</span>
					<div className="AiContextSettingsPopoverV2__pillGroup">
						<button
							type="button"
							className={`AiContextSettingsPopoverV2__pill ${
								settings.mutationPermission === "diff_only" ? "is-active" : ""
							}`}
							onClick={() => setMutationPermission("diff_only")}
						>
							Тільки пропозиції (Diff)
						</button>
						<button
							type="button"
							className={`AiContextSettingsPopoverV2__pill ${
								settings.mutationPermission === "direct_mutation" ? "is-active" : ""
							}`}
							onClick={() => setMutationPermission("direct_mutation")}
						>
							Пряме редагування
						</button>
					</div>
				</div>

				{/* Response Tone */}
				<div className="AiContextSettingsPopoverV2__section">
					<span className="AiContextSettingsPopoverV2__sectionHeading">Стиль та тон відповіді</span>
					<div className="AiContextSettingsPopoverV2__pillGroup">
						<button
							type="button"
							className={`AiContextSettingsPopoverV2__pill ${
								settings.responseTone === "concise" ? "is-active" : ""
							}`}
							onClick={() => setResponseTone("concise")}
						>
							Лаконічний
						</button>
						<button
							type="button"
							className={`AiContextSettingsPopoverV2__pill ${
								settings.responseTone === "narrative" ? "is-active" : ""
							}`}
							onClick={() => setResponseTone("narrative")}
						>
							Художній
						</button>
						<button
							type="button"
							className={`AiContextSettingsPopoverV2__pill ${
								settings.responseTone === "rules_strict" ? "is-active" : ""
							}`}
							onClick={() => setResponseTone("rules_strict")}
						>
							Сухі правила 5e
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
