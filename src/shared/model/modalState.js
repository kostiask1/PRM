import { getAppStore } from "../lib/index.js";

export const OPEN_MODAL = "modal/open";
export const CLOSE_MODAL = "modal/close";

let modalRequestSeq = 1;
const modalResolvers = new Map();

export function openModalAction(requestId, config) {
	return {
		type: OPEN_MODAL,
		payload: { requestId, config },
	};
}

export function closeModalAction() {
	return { type: CLOSE_MODAL };
}

export function openModalRequest(config) {
	const requestId = modalRequestSeq++;
	return new Promise((resolve) => {
		modalResolvers.set(requestId, resolve);
		getAppStore().dispatch(openModalAction(requestId, config));
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
	getAppStore().dispatch(closeModalAction());
}

export function closeActiveModal(value = null) {
	const requestId = getAppStore().getState().modal.requestId;
	resolveModalRequest(requestId, value);
}
