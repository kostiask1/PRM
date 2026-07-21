const { asText } = require("../../../ai/AiHistoryWriter");

function hasMissingMonsterId(monsters) {
	return monsters.some((monster) => !asText(monster?.id));
}

async function normalizeCustomBestiary({
	customBestiary,
	writeCustomBestiaryMonsters,
}) {
	if (
		!Array.isArray(customBestiary.monster) ||
		!hasMissingMonsterId(customBestiary.monster)
	) {
		return customBestiary;
	}

	const normalizedMonsters = await writeCustomBestiaryMonsters(
		customBestiary.monster,
	);
	return { ...customBestiary, monster: normalizedMonsters };
}

function getCustomMonsters(customBestiary) {
	return Array.isArray(customBestiary.monster) ? customBestiary.monster : [];
}

function projectMonsterContext(monster) {
	return {
		id: monster.id,
		name: monster.name,
		source: monster.source,
		type: monster.type,
		cr: monster.cr,
	};
}

function createCustomContextData(beforeCustomMonsters) {
	return {
		campaign: {},
		sessions: [],
		customBestiary: {
			monsters: beforeCustomMonsters.map(projectMonsterContext),
		},
	};
}

function isCustomMonsterTarget(value) {
	return Boolean(value) && typeof value === "object";
}

function findFullCustomMonsterTarget(monsters, customMonsterTarget) {
	const targetId = asText(customMonsterTarget.id);
	const targetName = asText(customMonsterTarget.name).toLowerCase();
	return monsters.find(
		(monster) =>
			(targetId && asText(monster?.id) === targetId) ||
			asText(monster?.name).toLowerCase() === targetName,
	);
}

function attachSelectedMonster({
	customContextData,
	beforeCustomMonsters,
	customMonsterTarget,
	customMonsterMode,
}) {
	if (!isCustomMonsterTarget(customMonsterTarget)) {
		return;
	}

	const fullTarget = findFullCustomMonsterTarget(
		beforeCustomMonsters,
		customMonsterTarget,
	);
	customContextData.customBestiary.selectedMonster =
		fullTarget || customMonsterTarget;
	customContextData.customBestiary.selectedMonsterMode =
		customMonsterMode === "create-based" ? "create-based" : "edit";
}

function shouldLoadCampaignContext(requestPath) {
	return Boolean(
		requestPath?.campaign && requestPath.campaign !== "bestiary",
	);
}

async function readOptionalCampaign(readCampaign, campaignId) {
	return readCampaign(campaignId).catch(() => null);
}

async function readOptionalSession(readSession, campaignId, sessionId) {
	return readSession(campaignId, sessionId).catch(() => null);
}

async function loadCampaignContext({
	requestPath,
	contextConfig,
	customContextData,
	readCampaign,
	readSession,
	appendCampaignContext,
}) {
	if (!shouldLoadCampaignContext(requestPath)) {
		return { customCampaign: null, customSession: null };
	}

	const customCampaign = await readOptionalCampaign(
		readCampaign,
		requestPath.campaign,
	);
	const customSession = await readOptionalSession(
		readSession,
		requestPath.campaign,
		requestPath.session,
	);
	await appendCampaignContext(
		customContextData,
		requestPath.campaign,
		customCampaign,
		contextConfig,
	);
	return { customCampaign, customSession };
}

async function loadGenerationContext({
	payload,
	preparedRequest,
	readCustomBestiary,
	writeCustomBestiaryMonsters,
	readCampaign,
	readSession,
	appendCampaignContext,
}) {
	const initialCustomBestiary = await readCustomBestiary();
	const customBestiary = await normalizeCustomBestiary({
		customBestiary: initialCustomBestiary,
		writeCustomBestiaryMonsters,
	});
	const beforeCustomMonsters = getCustomMonsters(customBestiary);
	const customContextData = createCustomContextData(beforeCustomMonsters);
	attachSelectedMonster({
		customContextData,
		beforeCustomMonsters,
		customMonsterTarget: payload.customMonsterTarget,
		customMonsterMode: payload.customMonsterMode,
	});
	const campaignContext = await loadCampaignContext({
		requestPath: preparedRequest.requestPath,
		contextConfig: payload.contextConfig,
		customContextData,
		readCampaign,
		readSession,
		appendCampaignContext,
	});

	return {
		beforeCustomMonsters,
		customContextData,
		...campaignContext,
	};
}

