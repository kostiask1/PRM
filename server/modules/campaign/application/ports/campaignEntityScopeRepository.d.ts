import type {
	CampaignEntityRecord,
	CampaignEntityType,
} from "./campaignEntityRepository.js";
import type { SessionRecord } from "../../../session/application/ports/sessionRepository.js";

export interface CampaignEntityScopeRepository {
	readEntity(
		campaignSlug: string,
		type: CampaignEntityType,
		entitySlug: string,
	): Promise<CampaignEntityRecord>;
	writeEntity(
		campaignSlug: string,
		type: CampaignEntityType,
		entitySlug: string,
		entity: CampaignEntityRecord,
	): Promise<CampaignEntityRecord>;
	deleteEntity(campaignSlug: string, type: CampaignEntityType, entitySlug: string): Promise<void>;
	readSession(campaignSlug: string, fileName: string): Promise<SessionRecord>;
	writeSession(
		campaignSlug: string,
		fileName: string,
		session: SessionRecord,
	): Promise<SessionRecord & { fileName: string }>;
	sanitizeName(name: unknown): string;
	toSlug(name: string): string;
	ensureUniqueSlug(
		campaignSlug: string,
		type: CampaignEntityType,
		baseSlug: string,
		currentSlug?: string,
	): Promise<string>;
}

export function createCampaignEntityScopeRepositoryPort(
	implementation: CampaignEntityScopeRepository,
): Readonly<CampaignEntityScopeRepository>;
