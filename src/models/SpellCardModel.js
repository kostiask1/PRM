const SCHOOL_MAP = {
	A: "Abjuration",
	C: "Conjuration",
	D: "Divination",
	E: "Enchantment",
	I: "Illusion",
	N: "Necromancy",
	T: "Thaumaturgy",
	P: "Transmutation",
	V: "Evocation",
};

function formatTemplate(template, variables = {}) {
	return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) =>
		Object.prototype.hasOwnProperty.call(variables, key)
			? String(variables[key])
			: match,
	);
}

/**
 * @typedef {Object} SpellTime
 * @property {number} number
 * @property {string} unit
 * @property {string} [condition]
 */

/**
 * @typedef {Object} SpellRange
 * @property {string} type
 * @property {{type: string, amount?: number}} [distance]
 */

/**
 * @typedef {Object} SpellComponents
 * @property {boolean} [v]
 * @property {boolean} [s]
 * @property {string|{text: string, consume?: boolean, cost?: number}} [m]
 */

/**
 * @typedef {Object} SpellDuration
 * @property {"instant"|"timed"|"permanent"|string} type
 * @property {{type: string, amount?: number}} [duration]
 * @property {boolean} [concentration]
 */

/**
 * Spell data schema (based on `spells-phb.json`).
 * @typedef {Object} SpellData
 * @property {string} name
 * @property {string} source
 * @property {string[]} [classes]
 * @property {0|1|2|3|4|5|6|7|8|9|number} level
 * @property {"A"|"C"|"D"|"E"|"I"|"N"|"T"|"P"|"V"|string} school
 * @property {SpellTime[]} [time]
 * @property {SpellRange} [range]
 * @property {SpellComponents} [components]
 * @property {SpellDuration[]} [duration]
 * @property {Array<string|Object>} [entries]
 * @property {Array<string|Object>} [entriesHigherLevel]
 * @property {Object} [scalingLevelDice]
 * @property {string[]} [damageInflict]
 * @property {string[]} [savingThrow]
 * @property {string[]} [spellAttack]
 * @property {string[]} [miscTags]
 */

export const SPELL_FIELD_SCHEMA = {
	name: { type: "string", required: true, values: "Name or name|source" },
	source: { type: "string", required: true, values: "PHB, XPHB, ..." },
	classes: { type: "string[]", values: "Classes that can access the spell" },
	level: { type: "number", required: true, values: "0..9" },
	school: { type: "string", required: true, values: "A/C/D/E/I/N/T/P/V" },
	time: { type: "array", values: "[{ number, unit, condition? }]" },
	range: { type: "object", values: "{ type, distance? }" },
	components: {
		type: "object",
		values: "V/S/M; M can be a string or object",
	},
	duration: {
		type: "array",
		values: "instant/timed/permanent + concentration",
	},
	entries: { type: "array", values: "Main spell description" },
	entriesHigherLevel: { type: "array", values: "Higher-level description" },
};

export default class SpellCardModel {
	/** @param {SpellData} spell */
	constructor(spell = {}, options = {}) {
		this.spell = spell;
		this.language = String(options.language || "uk").toLowerCase();
		this.translate =
			typeof options.translate === "function"
				? options.translate
				: formatTemplate;
	}

	static get schema() {
		return SPELL_FIELD_SCHEMA;
	}

	get data() {
		return this.spell;
	}

	get displayName() {
		return (this.spell.name || "").split("|")[0];
	}

	get levelLabel() {
		return this.spell.level === 0
			? this.translate("Cantrip")
			: this.translate("Spell level {level}", { level: this.spell.level });
	}

	get schoolLabel() {
		const school = SCHOOL_MAP[this.spell.school] || this.spell.school;
		if (!school || this.language.startsWith("en")) return school;
		return this.translate(school);
	}

	get sourceLabel() {
		return this.spell.source || "";
	}

	get castingTimeLabel() {
		if (!this.spell.time) return "-";
		return this.spell.time
			.map(
				(t) => `${t.number} ${t.unit}${t.condition ? ` (${t.condition})` : ""}`,
			)
			.join(", ");
	}

	get rangeLabel() {
		if (!this.spell.range) return "-";
		const distance = this.spell.range.distance;
		if (!distance) return this.spell.range.type;

		const unit = distance.type === "feet" ? this.translate("ft.") : distance.type;
		return `${distance.amount || ""} ${unit} (${this.spell.range.type})`;
	}

	get componentsLabel() {
		const components = this.spell.components;
		if (!components) return "-";

		const parts = [];
		if (components.v) parts.push("V");
		if (components.s) parts.push("S");
		if (components.m) {
			const materialText =
				typeof components.m === "object" ? components.m.text : components.m;
			parts.push(`M (${materialText})`);
		}
		return parts.join(", ");
	}

	get durationLabel() {
		if (!this.spell.duration) return "-";
		return this.spell.duration
			.map((entry) => {
				let value = entry.type === "instant" ? this.translate("Instantaneous") : "";
				if (entry.type === "timed" && entry.duration) {
					value = `${entry.duration.amount} ${entry.duration.type}`;
				}
				if (entry.concentration) {
					return this.translate("Concentration, up to {duration}", {
						duration: value,
					});
				}
				return value;
			})
			.join(", ");
	}

	get classesLabel() {
		if (!Array.isArray(this.spell.classes) || this.spell.classes.length === 0) {
			return "";
		}
		return this.spell.classes.join(", ");
	}
}
