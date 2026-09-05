import {
	getMonsterTypeString,
	MonsterStatBlockModel,
	type MonsterData,
	type MonsterEntry,
	type MonsterTypeDescriptor,
} from "../../entities/bestiary/index.js";

export const CREATURE_ACTION_SECTIONS = [
	{ key: "trait", label: "Traits" },
	{ key: "bonus", label: "Bonus Actions" },
	{ key: "action", label: "Actions" },
	{ key: "reaction", label: "Reactions" },
	{ key: "legendary", label: "Legendary Actions" },
] as const;

export type CreatureActionSection =
	(typeof CREATURE_ACTION_SECTIONS)[number]["key"];

export const SIZE_OPTIONS = [
	{ value: "T", label: "Tiny" },
	{ value: "S", label: "Small" },
	{ value: "M", label: "Medium" },
	{ value: "L", label: "Large" },
	{ value: "H", label: "Huge" },
	{ value: "G", label: "Gargantuan" },
] as const;

export const ALIGNMENT_OPTIONS = [
	{ value: "L G", label: "Lawful Good" },
	{ value: "N G", label: "Neutral Good" },
	{ value: "C G", label: "Chaotic Good" },
	{ value: "L N", label: "Lawful Neutral" },
	{ value: "N", label: "Neutral" },
	{ value: "C N", label: "Chaotic Neutral" },
	{ value: "L E", label: "Lawful Evil" },
	{ value: "N E", label: "Neutral Evil" },
	{ value: "C E", label: "Chaotic Evil" },
	{ value: "U", label: "Unaligned" },
] as const;

export const CREATURE_ABILITY_KEYS = [
	"str",
	"dex",
	"con",
	"int",
	"wis",
	"cha",
] as const;

export type CreatureAbilityKey = (typeof CREATURE_ABILITY_KEYS)[number];
export type CreatureEditableFieldKey =
	| CreatureAbilityKey
	| "name"
	| "source"
	| "size"
	| "type"
	| "alignment"
	| "ac"
	| "hpFormula"
	| "cr"
	| "speed"
	| "senses"
	| "languages"
	| "vulnerable"
	| "resist"
	| "immune"
	| "conditionImmune"
	| "desc";

type CreatureDefenseFieldKey =
	| "vulnerable"
	| "resist"
	| "immune"
	| "conditionImmune";

export type MonsterEditMode = "fields" | "json";

export interface RuleReferenceSelection {
	tag?: string;
	[key: string]: unknown;
}

interface RuleInsertSelection {
	selectionStart: number;
	selectionEnd: number;
}

export type RuleInsertTarget =
	| (RuleInsertSelection & {
			type: "field";
			key: CreatureEditableFieldKey;
	  })
	| (RuleInsertSelection & {
			type: "action";
			section: CreatureActionSection;
			index: number;
	  });

type JsonParseResult =
	| { ok: true; monster: MonsterData }
	| { ok: false; reason: "invalid-json"; message: string }
	| { ok: false; reason: "not-object"; message: "" };

export interface NamedMonsterData extends MonsterData {
	name: string;
}

export type MonsterSaveResult =
	| { ok: true; monster: NamedMonsterData }
	| { ok: false; reason: "invalid-json"; message: string }
	| { ok: false; reason: "not-object" | "missing-name"; message: "" };

