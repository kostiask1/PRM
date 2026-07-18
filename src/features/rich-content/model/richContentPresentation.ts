import {
	capitalizeWords,
	formatModifier,
	type ContentToken,
} from "../../../entities/reference/model.js";

export interface RichContentRenderOptions {
	disableNonRechargeRolls?: boolean;
	disablePlainRolls?: boolean;
	creatureSourceFallback?: string;
}

export type RulesReferenceType =
	| "spell"
	| "creature"
	| "condition"
	| "status"
	| "disease"
	| "variantrule"
	| "skill"
	| "sense";

export type ContentTokenRenderPlan =
	| {
			kind: "roll";
			formula: string;
			displayText: string;
			keyPrefix: string;
			context?: { type: "recharge"; threshold: number; label: string };
	  }
	| {
			kind: "damage";
			formula: string;
			displayText: string;
			remainder: string;
			keyPrefix: string;
	  }
	| {
			kind: "reference";
			referenceType: RulesReferenceType;
			name: string;
			displayText: string;
			keyPrefix: string;
	  }
	| { kind: "text"; text: string; keyPrefix: string };

interface TaggedName {
	name: string;
	displayText: string;
}

export function parseTaggedName(raw: unknown): TaggedName {
	const parts = String(raw || "").split("|");
	const name = String(parts[0] || "").trim();
	const label = String(parts[2] || "").trim();
	return { name, displayText: capitalizeWords(label || name) };
}

export function addFallbackTaggedSource(
	raw: unknown,
	fallbackSource = "",
): string {
	const text = String(raw ?? "");
	const [rawName = "", rawSource = "", rawLabel = ""] = text.split("|");
	const name = rawName.trim();
	const source = rawSource.trim();
	const sourceFallback = String(fallbackSource).trim();
	if (!name) return text;
	if (source) return text;
	if (!sourceFallback) return text;
	return [name, sourceFallback, rawLabel.trim()].filter(Boolean).join("|");
}

export function parseQuickrefName(raw: unknown): TaggedName {
	const parts = String(raw || "").split("|");
	const label = parts.slice(1).filter(Boolean).at(-1);
	const name = label && !/^\d+$/.test(label) ? label : parts[0];
	const displayText = capitalizeWords(name);
	return { name: displayText, displayText };
}

