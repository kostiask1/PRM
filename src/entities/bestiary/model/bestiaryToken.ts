import sources from "../../../../database/sources.json" with { type: "json" };

const TOKEN_SOURCE_OVERRIDES = ["MisMV1", "TftYP"];

function normalizeSourceCode(value: unknown): string {
	return String(value || "").trim().toUpperCase();
}

const tokenSourceEntries: Array<[string, string]> = sources.map((entry) => [
	normalizeSourceCode(entry.source),
	String(entry.source || "").trim(),
]);

for (const source of TOKEN_SOURCE_OVERRIDES) {
	tokenSourceEntries.push([normalizeSourceCode(source), source]);
}

const TOKEN_SOURCE_BY_CODE = new Map(
	tokenSourceEntries.filter(([key, source]) => Boolean(key && source)),
);

function removeLatinDiacritics(value: string): string {
	let isLatinBase = false;
	let result = "";
	for (const character of value.normalize("NFD")) {
		if (/[\u0300-\u036f]/.test(character)) {
			if (!isLatinBase) result += character;
			continue;
		}
		result += character;
		isLatinBase = /\p{Script=Latin}/u.test(character);
	}
	return result.normalize("NFC");
}

export function getBestiaryTokenName(value: unknown): string {
	return removeLatinDiacritics(
		String(value || "")
			.trim()
			.replace(/Æ/g, "AE")
			.replace(/æ/g, "ae"),
	)
		.replace(/"/g, "")
		.trim();
}

export function getBestiaryTokenSource(value: unknown): string {
	const source = String(value || "").trim();
	return TOKEN_SOURCE_BY_CODE.get(normalizeSourceCode(source)) || source;
}
