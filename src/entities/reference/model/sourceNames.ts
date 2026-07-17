import sources from "../../../../database/sources.json";

const CUSTOM_SOURCE_NAMES: Record<string, string> = {
	CUSTOM: "Custom creatures",
};

const sourceEntries: Array<[string, string]> = [
	...sources.map(
		(entry): [string, string] => [
			String(entry.source || "").toUpperCase(),
			String(entry.name || "").trim(),
		],
	),
	...Object.entries(CUSTOM_SOURCE_NAMES),
].filter(([source, name]) => Boolean(source && name));

const SOURCE_NAME_BY_CODE = new Map<string, string>(sourceEntries);

export function getSourceFullName(source: unknown): string {
	const normalized = String(source || "").trim();
	if (!normalized) return "";
	return SOURCE_NAME_BY_CODE.get(normalized.toUpperCase()) || normalized;
}

export interface SourceLabelOptions {
	includeCode?: boolean;
}

export function formatSourceLabel(
	source: unknown,
	{ includeCode = true }: SourceLabelOptions = {},
): string {
	const normalized = String(source || "").trim();
	if (!normalized) return "";
	const fullName = getSourceFullName(normalized);
	if (!includeCode || fullName.toUpperCase() === normalized.toUpperCase()) {
		return fullName;
	}
	return `${fullName} (${normalized.toUpperCase()})`;
}
