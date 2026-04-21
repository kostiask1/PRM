import { getConditionByName, getSpellByName } from "./referencePreview.js";

export async function resolveSpellInput(spellOrName) {
	if (spellOrName && typeof spellOrName === "object") {
		return spellOrName;
	}
	if (!spellOrName || typeof spellOrName !== "string") {
		return null;
	}
	const cleanName = spellOrName.split("|")[0].trim();
	if (!cleanName) return null;
	return getSpellByName(cleanName);
}

export async function resolveConditionInput(nameOrCondition) {
	if (nameOrCondition && typeof nameOrCondition === "object") {
		if (typeof nameOrCondition.name === "string" && nameOrCondition.entries) {
			return nameOrCondition;
		}
	}
	const name =
		typeof nameOrCondition === "string"
			? nameOrCondition
			: nameOrCondition?.name || "";
	if (!name) return null;
	return getConditionByName(name);
}
