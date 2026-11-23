import {
	getDemoCampaignContent,
	type DemoCampaignLocation,
	type DemoCampaignNote,
	type DemoCampaignPerson,
} from "./demoCampaignContent.ts";

export interface DemoCampaignBundleOptions {
	language?: string | null;
	createId?: () => string;
	now?: () => Date;
}

export type DemoCampaignBundle = {
	meta: Record<string, unknown> & { id: string; name: string };
	sessions: Array<{ fileName: string; content: Record<string, unknown> }>;
	entities: {
		characters: Array<Record<string, unknown>>;
		npc: Array<Record<string, unknown>>;
		locations: Array<Record<string, unknown>>;
	};
	aiResponses: [];
};

function defaultCreateId(): string {
	return globalThis.crypto.randomUUID();
}

function toSlug(value: string): string {
	return value
		.toLowerCase()
		.replace(/[\\/:*?"<>|]/g, "")
		.trim()
		.replace(/\s+/g, "-");
}

function buildNotes(notes: DemoCampaignNote[], createId: () => string) {
	return notes.map((note) => ({
		id: createId(),
		title: note.title,
		text: note.text,
		collapsed: false,
	}));
}

function buildPerson(
	person: DemoCampaignPerson,
	order: number,
	createId: () => string,
) {
	return {
		id: createId(),
		slug: toSlug(`${person.firstName} ${person.lastName}`),
		firstName: person.firstName,
		lastName: person.lastName,
		race: person.race,
		class: person.class,
		level: person.level,
		motivation: person.motivation,
		trait: person.trait,
		notes: buildNotes(person.notes, createId),
		collapsed: false,
		isNotesCollapsed: false,
		imageUrl: null,
		order,
	};
}

function buildLocation(
	location: DemoCampaignLocation,
	order: number,
	createId: () => string,
) {
	return {
		id: createId(),
		slug: toSlug(location.name),
		name: location.name,
		description: location.description,
		notes: buildNotes(location.notes, createId),
		collapsed: false,
		isNotesCollapsed: false,
		imageUrl: null,
		order,
	};
}

function buildGoblinParticipant(
	name: string,
	instanceId: string,
): Record<string, unknown> {
	return {
		name,
		originalBestiaryName: "Goblin",
		source: "MM",
		size: ["S"],
		type: { type: "humanoid", tags: ["goblinoid"] },
		alignment: ["N", "E"],
		ac: [{ ac: 15, from: ["{@item leather armor|phb}", "{@item shield|phb}"] }],
		hp: { average: 7, formula: "2d6" },
		speed: { walk: 30 },
		str: 8,
		dex: 14,
		con: 10,
		int: 10,
		wis: 8,
		cha: 8,
		skill: { stealth: "+6" },
		senses: ["darkvision 60 ft."],
		passive: 9,
		languages: ["Common", "Goblin"],
		cr: "1/4",
		trait: [
			{
				name: "Nimble Escape",
				entries: [
					"The goblin can take the {@action Disengage} or {@action Hide} action as a bonus action on each of its turns.",
				],
			},
		],
		action: [
			{
				name: "Scimitar",
				entries: [
					"{@atk mw} {@hit 4} to hit, reach 5 ft., one target. {@h}5 ({@damage 1d6 + 2}) slashing damage.",
				],
			},
			{
				name: "Shortbow",
				entries: [
					"{@atk rw} {@hit 4} to hit, range 80/320 ft., one target. {@h}5 ({@damage 1d6 + 2}) piercing damage.",
				],
			},
		],
		instanceId,
		currentHp: 7,
		hit_points: 7,
		armor_class: 15,
		encounterConditions: [],
	};
}

function buildGoblinBossParticipant(
	name: string,
	instanceId: string,
): Record<string, unknown> {
	return {
		name,
		originalBestiaryName: "Goblin Boss",
		source: "MM",
		size: ["S"],
		type: { type: "humanoid", tags: ["goblinoid"] },
		alignment: ["N", "E"],
		ac: [{ ac: 17, from: ["{@item chain shirt|phb}", "{@item shield|phb}"] }],
		hp: { average: 21, formula: "6d6" },
		speed: { walk: 30 },
		str: 10,
		dex: 14,
		con: 10,
		int: 10,
		wis: 8,
		cha: 10,
		skill: { stealth: "+6" },
		senses: ["darkvision 60 ft."],
		passive: 9,
		languages: ["Common", "Goblin"],
		cr: "1",
		trait: [
			{
				name: "Nimble Escape",
				entries: [
					"The goblin can take the {@action Disengage} or {@action Hide} action as a bonus action on each of its turns.",
				],
			},
		],
		action: [
			{
				name: "Multiattack",
				entries: ["The goblin makes two attacks with its morningstar."],
			},
			{
				name: "Morningstar",
				entries: [
					"{@atk mw} {@hit 4} to hit, reach 5 ft., one target. {@h}5 ({@damage 1d8 + 2}) piercing damage.",
				],
			},
			{
				name: "Javelin",
				entries: [
					"{@atk mw,rw} {@hit 2} to hit, reach 5 ft. or range 30/120 ft., one target. {@h}3 ({@damage 1d6}) piercing damage.",
				],
			},
		],
		reaction: [
			{
				name: "Redirect Attack",
				entries: [
					"When a creature the goblin can see targets it with an attack, the goblin chooses another goblin within 5 feet of it. The two goblins swap places, and the chosen goblin becomes the target instead.",
				],
			},
		],
		instanceId,
		currentHp: 21,
		hit_points: 21,
		armor_class: 17,
		encounterConditions: [],
	};
}

function buildHeroParticipant(
	hero: ReturnType<typeof buildPerson>,
	hitPoints: number,
	armorClass: number,
	instanceId: string,
): Record<string, unknown> {
	return {
		name: `${hero.firstName} ${hero.lastName}`.trim(),
		participantType: "character",
		originalCharacterId: hero.id,
		originalCharacterSlug: hero.slug,
		instanceId,
		currentHp: hitPoints,
		hit_points: hitPoints,
		armor_class: armorClass,
		encounterConditions: [],
	};
}

export function buildDemoCampaignBundle({
	language,
	createId = defaultCreateId,
	now = () => new Date(),
}: DemoCampaignBundleOptions = {}): DemoCampaignBundle {
	const content = getDemoCampaignContent(language);
	const createdAt = now().toISOString();
	const stamp = now().getTime();
	const instanceId = (index: number) => `inst-${stamp}-${index}`;

	const characters = content.characters.map((person, index) =>
		buildPerson(person, index, createId),
	);
	const npc = content.npc.map((person, index) =>
		buildPerson(person, index, createId),
	);
	const locations = content.locations.map((location, index) =>
		buildLocation(location, index, createId),
	);

	const encounterId = createId();
	const encounter = {
		id: encounterId,
		name: content.encounter.name,
		monsters: [
			buildHeroParticipant(characters[0], 12, 16, instanceId(1)),
			buildHeroParticipant(characters[1], 7, 12, instanceId(2)),
			buildGoblinParticipant(content.encounter.goblinName, instanceId(3)),
			buildGoblinParticipant(content.encounter.goblinName, instanceId(4)),
			buildGoblinBossParticipant(
				content.encounter.goblinBossName,
				instanceId(5),
			),
		],
	};

	const scenes = content.session.scenes.map((scene) => ({
		id: createId(),
		texts: {
			summary: scene.summary,
			goal: scene.goal,
			stakes: scene.stakes,
			location: scene.location,
		},
		notes: buildNotes(scene.notes, createId),
		collapsed: false,
		isNotesCollapsed: false,
		imageUrl: null,
		encounterId: scene.hasEncounter ? encounterId : null,
	}));

	return {
		meta: {
			id: createId(),
			slug: toSlug(content.campaignName),
			name: content.campaignName,
			completed: false,
			completedAt: null,
			order: 0,
			createdAt,
			description: content.description,
			notes: buildNotes(content.notes, createId),
		},
		sessions: [
			{
				fileName: `${content.session.name}.json`,
				content: {
					id: createId(),
					name: content.session.name,
					order: 0,
					createdAt,
					data: {
						notes: buildNotes(content.session.notes, createId),
						scenes,
						encounters: [encounter],
						npcs: [],
						locations: [],
						result_text: "",
					},
				},
			},
		],
		entities: { characters, npc, locations },
		aiResponses: [],
	};
}
