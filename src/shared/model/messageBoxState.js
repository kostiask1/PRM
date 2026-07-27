export const SHOW_MESSAGE_BOX = "messageBox/show";
export const HIDE_MESSAGE_BOX = "messageBox/hide";

function showMessageBoxAction(payload) {
	return {
		type: SHOW_MESSAGE_BOX,
		payload,
	};
}

function createMessageBoxThunk(payload) {
	return (dispatch) =>
		new Promise((resolve) => {
			const originalResolve = payload?.onResolve;
			dispatch(
				showMessageBoxAction({
					...payload,
					onResolve: (value) => {
						if (typeof originalResolve === "function") {
							originalResolve(value);
						}
						resolve(value);
					},
				}),
			);
		});
}

export function alert(payload) {
	return createMessageBoxThunk({
		type: "error",
		isAlert: true,
		...payload,
	});
}

export function prompt(payload) {
	return createMessageBoxThunk({
		type: "confirm",
		showInput: true,
		...payload,
	});
}

export function confirm(payload) {
	return createMessageBoxThunk({
		type: "confirm",
		...payload,
	});
}

export function hideMessageBox() {
	return { type: HIDE_MESSAGE_BOX };
}
