import type { KeyboardEvent, MouseEvent } from "react";

import { lang } from "../../../shared/lib/index.js";
import {
	Button,
	CollapseToggleButton,
	DraggableList,
	Icon,
	ListCard,
} from "../../../shared/ui/index.js";
import { StatusBadge } from "../../../features/status-badge/index.js";
import {
	isSidebarToggleKey,
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
			<span>{lang.t("Completed campaigns")}</span>
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
			className={campaign.completed ? "Sidebar__campaignCompleted" : ""}
			active={activeCampaignId === campaign.slug}
			href={`/campaign/${encodeURIComponent(campaign.slug)}`}
			onClick={() => onSelectCampaign(campaign.slug)}
			actions={
				<StatusBadge
					completed={Boolean(campaign.completed)}
					onClick={(event: MouseEvent<HTMLSpanElement>) => {
						event.stopPropagation();
						onToggleCampaignStatus(campaign);
					}}
				/>
			}
		>
			<div className="ListCard__sidebar_content">
				<Icon name="map" className="ListCard__sidebar_icon" />
				<div className="ListCard__sidebar_info">
					<div
						className="ListCard__title Sidebar__campaignTitle"
						title={campaign.name}
					>
						{campaign.name}
					</div>
					<div className="ListCard__meta">
						{lang.t("{count} sessions", {
							count: campaign.sessionCount || 0,
						})}
					</div>
				</div>
			</div>
		</ListCard>
	);

	return (
		<div className="Sidebar__section Sidebar__section__campaigns">
			<div className="Sidebar__headerSection">
				<h2 className="Sidebar__sectionTitle">
					<span>{lang.t("Campaigns")}</span>
				</h2>
			</div>
			<Button variant="create" onClick={onCreateCampaign} icon="plus">
				<span>{lang.t("New campaign")}</span>
			</Button>

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
