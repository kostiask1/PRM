import type { CardNote } from "./cardNoteModel.ts";

export interface CampaignData extends Record<string, unknown> {
	slug?: string;
	name?: string;
	createdAt?: string;
	description?: string;
	notes?: CardNote[];
	characters?: Record<string, unknown>[];
	npcs?: Record<string, unknown>[];
	locations?: Record<string, unknown>[];
	isDescriptionCollapsed?: boolean;
	isNotesCollapsed?: boolean;
	isCharactersCollapsed?: boolean;
	isNpcsCollapsed?: boolean;
	isLocationsCollapsed?: boolean;
	completed?: boolean;
	completedAt?: string | null;
}

export default class CampaignViewModel {
	campaign: CampaignData;

	constructor(campaign: CampaignData = {}) {
		this.campaign = campaign;
	}

	get name(): string {
		return this.campaign.name || "";
	}

	get createdAtLabel(): string {
		if (!this.campaign.createdAt) return "-";
		return new Date(this.campaign.createdAt).toLocaleDateString();
	}

	buildSessionHref(fileName: string): string {
		return `/campaign/${encodeURIComponent(String(this.campaign.slug))}/session/${encodeURIComponent(fileName)}`;
	}
}
