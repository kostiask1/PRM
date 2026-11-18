import type { SpellRecord } from "../../../entities/spell/index.js";
import { normalizeSourceCode } from "../../../entities/reference/model.js";
import type { CampaignSourceSettings } from "../../../entities/reference/model.js";
import { rankSearchResultsByName } from "../../../shared/lib/index.js";

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

export interface InitialSpellScrollPlan {
	scrollKey: string;
	selectedIndex: number;
}

export type SpellBrowserTranslate = (
	template: string,
	variables?: Record<string, unknown>,
) => string;

export interface SpellListItemPresentationOptions {
	selected: boolean;
	capitalizeName(name: string): string;
	resolveSourceName(source: unknown): string;
	translate: SpellBrowserTranslate;
}

export interface SpellListItemPresentation {
	itemKey: string;
	displayName: string;
	levelLabel: string;
	schoolName: string;
	showSchool: boolean;
	classesLabel: string;
	showClasses: boolean;
	source: string;
	sourceFullName: string;
	showSource: boolean;
	disableSourceTooltip: boolean;
	active: boolean;
	nextSelection: SpellRecord | null;
}

export type SpellInsertAction = (spell: SpellRecord) => void;

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
	if (!isRecord(value)) return null;
	return Array.isArray(value.ignoreSourcesList)
		? { ignoreSourcesList: normalizeStringList(value.ignoreSourcesList) }
		: {};
}

export const SOURCE_PRIORITIES: Record<string, number> = {
	XPHB: 3,
	XDMG: 3,
	PHB: 2,
	DMG: 2,
};

export function getSourcePriority(source: unknown): number {
	return SOURCE_PRIORITIES[String(source || "").trim().toUpperCase()] || 1;
}

export function getPreferredSpellVersion(versions: readonly SpellRecord[]): SpellRecord {
	if (versions.length === 0) return {} as SpellRecord;
	let preferred = versions[0];
	for (let i = 1; i < versions.length; i += 1) {
		const candidate = versions[i];
		const candidatePriority = getSourcePriority(candidate.source);
		const preferredPriority = getSourcePriority(preferred.source);
		if (candidatePriority > preferredPriority) {
			preferred = candidate;
		}
	}
	return preferred;
}

export function groupSpellsByName(spells: readonly SpellRecord[]): SpellRecord[] {
	const byName = new Map<string, SpellRecord[]>();
	for (const spell of spells) {
		const key = String(spell.name || "").trim().toLowerCase();
		let group = byName.get(key);
		if (!group) {
			group = [];
			byName.set(key, group);
		}
		if (Array.isArray(spell.versions) && spell.versions.length > 0) {
			for (const v of spell.versions) {
				group.push(v as SpellRecord);
			}
		} else {
			group.push(spell);
		}
	}

	let hasDuplicates = false;
	for (const group of byName.values()) {
		if (group.length > 1) {
			hasDuplicates = true;
			break;
		}
	}
	if (!hasDuplicates) {
		return [...spells];
	}

	const grouped: SpellRecord[] = [];
	for (const group of byName.values()) {
		if (group.length === 1) {
			grouped.push(group[0]);
			continue;
		}

		const bySource = new Map<string, SpellRecord>();
		for (const item of group) {
			const s = normalizeSourceCode(item.source);
			if (!bySource.has(s)) bySource.set(s, item);
		}
		const uniqueVersions = Array.from(bySource.values());

		uniqueVersions.sort((a, b) => {
			const priorityDiff = getSourcePriority(b.source) - getSourcePriority(a.source);
			if (priorityDiff !== 0) return priorityDiff;
			return String(a.source || "").localeCompare(String(b.source || ""));
		});

		const primary = uniqueVersions[0]!;
		const sources = uniqueVersions.map((v) => v.source).filter((s): s is string => Boolean(s));
		grouped.push({
			...primary,
			name: primary.name,
			sources,
			versions: uniqueVersions,
		});
	}

	return grouped;
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
	if (!spell?.name || spell.name !== reference.name) return false;
	if (!reference.source) return true;
	if (spell.source === reference.source) return true;
	if (Array.isArray(spell.versions)) {
		return spell.versions.some((v) => v.source === reference.source);
	}
	return false;
}

