import type { KeyboardEvent, MouseEvent } from "react";

import { lang, makeDomId } from "../../../shared/lib/index.js";
import {
	Button,
	CollapseToggleButton,
	DraggableList,
	ListCard,
	Tooltip,
} from "../../../shared/ui/index.js";
import { StatusBadge } from "../../../features/status-badge/index.js";
import { makeHistoryTargetId } from "../../../entities/history/index.js";
import {
	getSidebarCampaignMonogram,
	isSidebarToggleKey,
	SIDEBAR_SHORTCUT_LABELS,
	type SidebarCampaign,
	type SidebarCampaignGroup,
	type SidebarCampaignGroups,
} from "../model/sidebar.ts";

interface SidebarCampaignSectionProps {
	groups: SidebarCampaignGroups;
	activeCampaignId: string;
	isCompletedCollapsed: boolean;
	onToggleCompleted: () => void;
	onCreateCampaign: () => void;
	onSelectCampaign: (campaignSlug: string) => void;
	onToggleCampaignStatus: (campaign: SidebarCampaign) => void;
	onReorder: (
		group: SidebarCampaignGroup,
		campaigns: SidebarCampaign[],
	) => void;
	onDrop: (
		group: SidebarCampaignGroup,
		campaigns: SidebarCampaign[],
	) => void;
}

function CompletedCampaignsHeader({
	count,
	collapsed,
	onToggle,
}: {
	count: number;
	collapsed: boolean;
	onToggle: () => void;
}) {
	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!isSidebarToggleKey(event.key)) return;
		event.preventDefault();
		onToggle();
	};

	return (
		<div
			role="button"
			tabIndex={0}
			className="Sidebar__completedHeader"
			onClick={onToggle}
			onKeyDown={handleKeyDown}
		>
			<CollapseToggleButton
				size={Button.SIZES.SMALL}
				collapsed={collapsed}
				onClick={onToggle}
			/>
			<span className="Sidebar__completedLabel">
				{lang.t("Completed campaigns")}
			</span>
			<span className="Sidebar__completedCount">{count}</span>
		</div>
	);
}

export default function SidebarCampaignSection({
	groups,
	activeCampaignId,
	isCompletedCollapsed,
	onToggleCompleted,
	onCreateCampaign,
	onSelectCampaign,
	onToggleCampaignStatus,
	onReorder,
	onDrop,
}: SidebarCampaignSectionProps) {
	const renderCampaignCard = (campaign: SidebarCampaign) => (
		<ListCard
			id={makeDomId("sidebar", "campaign", campaign.slug)}
			data-history-focus-id={makeHistoryTargetId(
				"sidebar",
				"campaign",
				campaign.slug,
			)}
			className={campaign.completed ? "Sidebar__campaignCompleted" : ""}
			active={activeCampaignId === campaign.slug}
			href={`/campaign/${encodeURIComponent(campaign.slug)}`}
			onClick={() => onSelectCampaign(campaign.slug)}

		>
			<div className="ListCard__sidebar_content">
				<div className="Sidebar__campaignCompact" aria-hidden="true">
					<span className="Sidebar__campaignMonogram">
						{getSidebarCampaignMonogram(campaign.name)}
					</span>
					<span className="Sidebar__campaignCompactMeta">
						<span
							className={`Sidebar__campaignStatusDot${campaign.completed ? " Sidebar__campaignStatusDot__done" : ""}`}
						/>
						<span className="Sidebar__campaignCompactCount">
							{campaign.sessionCount || 0}
						</span>
					</span>
				</div>
				<div className="ListCard__sidebar_info">
					<div
						className="ListCard__title Sidebar__campaignTitle"
						title={campaign.name}
					>
						{campaign.name}
					</div>
					<div className="ListCard__meta">
						<span className="Sidebar__campaignSessions">
							{(campaign.sessionCount || 0) === 1
								? lang.t("1 session")
								: lang.t("{count} sessions", {
										count: campaign.sessionCount || 0,
									})}
						</span>
						<StatusBadge
							completed={Boolean(campaign.completed)}
							onClick={(event: MouseEvent<HTMLSpanElement>) => {
								event.stopPropagation();
								onToggleCampaignStatus(campaign);
							}}
						/>
					</div>
				</div>
			</div>
		</ListCard>
	);

	return (
		<div
			id={makeDomId("sidebar", "campaigns")}
			className="Sidebar__section Sidebar__section__campaigns"
			data-history-focus-id={makeHistoryTargetId("sidebar", "campaigns")}
		>
			<div className="Sidebar__headerSection">
				<h2 className="Sidebar__sectionTitle">
					<span>{lang.t("Campaigns")}</span>
				</h2>
			</div>
			<Tooltip delay={1200} content={SIDEBAR_SHORTCUT_LABELS.newCampaign}>
				<Button variant="create" onClick={onCreateCampaign} icon="plus">
					<span className="Sidebar__buttonLabel">
						{lang.t("New campaign")}
					</span>
				</Button>
			</Tooltip>

			<DraggableList
				items={groups.active}
				className="Sidebar__list"
				onReorder={(items) => onReorder("active", items)}
				onDrop={(items) => onDrop("active", items)}
				keyExtractor={(campaign) => campaign.slug}
				renderItem={renderCampaignCard}
			/>
			{groups.completed.length > 0 && (
				<div className="Sidebar__completedCampaigns">
					<CompletedCampaignsHeader
						count={groups.completed.length}
						collapsed={isCompletedCollapsed}
						onToggle={onToggleCompleted}
					/>
					{!isCompletedCollapsed && (
						<DraggableList
							items={groups.completed}
							className="Sidebar__list Sidebar__completedList"
							onReorder={(items) => onReorder("completed", items)}
							onDrop={(items) => onDrop("completed", items)}
							keyExtractor={(campaign) => campaign.slug}
							renderItem={renderCampaignCard}
						/>
					)}
				</div>
			)}
		</div>
	);
}
