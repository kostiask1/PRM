function collectSearchText(value, parts, seen) {
	if (value == null) return;

	const valueType = typeof value;
	if (valueType === "string" || valueType === "number" || valueType === "boolean") {
		parts.push(String(value));
		return;
	}

	if (valueType !== "object") return;
	if (seen.has(value)) return;
	seen.add(value);

	if (Array.isArray(value)) {
		value.forEach((item) => collectSearchText(item, parts, seen));
		return;
	}

	Object.values(value).forEach((item) => collectSearchText(item, parts, seen));
}

export function objectMatchesSearch(value, searchQuery = "") {
	const normalizedSearch = String(searchQuery || "")
		.trim()
		.toLowerCase();
	if (!normalizedSearch) return true;

	const parts = [];
	collectSearchText(value, parts, new WeakSet());
	return parts.join(" ").toLowerCase().includes(normalizedSearch);
}
