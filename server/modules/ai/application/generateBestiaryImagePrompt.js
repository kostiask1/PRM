function createGenerateBestiaryImagePrompt({
	generateContent,
	addAiResponse,
	historyWriter,
}) {
	return async function generateBestiaryImagePrompt({
		payload,
		preparedRequest,
		historyUserInstructions,
	}) {
		const {
			modelName,
			userInstructions,
			sceneId,
			imageTarget,
			attachedImages,
			attachedFiles,
			type,
		} = payload;
		const {
			campaignBasePrompt,
			globalBasePrompt,
			imagePromptBasePrompt,
			responseLanguage,
			simplifiedNotesEnabled,
		} = preparedRequest;
		const generatedContent = await generateContent({
			type: "image",
			userInstructions,
			modelName,
			attachedImages,
			attachedFiles,
			contextData: {},
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
			session: null,
			campaign: null,
			sceneId,
			imageTarget,
			parseAIResponse: false,
		});
		if (generatedContent?.error) {
			const aiResponse = await historyWriter.saveFailed(
				payload,
				generatedContent,
				500,
			);
			return { status: 500, body: { ...generatedContent, aiResponse } };
		}
		const aiResponse = await addAiResponse({
			text: generatedContent,
			path: { campaign: "bestiary" },
			type: "image",
			modelName,
			language: responseLanguage,
			userInstructions: historyUserInstructions,
			request: historyWriter.buildRequestSnapshot({
				type,
				modelName,
				userInstructions: historyUserInstructions,
				path: { campaign: "bestiary" },
				sceneId,
				imageTarget,
				attachedImages,
				attachedFiles,
				parseAIResponse: false,
				shouldParseAIResponse: false,
				generateCharacters: false,
				generateNpcs: false,
				generateLocations: false,
				generateEncounters: false,
				generateCustomMonsters: false,
				entityScope: "custom-bestiary",
				contextConfig: null,
				contextData: {},
				language: responseLanguage,
				globalBasePrompt,
				imagePromptBasePrompt,
				campaignBasePrompt,
			}),
			retryPayload: historyWriter.cloneRetryPayload(payload),
		});
		return { status: 200, body: { prompt: generatedContent, aiResponse } };
	};
}

module.exports = { createGenerateBestiaryImagePrompt };
