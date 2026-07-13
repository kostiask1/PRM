export type CampaignId = string | number;

export interface CampaignRecord extends Record<string, unknown> {
	id?: CampaignId;
	slug?: string;
	name: string;
	order?: number;
	ignoreSourcesList?: string[];
}

export interface CampaignRepository {
	metaExists(slug: string): Promise<boolean>;
	dataExists(slug: string): Promise<boolean>;
	list(): Promise<CampaignRecord[]>;
	read(slug: string): Promise<CampaignRecord>;
	write(slug: string, campaign: CampaignRecord): Promise<CampaignRecord>;
	initialize(slug: string): Promise<unknown>;
	rename(oldSlug: string, newSlug: string): Promise<unknown>;
	remove(slug: string, options?: { moveImagesToGeneral?: boolean }): Promise<unknown>;
	hasImages(slug: string): Promise<boolean>;
	exportBundle(slug: string): Promise<Record<string, unknown>>;
	sanitizeName(name: unknown): string;
	toSlug(name: string): string;
	ensureUniqueSlug(baseSlug: string, currentSlug?: string): Promise<string>;
	createId(): CampaignId;
	replaceImageSlugReferences(
		campaign: CampaignRecord,
		oldSlug: string,
		newSlug: string,
	): CampaignRecord;
	normalizeSourceList(sources: unknown): string[];
}

export function createCampaignRepositoryPort(
	implementation: CampaignRepository,
): Readonly<CampaignRepository>;