function createGenerationInput({ payload, preparedRequest, context }) {
	return {
		type: "custom-monster",
		userInstructions: payload.userInstructions,
		modelName: payload.modelName,
		attachedImages: payload.attachedImages,
		attachedFiles: payload.attachedFiles,
		contextData: context.customContextData,
		generateCharacters: false,
		generateNpcs: false,
		generateLocations: false,
		generateEncounters: false,
		entityScope: "custom-bestiary",
		language: preparedRequest.responseLanguage,
		simplifiedNotes: preparedRequest.simplifiedNotesEnabled,
		globalBasePrompt: preparedRequest.globalBasePrompt,
		imagePromptBasePrompt: preparedRequest.imagePromptBasePrompt,
		campaignBasePrompt: preparedRequest.campaignBasePrompt,
		session: context.customSession,
		campaign: context.customCampaign,
		encounterId: preparedRequest.requestPath?.encounter,
		parseAIResponse: true,
	};
}

async function createFailedResponse({
	payload,
	generatedContent,
	historyWriter,
}) {
	const aiResponse = await historyWriter.saveFailed(payload, generatedContent, 500);
	return { status: 500, body: { ...generatedContent, aiResponse } };
}

function prepareGeneratedContent({
	generatedContent,
	customMonsterTarget,
	fillCurrentTargetIds,
	assertGeneratedContent,
}) {
	fillCurrentTargetIds(generatedContent, {
		path: { campaign: "bestiary" },
		sceneId: null,
		customMonsterTarget,
	});
	assertGeneratedContent(generatedContent, {
		type: "custom-monster",
		requireOperations: true,
	});
}

function createLocalDraftInput({
	payload,
	preparedRequest,
	historyUserInstructions,
	generatedContent,
	context,
}) {
	return {
		payload,
		generatedContent,
		customMonsterTarget: payload.customMonsterTarget,
		customSession: context.customSession,
		modelName: payload.modelName,
		responseLanguage: preparedRequest.responseLanguage,
		historyUserInstructions,
		customContextData: context.customContextData,
		globalBasePrompt: preparedRequest.globalBasePrompt,
		imagePromptBasePrompt: preparedRequest.imagePromptBasePrompt,
		campaignBasePrompt: preparedRequest.campaignBasePrompt,
	};
}

function createCustomBestiaryDraftInput({
	payload,
	preparedRequest,
	historyUserInstructions,
	generatedContent,
	context,
}) {
	return {
		payload,
		generatedContent,
		beforeCustomMonsters: context.beforeCustomMonsters,
		modelName: payload.modelName,
		responseLanguage: preparedRequest.responseLanguage,
		historyUserInstructions,
		customContextData: context.customContextData,
		simplifiedNotesEnabled: preparedRequest.simplifiedNotesEnabled,
		globalBasePrompt: preparedRequest.globalBasePrompt,
		imagePromptBasePrompt: preparedRequest.imagePromptBasePrompt,
		campaignBasePrompt: preparedRequest.campaignBasePrompt,
	};
}

function createDraft({
	payload,
	preparedRequest,
	historyUserInstructions,
	generatedContent,
	context,
	encounterLocalFlow,
	customMonsterFlow,
}) {
	if (encounterLocalFlow.isEnabled(payload)) {
		return encounterLocalFlow.createDraft(
			createLocalDraftInput({
				payload,
				preparedRequest,
				historyUserInstructions,
				generatedContent,
				context,
			}),
		);
	}

	return customMonsterFlow.createDraft(
		createCustomBestiaryDraftInput({
			payload,
			preparedRequest,
			historyUserInstructions,
			generatedContent,
			context,
		}),
	);
}

async function executeGenerateCustomMonster({
	payload,
	preparedRequest,
	historyUserInstructions,
	dependencies,
}) {
	const context = await loadGenerationContext({
		payload,
		preparedRequest,
		...dependencies,
	});
	const generatedContent = await dependencies.generateContent(
		createGenerationInput({ payload, preparedRequest, context }),
	);
	if (generatedContent?.error) {
		return createFailedResponse({
			payload,
			generatedContent,
			historyWriter: dependencies.historyWriter,
		});
	}

	prepareGeneratedContent({
		generatedContent,
		customMonsterTarget: payload.customMonsterTarget,
		fillCurrentTargetIds: dependencies.fillCurrentTargetIds,
		assertGeneratedContent: dependencies.assertGeneratedContent,
	});
	return createDraft({
		payload,
		preparedRequest,
		historyUserInstructions,
		generatedContent,
		context,
		encounterLocalFlow: dependencies.encounterLocalFlow,
		customMonsterFlow: dependencies.customMonsterFlow,
	});
}

function createGenerateCustomMonster(dependencies) {
	return function generateCustomMonster(request) {
		return executeGenerateCustomMonster({ ...request, dependencies });
	};
}

module.exports = { createGenerateCustomMonster };
