import { refreshEntitiesAction } from "../shared/model/index.js";
import { campaignApi } from "../entities/campaign/api.js";

export function buildCreateEntityPayload(defaults, draft) {
	return {
		...defaults,
		...Object.fromEntries(
			Object.entries(draft || {}).filter(([key]) => !key.startsWith("_")),
		),
	};
}

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

	delete payload.id;
	delete payload.slug;
	delete payload.createdAt;
	await campaignApi.createEntity(campaignSlug, entityType, payload);
	dispatch(refreshEntitiesAction());
}
