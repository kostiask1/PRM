import { useMemo, useRef, useState } from "react";
import { lang } from "../../../../../shared/lib/index.js";
import { NoteViewMode } from "../../../../../shared/ui/index.js";
import { getChatDateLocale } from "../../model/aiChatLocalization.ts";
import type {
	AiChatContextPreview,
	AiContextAnchor,
	AiContextCatalogItem,
	AiContextSettings,
} from "../../model/aiChatTypes.ts";
import {
	clearContextItems,
	formatTokenBadge,
	getEffectiveSelectedIds,
	getSectionSelectionState,
	selectAllContextItems,
	toggleContextItem,
	toggleContextSection,
	type ContextSectionKey,
	type ContextTokenBreakdown,
} from "../../model/aiContextSelection.ts";
import { useDismissablePopover } from "./useDismissablePopover.ts";

interface AiContextSettingsPopoverV2Props {
	isOpen: boolean;
	onClose: () => void;
	contextAnchor: AiContextAnchor;
	contextPreview: AiChatContextPreview | null;
	isLoadingPreview?: boolean;
	tokenBreakdown: ContextTokenBreakdown;
	settings: AiContextSettings;
	onUpdateSettings: (settings: AiContextSettings) => void;
	onCompactContext?: () => void;
	isCompacting?: boolean;
	canCompact?: boolean;
	unsummarizedCount?: number;
	hasCompactedSummary?: boolean;
	compactFeedback?: string | null;
}

interface SourceSectionDefinition {
	key: ContextSectionKey;
	label: string;
	emptyLabel: string;
	items: AiContextCatalogItem[];
}

