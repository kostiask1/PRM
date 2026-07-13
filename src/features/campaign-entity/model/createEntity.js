import { refreshEntitiesAction } from "../../../shared/model/index.js";
import { campaignApi } from "../../../entities/campaign/index.js";

export function buildCreateEntityPayload(defaults, draft) {
	return {
		...defaults,
		...Object.fromEntries(
			Object.entries(draft || {}).filter(([key]) => !key.startsWith("_")),
		),
	};
}

export function createCampaignEntityClient(api) {
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

export async function submitCreateEntity({
	campaignSlug,
	entityType,
	payload,
	onCreate,
	dispatch,
}) {
	if (typeof onCreate === "function") {
		await onCreate(payload);
		return;
	}

	await createCampaignEntity(campaignSlug, entityType, payload);
	dispatch(refreshEntitiesAction());
}

export async function createCampaignEntity(campaignSlug, entityType, payload) {
	return campaignEntityClient.create(campaignSlug, entityType, payload);
}

export const updateCampaignEntity = (
	campaignSlug,
	entityType,
	entitySlug,
	payload,
) => campaignEntityClient.update(campaignSlug, entityType, entitySlug, payload);

export const deleteCampaignEntity = (
	campaignSlug,
	entityType,
	entitySlug,
) => campaignEntityClient.delete(campaignSlug, entityType, entitySlug);
