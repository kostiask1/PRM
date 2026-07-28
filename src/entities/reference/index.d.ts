export {
	referenceApi,
	type ReferenceRecord,
} from "./api/referenceApi.ts";
export * from "./model.d.ts";
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
