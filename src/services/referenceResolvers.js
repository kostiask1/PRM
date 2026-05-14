import {
	getConditionByName,
	getDiseaseByName,
	getSenseByName,
	getSkillByName,
	getSpellByName,
	getVariantRuleByName,
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

export async function resolveVariantRuleInput(nameOrRule) {
	if (nameOrRule && typeof nameOrRule === "object") {
		if (typeof nameOrRule.name === "string" && nameOrRule.entries) {
			return nameOrRule;
		}
	}
	const name =
		typeof nameOrRule === "string" ? nameOrRule : nameOrRule?.name || "";
	if (!name) return null;
	return getVariantRuleByName(name);
}

export async function resolveSkillInput(nameOrSkill) {
	if (nameOrSkill && typeof nameOrSkill === "object") {
		if (typeof nameOrSkill.name === "string" && nameOrSkill.entries) {
			return nameOrSkill;
		}
	}
	const name =
		typeof nameOrSkill === "string" ? nameOrSkill : nameOrSkill?.name || "";
	if (!name) return null;
	return getSkillByName(name);
}

export async function resolveSenseInput(nameOrSense) {
	if (nameOrSense && typeof nameOrSense === "object") {
		if (typeof nameOrSense.name === "string" && nameOrSense.entries) {
			return nameOrSense;
		}
	}
	const name =
		typeof nameOrSense === "string" ? nameOrSense : nameOrSense?.name || "";
	if (!name) return null;
	return getSenseByName(name);
}
