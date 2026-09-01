import { useState, type Dispatch, type SetStateAction } from "react";
import type { ImagePromptTarget } from "./imagePromptPicker.ts";

export interface AiImagePromptState {
	isOpen: boolean;
	setIsOpen: Dispatch<SetStateAction<boolean>>;
	selectedTarget: ImagePromptTarget | null;
	setSelectedTarget: Dispatch<SetStateAction<ImagePromptTarget | null>>;
	instructions: string;
	setInstructions: Dispatch<SetStateAction<string>>;
	request: string;
	setRequest: Dispatch<SetStateAction<string>>;
	isContextMode: boolean;
	setIsContextMode: Dispatch<SetStateAction<boolean>>;
}

export function useAiImagePromptState(): AiImagePromptState {
	const [isOpen, setIsOpen] = useState(false);
	const [selectedTarget, setSelectedTarget] =
		useState<ImagePromptTarget | null>(null);
	const [instructions, setInstructions] = useState("");
	const [request, setRequest] = useState("");
	const [isContextMode, setIsContextMode] = useState(false);
	return {
		isOpen,
		setIsOpen,
		selectedTarget,
		setSelectedTarget,
		instructions,
		setInstructions,
		request,
		setRequest,
		isContextMode,
		setIsContextMode,
	};
}
