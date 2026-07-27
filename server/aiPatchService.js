const {
	loadApplyAggregate,
	persistApplyAggregate,
} = require("./domains/ai/aiApplyAggregateService");
const {
	mergeAiIgnoredNotes,
} = require("./domains/ai/aiContentNormalizer");
const {
	applyCampaignOperation,
} = require("./domains/ai/campaignPatchService");
const {
	dispatchAiOperations,
} = require("./domains/ai/aiOperationDispatcher");
const {
	entityTypeFromOperation,
	operationScope,
} = require("./domains/ai/entityOperationUtils");
const {
	applyEntityOperation,
} = require("./domains/ai/entityPatchService");
const {
	applyNoteOperation,
} = require("./domains/ai/notePatchService");
const {
	applyCustomMonsterOperations,
	isCustomMonsterOperation,
} = require("./domains/ai/customMonsterPatchService");
const {
	applyEncounterOperation,
} = require("./domains/ai/encounterPatchService");
const {
	applySceneOperation,
	collectSceneEncounterClientIds,
	finalizeSceneEncounterLinks,
} = require("./domains/ai/scenePatchService");
const { coerceAiText: asText } = require("./ai/textUtils");

async function applyAiOperations({
	payload,
	campaignSlug,
	sessionFile,
	encounterId,
	entityScope,
	simplifiedNotes = false,
	permissions = {},
}) {
	const operations = Array.isArray(payload?.operations)
		? payload.operations
		: [];
	const defaultEntityScope =
		sessionFile && entityScope !== "campaign" ? "session" : "campaign";
	const { campaignMeta, sessionData } = await loadApplyAggregate({
		campaignSlug,
		sessionFile,
	});
	const clientIdMap = new Map();
	const warnings = [];
	const linkedEncounterClientIds = collectSceneEncounterClientIds(operations);
	const state = {
		campaignSlug,
		sessionData,
		campaignMeta,
		clientIdMap,
		defaultEntityScope,
		encounterId,
		permissions,
		warnings,
		campaignEntityCache: new Map(),
		linkedEncounterClientIds,
		pendingSceneEncounterLinks: [],
		createdEncounterIds: new Set(),
	};
	const normalizerOptions = { simplifiedNotes };
	const monsterOperations = operations.filter(isCustomMonsterOperation);
	let customBestiaryChange = null;

	if (monsterOperations.length > 0) {
		customBestiaryChange =
			await applyCustomMonsterOperations(monsterOperations);
	}

	let {
		hasAppliedChanges,
		campaignMetaChanged,
		sessionDataChanged,
	} = await dispatchAiOperations({
		operations,
		state,
		normalizerOptions,
		text: asText,
		isCustomMonsterOperation,
		entityTypeFromOperation,
		operationScope,
		applyNoteOperation,
		applyCampaignOperation,
		applySceneOperation,
		applyEncounterOperation,
		applyEntityOperation,
	});

	if (finalizeSceneEncounterLinks(state)) {
		hasAppliedChanges = true;
		sessionDataChanged = true;
	}

	const updated = await persistApplyAggregate({
		campaignSlug,
		sessionFile,
		campaignMeta,
		sessionData,
		campaignMetaChanged,
		sessionDataChanged,
		hasAppliedChanges,
		customBestiaryChange,
	});

	return {
		updated,
		warnings,
		customBestiaryChange,
		changedMonsters: customBestiaryChange?.changedMonsters || [],
	};
}

module.exports = {
	applyAiOperations,
	mergeAiIgnoredNotes,
};
