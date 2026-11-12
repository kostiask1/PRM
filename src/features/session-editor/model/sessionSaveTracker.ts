import type { SessionRecord } from "../../../entities/session/index.js";

export function createSessionSaveTracker() {
	const active = new Map<Promise<SessionRecord | null>, string>();
	return {
		last(scope: string) {
			return [...active].filter(([, saveScope]) => saveScope === scope).at(-1)?.[0];
		},
		track(promise: Promise<SessionRecord | null>, scope: string) {
			active.set(promise, scope);
			void promise.then(() => active.delete(promise), () => active.delete(promise));
		},
		async wait(scope: string): Promise<SessionRecord | null> {
			let latest: SessionRecord | null = null;
			for (;;) {
				const pending = [...active].filter(([, saveScope]) => saveScope === scope).map(([promise]) => promise);
				if (pending.length === 0) return latest;
				const results = await Promise.allSettled(pending);
				for (const result of results) {
					if (result.status === "fulfilled" && result.value) latest = result.value;
				}
			}
		},
	};
}
