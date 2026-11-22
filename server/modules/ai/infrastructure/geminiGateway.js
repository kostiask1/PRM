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

	async function generateTextStream({
		modelName,
		systemInstruction,
		useJsonResponse,
		userPrompt,
		attachmentParts = [],
		onChunk,
		signal,
	}) {
		if (signal?.aborted) {
			const abortErr = new Error("Aborted");
			abortErr.name = "AbortError";
			throw abortErr;
		}
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
		const streamResult = await model.generateContentStream(requestParts);
		// Always observe the SDK's parallel response promise so stream parse/abort failures cannot crash Node with UnhandledPromiseRejection.
		const responsePromise = streamResult?.response;
		if (typeof responsePromise?.catch === "function") {
			responsePromise.catch(() => null);
		}
		let fullText = "";
		try {
			for await (const chunk of streamResult.stream) {
				if (signal?.aborted) {
					const abortErr = new Error("Aborted");
					abortErr.name = "AbortError";
					throw abortErr;
				}
				const delta = typeof chunk?.text === "function" ? chunk.text() : "";
				if (delta) {
					fullText += delta;
					onChunk?.(delta, fullText);
				}
			}
		} catch (streamError) {
			if (streamError?.name === "AbortError" || signal?.aborted) {
				throw streamError;
			}
			if (
				/Failed to parse stream|Error parsing JSON response/i.test(
					String(streamError?.message || ""),
				)
			) {
				const fallbackText = await generateText({
					modelName,
					systemInstruction,
					useJsonResponse,
					userPrompt,
					attachmentParts,
				});
				if (fallbackText) {
					onChunk?.(fallbackText, fallbackText);
				}
				return fallbackText;
			}
			throw streamError;
		}
		if (!fullText && responsePromise) {
			const response = await responsePromise;
			fullText = response.text();
		}
		return fullText;
	}

	async function generateImage({ modelName, prompt, attachmentParts = [] }) {
		const model = getClient().getGenerativeModel({ model: modelName });
		const result = await model.generateContent([{ text: prompt }, ...attachmentParts]);
		const response = await result.response;
		const parts = response.candidates?.[0]?.content?.parts || [];
		const image = parts.find((part) => part.inlineData?.data && /^image\/(?:png|jpeg|webp)$/.test(part.inlineData.mimeType || ""))?.inlineData;
		if (!image) throw new Error("Gemini did not return an image.");
		return { data: image.data, mimeType: image.mimeType, text: parts.map((part) => part.text || "").filter(Boolean).join("\n") };
	}

	return { generateText, generateTextStream, generateImage };
}

const geminiGateway = createGeminiGateway();

module.exports = { createGeminiGateway, geminiGateway };
