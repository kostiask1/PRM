import type { RequestId } from "../../../shared/model/contracts.ts";

export const AI_GENERATION_STATUS = Object.freeze({
	IDLE: "idle",
	GENERATING: "generating",
	RETRYING: "retrying",
	SUCCEEDED: "succeeded",
	FAILED: "failed",
	CANCELLED: "cancelled",
} as const);

export type AiGenerationStatus =
	(typeof AI_GENERATION_STATUS)[keyof typeof AI_GENERATION_STATUS];

export interface AiGenerationLifecycle {
	readonly status: AiGenerationStatus;
	readonly requestId: RequestId | null;
}

type StartGenerationEvent = {
	type: "start-generation" | "start-retry";
	requestId: RequestId;
};

type FinishGenerationEvent = {
	type: "succeed" | "fail" | "cancel";
	requestId: RequestId;
};

type ResetGenerationEvent = { type: "reset" };

export type AiGenerationLifecycleEvent =
	| StartGenerationEvent
	| FinishGenerationEvent
	| ResetGenerationEvent;

export const initialAiGenerationLifecycle: AiGenerationLifecycle = Object.freeze({
	status: AI_GENERATION_STATUS.IDLE,
	requestId: null,
});

export function isAiGenerationPending(
	state: AiGenerationLifecycle | null | undefined,
): boolean {
	return (
		state?.status === AI_GENERATION_STATUS.GENERATING ||
		state?.status === AI_GENERATION_STATUS.RETRYING
	);
}

export function aiGenerationLifecycleReducer(
	state: AiGenerationLifecycle,
	event: AiGenerationLifecycleEvent,
): AiGenerationLifecycle {
	switch (event.type) {
		case "start-generation":
			return {
				status: AI_GENERATION_STATUS.GENERATING,
				requestId: event.requestId,
			};
		case "start-retry":
			return {
				status: AI_GENERATION_STATUS.RETRYING,
				requestId: event.requestId,
			};
		case "succeed":
		case "fail":
		case "cancel": {
			if (event.requestId !== state.requestId) return state;
			const statusByEvent = {
				succeed: AI_GENERATION_STATUS.SUCCEEDED,
				fail: AI_GENERATION_STATUS.FAILED,
				cancel: AI_GENERATION_STATUS.CANCELLED,
			} as const;
			return { status: statusByEvent[event.type], requestId: null };
		}
		case "reset":
			return initialAiGenerationLifecycle;
	}
}
