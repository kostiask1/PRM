export const GLOBAL_SEARCH_RESULT_LIMIT = 80;

export function normalizeGlobalSearchText(value) {
	return String(value || "")
		.toLowerCase()
		.replace(/\s+/g, " ")
		.trim();
}

export function filterGlobalSearchIndex(
	index,
	activeFilters,
	query,
	limit = GLOBAL_SEARCH_RESULT_LIMIT,
) {
	const normalizedQuery = normalizeGlobalSearchText(query);
	const results = [];
	for (const item of index || []) {
		if (!activeFilters.has(item.filter)) continue;
		if (
			normalizedQuery &&
			!item.searchText.includes(normalizedQuery)
		) {
			continue;
		}
		results.push(item);
		if (results.length >= limit) break;
	}
	return results;
}
