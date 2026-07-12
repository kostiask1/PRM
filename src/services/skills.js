import { spellApi } from "../entities/spell/index.js";

let skillMapCache = null;
let skillPromise = null;

export function normalizeSkillName(name) {
	return String(name || "")
		.split("|")[0]
		.trim()
		.toLowerCase();
}

function toSkillMap(list) {
	const map = new Map();
	for (const item of Array.isArray(list) ? list : []) {
		const key = normalizeSkillName(item?.name);
		if (!key) continue;
		map.set(key, item);
	}
	return map;
}

export async function loadSkillsMap() {
	if (skillMapCache) return skillMapCache;
	if (skillPromise) return skillPromise;

	skillPromise = spellApi
		.getSkills()
		.then((list) => {
			skillMapCache = toSkillMap(list);
			return skillMapCache;
		})
		.catch((error) => {
			skillPromise = null;
			throw error;
		});

	return skillPromise;
}
