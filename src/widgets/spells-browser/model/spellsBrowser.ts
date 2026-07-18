import type { SpellRecord } from "../../../entities/spell/index.js";
import { normalizeSourceCode } from "../../../entities/reference/model.js";
import type { CampaignSourceSettings } from "../../../entities/reference/model.js";

export const SPELL_SCHOOL_NAMES = {
	A: "Abjuration",
	C: "Conjuration",
	D: "Divination",
	E: "Enchantment",
	I: "Illusion",
	N: "Necromancy",
	P: "Transmutation",
	T: "Thaumaturgy",
	V: "Evocation",
} as const;

export type SpellSchoolCode = keyof typeof SPELL_SCHOOL_NAMES;
export type SpellSortOrder = "none" | "asc" | "desc";

export interface SpellReferenceKey {
	name: string;
	source: string;
}

export interface SpellBrowserFilters {
	search: string;
	detailedSearch: boolean;
	selectedLevel: string;
	selectedClass: string;
	selectedSchool: string;
	selectedSources: readonly string[];
	sourceFilter: string;
}

export interface SpellSearchMatcher {
	(value: unknown, query: string): boolean;
}

export interface SpellSelectionPlan {
	spell: SpellRecord | null;
	changed: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function normalizeStringList(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

export function normalizeSpellList(value: unknown): SpellRecord[] {
	return Array.isArray(value)
		? value.filter((spell): spell is SpellRecord => isRecord(spell) && typeof spell.name === "string")
		: [];
}

export function normalizeCampaignSourceSettings(value: unknown): CampaignSourceSettings | null {
	return isRecord(value) ? { ignoreSourcesList: normalizeStringList(value.ignoreSourcesList) } : null;
}

export function getSpellItemKey(spell: SpellRecord): string {
	return `${spell.source ?? ""}:${spell.name}`;
}

export function parseSpellReferenceKey(value: unknown): SpellReferenceKey {
	const [name = "", source = ""] = String(value ?? "").split("|");
	return { name: name.trim(), source: source.trim() };
}

export function spellMatchesReferenceKey(spell: SpellRecord | null | undefined, value: unknown): boolean {
	const reference = parseSpellReferenceKey(value);
	return Boolean(spell?.name && spell.name === reference.name && (!reference.source || spell.source === reference.source));
}

export function getSpellListIndex(spells: readonly SpellRecord[], selectedSpell: SpellRecord | null): number {
	if (!selectedSpell?.name) return -1;
	return spells.findIndex((spell) => spell.name === selectedSpell.name && spell.source === selectedSpell.source);
}

export function findSpellByReference(spells: readonly SpellRecord[], value: unknown): SpellRecord | null {
	const reference = parseSpellReferenceKey(value);
	if (!reference.name) return null;
	return spells.find((spell) => spell.name === reference.name && (!reference.source || spell.source === reference.source)) ?? null;
}

export function getNextSpellSortOrder(order: SpellSortOrder): SpellSortOrder {
	if (order === "none") return "desc";
	if (order === "desc") return "asc";
	return "none";
}

export function sortSpells(spells: readonly SpellRecord[], order: SpellSortOrder): SpellRecord[] {
	if (order === "none") return [...spells];
	return [...spells].sort((left, right) => {
		const levelDifference = (left.level ?? 0) - (right.level ?? 0);
		if (levelDifference === 0) return left.name.localeCompare(right.name);
		return order === "asc" ? levelDifference : -levelDifference;
	});
}

export function getSpellClassOptions(spells: readonly SpellRecord[]): string[] {
	return [...new Set(spells.flatMap((spell) => normalizeStringList(spell.classes)))].sort((left, right) => left.localeCompare(right));
}

export function isSpellSchoolCode(value: unknown): value is SpellSchoolCode {
	return typeof value === "string" && value in SPELL_SCHOOL_NAMES;
}

export function getSpellSchoolOptions(spells: readonly SpellRecord[]): SpellSchoolCode[] {
	return [...new Set(spells.map((spell) => spell.school).filter(isSpellSchoolCode))]
		.sort((left, right) => SPELL_SCHOOL_NAMES[left].localeCompare(SPELL_SCHOOL_NAMES[right]));
}

export function filterSpells(
	spells: readonly SpellRecord[],
	filters: SpellBrowserFilters,
	detailedMatcher: SpellSearchMatcher,
): SpellRecord[] {
	const selectedSourceSet = new Set(filters.selectedSources.map(normalizeSourceCode));
	const normalizedSourceFilter = normalizeSourceCode(filters.sourceFilter);
	const normalizedSearch = filters.search.trim().toLowerCase();
	return spells.filter((spell) => [
		selectedSourceSet.has(normalizeSourceCode(spell.source)),
		matchesSourceFilter(spell, filters.sourceFilter, normalizedSourceFilter),
		matchesLevelFilter(spell, filters.selectedLevel),
		matchesClassFilter(spell, filters.selectedClass),
		matchesSchoolFilter(spell, filters.selectedSchool),
		matchesSearchFilter(spell, normalizedSearch, filters.detailedSearch, detailedMatcher),
	].every(Boolean));
}

function matchesSourceFilter(spell: SpellRecord, sourceFilter: string, normalizedSourceFilter: string): boolean {
	return sourceFilter === "all" || normalizeSourceCode(spell.source) === normalizedSourceFilter;
}

function matchesLevelFilter(spell: SpellRecord, selectedLevel: string): boolean {
	return selectedLevel === "all" || String(spell.level) === selectedLevel;
}

function matchesClassFilter(spell: SpellRecord, selectedClass: string): boolean {
	return selectedClass === "all" || normalizeStringList(spell.classes).includes(selectedClass);
}

function matchesSchoolFilter(spell: SpellRecord, selectedSchool: string): boolean {
	return selectedSchool === "all" || spell.school === selectedSchool;
}

function matchesSearchFilter(spell: SpellRecord, search: string, detailed: boolean, matcher: SpellSearchMatcher): boolean {
	if (!search) return true;
	return detailed ? matcher(spell, search) : spell.name.toLowerCase().includes(search);
}

function resolveInitialSpellTarget(
	displayedSpells: readonly SpellRecord[],
	allSpells: readonly SpellRecord[],
	initialSelectedName: unknown,
	currentSpell: SpellRecord | null,
): SpellRecord | null {
	const displayedTarget = findSpellByReference(displayedSpells, initialSelectedName);
	if (displayedTarget) return displayedTarget;
	const allTarget = findSpellByReference(allSpells, initialSelectedName);
	if (allTarget) return allTarget;
	return currentSpell ? null : displayedSpells[0] ?? null;
}

function isSameSpellIdentity(left: SpellRecord, right: SpellRecord | null): boolean {
	return left.name === right?.name && left.source === right?.source;
}

export function getInitialSpellSelection(
	displayedSpells: readonly SpellRecord[],
	allSpells: readonly SpellRecord[],
	initialSelectedName: unknown,
	currentSpell: SpellRecord | null,
): SpellSelectionPlan {
	const target = resolveInitialSpellTarget(displayedSpells, allSpells, initialSelectedName, currentSpell);
	if (!target) return { spell: currentSpell, changed: false };
	const changed = !isSameSpellIdentity(target, currentSpell);
	return { spell: changed ? target : currentSpell, changed };
}

export function getValidSourceFilter(sourceFilter: string, selectedSources: readonly string[]): string {
	if (sourceFilter === "all") return sourceFilter;
	const selected = new Set(selectedSources.map(normalizeSourceCode));
	return selected.has(normalizeSourceCode(sourceFilter)) ? sourceFilter : "all";
}

export function getSettingsIgnoreSources(value: unknown): string[] {
	return isRecord(value) ? normalizeStringList(value.ignoreSourcesList) : [];
}

export function getErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}
