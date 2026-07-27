import { rulesReferenceApi } from "../api.js";

let senseMapCache = null;
let sensePromise = null;

export function normalizeSenseName(name) {
	return String(name || "")
		.split("|")[0]
		.trim()
		.toLowerCase();
}

function toSenseMap(list) {
	const map = new Map();
	for (const item of Array.isArray(list) ? list : []) {
		const key = normalizeSenseName(item?.name);
		if (!key) continue;
		map.set(key, item);
	}
	return map;
}

export async function loadSensesMap() {
	if (senseMapCache) return senseMapCache;
	if (sensePromise) return sensePromise;

	sensePromise = rulesReferenceApi
		.getSenses()
		.then((list) => {
			senseMapCache = toSenseMap(list);
			return senseMapCache;
		})
		.catch((error) => {
			sensePromise = null;
			throw error;
		});

	return sensePromise;
}
