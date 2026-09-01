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

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object";
}

function getMonsterTypeChoiceString(value: unknown): string {
	if (!isObject(value)) return "";
	const choices = value.choose;
	return Array.isArray(choices) ? choices.join("/") : "";
}

export function getMonsterTypeString(monsterType: unknown): string {
	if (!monsterType) return "";
	if (typeof monsterType === "string") return monsterType;
	if (!isObject(monsterType)) return "";
	const type = monsterType.type;
	return typeof type === "string" ? type : getMonsterTypeChoiceString(type);
}

function normalizeMonsterSearchQuery(searchQuery: unknown): string {
	return String(searchQuery || "")
		.trim()
		.toLowerCase();
}

function getMonsterTypeDescriptor(
	monsterType: SearchableMonster["type"],
): MonsterTypeDescriptor | null {
	return isObject(monsterType)
		? (monsterType as MonsterTypeDescriptor)
		: null;
}

function getMonsterTagText(descriptor: MonsterTypeDescriptor | null): string {
	return Array.isArray(descriptor?.tags) ? descriptor.tags.join(" ") : "";
}

function appendSearchPart(parts: unknown[], value: unknown): void {
	if (value) parts.push(value);
}

function getMonsterSearchText(
	monster: SearchableMonster | null | undefined,
): string {
	const parts: unknown[] = [];
	appendSearchPart(parts, monster?.name);
	appendSearchPart(parts, getMonsterTypeString(monster?.type));
	appendSearchPart(parts, getMonsterTagText(getMonsterTypeDescriptor(monster?.type)));
	return parts.join(" ").toLowerCase();
}

export function matchesMonsterSearch(
	monster: SearchableMonster | null | undefined,
	searchQuery: unknown = "",
): boolean {
	const normalizedSearch = normalizeMonsterSearchQuery(searchQuery);
	if (!normalizedSearch) return true;
	return getMonsterSearchText(monster).includes(normalizedSearch);
}