export function getSpellListIndex(spells: readonly SpellRecord[], selectedSpell: SpellRecord | null): number {
	if (!selectedSpell?.name) return -1;
	const exactIndex = spells.findIndex(
		(spell) => spell.name === selectedSpell.name && spell.source === selectedSpell.source,
	);
	if (exactIndex >= 0) return exactIndex;
	return spells.findIndex((spell) => spell.name === selectedSpell.name);
}

export function findSpellByReference(spells: readonly SpellRecord[], value: unknown): SpellRecord | null {
	const reference = parseSpellReferenceKey(value);
	if (!reference.name) return null;
	const match = spells.find((spell) => spellMatchesReferenceKey(spell, value)) ?? null;
	if (!match) return null;
	if (reference.source && match.source !== reference.source && Array.isArray(match.versions)) {
		const versionMatch = match.versions.find((v) => v.source === reference.source) as SpellRecord | undefined;
		if (versionMatch) {
			return {
				...versionMatch,
				name: versionMatch.name || match.name,
				sources: match.sources,
				versions: match.versions,
			};
		}
	}
	return match;
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
	return [...new Set(spells.flatMap((spell) => {
		const classes = normalizeStringList(spell.classes);
		if (Array.isArray(spell.versions)) {
			return [
				...classes,
				...spell.versions.flatMap((v) => normalizeStringList(v.classes)),
			];
		}
		return classes;
	}))].sort((left, right) => left.localeCompare(right));
}

export function isSpellSchoolCode(value: unknown): value is SpellSchoolCode {
	return typeof value === "string" && value in SPELL_SCHOOL_NAMES;
}

export function getSpellSchoolOptions(spells: readonly SpellRecord[]): SpellSchoolCode[] {
	return [...new Set(spells.flatMap((spell) => {
		const schools = isSpellSchoolCode(spell.school) ? [spell.school] : [];
		if (Array.isArray(spell.versions)) {
			return [
				...schools,
				...spell.versions.map((v) => v.school).filter(isSpellSchoolCode),
			];
		}
		return schools;
	}))].sort((left, right) => SPELL_SCHOOL_NAMES[left].localeCompare(SPELL_SCHOOL_NAMES[right]));
}

