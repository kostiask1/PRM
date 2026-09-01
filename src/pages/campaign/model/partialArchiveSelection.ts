import {
	CAMPAIGN_PARTIAL_ARCHIVE_SECTIONS,
	type CampaignPartialArchiveSection,
} from "../../../entities/campaign/index.js";

export function createDefaultPartialArchiveSelection(): Set<CampaignPartialArchiveSection> {
	return new Set(CAMPAIGN_PARTIAL_ARCHIVE_SECTIONS);
}

export function togglePartialArchiveSection(
	current: ReadonlySet<CampaignPartialArchiveSection>,
	section: CampaignPartialArchiveSection,
): Set<CampaignPartialArchiveSection> {
	const next = new Set(current);
	if (next.has(section)) next.delete(section);
	else next.add(section);
	return next;
}

export function getOrderedPartialArchiveSections(
	selected: ReadonlySet<CampaignPartialArchiveSection>,
): CampaignPartialArchiveSection[] {
	return CAMPAIGN_PARTIAL_ARCHIVE_SECTIONS.filter((section) =>
		selected.has(section),
	);
}
