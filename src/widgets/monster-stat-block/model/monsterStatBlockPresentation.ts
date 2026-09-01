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

export interface MonsterSpellContentLinePlan {
	key: string;
	label: string;
	values: unknown[];
}

export interface MonsterSpellcastingEntryPresentation {
	headerEntries: unknown[] | null;
	willLine: MonsterSpellContentLinePlan | null;
	dailyLines: MonsterSpellContentLinePlan[];
	spellLines: MonsterSpellContentLinePlan[];
	footerEntries: unknown[] | null;
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

export type MonsterTokenSectionMode = "dropzone" | "image" | "skeleton";

export interface MonsterTokenSectionPresentationInput {
	showDropzone: boolean;
	hasImageError: boolean;
	allowTokenUpload: boolean;
	customTokenSrc: string;
	isCustomMonster: boolean;
	hasTokenImageChange: boolean;
}

export interface MonsterTokenSectionPresentation {
	mode: MonsterTokenSectionMode;
	showCancelReplace: boolean;
	showReplaceAction: boolean;
}

export interface MonsterNameRowPresentationInput {
	name: unknown;
	hasNameAction: boolean;
	showFavoriteAction: boolean;
	isFavorite: boolean;
	hasAiAction: boolean;
	hasFieldEditAction: boolean;
	hasDeleteAction: boolean;
	showAddToEncounterAction: boolean;
}

export interface MonsterNameRowPresentation {
	name: string;
	useNameAction: boolean;
	showFavoriteAction: boolean;
	favoriteTitle: "Remove from favorites" | "Add to favorites";
	favoriteActive: boolean;
	showAiAction: boolean;
	showFieldEditAction: boolean;
	showDeleteAction: boolean;
	showAddToEncounterAction: boolean;
}

export type MonsterAction = (monster: BestiaryMonster) => void;

export interface MonsterMetadataPresentation {
	originalName: string;
	showOriginalName: boolean;
	showSource: boolean;
}

export interface ExecuteMonsterTokenUploadOptions {
	result: unknown;
	monster: BestiaryMonster;
	effectiveName: string;
	onTokenImageChange?: (monster: BestiaryMonster, imageUrl: string) => void;
	persist(
		mutationKey: string,
		payload: { imageUrl: string },
	): Promise<BestiaryMonster | null | undefined>;
	onTokenUrl(imageUrl: string): void;
	onImageError(hasError: boolean): void;
	onReplacing(isReplacing: boolean): void;
	onPersistenceError(error: unknown): void;
}

export type MonsterTokenUploadOutcome =
	| { status: "skipped" }
	| { status: "succeeded"; mode: "injected" | "persisted"; imageUrl: string }
	| { status: "failed"; error: unknown; imageUrl: string };

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

function getOptionalSpellContent(value: unknown[] | undefined): unknown[] | null {
	return value ?? null;
}

function getMonsterDailySpellLines(
	daily: Record<string, unknown[]> | undefined,
): MonsterSpellContentLinePlan[] {
	if (!daily) return [];
	return Object.entries(daily).map(([frequency, values]) => ({
		key: frequency,
		label: `${frequency} each`,
		values,
	}));
}

function getMonsterSpellLevelLabel(level: string, slots: number | undefined): string {
	const levelLabel = level === "0" ? "Cantrips" : `Level ${level}`;
	const slotsLabel = slots ? `(${slots} slots)` : "";
	return `${levelLabel} ${slotsLabel}`.trim();
}

function getMonsterSpellLevelLines(
	spells: Record<string, MonsterSpellLevel> | undefined,
): MonsterSpellContentLinePlan[] {
	if (!spells) return [];
	return Object.entries(spells).map(([level, info]) => ({
		key: level,
		label: getMonsterSpellLevelLabel(level, info.slots),
		values: info.spells,
	}));
}

export function getMonsterSpellcastingEntryPresentation(
	entry: MonsterSpellcastingEntry,
): MonsterSpellcastingEntryPresentation {
	return {
		headerEntries: getOptionalSpellContent(entry.headerEntries),
		willLine: entry.will
			? { key: "will", label: "At will", values: entry.will }
			: null,
		dailyLines: getMonsterDailySpellLines(entry.daily),
		spellLines: getMonsterSpellLevelLines(entry.spells),
		footerEntries: getOptionalSpellContent(entry.footerEntries),
	};
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

function getFirstTruthyTokenSource(...sources: string[]): string {
	return sources.find(Boolean) ?? "";
}

function isExactCustomMonsterSource(monster: BestiaryMonster): boolean {
	return readString(monster.source).toUpperCase() === "CUSTOM";
}

export function getMonsterTokenSources(
	monster: BestiaryMonster,
	customTokenUrl: string,
	tokenImageOverrideUrl: string | null,
	modelLocalSrc: string,
	modelExternalSrc: string,
): MonsterTokenSources {
	const customTokenSrc = getFirstTruthyTokenSource(
		customTokenUrl,
		getMonsterImageUrl(monster),
	);
	const override = tokenImageOverrideUrl ?? "";
	return {
		customTokenSrc,
		localSrc: getFirstTruthyTokenSource(customTokenSrc, override, modelLocalSrc),
		externalSrc: getFirstTruthyTokenSource(
			customTokenSrc,
			override,
			modelExternalSrc,
		),
		isCustomMonster: isExactCustomMonsterSource(monster),
	};
}

export function shouldShowMonsterTokenDropzone(
	input: MonsterTokenVisibilityInput,
): boolean {
	return canManageMonsterToken(input) && needsMonsterTokenDropzone(input);
}

function canManageMonsterToken(input: MonsterTokenVisibilityInput): boolean {
	return (
		input.allowTokenUpload &&
		(input.isCustomMonster || input.hasTokenImageChange)
	);
}

function needsMonsterTokenDropzone(input: MonsterTokenVisibilityInput): boolean {
	return input.isReplacingToken || !input.localSrc || input.hasImageError;
}

function getMonsterTokenSectionMode(
	showDropzone: boolean,
	hasImageError: boolean,
): MonsterTokenSectionMode {
	if (showDropzone) return "dropzone";
	return hasImageError ? "skeleton" : "image";
}

function shouldShowMonsterTokenCancel(
	input: MonsterTokenSectionPresentationInput,
	mode: MonsterTokenSectionMode,
): boolean {
	return mode === "dropzone" && Boolean(input.customTokenSrc) && !input.hasImageError;
}

function shouldShowMonsterTokenReplace(
	input: MonsterTokenSectionPresentationInput,
	mode: MonsterTokenSectionMode,
): boolean {
	return (
		mode === "image" &&
		input.allowTokenUpload &&
		(input.isCustomMonster || input.hasTokenImageChange)
	);
}

export function getMonsterTokenSectionPresentation(
	input: MonsterTokenSectionPresentationInput,
): MonsterTokenSectionPresentation {
	const mode = getMonsterTokenSectionMode(
		input.showDropzone,
		input.hasImageError,
	);
	return {
		mode,
		showCancelReplace: shouldShowMonsterTokenCancel(input, mode),
		showReplaceAction: shouldShowMonsterTokenReplace(input, mode),
	};
}

export function getMonsterNameRowPresentation(
	input: MonsterNameRowPresentationInput,
): MonsterNameRowPresentation {
	return {
		name: String(input.name ?? ""),
		useNameAction: input.hasNameAction,
		showFavoriteAction: input.showFavoriteAction,
		favoriteTitle: input.isFavorite
			? "Remove from favorites"
			: "Add to favorites",
		favoriteActive: input.isFavorite,
		showAiAction: input.hasAiAction,
		showFieldEditAction: input.hasFieldEditAction,
		showDeleteAction: input.hasDeleteAction,
		showAddToEncounterAction: input.showAddToEncounterAction,
	};
}

export function executeMonsterAction(
	action: MonsterAction | null | undefined,
	monster: BestiaryMonster,
): void {
	action?.(monster);
}

export function getMonsterMetadataPresentation(
	monster: BestiaryMonster,
	sourceLabel: string,
): MonsterMetadataPresentation {
	const name = String(monster.name ?? "");
	const originalName = readString(monster.originalBestiaryName);
	const visibleOriginalName = originalName !== name ? originalName : "";
	return {
		originalName: visibleOriginalName,
		showOriginalName: Boolean(visibleOriginalName),
		showSource: Boolean(sourceLabel),
	};
}

export function getUploadedTokenUrl(result: unknown): string {
	return isRecord(result) ? readString(result.url) : "";
}

function getPersistedMonsterTokenUrl(
	updatedMonster: BestiaryMonster | null | undefined,
	fallbackUrl: string,
): string {
	if (!updatedMonster) return fallbackUrl;
	return readString(updatedMonster.imageUrl) || fallbackUrl;
}

async function persistMonsterTokenUpload(
	options: ExecuteMonsterTokenUploadOptions,
	nextUrl: string,
): Promise<MonsterTokenUploadOutcome> {
	try {
		const updatedMonster = await options.persist(
			getMonsterMutationKey(options.monster, options.effectiveName),
			{ imageUrl: nextUrl },
		);
		const persistedUrl = getPersistedMonsterTokenUrl(updatedMonster, nextUrl);
		options.onTokenUrl(persistedUrl);
		options.onReplacing(false);
		return { status: "succeeded", mode: "persisted", imageUrl: persistedUrl };
	} catch (error) {
		options.onPersistenceError(error);
		return { status: "failed", error, imageUrl: nextUrl };
	}
}

export async function executeMonsterTokenUpload(
	options: ExecuteMonsterTokenUploadOptions,
): Promise<MonsterTokenUploadOutcome> {
	const nextUrl = getUploadedTokenUrl(options.result);
	if (!nextUrl) return { status: "skipped" };
	options.onTokenUrl(nextUrl);
	options.onImageError(false);
	if (options.onTokenImageChange) {
		options.onTokenImageChange(options.monster, nextUrl);
		options.onReplacing(false);
		return { status: "succeeded", mode: "injected", imageUrl: nextUrl };
	}
	return persistMonsterTokenUpload(options, nextUrl);
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
