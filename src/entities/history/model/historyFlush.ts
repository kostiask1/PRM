export const ACTIVE_HISTORY_FLUSH_EVENT = "dnd:persistent-history-flush";

interface ActiveHistoryFlushRequest {
	waitUntil(task: Promise<void>): void;
}

export async function requestActiveHistoryFlush(): Promise<void> {
	if (typeof window === "undefined") return;
	const pending: Promise<void>[] = [];
	window.dispatchEvent(
		new CustomEvent<ActiveHistoryFlushRequest>(ACTIVE_HISTORY_FLUSH_EVENT, {
			detail: {
				waitUntil(task) {
					pending.push(task);
				},
			},
		}),
	);
	await Promise.all(pending);
}

export function waitForActiveHistoryFlush(
	event: Event,
	flush: () => void | Promise<void>,
): void {
	const request = (event as CustomEvent<ActiveHistoryFlushRequest>).detail;
	request?.waitUntil(Promise.resolve().then(flush));
}
