export {
	referenceApi,
	type ReferenceRecord,
} from "./api/referenceApi.ts";
export * from "./model.d.ts";
export {
	loadDiseasesMap,
	normalizeDiseaseName,
} from "./model/diseases.ts";
export {
	loadSensesMap,
	normalizeSenseName,
} from "./model/senses.ts";
export {
	loadSkillsMap,
	normalizeSkillName,
} from "./model/skills.ts";
export {
	loadVariantRulesMap,
	normalizeVariantRuleName,
} from "./model/variantRules.ts";
export {
	getCampaignIgnoreSourcesList,
	getIgnoreSourcesListFromSelectedSources,
	getSelectedSourcesFromIgnoreList,
	normalizeIgnoreSourcesList,
	normalizeSourceCode,
	type CampaignSourceSettings,
} from "./model/sourceIgnore.ts";
export {
	formatSourceLabel,
	getSourceFullName,
	type SourceLabelOptions,
} from "./model/sourceNames.ts";
export {
	getSpellMeta,
	type SpellMetaRecord,
} from "./model/spellMeta.ts";
