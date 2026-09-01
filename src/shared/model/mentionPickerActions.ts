import type { RequestId } from "./contracts.ts";

export const OPEN_MENTION_PICKER = "mentionPicker/open";
export const CLOSE_MENTION_PICKER = "mentionPicker/close";

export interface MentionPickerRequest {
	select: (name: string) => void;
	cancel: () => void;
}

export interface ActiveMentionPickerRequest extends MentionPickerRequest {
	requestId: RequestId;
}

export type MentionPickerAction =
	| {
			type: typeof OPEN_MENTION_PICKER;
			payload: ActiveMentionPickerRequest;
	  }
	| { type: typeof CLOSE_MENTION_PICKER };

let mentionRequestSeq: RequestId = 1;

export function openMentionPickerAction(
	request: MentionPickerRequest,
): MentionPickerAction {
	return {
		type: OPEN_MENTION_PICKER,
		payload: {
			requestId: mentionRequestSeq++,
			...request,
		},
	};
}

export function closeMentionPickerAction(): MentionPickerAction {
	return { type: CLOSE_MENTION_PICKER };
}
