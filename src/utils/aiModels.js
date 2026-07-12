import { aiApi as api } from "../features/ai/index.js";

export async function loadAiModelOptions({
	setAiModels,
	setSelectedAiModel,
	onError,
}) {
	try {
		const result = await api.listAiModels();
		const models = Array.isArray(result?.models) ? result.models : [];
		setAiModels(models);
		setSelectedAiModel(
			(current) => current || result?.defaultModel || models[0]?.name || "",
		);
	} catch (error) {
		onError?.(error);
	}
}
