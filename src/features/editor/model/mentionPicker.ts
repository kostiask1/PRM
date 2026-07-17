import { openMentionPickerAction } from "../../../shared/model/index.js";

export type MentionSelectionResult =
	| { status: "selected"; name: string }
	| { status: "cancelled" };

type MentionPickerAction = ReturnType<typeof openMentionPickerAction>;
type MentionPickerDispatch = (action: MentionPickerAction) => unknown;

export function requestMentionSelection(
	dispatch: MentionPickerDispatch,
): Promise<MentionSelectionResult> {
	return new Promise((resolve) => {
		dispatch(
			openMentionPickerAction({
				select: (name) =>
					resolve({ status: "selected", name: name || "" }),
				cancel: () => resolve({ status: "cancelled" }),
			}),
		);
	});
}
