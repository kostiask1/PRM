import { spellApi } from "../../spell/index.js";

let variantRuleMapCache = null;
let variantRulePromise = null;

export function normalizeVariantRuleName(name) {
	return String(name || "")
		.split("|")[0]
		.trim()
		.toLowerCase();
}

function toVariantRuleMap(list) {
	const map = new Map();
	for (const item of Array.isArray(list) ? list : []) {
		const key = normalizeVariantRuleName(item?.name);
		if (!key) continue;
		map.set(key, item);
	}
	return map;
}

export async function loadVariantRulesMap() {
	if (variantRuleMapCache) return variantRuleMapCache;
	if (variantRulePromise) return variantRulePromise;

	variantRulePromise = spellApi
		.getVariantRules()
		.then((list) => {
			variantRuleMapCache = toVariantRuleMap(list);
			return variantRuleMapCache;
		})
		.catch((error) => {
			variantRulePromise = null;
			throw error;
		});

	return variantRulePromise;
}
