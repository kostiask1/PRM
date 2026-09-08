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
	lower?: number | boolean;
	spells: unknown[];
}

export type MonsterSpellcastingPlacement =
	| "standalone"
	| "trait"
	| "bonus"
	| "action"
	| "reaction"
	| "legendary";

export interface MonsterSpellcastingEntry {
	name: string;
	headerEntries?: unknown[];
	footerEntries?: unknown[];
	will?: unknown[];
	daily?: Record<string, unknown[]>;
	rest?: Record<string, unknown[]>;
	restLong?: Record<string, unknown[]>;
	recharge?: Record<string, unknown[]>;
	legendary?: Record<string, unknown[]>;
	charges?: Record<string, unknown[]>;
	ritual?: unknown[];
	spells?: Record<string, MonsterSpellLevel>;
	displayAs?: string;
	hidden?: string[];
	chargesItem?: string;
}

export interface MonsterSpellcastingPlacementGroups {
	standalone: MonsterSpellcastingEntry[];
	trait: MonsterSpellcastingEntry[];
	bonus: MonsterSpellcastingEntry[];
	action: MonsterSpellcastingEntry[];
	reaction: MonsterSpellcastingEntry[];
	legendary: MonsterSpellcastingEntry[];
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
	restLines?: MonsterSpellContentLinePlan[];
	restLongLines?: MonsterSpellContentLinePlan[];
	rechargeLines?: MonsterSpellContentLinePlan[];
	legendaryLines?: MonsterSpellContentLinePlan[];
	chargesLines?: MonsterSpellContentLinePlan[];
	ritualLine?: MonsterSpellContentLinePlan | null;
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

function readStringArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const values = value.filter((entry): entry is string => typeof entry === "string");
	return values.length > 0 ? values : undefined;
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
		if (typeof rawInfo.lower === "number" || typeof rawInfo.lower === "boolean") {
			info.lower = rawInfo.lower;
		}
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
		const rest = readUnknownArrayRecord(rawEntry.rest);
		const restLong = readUnknownArrayRecord(rawEntry.restLong);
		const recharge = readUnknownArrayRecord(rawEntry.recharge);
		const legendary = readUnknownArrayRecord(rawEntry.legendary);
		const charges = readUnknownArrayRecord(rawEntry.charges);
		const ritual = readUnknownArray(rawEntry.ritual);
		const displayAs = readString(rawEntry.displayAs);
		const hidden = readStringArray(rawEntry.hidden);
		const chargesItem = readString(rawEntry.chargesItem);
		return [{
			name: readString(rawEntry.name),
			headerEntries: readUnknownArray(rawEntry.headerEntries),
			footerEntries: readUnknownArray(rawEntry.footerEntries),
			will: readUnknownArray(rawEntry.will),
			daily: readUnknownArrayRecord(rawEntry.daily),
			spells: readSpellLevelRecord(rawEntry.spells),
			...(rest ? { rest } : {}),
			...(restLong ? { restLong } : {}),
			...(recharge ? { recharge } : {}),
			...(legendary ? { legendary } : {}),
			...(charges ? { charges } : {}),
			...(ritual ? { ritual } : {}),
			...(displayAs ? { displayAs } : {}),
			...(hidden ? { hidden } : {}),
			...(chargesItem ? { chargesItem } : {}),
		}];
	});
}

function getOptionalSpellContent(value: unknown[] | undefined): unknown[] | null {
	return value ?? null;
}

function getVisibleSpellValues(values: unknown[]): unknown[] {
	const hasHiddenValues = values.some(
		(value) => isRecord(value) && value.hidden === true,
	);
	return hasHiddenValues
		? values.filter((value) => !isRecord(value) || value.hidden !== true)
		: values;
}

function createSpellContentLine(
	key: string,
	label: string,
	values: unknown[],
): MonsterSpellContentLinePlan | null {
	const visibleValues = getVisibleSpellValues(values);
	if (values.length > 0 && visibleValues.length === 0) return null;
	return { key, label, values: visibleValues };
}

