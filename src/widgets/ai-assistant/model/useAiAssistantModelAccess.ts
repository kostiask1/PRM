import { useEffect, useState } from "react";
import {
	aiApi,
	saveGeminiApiKeyAndRefreshModels,
	type AiModelDescriptor,
} from "../../../features/ai/index.js";
import { lang } from "../../../shared/lib/index.js";

interface Options {
	isImagePromptPickerOpen: boolean;
	isOpen: boolean;
	onNotification(message: string): void;
	onError(message: string): void;
}

export function useAiAssistantModelAccess({
	isImagePromptPickerOpen,
	isOpen,
	onNotification,
	onError,
}: Options) {
	const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
	const [apiKeyInput, setApiKeyInput] = useState("");
	const [isSavingApiKey, setIsSavingApiKey] = useState(false);
	const [aiModels, setAiModels] = useState<AiModelDescriptor[]>([]);
	const [selectedModel, setSelectedModel] = useState("");

	useEffect(() => {
		if ((!isOpen && !isImagePromptPickerOpen) || aiModels.length > 0) return;
		aiApi
			.listAiModels()
			.then((result) => {
				const models = Array.isArray(result?.models) ? result.models : [];
				setAiModels(models);
				if (!selectedModel) {
					setSelectedModel(result?.defaultModel || models[0]?.name || "");
				}
			})
			.catch((error) => {
				console.error("Failed to load AI models", error);
			});
	}, [isOpen, isImagePromptPickerOpen, aiModels.length, selectedModel]);

	const saveApiKey = async (): Promise<void> => {
		const apiKey = apiKeyInput.trim();
		if (!apiKey) {
			onError(lang.t("Enter Gemini API key."));
			return;
		}

		setIsSavingApiKey(true);
		onError("");
		try {
			const result = await saveGeminiApiKeyAndRefreshModels({
				apiKey,
				onRefreshError: (error) => {
					console.error("Failed to refresh AI models after saving key", error);
				},
			});
			if (result.status === "saved" && result.modelSelection) {
				setAiModels(result.modelSelection.models);
				setSelectedModel(result.modelSelection.selectedModel);
			}
			setApiKeyInput("");
			setIsApiKeyMissing(false);
			onNotification(lang.t("Gemini API key saved."));
		} catch (error) {
			onError(
				error instanceof Error && error.message
					? error.message
					: lang.t("Failed to save Gemini API key."),
			);
		} finally {
			setIsSavingApiKey(false);
		}
	};

	return {
		aiModels,
		apiKeyInput,
		isApiKeyMissing,
		isSavingApiKey,
		saveApiKey,
		selectedModel,
		setAiModels,
		setApiKeyInput,
		setIsApiKeyMissing,
		setSelectedModel,
	};
}
