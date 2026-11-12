import type { CampaignPageEntity } from "./contracts.ts";

export type CampaignEntitySectionType = "characters" | "npc" | "locations";

interface CampaignEntitySectionControlsOptions {
	type: CampaignEntitySectionType;
	onPersistReorder: (
		type: CampaignEntitySectionType,
		items: CampaignPageEntity[],
	) => void;
}

export interface CampaignEntitySectionControls {
	onReorderDrop: (items: CampaignPageEntity[]) => void;
}

export function getCampaignEntitySectionControls({
	type,
	onPersistReorder,
}: CampaignEntitySectionControlsOptions): CampaignEntitySectionControls {
	return {
		onReorderDrop(items) {
			onPersistReorder(type, items);
		},
	};
}