const SPEED_KEYS = new Set(["walk", "burrow", "climb", "fly", "swim"]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(object: unknown, key: string): boolean {
	return isRecord(object) && Object.prototype.hasOwnProperty.call(object, key);
}

export function cloneMonster<T extends MonsterData>(
	monster: T | null | undefined,
): T | null {
	if (!monster) return null;
	return JSON.parse(JSON.stringify(monster)) as T;
}

export function actionEntriesToText(action: MonsterEntry = {}): string {
	if (Array.isArray(action.entries)) {
		return action.entries
			.map((entry) =>
				typeof entry === "string" ? entry : JSON.stringify(entry, null, 2),
			)
			.join("\n");
	}
	if (Array.isArray(action.desc)) return action.desc.join("\n");
	return String(action.desc || "");
}

export function actionFromText(
	action: MonsterEntry = {},
	text = "",
): MonsterEntry {
	const normalizedText = String(text || "").trim();
	const next = { ...action };
	if (hasOwn(next, "desc") && !hasOwn(next, "entries")) {
		next.desc = normalizedText;
		return next;
	}
	next.entries = normalizedText ? [normalizedText] : [];
	delete next.desc;
	return next;
}

export function parseMaybeNumber(value: unknown): number | string | undefined {
	const text = String(value ?? "").trim();
	if (!text) return undefined;
	const number = Number(text);
	return Number.isFinite(number) ? number : text;
}

export function calculateDiceAverage(formula: unknown): number | undefined {
	const text = String(formula || "").trim();
	if (!text) return undefined;

	const expression = text.replace(
		/(\d*)d(\d+)(?:\s*[hl]\s*\d+)?/gi,
		(_match, countText: string, sidesText: string) => {
			const count = Number(countText || 1);
			const sides = Number(sidesText);
			if (!Number.isFinite(count) || !Number.isFinite(sides) || sides <= 0) {
				return "0";
			}
			return String(count * ((sides + 1) / 2));
		},
	);

	if (!/^[\d+\-*/().\s]+$/.test(expression)) return undefined;

	try {
		const value = Function(`"use strict"; return (${expression});`)() as unknown;
		return typeof value === "number" && Number.isFinite(value)
			? Math.round(value)
			: undefined;
	} catch {
		return undefined;
	}
}

function getCreatureAcInput(monster: MonsterData): string {
	if (Array.isArray(monster.ac) && monster.ac[0] !== undefined) {
		const entry = monster.ac[0];
		return String(
			isRecord(entry) ? (entry.ac ?? entry.special ?? "") : entry,
		);
	}
	return String(monster.armor_class ?? "");
}

function getCreatureHpFormulaInput(monster: MonsterData): string {
	return isRecord(monster.hp) ? String(monster.hp.formula ?? "") : String(monster.hit_dice ?? "");
}

function listLikeValueToText(value: unknown): string {
	if (Array.isArray(value)) {
		return value
			.map((entry) =>
				typeof entry === "string" || typeof entry === "number"
					? String(entry)
					: JSON.stringify(entry),
			)
			.join(", ");
	}
	if (isRecord(value)) return JSON.stringify(value);
	return String(value ?? "");
}

function splitListText(value: unknown): string[] {
	return String(value || "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function splitTypeChoiceText(value: unknown): string[] {
	return String(value || "")
		.split(/[,/]/)
		.map((item) => item.trim())
		.filter(Boolean);
}

function formatSpeedValue(key: string, value: unknown): string {
	const label = key === "walk" ? "" : `${key} `;
	if (isRecord(value)) {
		const number = value.number ?? "";
		const condition = value.condition ? ` ${String(value.condition)}` : "";
		return `${label}${String(number)} ft.${condition}`.trim();
	}
	return `${label}${String(value)} ft.`.trim();
}

export function speedToText(speed: unknown): string {
	if (typeof speed === "string") return speed;
	if (!isRecord(speed)) return "";

	const parts = Object.entries(speed)
		.filter(([key, value]) => SPEED_KEYS.has(key) && value !== false)
		.map(([key, value]) => formatSpeedValue(key, value))
		.filter(Boolean);

	if (speed.canHover && !parts.join(" ").toLowerCase().includes("hover")) {
		const flyIndex = parts.findIndex((part) => /^fly\b/i.test(part));
		if (flyIndex >= 0) parts[flyIndex] = `${parts[flyIndex]} (hover)`;
		else parts.push("hover");
	}

	return parts.join(", ");
}

function parseJsonSpeedText(text: string): string | Record<string, unknown> {
	try {
		const parsed: unknown = JSON.parse(text);
		return isRecord(parsed) ? parsed : text;
	} catch {
		return text;
	}
}

interface ParsedSpeedPart {
	key: string;
	value: number | { number: number; condition: string };
}

function parseSpeedPart(part: string): ParsedSpeedPart | null {
	if (/^hover$/i.test(part)) return null;
	const match = part.match(
		/^(?:(walk|burrow|climb|fly|swim)\s+)?(\d+)\s*(?:ft\.?|feet)?\s*(.*)$/i,
	);
	if (!match) return null;

	const key = (match[1] || "walk").toLowerCase();
	const number = Number(match[2]);
	const condition = String(match[3] || "")
		.replace(/\(?\bhover\b\)?/gi, "")
		.trim();
	return {
		key,
		value: condition ? { number, condition } : number,
	};
}

export function parseSpeedText(value: unknown): string | Record<string, unknown> {
	const text = String(value || "").trim();
	if (!text) return "";
	if (text.startsWith("{")) return parseJsonSpeedText(text);

	const result: Record<string, unknown> = {};
	const canHover = /\bhover\b/i.test(text);
	const parts = text
		.split(/[,\n]/)
		.map((part) => part.trim())
		.filter(Boolean);

	for (const part of parts) {
		const parsed = parseSpeedPart(part);
		if (parsed) result[parsed.key] = parsed.value;
	}

	if (Object.keys(result).length === 0) return text;
	if (canHover) result.canHover = true;
	return result;
}

export function getCreatureEditableFieldInput(
	monster: MonsterData,
	key: CreatureEditableFieldKey,
): string {
	if (key === "ac") return getCreatureAcInput(monster);
	if (key === "hpFormula") return getCreatureHpFormulaInput(monster);
	if (key === "speed") return speedToText(monster.speed);
	if (key === "desc" && Array.isArray(monster.desc)) {
		return monster.desc
			.map((entry) =>
				typeof entry === "string" ? entry : JSON.stringify(entry),
			)
			.join("\n");
	}
	if (key === "type" && isRecord(monster.type)) {
		return getMonsterTypeString(monster.type);
	}
	if (
		key === "vulnerable" ||
		key === "resist" ||
		key === "immune" ||
		key === "conditionImmune"
	) {
		return new MonsterStatBlockModel(monster).formatDamageProperty(monster[key]) || "";
	}
	return listLikeValueToText(monster[key]);
}

export function getCreatureSelectValue(
	monster: MonsterData,
	key: "size" | "alignment",
): string {
	if (key === "size") {
		const value = Array.isArray(monster.size) ? monster.size[0] : monster.size;
		return String(value || "M");
	}
	const value = monster.alignment;
	return Array.isArray(value) ? value.join(" ") : String(value || "U");
}

function updateAc(monster: MonsterData, value: string): MonsterData {
	const parsed = parseMaybeNumber(value) ?? "";
	return { ...monster, ac: [parsed], armor_class: parsed };
}

function updateHpFormula(monster: MonsterData, value: string): MonsterData {
	const average = calculateDiceAverage(value);
	const currentHp = isRecord(monster.hp) ? monster.hp : {};
	const hp = { ...currentHp, formula: value };
	if (average === undefined) return { ...monster, hp, hit_dice: value };
	return { ...monster, hp: { ...hp, average }, hit_points: average, hit_dice: value };
}

function updateType(monster: MonsterData, value: string): MonsterData {
	const type = monster.type;
	if (isRecord(type) && isRecord(type.type) && Array.isArray(type.type.choose)) {
		return {
			...monster,
			type: {
				...(type as MonsterTypeDescriptor),
				type: { ...type.type, choose: splitTypeChoiceText(value) },
			},
		};
	}
	return {
		...monster,
		type: isRecord(type) ? { ...type, type: value } : value,
	};
}

function updateDefenseField(
	monster: MonsterData,
	key: CreatureDefenseFieldKey,
	value: string,
): MonsterData {
	const next = { ...monster };
	if (value.trim()) next[key] = value;
	else delete next[key];
	return next;
}

const FIELD_UPDATERS: Partial<
	Record<CreatureEditableFieldKey, (monster: MonsterData, value: string) => MonsterData>
> = {
	ac: updateAc,
	hpFormula: updateHpFormula,
	cr: (monster, value) => ({ ...monster, cr: value }),
	speed: (monster, value) => ({ ...monster, speed: parseSpeedText(value) }),
	senses: (monster, value) => ({
		...monster,
		senses: Array.isArray(monster.senses) ? splitListText(value) : value,
	}),
	languages: (monster, value) => ({
		...monster,
		languages: Array.isArray(monster.languages) ? splitListText(value) : value,
	}),
	vulnerable: (monster, value) =>
		updateDefenseField(monster, "vulnerable", value),
	resist: (monster, value) => updateDefenseField(monster, "resist", value),
	immune: (monster, value) => updateDefenseField(monster, "immune", value),
	conditionImmune: (monster, value) =>
		updateDefenseField(monster, "conditionImmune", value),
	size: (monster, value) => ({ ...monster, size: [value] }),
	alignment: (monster, value) => ({
		...monster,
		alignment: String(value || "").trim().split(/\s+/).filter(Boolean).length
			? String(value).trim().split(/\s+/).filter(Boolean)
			: ["U"],
	}),
	type: updateType,
	desc: (monster, value) => ({
		...monster,
		desc: Array.isArray(monster.desc)
			? String(value || "").trim()
				? [value]
				: []
			: value,
	}),
};

export function updateCreatureBasicField(
	monster: MonsterData,
	key: CreatureEditableFieldKey,
	value: string,
): MonsterData {
	if ((CREATURE_ABILITY_KEYS as readonly string[]).includes(key)) {
		return { ...monster, [key]: parseMaybeNumber(value) ?? "" };
	}
	const updater = FIELD_UPDATERS[key];
	return updater ? updater(monster, value) : { ...monster, [key]: value };
}

export function getMonsterActionList(
	monster: MonsterData,
	section: CreatureActionSection,
): MonsterEntry[] {
	const value = monster[section];
	return Array.isArray(value) ? (value as MonsterEntry[]) : [];
}

export function updateMonsterAction(
	monster: MonsterData,
	section: CreatureActionSection,
	index: number,
	updater: (action: MonsterEntry) => MonsterEntry,
): MonsterData {
	return {
		...monster,
		[section]: getMonsterActionList(monster, section).map((action, actionIndex) =>
			actionIndex === index ? updater(action || {}) : action,
		),
	};
}

export function addMonsterAction(
	monster: MonsterData,
	section: CreatureActionSection,
): MonsterData {
	return {
		...monster,
		[section]: [
			...getMonsterActionList(monster, section),
			{ name: "", entries: [""] },
		],
	};
}

export function removeMonsterAction(
	monster: MonsterData,
	section: CreatureActionSection,
	index: number,
): MonsterData {
	return {
		...monster,
		[section]: getMonsterActionList(monster, section).filter(
			(_action, actionIndex) => actionIndex !== index,
		),
	};
}

export function isRulesReferenceShortcut(event: {
	key?: string;
	ctrlKey?: boolean;
	metaKey?: boolean;
}): boolean {
	const key = String(event.key || "").toLowerCase();
	return Boolean((event.ctrlKey || event.metaKey) && (key === "k" || key === "л"));
}

export function insertRuleReferenceTag(
	value: string,
	target: RuleInsertSelection,
	tag: string,
): string {
	const start = Math.max(0, target.selectionStart || 0);
	const end = Math.max(start, target.selectionEnd || start);
	return value.slice(0, start) + tag + value.slice(end);
}

export function getRuleInsertValue(
	monster: MonsterData,
	target: RuleInsertTarget,
): string {
	if (target.type === "field") {
		return getCreatureEditableFieldInput(monster, target.key);
	}
	return actionEntriesToText(
		getMonsterActionList(monster, target.section)[target.index] || {},
	);
}

export function applyRuleReferenceTag(
	monster: MonsterData,
	target: RuleInsertTarget,
	tag: string,
): MonsterData {
	const nextValue = insertRuleReferenceTag(
		getRuleInsertValue(monster, target),
		target,
		tag,
	);
	if (target.type === "field") {
		return updateCreatureBasicField(monster, target.key, nextValue);
	}
	return updateMonsterAction(monster, target.section, target.index, (action) =>
		actionFromText(action, nextValue),
	);
}

export function parseMonsterJson(jsonText: string): JsonParseResult {
	try {
		const parsed: unknown = JSON.parse(jsonText);
		if (!isRecord(parsed)) return { ok: false, reason: "not-object", message: "" };
		return { ok: true, monster: parsed as MonsterData };
	} catch (error) {
		return {
			ok: false,
			reason: "invalid-json",
			message: error instanceof Error ? error.message : "",
		};
	}
}

export function prepareMonsterDraftForSave({
	draft,
	jsonText,
	editMode,
	source,
}: {
	draft: MonsterData;
	jsonText: string;
	editMode: MonsterEditMode;
	source?: string;
}): MonsterSaveResult {
	let nextDraft = draft;
	if (editMode === "json") {
		const parsed = parseMonsterJson(jsonText);
		if (!parsed.ok) return parsed;
		nextDraft = parsed.monster;
	}
	const name = String(nextDraft.name || "");
	if (!name.trim()) {
		return { ok: false, reason: "missing-name", message: "" };
	}
	return { ok: true, monster: { ...nextDraft, name, source } };
}
