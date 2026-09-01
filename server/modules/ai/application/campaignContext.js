const { asText } = require("../../../ai/AiHistoryWriter");
const {
	getCharacterDisplayName,
	getLocationDisplayName,
} = require("../../../ai/entityDisplayUtils");

function getContextEntityIdentity(entity, getDisplayName) {
	const slug = entity.slug;
	if (slug) return slug;
	const id = entity.id;
	if (id) return id;
	return getDisplayName(entity);
}

function getCharacterContextKey(entity = {}) {
	return asText(getContextEntityIdentity(entity, getCharacterDisplayName));
}

function getLocationContextKey(entity = {}) {
	return asText(getContextEntityIdentity(entity, getLocationDisplayName));
}

function isContextListIncluded(contextConfig) {
	if (!contextConfig) return false;
	if (contextConfig === true) return true;
	if (typeof contextConfig === "object") {
		return contextConfig.included !== false;
	}
	return Boolean(contextConfig);
}

function isAiIgnored(value = {}) {
	return Boolean(value?._aiIgnored);
}

function isVisibleAiContextValue(value) {
	return !isAiIgnored(value);
}

function filterVisibleAiContextValues(values) {
	return values.filter(isVisibleAiContextValue);
}

function isContextItemEntryIncluded([, included]) {
	return included !== false;
}

function getContextItemEntryKey([key]) {
	return key;
}

function getSelectedContextItemKeys(items) {
	return Object.entries(items)
		.filter(isContextItemEntryIncluded)
		.map(getContextItemEntryKey);
}

function hasContextItemEntries(items) {
	return Object.keys(items).length > 0;
}

function isEntityContextExplicitlyExcluded(entityConfig) {
	return entityConfig.included === false;
}

function getEntityContextItems(entityConfig) {
	return entityConfig.items || {};
}

function isEntitySelectedForContext(entity, selected, getKey) {
	return selected.has(getKey(entity));
}

function filterVisibleEntitiesBySelectedKeys(
	visibleEntities,
	selectedKeys,
	getKey,
) {
	const selected = new Set(selectedKeys);
	return visibleEntities.filter((entity) =>
		isEntitySelectedForContext(entity, selected, getKey),
	);
}

function filterEntitiesByContext(entities = [], entityConfig, getKey) {
	const visibleEntities = filterVisibleAiContextValues(entities);
	if (!entityConfig) return [];
	if (entityConfig === true) return visibleEntities;
	if (isEntityContextExplicitlyExcluded(entityConfig)) return [];
	const items = getEntityContextItems(entityConfig);
	const selectedKeys = getSelectedContextItemKeys(items);
	if (!hasContextItemEntries(items)) return visibleEntities;
	return filterVisibleEntitiesBySelectedKeys(
		visibleEntities,
		selectedKeys,
		getKey,
	);
}

function filterNotesForAiContext(notes = []) {
	const normalizedNotes = Array.isArray(notes) ? notes : [];
	return filterVisibleAiContextValues(normalizedNotes);
}

function getAiContextCollection(data, property) {
	return Array.isArray(data[property]) ? data[property] : [];
}

function filterEntityCollectionForAiContext(data, property) {
	return filterVisibleAiContextValues(getAiContextCollection(data, property));
}

function projectSceneForAiContext(scene) {
	return {
		...scene,
		notes: filterNotesForAiContext(scene.notes),
	};
}

function projectScenesForAiContext(data) {
	return getAiContextCollection(data, "scenes").map(projectSceneForAiContext);
}

function filterSessionDataForAiContext(data = {}) {
	return {
		...data,
		notes: filterNotesForAiContext(data.notes),
		npcs: filterEntityCollectionForAiContext(data, "npcs"),
		locations: filterEntityCollectionForAiContext(data, "locations"),
		scenes: projectScenesForAiContext(data),
	};
}

function filterLocationsByContext(locations = [], locationConfig) {
	return filterEntitiesByContext(
		locations,
		locationConfig,
		getLocationContextKey,
	);
}

function appendCampaignNotes(targetContext, campaign, contextConfig) {
	if (!contextConfig.campaignNotes) return;
	targetContext.campaign.notes = filterNotesForAiContext(campaign.notes);
}

function shouldAppendCampaignCharacters(contextConfig) {
	return isContextListIncluded(contextConfig.campaignCharacters);
}

