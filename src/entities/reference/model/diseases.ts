import {
	referenceApi,
	type ReferenceRecord,
} from "../api/referenceApi.ts";
import { formatSourceLabel } from "./sourceNames.ts";

export interface DiseaseMetaRecord extends Record<string, unknown> {
	type?: unknown;
	source?: unknown;
}

export function getDiseaseMeta(
	disease: DiseaseMetaRecord = {},
	separator = " · ",
): string {
	const type = String(disease.type || "").trim();
	const source = disease.source ? formatSourceLabel(disease.source) : "";
	return [type, source].filter(Boolean).join(separator);
}

let diseaseMapCache: Map<string, ReferenceRecord> | null = null;
let diseasePromise: Promise<Map<string, ReferenceRecord>> | null = null;

export function normalizeDiseaseName(name: unknown): string {
	return String(name || "").split("|")[0].trim().toLowerCase();
}

function toDiseaseMap(
	list: ReferenceRecord[] | null | undefined,
): Map<string, ReferenceRecord> {
	const map = new Map<string, ReferenceRecord>();
	for (const item of Array.isArray(list) ? list : []) {
		const key = normalizeDiseaseName(item?.name);
		if (key) map.set(key, item);
	}
	return map;
}

export async function loadDiseasesMap(): Promise<Map<string, ReferenceRecord>> {
	if (diseaseMapCache) return diseaseMapCache;
	if (diseasePromise) return diseasePromise;
	diseasePromise = referenceApi
		.getDiseases()
		.then((list) => {
			diseaseMapCache = toDiseaseMap(list);
			return diseaseMapCache;
		})
		.catch((error: unknown) => {
			diseasePromise = null;
			throw error;
		});
	return diseasePromise;
}
