import {
	aiApi,
	type AiModelDescriptor,
	type AiModelListResult,
} from "../api/aiApi.ts";

export const AI_MODEL_REFRESH_ATTEMPTS = 5;
export const AI_MODEL_REFRESH_DELAY_MS = 500;

export interface AiApiKeyModelSelection {
	models: AiModelDescriptor[];
	selectedModel: string;
}

export type AiApiKeySaveResult =
	| { status: "missing-key" }
	| {
			status: "saved";
			modelSelection: AiApiKeyModelSelection | null;
		};

export interface SaveAiApiKeyOptions {
	apiKey: unknown;
	saveApiKey?: (apiKey: string) => Promise<unknown>;
	listAiModels?: () => Promise<AiModelListResult | null>;
	wait?: (delayMs: number) => Promise<void>;
	refreshAttempts?: number;
	refreshDelayMs?: number;
	onRefreshError?: (error: unknown) => void;
}

function waitForDelay(delayMs: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function getAiModelSelection(
	result: AiModelListResult,
): AiApiKeyModelSelection {
	const models = Array.isArray(result.models) ? result.models : [];
	return {
		models,
		selectedModel: result.defaultModel || models[0]?.name || "",
	};
}

async function refreshAiModelsWithRetry({
	listAiModels,
	wait,
	refreshAttempts,
	refreshDelayMs,
	onRefreshError,
}: Required<
	Pick<
		SaveAiApiKeyOptions,
		"listAiModels" | "wait" | "refreshAttempts" | "refreshDelayMs"
	>
> &
	Pick<SaveAiApiKeyOptions, "onRefreshError">): Promise<AiModelListResult | null> {
	const attempts = Math.max(1, Math.trunc(refreshAttempts));
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		try {
			return await listAiModels();
		} catch (error) {
			const isLastAttempt = attempt === attempts - 1;
			if (isLastAttempt) {
				onRefreshError?.(error);
				return null;
			}
			await wait(refreshDelayMs);
		}
	}
	return null;
}

export async function saveGeminiApiKeyAndRefreshModels({
	apiKey,
	saveApiKey = aiApi.saveGeminiApiKey,
	listAiModels = aiApi.listAiModels,
	wait = waitForDelay,
	refreshAttempts = AI_MODEL_REFRESH_ATTEMPTS,
	refreshDelayMs = AI_MODEL_REFRESH_DELAY_MS,
	onRefreshError,
}: SaveAiApiKeyOptions): Promise<AiApiKeySaveResult> {
	const normalizedApiKey = String(apiKey || "").trim();
	if (!normalizedApiKey) return { status: "missing-key" };

	await saveApiKey(normalizedApiKey);
	const modelResult = await refreshAiModelsWithRetry({
		listAiModels,
		wait,
		refreshAttempts,
		refreshDelayMs,
		onRefreshError,
	});
	return {
		status: "saved",
		modelSelection: modelResult ? getAiModelSelection(modelResult) : null,
	};
}
