const ALIGNMENT_MAP = {
	L: "Lawful",
	C: "Chaotic",
	G: "Good",
	E: "Evil",
	N: "Neutral",
	U: "Unaligned",
};

const SIZE_MAP = {
	T: "Tiny",
	S: "Small",
	M: "Medium",
	L: "Large",
	H: "Huge",
	G: "Gargantuan",
};

const LEGACY_SAVE_MAP = {
	strength_save: "Str",
	dexterity_save: "Dex",
	constitution_save: "Con",
	intelligence_save: "Int",
	wisdom_save: "Wis",
	charisma_save: "Cha",
};

const NEW_SAVE_MAP = {
	str: "Str",
	dex: "Dex",
	con: "Con",
	int: "Int",
	wis: "Wis",
	cha: "Cha",
};

export interface MonsterTypeChoice {
	choose?: string[];
}

export interface MonsterTypeDescriptor {
	type?: string | MonsterTypeChoice;
	tags?: unknown[];
}

export interface MonsterEntry extends Record<string, unknown> {
	name?: string;
	entries?: unknown[];
	desc?: string;
	attack_bonus?: string | number;
	damage_dice?: string;
}

export interface MonsterDamageDescriptor extends Record<string, unknown> {
	resist?: string | string[];
	immune?: string | string[];
	vulnerable?: string | string[];
	conditionImmune?: string | string[];
	preNote?: string;
	note?: string;
}

export interface MonsterData extends Record<string, unknown> {
	name?: string;
	source?: string;
	originalBestiaryName?: string;
	hp?: { average?: number; formula?: string; special?: string | number };
	hit_points?: unknown;
	hit_dice?: string;
	ac?: Array<number | string | { ac?: number | string; special?: string; from?: string[] }>;
	armor_class?: unknown;
	armor_desc?: unknown;
	speed?: string | Record<string, unknown>;
	size?: string | string[];
	alignment?: string | string[];
	type?: string | MonsterTypeDescriptor;
	str?: number;
	dex?: number;
	con?: number;
	int?: number;
	wis?: number;
	cha?: number;
	strength?: number;
	dexterity?: number;
	constitution?: number;
	intelligence?: number;
	wisdom?: number;
	charisma?: number;
	save?: Record<string, string | number>;
	skill?: Record<string, string | number>;
	skills?: Record<string, string | number>;
	languages?: string | string[];
	cr?: string | number | { cr?: string | number };
	trait?: MonsterEntry[];
	bonus?: MonsterEntry[];
	action?: MonsterEntry[];
	reaction?: MonsterEntry[];
	legendary?: MonsterEntry[];
	vulnerable?: string | Array<string | MonsterDamageDescriptor>;
	resist?: string | Array<string | MonsterDamageDescriptor>;
	immune?: string | Array<string | MonsterDamageDescriptor>;
	conditionImmune?: string | Array<string | MonsterDamageDescriptor>;
}

function formatMonsterType(monsterType: unknown): string {
	if (!monsterType) return "";
	if (typeof monsterType === "string") return monsterType;
	if (typeof monsterType === "object") {
		const type = (monsterType as MonsterTypeDescriptor).type;
		if (typeof type === "string") return type;
		if (type && typeof type === "object" && Array.isArray(type.choose)) {
			return type.choose.join("/");
		}
	}
	return "";
}

function getDamageDescriptorValue(
	item: MonsterDamageDescriptor,
): string | string[] | undefined {
	return [
		item.resist,
		item.immune,
		item.vulnerable,
		item.conditionImmune,
	].find(Boolean);
}

function formatDamageDescriptor(item: MonsterDamageDescriptor): string {
	const nestedValue = getDamageDescriptorValue(item);
	const base = Array.isArray(nestedValue)
		? nestedValue.join(", ")
		: nestedValue || "";
	const prefix = item.preNote ? `${item.preNote} ` : "";
	const suffix = item.note ? ` ${item.note}` : "";
	return `${prefix}${base}${suffix}`.trim();
}

