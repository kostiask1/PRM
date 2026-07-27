import {
	matchesMonsterSearch,
} from "../../../entities/bestiary/model.js";
import { objectMatchesSearch } from "../../../shared/lib/deepSearch.js";
import { normalizeSourceCode } from "../../../utils/sourceIgnore.js";

function monsterIdentityKey(monster) {
	return `${String(monster?.name || "").trim()}\0${normalizeSourceCode(
		monster?.source,
	)}`;
}

export function filterBestiaryMonsters({
	monsters = [],
	selectedSources = [],
	sourceFilter = "all",
	favorites = [],
	onlyFavorites = false,
	search = "",
	isDetailedSearch = false,
}) {
	const selectedSourceSet = new Set(
		selectedSources.map(normalizeSourceCode),
	);
	const normalizedSourceFilter =
		sourceFilter === "all" ? "" : normalizeSourceCode(sourceFilter);
	const favoriteSet = onlyFavorites
		? new Set(favorites.map(monsterIdentityKey))
		: null;

	return monsters.filter((monster) => {
		const normalizedSource = normalizeSourceCode(monster?.source);
		if (!selectedSourceSet.has(normalizedSource)) return false;
		if (
			normalizedSourceFilter &&
			normalizedSource !== normalizedSourceFilter
		) {
			return false;
		}
		if (favoriteSet && !favoriteSet.has(monsterIdentityKey(monster))) {
			return false;
		}
		return isDetailedSearch
			? objectMatchesSearch(monster, search)
			: matchesMonsterSearch(monster, search);
	});
}
