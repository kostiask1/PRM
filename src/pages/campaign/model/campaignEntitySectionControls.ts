import type {
	CampaignPageCampaign,
	CampaignPageEntity,
} from "./contracts.ts";

export type CampaignEntitySectionType = "characters" | "npc" | "locations";

interface CampaignEntitySectionControlsOptions {
	type: CampaignEntitySectionType;
	hasData: boolean;
	isCollapsed: boolean;
	onSetCollapsed: (collapsed: boolean) => void;
	onTriggerSave: (updates: Partial<CampaignPageCampaign>) => void;
	onReorder: (items: CampaignPageEntity[]) => void;
	onPersistReorder: (
		type: CampaignEntitySectionType,
		items: CampaignPageEntity[],
	) => void;
}

export interface CampaignEntitySectionControls {
	onToggle: () => void;
	onBulkCollapse: (items: CampaignPageEntity[], collapsed: boolean) => void;
	onReorderDrop: (items: CampaignPageEntity[]) => void;
}

const COLLAPSE_STATE_KEYS = {
	characters: "isCharactersCollapsed",
	npc: "isNpcsCollapsed",
	locations: "isLocationsCollapsed",
} as const;

export function getCampaignEntitySectionControls({
	type,
	hasData,
	isCollapsed,
	onSetCollapsed,
	onTriggerSave,
	onReorder,
	onPersistReorder,
}: CampaignEntitySectionControlsOptions): CampaignEntitySectionControls {
	return {
		onToggle() {
			if (!hasData) return;
			const next = !isCollapsed;
			onSetCollapsed(next);
			onTriggerSave({ [COLLAPSE_STATE_KEYS[type]]: next });
		},
		onBulkCollapse(items, collapsed) {
			const nextItems = items.map((item) => ({ ...item, collapsed }));
			onReorder(nextItems);
			onPersistReorder(type, nextItems);
		},
		onReorderDrop(items) {
			onPersistReorder(type, items);
		},
	};
}
