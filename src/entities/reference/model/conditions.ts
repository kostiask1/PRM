import {
	referenceApi,
	type ReferenceRecord,
} from "../api/referenceApi.ts";

let conditionMapCache: Map<string, ReferenceRecord> | null = null;
let conditionPromise: Promise<Map<string, ReferenceRecord>> | null = null;

export function normalizeConditionName(name: unknown): string {
	return String(name || "").trim().toLowerCase();
}

function toConditionMap(
	list: ReferenceRecord[] | null | undefined,
): Map<string, ReferenceRecord> {
	const map = new Map<string, ReferenceRecord>();
	for (const item of Array.isArray(list) ? list : []) {
		const key = normalizeConditionName(item?.name);
		if (key) map.set(key, item);
	}
	return map;
}

export async function loadConditionsMap(): Promise<Map<string, ReferenceRecord>> {
	if (conditionMapCache) return conditionMapCache;
	if (conditionPromise) return conditionPromise;
	conditionPromise = referenceApi
		.getConditions()
		.then((list) => {
			conditionMapCache = toConditionMap(list);
			return conditionMapCache;
		})
		.catch((error: unknown) => {
			conditionPromise = null;
			throw error;
		});
	return conditionPromise;
}
