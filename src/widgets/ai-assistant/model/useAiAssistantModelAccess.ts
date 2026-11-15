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
	const [imageModels, setImageModels] = useState<AiModelDescriptor[]>([]);
	const [selectedModel, setSelectedModel] = useState("");

	useEffect(() => {
		if (!isOpen && !isImagePromptPickerOpen) return;
		let active = true;
		aiApi
			.listAiModels()
			.then((result) => {
				if (!active) return;
				const models = Array.isArray(result?.models) ? result.models : [];
				setAiModels(models);
				setImageModels(Array.isArray(result?.imageModels) ? result.imageModels : []);
				setSelectedModel((current) => models.some((model) => model.name === current) ? current : result?.defaultModel || models[0]?.name || "");
				if (!models.length) onError(lang.t("Failed to load AI models"));
			})
			.catch((error) => {
				console.error("Failed to load AI models", error);
				if (active) onError(lang.t("Failed to load AI models"));
			});
		return () => { active = false; };
	}, [isOpen, isImagePromptPickerOpen]);

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
				setImageModels(result.modelSelection.imageModels || []);
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
		imageModels,
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
