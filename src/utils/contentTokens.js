export const CONTENT_TOKEN_REGEX =
	/(\(Recharge\s+\d+(?:-\d+)?\)|\{@recharge(?:\s+\d+(?:-\d+)?)?})|(\{@(?:damage|scaledamage|scaledice)\s+([^|}]+)(?:\|([^|}]*))?(?:\|([^|}]*))?[^}]*\})|(\d+d\d+(?:\s*[+-]\s*\d+)?)|(\{@hit\s+([+-]?\d+)\})(\s+to\s+hit)?|(?<!\d)([+-]\d+)(\s+to\s+hit)?|(\{@spell\s+([^}]+)\})|(\{@(?:condition|status)\s+([^}]+)\})|(@condition\s+([A-Za-z][A-Za-z' -]*))|(\{@disease\s+([^}]+)\})|(\{@variantrule\s+([^}]+)\})|(\{@skill\s+([^}]+)\})|(\{@sense\s+([^}]+)\})|(\{@quickref\s+([^}]+)\})/gi;

function normalizeRechargeToken(value) {
	const rechargeTag = String(value || "").match(
		/^\{@recharge(?:\s+(\d+(?:-\d+)?))?}$/i,
	);
	if (!rechargeTag) return value;
	const rechargeValue = rechargeTag[1] || "6";
	if (rechargeValue.includes("-")) return `(Recharge ${rechargeValue})`;
	return rechargeValue === "6"
		? "(Recharge 6)"
		: `(Recharge ${rechargeValue}-6)`;
}

export function tokenFromContentMatch(match) {
	return {
		fullMatch: match[0],
		recharge: normalizeRechargeToken(match[1]),
		damageRoll: match[3],
		damageLabel: match[5],
		roll: match[6],
		hit: match[8] || match[10],
		hitSuffix: match[9] || match[11] || "",
		spellTag: match[12],
		spellValue: match[13],
		conditionTag: match[14],
		conditionValue: match[15],
		conditionPlain: match[16],
		diseaseValue: match[19],
		variantRuleValue: match[21],
		skillValue: match[23],
		senseValue: match[25],
		quickrefValue: match[27],
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
