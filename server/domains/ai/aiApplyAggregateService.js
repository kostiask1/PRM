const { writeJson } = require("../../infrastructure/jsonFileStore");
const {
	campaignMetaPath,
	sessionPath,
} = require("../../infrastructure/storagePaths");
const campaignRepository = require("../campaign/campaignRepository");
const sessionRepository = require("../session/sessionRepository");

function createAiApplyAggregateService({
	readCampaign = campaignRepository.readCampaign,
	readSession = sessionRepository.readSession,
	writeAggregateJson = writeJson,
	getCampaignMetaPath = campaignMetaPath,
	getSessionPath = sessionPath,
} = {}) {
	async function loadApplyAggregate({ campaignSlug, sessionFile }) {
		const campaignMeta =
			campaignSlug && campaignSlug !== "bestiary"
				? await readCampaign(campaignSlug)
				: null;
		const sessionData =
			campaignSlug && sessionFile
				? await readSession(campaignSlug, sessionFile).catch(() => null)
				: null;

		return { campaignMeta, sessionData };
	}

	async function persistApplyAggregate({
		campaignSlug,
		sessionFile,
		campaignMeta,
		sessionData,
		campaignMetaChanged,
		sessionDataChanged,
		hasAppliedChanges,
		customBestiaryChange,
	}) {
		if (campaignMetaChanged && campaignMeta) {
			await writeAggregateJson(
				getCampaignMetaPath(campaignSlug),
				campaignMeta,
			);
		}

		if (sessionDataChanged && sessionData) {
			await writeAggregateJson(
				getSessionPath(campaignSlug, sessionFile),
				sessionData,
			);
			return { ...sessionData, fileName: sessionFile };
		}
		if (hasAppliedChanges && campaignMeta) {
			return campaignMeta;
		}
		if (customBestiaryChange?.hasChanges && !campaignMeta) {
			return { monsters: customBestiaryChange.after };
		}
		return null;
	}

	return {
		loadApplyAggregate,
		persistApplyAggregate,
	};
}

const {
	loadApplyAggregate,
	persistApplyAggregate,
} = createAiApplyAggregateService();

module.exports = {
	createAiApplyAggregateService,
	loadApplyAggregate,
	persistApplyAggregate,
};
