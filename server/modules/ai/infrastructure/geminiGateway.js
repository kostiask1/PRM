const { GoogleGenerativeAI } = require("@google/generative-ai");

function createGeminiGateway({
	createClient = (apiKey) => new GoogleGenerativeAI(apiKey),
	getApiKey = () => process.env.GEMINI_API_KEY || "",
} = {}) {
	let client = null;
	let clientApiKey = null;

	function getClient() {
		const apiKey = getApiKey();
		if (!client || clientApiKey !== apiKey) {
			client = createClient(apiKey);
			clientApiKey = apiKey;
		}
		return client;
	}

	async function generateText({
		modelName,
		systemInstruction,
		useJsonResponse,
		userPrompt,
		attachmentParts = [],
	}) {
		const model = getClient().getGenerativeModel({
			model: modelName,
			...(useJsonResponse
				? { generationConfig: { responseMimeType: "application/json" } }
				: {}),
			systemInstruction,
		});
		const requestParts =
			attachmentParts.length > 0
				? [{ text: userPrompt }, ...attachmentParts]
				: userPrompt;
		const result = await model.generateContent(requestParts);
		const response = await result.response;
		return response.text();
	}

	return { generateText };
}

const geminiGateway = createGeminiGateway();

module.exports = { createGeminiGateway, geminiGateway };
