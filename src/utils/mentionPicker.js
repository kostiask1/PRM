import { openMentionPickerAction } from "../actions/app";

export function requestMentionSelection(dispatch) {
	return new Promise((resolve) => {
		dispatch(
			openMentionPickerAction({
				select: (name) => resolve({ status: "selected", name: name || "" }),
				cancel: () => resolve({ status: "cancelled" }),
			}),
		);
	});
}
