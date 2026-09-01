function prepareGenerateRequest(
	payload,
	prepareRequest,
	isApiKeyConfigured,
	readSettings,
) {
	return prepareRequest({
		payload,
		apiKeyConfigured: isApiKeyConfigured(),
		readSettings,
	});
}

function getPreparedRequestErrorResult(preparedRequest) {
	if (!preparedRequest.error) return null;
	return {
		status: preparedRequest.error.status,
		body: { error: preparedRequest.error.message },
	};
}

function createGenerateWorkflowInput(
	payload,
	preparedRequest,
	historyUserInstructions,
) {
	return { payload, preparedRequest, historyUserInstructions };
}

function selectGenerateWorkflow(
	payload,
	preparedRequest,
	generateCustomMonster,
	generateBestiaryImagePrompt,
	generateCampaignContent,
) {
	if (payload.type === "custom-monster") return generateCustomMonster;
	if (preparedRequest.isBestiaryImagePromptRequest) {
		return generateBestiaryImagePrompt;
	}
	return generateCampaignContent;
}

function executeGenerateWorkflow(
	input,
	generateCustomMonster,
	generateBestiaryImagePrompt,
	generateCampaignContent,
) {
	const workflow = selectGenerateWorkflow(
		input.payload,
		input.preparedRequest,
		generateCustomMonster,
		generateBestiaryImagePrompt,
		generateCampaignContent,
	);
	return workflow(input);
}

function getFailedRequestStatus(error) {
	return error.status || 500;
}

function getFailedRequestMessage(error) {
	return error.message || "AI request failed.";
}

function createSavedFailureResult(error, aiResponse) {
	return {
		status: getFailedRequestStatus(error),
		body: {
			error: getFailedRequestMessage(error),
			aiResponse,
		},
	};
}

async function recoverFailedGenerateRequest(
	payload,
	error,
	historyWriter,
	onHistoryError,
) {
	try {
		const aiResponse = await historyWriter.saveFailed(
			payload,
			error,
			getFailedRequestStatus(error),
		);
		if (!aiResponse) return null;
		return createSavedFailureResult(error, aiResponse);
	} catch (historyError) {
		onHistoryError("Failed to save failed AI request", historyError);
		return null;
	}
}

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
			const preparedRequest = await prepareGenerateRequest(
				payload,
				prepareRequest,
				isApiKeyConfigured,
				readSettings,
			);
			const preparedErrorResult =
				getPreparedRequestErrorResult(preparedRequest);
			if (preparedErrorResult) return preparedErrorResult;
			const input = createGenerateWorkflowInput(
				payload,
				preparedRequest,
				historyUserInstructions,
			);
			return executeGenerateWorkflow(
				input,
				generateCustomMonster,
				generateBestiaryImagePrompt,
				generateCampaignContent,
			);
		} catch (error) {
			const failureResult = await recoverFailedGenerateRequest(
				payload,
				error,
				historyWriter,
				onHistoryError,
			);
			if (failureResult) return failureResult;
			throw error;
		}
	};
}

module.exports = { createGenerateAiRequest };