function formatDamagePropertyItem(
	item: string | MonsterDamageDescriptor,
): string {
	if (typeof item === "string") return item;
	return item && typeof item === "object"
		? formatDamageDescriptor(item)
		: "";
}

/**
 * Monster action/trait entry.
 * @typedef {Object} MonsterEntry
 * @property {string} [name]
 * @property {Array<string|Object>} [entries]
 * @property {string} [desc]
 * @property {string|number} [attack_bonus]
 * @property {string} [damage_dice]
 */

/**
 * Monster spellcasting block from bestiary JSON.
 * @typedef {Object} MonsterSpellcasting
 * @property {string} [name]
 * @property {Array<string|Object>} [headerEntries]
 * @property {Array<string|Object>} [will]
 * @property {Object<string, Array<string|Object>>} [daily]
 * @property {Object<string, {slots?: number, spells: Array<string|Object>} >} [spells]
 */

/**
 * Monster data model (based on `bestiary-mm.json`, `bestiary-phb.json` + local app fields).
 * @typedef {Object} MonsterData
 * @property {string} name
 * @property {string} source
 * @property {number|string} [page]
 * @property {Array<"T"|"S"|"M"|"L"|"H"|"G">|string} [size]
 * @property {string|{type: string, tags?: string[]}} [type]
 * @property {Array<"L"|"C"|"G"|"E"|"N"|"U"|string>|string} [alignment]
 * @property {Array<number|{ac?: number|string, special?: string, from?: string[]}>} [ac]
 * @property {{average?: number, formula?: string, special?: string|number}} [hp]
 * @property {string|Object<string, number|{number: number, condition?: string}|boolean>} [speed]
 * @property {number} [str]
 * @property {number} [dex]
 * @property {number} [con]
 * @property {number} [int]
 * @property {number} [wis]
 * @property {number} [cha]
 * @property {Object<string, string|number>} [save]
 * @property {Object<string, string|number>} [skill]
 * @property {string|string[]} [languages]
 * @property {string|{cr?: string|number}} [cr]
 * @property {MonsterEntry[]} [trait]
 * @property {MonsterEntry[]} [bonus]
 * @property {MonsterEntry[]} [action]
 * @property {MonsterEntry[]} [reaction]
 * @property {MonsterEntry[]} [legendary]
 * @property {Array<string|Object>} [lairActions]
 * @property {Array<string|Object>} [regionalEffects]
 * @property {Array<MonsterSpellcasting>} [spellcasting]
 * @property {string[]} [spell_list]
 * @property {string|Array<string|Object>} [senses]
 * @property {string|Array<string|{resist?: string|string[], immune?: string|string[], vulnerable?: string|string[], conditionImmune?: string|string[], preNote?: string, note?: string}>} [vulnerable]
 * @property {string|Array<string|{resist?: string|string[], immune?: string|string[], vulnerable?: string|string[], conditionImmune?: string|string[], preNote?: string, note?: string}>} [resist]
 * @property {string|Array<string|{resist?: string|string[], immune?: string|string[], vulnerable?: string|string[], conditionImmune?: string|string[], preNote?: string, note?: string}>} [immune]
 * @property {string|Array<string|{conditionImmune?: string|string[], preNote?: string, note?: string}>} [conditionImmune]
 * @property {string|Array<string|Object>} [desc]
 * @property {string} [originalBestiaryName]
 */

export default class MonsterStatBlockModel {
	readonly monster: MonsterData;

	/** @param {MonsterData} monster */
	constructor(monster: MonsterData = {}) {
		this.monster = monster;
	}

	get effectiveName() {
		return this.monster.originalBestiaryName || this.monster.name || "";
	}

	get encodedImageName() {
		return encodeURIComponent(this.effectiveName);
	}

	get localTokenSrc() {
		return `/api/bestiary/tokens/${encodeURIComponent(this.monster.source || "")}/${this.encodedImageName}.webp`;
	}

	get externalTokenSrc() {
		return `https://5e.tools/img/bestiary/tokens/${encodeURIComponent(this.monster.source || "")}/${this.encodedImageName}.webp`;
	}

