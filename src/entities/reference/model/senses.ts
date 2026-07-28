import {
	referenceApi,
	type ReferenceRecord,
} from "../api/referenceApi.ts";

let senseMapCache: Map<string, ReferenceRecord> | null = null;
let sensePromise: Promise<Map<string, ReferenceRecord>> | null = null;

export function normalizeSenseName(name: unknown): string {
	return String(name || "").split("|")[0].trim().toLowerCase();
}

function toSenseMap(
	list: ReferenceRecord[] | null | undefined,
): Map<string, ReferenceRecord> {
	const map = new Map<string, ReferenceRecord>();
	for (const item of Array.isArray(list) ? list : []) {
		const key = normalizeSenseName(item?.name);
		if (key) map.set(key, item);
	}
	return map;
}

export async function loadSensesMap(): Promise<Map<string, ReferenceRecord>> {
	if (senseMapCache) return senseMapCache;
	if (sensePromise) return sensePromise;
	sensePromise = referenceApi
		.getSenses()
		.then((list) => {
			senseMapCache = toSenseMap(list);
			return senseMapCache;
		})
		.catch((error: unknown) => {
			sensePromise = null;
			throw error;
		});
	return sensePromise;
}
