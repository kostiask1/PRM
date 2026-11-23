import type { AiModelOption } from "./aiChatTypes.ts";

export const AI_MODELS: readonly AiModelOption[] = [
	{
		id: "gemini-2.5-flash",
		name: "Gemini 2.5 Flash",
		description: "Fast and balanced for everyday queries and generation",
		badge: "Recommended",
		contextWindow: "1M tokens",
		inputTokenLimit: 1000000,
	},
	{
		id: "gemini-2.5-pro",
		name: "Gemini 2.5 Pro",
		description: "Deep reasoning, complex plots, and intricate rules",
		badge: "Pro",
		contextWindow: "2M tokens",
		inputTokenLimit: 2000000,
	},
	{
		id: "gemini-2.0-flash",
		name: "Gemini 2.0 Flash",
		description: "Stable baseline model from the previous generation",
		contextWindow: "1M tokens",
		inputTokenLimit: 1000000,
	},
];

export const DEFAULT_AI_MODEL = "gemini-2.5-flash";
