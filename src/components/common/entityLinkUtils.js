import { api } from "../../api";

export function findEntityByName(entities, name) {
	const searchName = String(name || "")
		.trim()
		.toLowerCase();
	if (!searchName) return null;

	return entities.find(({ entity }) => {
		const first = String(entity.firstName || "")
			.trim()
			.toLowerCase();
		const last = String(entity.lastName || "")
			.trim()
			.toLowerCase();
		const full = `${first} ${last}`.trim();
		const fallback = String(entity.name || entity.title || "")
			.trim()
			.toLowerCase();
		return (
			first === searchName ||
			last === searchName ||
			full === searchName ||
			fallback === searchName
		);
	});
}

export function getEntityDisplayName(entity, type) {
	if (type === "locations") {
		return String(entity.name || entity.title || "").trim();
	}
	return (
		`${entity.firstName || ""} ${entity.lastName || ""}`.trim() ||
		String(entity.name || entity.title || "").trim()
	);
}

export async function resolveEntityByName(campaignSlug, name) {
	if (!campaignSlug || !name) return null;

	const [characters, npcs, locations] = await Promise.all([
		api.getEntities(campaignSlug, "characters"),
		api.getEntities(campaignSlug, "npc").catch(() => []),
		api.getEntities(campaignSlug, "locations").catch(() => []),
	]);

	const allEntities = [
		...characters.map((entity) => ({ entity, type: "characters" })),
		...npcs.map((entity) => ({ entity, type: "npc" })),
		...locations.map((entity) => ({ entity, type: "locations" })),
	];

	return findEntityByName(allEntities, name) || null;
}
