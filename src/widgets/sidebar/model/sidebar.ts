import type { CampaignRecord } from "../../../entities/campaign/index.js";

export type SidebarCampaignGroup = "active" | "completed";

export interface SidebarCampaign extends CampaignRecord {
	completed?: boolean;
	sessionCount?: number;
}

export interface SidebarCampaignGroups {
	active: SidebarCampaign[];
	completed: SidebarCampaign[];
}

export type CampaignOrderMap = Record<string, number>;

export function groupSidebarCampaigns(
	campaigns: readonly SidebarCampaign[],
): SidebarCampaignGroups {
	const active: SidebarCampaign[] = [];
	const completed: SidebarCampaign[] = [];

	for (const campaign of campaigns) {
		if (campaign.completed) completed.push(campaign);
		else active.push(campaign);
	}

	return { active, completed };
}

export function mergeSidebarCampaignGroup(
	groups: SidebarCampaignGroups,
	group: SidebarCampaignGroup,
	items: readonly SidebarCampaign[],
): SidebarCampaign[] {
	return group === "completed"
		? [...groups.active, ...items]
		: [...items, ...groups.completed];
}

export function buildSidebarCampaignOrder(
	campaigns: readonly SidebarCampaign[],
): CampaignOrderMap {
	return Object.fromEntries(
		campaigns.map((campaign, index) => [campaign.slug, index]),
	);
}

export interface CampaignSelectionContext {
	campaignSlug: string;
	activeCampaignSlug?: string | null;
	activeSessionFileName?: string | null;
	activeEncounterId?: string | number | null;
}

export function getSidebarCampaignSelection({
	campaignSlug,
	activeCampaignSlug,
	activeSessionFileName,
	activeEncounterId,
}: CampaignSelectionContext): string {
	const isCampaignRootActive =
		activeCampaignSlug === campaignSlug &&
		!activeSessionFileName &&
		!activeEncounterId;
	return isCampaignRootActive ? "" : campaignSlug;
}

export function getSidebarClassName(
	isExpanded: boolean,
	isMobileOpen: boolean,
): string {
	return `Sidebar App__sidebar${isExpanded ? " Sidebar__hovered" : ""}${isMobileOpen ? " Sidebar__mobile_open" : ""}`;
}

export function isSidebarToggleKey(key: string): boolean {
	return key === "Enter" || key === " ";
}

export function getSidebarErrorMessage(
	error: unknown,
	fallback: string,
): string {
	return error instanceof Error && error.message ? error.message : fallback;
}
