export const CONTENT_TOKEN_REGEX =
	/(\(Recharge\s+\d+(?:-\d+)?\))|(\d+d\d+(?:\s*[+-]\s*\d+)?)|(?<!\d)([+-]\d+)(\s+to\s+hit)?|(\{@spell\s+([^}]+)\})|(\{@(?:condition|status)\s+([^}]+)\})|(@condition\s+([A-Za-z][A-Za-z' -]*))|(\{@disease\s+([^}]+)\})|(\{@variantrule\s+([^}]+)\})|(\{@skill\s+([^}]+)\})|(\{@sense\s+([^}]+)\})/gi;

export function tokenFromContentMatch(match) {
	return {
		fullMatch: match[0],
		recharge: match[1],
		roll: match[2],
		hit: match[3],
		hitSuffix: match[4] || "",
		spellTag: match[5],
		spellValue: match[6],
		conditionTag: match[7],
		conditionValue: match[8],
		conditionPlain: match[9],
		diseaseValue: match[12],
		variantRuleValue: match[14],
		skillValue: match[16],
		senseValue: match[18],
	};
}

export function extractContentTokens(text) {
	const regex = new RegExp(CONTENT_TOKEN_REGEX.source, CONTENT_TOKEN_REGEX.flags);
	const tokens = [];
	let match;
	while ((match = regex.exec(String(text || ""))) !== null) {
		tokens.push({
			...tokenFromContentMatch(match),
			index: match.index,
		});
	}
	return tokens;
}
