import { aiApi } from "../../../entities/ai/api.js";

export async function loadAiModelOptions({
	setAiModels,
	setSelectedAiModel,
	onError,
}) {
	try {
		const result = await aiApi.listAiModels();
		const models = Array.isArray(result?.models) ? result.models : [];
		setAiModels(models);
		setSelectedAiModel(
			(current) => current || result?.defaultModel || models[0]?.name || "",
		);
	} catch (error) {
		onError?.(error);
	}
}
