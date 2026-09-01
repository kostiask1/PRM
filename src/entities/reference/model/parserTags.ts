const ABILITY_MAP: Record<string, string> = {
	str: "Strength",
	dex: "Dexterity",
	con: "Constitution",
	int: "Intelligence",
	wis: "Wisdom",
	cha: "Charisma",
};

const ATTACK_TYPE_MAP: Record<string, string> = {
	m: "Melee",
	r: "Ranged",
	"m,r": "Melee or Ranged",
	ms: "Melee Spell",
	rs: "Ranged Spell",
	"ms,rs": "Melee or Ranged Spell",
};

export interface DamageAction extends Record<string, unknown> {
	damage_bonus?: unknown;
}

export const getAbilityModifier = (abilityScore: unknown): number => {
	const score = Number.parseInt(String(abilityScore), 10);
	if (Number.isNaN(score)) return 0;
	return Math.floor((score - 10) / 2);
};

export const formatModifier = (modifier: number): string => {
	if (modifier === 0) return "+0";
	return modifier > 0 ? `+${modifier}` : `${modifier}`;
};

export const capitalizeWords = (str: string): string => {
	if (!str) return str;
	return str
		.split(" ")
		.map((word) =>
			word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
		)
		.join(" ");
};

export const getDamageBonus = (action: DamageAction | null | undefined): string => {
	const bonus = Number.parseInt(String(action?.damage_bonus), 10);
	if (!bonus || Number.isNaN(bonus)) return "";
	return bonus > 0 ? `+${bonus}` : `${bonus}`;
};

export function preprocessTags<T>(text: T): T | string {
	if (typeof text !== "string") return text;
	return text
		.replace(/{@h}/gi, "Hit: ")
		.replace(/{@dc\s+(\d+)}/gi, "DC $1")
		.replace(/{@atk\s+mw}/gi, "Melee Weapon Attack:")
		.replace(/{@atk\s+rw}/gi, "Ranged Weapon Attack:")
		.replace(/{@atk\s+mw\s*,\s*rw}/gi, "Melee or Ranged Weapon Attack:")
		.replace(/{@atk\s+ms}/gi, "Melee Spell Attack:")
		.replace(/{@atk\s+rs}/gi, "Ranged Spell Attack:")
		.replace(/{@atk\s+ms\s*,\s*rs}/gi, "Melee or Ranged Spell Attack:")
		.replace(/{@hit\s+([+-]?\d+)}/gi, (_match, value: string) =>
			value.startsWith("+") || value.startsWith("-") ? value : `+${value}`,
		)
		.replace(
			/{@damage\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^|}]*))?}/gi,
			(_match, name: string, fallback: string, label: string) =>
				label || fallback || name,
		)
		.replace(
			/{@scaledamage\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^|}]*))?}/gi,
			(_match, name: string, fallback: string, label: string) =>
				label || fallback || name,
		)
		.replace(
			/{@scaledice\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^|}]*))?}/gi,
			(_match, name: string, fallback: string, label: string) =>
				label || fallback || name,
		)
		.replace(
			/{@hitYourSpellAttack(?:\s+([^}]+))?}/gi,
			(_match, label: string) => label || "your spell attack bonus",
		)
		.replace(/{@actSaveFail}/gi, "On a failure,")
		.replace(/{@actSaveFail\s+(\d+)}/gi, "On a failure by $1 or more,")
		.replace(/{@actSaveSuccess}/gi, "On a success,")
		.replace(/{@actSaveSuccessOrFail}/gi, "On a success or failure,")
		.replace(
			/{@dice\s+([^|}]+)(?:\|([^|}]*))?[^}]*}/gi,
			(_match, formula: string, label: string) => label || formula,
		)
		.replace(/{@ability\s+([a-z]{3})}/gi, (_match, ability: string) =>
			ABILITY_MAP[ability] || ability,
		)
		.replace(
			/{@savingThrow\s+([a-z]{3})}/gi,
			(_match, ability: string) =>
				`${ABILITY_MAP[ability] || ability} saving throw`,
		)
		.replace(/{@actSave\s+([a-z]{3})}/gi, (_match, ability: string) =>
			`${ABILITY_MAP[ability] || ability} saving throw`,
		)
		.replace(/{@recharge(?:\s+(\d+(?:-\d+)?))?}/gi, (_match, raw: string) => {
			const value = raw || "6";
			if (value.includes("-")) return `(Recharge ${value})`;
			return value === "6" ? "(Recharge 6)" : `(Recharge ${value}-6)`;
		})
		.replace(/{@atkr\s+([a-z,]+)}/gi, (_match, type: string) =>
			`${ATTACK_TYPE_MAP[type] || type} Attack: `,
		)
		.replace(
			/{@chance\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^|}]*))?(?:\|([^|}]*))?(?:\|([^|}]*))?}/gi,
			(_match, chance: string, label: string) => label || `${chance}%`,
		)
		.replace(/{@note\s+([^}]+)}/gi, "$1")
		.replace(/{@hom}/gi, "")
		.replace(/{@loader\s+[^}]+}/gi, "")
		.replace(/{@quickref\s+([^}]+)}/gi, (_match, content: string) => {
			const parts = content.split("|");
			const label = parts.slice(1).filter(Boolean).at(-1);
			return label && !/^\d+$/.test(label) ? label : parts[0];
		})
		.replace(/{@filter\s+([^|}]+)(?:\|[^}]*)?}/gi, (_match, name: string) => name)
		.replace(
			/{@(creature|action|link|item|book|area|hazard|trap|deck|optfeature|reward|feat|charoption|background|race)\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^|}]*))?[^}]*}/gi,
			(_match, _tag: string, name: string, _source: string, label: string) =>
				label || name,
		)
		.replace(/{@(?:i|italic)\s+([^}]+)}/gi, "*$1*")
		.replace(/{@(?:b|bold)\s+([^}]+)}/gi, "**$1**");
}
