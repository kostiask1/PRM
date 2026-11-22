import type { AiModelOption } from "./aiChatTypes.ts";

export const AI_MODELS: readonly AiModelOption[] = [
	{
		id: "gemini-2.5-flash",
		name: "Gemini 2.5 Flash",
		description: "Швидка, збалансована для щоденних запитів і генерації",
		badge: "Рекомендовано",
		contextWindow: "1M токенів",
	},
	{
		id: "gemini-2.5-pro",
		name: "Gemini 2.5 Pro",
		description: "Глибоке мислення, складні сюжети та комплексні правила",
		badge: "Pro",
		contextWindow: "2M токенів",
	},
	{
		id: "gemini-2.0-flash",
		name: "Gemini 2.0 Flash",
		description: "Стабільна базова модель попереднього покоління",
		contextWindow: "1M токенів",
	},
];

export const DEFAULT_AI_MODEL = "gemini-2.5-flash";
