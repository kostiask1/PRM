function getNoteText(note) {
	if (!note) return "";
	if (typeof note === "string") return note;
	if (typeof note !== "object" || note._aiIgnored) return "";
	return [note.title, note.text].filter(Boolean).join("\n").trim();
}

export function getImageTargetNotes(entity) {
	return (entity?.notes || []).map(getNoteText).filter(Boolean).slice(0, 8);
}

export function getSceneImageTargetEncounter(scene) {
	const encounters = Array.isArray(scene?._imagePromptEncounters)
		? scene._imagePromptEncounters
		: [];
	if (scene?.encounterId) {
		return encounters.find(
			(encounter) => String(encounter.id) === String(scene.encounterId),
		);
	}
	if (Number.isInteger(scene?.encounterIndex)) {
		return encounters[scene.encounterIndex];
	}
	return null;
}

export function buildNpcImageTarget(npc, { displayName, scope }) {
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

export function buildLocationImageTarget(location, { displayName, scope }) {
	return {
		type: "location",
		id: location?.id || location?.slug || "",
		name: displayName,
		description: location?.description || "",
		notes: getImageTargetNotes(location),
		scope,
	};
}

export function buildSceneImageTarget(scene, { title }) {
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
						(monster) => monster.name || monster.monsterName,
					),
				}
			: null,
	};
}

export function buildCustomMonsterImageTarget(monster) {
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