	get hp() {
		if (this.monster.hp && typeof this.monster.hp === "object") {
			return {
				val: this.monster.hp.special || this.monster.hp.average,
				formula: this.monster.hp.formula,
			};
		}

		return {
			val: this.monster.hit_points,
			formula: this.monster.hit_dice,
		};
	}

	get ac() {
		if (Array.isArray(this.monster.ac) && this.monster.ac[0]) {
			const entry = this.monster.ac[0];
			if (typeof entry === "object") {
				return {
					val: entry.special || entry.ac,
					desc: entry.from ? entry.from.join(", ") : "",
				};
			}

			return { val: entry, desc: "" };
		}

		return {
			val: this.monster.armor_class,
			desc: this.monster.armor_desc,
		};
	}

	get speed() {
		if (typeof this.monster.speed === "string") return this.monster.speed;
		if (typeof this.monster.speed !== "object" || this.monster.speed === null) {
			return "-";
		}

		const parts = Object.entries(this.monster.speed)
			.filter(([key]) => key !== "canHover")
			.map(([key, value]) => {
				const label = key === "walk" ? "" : key;
				if (typeof value === "object" && value !== null) {
					const speed = value as Record<string, unknown>;
					return `${label} ${String(speed.number ?? "")} ft. ${String(speed.condition || "")}`.trim();
				}
				return `${label} ${value} ft.`.trim();
			});

		let formatted = parts.join(", ");
		if (
			this.monster.speed.canHover &&
			!formatted.toLowerCase().includes("hover")
		) {
			formatted += " (hover)";
		}
		return formatted || "-";
	}

	get size() {
		const value = Array.isArray(this.monster.size)
			? this.monster.size[0]
			: this.monster.size;
		return value
			? (SIZE_MAP as Record<string, string>)[value] || value
			: value;
	}

	get alignment() {
		const value = this.monster.alignment;
		if (typeof value === "string") return value;
		if (Array.isArray(value)) {
			return value
				.map(
					(abbr) =>
						(ALIGNMENT_MAP as Record<string, string>)[abbr] || abbr,
				)
				.filter(Boolean)
				.join(" ");
		}
		return "Unaligned";
	}

	get typeLabel() {
		const baseType = formatMonsterType(this.monster.type);
		const descriptor =
			this.monster.type && typeof this.monster.type === "object"
				? this.monster.type
				: null;
		const tags = descriptor?.tags?.length
			? ` (${descriptor.tags.join(", ")})`
			: "";
		return `${baseType}${tags}`.trim();
	}

	get abilityScores() {
		return {
			str: this.monster.str ?? this.monster.strength,
			dex: this.monster.dex ?? this.monster.dexterity,
			con: this.monster.con ?? this.monster.constitution,
			int: this.monster.int ?? this.monster.intelligence,
			wis: this.monster.wis ?? this.monster.wisdom,
			cha: this.monster.cha ?? this.monster.charisma,
		};
	}

	get saves() {
		const saves = this.monster.save;
		if (saves) {
			return Object.entries(NEW_SAVE_MAP)
				.filter(([key]) => saves[key])
				.map(([key, label]) => ({ label, val: saves[key] }));
		}

		return Object.entries(LEGACY_SAVE_MAP)
			.filter(
				([key]) =>
					this.monster[key] !== null && this.monster[key] !== undefined,
			)
			.map(([key, label]) => ({ label, val: this.monster[key] }));
	}

	get skills() {
		return Object.entries(this.monster.skill || this.monster.skills || {});
	}

	get languages() {
		if (typeof this.monster.languages === "string")
			return this.monster.languages;
		return this.monster.languages?.join(", ");
	}

	get challenge() {
		const challenge = this.monster.cr;
		return challenge && typeof challenge === "object"
			? challenge.cr
			: challenge;
	}

	formatDamageProperty(
		prop: string | Array<string | MonsterDamageDescriptor> | null | undefined,
	): string | null {
		if (!prop) return null;
		if (typeof prop === "string") return prop;
		if (!Array.isArray(prop)) return null;

		return prop
			.map(formatDamagePropertyItem)
			.filter(Boolean)
			.join(", ");
	}
}
