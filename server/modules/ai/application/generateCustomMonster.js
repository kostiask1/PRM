const { asText } = require("../../../ai/AiHistoryWriter");

function createGenerateCustomMonster({
	readCustomBestiary,
	writeCustomBestiaryMonsters,
	readCampaign,
	readSession,
	appendCampaignContext,
	generateContent,
	fillCurrentTargetIds,
	assertGeneratedContent,
	historyWriter,
	encounterLocalFlow,
	customMonsterFlow,
}) {
	return async function generateCustomMonster({
		payload,
		preparedRequest,
		historyUserInstructions,
	}) {
		const {
			modelName,
			userInstructions,
			attachedImages,
			attachedFiles,
			customMonsterTarget,
			customMonsterMode,
			contextConfig,
		} = payload;
		const {
			campaignBasePrompt,
			globalBasePrompt,
			imagePromptBasePrompt,
			requestPath,
			responseLanguage,
			simplifiedNotesEnabled,
		} = preparedRequest;

		let customBestiary = await readCustomBestiary();
		if (
			Array.isArray(customBestiary.monster) &&
			customBestiary.monster.some((monster) => !asText(monster?.id))
		) {
			const normalizedMonsters = await writeCustomBestiaryMonsters(
				customBestiary.monster,
			);
			customBestiary = { ...customBestiary, monster: normalizedMonsters };
		}
		const beforeCustomMonsters = Array.isArray(customBestiary.monster)
			? customBestiary.monster
			: [];
		const customContextData = {
			campaign: {},
			sessions: [],
			customBestiary: {
				monsters: beforeCustomMonsters.map((monster) => ({
					id: monster.id,
					name: monster.name,
					source: monster.source,
					type: monster.type,
					cr: monster.cr,
				})),
			},
		};
		if (customMonsterTarget && typeof customMonsterTarget === "object") {
			const targetId = asText(customMonsterTarget.id);
			const targetName = asText(customMonsterTarget.name).toLowerCase();
			const fullTarget = beforeCustomMonsters.find(
				(monster) =>
					(targetId && asText(monster?.id) === targetId) ||
					asText(monster?.name).toLowerCase() === targetName,
			);
			customContextData.customBestiary.selectedMonster =
				fullTarget || customMonsterTarget;
			customContextData.customBestiary.selectedMonsterMode =
				customMonsterMode === "create-based" ? "create-based" : "edit";
		}

		let customCampaign = null;
		let customSession = null;
		if (requestPath?.campaign && requestPath.campaign !== "bestiary") {
			customCampaign = await readCampaign(requestPath.campaign).catch(() => null);
			customSession = await readSession(
				requestPath.campaign,
				requestPath.session,
			).catch(() => null);
			await appendCampaignContext(
				customContextData,
				requestPath.campaign,
				customCampaign,
				contextConfig,
			);
		}

		const generatedContent = await generateContent({
			type: "custom-monster",
			userInstructions,
			modelName,
			attachedImages,
			attachedFiles,
			contextData: customContextData,
			generateCharacters: false,
			generateNpcs: false,
			generateLocations: false,
			generateEncounters: false,
			entityScope: "custom-bestiary",
			language: responseLanguage,
			simplifiedNotes: simplifiedNotesEnabled,
			globalBasePrompt,
			imagePromptBasePrompt,
			campaignBasePrompt,
			session: customSession,
			campaign: customCampaign,
			encounterId: requestPath?.encounter,
			parseAIResponse: true,
		});
		if (generatedContent?.error) {
			const aiResponse = await historyWriter.saveFailed(
				payload,
				generatedContent,
				500,
			);
			return { status: 500, body: { ...generatedContent, aiResponse } };
		}
		fillCurrentTargetIds(generatedContent, {
			path: { campaign: "bestiary" },
			sceneId: null,
			customMonsterTarget,
		});
		assertGeneratedContent(generatedContent, {
			type: "custom-monster",
			requireOperations: true,
		});
		if (encounterLocalFlow.isEnabled(payload)) {
			return encounterLocalFlow.createDraft({
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
			});
		}
		return customMonsterFlow.createDraft({
			payload,
			generatedContent,
			beforeCustomMonsters,
			modelName,
			responseLanguage,
			historyUserInstructions,
			customContextData,
			simplifiedNotesEnabled,
			globalBasePrompt,
			imagePromptBasePrompt,
			campaignBasePrompt,
		});
	};
}

module.exports = { createGenerateCustomMonster };
