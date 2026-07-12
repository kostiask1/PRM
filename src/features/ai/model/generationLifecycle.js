export const AI_GENERATION_STATUS = Object.freeze({
	IDLE: "idle",
	GENERATING: "generating",
	RETRYING: "retrying",
	SUCCEEDED: "succeeded",
	FAILED: "failed",
	CANCELLED: "cancelled",
});

export const initialAiGenerationLifecycle = Object.freeze({
	status: AI_GENERATION_STATUS.IDLE,
	requestId: null,
});

export function isAiGenerationPending(state) {
	return (
		state?.status === AI_GENERATION_STATUS.GENERATING ||
		state?.status === AI_GENERATION_STATUS.RETRYING
	);
}

export function aiGenerationLifecycleReducer(state, event) {
	switch (event?.type) {
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
			};
			return { status: statusByEvent[event.type], requestId: null };
		}
		case "reset":
			return initialAiGenerationLifecycle;
		default:
			return state;
	}
}