export function filterSpells(
	spells: readonly SpellRecord[],
	filters: SpellBrowserFilters,
	detailedMatcher: SpellSearchMatcher,
): SpellRecord[] {
	const selectedSourceSet = new Set(filters.selectedSources.map(normalizeSourceCode));
	const normalizedSourceFilter = normalizeSourceCode(filters.sourceFilter);
	const normalizedSearch = filters.search.trim().toLowerCase();

	const grouped = groupSpellsByName(spells);

	const filtered: SpellRecord[] = [];
	for (const spell of grouped) {
		const allVersions = Array.isArray(spell.versions) && spell.versions.length > 0
			? (spell.versions as SpellRecord[])
			: [spell];

		const allowedVersions = allVersions.filter((v) =>
			selectedSourceSet.has(normalizeSourceCode(v.source)),
		);
		if (allowedVersions.length === 0) continue;

		if (filters.sourceFilter !== "all") {
			const matchingVersion = allowedVersions.find(
				(v) => normalizeSourceCode(v.source) === normalizedSourceFilter,
			);
			if (!matchingVersion) continue;

			const candidateSpell: SpellRecord = allowedVersions.length > 1
				? {
					...matchingVersion,
					sources: allowedVersions.map((v) => v.source).filter((s): s is string => Boolean(s)),
					versions: allowedVersions,
				}
				: matchingVersion;

			if (!matchesLevelFilter(candidateSpell, filters.selectedLevel)) continue;
			if (!matchesClassFilter(candidateSpell, filters.selectedClass)) continue;
			if (!matchesSchoolFilter(candidateSpell, filters.selectedSchool)) continue;
			if (!matchesSearchFilter(candidateSpell, normalizedSearch, filters.detailedSearch, detailedMatcher)) continue;

			filtered.push(candidateSpell);
			continue;
		}

		let effectiveVersion = allowedVersions[0];
		if (filters.selectedClass !== "all") {
			const matchingClass = allowedVersions.find((v) =>
				normalizeStringList(v.classes).includes(filters.selectedClass),
			);
			if (matchingClass) effectiveVersion = matchingClass;
		}

		const candidateSpell: SpellRecord = allowedVersions.length > 1
			? {
				...effectiveVersion,
				sources: allowedVersions.map((v) => v.source).filter((s): s is string => Boolean(s)),
				versions: allowedVersions,
			}
			: (effectiveVersion === spell ? spell : { ...effectiveVersion });

		if (!matchesLevelFilter(candidateSpell, filters.selectedLevel)) continue;
		if (!matchesClassFilter(candidateSpell, filters.selectedClass)) continue;
		if (!matchesSchoolFilter(candidateSpell, filters.selectedSchool)) continue;

		const matchesSearch =
			matchesSearchFilter(candidateSpell, normalizedSearch, filters.detailedSearch, detailedMatcher) ||
			allowedVersions.some((v) => matchesSearchFilter(v, normalizedSearch, filters.detailedSearch, detailedMatcher));
		if (!matchesSearch) continue;

		filtered.push(candidateSpell);
	}

	return rankSearchResultsByName(
		filtered,
		normalizedSearch,
		(spell) => spell.name,
	);
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

function canScrollToInitialSpell(
	enabled: boolean,
	initialSelectedName: unknown,
	selectedSpell: SpellRecord | null,
): selectedSpell is SpellRecord {
	return Boolean(enabled && initialSelectedName && selectedSpell);
}

function getInitialSpellScrollKey(
	initialSelectedName: unknown,
	selectedSpell: SpellRecord | null,
	enabled: boolean,
): string | null {
	if (!canScrollToInitialSpell(enabled, initialSelectedName, selectedSpell)) {
		return null;
	}
	return spellMatchesReferenceKey(selectedSpell, initialSelectedName)
		? `${selectedSpell.source ?? ""}:${selectedSpell.name}`
		: null;
}

function isUnseenSpellScrollKey(
	scrollKey: string | null,
	lastScrollKey: string,
): scrollKey is string {
	return Boolean(scrollKey && lastScrollKey !== scrollKey);
}

function getInitialSpellScrollTarget(
	displayedSpells: readonly SpellRecord[],
	selectedSpell: SpellRecord,
	scrollKey: string,
): InitialSpellScrollPlan | null {
	const selectedIndex = getSpellListIndex(displayedSpells, selectedSpell);
	return selectedIndex < 0 ? null : { scrollKey, selectedIndex };
}

export function getInitialSpellScrollPlan(
	displayedSpells: readonly SpellRecord[],
	initialSelectedName: unknown,
	selectedSpell: SpellRecord | null,
	enabled: boolean,
	lastScrollKey: string,
): InitialSpellScrollPlan | null {
	const scrollKey = getInitialSpellScrollKey(
		initialSelectedName,
		selectedSpell,
		enabled,
	);
	if (!isUnseenSpellScrollKey(scrollKey, lastScrollKey) || !selectedSpell) {
		return null;
	}
	return getInitialSpellScrollTarget(displayedSpells, selectedSpell, scrollKey);
}

function getSpellListSchoolName(school: unknown): string {
	return isSpellSchoolCode(school) ? SPELL_SCHOOL_NAMES[school] : "";
}

function getSpellListLevelLabel(
	level: number | undefined,
	translate: SpellBrowserTranslate,
): string {
	if (level === 0) return translate("Cantrip");
	return translate("{level}-level", { level });
}

function getSpellListDisplayName(
	spell: SpellRecord,
	capitalizeName: (name: string) => string,
): string {
	return capitalizeName(spell.name.split("|")[0]);
}

export function getSpellListItemPresentation(
	spell: SpellRecord,
	options: SpellListItemPresentationOptions,
): SpellListItemPresentation {
	const schoolName = getSpellListSchoolName(spell.school);
	const sourceFullName = options.resolveSourceName(spell.source);
	const classes = normalizeStringList(spell.classes);
	const classesLabel = classes.join(", ");
	const source = spell.source ?? "";
	return {
		itemKey: getSpellItemKey(spell),
		displayName: getSpellListDisplayName(spell, options.capitalizeName),
		levelLabel: getSpellListLevelLabel(spell.level, options.translate),
		schoolName,
		showSchool: Boolean(schoolName),
		classesLabel,
		showClasses: classes.length > 0,
		source,
		sourceFullName,
		showSource: Boolean(source),
		disableSourceTooltip: !sourceFullName,
		active: options.selected,
		nextSelection: options.selected ? null : spell,
	};
}

export function executeSpellInsertAction(
	action: SpellInsertAction | null | undefined,
	spell: SpellRecord,
): void {
	action?.(spell);
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
