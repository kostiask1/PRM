import { spellApi, type ReferenceRecord } from "../../spell/index.js";

let skillMapCache: Map<string, ReferenceRecord> | null = null;
let skillPromise: Promise<Map<string, ReferenceRecord>> | null = null;

export function normalizeSkillName(name: unknown): string {
	return String(name || "").split("|")[0].trim().toLowerCase();
}

function toSkillMap(
	list: ReferenceRecord[] | null | undefined,
): Map<string, ReferenceRecord> {
	const map = new Map<string, ReferenceRecord>();
	for (const item of Array.isArray(list) ? list : []) {
		const key = normalizeSkillName(item?.name);
		if (key) map.set(key, item);
	}
	return map;
}

export async function loadSkillsMap(): Promise<Map<string, ReferenceRecord>> {
	if (skillMapCache) return skillMapCache;
	if (skillPromise) return skillPromise;
	skillPromise = spellApi
		.getSkills()
		.then((list) => {
			skillMapCache = toSkillMap(list);
			return skillMapCache;
		})
		.catch((error: unknown) => {
			skillPromise = null;
			throw error;
		});
	return skillPromise;
}
