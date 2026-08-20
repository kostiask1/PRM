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
	onError: (error: unknown) => void;
};

export function useEncounterAiModelLoading({
	aiEditingMonster,
	aiModelCount,
	onModels,
	onSelectedModel,
	onError,
}: UseEncounterAiModelLoadingOptions) {
	useEffect(() => {
		if (!aiEditingMonster || aiModelCount > 0) return;
		loadAiModelOptions({ setAiModels: onModels, setSelectedAiModel: onSelectedModel, onError });
	}, [aiEditingMonster, aiModelCount]);
}
