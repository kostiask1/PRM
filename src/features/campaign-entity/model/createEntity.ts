import { campaignApi } from "../../../entities/campaign/index.js";
import type {
	CampaignEntityRecord,
	CampaignEntityType,
} from "../../../entities/campaign/index.js";
import { refreshEntitiesAction } from "../../../shared/model/index.js";

export type EntityDraft = Record<string, unknown>;

export interface CampaignEntityApiPort {
	createEntity: (
		campaignSlug: string,
		entityType: CampaignEntityType,
		payload: CampaignEntityRecord,
	) => Promise<CampaignEntityRecord | null>;
	updateEntity: (
		campaignSlug: string,
		entityType: CampaignEntityType,
		entitySlug: string,
		payload: Partial<CampaignEntityRecord>,
	) => Promise<CampaignEntityRecord | null>;
	deleteEntity: (
		campaignSlug: string,
		entityType: CampaignEntityType,
		entitySlug: string,
	) => Promise<unknown>;
}

export interface CampaignEntityClient {
	create: CampaignEntityApiPort["createEntity"];
	update: CampaignEntityApiPort["updateEntity"];
	delete: CampaignEntityApiPort["deleteEntity"];
}

export function buildCreateEntityPayload(
	defaults: EntityDraft,
	draft: EntityDraft | null | undefined,
): EntityDraft {
	return {
		...defaults,
		...Object.fromEntries(
			Object.entries(draft || {}).filter(([key]) => !key.startsWith("_")),
		),
	};
}

export function createCampaignEntityClient(
	api: CampaignEntityApiPort,
): CampaignEntityClient {
	return {
		create: (campaignSlug, entityType, payload) => {
			const sanitizedPayload = { ...(payload || {}) };
			delete sanitizedPayload.id;
			delete sanitizedPayload.slug;
			delete sanitizedPayload.createdAt;
			return api.createEntity(campaignSlug, entityType, sanitizedPayload);
		},
		update: (campaignSlug, entityType, entitySlug, payload) =>
			api.updateEntity(campaignSlug, entityType, entitySlug, payload),
		delete: (campaignSlug, entityType, entitySlug) =>
			api.deleteEntity(campaignSlug, entityType, entitySlug),
	};
}

const campaignEntityClient = createCampaignEntityClient(campaignApi);

interface SubmitCreateEntityOptions {
	campaignSlug: string;
	entityType: CampaignEntityType;
	payload: CampaignEntityRecord;
	onCreate?: (payload: CampaignEntityRecord) => void | Promise<void>;
	dispatch: (action: ReturnType<typeof refreshEntitiesAction>) => unknown;
}

export async function submitCreateEntity({
	campaignSlug,
	entityType,
	payload,
	onCreate,
	dispatch,
}: SubmitCreateEntityOptions): Promise<void> {
	if (typeof onCreate === "function") {
		await onCreate(payload);
		return;
	}
	await createCampaignEntity(campaignSlug, entityType, payload);
	dispatch(refreshEntitiesAction());
}

export async function createCampaignEntity(
	campaignSlug: string,
	entityType: CampaignEntityType,
	payload: CampaignEntityRecord,
): Promise<CampaignEntityRecord | null> {
	return campaignEntityClient.create(campaignSlug, entityType, payload);
}

export const updateCampaignEntity = (
	campaignSlug: string,
	entityType: CampaignEntityType,
	entitySlug: string,
	payload: Partial<CampaignEntityRecord>,
): Promise<CampaignEntityRecord | null> =>
	campaignEntityClient.update(campaignSlug, entityType, entitySlug, payload);

export const deleteCampaignEntity = (
	campaignSlug: string,
	entityType: CampaignEntityType,
	entitySlug: string,
): Promise<unknown> =>
	campaignEntityClient.delete(campaignSlug, entityType, entitySlug);
