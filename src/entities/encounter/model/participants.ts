export type EncounterParticipantId = string | number;

export interface EncounterMonster extends Record<string, unknown> {
	id?: EncounterParticipantId;
	instanceId?: string;
	name?: string;
	hp?: { formula?: string; average?: unknown; special?: unknown } | unknown;
	hit_dice?: string;
	hit_points?: unknown;
	armor_class?: unknown;
	ac?: Array<{ ac?: unknown } | unknown>;
}

export interface EncounterCharacter extends Record<string, unknown> {
	id?: EncounterParticipantId;
	slug?: string;
	firstName?: string;
	lastName?: string;
	name?: string;
	title?: string;
	participantType?: string;
}

function hpRecord(monster: EncounterMonster) {
	return monster.hp && typeof monster.hp === "object"
		? (monster.hp as { formula?: string; average?: unknown; special?: unknown })
		: null;
}

export function getMonsterHpFormula(monster: EncounterMonster = {}): string {
	const hp = hpRecord(monster);
	const formula =
		hp?.formula ||
		monster.hit_dice ||
		"";
	const normalized = String(formula || "").trim();
	return /d/i.test(normalized) ? normalized : "";
}

export function hasMonsterHpFormula(monster: EncounterMonster = {}): boolean {
	return Boolean(getMonsterHpFormula(monster));
}

function parseHpValue(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	const parsed = Number.parseInt(String(value), 10);
	return Number.isFinite(parsed) ? parsed : null;
}

export function getMonsterBaseHp(monster: EncounterMonster = {}): number {
	const hp = hpRecord(monster);
	const hpAverage = parseHpValue(hp?.average);
	const hpSpecial = parseHpValue(hp?.special);
	const hitPoints = parseHpValue(monster.hit_points);

	return hpAverage ?? hpSpecial ?? hitPoints ?? 0;
}

function createEncounterMonsterId(): string {
	if (typeof globalThis.crypto?.randomUUID === "function") {
		return globalThis.crypto.randomUUID();
	}
	return `monster-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function ensureEncounterMonsterId(monster: EncounterMonster = {}): EncounterMonster {
	if (monster.id !== null && monster.id !== undefined && String(monster.id)) {
		return monster;
	}
	return {
		...monster,
		id: createEncounterMonsterId(),
	};
}

export function createEncounterMonsterInstance(
	monster: EncounterMonster,
): EncounterMonster {
	const hpVal = getMonsterBaseHp(monster);

	let acVal: unknown = monster.armor_class || 0;
	if (Array.isArray(monster.ac) && monster.ac[0]) {
		const entry = monster.ac[0];
		acVal =
			typeof entry === "object"
				? (entry as { ac?: unknown }).ac
				: entry;
	}

	return ensureEncounterMonsterId({
		...monster,
		instanceId: `inst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
		originalBestiaryName: monster.name,
		currentHp: hpVal,
		hit_points: hpVal,
		armor_class: acVal,
	});
}

export function isEncounterCharacterParticipant(
	entry: EncounterCharacter = {},
): boolean {
	return entry.participantType === "character";
}

export function getEncounterCharacterDisplayName(
	character: EncounterCharacter = {},
): string {
	return (
		`${character.firstName || ""} ${character.lastName || ""}`.trim() ||
		String(character.name || character.title || "").trim() ||
		"Character"
	);
}

export function createEncounterCharacterParticipant(
	character: EncounterCharacter,
): EncounterCharacter {
	const characterId =
		character.id || character.slug || getEncounterCharacterDisplayName(character);

	return {
		...character,
		participantType: "character",
		instanceId: `char-${characterId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
		originalCharacterId: character.id || null,
		originalCharacterSlug: character.slug || null,
		name: getEncounterCharacterDisplayName(character),
	};
}
