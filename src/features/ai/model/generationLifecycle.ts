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
	readonly requestId: number | null;
}

type StartGenerationEvent = {
	type: "start-generation" | "start-retry";
	requestId: number;
};

type FinishGenerationEvent = {
	type: "succeed" | "fail" | "cancel";
	requestId: number;
};

type ResetGenerationEvent = { type: "reset" };

export type AiGenerationLifecycleEvent =
	| StartGenerationEvent
	| FinishGenerationEvent
	| ResetGenerationEvent;

const START_STATUS_BY_EVENT = {
	"start-generation": AI_GENERATION_STATUS.GENERATING,
	"start-retry": AI_GENERATION_STATUS.RETRYING,
} as const satisfies Record<StartGenerationEvent["type"], AiGenerationStatus>;

const FINISH_STATUS_BY_EVENT = {
	succeed: AI_GENERATION_STATUS.SUCCEEDED,
	fail: AI_GENERATION_STATUS.FAILED,
	cancel: AI_GENERATION_STATUS.CANCELLED,
} as const satisfies Record<FinishGenerationEvent["type"], AiGenerationStatus>;

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

function isStartGenerationEvent(
	event: AiGenerationLifecycleEvent,
): event is StartGenerationEvent {
	return event.type === "start-generation" || event.type === "start-retry";
}

function createStartedGenerationLifecycle(
	event: StartGenerationEvent,
): AiGenerationLifecycle {
	return {
		status: START_STATUS_BY_EVENT[event.type],
		requestId: event.requestId,
	};
}

function finishGenerationLifecycle(
	state: AiGenerationLifecycle,
	event: FinishGenerationEvent,
): AiGenerationLifecycle {
	if (event.requestId !== state.requestId) return state;
	return {
		status: FINISH_STATUS_BY_EVENT[event.type],
		requestId: null,
	};
}

export function aiGenerationLifecycleReducer(
	state: AiGenerationLifecycle,
	event: AiGenerationLifecycleEvent,
): AiGenerationLifecycle {
	if (event.type === "reset") return initialAiGenerationLifecycle;
	if (isStartGenerationEvent(event)) {
		return createStartedGenerationLifecycle(event);
	}
	return finishGenerationLifecycle(state, event);
}
