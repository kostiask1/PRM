import { spellApi, type ReferenceRecord } from "../../spell/index.js";

let variantRuleMapCache: Map<string, ReferenceRecord> | null = null;
let variantRulePromise: Promise<Map<string, ReferenceRecord>> | null = null;

export function normalizeVariantRuleName(name: unknown): string {
	return String(name || "").split("|")[0].trim().toLowerCase();
}

function toVariantRuleMap(
	list: ReferenceRecord[] | null | undefined,
): Map<string, ReferenceRecord> {
	const map = new Map<string, ReferenceRecord>();
	for (const item of Array.isArray(list) ? list : []) {
		const key = normalizeVariantRuleName(item?.name);
		if (key) map.set(key, item);
	}
	return map;
}

export async function loadVariantRulesMap(): Promise<Map<string, ReferenceRecord>> {
	if (variantRuleMapCache) return variantRuleMapCache;
	if (variantRulePromise) return variantRulePromise;
	variantRulePromise = spellApi
		.getVariantRules()
		.then((list) => {
			variantRuleMapCache = toVariantRuleMap(list);
			return variantRuleMapCache;
		})
		.catch((error: unknown) => {
			variantRulePromise = null;
			throw error;
		});
	return variantRulePromise;
}
