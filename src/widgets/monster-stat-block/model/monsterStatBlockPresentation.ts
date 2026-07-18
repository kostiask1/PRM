import type {
	BestiaryMonster,
	MonsterEntry,
} from "../../../entities/bestiary/index.js";
import type { SpellRecord } from "../../../entities/spell/index.js";

const SENSE_NAME_REGEX = /\b(blindsight|darkvision|tremorsense|truesight)\b/gi;

export interface MonsterHighlightFields {
	fields?: string[];
}

export interface LoadedMonsterSpell extends SpellRecord {
	slug?: string;
	level_int?: number;
}

export interface SpellLevelGroup {
	level: string;
	spells: LoadedMonsterSpell[];
}

export interface MonsterSpellLevel {
	slots?: number;
	spells: unknown[];
}

export interface MonsterSpellcastingEntry {
	name: string;
	headerEntries?: unknown[];
	footerEntries?: unknown[];
	will?: unknown[];
	daily?: Record<string, unknown[]>;
	spells?: Record<string, MonsterSpellLevel>;
}

export type SenseTextPart =
	| { kind: "text"; text: string }
	| { kind: "reference"; name: string };

export interface MonsterTokenSources {
	customTokenSrc: string;
	localSrc: string;
	externalSrc: string;
	isCustomMonster: boolean;
}

export interface MonsterTokenVisibilityInput {
	allowTokenUpload: boolean;
	hasImageError: boolean;
	isReplacingToken: boolean;
	localSrc: string;
	isCustomMonster: boolean;
	hasTokenImageChange: boolean;
}

export interface TokenDragPayload {
	uri: string;
	html: string;
	downloadUrl: string;
}

export type SpellSearch = (
	params: { name: string },
) => Promise<SpellRecord[] | null>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function readUnknownArray(value: unknown): unknown[] | undefined {
	return Array.isArray(value) ? value : undefined;
}

