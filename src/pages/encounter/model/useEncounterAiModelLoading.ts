import { useEffect } from "react";
import {
	loadAiModelOptions,
	type AiModelDescriptor,
} from "../../../features/ai/index.js";
import type { EncounterViewParticipant } from "./contracts.ts";

type UseEncounterAiModelLoadingOptions = {
	aiEditingMonster: EncounterViewParticipant | null;
	aiModelCount: number;
	onModels: (models: AiModelDescriptor[]) => void;
	onSelectedModel: (updater: (current: string) => string) => void;
	fallbackError: string;
	onError: (message: string) => void;
};

export function useEncounterAiModelLoading({
	aiEditingMonster,
	aiModelCount,
	onModels,
	onSelectedModel,
	fallbackError,
	onError,
}: UseEncounterAiModelLoadingOptions) {
	useEffect(() => {
		if (!aiEditingMonster || aiModelCount > 0) return;
		loadAiModelOptions({
			setAiModels: onModels,
			setSelectedAiModel: onSelectedModel,
			onError: (error) => {
				console.error("Failed to load AI models", error);
				onError(error instanceof Error ? error.message : fallbackError);
			},
		});
	}, [aiEditingMonster, aiModelCount]);
}
