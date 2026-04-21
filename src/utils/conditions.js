import { api } from "../api.js";

let conditionMapCache = null;
let conditionPromise = null;

export function normalizeConditionName(name) {
	return String(name || "").trim().toLowerCase();
}

function toConditionMap(list) {
	const map = new Map();
	for (const item of Array.isArray(list) ? list : []) {
		const key = normalizeConditionName(item?.name);
		if (!key) continue;
		map.set(key, item);
	}
	return map;
}

export async function loadConditionsMap() {
	if (conditionMapCache) return conditionMapCache;
	if (conditionPromise) return conditionPromise;

	conditionPromise = api
		.getConditions()
		.then((list) => {
			conditionMapCache = toConditionMap(list);
			return conditionMapCache;
		})
		.catch((error) => {
			conditionPromise = null;
			throw error;
		});

	return conditionPromise;
}