export function stripNotesReferenceText(text: unknown): string {
	return String(text || "").replace(
		/\s*\(see\s+(?:the\s+)?["“][^"”]+["”]\s+in notes\)\.?/gi,
		"",
	);
}

export function formatFormulaText(text: unknown): string {
	return String(text || "")
		.replace(/\bsummonSpellLevel\b/g, "spell level")
		.replace(/\bPB\b/g, "proficiency bonus");
}

function getRechargeThreshold(recharge: string): number {
	const match = recharge.match(/Recharge\s+(\d+)/i);
	return match ? Number(match[1]) : 6;
}

type TokenPlanHandler = (
	token: ContentToken,
	options: RichContentRenderOptions,
) => ContentTokenRenderPlan | null;

const rechargePlan: TokenPlanHandler = (token) => {
	if (!token.recharge) return null;
	return {
		kind: "roll",
		formula: "1d6",
		displayText: token.recharge,
		keyPrefix: "re",
		context: {
			type: "recharge",
			threshold: getRechargeThreshold(token.recharge),
			label: token.recharge,
		},
	};
};

const damagePlan: TokenPlanHandler = (token, options) => {
	if (!token.damageRoll && !token.damageRemainder) return null;
	const displayText = token.damageLabel || token.damageRoll;
	const remainder = formatFormulaText(token.damageRemainder);
	if (options.disableNonRechargeRolls) {
		return { kind: "text", text: `${displayText}${remainder}`, keyPrefix: "d" };
	}
	return {
		kind: "damage",
		formula: token.damageRoll.replace(/\s+/g, ""),
		displayText,
		remainder,
		keyPrefix: "d",
	};
};

const plainRollPlan: TokenPlanHandler = (token, options) => {
	if (!token.roll) return null;
	if (options.disableNonRechargeRolls || options.disablePlainRolls) {
		return { kind: "text", text: token.roll, keyPrefix: "r" };
	}
	return {
		kind: "roll",
		formula: token.roll.replace(/\s+/g, ""),
		displayText: token.roll,
		keyPrefix: "r",
	};
};

const dicePlan: TokenPlanHandler = (token, options) => {
	if (!token.diceTag) return null;
	const displayText = token.diceLabel || token.diceFormula || "";
	if (options.disableNonRechargeRolls) {
		return { kind: "text", text: displayText, keyPrefix: "di" };
	}
	return {
		kind: "roll",
		formula: String(token.diceFormula || "").replace(/\s+/g, ""),
		displayText,
		keyPrefix: "di",
	};
};

const hitPlan: TokenPlanHandler = (token, options) => {
	if (!token.hit) return null;
	const disabled =
		options.disableNonRechargeRolls ||
		Boolean(options.disablePlainRolls && !token.fullMatch.startsWith("{@hit"));
	if (disabled) {
		return {
			kind: "text",
			text: `${token.hit}${token.hitSuffix}`,
			keyPrefix: "h",
		};
	}
	const bonus = Number.parseInt(token.hit.split(" ")[0], 10);
	const displayHit = /^[+-]/.test(token.hit) ? token.hit : `+${token.hit}`;
	return {
		kind: "roll",
		formula: `1d20${formatModifier(bonus)}`,
		displayText: `${displayHit}${token.hitSuffix}`,
		keyPrefix: "h",
	};
};

function taggedReferencePlan(
	raw: string | undefined,
	referenceType: RulesReferenceType,
	keyPrefix: string,
): ContentTokenRenderPlan | null {
	if (!raw) return null;
	const tagged = parseTaggedName(raw);
	return { kind: "reference", referenceType, keyPrefix, ...tagged };
}

const spellPlan: TokenPlanHandler = (token) =>
	token.spellTag ? taggedReferencePlan(token.spellValue, "spell", "s") : null;

const creaturePlan: TokenPlanHandler = (token, options) => {
	if (!token.creatureTag || !token.creatureValue) return null;
	const tagged = parseTaggedName(token.creatureValue);
	return {
		kind: "reference",
		referenceType: "creature",
		keyPrefix: "c",
		name: addFallbackTaggedSource(
			token.creatureValue,
			options.creatureSourceFallback,
		),
		displayText: tagged.displayText,
	};
};

const conditionPlan: TokenPlanHandler = (token) => {
	if (!token.conditionTag && !token.conditionPlain) return null;
	const rawCondition = token.conditionTag
		? parseTaggedName(token.conditionValue).name
		: String(token.conditionPlain).replace(/^@condition\s+/i, "").trim();
	const referenceType = token.conditionTag
		?.toLowerCase()
		.startsWith("{@status")
		? "status"
		: "condition";
	return {
		kind: "reference",
		referenceType,
		keyPrefix: referenceType,
		name: rawCondition,
		displayText: capitalizeWords(rawCondition),
	};
};

const diseasePlan: TokenPlanHandler = (token) =>
	taggedReferencePlan(token.diseaseValue, "disease", "d");
const variantPlan: TokenPlanHandler = (token) =>
	taggedReferencePlan(token.variantRuleValue, "variantrule", "v");
const skillPlan: TokenPlanHandler = (token) =>
	taggedReferencePlan(token.skillValue, "skill", "sk");
const sensePlan: TokenPlanHandler = (token) =>
	taggedReferencePlan(token.senseValue, "sense", "se");

const quickrefPlan: TokenPlanHandler = (token) => {
	if (!token.quickrefValue) return null;
	const tagged = parseQuickrefName(token.quickrefValue);
	return {
		kind: "reference",
		referenceType: "variantrule",
		keyPrefix: "q",
		...tagged,
	};
};

const displayPlan: TokenPlanHandler = (token) =>
	token.displayValue
		? { kind: "text", text: token.displayValue, keyPrefix: "t" }
		: null;

const TOKEN_PLAN_HANDLERS: readonly TokenPlanHandler[] = [
	rechargePlan,
	damagePlan,
	plainRollPlan,
	dicePlan,
	hitPlan,
	spellPlan,
	creaturePlan,
	conditionPlan,
	diseasePlan,
	variantPlan,
	skillPlan,
	sensePlan,
	quickrefPlan,
	displayPlan,
];

export function getContentTokenRenderPlan(
	token: ContentToken,
	options: RichContentRenderOptions = {},
): ContentTokenRenderPlan {
	for (const handler of TOKEN_PLAN_HANDLERS) {
		const plan = handler(token, options);
		if (plan) return plan;
	}
	return { kind: "text", text: token.fullMatch, keyPrefix: "t" };
}

export function isRichContentRecord(
	value: unknown,
): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function asRichContentArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}
