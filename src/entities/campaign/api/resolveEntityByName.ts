import { campaignApi } from "./campaignApi.ts";
import {
	findEntityByName,
	type CampaignEntityResolution,
} from "../model/entityLookup.ts";

export async function resolveEntityByName(
	campaignSlug: string,
	name: string,
): Promise<CampaignEntityResolution | null> {
	if (!campaignSlug || !name) return null;

	const [characters, npcs, locations] = await Promise.all([
		campaignApi.getEntities(campaignSlug, "characters"),
		campaignApi.getEntities(campaignSlug, "npc").catch(() => []),
		campaignApi.getEntities(campaignSlug, "locations").catch(() => []),
	]);

	const allEntities: CampaignEntityResolution[] = [
		...(characters || []).map((entity) => ({ entity, type: "characters" })),
		...(npcs || []).map((entity) => ({ entity, type: "npc" })),
		...(locations || []).map((entity) => ({ entity, type: "locations" })),
	];

	return findEntityByName(allEntities, name) || null;
}
