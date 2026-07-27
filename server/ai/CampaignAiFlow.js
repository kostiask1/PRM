const archiveExportService = require("../domains/archive/archiveExportService");
const { applyAiOperations } = require("../aiPatchService");
const {
	buildCustomMonsterChangeResources,
} = require("../aiResponseHistoryService");

class CampaignAiFlow {
	constructor({ historyWriter }) {
		this.historyWriter = historyWriter;
	}

	async persistGeneratedContent({
		payload,
		generatedContent,
		session,
		path,
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
	}) {
		const requestSnapshot = this.historyWriter.buildRequestSnapshot({
			type,
			modelName,
			userInstructions: historyUserInstructions,
			path,
			sceneId,
			imageTarget,
			attachedImages: payload.attachedImages,
			attachedFiles: payload.attachedFiles,
			parseAIResponse,
			shouldParseAIResponse,
			generateCharacters: characterGenerationEnabled,
			generateNpcs: npcGenerationEnabled,
			generateLocations: locationGenerationEnabled,
			generateEncounters: encounterGenerationEnabled,
			generateCustomMonsters: customMonsterGenerationEnabled,
			entityScope: entityTargetScope,
			contextConfig,
			contextData,
			language: responseLanguage,
			globalBasePrompt,
			imagePromptBasePrompt,
			campaignBasePrompt,
		});

		if (!shouldParseAIResponse) {
			const aiResponse = await this.historyWriter.addResponse({
				text: generatedContent,
				path,
				type,
				modelName,
				language: responseLanguage,
				userInstructions: historyUserInstructions,
				request: requestSnapshot,
				retryPayload: this.historyWriter.cloneRetryPayload(payload),
			});
			return {
				status: 200,
				body: { prompt: generatedContent, aiResponse },
			};
		}

		const beforeApplyBundle =
			await archiveExportService.exportCampaignBundle(path.campaign);
		const applied = await applyAiOperations({
			payload: generatedContent,
			campaignSlug: path.campaign,
			sessionFile: session ? path.session : null,
			encounterId: path.encounter,
			entityScope: entityTargetScope,
			simplifiedNotes: simplifiedNotesEnabled,
			permissions: {
				allowCharacters: characterGenerationEnabled,
				allowNpcs: npcGenerationEnabled,
				allowLocations: locationGenerationEnabled,
				allowEncounters: encounterGenerationEnabled || Boolean(path.encounter),
			},
		});
		const extraChangeResources = applied.customBestiaryChange?.hasChanges
			? buildCustomMonsterChangeResources(
					applied.customBestiaryChange.before,
					applied.customBestiaryChange.after,
				)
			: [];

		if (!autoApplyAiChanges) {
			const aiResponse = await this.historyWriter.saveDraftParsed({
				beforeApplyBundle,
				generatedContent,
				path,
				type,
				modelName,
				language: responseLanguage,
				userInstructions: historyUserInstructions,
				requestSnapshot,
				retryPayload: this.historyWriter.cloneRetryPayload(payload),
				extraChangeResources,
			});
			return {
				status: 200,
				body: {
					generated: generatedContent,
					draft: true,
					aiResponse,
				},
			};
		}

		const aiResponse = await this.historyWriter.saveParsed({
			beforeApplyBundle,
			generatedContent,
			path,
			type,
			modelName,
			language: responseLanguage,
			userInstructions: historyUserInstructions,
			requestSnapshot,
			retryPayload: this.historyWriter.cloneRetryPayload(payload),
			extraChangeResources,
		});
		return {
			status: 200,
			body: {
				generated: generatedContent,
				updated: applied.updated,
				aiResponse,
			},
		};
	}
}

module.exports = {
	CampaignAiFlow,
};
