import sources from "../../../../database/sources.json";

const CUSTOM_SOURCE_NAMES = {
	CUSTOM: "Custom creatures",
};

const SOURCE_NAME_BY_CODE = new Map(
	[
		...sources.map((entry) => [
			String(entry.source || "").toUpperCase(),
			String(entry.name || "").trim(),
		]),
		...Object.entries(CUSTOM_SOURCE_NAMES),
	].filter(([source, name]) => source && name),
);

export function getSourceFullName(source) {
	const normalized = String(source || "").trim();
	if (!normalized) return "";
	return SOURCE_NAME_BY_CODE.get(normalized.toUpperCase()) || normalized;
}

export function formatSourceLabel(source, { includeCode = true } = {}) {
	const normalized = String(source || "").trim();
	if (!normalized) return "";
	const fullName = getSourceFullName(normalized);
	if (!includeCode || fullName.toUpperCase() === normalized.toUpperCase()) {
		return fullName;
	}
	return `${fullName} (${normalized.toUpperCase()})`;
}
