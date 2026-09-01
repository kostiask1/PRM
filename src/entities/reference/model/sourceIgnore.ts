export interface CampaignSourceSettings extends Record<string, unknown> {
	ignoreSourcesList?: unknown[];
}

export function normalizeSourceCode(source: unknown): string {
	return String(source || "").trim().toUpperCase();
}

export function normalizeIgnoreSourcesList(value: unknown): string[] {
	const seen = new Set<string>();
	const list = Array.isArray(value) ? value : [];
	for (const source of list) {
		const normalized = normalizeSourceCode(source);
		if (normalized) seen.add(normalized);
	}
	return [...seen].sort((a, b) => a.localeCompare(b));
}

export function getCampaignIgnoreSourcesList(
	campaign: CampaignSourceSettings | null | undefined,
	globalIgnoreSourcesList: unknown,
): string[] {
	if (campaign && Array.isArray(campaign.ignoreSourcesList)) {
		return normalizeIgnoreSourcesList(campaign.ignoreSourcesList);
	}
	return normalizeIgnoreSourcesList(globalIgnoreSourcesList);
}

export function getSelectedSourcesFromIgnoreList(
	sources: unknown,
	ignoreSourcesList: unknown,
): string[] {
	const ignored = new Set(normalizeIgnoreSourcesList(ignoreSourcesList));
	return (Array.isArray(sources) ? sources : [])
		.map((source) => String(source || "").trim())
		.filter((source) => source && !ignored.has(normalizeSourceCode(source)));
}

export function getIgnoreSourcesListFromSelectedSources(
	sources: unknown,
	selectedSources: unknown,
): string[] {
	const selected = new Set(
		(Array.isArray(selectedSources) ? selectedSources : []).map(
			normalizeSourceCode,
		),
	);
	return normalizeIgnoreSourcesList(
		(Array.isArray(sources) ? sources : []).filter(
			(source) => !selected.has(normalizeSourceCode(source)),
		),
	);
}
