const { asText } = require("../../../ai/AiHistoryWriter");
const {
	getCharacterDisplayName,
	getLocationDisplayName,
} = require("../../../ai/entityDisplayUtils");

function getCharacterContextKey(entity = {}) {
	return asText(entity.slug || entity.id || getCharacterDisplayName(entity));
}

function getLocationContextKey(entity = {}) {
	return asText(entity.slug || entity.id || getLocationDisplayName(entity));
}

function isContextListIncluded(contextConfig) {
	if (!contextConfig) return false;
	if (contextConfig === true) return true;
	if (typeof contextConfig !== "object") return Boolean(contextConfig);
	return contextConfig.included !== false;
}

function isAiIgnored(value = {}) {
	return Boolean(value?._aiIgnored);
}

function filterEntitiesByContext(entities = [], entityConfig, getKey) {
	const visibleEntities = entities.filter((entity) => !isAiIgnored(entity));
	if (!entityConfig) return [];
	if (entityConfig === true) return visibleEntities;
	if (entityConfig.included === false) return [];

	const items = entityConfig.items || {};
	const selectedKeys = Object.entries(items)
		.filter(([, included]) => included !== false)
		.map(([key]) => key);

	if (Object.keys(items).length === 0) return visibleEntities;

	const selected = new Set(selectedKeys);
	return visibleEntities.filter((entity) => selected.has(getKey(entity)));
}

function filterNotesForAiContext(notes = []) {
	return (Array.isArray(notes) ? notes : []).filter(
		(note) => !isAiIgnored(note),
	);
}

function filterSessionDataForAiContext(data = {}) {
	return {
		...data,
		notes: filterNotesForAiContext(data.notes),
		npcs: (Array.isArray(data.npcs) ? data.npcs : []).filter(
			(entity) => !isAiIgnored(entity),
		),
		locations: (Array.isArray(data.locations) ? data.locations : []).filter(
			(entity) => !isAiIgnored(entity),
		),
		scenes: (Array.isArray(data.scenes) ? data.scenes : []).map((scene) => ({
			...scene,
			notes: filterNotesForAiContext(scene.notes),
		})),
	};
}

function filterLocationsByContext(locations = [], locationConfig) {
	return filterEntitiesByContext(
		locations,
		locationConfig,
		getLocationContextKey,
	);
}

function createAppendConfiguredCampaignContext({ listEntities, readSession }) {
	return async function appendConfiguredCampaignContext(
	targetContext,
	campaignSlug,
	campaign,
	contextConfig,
) {
	if (!targetContext || !campaign || !contextConfig) return;
	if (contextConfig.campaignNotes) {
		targetContext.campaign.notes = filterNotesForAiContext(campaign.notes);
	}
	if (isContextListIncluded(contextConfig.campaignCharacters)) {
		const chars = await listEntities(campaignSlug, "characters");
		targetContext.campaign.characters = filterEntitiesByContext(
			chars,
			contextConfig.campaignCharacters,
			getCharacterContextKey,
		);
	}
	if (
		isContextListIncluded(contextConfig.campaignNpcs) ||
		(contextConfig.campaignNpcs === undefined &&
			isContextListIncluded(contextConfig.campaignCharacters))
	) {
		const npcs = await listEntities(campaignSlug, "npc");
		targetContext.campaign.npcs = filterEntitiesByContext(
			npcs,
			contextConfig.campaignNpcs === undefined
				? true
				: contextConfig.campaignNpcs,
			getCharacterContextKey,
		);
	}
	if (isContextListIncluded(contextConfig.campaignLocations)) {
		const locations = await listEntities(campaignSlug, "locations");
		targetContext.campaign.locations = filterLocationsByContext(
			locations,
			contextConfig.campaignLocations,
		);
	}

	if (contextConfig.sessions) {
		for (const [slug, conf] of Object.entries(contextConfig.sessions)) {
			if (!conf.included) continue;
			const sData = await readSession(campaignSlug, slug);
			targetContext.sessions.push({
				slug,
				fileName: slug,
				name: sData.name,
				conf,
				data: filterSessionDataForAiContext(sData.data),
			});
		}
	}
}
}

module.exports = {
	createAppendConfiguredCampaignContext,
	filterSessionDataForAiContext,
};
