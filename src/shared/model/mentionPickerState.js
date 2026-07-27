export const OPEN_MENTION_PICKER = "mentionPicker/open";
export const CLOSE_MENTION_PICKER = "mentionPicker/close";

let mentionRequestSeq = 1;

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
