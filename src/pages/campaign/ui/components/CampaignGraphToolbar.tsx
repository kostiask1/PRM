import type { CSSProperties } from "react";

import { Button } from "../../../../shared/ui/index.js";
import { lang } from "../../../../shared/lib/index.js";
import {
	CAMPAIGN_GRAPH_FILTERS,
	type CampaignGraphConnectionMode,
	type CampaignGraphEnabledFilters,
	type CampaignGraphFilterId,
} from "../../model/campaignGraphPresentation.ts";

type GraphCssProperties = CSSProperties & Record<`--${string}`, string | number>;

interface CampaignGraphToolbarProps {
	query: string;
	onQueryChange: (value: string) => void;
	visibleNodeCount: number;
	totalNodeCount: number;
	onRelayout: () => void;
	connectionMode: CampaignGraphConnectionMode;
	onConnectionModeChange: (mode: CampaignGraphConnectionMode) => void;
	enabledFilters: CampaignGraphEnabledFilters;
	typeCounts: Partial<Record<CampaignGraphFilterId, number>>;
	filterColors: Readonly<Record<CampaignGraphFilterId, string>>;
	onToggleFilter: (filterId: CampaignGraphFilterId) => void;
}

export function CampaignGraphToolbar({
	query,
	onQueryChange,
	visibleNodeCount,
	totalNodeCount,
	onRelayout,
	connectionMode,
	onConnectionModeChange,
	enabledFilters,
	typeCounts,
	filterColors,
	onToggleFilter,
}: CampaignGraphToolbarProps) {
	return (
		<div className="CampaignNotesGraph__toolbar">
			<div className="CampaignNotesGraph__toolbarPrimary">
				<label className="CampaignNotesGraph__searchWrap">
					<span className="CampaignNotesGraph__visuallyHidden">
						{lang.t("Search graph...")}
					</span>
					<input
						className="CampaignNotesGraph__search"
						value={query}
						onChange={(event) => onQueryChange(event.target.value)}
						placeholder={lang.t("Search graph...")}
					/>
					<span className="CampaignNotesGraph__visibleCount">
						{visibleNodeCount}/{totalNodeCount}
					</span>
				</label>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="restore"
					onClick={onRelayout}
					className="CampaignNotesGraph__relayout"
					title={lang.t("Arrange graph")}
				>
					{lang.t("Arrange")}
				</Button>
				<div
					className="CampaignNotesGraph__connectionModes"
					role="group"
					aria-label={lang.t("Connection mode")}
				>
					{(["direct", "all"] as const).map((mode) => (
						<Button
							key={mode}
							variant={connectionMode === mode ? "primary" : "ghost"}
							size={Button.SIZES.SMALL}
							onClick={() => onConnectionModeChange(mode)}
							className="CampaignNotesGraph__connectionMode"
							aria-pressed={connectionMode === mode}
						>
							{lang.t(mode === "direct" ? "Direct connections" : "All connections")}
						</Button>
					))}
				</div>
			</div>
			<div className="CampaignNotesGraph__filters">
				{CAMPAIGN_GRAPH_FILTERS.map((filter) => (
					<Button
						key={filter.id}
						variant={enabledFilters[filter.id] ? "primary" : "ghost"}
						size={Button.SIZES.SMALL}
						onClick={() => onToggleFilter(filter.id)}
						className="CampaignNotesGraph__filter"
						style={
							{
								"--filter-color": filterColors[filter.id],
							} as GraphCssProperties
						}
						aria-pressed={enabledFilters[filter.id]}
					>
						{lang.t(filter.label)}
						{typeCounts[filter.id] ? ` ${typeCounts[filter.id]}` : ""}
					</Button>
				))}
			</div>
			<p className="CampaignNotesGraph__hint">
				{lang.t(
					"Drag nodes to arrange them. Double-click or use the arrow to open an item.",
				)}
			</p>
		</div>
	);
}
