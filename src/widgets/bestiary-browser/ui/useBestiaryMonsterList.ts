import { useEffect, useMemo, useState } from "react";
import {
	matchesMonsterSearch,
	type BestiaryFavorite,
	type BestiaryMonster,
} from "../../../entities/bestiary/index.js";
import { objectMatchesSearch } from "../../../shared/lib/index.js";
import {
	filterBestiaryMonsters,
	getNextBestiarySortOrder,
	sortBestiaryMonsters,
	type BestiarySortOrder,
} from "../model.js";

export interface UseBestiaryMonsterListOptions {
	allMonsters: BestiaryMonster[];
	debouncedSearch: string;
	favorites: BestiaryFavorite[];
	isDetailedSearch: boolean;
	selectedSources: string[];
	sourceFilter: string;
}

export function useBestiaryMonsterList({
	allMonsters,
	debouncedSearch,
	favorites,
	isDetailedSearch,
	selectedSources,
	sourceFilter,
}: UseBestiaryMonsterListOptions) {
	const [monsters, setMonsters] = useState<BestiaryMonster[]>([]);
	const [onlyFavorites, setOnlyFavorites] = useState(false);
	const [sortOrder, setSortOrder] = useState<BestiarySortOrder>("none");
	const displayedMonsters = useMemo(
		() => sortBestiaryMonsters(monsters, sortOrder),
		[monsters, sortOrder],
	);

	useEffect(() => {
		const filtered = filterBestiaryMonsters(allMonsters, {
			selectedSources,
			sourceFilter,
			onlyFavorites,
			favorites,
			search: debouncedSearch,
			isDetailedSearch,
			matchesDetailedSearch: objectMatchesSearch,
			matchesSimpleSearch: matchesMonsterSearch,
		});
		setMonsters(filtered);
	}, [
		allMonsters,
		debouncedSearch,
		favorites,
		isDetailedSearch,
		onlyFavorites,
		selectedSources,
		sourceFilter,
	]);

	const toggleSort = () => {
		setSortOrder(getNextBestiarySortOrder);
	};

	return {
		displayedMonsters,
		onlyFavorites,
		setOnlyFavorites,
		sortOrder,
		toggleSort,
	};
}
