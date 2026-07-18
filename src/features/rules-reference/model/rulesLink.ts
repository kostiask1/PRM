import {
	MonsterStatBlockModel,
	getMonsterTypeString,
	type BestiaryMonster,
} from "../../../entities/bestiary/index.js";
import {
	capitalizeWords,
	extractContentTokens,
	formatModifier,
	preprocessTags,
} from "../../../entities/reference/model.js";
import type {
	ReferenceRecord,
	SpellRecord,
} from "../../../entities/spell/index.js";

export type RulesReferenceType =
	| "spell"
	| "creature"
	| "condition"
	| "status"
	| "disease"
	| "variantrule"
	| "skill"
	| "sense";

export interface RulesReferenceNavigationTarget {
	tab: string;
	name: string;
}

type ReferenceResolver = (value: string) => Promise<ReferenceRecord | null>;

export interface RulesReferenceResolvers {
	resolveSpell: (value: string) => Promise<SpellRecord | null>;
	resolveCondition: ReferenceResolver;
	resolveDisease: ReferenceResolver;
	resolveVariantRule: ReferenceResolver;
	resolveSkill: ReferenceResolver;
	resolveSense: ReferenceResolver;
}

type ReferenceLoader = (value: string) => Promise<ReferenceRecord | null>;

export interface RulesReferencePreviewLoaders {
	getSpell: (value: string) => Promise<SpellRecord | null>;
	getCreature: (value: string) => Promise<BestiaryMonster | null>;
	getCondition: ReferenceLoader;
	getDisease: ReferenceLoader;
	getVariantRule: ReferenceLoader;
	getSkill: ReferenceLoader;
	getSense: ReferenceLoader;
}

export interface RulesReferencePreviewFormatters {
	formatSource: (source: unknown) => string;
	formatSpellMeta: (spell: SpellRecord) => string;
}

interface ReferenceParts {
	name: string;
	source: string;
	label: string;
}

type ReferenceResolverKey = Exclude<keyof RulesReferenceResolvers, "resolveSpell">;
type ReferenceLoaderKey = Exclude<
	keyof RulesReferencePreviewLoaders,
	"getSpell" | "getCreature"
>;

interface ReferenceTypeConfig {
	tab: string;
	resolver: ReferenceResolverKey;
	loader: ReferenceLoaderKey;
	metaField?: "type" | "ability";
}

const REFERENCE_TYPE_CONFIG: Partial<
	Record<RulesReferenceType, ReferenceTypeConfig>
> = {
	condition: {
		tab: "conditions",
		resolver: "resolveCondition",
		loader: "getCondition",
	},
	status: {
		tab: "conditions",
		resolver: "resolveCondition",
		loader: "getCondition",
	},
	disease: {
		tab: "diseases",
		resolver: "resolveDisease",
		loader: "getDisease",
		metaField: "type",
	},
	variantrule: {
		tab: "variantrules",
		resolver: "resolveVariantRule",
		loader: "getVariantRule",
	},
	skill: {
		tab: "skills",
		resolver: "resolveSkill",
		loader: "getSkill",
		metaField: "ability",
	},
	sense: {
		tab: "senses",
		resolver: "resolveSense",
		loader: "getSense",
	},
};

export type RulesReferencePreview =
	| {
			kind: "spell";
			title: string;
			meta: string;
			entries: unknown;
	  }
	| {
			kind: "creature";
			title: string;
			meta: string;
			imageSrc: string;
			ac: string | number;
			hp: string | number;
	  }
	| {
			kind: "reference";
			title: string;
			meta: string;
			entries: unknown;
	  };

export type TooltipTextPart =
	| { kind: "text"; value: string }
	| {
			kind: "roll";
			formula: string;
			label: string;
			context?: {
				type: "recharge";
				threshold: number;
				label: string;
			};
	  };

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

export function getTaggedDisplayValue(raw: unknown): string {
	const parts = String(raw || "").split("|");
	return String(parts[2] || parts[0] || "").trim();
}

export function parseReferenceParts(raw: unknown): ReferenceParts {
	const parts = String(raw || "").split("|");
	return {
		name: String(parts[0] || "").trim(),
		source: String(parts[1] || "").trim(),
		label: String(parts[2] || "").trim(),
	};
}

export function getSpellReferenceName(spell: Partial<SpellRecord>): string {
	const name = String(spell.name || "").trim();
	if (!name) return "";
	const source = String(spell.source || "").trim();
	return source ? `${name}|${source}` : name;
}

export function getCreatureReferenceName(
	creature: { name?: unknown; source?: unknown },
): string {
	const name = String(creature.name || "").trim();
	if (!name) return "";
	const source = String(creature.source || "").trim();
	return source ? `${name}|${source}` : name;
}

