export const CONTENT_TOKEN_REGEX =
	/(\(Recharge\s+\d+(?:-\d+)?\))|(\{@(?:damage|scaledamage|scaledice)\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^|}]*))?[^}]*\})|(\d+d\d+(?:\s*[+-]\s*\d+)?)|(?<!\d)([+-]\d+)(\s+to\s+hit)?|(\{@spell\s+([^}]+)\})|(\{@(?:condition|status)\s+([^}]+)\})|(@condition\s+([A-Za-z][A-Za-z' -]*))|(\{@disease\s+([^}]+)\})|(\{@variantrule\s+([^}]+)\})|(\{@skill\s+([^}]+)\})|(\{@sense\s+([^}]+)\})|(\{@quickref\s+([^}]+)\})/gi;

export function tokenFromContentMatch(match) {
	return {
		fullMatch: match[0],
		recharge: match[1],
		damageRoll: match[3],
		damageLabel: match[5],
		roll: match[6],
		hit: match[7],
		hitSuffix: match[8] || "",
		spellTag: match[9],
		spellValue: match[10],
		conditionTag: match[11],
		conditionValue: match[12],
		conditionPlain: match[13],
		diseaseValue: match[16],
		variantRuleValue: match[18],
		skillValue: match[20],
		senseValue: match[22],
		quickrefValue: match[24],
	};
}

export function extractContentTokens(text) {
	const regex = new RegExp(
		CONTENT_TOKEN_REGEX.source,
		CONTENT_TOKEN_REGEX.flags,
	);
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
