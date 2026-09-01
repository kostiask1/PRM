import type { RequestId } from "./contracts.ts";

export const OPEN_MODAL = "modal/open";
export const CLOSE_MODAL = "modal/close";

export interface ModalConfig extends Record<string, unknown> {
	title?: string;
	className?: string;
	component?: unknown;
	content?: unknown;
	props?: Record<string, unknown>;
}

export interface OpenModalAction {
	type: typeof OPEN_MODAL;
	payload: {
		requestId: RequestId;
		config: ModalConfig;
	};
}

export interface CloseModalAction {
	type: typeof CLOSE_MODAL;
}

export type ModalAction = OpenModalAction | CloseModalAction;

export function openModalAction(
	requestId: RequestId,
	config: ModalConfig,
): OpenModalAction {
	return {
		type: OPEN_MODAL,
		payload: { requestId, config },
	};
}

export function closeModalAction(): CloseModalAction {
	return { type: CLOSE_MODAL };
}