function readUnknownArrayRecord(
	value: unknown,
): Record<string, unknown[]> | undefined {
	if (!isRecord(value)) return undefined;
	const entries = Object.entries(value).filter((entry): entry is [string, unknown[]] =>
		Array.isArray(entry[1]),
	);
	return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function readSpellLevelRecord(
	value: unknown,
): Record<string, MonsterSpellLevel> | undefined {
	if (!isRecord(value)) return undefined;
	const entries = Object.entries(value).flatMap(([level, rawInfo]) => {
		if (!isRecord(rawInfo) || !Array.isArray(rawInfo.spells)) return [];
		const info: MonsterSpellLevel = { spells: rawInfo.spells };
		if (typeof rawInfo.slots === "number") info.slots = rawInfo.slots;
		return [[level, info] as const];
	});
	return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function getMonsterEntries(value: unknown): MonsterEntry[] {
	return Array.isArray(value)
		? value.filter((entry): entry is MonsterEntry => isRecord(entry))
		: [];
}

export function getMonsterContentArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

export function getMonsterSpellcastingEntries(
	value: unknown,
): MonsterSpellcastingEntry[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((rawEntry) => {
		if (!isRecord(rawEntry)) return [];
		return [{
			name: readString(rawEntry.name),
			headerEntries: readUnknownArray(rawEntry.headerEntries),
			footerEntries: readUnknownArray(rawEntry.footerEntries),
			will: readUnknownArray(rawEntry.will),
			daily: readUnknownArrayRecord(rawEntry.daily),
			spells: readSpellLevelRecord(rawEntry.spells),
		}];
	});
}

export function getChangedFieldClass(
	highlightFields: MonsterHighlightFields | null | undefined,
	fields: string[],
): string {
	const highlighted = new Set(highlightFields?.fields ?? []);
	return fields.some((field) => highlighted.has(field))
		? "is_ai_changed_field"
		: "";
}

export function getSenseTextParts(text: string): SenseTextPart[] {
	const parts: SenseTextPart[] = [];
	let lastIndex = 0;
	SENSE_NAME_REGEX.lastIndex = 0;
	for (const match of text.matchAll(SENSE_NAME_REGEX)) {
		const start = match.index;
		if (start > lastIndex) {
			parts.push({ kind: "text", text: text.slice(lastIndex, start) });
		}
		const name = match[1];
		parts.push({ kind: "reference", name });
		lastIndex = start + name.length;
	}
	if (lastIndex < text.length) {
		parts.push({ kind: "text", text: text.slice(lastIndex) });
	}
	return parts;
}

export function getMonsterSpellSlug(url: unknown): string {
	return readString(url).split("/").filter(Boolean).at(-1) ?? "";
}

export async function loadMonsterSpells(
	spellUrls: unknown,
	searchSpells: SpellSearch,
	cache: Map<string, LoadedMonsterSpell>,
): Promise<LoadedMonsterSpell[]> {
	if (!Array.isArray(spellUrls)) return [];
	const loaded = await Promise.all(
		spellUrls.map(async (url): Promise<LoadedMonsterSpell | null> => {
			const slug = getMonsterSpellSlug(url);
			if (!slug) return null;
			const cached = cache.get(slug);
			if (cached) return cached;
			const results = await searchSpells({ name: slug });
			const spell = results?.find(
				(item): item is LoadedMonsterSpell =>
					Boolean(item && typeof item.name === "string"),
			) ?? null;
			if (spell) cache.set(slug, spell);
			return spell;
		}),
	);
	return loaded.filter((spell): spell is LoadedMonsterSpell => Boolean(spell));
}

function getSpellLevel(spell: LoadedMonsterSpell): number {
	if (typeof spell.level_int === "number") return spell.level_int;
	return typeof spell.level === "number" ? spell.level : 0;
}

export function groupMonsterSpellsByLevel(
	spells: LoadedMonsterSpell[],
): SpellLevelGroup[] {
	const groups = new Map<number, LoadedMonsterSpell[]>();
	for (const spell of spells) {
		const level = getSpellLevel(spell);
		groups.set(level, [...(groups.get(level) ?? []), spell]);
	}
	return [...groups.entries()]
		.sort(([left], [right]) => left - right)
		.map(([level, levelSpells]) => ({
			level: String(level),
			spells: levelSpells,
		}));
}

function getMonsterImageUrl(monster: BestiaryMonster): string {
	return readString(monster.imageUrl);
}

export function getMonsterTokenSources(
	monster: BestiaryMonster,
	customTokenUrl: string,
	tokenImageOverrideUrl: string | null,
	modelLocalSrc: string,
	modelExternalSrc: string,
): MonsterTokenSources {
	const customTokenSrc = customTokenUrl || getMonsterImageUrl(monster);
	const override = tokenImageOverrideUrl ?? "";
	return {
		customTokenSrc,
		localSrc: customTokenSrc || override || modelLocalSrc,
		externalSrc: customTokenSrc || override || modelExternalSrc,
		isCustomMonster: readString(monster.source).toUpperCase() === "CUSTOM",
	};
}

export function shouldShowMonsterTokenDropzone(
	input: MonsterTokenVisibilityInput,
): boolean {
	if (!input.allowTokenUpload) return false;
	if (!input.isCustomMonster && !input.hasTokenImageChange) return false;
	return input.isReplacingToken || !input.localSrc || input.hasImageError;
}

export function getUploadedTokenUrl(result: unknown): string {
	return isRecord(result) ? readString(result.url) : "";
}

export function getMonsterMutationKey(
	monster: BestiaryMonster,
	effectiveName: string,
): string {
	return String(monster.id ?? effectiveName ?? monster.name);
}

export function getTokenDragPayload(
	externalSrc: string,
	monsterName: string,
	effectiveName: string,
): TokenDragPayload | null {
	if (!externalSrc) return null;
	return {
		uri: externalSrc,
		html: `<img src="${externalSrc}" alt="${monsterName}">`,
		downloadUrl: `image/webp:${effectiveName}.webp:${externalSrc}`,
	};
}
