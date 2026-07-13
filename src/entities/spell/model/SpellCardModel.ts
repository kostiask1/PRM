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

export type SpellTranslate = (
	template: string,
	variables?: Record<string, unknown>,
) => string;

export interface SpellTime {
	number: number;
	unit: string;
	condition?: string;
}

export interface SpellRange {
	type: string;
	distance?: { type: string; amount?: number };
}

export interface SpellComponents {
	v?: boolean;
	s?: boolean;
	m?: string | { text: string; consume?: boolean; cost?: number };
}

export interface SpellDuration {
	type: "instant" | "timed" | "permanent" | "special" | string;
	duration?: { type: string; amount?: number };
	concentration?: boolean;
	ends?: string[];
}

export interface SpellData extends Record<string, unknown> {
	name?: string;
	source?: string;
	classes?: string[];
	level?: number;
	school?: string;
	time?: SpellTime[];
	range?: SpellRange;
	components?: SpellComponents;
	duration?: SpellDuration[];
	entries?: unknown[];
	entriesHigherLevel?: unknown[];
}

export interface SpellCardModelOptions {
	language?: string;
	translate?: SpellTranslate;
}

function formatTemplate(
	template: string,
	variables: Record<string, unknown> = {},
): string {
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

export default class SpellCardModel {
	readonly spell: SpellData;
	readonly language: string;
	readonly translate: SpellTranslate;

	/** @param {SpellData} spell */
	constructor(spell: SpellData = {}, options: SpellCardModelOptions = {}) {
		this.spell = spell;
		this.language = String(options.language || "en").toLowerCase();
		this.translate =
			typeof options.translate === "function"
				? options.translate
				: formatTemplate;
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
		const school =
			(SCHOOL_MAP as Record<string, string>)[this.spell.school || ""] ||
			this.spell.school;
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

		const unit =
			distance.type === "feet" ? this.translate("ft.") : distance.type;
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
				let value = "";
				if (entry.type === "instant") {
					value = this.translate("Instantaneous");
				}
				if (entry.type === "timed" && entry.duration) {
					value = `${entry.duration.amount} ${entry.duration.type}`;
				}
				if (entry.type === "permanent") {
					value = this.formatPermanentDuration(entry.ends);
				}
				if (entry.type === "special") {
					value = this.translate("Special");
				}
				if (entry.concentration) {
					return this.translate("Concentration, up to {duration}", {
						duration: value,
					});
				}
				return value || entry.type || "-";
			})
			.join(", ");
	}

	formatPermanentDuration(ends: string[] = []): string {
		if (Array.isArray(ends) && ends.includes("trigger")) {
			return this.translate("Until dispelled or triggered");
		}
		if (Array.isArray(ends) && ends.includes("dispel")) {
			return this.translate("Until dispelled");
		}
		return this.translate("Permanent");
	}

	get classesLabel() {
		if (!Array.isArray(this.spell.classes) || this.spell.classes.length === 0) {
			return "";
		}
		return this.spell.classes.join(", ");
	}
}
