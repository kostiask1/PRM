const { asText } = require("../../../ai/AiHistoryWriter");

function createGenerateCampaignContent({
	readCampaign,
	readSession,
	readCustomBestiary,
	appendCampaignContext,
	filterSessionData,
	generateContent,
	fillCurrentTargetIds,
	collectMentionCandidates,
	applyMentionsToGeneratedContent,
	assertGeneratedContent,
	historyWriter,
	campaignFlow,
}) {
	return async function generateCampaignContent({
		payload,
		preparedRequest,
		historyUserInstructions,
	}) {
		const {
			type,
			userInstructions,
			modelName,
			sceneId,
			imageTarget,
			attachedImages,
			attachedFiles,
			parseAIResponse,
			contextConfig,
		} = payload;
		const {
			autoApplyAiChanges,
			campaignBasePrompt,
			characterGenerationEnabled,
			customMonsterGenerationEnabled,
			encounterGenerationEnabled,
			entityTargetScope,
			globalBasePrompt,
			imagePromptBasePrompt,
			locationGenerationEnabled,
			npcGenerationEnabled,
			requestPath,
			responseLanguage,
			shouldParseAIResponse,
			simplifiedNotesEnabled,
		} = preparedRequest;
		if (!requestPath?.campaign) {
			return { status: 400, body: { error: "path.campaign is required." } };
		}
		const campaign = await readCampaign(requestPath.campaign);
		const session = await readSession(
			requestPath.campaign,
			requestPath.session,
		).catch(() => null);
		const contextData = { campaign: {}, sessions: [] };
		await appendCampaignContext(
			contextData,
			requestPath.campaign,
			campaign,
			contextConfig,
		);
		if (entityTargetScope === "mixed" && session) {
			contextData.currentSession = {
				slug: requestPath.session,
				fileName: requestPath.session,
				name: session.name,
				data: filterSessionData(session.data),
			};
		}
		if (requestPath?.encounter || encounterGenerationEnabled) {
			const customBestiary = await readCustomBestiary();
			const monsterNames = (
				Array.isArray(customBestiary.monster) ? customBestiary.monster : []
			)
				.map((monster) => asText(monster?.name))
				.filter(Boolean);
			if (monsterNames.length > 0) {
				contextData.customBestiary = { monsterNames };
			}
		}
		const generatedContent = await generateContent({
			type,
			session,
			campaign,
			userInstructions,
			modelName,
			encounterId: requestPath.encounter,
			sceneId,
			imageTarget,
			attachedImages,
			attachedFiles,
			parseAIResponse: shouldParseAIResponse,
			contextData,
			generateCharacters: characterGenerationEnabled,
			generateNpcs: npcGenerationEnabled,
			generateLocations: locationGenerationEnabled,
			generateEncounters: encounterGenerationEnabled,
			generateCustomMonsters: customMonsterGenerationEnabled,
			entityScope: entityTargetScope,
			language: responseLanguage,
			simplifiedNotes: simplifiedNotesEnabled,
			globalBasePrompt,
			imagePromptBasePrompt,
			campaignBasePrompt,
		});
		if (shouldParseAIResponse) {
			fillCurrentTargetIds(generatedContent, {
				path: requestPath,
				sceneId,
				customMonsterTarget: null,
			});
		}
		if (
			shouldParseAIResponse &&
			generatedContent &&
			typeof generatedContent === "object"
		) {
			const mentionNames = collectMentionCandidates(
				generatedContent,
				contextData,
			);
			applyMentionsToGeneratedContent(generatedContent, mentionNames);
		}
		if (generatedContent?.error) {
			const aiResponse = await historyWriter.saveFailed(
				payload,
				generatedContent,
				500,
			);
			return { status: 500, body: { ...generatedContent, aiResponse } };
		}
		if (shouldParseAIResponse) {
			assertGeneratedContent(generatedContent, {
				type,
				requireExplicitEntityScope: entityTargetScope === "mixed",
			});
		}
		return campaignFlow.persistGeneratedContent({
			payload,
			generatedContent,
			session,
			path: requestPath,
			type,
			modelName,
			responseLanguage,
			historyUserInstructions,
			sceneId,
			imageTarget,
			parseAIResponse,
			shouldParseAIResponse,
			characterGenerationEnabled,
			npcGenerationEnabled,
			locationGenerationEnabled,
			encounterGenerationEnabled,
			customMonsterGenerationEnabled,
			entityTargetScope,
			contextConfig,
			contextData,
			simplifiedNotesEnabled,
			autoApplyAiChanges,
			globalBasePrompt,
			imagePromptBasePrompt,
			campaignBasePrompt,
		});
	};
}

module.exports = { createGenerateCampaignContent };
