export interface MonsterTypeChoice {
	choose?: string[];
}

export interface MonsterTypeDescriptor {
	type?: string | MonsterTypeChoice;
	tags?: unknown[];
}

export interface SearchableMonster {
	name?: string;
	type?: string | MonsterTypeDescriptor;
}

export function getMonsterTypeString(monsterType: unknown): string {
	if (!monsterType) return "";
	if (typeof monsterType === "string") return monsterType;
	if (typeof monsterType === "object") {
		const type = (monsterType as MonsterTypeDescriptor).type;
		if (typeof type === "string") return type;
		if (typeof type === "object" && Array.isArray(type.choose)) {
			return type.choose.join("/");
		}
	}
	return "";
}

export function matchesMonsterSearch(
	monster: SearchableMonster | null | undefined,
	searchQuery = "",
): boolean {
	const normalizedSearch = String(searchQuery || "")
		.trim()
		.toLowerCase();
	if (!normalizedSearch) return true;

	const typeBase = getMonsterTypeString(monster?.type);
	const descriptor =
		monster?.type && typeof monster.type === "object" ? monster.type : null;
	const tags = Array.isArray(descriptor?.tags)
		? descriptor.tags.join(" ")
		: "";
	const searchableText = [monster?.name, typeBase, tags]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();

	return searchableText.includes(normalizedSearch);
}
