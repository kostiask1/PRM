const { campaignSlug } = require("../../infrastructure/storagePaths");
const entityRepository = require("../entity/entityRepository");

function createCampaignEntityGateway({
	createSlug = campaignSlug,
	repository = entityRepository,
} = {}) {
	async function readCampaignEntityList(campaignSlugValue, type) {
		return repository.listEntities(campaignSlugValue, type);
	}

	async function writeCampaignEntity(
		campaignSlugValue,
		type,
		payload,
		existing = null,
	) {
		const baseName =
			type === "locations"
				? payload.name || "locations"
				: payload.firstName || payload.name || type;
		const entitySlug =
			existing?.slug ||
			payload.slug ||
			(await repository.ensureUniqueEntitySlug(
				campaignSlugValue,
				type,
				createSlug(baseName),
			));
		return repository.writeEntity(
			campaignSlugValue,
			type,
			entitySlug,
			{
				...payload,
				slug: entitySlug,
			},
		);
	}

	return {
		readCampaignEntityList,
		writeCampaignEntity,
	};
}

const {
	readCampaignEntityList,
	writeCampaignEntity,
} = createCampaignEntityGateway();

module.exports = {
	createCampaignEntityGateway,
	readCampaignEntityList,
	writeCampaignEntity,
};
