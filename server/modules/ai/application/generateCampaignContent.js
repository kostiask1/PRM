const { asText } = require("../../../ai/AiHistoryWriter");

function createMissingCampaignResponse() {
	return { status: 400, body: { error: "path.campaign is required." } };
}

function hasCampaignPath(requestPath) {
	return Boolean(requestPath?.campaign);
}

async function readOptionalSession(readSession, requestPath) {
	return readSession(requestPath.campaign, requestPath.session).catch(() => null);
}

function createCampaignContextData() {
	return { campaign: {}, sessions: [] };
}

function shouldAttachCurrentSession(entityTargetScope, session) {
	return entityTargetScope === "mixed" && session;
}

function attachCurrentSessionContext(
	contextData,
	requestPath,
	session,
	entityTargetScope,
	filterSessionData,
) {
	if (!shouldAttachCurrentSession(entityTargetScope, session)) return;
	contextData.currentSession = {
		slug: requestPath.session,
		fileName: requestPath.session,
		name: session.name,
		data: filterSessionData(session.data),
	};
}

function shouldReadCustomBestiary(requestPath, encounterGenerationEnabled) {
	return requestPath?.encounter || encounterGenerationEnabled;
}

function getCustomBestiaryMonsters(customBestiary) {
	return Array.isArray(customBestiary.monster) ? customBestiary.monster : [];
}

function getCustomBestiaryMonsterNames(customBestiary) {
	return getCustomBestiaryMonsters(customBestiary)
		.map((monster) => asText(monster?.name))
		.filter(Boolean);
}

function attachCustomBestiaryContext(contextData, monsterNames) {
	if (monsterNames.length > 0) {
		contextData.customBestiary = { monsterNames };
	}
}

async function appendCustomBestiaryContext(
	contextData,
	requestPath,
	encounterGenerationEnabled,
	readCustomBestiary,
) {
	if (!shouldReadCustomBestiary(requestPath, encounterGenerationEnabled)) return;
	const customBestiary = await readCustomBestiary();
	attachCustomBestiaryContext(
		contextData,
		getCustomBestiaryMonsterNames(customBestiary),
	);
}

async function loadCampaignGenerationContext(dependencies, request) {
	const { payload, preparedRequest } = request;
	const { requestPath, entityTargetScope, encounterGenerationEnabled } =
		preparedRequest;
	const campaign = await dependencies.readCampaign(requestPath.campaign);
	const session = await readOptionalSession(dependencies.readSession, requestPath);
	const contextData = createCampaignContextData();
	await dependencies.appendCampaignContext(
		contextData,
		requestPath.campaign,
		campaign,
		payload.contextConfig,
	);
	attachCurrentSessionContext(
		contextData,
		requestPath,
		session,
		entityTargetScope,
		dependencies.filterSessionData,
	);
	await appendCustomBestiaryContext(
		contextData,
		requestPath,
		encounterGenerationEnabled,
		dependencies.readCustomBestiary,
	);
	return { campaign, session, contextData };
}

function createGenerationInput(request, loaded) {
	const { payload, preparedRequest } = request;
	return {
		type: payload.type,
		session: loaded.session,
		campaign: loaded.campaign,
		userInstructions: payload.userInstructions,
		modelName: payload.modelName,
		encounterId: preparedRequest.requestPath.encounter,
		sceneId: payload.sceneId,
		imageTarget: payload.imageTarget,
		attachedImages: payload.attachedImages,
		attachedFiles: payload.attachedFiles,
		parseAIResponse: preparedRequest.shouldParseAIResponse,
		contextData: loaded.contextData,
		generateCharacters: preparedRequest.characterGenerationEnabled,
		generateNpcs: preparedRequest.npcGenerationEnabled,
		generateLocations: preparedRequest.locationGenerationEnabled,
		generateEncounters: preparedRequest.encounterGenerationEnabled,
		generateCustomMonsters: preparedRequest.customMonsterGenerationEnabled,
		entityScope: preparedRequest.entityTargetScope,
		language: preparedRequest.responseLanguage,
		simplifiedNotes: preparedRequest.simplifiedNotesEnabled,
		globalBasePrompt: preparedRequest.globalBasePrompt,
		imagePromptBasePrompt: preparedRequest.imagePromptBasePrompt,
		campaignBasePrompt: preparedRequest.campaignBasePrompt,
	};
}

