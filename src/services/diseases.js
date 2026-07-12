import { spellApi } from "../entities/spell/index.js";

let diseaseMapCache = null;
let diseasePromise = null;

export function normalizeDiseaseName(name) {
	return String(name || "")
		.split("|")[0]
		.trim()
		.toLowerCase();
}

function toDiseaseMap(list) {
	const map = new Map();
	for (const item of Array.isArray(list) ? list : []) {
		const key = normalizeDiseaseName(item?.name);
		if (!key) continue;
		map.set(key, item);
	}
	return map;
}

export async function loadDiseasesMap() {
	if (diseaseMapCache) return diseaseMapCache;
	if (diseasePromise) return diseasePromise;

	diseasePromise = spellApi
		.getDiseases()
		.then((list) => {
			diseaseMapCache = toDiseaseMap(list);
			return diseaseMapCache;
		})
		.catch((error) => {
			diseasePromise = null;
			throw error;
		});

	return diseasePromise;
}
