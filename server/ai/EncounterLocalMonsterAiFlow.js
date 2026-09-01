const { normalizeCustomMonster } = require("../aiCustomMonsterService");
const { asText } = require("./AiHistoryWriter");

const LOCAL_MONSTER_ERROR = "AI did not return any valid creature.";
const MONSTER_ENTITIES = new Set([
	"monster",
	"custom-monster",
	"custommonster",
]);
const MONSTER_OPERATIONS = new Set(["create", "update"]);

function cloneJson(value) {
	return JSON.parse(JSON.stringify(value ?? null));
}

function hasOwn(object, key) {
	return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function getObjectProperty(object, key) {
	if (!object[key] || typeof object[key] !== "object") {
		return { matched: false, value: null };
	}
	return { matched: true, value: object[key] };
}

function getFirstObjectProperty(operation, keys) {
	for (const key of keys) {
		const selection = getObjectProperty(operation, key);
		if (selection.matched) return selection;
	}
	return { matched: false, value: null };
}

function operationData(operation = {}) {
	const selection = getFirstObjectProperty(operation, [
		"data",
		"monster",
		"payload",
	]);
	return selection.matched ? selection.value : operation;
}

function operationPatch(operation = {}) {
	const selection = getFirstObjectProperty(operation, ["patch", "changes"]);
	return selection.matched ? selection.value : operationData(operation);
}

function normalizeOperationValue(value) {
	return asText(value).toLowerCase();
}

function isMonsterOperation(operation) {
	const entity = normalizeOperationValue(operation?.entity);
	const op = normalizeOperationValue(operation?.op);
	return (
		MONSTER_ENTITIES.has(entity) && MONSTER_OPERATIONS.has(op)
	);
}

function getGeneratedOperations(generatedContent) {
	return Array.isArray(generatedContent.operations)
		? generatedContent.operations
		: [];
}

function findMonsterOperation(generatedContent = {}) {
	return getGeneratedOperations(generatedContent).find(isMonsterOperation);
}

function getUpdatedMonsterId(operation, targetMonster) {
	return targetMonster.id || operation.id || operation.targetId;
}

function getUpdatedMonsterName(operation, targetMonster) {
	return (
		operationPatch(operation).name ||
		targetMonster.name ||
		operation.name ||
		operation.targetName
	);
}

function createUpdatedMonsterInput(operation, targetMonster) {
	return {
		...targetMonster,
		...operationPatch(operation),
		id: getUpdatedMonsterId(operation, targetMonster),
		name: getUpdatedMonsterName(operation, targetMonster),
	};
}

function createNewMonsterInput(operation, targetMonster) {
	return {
		...targetMonster,
		...operationData(operation),
		id: operationData(operation).id || targetMonster.id,
		name: operationData(operation).name || targetMonster.name,
	};
}

function createRawMonsterInput(operation, targetMonster) {
	return normalizeOperationValue(operation.op) === "update"
		? createUpdatedMonsterInput(operation, targetMonster)
		: createNewMonsterInput(operation, targetMonster);
}

function inheritOriginalBestiaryName(raw, targetMonster) {
	if (hasOwn(raw, "originalBestiaryName")) return;
	raw.originalBestiaryName =
		targetMonster.originalBestiaryName || targetMonster.name;
}

function inheritTargetImage(raw, targetMonster) {
	if (hasOwn(raw, "imageUrl") || !targetMonster.imageUrl) return;
	raw.imageUrl = targetMonster.imageUrl;
}

function buildLocalEncounterMonsterFromOperation(
	generatedContent,
	targetMonster,
) {
	const operation = findMonsterOperation(generatedContent);
	if (!operation || !targetMonster) return null;
	const raw = createRawMonsterInput(operation, targetMonster);
	inheritOriginalBestiaryName(raw, targetMonster);
	inheritTargetImage(raw, targetMonster);
	return normalizeCustomMonster(raw);
}

function parseMonsterHpAverage(monster) {
	if (!monster.hp || typeof monster.hp !== "object") return NaN;
	return Number.parseInt(monster.hp.average, 10);
}

function firstFiniteNumber(values) {
	const result = values.find(Number.isFinite);
	return result === undefined ? 0 : result;
}

function getMonsterMaxHp(monster = {}, fallback = 0) {
	return firstFiniteNumber([
		parseMonsterHpAverage(monster),
		Number.parseInt(monster.hit_points, 10),
		Number.parseInt(fallback, 10),
	]);
}

function hasSessionRouteTarget({
	campaignSlug,
	sessionFile,
	encounterId,
	targetInstanceId,
}) {
	return Boolean(
		campaignSlug &&
			sessionFile &&
			encounterId &&
			targetInstanceId,
	);
}

function hasSessionChangeData({ beforeSession, nextMonster }) {
	return Boolean(beforeSession && nextMonster);
}

function hasSessionChangeTarget(options) {
	return hasSessionRouteTarget(options) && hasSessionChangeData(options);
}

function findTargetEncounter(afterSession, encounterId) {
	return (afterSession.data?.encounters || []).find(
		(item) => asText(item?.id) === asText(encounterId),
	);
}

function getEncounterMonsters(encounter) {
	if (!encounter) return null;
	return Array.isArray(encounter.monsters) ? encounter.monsters : null;
}

function isTargetParticipant(monster, targetInstanceId) {
	return asText(monster?.instanceId) === asText(targetInstanceId);
}

function getSafeCurrentHp(monster, nextMaxHp) {
	const currentHp = Number.parseInt(monster.currentHp, 10);
	return Number.isFinite(currentHp)
		? Math.min(currentHp, nextMaxHp || currentHp)
		: nextMaxHp;
}

function createLocalParticipant(monster, nextMonster, targetInstanceId) {
	const nextMaxHp = getMonsterMaxHp(nextMonster, monster.hit_points);
	return {
		...nextMonster,
		instanceId: targetInstanceId,
		source: monster.source,
		originalBestiaryName:
			monster.originalBestiaryName ||
			nextMonster.originalBestiaryName ||
			nextMonster.name,
		_localOverride: true,
		currentHp: getSafeCurrentHp(monster, nextMaxHp),
		hit_points: nextMaxHp,
	};
}

function replaceTargetParticipants(monsters, nextMonster, targetInstanceId) {
	let changed = false;
	const projected = monsters.map((monster) => {
		if (!isTargetParticipant(monster, targetInstanceId)) {
			return monster;
		}
		changed = true;
		return createLocalParticipant(
			monster,
			nextMonster,
			targetInstanceId,
		);
	});
	return { projected, changed };
}

function createSessionChangeResource({
	campaignSlug,
	sessionFile,
	beforeSession,
	afterSession,
}) {
	return {
		id: `session:${sessionFile}`,
		kind: "session",
		campaign: campaignSlug,
		fileName: sessionFile,
		label: `${campaignSlug}/sessions/${sessionFile}`,
		before: cloneJson(beforeSession),
		after: afterSession,
	};
}

function buildLocalEncounterMonsterSessionChange({
	campaignSlug,
	sessionFile,
	encounterId,
	targetInstanceId,
	beforeSession,
	nextMonster,
}) {
	const options = {
		campaignSlug,
		sessionFile,
		encounterId,
		targetInstanceId,
		beforeSession,
		nextMonster,
	};
	if (!hasSessionChangeTarget(options)) return null;
	const afterSession = cloneJson(beforeSession);
	const encounter = findTargetEncounter(afterSession, encounterId);
	const monsters = getEncounterMonsters(encounter);
	if (!monsters) return null;
	const replacement = replaceTargetParticipants(
		monsters,
		nextMonster,
		targetInstanceId,
	);
	if (!replacement.changed) return null;
	encounter.monsters = replacement.projected;
	return createSessionChangeResource({
		campaignSlug,
		sessionFile,
		beforeSession,
		afterSession,
	});
}

function getFlowPath(payload) {
	return payload.path || {};
}

function isEncounterLocalFlowEnabled(payload = {}) {
	const path = getFlowPath(payload);
	return (
		payload.historyMode === "encounter" &&
		asText(path.campaign) &&
		asText(path.session) &&
		asText(path.encounter)
	);
}

function getTargetInstanceId(payload, customMonsterTarget) {
	return asText(payload.targetInstanceId || customMonsterTarget?.instanceId);
}

function createResponsePath(path) {
	return {
		campaign: asText(path.campaign),
		session: asText(path.session),
		encounter: asText(path.encounter),
	};
}

function createLocalChangeInput({
	path,
	targetInstanceId,
	customSession,
	changedMonster,
}) {
	return {
		campaignSlug: asText(path.campaign),
		sessionFile: asText(path.session),
		encounterId: asText(path.encounter),
		targetInstanceId,
		beforeSession: customSession,
		nextMonster: changedMonster,
	};
}

async function createInvalidMonsterResponse(
	historyWriter,
	payload,
	generatedContent,
) {
	const aiResponse = await historyWriter.saveFailed(
		payload,
		{ message: LOCAL_MONSTER_ERROR },
		400,
	);
	return {
		status: 400,
		body: {
			error: LOCAL_MONSTER_ERROR,
			generated: generatedContent,
			aiResponse,
		},
	};
}

function createSnapshotInput({
	payload,
	modelName,
	historyUserInstructions,
	responsePath,
	customContextData,
	responseLanguage,
	globalBasePrompt,
	imagePromptBasePrompt,
	campaignBasePrompt,
}) {
	return {
		type: payload.type,
		modelName,
		userInstructions: historyUserInstructions,
		path: responsePath,
		attachedImages: payload.attachedImages,
		attachedFiles: payload.attachedFiles,
		parseAIResponse: true,
		shouldParseAIResponse: true,
		generateCharacters: false,
		generateNpcs: false,
		generateLocations: false,
		generateEncounters: false,
		generateCustomMonsters: false,
		entityScope: "custom-bestiary",
		contextConfig: null,
		contextData: customContextData,
		language: responseLanguage,
		globalBasePrompt,
		imagePromptBasePrompt,
		campaignBasePrompt,
	};
}

function createHistoryPayload({
	input,
	responsePath,
	localEncounterResource,
	flow,
}) {
	const responseResources = [localEncounterResource];
	return {
		text: flow.historyWriter.formatGeneratedContent(input.generatedContent),
		path: responsePath,
		type: "custom-monster",
		modelName: input.modelName,
		language: input.responseLanguage,
		userInstructions: input.historyUserInstructions,
		request: flow.historyWriter.buildRequestSnapshot(
			createSnapshotInput({ ...input, responsePath }),
		),
		retryPayload: flow.historyWriter.cloneRetryPayload(input.payload),
		changes: {
			resources: responseResources,
			summary: flow.buildAiChangeSummary(responseResources),
		},
		applyState: "draft",
		appliedAt: null,
	};
}

function createSuccessfulDraftResponse(generatedContent, changedMonster, aiResponse) {
	return {
		status: 200,
		body: {
			generated: {
				...generatedContent,
				monsters: [changedMonster],
			},
			draft: true,
			aiResponse,
		},
	};
}

async function executeCreateDraft(input, flow) {
	const path = getFlowPath(input.payload);
	const targetInstanceId = getTargetInstanceId(
		input.payload,
		input.customMonsterTarget,
	);
	const changedMonster = buildLocalEncounterMonsterFromOperation(
		input.generatedContent,
		input.customMonsterTarget,
	);
	const localEncounterResource = buildLocalEncounterMonsterSessionChange(
		createLocalChangeInput({
			path,
			targetInstanceId,
			customSession: input.customSession,
			changedMonster,
		}),
	);
	if (!changedMonster || !localEncounterResource) {
		return createInvalidMonsterResponse(
			flow.historyWriter,
			input.payload,
			input.generatedContent,
		);
	}
	const responsePath = createResponsePath(path);
	const historyPayload = createHistoryPayload({
		input,
		responsePath,
		localEncounterResource,
		flow,
	});
	const aiResponse = await flow.historyWriter.addResponse(historyPayload);
	return createSuccessfulDraftResponse(
		input.generatedContent,
		changedMonster,
		aiResponse,
	);
}

class EncounterLocalMonsterAiFlow {
	constructor({ historyWriter, buildAiChangeSummary }) {
		this.historyWriter = historyWriter;
		this.buildAiChangeSummary = buildAiChangeSummary;
	}

	isEnabled(payload = {}) {
		return isEncounterLocalFlowEnabled(payload);
	}

	async createDraft({
		payload,
		generatedContent,
		customMonsterTarget,
		customSession,
		modelName,
		responseLanguage,
		historyUserInstructions,
		customContextData,
		globalBasePrompt,
		imagePromptBasePrompt,
		campaignBasePrompt,
	}) {
		return executeCreateDraft(
			{
				payload,
				generatedContent,
				customMonsterTarget,
				customSession,
				modelName,
				responseLanguage,
				historyUserInstructions,
				customContextData,
				globalBasePrompt,
				imagePromptBasePrompt,
				campaignBasePrompt,
			},
			this,
		);
	}
}

module.exports = {
	EncounterLocalMonsterAiFlow,
	buildLocalEncounterMonsterSessionChange,
};
