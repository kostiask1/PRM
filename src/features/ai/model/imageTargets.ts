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

export function getImageTargetNotes(entity: ImageTargetEntity | null | undefined): string[] {
	return (entity?.notes || []).map(getNoteText).filter(Boolean).slice(0, 8);
}

export function getSceneImageTargetEncounter(
	scene: SceneRecord | null | undefined,
): EncounterRecord | null | undefined {
	const encounters = Array.isArray(scene?._imagePromptEncounters)
		? scene._imagePromptEncounters
		: [];
	if (scene?.encounterId) {
		return encounters.find(
			(encounter: EncounterRecord) =>
				String(encounter.id) === String(scene.encounterId),
		);
	}
	const encounterIndex = scene?.encounterIndex;
	if (Number.isInteger(encounterIndex)) {
		return encounters[encounterIndex as number];
	}
	return null;
}

export function buildNpcImageTarget(
	npc: ImageTargetEntity | null | undefined,
	{ displayName, scope }: { displayName: string; scope: string },
): ImageTarget {
	return {
		type: "npc",
		id: npc?.id || npc?.slug || "",
		name: displayName,
		race: npc?.race || "",
		class: npc?.class || "",
		level: npc?.level ?? "",
		description: npc?.description || "",
		motivation: npc?.motivation || "",
		trait: npc?.trait || "",
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
		id: location?.id || location?.slug || "",
		name: displayName,
		description: location?.description || "",
		notes: getImageTargetNotes(location),
		scope,
	};
}

export function buildSceneImageTarget(
	scene: SceneRecord | null | undefined,
	{ title }: { title: string },
): ImageTarget {
	const encounter = getSceneImageTargetEncounter(scene);
	return {
		type: "scene",
		id: scene?.id || "",
		name: title,
		sessionName: scene?._imagePromptSessionName || "",
		sessionFileName: scene?._imagePromptSessionFileName || "",
		texts: scene?.texts || {},
		notes: getImageTargetNotes(scene),
		npcs: scene?.npcs || [],
		encounter: encounter
			? {
					name: encounter.name || "",
					monsters: (encounter.monsters || []).map(
						(monster: EntityRecord) => monster.name || monster.monsterName,
					),
				}
			: null,
	};
}

export function buildCustomMonsterImageTarget(
	monster: ImageTargetEntity | null | undefined,
): ImageTarget {
	return {
		type: "custom-monster",
		id: monster?.name || "",
		name: monster?.name || "",
		source: monster?.source || "CUSTOM",
		size: monster?.size || "",
		creatureType: monster?.type || "",
		alignment: monster?.alignment || "",
		description: monster?.description || monster?.desc || "",
		trait: monster?.trait || [],
		actions: monster?.action || [],
		bonusActions: monster?.bonus || [],
		reactions: monster?.reaction || [],
		legendaryActions: monster?.legendary || [],
		cr: monster?.cr || "",
		ac: monster?.ac || "",
		hp: monster?.hp || "",
		speed: monster?.speed || "",
		abilities: {
			str: monster?.str ?? "",
			dex: monster?.dex ?? "",
			con: monster?.con ?? "",
			int: monster?.int ?? "",
			wis: monster?.wis ?? "",
			cha: monster?.cha ?? "",
		},
	};
}
