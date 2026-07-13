function createGenerateAiRequest({
	prepareRequest,
	generateCustomMonster,
	generateBestiaryImagePrompt,
	generateCampaignContent,
	historyWriter,
	isApiKeyConfigured,
	readSettings,
	onHistoryError = console.error,
}) {
	return async function generateAiRequest(payload) {
		const historyUserInstructions = historyWriter.getUserInstructions(payload);
		try {
			const preparedRequest = await prepareRequest({
				payload,
				apiKeyConfigured: isApiKeyConfigured(),
				readSettings,
			});
			if (preparedRequest.error) {
				return {
					status: preparedRequest.error.status,
					body: { error: preparedRequest.error.message },
				};
			}
			const input = { payload, preparedRequest, historyUserInstructions };
			if (payload.type === "custom-monster") {
				return generateCustomMonster(input);
			}
			if (preparedRequest.isBestiaryImagePromptRequest) {
				return generateBestiaryImagePrompt(input);
			}
			return generateCampaignContent(input);
		} catch (error) {
			try {
				const aiResponse = await historyWriter.saveFailed(
					payload,
					error,
					error.status || 500,
				);
				if (aiResponse) {
					return {
						status: error.status || 500,
						body: {
							error: error.message || "AI request failed.",
							aiResponse,
						},
					};
				}
			} catch (historyError) {
				onHistoryError("Failed to save failed AI request", historyError);
			}
			throw error;
		}
	};
}

module.exports = { createGenerateAiRequest };
