function createSaveGeminiApiKey({ apiKeyStore, clearModelCache }) {
	return async function saveGeminiApiKey(value) {
		const apiKey = String(value || "").trim();
		if (!apiKey) {
			return { status: 400, body: { error: "GEMINI_API_KEY cannot be empty." } };
		}
		if (/[\r\n]/.test(apiKey)) {
			return {
				status: 400,
				body: { error: "GEMINI_API_KEY must be a single line." },
			};
		}
		await apiKeyStore.save(apiKey);
		clearModelCache();
		return { status: 200, body: { ok: true } };
	};
}

module.exports = { createSaveGeminiApiKey };
