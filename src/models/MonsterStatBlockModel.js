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

export const MONSTER_FIELD_SCHEMA = {
	name: { type: "string", required: true, values: "Назва монстра" },
	source: {
		type: "string",
		required: true,
		values: "Код джерела, напр. MM, PHB, XMM або локальний bestiary-*",
	},
	size: { type: "string[]|string", values: "T/S/M/L/H/G" },
	type: { type: "string|object", values: "Рядок або { type, tags[] }" },
	alignment: { type: "string[]|string", values: "L/C/G/E/N/U або текст" },
	ac: { type: "array", values: "[12] або [{ ac, from[] }]" },
	hp: { type: "object", values: "{ average, formula } або { special }" },
	speed: { type: "string|object", values: "walk/fly/swim/... + canHover" },
	abilities: { type: "number", values: "str/dex/con/int/wis/cha від 1 до 30+" },
	save: { type: "object", values: "str/dex/con/int/wis/cha -> бонус" },
	skill: { type: "object", values: "Назва навички -> бонус" },
	languages: { type: "string|string[]", values: "Мови або тире" },
	cr: { type: "string|number|object", values: "1/4, 2, 30, { cr }" },
	spellcasting: {
		type: "array",
		values: "Блоки заклять з header/will/daily/spells",
	},
	spell_list: { type: "string[]", values: "URL або slug заклять" },
	originalBestiaryName: { type: "string", values: "Локальне поле застосунку" },
};

export default class MonsterStatBlockModel {
	/** @param {MonsterData} monster */
	constructor(monster = {}) {
		this.monster = monster;
	}

	static get schema() {
		return MONSTER_FIELD_SCHEMA;
	}

	get data() {
		return this.monster;
	}

	get effectiveName() {
		return this.monster.originalBestiaryName || this.monster.name || "";
	}

	get encodedImageName() {
		return encodeURIComponent(this.effectiveName);
	}

	get localTokenSrc() {
		return `/assets/bestiary/tokens/${encodeURIComponent(this.monster.source || "")}/${this.encodedImageName}.webp`;
	}

	get externalTokenSrc() {
		return `https://5e.tools/img/bestiary/tokens/${encodeURIComponent(this.monster.source)}/${this.encodedImageName}.webp`;
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
					return `${label} ${value.number} ft. ${value.condition || ""}`.trim();
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
		return SIZE_MAP[value] || value;
	}

	get alignment() {
		const value = this.monster.alignment;
		if (typeof value === "string") return value;
		if (Array.isArray(value)) {
			return value
				.map((abbr) => ALIGNMENT_MAP[abbr] || abbr)
				.filter(Boolean)
				.join(" ");
		}
		return "Unaligned";
	}

	get sourceLabel() {
		return (this.monster.source || "").replace(/^bestiary-/i, "");
	}

	get typeLabel() {
		const baseType = this.monster.type?.type || this.monster.type || "";
		const tags = this.monster.type?.tags?.length
			? ` (${this.monster.type.tags.join(", ")})`
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
		if (this.monster.save) {
			return Object.entries(NEW_SAVE_MAP)
				.filter(([key]) => this.monster.save[key])
				.map(([key, label]) => ({ label, val: this.monster.save[key] }));
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
		return this.monster.cr?.cr || this.monster.cr;
	}

	formatDamageProperty(prop) {
		if (!prop) return null;
		if (typeof prop === "string") return prop;
		if (!Array.isArray(prop)) return null;

		return prop
			.map((item) => {
				if (typeof item === "string") return item;
				if (typeof item === "object" && item !== null) {
					const nestedValue =
						item.resist ||
						item.immune ||
						item.vulnerable ||
						item.conditionImmune;
					const base = Array.isArray(nestedValue)
						? nestedValue.join(", ")
						: nestedValue;
					return `${item.preNote ? `${item.preNote} ` : ""}${base || ""}${item.note ? ` ${item.note}` : ""}`.trim();
				}
				return "";
			})
			.filter(Boolean)
			.join(", ");
	}
}
