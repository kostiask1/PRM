const {
	createAiHistoryRepositoryPort,
} = require("../application/ports/aiHistoryRepository");

function createFileAiHistoryRepository(storage) {
	return createAiHistoryRepositoryPort({
		list: (campaignSlug) => storage.readAiResponses(campaignSlug),
		stats: (campaignSlug) => storage.getAiResponsesStorageStats(campaignSlug),
		get: (campaignSlug, id) => storage.getAiResponse(campaignSlug, id),
		add: (entry) => storage.addAiResponse(entry),
		update: (campaignSlug, id, patch) =>
			storage.updateAiResponse(campaignSlug, id, patch),
		delete: (campaignSlug, id) => storage.deleteAiResponse(campaignSlug, id),
		clear: (campaignSlug) => storage.clearAiResponses(campaignSlug),
	});
}

module.exports = { createFileAiHistoryRepository };
