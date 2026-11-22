export type MentionSelectionResult =
	| { status: "selected"; name: string; label?: string }
	| { status: "cancelled" };

export interface MentionPickerRequest {
	select(name: string, label?: string): void;
	cancel(): void;
	query?: string;
	includeBestiary?: boolean;
}

export interface MentionSelectionOptions {
	includeBestiary?: boolean;
}

export type OpenMentionPicker = (request: MentionPickerRequest) => unknown;

export function requestMentionSelection(
	openMentionPicker: OpenMentionPicker,
	query = "",
	options: MentionSelectionOptions = {},
): Promise<MentionSelectionResult> {
	return new Promise((resolve) => {
		openMentionPicker({
			query,
			...(options.includeBestiary !== undefined
				? { includeBestiary: options.includeBestiary }
				: {}),
			select: (name, label) =>
				resolve({ status: "selected", name: name || "", ...(label !== undefined ? { label } : {}) }),
			cancel: () => resolve({ status: "cancelled" }),
		});
	});
}
