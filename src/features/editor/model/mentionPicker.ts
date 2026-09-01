export type MentionSelectionResult =
	| { status: "selected"; name: string }
	| { status: "cancelled" };

export interface MentionPickerRequest {
	select(name: string): void;
	cancel(): void;
}

export type OpenMentionPicker = (request: MentionPickerRequest) => unknown;

export function requestMentionSelection(
	openMentionPicker: OpenMentionPicker,
): Promise<MentionSelectionResult> {
	return new Promise((resolve) => {
		openMentionPicker({
			select: (name) =>
				resolve({ status: "selected", name: name || "" }),
			cancel: () => resolve({ status: "cancelled" }),
		});
	});
}
