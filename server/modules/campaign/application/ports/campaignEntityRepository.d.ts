export type CampaignEntityId = string | number;
export type CampaignEntityType = "characters" | "npc" | "locations" | string;

export interface CampaignEntityRecord extends Record<string, unknown> {
	id?: CampaignEntityId;
	slug?: string;
	name?: string;
	firstName?: string;
	lastName?: string;
}

export interface CampaignEntityRepository {
	list(campaignSlug: string, type: CampaignEntityType): Promise<CampaignEntityRecord[]>;
	read(
		campaignSlug: string,
		type: CampaignEntityType,
		entitySlug: string,
	): Promise<CampaignEntityRecord>;
	write(
		campaignSlug: string,
		type: CampaignEntityType,
		entitySlug: string,
		data: CampaignEntityRecord,
	): Promise<CampaignEntityRecord & { slug: string }>;
	delete(campaignSlug: string, type: CampaignEntityType, entitySlug: string): Promise<void>;
	createId(): CampaignEntityId;
	sanitizeName(name: unknown): string;
	toSlug(name: string): string;
	ensureUniqueSlug(
		campaignSlug: string,
		type: CampaignEntityType,
		baseSlug: string,
		currentSlug?: string,
	): Promise<string>;
	updateMentionReferences(
		campaignSlug: string,
		oldName: string,
		newName: string,
	): Promise<unknown>;
	move(
		campaignSlug: string,
		type: CampaignEntityType,
		entitySlug: string,
		targetType: CampaignEntityType,
	): Promise<CampaignEntityRecord>;
}

export function createCampaignEntityRepositoryPort(
	implementation: CampaignEntityRepository,
): Readonly<CampaignEntityRepository>;