export default function AiContextSettingsPopoverV2({
	isOpen,
	onClose,
	contextAnchor,
	contextPreview,
	isLoadingPreview = false,
	tokenBreakdown,
	settings,
	onUpdateSettings,
	onCompactContext,
	isCompacting = false,
	canCompact = false,
	unsummarizedCount = 0,
	hasCompactedSummary = false,
	compactFeedback = null,
}: AiContextSettingsPopoverV2Props) {
	const ref = useRef<HTMLDivElement>(null);
	const [expandedSections, setExpandedSections] = useState<Set<ContextSectionKey>>(
		() => new Set(),
	);
	const [sectionFilters, setSectionFilters] = useState<Partial<Record<ContextSectionKey, string>>>(
		{},
	);
	const currentLanguage = lang.getLanguage();

	useDismissablePopover({
		isOpen,
		popoverRef: ref,
		triggerSelector: ".AiContextAnchorBarV2__settingsBtn",
		onClose,
	});

	const sections = useMemo<SourceSectionDefinition[]>(() => {
		const catalog = contextPreview?.catalog;
		return [
			{
				key: "currentSession",
				label:
					contextPreview?.hasActiveSession && contextPreview.activeSessionName
						? lang.t("Current session: {name}", {
								name: contextPreview.activeSessionName,
							})
						: lang.t("Current session and scenes"),
				emptyLabel: contextPreview?.hasActiveSession
					? lang.t("No scenes")
					: lang.t("No active session"),
				items: catalog?.scenes || [],
			},
			{
				key: "characters",
				label: lang.t("Player characters"),
				emptyLabel: lang.t("Empty"),
				items: catalog?.characters || [],
			},
			{
				key: "npcs",
				label: lang.t("Campaign NPCs"),
				emptyLabel: lang.t("Empty"),
				items: catalog?.npcs || [],
			},
			{
				key: "locations",
				label: lang.t("Locations and factions"),
				emptyLabel: lang.t("Empty"),
				items: catalog?.locations || [],
			},
			{
				key: "recentSessions",
				label: lang.t("Previous sessions"),
				emptyLabel: lang.t("No other sessions"),
				items: catalog?.sessions || [],
			},
			{
				key: "bestiary",
				label: lang.t("Custom Bestiary"),
				emptyLabel: lang.t("Empty"),
				items: catalog?.bestiary || [],
			},
		];
	}, [contextPreview, currentLanguage]);

	if (!isOpen) return null;

	const maxTokens = contextAnchor.maxTokens > 0 ? contextAnchor.maxTokens : 1000000;
	const totalTokens = contextPreview ? tokenBreakdown.totalTokens : contextAnchor.tokenEstimate;
	const percent = Math.min(100, Math.round((totalTokens / maxTokens) * 100));
	const maxTokensLabel =
		maxTokens >= 1000000
			? `${Number.isInteger(maxTokens / 1000000) ? maxTokens / 1000000 : (maxTokens / 1000000).toFixed(1)}M`
			: maxTokens >= 1000
				? `${Math.round(maxTokens / 1000)}K`
				: String(maxTokens);
	const recentLimit = contextPreview?.defaultRecentSessionCount || 3;

	const toggleExpanded = (key: ContextSectionKey) => {
		setExpandedSections((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
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

	const rulesEdition: "5.5e" | "5e" = settings.rulesEdition === "5e" ? "5e" : "5.5e";
	const setRulesEdition = (edition: "5.5e" | "5e") => {
		onUpdateSettings({
			...settings,
			rulesEdition: edition,
		});
	};

	const compactStatusText = compactFeedback
		? compactFeedback
		: hasCompactedSummary && unsummarizedCount === 0
			? lang.t("Conversation compacted ✓")
			: unsummarizedCount > 0
				? lang.t("{count} uncompacted msg.", { count: unsummarizedCount })
				: lang.t("No history to compact");

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
					<span>{lang.t("Context settings")}</span>
				</div>
				<button
					type="button"
					className="AiContextSettingsPopoverV2__closeBtn"
					onClick={onClose}
					aria-label={lang.t("Close settings")}
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
						<span>{lang.t("Model memory usage")}</span>
						<strong>
							{isLoadingPreview && !contextPreview
								? "..."
								: lang.t("~{total} / {max} tokens", {
										total: totalTokens.toLocaleString(getChatDateLocale(currentLanguage)),
										max: maxTokensLabel,
									})}
						</strong>
					</div>
					<div className="AiContextSettingsPopoverV2__progressBarBg">
						<div
							className="AiContextSettingsPopoverV2__progressBarFill"
							style={{ width: `${totalTokens > 0 ? Math.max(percent, 2) : 0}%` }}
						/>
					</div>
					{contextPreview && (
						<div className="AiContextSettingsPopoverV2__tokenBreakdown">
							<span>{lang.t("System {tokens}", { tokens: formatTokenBadge(tokenBreakdown.systemTokens) })}</span>
							<span>·</span>
							<span>{lang.t("Context {tokens}", { tokens: formatTokenBadge(tokenBreakdown.contextTokens) })}</span>
							<span>·</span>
							<span>{lang.t("Chat {tokens}", { tokens: formatTokenBadge(tokenBreakdown.historyTokens) })}</span>
						</div>
					)}
					<div className="AiContextSettingsPopoverV2__compactRow">
						<button
							type="button"
							className="AiContextSettingsPopoverV2__compactBtn"
							onClick={onCompactContext}
							disabled={!canCompact || isCompacting}
							title={
								canCompact
									? lang.t("Summarize earlier chat messages into a compact summary to save tokens")
									: lang.t("No uncompacted messages in this chat")
							}
						>
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<polyline points="4 14 10 14 10 20" />
								<polyline points="20 10 14 10 14 4" />
								<line x1="14" y1="10" x2="21" y2="3" />
								<line x1="3" y1="21" x2="10" y2="14" />
							</svg>
							<span>{isCompacting ? lang.t("Compacting...") : lang.t("Compact context")}</span>
						</button>
						<span className="AiContextSettingsPopoverV2__compactStatus">
							{compactStatusText}
						</span>
					</div>
				</div>

				{/* Expandable Context Sources */}
				<div className="AiContextSettingsPopoverV2__section">
					<span className="AiContextSettingsPopoverV2__sectionHeading">{lang.t("AI context sources")}</span>
					<div className="AiContextSettingsPopoverV2__checklist">
						{sections.map((section) => {
							const selectionState = getSectionSelectionState(
								section.key,
								settings,
								section.items,
								recentLimit,
							);
							const allIds = section.items.map((item) => item.id);
							const effectiveSelectedIds = getEffectiveSelectedIds(
								section.key,
								settings,
								section.items,
								recentLimit,
							);
							const canExpand = section.items.length > 0;
							const isExpanded = canExpand && expandedSections.has(section.key);
							const filterQuery = (sectionFilters[section.key] || "").trim().toLowerCase();
							const filteredItems = filterQuery
								? section.items.filter(
										(item) =>
											item.name.toLowerCase().includes(filterQuery) ||
											(item.meta || "").toLowerCase().includes(filterQuery),
									)
								: section.items;

							let countLabel = section.emptyLabel;
							if (!contextPreview && isLoadingPreview) {
								countLabel = "...";
							} else if (section.items.length > 0) {
								if (
									section.key === "recentSessions" &&
									settings.includeRecentSessionHistory &&
									settings.selectedSessionFileNames == null &&
									section.items.length > recentLimit
								) {
									countLabel = lang.t("Last {limit} of {total}", {
										limit: recentLimit,
										total: section.items.length,
									});
								} else if (selectionState.state === "all") {
									countLabel = lang.t("All · {count}", {
										count: selectionState.totalCount,
									});
								} else {
									countLabel = lang.t("{selected} of {total}", {
										selected: selectionState.selectedCount,
										total: selectionState.totalCount,
									});
								}
							}

							const sectionTokens = contextPreview
								? tokenBreakdown.sectionTokens[section.key]
								: 0;

							return (
								<div key={section.key} className="AiContextSourceV2">
									<div className="AiContextSourceV2__row">
										<label className="AiContextSourceV2__toggleLabel">
											<input
												type="checkbox"
												checked={selectionState.state !== "none"}
												ref={(el) => {
													if (el) {
														el.indeterminate = selectionState.state === "partial";
													}
												}}
												onChange={() =>
													onUpdateSettings(toggleContextSection(section.key, settings))
												}
											/>
											<span className="AiContextSourceV2__name" title={section.label}>
												{section.label}
											</span>
										</label>

										<span className="AiContextSourceV2__countBadge">{countLabel}</span>

										{contextPreview && (
											<span
												className="AiContextSourceV2__tokens"
												title={lang.t("Estimated tokens for this section")}
											>
												{formatTokenBadge(sectionTokens)}
											</span>
										)}

										{canExpand && (
											<button
												type="button"
												className={`AiContextSourceV2__expandBtn ${isExpanded ? "is-open" : ""}`}
												onClick={() => toggleExpanded(section.key)}
												aria-expanded={isExpanded}
												aria-label={
													isExpanded
														? lang.t("Collapse {section}", { section: section.label })
														: lang.t("Expand {section}", { section: section.label })
												}
												title={
													isExpanded
														? lang.t("Collapse list")
														: lang.t("Select specific items")
												}
											>
												<svg
													width="13"
													height="13"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="2.4"
												>
													<polyline points="6 9 12 15 18 9" />
												</svg>
											</button>
										)}
									</div>

									{isExpanded && (
										<div className="AiContextSourceV2__children">
											<div className="AiContextSourceV2__tools">
												{section.items.length > 5 && (
													<input
														type="search"
														className="AiContextSourceV2__search"
														value={sectionFilters[section.key] || ""}
														onChange={(e) =>
															setSectionFilters((prev) => ({
																...prev,
																[section.key]: e.target.value,
															}))
														}
														placeholder={lang.t("Search...")}
														aria-label={lang.t("Filter {section}", {
															section: section.label,
														})}
													/>
												)}
												<div className="AiContextSourceV2__bulkBtns">
													<button
														type="button"
														className="AiContextSourceV2__bulkBtn"
														onClick={() =>
															onUpdateSettings(
																selectAllContextItems(
																	section.key,
																	settings,
																	allIds,
																	recentLimit,
																),
															)
														}
													>
														{lang.t("All")}
													</button>
													<button
														type="button"
														className="AiContextSourceV2__bulkBtn"
														onClick={() =>
															onUpdateSettings(clearContextItems(section.key, settings))
														}
													>
														{lang.t("Clear")}
													</button>
												</div>
											</div>

											<div className="AiContextSourceV2__itemList">
												{filteredItems.length === 0 ? (
													<div className="AiContextSourceV2__emptyFilter">
														{lang.t("No results")}
													</div>
												) : (
													filteredItems.map((item) => (
														<label key={item.id} className="AiContextSourceV2__item">
															<input
																type="checkbox"
																checked={effectiveSelectedIds.has(item.id)}
																onChange={() =>
																	onUpdateSettings(
																		toggleContextItem(
																			section.key,
																			settings,
																			item.id,
																			allIds,
																			recentLimit,
																		),
																	)
																}
															/>
															<span
																className="AiContextSourceV2__itemName"
																title={item.name}
															>
																{item.name}
															</span>
															{item.meta && (
																<span className="AiContextSourceV2__itemMeta">
																	{item.meta}
																</span>
															)}
															<span className="AiContextSourceV2__itemTokens">
																{formatTokenBadge(item.tokenEstimate)}
															</span>
														</label>
													))
												)}
											</div>
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>

				{/* Mutation Permissions */}
				<div className="AiContextSettingsPopoverV2__section">
					<span className="AiContextSettingsPopoverV2__sectionHeading">{lang.t("Change permissions")}</span>
					<div className="AiContextSettingsPopoverV2__pillGroup">
						<button
							type="button"
							className={`AiContextSettingsPopoverV2__pill ${
								settings.mutationPermission === "diff_only" ? "is-active" : ""
							}`}
							onClick={() => setMutationPermission("diff_only")}
						>
							{lang.t("Proposals only (Diff)")}
						</button>
						<button
							type="button"
							className={`AiContextSettingsPopoverV2__pill ${
								settings.mutationPermission === "direct_mutation" ? "is-active" : ""
							}`}
							onClick={() => setMutationPermission("direct_mutation")}
						>
							{lang.t("Direct editing")}
						</button>
					</div>
				</div>

				{/* Response Tone & Rules Edition */}
				<div className="AiContextSettingsPopoverV2__section">
					<div className="AiContextSettingsPopoverV2__sectionHeader">
						<span className="AiContextSettingsPopoverV2__sectionHeading">{lang.t("Response style and tone")}</span>
						<NoteViewMode<"5.5e" | "5e">
							value={rulesEdition}
							onChange={setRulesEdition}
							ariaLabel={lang.t("D&D rules edition")}
							className="AiContextSettingsPopoverV2__editionToggle"
							options={[
								{
									value: "5.5e",
									label: "5.5e (2024)",
									title: lang.t("Prioritize D&D 5.5e (2024) rules"),
								},
								{
									value: "5e",
									label: "5e",
									title: lang.t("Classic D&D 5e (2014) rules"),
								},
							]}
						/>
					</div>
					<div className="AiContextSettingsPopoverV2__pillGroup">
						<button
							type="button"
							className={`AiContextSettingsPopoverV2__pill ${
								settings.responseTone === "concise" ? "is-active" : ""
							}`}
							onClick={() => setResponseTone("concise")}
						>
							{lang.t("Concise")}
						</button>
						<button
							type="button"
							className={`AiContextSettingsPopoverV2__pill ${
								settings.responseTone === "narrative" ? "is-active" : ""
							}`}
							onClick={() => setResponseTone("narrative")}
						>
							{lang.t("Narrative")}
						</button>
						<button
							type="button"
							className={`AiContextSettingsPopoverV2__pill ${
								settings.responseTone === "rules_strict" ? "is-active" : ""
							}`}
							onClick={() => setResponseTone("rules_strict")}
						>
							{rulesEdition === "5e" ? lang.t("Strict 5e rules") : lang.t("Strict 5.5e rules")}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
