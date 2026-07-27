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