export function getRechargeThreshold(recharge: unknown): number {
	const match = String(recharge || "").match(/Recharge\s+(\d+)/i);
	return match ? Number(match[1]) : 6;
}

export function getCreatureCr(creature: BestiaryMonster): string | number {
	const cr = asRecord(creature.cr);
	const value = cr?.cr !== undefined ? cr.cr : creature.cr;
	return typeof value === "string" || typeof value === "number" ? value : "";
}

export function getCreatureHp(creature: BestiaryMonster): string | number {
	const hp = asRecord(creature.hp);
	const value = hp ? hp.special || hp.average : creature.hit_points;
	return typeof value === "string" || typeof value === "number" ? value : "";
}

function scalarPreviewValue(value: unknown): string | number {
	return typeof value === "string" || typeof value === "number" ? value : "";
}

function getStructuredAcValue(value: unknown): string | number {
	const record = asRecord(value);
	return scalarPreviewValue(record?.special || record?.ac);
}

export function getCreatureAc(creature: BestiaryMonster): string | number {
	if (Array.isArray(creature.ac) && creature.ac[0] !== undefined) {
		const ac = creature.ac[0];
		return scalarPreviewValue(ac) || getStructuredAcValue(ac);
	}
	if (Array.isArray(creature.armor_class)) {
		return scalarPreviewValue(creature.armor_class[0]);
	}
	return scalarPreviewValue(creature.armor_class);
}

export function formatFormulaText(text: unknown): string {
	return String(text || "")
		.replace(/\bsummonSpellLevel\b/g, "spell level")
		.replace(/\bPB\b/g, "proficiency bonus");
}

export function formatRulesTooltipText(value: unknown): string {
	const diceTags: string[] = [];
	const protectedText = String(value || "").replace(
		/\{@(?:hit|damage|scaledamage|scaledice|dice|recharge)\s*[^}]*}/gi,
		(match) => {
			const token = `__TOOLTIP_DICE_TAG_${diceTags.length}__`;
			diceTags.push(match);
			return token;
		},
	);
	return String(preprocessTags(protectedText))
		.replace(
			/\{@(?:spell|creature|condition|status|disease|variantrule|skill|sense|quickref)\s+([^}]+)}/gi,
			(_match, raw: string) => capitalizeWords(getTaggedDisplayValue(raw)),
		)
		.replace(
			/__TOOLTIP_DICE_TAG_(\d+)__/g,
			(_match, index: string) => diceTags[Number(index)] || "",
		);
}

function compactFormula(formula: unknown): string {
	return String(formula || "").replace(/\s+/g, "");
}

function textPart(value: unknown): TooltipTextPart {
	return { kind: "text", value: String(value || "") };
}

type TooltipToken = ReturnType<typeof extractContentTokens>[number];
type TooltipTokenHandler = (token: TooltipToken) => TooltipTextPart[] | null;

const rechargeTokenHandler: TooltipTokenHandler = (token) =>
	token.recharge
		? [{
			kind: "roll",
			formula: "1d6",
			label: token.recharge,
			context: {
				type: "recharge",
				threshold: getRechargeThreshold(token.recharge),
				label: token.recharge,
			},
		}]
		: null;

const damageTokenHandler: TooltipTokenHandler = (token) => {
	if (!token.damageRoll && !token.damageRemainder) return null;
	const parts: TooltipTextPart[] = [];
	if (token.damageRoll) {
		parts.push({
			kind: "roll",
			formula: compactFormula(token.damageRoll),
			label: token.damageLabel || token.damageRoll,
		});
	}
	if (token.damageRemainder) {
		parts.push(textPart(formatFormulaText(token.damageRemainder)));
	}
	return parts;
};

const plainRollTokenHandler: TooltipTokenHandler = (token) =>
	token.roll
		? [{ kind: "roll", formula: compactFormula(token.roll), label: token.roll }]
		: null;

const diceTokenHandler: TooltipTokenHandler = (token) =>
	token.diceTag
		? [{
			kind: "roll",
			formula: compactFormula(token.diceFormula),
			label: token.diceLabel || token.diceFormula || "",
		}]
		: null;

const hitTokenHandler: TooltipTokenHandler = (token) => {
	if (!token.hit) return null;
	const bonus = token.hit.split(" ")[0];
	const displayHit =
		token.hit.startsWith("+") || token.hit.startsWith("-")
			? token.hit
			: `+${token.hit}`;
	return [{
		kind: "roll",
		formula: `1d20${formatModifier(Number.parseInt(bonus, 10))}`,
		label: `${displayHit}${token.hitSuffix}`,
	}];
};

const TOOLTIP_TOKEN_HANDLERS: TooltipTokenHandler[] = [
	rechargeTokenHandler,
	damageTokenHandler,
	plainRollTokenHandler,
	diceTokenHandler,
	hitTokenHandler,
];

