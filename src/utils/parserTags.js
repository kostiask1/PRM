export const ABILITY_MAP = {
	str: "Strength",
	dex: "Dexterity",
	con: "Constitution",
	int: "Intelligence",
	wis: "Wisdom",
	cha: "Charisma",
};

export const ATTACK_TYPE_MAP = {
	m: "Melee",
	r: "Ranged",
	"m,r": "Melee or Ranged",
	ms: "Melee Spell",
	rs: "Ranged Spell",
	"ms,rs": "Melee or Ranged Spell",
};

export const getAbilityModifier = (abilityScore) => {
	const score = parseInt(abilityScore, 10);
	if (isNaN(score)) return 0;
	return Math.floor((score - 10) / 2);
};

export const formatModifier = (modifier) => {
	if (modifier === 0) return "+0";
	return modifier > 0 ? `+${modifier}` : `${modifier}`;
};

export const capitalizeWords = (str) => {
	if (!str) return str;
	return str
		.split(" ")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(" ");
};

export const getDamageBonus = (action) => {
	const bonus = parseInt(action?.damage_bonus, 10);
	if (!bonus || isNaN(bonus)) return "";
	return bonus > 0 ? `+${bonus}` : `${bonus}`;
};

export const preprocessTags = (text) => {
	if (typeof text !== "string") return text;
	return text
		.replace(/{@h}/gi, "Hit:")
		.replace(/{@dc\s+(\d+)}/gi, "DC $1")
		.replace(/{@atk\s+mw}/gi, "Melee Weapon Attack:")
		.replace(/{@atk\s+rw}/gi, "Ranged Weapon Attack:")
		.replace(/{@atk\s+mw\s*,\s*rw}/gi, "Melee or Ranged Weapon Attack:")
		.replace(/{@atk\s+ms}/gi, "Melee Spell Attack:")
		.replace(/{@atk\s+rs}/gi, "Ranged Spell Attack:")
		.replace(/{@atk\s+ms\s*,\s*rs}/gi, "Melee or Ranged Spell Attack:")
		.replace(/{@hit\s+([+-]?\d+)}/gi, (m, g1) =>
			g1.startsWith("+") || g1.startsWith("-") ? g1 : `+${g1}`,
		)
		.replace(
			/{@damage\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^|}]*))?}/gi,
			(m, name, src, label) => label || name,
		)
		.replace(
			/{@scaledamage\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^|}]*))?}/gi,
			(m, name, src, label) => label || name,
		)
		.replace(
			/{@scaledice\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^|}]*))?}/gi,
			(m, name, src, label) => label || name,
		)
		.replace(
			/{@hitYourSpellAttack(?:\s+([^}]+))?}/gi,
			(m, label) => label || "your spell attack bonus",
		)
		.replace(/{@actSaveFail}/gi, "On a failure,")
		.replace(/{@actSaveFail\s+(\d+)}/gi, "On a failure by $1 or more,")
		.replace(/{@actSaveSuccess}/gi, "On a success,")
		.replace(/{@actSaveSuccessOrFail}/gi, "On a success or failure,")
		.replace(
			/{@dice\s+([^|}]+)(?:\|([^|}]*))?[^}]*}/gi,
			(m, formula, label) => label || formula,
		)
		.replace(/{@ability\s+([a-z]{3})}/gi, (m, g1) => ABILITY_MAP[g1] || g1)
		.replace(
			/{@savingThrow\s+([a-z]{3})}/gi,
			(m, g1) => `${ABILITY_MAP[g1] || g1} saving throw`,
		)
		.replace(
			/{@actSave\s+([a-z]{3})}/gi,
			(m, g1) => `${ABILITY_MAP[g1] || g1} saving throw`,
		)
		.replace(/{@recharge(?:\s+(\d+))?}/gi, (m, g1) => {
			const num = g1 || "6";
			return num === "6" ? "(Recharge 6)" : `(Recharge ${num}-6)`;
		})
		.replace(
			/{@atkr\s+([a-z,]+)}/gi,
			(m, g1) => `${ATTACK_TYPE_MAP[g1] || g1} Attack: `,
		)
		.replace(/{@chance\s+(\d+)}/gi, "$1%")
		.replace(/{@note\s+([^}]+)}/gi, "$1")
		.replace(/{@hom}/gi, "")
		.replace(/{@loader\s+[^}]+}/gi, "")
		.replace(/{@quickref\s+([^}]+)}/gi, (m, content) => {
			const parts = content.split("|");
			const label = parts
				.slice(1)
				.filter(Boolean)
				.at(-1);
			return label && !/^\d+$/.test(label) ? label : parts[0];
		})
		.replace(
			/{@(creature|action|link|item|filter|book|area|hazard|trap|deck|optfeature|reward|feat|charoption|background|race)\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^|}]*))?[^}]*}/gi,
			(m, tag, name, source, label) => {
				if (tag === "filter") return name;
				return label || name;
			},
		)
		.replace(/{@(?:i|italic)\s+([^}]+)}/gi, "*$1*")
		.replace(/{@(?:b|bold)\s+([^}]+)}/gi, "**$1**");
};
