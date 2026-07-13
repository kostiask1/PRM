import {
	getMonsterBaseHp,
	isEncounterCharacterParticipant,
} from "../../../entities/encounter/index.js";

export const normalizeParticipantName = (value) =>
	String(value || "")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ");

export const normalizeMonsterSource = (source) =>
	String(source || "")
		.trim()
		.toUpperCase();

export function getEntityIdentityNames(entity = {}) {
	const fullName = `${entity.firstName || ""} ${entity.lastName || ""}`.trim();
	return Array.from(
		new Set(
			[fullName, entity.name]
				.map(normalizeParticipantName)
				.filter(Boolean),
		),
	);
}

export function buildEntityImageMap(entities = []) {
	const images = new Map();
	for (const entity of entities) {
		if (!entity?.imageUrl) continue;
		for (const name of getEntityIdentityNames(entity)) {
			if (!images.has(name)) images.set(name, entity.imageUrl);
		}
	}
	return images;
}

export function extractCustomMonsters(payload) {
	if (Array.isArray(payload)) return payload;
	return payload?.monster || payload?.monsters || payload?.results || [];
}

function getMonsterArmorClass(monster = {}) {
	if (Array.isArray(monster.ac) && monster.ac[0]) {
		const entry = monster.ac[0];
		return typeof entry === "object" ? entry.ac : entry;
	}
	return monster.armor_class || 0;
}

export function mergeCustomMonsterParticipant(current, sourceMonster) {
	const nextMaxHp = getMonsterBaseHp(sourceMonster) || current.hit_points || 0;
	const parsedCurrentHp = Number.parseInt(current.currentHp, 10);
	const currentHp = Number.isFinite(parsedCurrentHp)
		? Math.min(parsedCurrentHp, nextMaxHp || parsedCurrentHp)
		: nextMaxHp;
	return {
		...sourceMonster,
		name: current.name || sourceMonster.name,
		instanceId: current.instanceId,
		originalBestiaryName: sourceMonster.name,
		currentHp,
		hit_points: nextMaxHp,
		armor_class: getMonsterArmorClass(sourceMonster),
	};
}

export function synchronizeCustomMonsterParticipants(encounter, customPayload) {
	if (!encounter?.monsters?.length) return { changed: false, encounter };
	const customByName = new Map(
		extractCustomMonsters(customPayload)
			.filter((monster) => monster?.name)
			.map((monster) => [
				normalizeParticipantName(monster.name),
				{
					...monster,
					source: normalizeMonsterSource(monster.source) || "CUSTOM",
				},
			]),
	);
	let changed = false;
	const monsters = encounter.monsters.map((participant) => {
		if (
			isEncounterCharacterParticipant(participant) ||
			normalizeMonsterSource(participant.source) !== "CUSTOM"
		) {
			return participant;
		}
		const identity = normalizeParticipantName(
			participant.originalBestiaryName || participant.name,
		);
		const sourceMonster = customByName.get(identity);
		if (!sourceMonster) return participant;
		const next = mergeCustomMonsterParticipant(participant, sourceMonster);
		if (JSON.stringify(next) !== JSON.stringify(participant)) changed = true;
		return next;
	});
	return {
		changed,
		encounter: changed ? { ...encounter, monsters } : encounter,
	};
}