function getTooltipTokenParts(token: TooltipToken): TooltipTextPart[] {
	for (const handler of TOOLTIP_TOKEN_HANDLERS) {
		const parts = handler(token);
		if (parts) return parts;
	}
	return [textPart(token.displayValue || token.fullMatch)];
}

export function buildTooltipTextParts(value: unknown): TooltipTextPart[] {
	const text = formatRulesTooltipText(value);
	const tokens = extractContentTokens(text);
	const parts: TooltipTextPart[] = [];
	let lastIndex = 0;
	for (const token of tokens) {
		if (token.index > lastIndex) {
			parts.push(textPart(text.slice(lastIndex, token.index)));
		}
		parts.push(...getTooltipTokenParts(token));
		lastIndex = token.index + token.fullMatch.length;
	}
	if (lastIndex < text.length) parts.push(textPart(text.slice(lastIndex)));
	return parts.length > 0 ? parts : [textPart(text)];
}

export async function resolveRulesLinkNavigation(
	type: RulesReferenceType,
	referenceName: string,
	resolvers: RulesReferenceResolvers,
): Promise<RulesReferenceNavigationTarget | null> {
	if (type === "spell") {
		const spell = await resolvers.resolveSpell(referenceName);
		return spell
			? { tab: "spells", name: getSpellReferenceName(spell) }
			: null;
	}
	if (type === "creature") {
		const creature = parseReferenceParts(referenceName);
		return creature.name
			? { tab: "bestiary", name: getCreatureReferenceName(creature) }
			: null;
	}
	const config = REFERENCE_TYPE_CONFIG[type];
	if (!config) return null;
	const reference = await resolvers[config.resolver](referenceName);
	return reference?.name
		? { tab: config.tab, name: reference.name }
		: null;
}

function getReferenceMeta(
	reference: ReferenceRecord,
	metaField: ReferenceTypeConfig["metaField"],
): string {
	if (!metaField) return "";
	const value = reference[metaField];
	if (typeof value !== "string" && typeof value !== "number") return "";
	return metaField === "ability" ? String(value).toUpperCase() : String(value);
}

type PreviewLoader = (
	referenceName: string,
	loaders: RulesReferencePreviewLoaders,
	formatters: RulesReferencePreviewFormatters,
) => Promise<RulesReferencePreview | null>;

const loadSpellPreview: PreviewLoader = async (
	referenceName,
	loaders,
	formatters,
) => {
	const spell = await loaders.getSpell(referenceName);
	return spell
		? {
				kind: "spell",
				title: capitalizeWords(spell.name.split("|")[0]),
				meta: formatters.formatSpellMeta(spell),
				entries: spell.entries,
			}
		: null;
};

const loadCreaturePreview: PreviewLoader = async (
	referenceName,
	loaders,
	formatters,
) => {
	const creature = await loaders.getCreature(referenceName);
	if (!creature) return null;
	const cr = getCreatureCr(creature);
	const meta = [
		formatters.formatSource(creature.source),
		getMonsterTypeString(creature.type),
		cr ? `CR ${cr}` : "",
	].filter(Boolean);
	return {
		kind: "creature",
		title: creature.name,
		meta: meta.join(" • "),
		imageSrc:
			typeof creature.imageUrl === "string" && creature.imageUrl
				? creature.imageUrl
				: new MonsterStatBlockModel(creature).localTokenSrc,
		ac: getCreatureAc(creature),
		hp: getCreatureHp(creature),
	};
};

const SPECIAL_PREVIEW_LOADERS: Partial<Record<RulesReferenceType, PreviewLoader>> = {
	spell: loadSpellPreview,
	creature: loadCreaturePreview,
};

async function loadGenericReferencePreview(
	type: RulesReferenceType,
	referenceName: string,
	loaders: RulesReferencePreviewLoaders,
): Promise<RulesReferencePreview | null> {
	const config = REFERENCE_TYPE_CONFIG[type];
	if (!config) return null;
	const reference = await loaders[config.loader](referenceName);
	return reference?.name
		? {
				kind: "reference",
				title: reference.name,
				meta: getReferenceMeta(reference, config.metaField),
				entries: reference.entries,
			}
		: null;
}

export async function loadRulesLinkPreview(
	type: RulesReferenceType,
	referenceName: string,
	loaders: RulesReferencePreviewLoaders,
	formatters: RulesReferencePreviewFormatters,
): Promise<RulesReferencePreview | null> {
	const specialLoader = SPECIAL_PREVIEW_LOADERS[type];
	return specialLoader
		? specialLoader(referenceName, loaders, formatters)
		: loadGenericReferencePreview(type, referenceName, loaders);
}
