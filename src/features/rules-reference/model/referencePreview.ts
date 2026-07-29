import {
	bestiaryApi,
	type BestiaryMonster,
} from "../../../entities/bestiary/index.js";
import {
	spellApi,
	type SpellRecord,
} from "../../../entities/spell/index.js";
import {
	loadConditionsMap,
	loadDiseasesMap,
	loadSensesMap,
	loadSkillsMap,
	loadVariantRulesMap,
	normalizeConditionName,
	normalizeDiseaseName,
	normalizeSenseName,
	normalizeSkillName,
	normalizeVariantRuleName,
	type ReferenceRecord,
} from "../../../entities/reference/index.js";

const spellCache = new Map<string, SpellRecord>();
const creatureCache = new Map<string, BestiaryMonster>();

function normalizeSpellName(name: unknown): string {
	return String(name || "").split("|")[0].trim().toLowerCase();
}

export async function getSpellByName(name: unknown): Promise<SpellRecord | null> {
	const key = normalizeSpellName(name);
	if (!key) return null;
	if (spellCache.has(key)) return spellCache.get(key) || null;

	const results = (await spellApi.searchSpells({ name: key })) || [];
	const spell =
		results.find((item) => normalizeSpellName(item.name) === key) ||
		results[0] ||
		null;
	if (spell) spellCache.set(key, spell);
	return spell;
}

interface CreatureReference {
	name: string;
	source: string;
}

function parseCreatureReference(name: unknown): CreatureReference {
	const parts = String(name || "").split("|");
	return {
		name: String(parts[0] || "").trim(),
		source: String(parts[1] || "").trim(),
	};
}

function normalizeCreatureName(name: unknown): string {
	return parseCreatureReference(name).name.toLowerCase();
}

export async function getCreatureByName(
	name: unknown,
): Promise<BestiaryMonster | null> {
	const reference = parseCreatureReference(name);
	const key = `${reference.name.toLowerCase()}|${reference.source.toUpperCase()}`;
	if (!reference.name) return null;
	if (creatureCache.has(key)) return creatureCache.get(key) || null;

	const results = (await bestiaryApi.searchBestiary(reference.name)) || [];
	const creature =
		results.find((item) => {
			const nameMatches =
				normalizeCreatureName(item.name) === reference.name.toLowerCase();
			if (!nameMatches) return false;
			if (!reference.source) return true;
			return (
				String(item.source || "").toUpperCase() ===
				reference.source.toUpperCase()
			);
		}) ||
		results.find(
			(item) =>
				normalizeCreatureName(item.name) === reference.name.toLowerCase(),
		) ||
		results[0] ||
		null;
	if (creature) creatureCache.set(key, creature);
	return creature;
}

export async function getConditionByName(
	name: unknown,
): Promise<ReferenceRecord | null> {
	const map = await loadConditionsMap();
	return map.get(normalizeConditionName(name)) || null;
}

export async function getDiseaseByName(
	name: unknown,
): Promise<ReferenceRecord | null> {
	const map = await loadDiseasesMap();
	return map.get(normalizeDiseaseName(name)) || null;
}

export async function getVariantRuleByName(
	name: unknown,
): Promise<ReferenceRecord | null> {
	const map = await loadVariantRulesMap();
	return map.get(normalizeVariantRuleName(name)) || null;
}

export async function getSkillByName(
	name: unknown,
): Promise<ReferenceRecord | null> {
	const map = await loadSkillsMap();
	return map.get(normalizeSkillName(name)) || null;
}

export async function getSenseByName(
	name: unknown,
): Promise<ReferenceRecord | null> {
	const map = await loadSensesMap();
	return map.get(normalizeSenseName(name)) || null;
}
