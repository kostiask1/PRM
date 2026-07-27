export function getMonsterTypeString(monsterType) {
	if (!monsterType) return "";
	if (typeof monsterType === "string") return monsterType;
	if (typeof monsterType === "object") {
		const type = monsterType.type;
		if (typeof type === "string") return type;
		if (typeof type === "object" && Array.isArray(type.choose)) {
			return type.choose.join("/");
		}
	}
	return "";
}

export function matchesMonsterSearch(monster, searchQuery = "") {
	const normalizedSearch = String(searchQuery || "")
		.trim()
		.toLowerCase();
	if (!normalizedSearch) return true;

	const typeBase = getMonsterTypeString(monster?.type);
	const tags = Array.isArray(monster?.type?.tags)
		? monster.type.tags.join(" ")
		: "";
	const searchableText = [monster?.name, typeBase, tags]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();

	return searchableText.includes(normalizedSearch);
}
