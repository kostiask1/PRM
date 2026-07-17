export const CONTENT_TOKEN_REGEX =
	/(\(Recharge\s+\d+(?:-\d+)?\)|\{@recharge(?:\s+\d+(?:-\d+)?)?})|(\{@(?:damage|scaledamage|scaledice)\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^|}]*))?[^}]*\})|(\{@dice\s+([^|}]+)(?:\|([^|}]*))?[^}]*\})|(\d+d\d+(?:\s*[+-]\s*\d+)?)|(\{@hit\s+([+-]?\d+)\})(\s+to\s+hit)?|(?<!\d)([+-]\d+)(\s+to\s+hit)?|(\{@spell\s+([^}]+)\})|(\{@creature\s+([^}]+)\})|(\{@(?:condition|status)\s+([^}]+)\})|(@condition\s+([A-Za-z][A-Za-z' -]*))|(\{@disease\s+([^}]+)\})|(\{@variantrule\s+([^}]+)\})|(\{@skill\s+([^}]+)\})|(\{@sense\s+([^}]+)\})|(\{@quickref\s+([^}]+)\})|(\{@(?:action|link|item|book|area|hazard|trap|deck|optfeature|reward|feat|charoption|background|race)\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^|}]*))?[^}]*\})/gi;

const DAMAGE_ROLL_PREFIX_REGEX =
	/^\s*(\d+d\d+(?:\s*[+-]\s*(?:\d+d\d+|\d+))*)([\s\S]*)$/i;

interface DamageRollParts {
	roll: string;
	remainder: string;
}

export interface ContentToken {
	fullMatch: string;
	recharge?: string;
	damageRoll: string;
	damageRemainder: string;
	damageLabel?: string;
	diceTag?: string;
	diceFormula?: string;
	diceLabel?: string;
	roll?: string;
	hit?: string;
	hitSuffix: string;
	spellTag?: string;
	spellValue?: string;
	creatureTag?: string;
	creatureValue?: string;
	conditionTag?: string;
	conditionValue?: string;
	conditionPlain?: string;
	diseaseValue?: string;
	variantRuleValue?: string;
	skillValue?: string;
	senseValue?: string;
	quickrefValue?: string;
	displayTag?: string;
	displayValue?: string;
}

export interface IndexedContentToken extends ContentToken {
	index: number;
}

function splitDamageRoll(value: unknown): DamageRollParts {
	const text = String(value || "");
	const match = text.match(DAMAGE_ROLL_PREFIX_REGEX);
	if (!match) return { roll: "", remainder: text };
	return { roll: match[1].trim(), remainder: match[2] || "" };
}

function normalizeRechargeToken(value: string | undefined): string | undefined {
	const rechargeTag = String(value || "").match(
		/^\{@recharge(?:\s+(\d+(?:-\d+)?))?}$/i,
	);
	if (!rechargeTag) return value;
	const rechargeValue = rechargeTag[1] || "6";
	if (rechargeValue.includes("-")) return `(Recharge ${rechargeValue})`;
	return rechargeValue === "6"
		? "(Recharge 6)"
		: `(Recharge ${rechargeValue}-6)`;
}

export function tokenFromContentMatch(match: RegExpExecArray): ContentToken {
	const damageParts = splitDamageRoll(match[3]);
	const fallbackDamageParts = splitDamageRoll(match[4]);
	const hasFallbackDamageRoll = !damageParts.roll && fallbackDamageParts.roll;
	return {
		fullMatch: match[0],
		recharge: normalizeRechargeToken(match[1]),
		damageRoll: hasFallbackDamageRoll
			? fallbackDamageParts.roll
			: damageParts.roll,
		damageRemainder: hasFallbackDamageRoll
			? fallbackDamageParts.remainder
			: damageParts.remainder,
		damageLabel: hasFallbackDamageRoll ? match[4] : match[5],
		diceTag: match[6],
		diceFormula: match[7],
		diceLabel: match[8],
		roll: match[9],
		hit: match[11] || match[13],
		hitSuffix: match[12] || match[14] || "",
		spellTag: match[15],
		spellValue: match[16],
		creatureTag: match[17],
		creatureValue: match[18],
		conditionTag: match[19],
		conditionValue: match[20],
		conditionPlain: match[21],
		diseaseValue: match[24],
		variantRuleValue: match[26],
		skillValue: match[28],
		senseValue: match[30],
		quickrefValue: match[32],
		displayTag: match[33],
		displayValue: match[36] || match[34],
	};
}

export function extractContentTokens(text: unknown): IndexedContentToken[] {
	const regex = new RegExp(CONTENT_TOKEN_REGEX.source, CONTENT_TOKEN_REGEX.flags);
	const tokens: IndexedContentToken[] = [];
	let match: RegExpExecArray | null;
	while ((match = regex.exec(String(text || ""))) !== null) {
		tokens.push({ ...tokenFromContentMatch(match), index: match.index });
	}
	return tokens;
}
