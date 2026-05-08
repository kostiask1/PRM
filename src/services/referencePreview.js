import { api } from "../api.js";
import { loadConditionsMap, normalizeConditionName } from "./conditions.js";

const spellCache = new Map();

function normalizeSpellName(name) {
	return String(name || "")
		.split("|")[0]
		.trim()
		.toLowerCase();
}

export async function getSpellByName(name) {
	const key = normalizeSpellName(name);
	if (!key) return null;
	if (spellCache.has(key)) return spellCache.get(key);

	const results = await api.searchSpells({ name: key });
	const spell =
		results.find((item) => normalizeSpellName(item.name) === key) ||
		results[0] ||
		null;

	if (spell) spellCache.set(key, spell);
	return spell;
}

export async function getConditionByName(name) {
	const map = await loadConditionsMap();
	return map.get(normalizeConditionName(name)) || null;
}
