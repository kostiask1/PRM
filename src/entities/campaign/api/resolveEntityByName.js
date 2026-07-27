import { findEntityByName } from "../model/entityIdentity.js";
import { campaignApi } from "./campaignApi.js";

export async function resolveEntityByName(campaignSlug, name) {
	if (!campaignSlug || !name) return null;

	const [characters, npcs, locations] = await Promise.all([
		campaignApi.getEntities(campaignSlug, "characters"),
		campaignApi.getEntities(campaignSlug, "npc").catch(() => []),
		campaignApi.getEntities(campaignSlug, "locations").catch(() => []),
	]);

	const allEntities = [
		...characters.map((entity) => ({ entity, type: "characters" })),
		...npcs.map((entity) => ({ entity, type: "npc" })),
		...locations.map((entity) => ({ entity, type: "locations" })),
	];

	return findEntityByName(allEntities, name) || null;
}
