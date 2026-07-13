import { aiApi, type AiModelDescriptor } from "../api/aiApi.ts";

export interface AiModelOptionSetters {
	setAiModels(models: AiModelDescriptor[]): void;
	setSelectedAiModel(
		updater: (current: string) => string,
	): void;
	onError?(error: unknown): void;
}

export async function loadAiModelOptions({
	setAiModels,
	setSelectedAiModel,
	onError,
}: AiModelOptionSetters): Promise<void> {
	try {
		const result = await aiApi.listAiModels();
		if (!result) throw new Error("AI model list response was empty.");
		const models = Array.isArray(result.models) ? result.models : [];
		setAiModels(models);
		setSelectedAiModel(
			(current) => current || result.defaultModel || models[0]?.name || "",
		);
	} catch (error) {
		onError?.(error);
	}
}
