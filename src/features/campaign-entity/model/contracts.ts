import type { Dispatch, SetStateAction } from "react";
import type {
	CampaignEntityRecord,
	CampaignEntityType,
	DomainId,
} from "../../../entities/campaign/index.js";

export interface CampaignFeatureEntity extends CampaignEntityRecord {
	id?: DomainId;
	slug?: string;
	createdAt?: string;
	collapsed?: boolean;
	_isPending?: boolean;
	order?: number;
}

export type CampaignFeatureEntityType = CampaignEntityType;
export type CampaignFeatureEntityId = DomainId;
export type CampaignEntitySetter<T extends CampaignFeatureEntity> = Dispatch<
	SetStateAction<T[]>
>;

export type CampaignEntitySanitizer<
	T extends CampaignFeatureEntity = CampaignFeatureEntity,
> = (entity: T) => CampaignFeatureEntity;

export type CampaignEntityNormalizer<
	T extends CampaignFeatureEntity = CampaignFeatureEntity,
> = (entity: CampaignEntityRecord | null) => T;

export type CampaignEntityErrorHandler = (
	message: string,
	error: unknown,
) => void;
