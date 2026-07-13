export const SHOW_MESSAGE_BOX = "messageBox/show";
export const HIDE_MESSAGE_BOX = "messageBox/hide";

export type MessageBoxValue = unknown;

export interface MessageBoxPayload extends Record<string, unknown> {
	type?: "error" | "confirm";
	title?: unknown;
	message?: unknown;
	isAlert?: boolean;
	showInput?: boolean;
	onResolve?: (value: MessageBoxValue) => void;
	onCancelAction?: () => void;
}

export interface ShowMessageBoxAction {
	type: typeof SHOW_MESSAGE_BOX;
	payload: MessageBoxPayload;
}

export interface HideMessageBoxAction {
	type: typeof HIDE_MESSAGE_BOX;
}

export type MessageBoxAction = ShowMessageBoxAction | HideMessageBoxAction;
export type MessageBoxDispatch = (action: MessageBoxAction) => unknown;
export type MessageBoxThunk = (
	dispatch: MessageBoxDispatch,
) => Promise<MessageBoxValue>;

function showMessageBoxAction(
	payload: MessageBoxPayload,
): ShowMessageBoxAction {
	return {
		type: SHOW_MESSAGE_BOX,
		payload,
	};
}

function createMessageBoxThunk(
	payload: MessageBoxPayload,
): MessageBoxThunk {
	return (dispatch) =>
		new Promise((resolve) => {
			const originalResolve = payload.onResolve;
			dispatch(
				showMessageBoxAction({
					...payload,
					onResolve: (value) => {
						originalResolve?.(value);
						resolve(value);
					},
				}),
			);
		});
}

export function alert(payload: MessageBoxPayload): MessageBoxThunk {
	return createMessageBoxThunk({
		type: "error",
		isAlert: true,
		...payload,
	});
}

export function prompt(payload: MessageBoxPayload): MessageBoxThunk {
	return createMessageBoxThunk({
		type: "confirm",
		showInput: true,
		...payload,
	});
}

export function confirm(payload: MessageBoxPayload): MessageBoxThunk {
	return createMessageBoxThunk({
		type: "confirm",
		...payload,
	});
}

export function hideMessageBox(): HideMessageBoxAction {
	return { type: HIDE_MESSAGE_BOX };
}
