export function getMonsterHpFormula(monster = {}) {
	const formula =
		(typeof monster.hp === "object" && monster.hp?.formula) ||
		monster.hit_dice ||
		"";
	const normalized = String(formula || "").trim();
	return /d/i.test(normalized) ? normalized : "";
}

export function hasMonsterHpFormula(monster = {}) {
	return Boolean(getMonsterHpFormula(monster));
}

function parseHpValue(value) {
	if (value === null || value === undefined) return null;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : null;
}

export function getMonsterBaseHp(monster = {}) {
	const hpAverage =
		typeof monster.hp === "object" ? parseHpValue(monster.hp?.average) : null;
	const hpSpecial =
		typeof monster.hp === "object" ? parseHpValue(monster.hp?.special) : null;
	const hitPoints = parseHpValue(monster.hit_points);

	return hpAverage ?? hpSpecial ?? hitPoints ?? 0;
}

function createEncounterMonsterId() {
	if (typeof globalThis.crypto?.randomUUID === "function") {
		return globalThis.crypto.randomUUID();
	}
	return `monster-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function ensureEncounterMonsterId(monster = {}) {
	if (monster.id !== null && monster.id !== undefined && String(monster.id)) {
		return monster;
	}
	return {
		...monster,
		id: createEncounterMonsterId(),
	};
}

export function createEncounterMonsterInstance(monster) {
	const hpVal = getMonsterBaseHp(monster);

	let acVal = monster.armor_class || 0;
	if (Array.isArray(monster.ac) && monster.ac[0]) {
		const entry = monster.ac[0];
		acVal = typeof entry === "object" ? entry.ac : entry;
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

export function isEncounterCharacterParticipant(entry = {}) {
	return entry.participantType === "character";
}

export function getEncounterCharacterDisplayName(character = {}) {
	return (
		`${character.firstName || ""} ${character.lastName || ""}`.trim() ||
		String(character.name || character.title || "").trim() ||
		"Character"
	);
}

export function createEncounterCharacterParticipant(character) {
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

export function getEncounterGridMonsterKey(monster) {
	if (monster?._localOverride) {
		return `local:${monster.instanceId || monster.id || monster.name || ""}`;
	}
	const baseName = String(
		monster?.originalBestiaryName || monster?.name || "",
	)
		.trim()
		.toLowerCase();
	const source = String(monster?.source || "")
		.trim()
		.toLowerCase();
	if (!baseName) return String(monster?.instanceId || "");
	return `${baseName}|${source}`;
}

export function buildEncounterGridModel(monsters = []) {
	const gridMonsters = [];
	const representativeByKey = new Map();
	const gridRepresentativeByInstanceId = new Map();

	for (const monster of monsters) {
		if (isEncounterCharacterParticipant(monster)) continue;
		const key = getEncounterGridMonsterKey(monster);
		let representativeId = representativeByKey.get(key);
		if (!representativeId) {
			representativeId = monster.instanceId;
			representativeByKey.set(key, representativeId);
			gridMonsters.push(monster);
		}
		gridRepresentativeByInstanceId.set(
			monster.instanceId,
			representativeId,
		);
	}
	return { gridMonsters, gridRepresentativeByInstanceId };
}