function getMonsterSpellcastingPlacement(
	displayAs: string | undefined,
): MonsterSpellcastingPlacement {
	switch (displayAs?.trim().toLowerCase()) {
		case "trait":
		case "bonus":
		case "action":
		case "reaction":
		case "legendary":
			return displayAs.trim().toLowerCase() as MonsterSpellcastingPlacement;
		default:
			return "standalone";
	}
}

export function groupMonsterSpellcastingEntriesByDisplayAs(
	entries: MonsterSpellcastingEntry[],
): MonsterSpellcastingPlacementGroups {
	const groups: MonsterSpellcastingPlacementGroups = {
		standalone: [],
		trait: [],
		bonus: [],
		action: [],
		reaction: [],
		legendary: [],
	};
	for (const entry of entries) {
		groups[getMonsterSpellcastingPlacement(entry.displayAs)].push(entry);
	}
	return groups;
}

function isMonsterSpellcastingPartHidden(
	entry: MonsterSpellcastingEntry,
	part: string,
): boolean {
	const normalizedPart = part.toLowerCase();
	return Boolean(
		entry.hidden?.some((value) => value.trim().toLowerCase() === normalizedPart),
	);
}

interface SpellUseKey {
	amount: string;
	each: boolean;
}

function parseSpellUseKey(value: string): SpellUseKey {
	const normalized = value.trim();
	const each = normalized.toLowerCase().endsWith("e");
	return {
		amount: each ? normalized.slice(0, -1) : normalized,
		each,
	};
}

function getPeriodSpellLabel(
	frequency: string,
	period: string,
): string {
	const { amount, each } = parseSpellUseKey(frequency);
	if (amount.includes("/")) return `${amount}${each ? " each" : ""}`;
	return `${amount}/${period}${each ? " each" : ""}`;
}

function getMonsterDailySpellLines(
	daily: Record<string, unknown[]> | undefined,
): MonsterSpellContentLinePlan[] {
	if (!daily) return [];
	return Object.entries(daily).flatMap(([frequency, values]) => {
		const line = createSpellContentLine(
			frequency,
			getPeriodSpellLabel(frequency, "day"),
			values,
		);
		return line ? [line] : [];
	});
}

function getMonsterRestSpellLines(
	rest: Record<string, unknown[]> | undefined,
	period: "rest" | "long rest",
): MonsterSpellContentLinePlan[] {
	if (!rest) return [];
	return Object.entries(rest).flatMap(([frequency, values]) => {
		const line = createSpellContentLine(
			frequency,
			getPeriodSpellLabel(frequency, period),
			values,
		);
		return line ? [line] : [];
	});
}

function getMonsterRechargeSpellLines(
	recharge: Record<string, unknown[]> | undefined,
): MonsterSpellContentLinePlan[] {
	if (!recharge) return [];
	return Object.entries(recharge).flatMap(([threshold, values]) => {
		const normalizedThreshold = threshold.trim();
		const numericThreshold = Number(normalizedThreshold);
		const range = Number.isFinite(numericThreshold) && numericThreshold < 6
			? `${normalizedThreshold}–6`
			: normalizedThreshold;
		const line = createSpellContentLine(
			threshold,
			`Recharge ${range}`,
			values,
		);
		return line ? [line] : [];
	});
}

function getMonsterLegendarySpellLines(
	legendary: Record<string, unknown[]> | undefined,
): MonsterSpellContentLinePlan[] {
	if (!legendary) return [];
	return Object.entries(legendary).flatMap(([cost, values]) => {
		const { amount, each } = parseSpellUseKey(cost);
		const line = createSpellContentLine(
			cost,
			`${amount} Legendary Action${amount === "1" ? "" : "s"}${each ? " each" : ""}`,
			values,
		);
		return line ? [line] : [];
	});
}

