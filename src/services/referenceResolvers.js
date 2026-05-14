import {
	getConditionByName,
	getDiseaseByName,
	getSpellByName,
} from "./referencePreview.js";

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

export async function resolveDiseaseInput(nameOrDisease) {
	if (nameOrDisease && typeof nameOrDisease === "object") {
		if (typeof nameOrDisease.name === "string" && nameOrDisease.entries) {
			return nameOrDisease;
		}
	}
	const name =
		typeof nameOrDisease === "string"
			? nameOrDisease
			: nameOrDisease?.name || "";
	if (!name) return null;
	return getDiseaseByName(name);
}
