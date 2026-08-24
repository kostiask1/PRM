import type {
	BestiaryFavorite,
	BestiaryMonster,
} from "../../../entities/bestiary/index.js";

export type BestiarySortOrder = "none" | "desc" | "asc";

export interface BestiaryFilterOptions {
	selectedSources: string[];
	sourceFilter: string;
	onlyFavorites: boolean;
	favorites: BestiaryFavorite[];
	search: string;
	isDetailedSearch: boolean;
	matchesDetailedSearch: (monster: BestiaryMonster, search: string) => boolean;
	matchesSimpleSearch: (monster: BestiaryMonster, search: string) => boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	Boolean(value && typeof value === "object" && !Array.isArray(value));

export function normalizeMonsterName(value: unknown): string {
	return String(value ?? "").trim().toLowerCase();
}

export function normalizeMonsterSource(value: unknown): string {
	return String(value ?? "").trim().toUpperCase();
}

export function isCustomSource(source: unknown): boolean {
	return normalizeMonsterSource(source) === "CUSTOM";
}

export function getMonsterItemKey(monster: BestiaryMonster): string {
	return `${String(monster.source ?? "")}:${monster.name}`;
}

export function getMonsterSizeText(monster: BestiaryMonster): string {
	return String(
		Array.isArray(monster.size) ? monster.size[0] ?? "" : monster.size ?? "",
	);
}

export function getMonsterTagText(monster: BestiaryMonster): string {
	if (!monster.type || typeof monster.type === "string") return "";
	return (monster.type.tags ?? [])
		.map((tag) => (isRecord(tag) ? tag.tag : tag))
		.filter((tag): tag is string => typeof tag === "string")
		.join(", ");
}

export function getMonsterCrDisplay(monster: BestiaryMonster): string | number {
	const cr = isRecord(monster.cr) ? monster.cr.cr : monster.cr;
	return typeof cr === "string" || typeof cr === "number" ? cr : "";
}

function getMonsterCrValue(monster: BestiaryMonster): unknown {
	return isRecord(monster.cr) ? monster.cr.cr : monster.cr;
}

function parseScalarMonsterCr(value: unknown): number {
	return Number.parseFloat(String(value ?? "0")) || 0;
}

function parseFractionMonsterCr(text: string): number {
	const [numerator = "0", denominator = "0"] = text.split("/");
	const denominatorValue = Number(denominator);
	return denominatorValue ? Number(numerator) / denominatorValue : 0;
}

function normalizeMonsterCrText(value: unknown): string {
	return String(value ?? "0");
}

function parseMonsterCrText(text: string): number {
	return text.includes("/")
		? parseFractionMonsterCr(text)
		: parseScalarMonsterCr(text);
}

function parseMonsterCrValue(value: unknown): number {
	if (typeof value === "number") return value;
	return parseMonsterCrText(normalizeMonsterCrText(value));
}

export function parseMonsterCr(monster: BestiaryMonster): number {
	return parseMonsterCrValue(getMonsterCrValue(monster));
}

function getBestiarySortDirection(order: BestiarySortOrder): number {
	return order === "desc" ? -1 : 1;
}

function compareBestiaryMonsters(
	left: BestiaryMonster,
	right: BestiaryMonster,
	direction: number,
): number {
	const crDifference = parseMonsterCr(left) - parseMonsterCr(right);
	return crDifference
		? crDifference * direction
		: left.name.localeCompare(right.name);
}

export function sortBestiaryMonsters(
	monsters: BestiaryMonster[],
	order: BestiarySortOrder,
): BestiaryMonster[] {
	if (order === "none") return [...monsters];
	const direction = getBestiarySortDirection(order);
	return [...monsters].sort((left, right) =>
		compareBestiaryMonsters(left, right, direction),
	);
}

function matchesSelectedSource(
	monster: BestiaryMonster,
	selectedSources: ReadonlySet<string>,
): boolean {
	return selectedSources.has(normalizeMonsterSource(monster.source));
}

function matchesBestiarySourceFilter(
	monster: BestiaryMonster,
	sourceFilter: string | null,
): boolean {
	return (
		sourceFilter === null ||
		normalizeMonsterSource(monster.source) === sourceFilter
	);
}

function getBestiaryFilterIdentityKey(
	monster: Pick<BestiaryMonster, "name" | "source"> | BestiaryFavorite,
): string | null {
	const name = normalizeMonsterName(monster.name);
	if (!name) return null;
	return JSON.stringify([name, normalizeMonsterSource(monster.source)]);
}

function createBestiaryFavoriteSet(
	favorites: BestiaryFavorite[],
): ReadonlySet<string> {
	return new Set(
		favorites
			.map(getBestiaryFilterIdentityKey)
			.filter((key): key is string => key !== null),
	);
}

interface CompiledBestiaryFilter {
	selectedSources: ReadonlySet<string>;
	sourceFilter: string | null;
	favorites: ReadonlySet<string> | null;
	search: string;
	searchMatcher: (
		monster: BestiaryMonster,
		search: string,
	) => boolean;
}

function compileBestiaryFilter(
	options: BestiaryFilterOptions,
): CompiledBestiaryFilter {
	return {
		selectedSources: new Set(
			options.selectedSources.map(normalizeMonsterSource),
		),
		sourceFilter:
			options.sourceFilter === "all"
				? null
				: normalizeMonsterSource(options.sourceFilter),
		favorites: options.onlyFavorites
			? createBestiaryFavoriteSet(options.favorites)
			: null,
		search: options.search,
		searchMatcher: options.isDetailedSearch
			? options.matchesDetailedSearch
			: options.matchesSimpleSearch,
	};
}

function matchesBestiaryFavoriteFilter(
	monster: BestiaryMonster,
	favorites: ReadonlySet<string> | null,
): boolean {
	if (favorites === null) return true;
	const identity = getBestiaryFilterIdentityKey(monster);
	return identity !== null && favorites.has(identity);
}

function matchesBestiaryMonster(
	monster: BestiaryMonster,
	filter: CompiledBestiaryFilter,
): boolean {
	if (!matchesSelectedSource(monster, filter.selectedSources)) return false;
	if (!matchesBestiarySourceFilter(monster, filter.sourceFilter)) return false;
	if (!matchesBestiaryFavoriteFilter(monster, filter.favorites)) return false;
	return filter.searchMatcher(monster, filter.search);
}

export function filterBestiaryMonsters(
	monsters: BestiaryMonster[],
	options: BestiaryFilterOptions,
): BestiaryMonster[] {
	const filter = compileBestiaryFilter(options);
	return monsters.filter((monster) => matchesBestiaryMonster(monster, filter));
}

export function getNextBestiarySortOrder(
	current: BestiarySortOrder,
): BestiarySortOrder {
	if (current === "none") return "desc";
	if (current === "desc") return "asc";
	return "none";
}
