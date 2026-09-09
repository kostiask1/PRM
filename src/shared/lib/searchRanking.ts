import { distance } from "fastest-levenshtein";

export type SearchResultNameSelector<TItem> = (item: TItem) => unknown;

interface RankedSearchResult<TItem> {
	item: TItem;
	name: string;
	nameMatchRank: number;
	distance: number;
	index: number;
}

function normalizeSearchRankingText(value: unknown): string {
	return String(value ?? "").trim().toLowerCase();
}

function isSearchWordCharacter(value: string): boolean {
	return /[\p{L}\p{N}]/u.test(value);
}

function hasNameWordPrefix(name: string, query: string): boolean {
	let matchIndex = name.indexOf(query);
	while (matchIndex > 0) {
		if (!isSearchWordCharacter(name[matchIndex - 1])) return true;
		matchIndex = name.indexOf(query, matchIndex + 1);
	}
	return false;
}

function getNameMatchRank(name: string, query: string): number {
	if (name === query) return 0;
	if (name.startsWith(query)) return 1;
	if (hasNameWordPrefix(name, query)) return 2;
	if (name.includes(query)) return 3;
	return name ? 4 : 5;
}

function createRankedSearchResult<TItem>(
	item: TItem,
	index: number,
	query: string,
	selectName: SearchResultNameSelector<TItem>,
): RankedSearchResult<TItem> {
	const name = normalizeSearchRankingText(selectName(item));
	return {
		item,
		name,
		nameMatchRank: getNameMatchRank(name, query),
		distance: distance(name, query),
		index,
	};
}

function compareRankedSearchResults<TItem>(
	left: RankedSearchResult<TItem>,
	right: RankedSearchResult<TItem>,
): number {
	const rankDifference = left.nameMatchRank - right.nameMatchRank;
	if (rankDifference) return rankDifference;
	const distanceDifference = left.distance - right.distance;
	if (distanceDifference) return distanceDifference;
	const lengthDifference = left.name.length - right.name.length;
	if (lengthDifference) return lengthDifference;
	const nameDifference = left.name.localeCompare(right.name);
	return nameDifference || left.index - right.index;
}

export function rankSearchResultsByName<TItem>(
	items: readonly TItem[],
	query: unknown,
	selectName: SearchResultNameSelector<TItem>,
): TItem[] {
	const normalizedQuery = normalizeSearchRankingText(query);
	if (!normalizedQuery) return [...items];
	return items
		.map((item, index) =>
			createRankedSearchResult(item, index, normalizedQuery, selectName),
		)
		.sort(compareRankedSearchResults)
		.map(({ item }) => item);
}
