import {
	createContext,
	useContext,
	type ReactNode,
} from "react";

import type { MentionPickerRequest } from "../model/mentionPicker.ts";

export interface EditorMentionPickerRuntime {
	openMentionPicker(request: MentionPickerRequest): void;
}

export interface EditorMentionPickerRuntimeProviderProps {
	runtime: EditorMentionPickerRuntime;
	children?: ReactNode;
}

const EditorMentionPickerRuntimeContext =
	createContext<EditorMentionPickerRuntime | null>(null);

export function EditorMentionPickerRuntimeProvider({
	runtime,
	children,
}: EditorMentionPickerRuntimeProviderProps) {
	return (
		<EditorMentionPickerRuntimeContext.Provider value={runtime}>
			{children}
		</EditorMentionPickerRuntimeContext.Provider>
	);
}

export function useEditorMentionPickerRuntime(): EditorMentionPickerRuntime {
	const runtime = useContext(EditorMentionPickerRuntimeContext);
	if (runtime === null) {
		throw new Error(
			"EditorMentionPickerRuntimeProvider is required to render editor controls",
		);
	}
	return runtime;
}