function completeCurrentTargets(dependencies, request, generatedContent) {
	if (!request.preparedRequest.shouldParseAIResponse) return;
	dependencies.fillCurrentTargetIds(generatedContent, {
		path: request.preparedRequest.requestPath,
		sceneId: request.payload.sceneId,
		customMonsterTarget: null,
	});
}

function shouldApplyGeneratedMentions(shouldParseAIResponse, generatedContent) {
	return (
		shouldParseAIResponse &&
		generatedContent &&
		typeof generatedContent === "object"
	);
}

function applyGeneratedMentions(
	dependencies,
	shouldParseAIResponse,
	generatedContent,
	contextData,
) {
	if (!shouldApplyGeneratedMentions(shouldParseAIResponse, generatedContent)) {
		return;
	}
	const mentionNames = dependencies.collectMentionCandidates(
		generatedContent,
		contextData,
	);
	dependencies.applyMentionsToGeneratedContent(generatedContent, mentionNames);
}

function postProcessGeneratedContent(
	dependencies,
	request,
	loaded,
	generatedContent,
) {
	completeCurrentTargets(dependencies, request, generatedContent);
	applyGeneratedMentions(
		dependencies,
		request.preparedRequest.shouldParseAIResponse,
		generatedContent,
		loaded.contextData,
	);
}

async function getGeneratedFailureResult(
	dependencies,
	payload,
	generatedContent,
) {
	if (!generatedContent?.error) return null;
	const aiResponse = await dependencies.historyWriter.saveFailed(
		payload,
		generatedContent,
		500,
	);
	return { status: 500, body: { ...generatedContent, aiResponse } };
}

function validateGeneratedContent(dependencies, request, generatedContent) {
	if (!request.preparedRequest.shouldParseAIResponse) return;
	dependencies.assertGeneratedContent(generatedContent, {
		type: request.payload.type,
		requireExplicitEntityScope:
			request.preparedRequest.entityTargetScope === "mixed",
	});
}

function createPersistenceInput(request, loaded, generatedContent) {
	const { payload, preparedRequest, historyUserInstructions } = request;
	return {
		payload,
		generatedContent,
		session: loaded.session,
		path: preparedRequest.requestPath,
		type: payload.type,
		modelName: payload.modelName,
		responseLanguage: preparedRequest.responseLanguage,
		historyUserInstructions,
		sceneId: payload.sceneId,
		imageTarget: payload.imageTarget,
		parseAIResponse: payload.parseAIResponse,
		shouldParseAIResponse: preparedRequest.shouldParseAIResponse,
		characterGenerationEnabled: preparedRequest.characterGenerationEnabled,
		npcGenerationEnabled: preparedRequest.npcGenerationEnabled,
		locationGenerationEnabled: preparedRequest.locationGenerationEnabled,
		encounterGenerationEnabled: preparedRequest.encounterGenerationEnabled,
		customMonsterGenerationEnabled:
			preparedRequest.customMonsterGenerationEnabled,
		entityTargetScope: preparedRequest.entityTargetScope,
		contextConfig: payload.contextConfig,
		contextData: loaded.contextData,
		simplifiedNotesEnabled: preparedRequest.simplifiedNotesEnabled,
		autoApplyAiChanges: preparedRequest.autoApplyAiChanges,
		globalBasePrompt: preparedRequest.globalBasePrompt,
		imagePromptBasePrompt: preparedRequest.imagePromptBasePrompt,
		campaignBasePrompt: preparedRequest.campaignBasePrompt,
	};
}

async function executeGenerateCampaignContent(dependencies, request) {
	if (!hasCampaignPath(request.preparedRequest.requestPath)) {
		return createMissingCampaignResponse();
	}
	const loaded = await loadCampaignGenerationContext(dependencies, request);
	const generatedContent = await dependencies.generateContent(
		createGenerationInput(request, loaded),
	);
	postProcessGeneratedContent(dependencies, request, loaded, generatedContent);
	const failure = await getGeneratedFailureResult(
		dependencies,
		request.payload,
		generatedContent,
	);
	if (failure) return failure;
	validateGeneratedContent(dependencies, request, generatedContent);
	return dependencies.campaignFlow.persistGeneratedContent(
		createPersistenceInput(request, loaded, generatedContent),
	);
}

function createGenerateCampaignContent(dependencies) {
	return async function generateCampaignContent(request) {
		return executeGenerateCampaignContent(dependencies, request);
	};
}

module.exports = { createGenerateCampaignContent };
