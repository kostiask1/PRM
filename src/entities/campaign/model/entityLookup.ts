export interface CampaignEntity extends Record<string, unknown> {
	id?: string | number | null;
	slug?: string | null;
	_scope?: string | null;
	scope?: string | null;
	firstName?: string | null;
	lastName?: string | null;
	name?: string | null;
	title?: string | null;
}

export interface CampaignEntityResolution {
	entity: CampaignEntity;
	type: string;
	scope?: string;
}

export function findEntityByName(
	entities: CampaignEntityResolution[],
	name: string,
): CampaignEntityResolution | null | undefined {
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

export function getEntityDisplayName(
	entity: CampaignEntity,
	type: string,
): string {
	if (type === "locations") {
		return String(entity.name || entity.title || "").trim();
	}
	return (
		`${entity.firstName || ""} ${entity.lastName || ""}`.trim() ||
		String(entity.name || entity.title || "").trim()
	);
}
