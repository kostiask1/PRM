import { objectMatchesSearch } from "../../../shared/lib/deepSearch.js";
import { normalizeSourceCode } from "../../../utils/sourceIgnore.js";

export function filterSpells({
	spells = [],
	selectedSources = [],
	sourceFilter = "all",
	search = "",
	isDetailedSearch = false,
	selectedLevel = "all",
	selectedClass = "all",
	selectedSchool = "all",
}) {
	const selectedSourceSet = new Set(
		selectedSources.map(normalizeSourceCode),
	);
	const normalizedSourceFilter =
		sourceFilter === "all" ? "" : normalizeSourceCode(sourceFilter);
	const normalizedSearch = String(search || "")
		.trim()
		.toLowerCase();

	return spells.filter((spell) => {
		const normalizedSource = normalizeSourceCode(spell?.source);
		const matchesSource = selectedSourceSet.has(normalizedSource);
		const matchesSourceFilter =
			!normalizedSourceFilter ||
			normalizedSource === normalizedSourceFilter;
		const matchesSearch =
			!normalizedSearch ||
			(isDetailedSearch
				? objectMatchesSearch(spell, normalizedSearch)
				: String(spell?.name || "")
						.toLowerCase()
						.includes(normalizedSearch));
		const matchesLevel =
			selectedLevel === "all" ||
			String(spell?.level) === selectedLevel;
		const matchesClass =
			selectedClass === "all" ||
			spell?.classes?.includes(selectedClass);
		const matchesSchool =
			selectedSchool === "all" ||
			spell?.school === selectedSchool;
		return (
			matchesSource &&
			matchesSourceFilter &&
			matchesSearch &&
			matchesLevel &&
			matchesClass &&
			matchesSchool
		);
	});
}
