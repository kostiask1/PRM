import type { ChangeEvent } from "react";
import type { CampaignRecord } from "../../../entities/campaign/index.js";
import type { SessionRecord } from "../../../entities/session/index.js";
import type { SharedNote } from "../../../shared/lib/index.js";
import type { CampaignFeatureEntity } from "../../../features/campaign-entity/index.js";

export interface CampaignPageEntity extends CampaignFeatureEntity {
	name?: string;
	title?: string;
	firstName?: string;
	lastName?: string;
	notes?: SharedNote[];
}

export interface CampaignPageCampaign extends CampaignRecord {
	slug: string;
	name: string;
	description?: string;
	notes?: SharedNote[];
	characters?: CampaignPageEntity[];
	isDescriptionCollapsed?: boolean;
	isNotesCollapsed?: boolean;
	isCharactersCollapsed?: boolean;
	isNpcsCollapsed?: boolean;
	isLocationsCollapsed?: boolean;
}

export interface CampaignGraphScene extends Record<string, unknown> {
	id?: string | number;
	notes?: SharedNote[];
}

export interface CampaignSessionData extends Record<string, unknown> {
	notes?: SharedNote[];
	scenes?: CampaignGraphScene[];
}

export interface CampaignSessionDetail extends SessionRecord {
	data?: CampaignSessionData;
}

export type CampaignSessionDetails = Record<string, CampaignSessionDetail>;

export interface CampaignSyncEvent extends Record<string, unknown> {
	version?: string | number | null;
	campaignSlug?: string;
	resource?: string;
}

export interface CampaignHistoryState {
	[key: string]: unknown;
	description: string;
	notes: SharedNote[];
	characters: CampaignPageEntity[];
	npcs: CampaignPageEntity[];
	locations: CampaignPageEntity[];
	completed?: unknown;
	completedAt?: unknown;
}

export interface CampaignGraphNoteSave {
	nodeType: "campaign-note" | "session-note" | "scene-note";
	fileName?: string;
	sceneId?: string | number;
	noteId: string | number;
	updates: Partial<SharedNote>;
}

export interface CampaignAiUpdateOptions {
	entityTypes?: string[];
}

export interface UseCampaignViewProps {
	campaign: CampaignPageCampaign;
}

export type DescriptionChangeEvent = ChangeEvent<HTMLTextAreaElement>;