function getMonsterChargeSpellLines(
	charges: Record<string, unknown[]> | undefined,
	chargesItem: string | undefined,
): MonsterSpellContentLinePlan[] {
	if (!charges) return [];
	const itemName = chargesItem?.split("|")[0]?.trim();
	return Object.entries(charges).flatMap(([cost, values]) => {
		const { amount, each } = parseSpellUseKey(cost);
		const unit = amount === "1" ? "charge" : "charges";
		const line = createSpellContentLine(
			cost,
			`${amount} ${unit}${each ? " each" : ""}${itemName ? ` — ${itemName}` : ""}`,
			values,
		);
		return line ? [line] : [];
	});
}

function getMonsterSpellLevelLabel(
	level: string,
	slots: number | undefined,
	lower: number | boolean | undefined,
): string {
	let levelLabel = level === "0" ? "Cantrips" : `Level ${level}`;
	if (lower === true) {
		levelLabel = `${levelLabel} or lower`;
	} else if (typeof lower === "number" && String(lower) !== level) {
		levelLabel = lower === 0
			? `Cantrips–Level ${level}`
			: `Levels ${lower}–${level}`;
	}
	const slotsLabel = slots ? `(${slots} slots)` : "";
	return `${levelLabel} ${slotsLabel}`.trim();
}

function getMonsterSpellLevelLines(
	spells: Record<string, MonsterSpellLevel> | undefined,
): MonsterSpellContentLinePlan[] {
	if (!spells) return [];
	return Object.entries(spells).flatMap(([level, info]) => {
		const line = createSpellContentLine(
			level,
			getMonsterSpellLevelLabel(level, info.slots, info.lower),
			info.spells,
		);
		return line ? [line] : [];
	});
}

export function getMonsterSpellcastingEntryPresentation(
	entry: MonsterSpellcastingEntry,
): MonsterSpellcastingEntryPresentation {
	const presentation: MonsterSpellcastingEntryPresentation = {
		headerEntries: isMonsterSpellcastingPartHidden(entry, "headerEntries")
			? null
			: getOptionalSpellContent(entry.headerEntries),
		willLine: entry.will && !isMonsterSpellcastingPartHidden(entry, "will")
			? createSpellContentLine("will", "At will", entry.will)
			: null,
		dailyLines: isMonsterSpellcastingPartHidden(entry, "daily")
			? []
			: getMonsterDailySpellLines(entry.daily),
		spellLines: isMonsterSpellcastingPartHidden(entry, "spells")
			? []
			: getMonsterSpellLevelLines(entry.spells),
		footerEntries: isMonsterSpellcastingPartHidden(entry, "footerEntries")
			? null
			: getOptionalSpellContent(entry.footerEntries),
	};
	if (entry.rest) {
		presentation.restLines = isMonsterSpellcastingPartHidden(entry, "rest")
			? []
			: getMonsterRestSpellLines(entry.rest, "rest");
	}
	if (entry.restLong) {
		presentation.restLongLines = isMonsterSpellcastingPartHidden(entry, "restLong")
			? []
			: getMonsterRestSpellLines(entry.restLong, "long rest");
	}
	if (entry.recharge) {
		presentation.rechargeLines = isMonsterSpellcastingPartHidden(entry, "recharge")
			? []
			: getMonsterRechargeSpellLines(entry.recharge);
	}
	if (entry.legendary) {
		presentation.legendaryLines = isMonsterSpellcastingPartHidden(entry, "legendary")
			? []
			: getMonsterLegendarySpellLines(entry.legendary);
	}
	if (entry.charges) {
		presentation.chargesLines = isMonsterSpellcastingPartHidden(entry, "charges")
			? []
			: getMonsterChargeSpellLines(entry.charges, entry.chargesItem);
	}
	if (entry.ritual) {
		presentation.ritualLine = isMonsterSpellcastingPartHidden(entry, "ritual")
			? null
			: createSpellContentLine("ritual", "Rituals", entry.ritual);
	}
	return presentation;
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
