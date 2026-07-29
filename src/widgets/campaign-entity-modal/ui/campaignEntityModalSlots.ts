import type { ComponentType } from "react";

import type {
	CharacterData,
	LocationData,
} from "../../../entities/campaign/index.js";

export type CampaignEntityModalCardId = string | number | undefined;

export interface CampaignEntityModalCharacterCardSlotProps {
	character: CharacterData;
	onChange: (
		id: CampaignEntityModalCardId,
		character: CharacterData,
		options?: { trackUndo?: boolean },
	) => void;
	onNameBlur?: (
		id: CampaignEntityModalCardId,
		character: CharacterData,
		oldName: string,
		newName: string,
	) => boolean | void | Promise<boolean | void>;
	onDelete?: (id: CampaignEntityModalCardId) => void;
	onToggleCollapse?: ((id: CampaignEntityModalCardId) => void) | null;
	campaignSlug?: string | null;
	type?: string;
	viewMode?: "card" | "modal";
	showDeleteButton?: boolean;
	showHeader?: boolean;
}

export interface CampaignEntityModalLocationCardSlotProps {
	location: LocationData;
	onChange: (
		id: CampaignEntityModalCardId,
		location: LocationData,
		options?: { trackUndo?: boolean },
	) => void;
	onNameBlur?: (
		id: CampaignEntityModalCardId,
		location: LocationData,
		oldName: string,
		newName: string,
	) => boolean | void | Promise<boolean | void>;
	onDelete?: (id: CampaignEntityModalCardId) => void;
	onToggleCollapse?: ((id: CampaignEntityModalCardId) => void) | null;
	campaignSlug?: string | null;
	viewMode?: "card" | "modal";
	showDeleteButton?: boolean;
	showHeader?: boolean;
}

export type CampaignEntityModalCharacterCardComponent =
	ComponentType<CampaignEntityModalCharacterCardSlotProps>;

export type CampaignEntityModalLocationCardComponent =
	ComponentType<CampaignEntityModalLocationCardSlotProps>;
