import {
	getMonsterBaseHp,
	isEncounterCharacterParticipant,
	type EncounterMonster,
} from "../../../entities/encounter/index.js";

export interface EncounterImageEntity extends Record<string, unknown> {
	firstName?: string | null;
	lastName?: string | null;
	name?: string | null;
	imageUrl?: string | null;
}

export interface EncounterParticipant extends EncounterMonster {
	participantType?: string;
	source?: string | null;
	currentHp?: unknown;
	originalBestiaryName?: string | null;
}

export interface CustomMonster extends EncounterMonster {
	source?: string | null;
	name?: string;
}

export interface CustomMonsterPayload extends Record<string, unknown> {
	monster?: CustomMonster[];
	monsters?: CustomMonster[];
	results?: CustomMonster[];
}

export interface SynchronizableEncounter extends Record<string, unknown> {
	monsters?: EncounterParticipant[];
}

export interface ParticipantSynchronizationResult {
	changed: boolean;
	encounter: SynchronizableEncounter | null | undefined;
}

export const normalizeParticipantName = (value: unknown): string =>
	String(value || "")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ");

const normalizeMonsterSource = (source: unknown): string =>
	String(source || "")
		.trim()
		.toUpperCase();

function getEntityIdentityNames(entity: EncounterImageEntity = {}): string[] {
	const fullName = `${entity.firstName || ""} ${entity.lastName || ""}`.trim();
	return Array.from(
		new Set(
			[fullName, entity.name]
				.map(normalizeParticipantName)
				.filter(Boolean),
		),
	);
}

export function buildEntityImageMap(
	entities: EncounterImageEntity[] = [],
): Map<string, string> {
	const images = new Map<string, string>();
	for (const entity of entities) {
		if (!entity?.imageUrl) continue;
		for (const name of getEntityIdentityNames(entity)) {
			if (!images.has(name)) images.set(name, entity.imageUrl);
		}
	}
	return images;
}

function extractCustomMonsters(
	payload: CustomMonster[] | CustomMonsterPayload | null | undefined,
): CustomMonster[] {
	if (Array.isArray(payload)) return payload;
	return payload?.monster || payload?.monsters || payload?.results || [];
}

function getMonsterArmorClass(monster: CustomMonster = {}): unknown {
	if (Array.isArray(monster.ac) && monster.ac[0]) {
		const entry = monster.ac[0];
		return typeof entry === "object"
			? (entry as { ac?: unknown }).ac
			: entry;
	}
	return monster.armor_class || 0;
}

function mergeCustomMonsterParticipant(
	current: EncounterParticipant,
	sourceMonster: CustomMonster,
): EncounterParticipant {
	const nextMaxHp =
		getMonsterBaseHp(sourceMonster) || current.hit_points || 0;
	const parsedCurrentHp = Number.parseInt(String(current.currentHp), 10);
	const numericMaxHp = Number(nextMaxHp);
	const currentHp = Number.isFinite(parsedCurrentHp)
		? Math.min(parsedCurrentHp, numericMaxHp || parsedCurrentHp)
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

export function synchronizeCustomMonsterParticipants(
	encounter: SynchronizableEncounter | null | undefined,
	customPayload: CustomMonster[] | CustomMonsterPayload | null | undefined,
): ParticipantSynchronizationResult {
	if (!encounter?.monsters?.length) return { changed: false, encounter };
	const customByName = new Map<string, CustomMonster>(
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
