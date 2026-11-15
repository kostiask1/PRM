export type MentionSelectionResult =
	| { status: "selected"; name: string; label?: string }
	| { status: "cancelled" };

export interface MentionPickerRequest {
	select(name: string, label?: string): void;
	cancel(): void;
	query?: string;
}

export type OpenMentionPicker = (request: MentionPickerRequest) => unknown;

export function requestMentionSelection(
	openMentionPicker: OpenMentionPicker,
	query = "",
): Promise<MentionSelectionResult> {
	return new Promise((resolve) => {
		openMentionPicker({
			query,
			select: (name, label) =>
				resolve({ status: "selected", name: name || "", ...(label !== undefined ? { label } : {}) }),
			cancel: () => resolve({ status: "cancelled" }),
		});
	});
}
