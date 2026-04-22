export const OPEN_MODAL = "modal/open";
export const CLOSE_MODAL = "modal/close";
export const REFRESH_ENTITIES = "entities/refresh";
export const OPEN_MENTION_PICKER = "mentionPicker/open";
export const CLOSE_MENTION_PICKER = "mentionPicker/close";
export const REQUEST_DICE_ROLL = "dice/requestRoll";
export const PUBLISH_DICE_RESULT = "dice/publishResult";

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
