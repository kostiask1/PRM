export function createEntitySaveTracker() {
	const active = new Map<Promise<void>, string>();
	const latestByKey = new Map<string, Promise<void>>();
	const failed = new Map<string, number>();
	const saved = new Map<string, number>();
	let version = 0;
	return {
		nextVersion: () => ++version,
		lastForKey: (key: string) => latestByKey.get(key),
		track(promise: Promise<void>, campaign: string, key?: string) {
			active.set(promise, campaign);
			if (key) latestByKey.set(key, promise);
			const clear = () => {
				active.delete(promise);
				if (key && latestByKey.get(key) === promise) latestByKey.delete(key);
			};
			void promise.then(clear, clear);
		},
		async wait(campaign: string) {
			for (;;) {
				const pending = [...active].filter(([, slug]) => slug === campaign).map(([promise]) => promise);
				if (pending.length === 0) return;
				await Promise.allSettled(pending);
			}
		},
		succeeded(key: string, currentVersion: number) {
			saved.set(key, Math.max(saved.get(key) || 0, currentVersion));
			if ((failed.get(key) || 0) <= currentVersion) failed.delete(key);
		},
		failed(key: string, currentVersion: number) {
			if (currentVersion > (saved.get(key) || 0)) failed.set(key, Math.max(failed.get(key) || 0, currentVersion));
		},
		hasFailed: (key: string) => failed.has(key),
		clear: (key: string) => { failed.delete(key); },
		clearFailures: () => { failed.clear(); },
	};
}
