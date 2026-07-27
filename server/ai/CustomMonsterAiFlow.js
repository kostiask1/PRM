const customBestiaryRepository = require("../domains/bestiary/customBestiaryRepository");
const { applyAiOperations } = require("../aiPatchService");
const {
	buildCustomMonsterChangeResources,
} = require("../aiResponseHistoryService");

class CustomMonsterAiFlow {
	constructor({ historyWriter, buildAiChangeSummary }) {
		this.historyWriter = historyWriter;
		this.buildAiChangeSummary = buildAiChangeSummary;
	}

	async createDraft({
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
	}) {
		const applied = await applyAiOperations({
			payload: generatedContent,
			campaignSlug: "bestiary",
			sessionFile: null,
			entityScope: "custom-bestiary",
			simplifiedNotes: simplifiedNotesEnabled,
			permissions: {
				allowCharacters: false,
				allowNpcs: false,
				allowLocations: false,
				allowEncounters: false,
			},
		});

		if (!applied.customBestiaryChange?.hasChanges) {
			const aiResponse = await this.historyWriter.saveFailed(
				payload,
				{ message: "AI did not return any valid creature." },
				400,
			);
			return {
				status: 400,
				body: {
					error: "AI did not return any valid creature.",
					generated: generatedContent,
					aiResponse,
				},
			};
		}

		const monsters = applied.customBestiaryChange?.after || [];
		const customBestiaryChangeResources = buildCustomMonsterChangeResources(
			beforeCustomMonsters,
			monsters,
		);
		const aiResponsePayload = {
			text: this.historyWriter.formatGeneratedContent(generatedContent),
			path: { campaign: "bestiary" },
			type: "custom-monster",
			modelName,
			language: responseLanguage,
			userInstructions: historyUserInstructions,
			request: this.historyWriter.buildRequestSnapshot({
				type: payload.type,
				modelName,
				userInstructions: historyUserInstructions,
				path: { campaign: "bestiary" },
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
			}),
			retryPayload: this.historyWriter.cloneRetryPayload(payload),
			changes: {
				resources: customBestiaryChangeResources,
				summary: this.buildAiChangeSummary(customBestiaryChangeResources),
			},
			applyState: "draft",
			appliedAt: null,
		};
		const aiResponse = await this.historyWriter.addSavedOrEphemeral(
			payload,
			aiResponsePayload,
		);
		await customBestiaryRepository.writeCustomBestiaryMonsters(
			beforeCustomMonsters,
		);
		return {
			status: 200,
			body: {
				generated: {
					...generatedContent,
					monsters: applied.changedMonsters,
				},
				draft: true,
				aiResponse,
			},
		};
	}
}

module.exports = {
	CustomMonsterAiFlow,
};
