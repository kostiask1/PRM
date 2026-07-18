export interface SearchHighlightPart {
	text: string;
	highlighted: boolean;
}

export type SearchHighlightParts =
	| string
	| null
	| undefined
	| SearchHighlightPart[];

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNullish(value: unknown): value is null | undefined {
	return value === undefined || value === null;
}

function normalizeSearchQuery(value: unknown): string {
	return String(value ?? "").trim();
}

export function splitSearchHighlight(
	value: unknown,
	searchQuery: unknown = "",
): SearchHighlightParts {
	if (isNullish(value)) return value;

	const text = String(value);
	const query = normalizeSearchQuery(searchQuery);
	if (!query) return text;

	const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "gi"));
	if (parts.length === 1) return text;

	const normalizedQuery = query.toLowerCase();
	return parts.map((part) => ({
		text: part,
		highlighted: part.toLowerCase() === normalizedQuery,
	}));
}
