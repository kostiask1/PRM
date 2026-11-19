import {
	referenceApi,
	type ReferenceRecord,
} from "../api/referenceApi.ts";
import { formatSourceLabel } from "./sourceNames.ts";

export interface SkillMetaRecord extends Record<string, unknown> {
	ability?: unknown;
	source?: unknown;
}

export function getSkillMeta(
	skill: SkillMetaRecord = {},
	separator = " · ",
): string {
	const ability = String(skill.ability || "").trim().toUpperCase();
	const source = skill.source ? formatSourceLabel(skill.source) : "";
	return [ability, source].filter(Boolean).join(separator);
}

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
	skillPromise = referenceApi
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
