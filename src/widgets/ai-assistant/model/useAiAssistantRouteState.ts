import { useMemo } from "react";
import {
	getAiAssistantRouteState,
	type AiAssistantRouteStateInput,
} from "./assistantContext.ts";

export function useAiAssistantRouteState({
	campaignAiBasePrompts,
	campaignImagePromptBasePrompts,
	imagePromptBasePrompt,
	isBestiary,
	navigation,
}: AiAssistantRouteStateInput) {
	return useMemo(
		() =>
			getAiAssistantRouteState({
				isBestiary,
				navigation,
				imagePromptBasePrompt,
				campaignAiBasePrompts,
				campaignImagePromptBasePrompts,
			}),
		[
			campaignAiBasePrompts,
			campaignImagePromptBasePrompts,
			imagePromptBasePrompt,
			isBestiary,
			navigation,
		],
	);
}
