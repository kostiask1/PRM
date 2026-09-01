type DomainId = string | number;
type EntityRecord = Record<string, unknown>;

interface ImageTargetNote extends EntityRecord {
	_aiIgnored?: boolean;
	title?: string;
	text?: string;
}

interface EncounterRecord extends EntityRecord {
	id?: DomainId;
	name?: string;
	monsters?: EntityRecord[];
}

interface ImageTargetEntity extends EntityRecord {
	id?: DomainId;
	slug?: string;
	name?: string;
	notes?: Array<string | ImageTargetNote>;
}

interface SceneRecord extends ImageTargetEntity {
	encounterId?: DomainId;
	encounterIndex?: number;
	_imagePromptEncounters?: EncounterRecord[];
	_imagePromptSessionName?: string;
	_imagePromptSessionFileName?: string;
	texts?: EntityRecord;
	npcs?: EntityRecord[];
}

type NullableEntityRecord = EntityRecord | null | undefined;

export interface ImageTarget extends EntityRecord {
	type: "npc" | "location" | "scene" | "custom-monster";
	id: DomainId;
	name: string;
}

function getNoteText(note: string | ImageTargetNote | null | undefined): string {
	if (!note) return "";
	if (typeof note === "string") return note;
	if (typeof note !== "object" || note._aiIgnored) return "";
	return [note.title, note.text].filter(Boolean).join("\n").trim();
}

function getTruthyField(
	entity: NullableEntityRecord,
	field: string,
	fallback: unknown = "",
): unknown {
	return entity?.[field] || fallback;
}

function getNullishField(
	entity: NullableEntityRecord,
	field: string,
	fallback: unknown = "",
): unknown {
	return entity?.[field] ?? fallback;
}

function getEntityId(entity: ImageTargetEntity | null | undefined): DomainId {
	return entity?.id || entity?.slug || "";
}

function getSceneId(scene: SceneRecord | null | undefined): DomainId {
	return scene?.id || "";
}

function getEntityName(entity: ImageTargetEntity | null | undefined): string {
	return entity?.name || "";
}

function isEntityRecord(value: unknown): value is EntityRecord {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getRecordArray<TRecord extends EntityRecord = EntityRecord>(
	entity: NullableEntityRecord,
	field: string,
): TRecord[] {
	const value = entity?.[field];
	return Array.isArray(value)
		? (value.filter(isEntityRecord) as TRecord[])
		: [];
}

export function getImageTargetNotes(entity: ImageTargetEntity | null | undefined): string[] {
	return (entity?.notes || []).map(getNoteText).filter(Boolean).slice(0, 8);
}

export function getSceneImageTargetEncounter(
	scene: SceneRecord | null | undefined,
): EncounterRecord | null | undefined {
	const encounters = getRecordArray<EncounterRecord>(
		scene,
		"_imagePromptEncounters",
	);
	if (scene?.encounterId) {
		const encounterId = String(scene.encounterId);
		return encounters.find((encounter) => String(encounter.id) === encounterId);
	}
	const encounterIndex = scene?.encounterIndex;
	return Number.isInteger(encounterIndex)
		? encounters[encounterIndex as number]
		: null;
}

function buildEncounterImageSummary(
	encounter: EncounterRecord | null | undefined,
): EntityRecord | null {
	if (!encounter) return null;
	return {
		name: encounter.name || "",
		monsters: getRecordArray(encounter, "monsters").map(
			(monster) => monster.name || monster.monsterName,
		),
	};
}

function buildMonsterAbilities(monster: NullableEntityRecord): EntityRecord {
	return {
		str: getNullishField(monster, "str"),
		dex: getNullishField(monster, "dex"),
		con: getNullishField(monster, "con"),
		int: getNullishField(monster, "int"),
		wis: getNullishField(monster, "wis"),
		cha: getNullishField(monster, "cha"),
	};
}

export function buildNpcImageTarget(
	npc: ImageTargetEntity | null | undefined,
	{ displayName, scope }: { displayName: string; scope: string },
): ImageTarget {
	return {
		type: "npc",
		id: getEntityId(npc),
		name: displayName,
		race: getTruthyField(npc, "race"),
		class: getTruthyField(npc, "class"),
		level: getNullishField(npc, "level"),
		description: getTruthyField(npc, "description"),
		motivation: getTruthyField(npc, "motivation"),
		trait: getTruthyField(npc, "trait"),
		notes: getImageTargetNotes(npc),
		scope,
	};
}

export function buildLocationImageTarget(
	location: ImageTargetEntity | null | undefined,
	{ displayName, scope }: { displayName: string; scope: string },
): ImageTarget {
	return {
		type: "location",
		id: getEntityId(location),
		name: displayName,
		description: getTruthyField(location, "description"),
		notes: getImageTargetNotes(location),
		scope,
	};
}

export function buildSceneImageTarget(
	scene: SceneRecord | null | undefined,
	{ title }: { title: string },
): ImageTarget {
	return {
		type: "scene",
		id: getSceneId(scene),
		name: title,
		sessionName: getTruthyField(scene, "_imagePromptSessionName"),
		sessionFileName: getTruthyField(scene, "_imagePromptSessionFileName"),
		texts: getTruthyField(scene, "texts", {}),
		notes: getImageTargetNotes(scene),
		npcs: getRecordArray(scene, "npcs"),
		encounter: buildEncounterImageSummary(getSceneImageTargetEncounter(scene)),
	};
}

export function buildCustomMonsterImageTarget(
	monster: ImageTargetEntity | null | undefined,
): ImageTarget {
	const name = getEntityName(monster);
	return {
		type: "custom-monster",
		id: name,
		name,
		source: getTruthyField(monster, "source", "CUSTOM"),
		size: getTruthyField(monster, "size"),
		creatureType: getTruthyField(monster, "type"),
		alignment: getTruthyField(monster, "alignment"),
		description:
			getTruthyField(monster, "description") || getTruthyField(monster, "desc"),
		trait: getTruthyField(monster, "trait", []),
		actions: getTruthyField(monster, "action", []),
		bonusActions: getTruthyField(monster, "bonus", []),
		reactions: getTruthyField(monster, "reaction", []),
		legendaryActions: getTruthyField(monster, "legendary", []),
		cr: getTruthyField(monster, "cr"),
		ac: getTruthyField(monster, "ac"),
		hp: getTruthyField(monster, "hp"),
		speed: getTruthyField(monster, "speed"),
		abilities: buildMonsterAbilities(monster),
	};
}
