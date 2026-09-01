import type {
	AiGenerationPayload,
	AiGenerationResult,
	AiHistoryEntry,
} from "../api/aiApi.ts";

export interface AiGenerationExecutionError {
	error: unknown;
	message: string;
	status: string | number | null;
}

export type AiGenerationExecutionOutcome =
	| { status: "succeeded"; data: AiGenerationResult | null }
	| { status: "cancelled" }
	| { status: "api-key-missing" }
	| { status: "failed"; failure: AiGenerationExecutionError };

export interface ExecuteAiGenerationOptions {
	payload: AiGenerationPayload;
	signal: AbortSignal;
	generateAi(
		payload: AiGenerationPayload,
		options: { signal: AbortSignal },
	): Promise<AiGenerationResult | null>;
	onSucceeded(data: AiGenerationResult | null): void;
	onCancelled(): void;
	onFailedHistoryEntry(entry: AiHistoryEntry): void;
	onApiKeyMissing(): void;
	onFailed(failure: AiGenerationExecutionError): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	Boolean(value) && typeof value === "object" && !Array.isArray(value);

function getErrorMessage(error: unknown): string {
	return isRecord(error) && typeof error.message === "string"
		? error.message
		: "";
}

function getErrorStatus(error: unknown): string | number | null {
	if (!isRecord(error)) return null;
	return typeof error.status === "string" || typeof error.status === "number"
		? error.status
		: null;
}

function getFailedHistoryEntry(error: unknown): AiHistoryEntry | null {
	if (!isRecord(error) || !isRecord(error.data)) return null;
	const entry = error.data.aiResponse;
	return isRecord(entry) && entry.id !== undefined
		? (entry as AiHistoryEntry)
		: null;
}

function isAbortError(error: unknown): boolean {
	return isRecord(error) && error.name === "AbortError";
}

export function formatAiGenerationFailureAlert(
	failure: AiGenerationExecutionError,
	statusLabel: string,
): string {
	return failure.status === null
		? failure.message
		: `[${statusLabel}: ${failure.status}] ${failure.message}`;
}

function handleAiGenerationFailure(
	error: unknown,
	callbacks: Pick<
		ExecuteAiGenerationOptions,
		| "onCancelled"
		| "onFailedHistoryEntry"
		| "onApiKeyMissing"
		| "onFailed"
	>,
): Exclude<AiGenerationExecutionOutcome, { status: "succeeded" }> {
	if (isAbortError(error)) {
		callbacks.onCancelled();
		return { status: "cancelled" };
	}

	const historyEntry = getFailedHistoryEntry(error);
	if (historyEntry) callbacks.onFailedHistoryEntry(historyEntry);
	const message = getErrorMessage(error);
	if (message.includes("GEMINI_API_KEY")) {
		callbacks.onApiKeyMissing();
		return { status: "api-key-missing" };
	}

	const failure = {
		error,
		message,
		status: getErrorStatus(error),
	};
	callbacks.onFailed(failure);
	return { status: "failed", failure };
}

export async function executeAiGeneration({
	payload,
	signal,
	generateAi,
	onSucceeded,
	onCancelled,
	onFailedHistoryEntry,
	onApiKeyMissing,
	onFailed,
}: ExecuteAiGenerationOptions): Promise<AiGenerationExecutionOutcome> {
	try {
		const data = await generateAi(payload, { signal });
		onSucceeded(data);
		return { status: "succeeded", data };
	} catch (error) {
		return handleAiGenerationFailure(error, {
			onCancelled,
			onFailedHistoryEntry,
			onApiKeyMissing,
			onFailed,
		});
	}
}
