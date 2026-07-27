import { useSyncExternalStore } from "react";

let boundStore = null;

function requireBoundStore() {
	if (!boundStore) {
		throw new Error("Application store has not been bound.");
	}
	return boundStore;
}

export function bindAppStore(store) {
	if (
		!store ||
		typeof store.dispatch !== "function" ||
		typeof store.getState !== "function" ||
		typeof store.subscribe !== "function"
	) {
		throw new TypeError(
			"Application store must provide dispatch, getState, and subscribe.",
		);
	}
	boundStore = store;
	return store;
}

export function getAppStore() {
	return requireBoundStore();
}

export function useAppSelector(selector) {
	const store = requireBoundStore();
	return useSyncExternalStore(
		store.subscribe,
		() => selector(store.getState()),
		() => selector(store.getState()),
	);
}

export function useAppDispatch() {
	return requireBoundStore().dispatch;
}
