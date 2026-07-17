import type { ReferenceRecord, SpellRecord } from "../../spell/index.js";
import {
	getConditionByName,
	getDiseaseByName,
	getSenseByName,
	getSkillByName,
	getSpellByName,
	getVariantRuleByName,
} from "./referencePreview.ts";

type ReferenceInput = string | ReferenceRecord | null | undefined;
type SpellInput = string | SpellRecord | null | undefined;

export async function resolveSpellInput(
	spellOrName: SpellInput,
): Promise<SpellRecord | null> {
	if (spellOrName && typeof spellOrName === "object") return spellOrName;
	if (!spellOrName || typeof spellOrName !== "string") return null;
	const cleanName = spellOrName.split("|")[0].trim();
	if (!cleanName) return null;
	return getSpellByName(cleanName);
}

function isCompleteReference(value: ReferenceInput): value is ReferenceRecord {
	return Boolean(
		value &&
			typeof value === "object" &&
			typeof value.name === "string" &&
			value.entries,
	);
}

function getReferenceName(value: ReferenceInput): string {
	return typeof value === "string" ? value : value?.name || "";
}

export async function resolveConditionInput(
	value: ReferenceInput,
): Promise<ReferenceRecord | null> {
	if (isCompleteReference(value)) return value;
	const name = getReferenceName(value);
	return name ? getConditionByName(name) : null;
}

export async function resolveDiseaseInput(
	value: ReferenceInput,
): Promise<ReferenceRecord | null> {
	if (isCompleteReference(value)) return value;
	const name = getReferenceName(value);
	return name ? getDiseaseByName(name) : null;
}

export async function resolveVariantRuleInput(
	value: ReferenceInput,
): Promise<ReferenceRecord | null> {
	if (isCompleteReference(value)) return value;
	const name = getReferenceName(value);
	return name ? getVariantRuleByName(name) : null;
}

export async function resolveSkillInput(
	value: ReferenceInput,
): Promise<ReferenceRecord | null> {
	if (isCompleteReference(value)) return value;
	const name = getReferenceName(value);
	return name ? getSkillByName(name) : null;
}

export async function resolveSenseInput(
	value: ReferenceInput,
): Promise<ReferenceRecord | null> {
	if (isCompleteReference(value)) return value;
	const name = getReferenceName(value);
	return name ? getSenseByName(name) : null;
}
