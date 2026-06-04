function coerceAiText(value) {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value.trim();
	if (
		typeof value === "number" ||
		typeof value === "bigint" ||
		typeof value === "boolean"
	) {
		return String(value).trim();
	}
	return "";
}

function sanitizeAiName(value) {
	let name = coerceAiText(value);
	if (!name) return "";

	while (name.startsWith("[") && name.endsWith("]")) {
		name = name.slice(1, -1).trim();
	}

	return name.replace(/\s+/g, " ");
}

module.exports = {
	coerceAiText,
	sanitizeAiName,
};
