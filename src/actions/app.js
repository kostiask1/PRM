export const OPEN_MODAL = "modal/open";
export const CLOSE_MODAL = "modal/close";
export const REFRESH_ENTITIES = "entities/refresh";
export const OPEN_MENTION_PICKER = "mentionPicker/open";
export const CLOSE_MENTION_PICKER = "mentionPicker/close";
export const REQUEST_DICE_ROLL = "dice/requestRoll";
export const PUBLISH_DICE_RESULT = "dice/publishResult";
export const SHOW_MESSAGE_BOX = "messageBox/show";
export const HIDE_MESSAGE_BOX = "messageBox/hide";
export const SET_NAVIGATION = "navigation/set";
export const SET_CAMPAIGNS = "campaigns/set";
export const REQUEST_CAMPAIGNS_RELOAD = "campaigns/requestReload";
export const SET_LANGUAGE = "language/set";

let mentionRequestSeq = 1;
let diceRollRequestSeq = 1;
let diceRollResultSeq = 1;

export function openModalAction(requestId, config) {
	return {
		type: OPEN_MODAL,
		payload: { requestId, config },
	};
}

export function closeModalAction() {
	return { type: CLOSE_MODAL };
}

export function refreshEntitiesAction() {
	return { type: REFRESH_ENTITIES };
}

export function setNavigationAction(payload) {
	return {
		type: SET_NAVIGATION,
		payload,
	};
}

export function setCampaignsAction(payload) {
	return {
		type: SET_CAMPAIGNS,
		payload: Array.isArray(payload) ? payload : [],
	};
}

export function requestCampaignsReloadAction() {
	return { type: REQUEST_CAMPAIGNS_RELOAD };
}

export function setLanguageAction(payload) {
	return {
		type: SET_LANGUAGE,
		payload: String(payload || "").toLowerCase(),
	};
}

export function openMentionPickerAction(request) {
	return {
		type: OPEN_MENTION_PICKER,
		payload: {
			requestId: mentionRequestSeq++,
			...request,
		},
	};
}

export function closeMentionPickerAction() {
	return { type: CLOSE_MENTION_PICKER };
}

export function requestDiceRollAction(payload) {
	return {
		type: REQUEST_DICE_ROLL,
		payload: {
			requestId: diceRollRequestSeq++,
			data: payload,
		},
	};
}

export function publishDiceResultAction(result, context = null) {
	return {
		type: PUBLISH_DICE_RESULT,
		payload: {
			resultId: diceRollResultSeq++,
			result,
			context,
		},
	};
}

export function showMessageBoxAction(payload) {
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

export function success(payload) {
	return createMessageBoxThunk({
		type: "success",
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

export function dispatchAlert(dispatch, payload) {
	return dispatch(alert(payload));
}

export function dispatchSuccess(dispatch, payload) {
	return dispatch(success(payload));
}

export function dispatchPrompt(dispatch, payload) {
	return dispatch(prompt(payload));
}

export function dispatchConfirm(dispatch, payload) {
	return dispatch(confirm(payload));
}

export function alertModal(dispatch, title, message, status = null) {
	const fullMessage = status ? `[Статус: ${status}] ${message}` : message;
	return dispatch(alert({ title, message: fullMessage }));
}

export function successModal(dispatch, title, message) {
	return dispatch(success({ title, message }));
}

export function promptModal(dispatch, title, message, defaultValue = "") {
	return dispatch(prompt({ title, message, defaultValue }));
}

export function confirmModal(dispatch, title, message, status = null) {
	const fullMessage = status ? `[Статус: ${status}] ${message}` : message;
	return dispatch(confirm({ title, message: fullMessage }));
}