async function appendCampaignCharacters({
	targetContext,
	campaignSlug,
	contextConfig,
	listEntities,
}) {
	const characters = await listEntities(campaignSlug, "characters");
	targetContext.campaign.characters = filterEntitiesByContext(
		characters,
		contextConfig.campaignCharacters,
		getCharacterContextKey,
	);
}

async function appendConfiguredCampaignCharacters(options) {
	if (!shouldAppendCampaignCharacters(options.contextConfig)) return;
	await appendCampaignCharacters(options);
}

function shouldAppendCampaignNpcs(contextConfig) {
	return (
		isContextListIncluded(contextConfig.campaignNpcs) ||
		(contextConfig.campaignNpcs === undefined &&
			isContextListIncluded(contextConfig.campaignCharacters))
	);
}

function getCampaignNpcContextConfig(contextConfig) {
	return contextConfig.campaignNpcs === undefined
		? true
		: contextConfig.campaignNpcs;
}

async function appendCampaignNpcs({
	targetContext,
	campaignSlug,
	contextConfig,
	listEntities,
}) {
	const npcs = await listEntities(campaignSlug, "npc");
	targetContext.campaign.npcs = filterEntitiesByContext(
		npcs,
		getCampaignNpcContextConfig(contextConfig),
		getCharacterContextKey,
	);
}

async function appendConfiguredCampaignNpcs(options) {
	if (!shouldAppendCampaignNpcs(options.contextConfig)) return;
	await appendCampaignNpcs(options);
}

function shouldAppendCampaignLocations(contextConfig) {
	return isContextListIncluded(contextConfig.campaignLocations);
}

async function appendCampaignLocations({
	targetContext,
	campaignSlug,
	contextConfig,
	listEntities,
}) {
	const locations = await listEntities(campaignSlug, "locations");
	targetContext.campaign.locations = filterLocationsByContext(
		locations,
		contextConfig.campaignLocations,
	);
}

async function appendConfiguredCampaignLocations(options) {
	if (!shouldAppendCampaignLocations(options.contextConfig)) return;
	await appendCampaignLocations(options);
}

function hasConfiguredSessions(contextConfig) {
	return Boolean(contextConfig.sessions);
}

function getConfiguredSessionEntries(contextConfig) {
	return Object.entries(contextConfig.sessions);
}

function isConfiguredSessionIncluded(sessionConfig) {
	return Boolean(sessionConfig.included);
}

function createConfiguredSessionContext(slug, sessionConfig, sessionData) {
	return {
		slug,
		fileName: slug,
		name: sessionData.name,
		conf: sessionConfig,
		data: filterSessionDataForAiContext(sessionData.data),
	};
}

async function appendConfiguredSessions({
	targetContext,
	campaignSlug,
	contextConfig,
	readSession,
}) {
	for (const [slug, sessionConfig] of getConfiguredSessionEntries(
		contextConfig,
	)) {
		if (!isConfiguredSessionIncluded(sessionConfig)) continue;
		const sessionData = await readSession(campaignSlug, slug);
		targetContext.sessions.push(
			createConfiguredSessionContext(slug, sessionConfig, sessionData),
		);
	}
}

async function appendConfiguredContextSessions(options) {
	if (!hasConfiguredSessions(options.contextConfig)) return;
	await appendConfiguredSessions(options);
}

function canAppendConfiguredCampaignContext(
	targetContext,
	campaign,
	contextConfig,
) {
	return Boolean(targetContext && campaign && contextConfig);
}

function createAppendConfiguredCampaignContext({ listEntities, readSession }) {
	return async function appendConfiguredCampaignContext(
		targetContext,
		campaignSlug,
		campaign,
		contextConfig,
	) {
		if (
			!canAppendConfiguredCampaignContext(
				targetContext,
				campaign,
				contextConfig,
			)
		) {
			return;
		}
		const options = {
			targetContext,
			campaignSlug,
			contextConfig,
			listEntities,
			readSession,
		};
		appendCampaignNotes(targetContext, campaign, contextConfig);
		await appendConfiguredCampaignCharacters(options);
		await appendConfiguredCampaignNpcs(options);
		await appendConfiguredCampaignLocations(options);
		await appendConfiguredContextSessions(options);
	};
}

module.exports = {
	createAppendConfiguredCampaignContext,
	filterSessionDataForAiContext,
};
