import { useMemo } from "react";
import {
	buildAiTokenEstimate,
	type AiTokenEstimateInput,
} from "../../../features/ai/index.js";

export function useAiAssistantTokenEstimate(input: AiTokenEstimateInput) {
	const tokenEstimate = useMemo(() => buildAiTokenEstimate(input), [
		input.activeCampaignBasePrompt,
		input.attachedFiles,
		input.attachedImages,
		input.campaignContext,
		input.characterContext,
		input.charactersList,
		input.contextConfig,
		input.currentLanguage,
		input.generateCharacters,
		input.generateCustomMonsters,
		input.generateEncounters,
		input.generateLocations,
		input.generateNpcs,
		input.globalAiBasePrompt,
		input.isBestiary,
		input.isCampaign,
		input.isEncounter,
		input.locationContext,
		input.locationsList,
		input.npcContext,
		input.npcsList,
		input.parseAIResponse,
		input.selectedModel,
		input.sessionData,
		input.sessionName,
		input.useContext,
		input.userInstructions,
		input.getCharacterKey,
		input.getLocationKey,
	]);
	const numberFormat = new Intl.NumberFormat(input.currentLanguage || "en");

	return {
		formattedFileTokenEstimate: numberFormat.format(tokenEstimate.fileTokens || 0),
		formattedImageTokenEstimate: numberFormat.format(tokenEstimate.imageTokens),
		formattedTextTokenEstimate: numberFormat.format(tokenEstimate.textTokens),
		formattedTokenEstimate: numberFormat.format(tokenEstimate.total),
		tokenEstimate,
	};
}
