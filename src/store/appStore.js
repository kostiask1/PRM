import { useSyncExternalStore } from "react";
import {
	CLOSE_MENTION_PICKER,
	CLOSE_MODAL,
	OPEN_MENTION_PICKER,
	OPEN_MODAL,
	PUBLISH_DICE_RESULT,
	REFRESH_ENTITIES,
	REQUEST_DICE_ROLL,
	closeModalAction,
	openModalAction,
} from "../actions/app";

const initialState = {
	modal: {
		requestId: null,
		config: null,
	},
	entityRefreshVersion: 0,
	mentionPickerRequest: null,
	dice: {
		rollRequest: null,
		rolledResult: null,
	},
};

let state = initialState;
const listeners = new Set();
let modalRequestSeq = 1;
const modalResolvers = new Map();

function emitChange() {
	listeners.forEach((listener) => listener());
}

function reducer(currentState, action) {
	switch (action.type) {
		case OPEN_MODAL:
			return {
				...currentState,
				modal: {
					requestId: action.payload.requestId,
					config: action.payload.config,
				},
			};
		case CLOSE_MODAL:
			return {
				...currentState,
				modal: {
					requestId: null,
					config: null,
				},
			};
		case REFRESH_ENTITIES:
			return {
				...currentState,
				entityRefreshVersion: currentState.entityRefreshVersion + 1,
			};
		case OPEN_MENTION_PICKER:
			return {
				...currentState,
				mentionPickerRequest: action.payload,
			};
		case CLOSE_MENTION_PICKER:
			return {
				...currentState,
				mentionPickerRequest: null,
			};
		case REQUEST_DICE_ROLL:
			return {
				...currentState,
				dice: {
					...currentState.dice,
					rollRequest: action.payload,
				},
			};
		case PUBLISH_DICE_RESULT:
			return {
				...currentState,
				dice: {
					...currentState.dice,
					rolledResult: action.payload,
				},
			};
		default:
			return currentState;
	}
}

export const appStore = {
	getState() {
		return state;
	},
	dispatch(action) {
		state = reducer(state, action);
		emitChange();
	},
	subscribe(listener) {
		listeners.add(listener);
		return () => listeners.delete(listener);
	},
};

export function useAppSelector(selector) {
	return useSyncExternalStore(
		appStore.subscribe,
		() => selector(appStore.getState()),
		() => selector(appStore.getState()),
	);
}

export function useAppDispatch() {
	return appStore.dispatch;
}

export function openModalRequest(config) {
	const requestId = modalRequestSeq++;
	return new Promise((resolve) => {
		modalResolvers.set(requestId, resolve);
		appStore.dispatch(openModalAction(requestId, config));
	});
}

export function resolveModalRequest(requestId, value) {
	if (requestId !== null && requestId !== undefined) {
		const resolve = modalResolvers.get(requestId);
		if (resolve) {
			resolve(value);
			modalResolvers.delete(requestId);
		}
	}
	appStore.dispatch(closeModalAction());
}

export function closeActiveModal(value = null) {
	const requestId = appStore.getState().modal.requestId;
	resolveModalRequest(requestId, value);
}
