import { useState } from "react";
import type { AiUiAttachment } from "../../../features/ai/ui/index.js";

interface UseAiAssistantControlsOptions {
	generateEncountersByDefault: boolean;
	isEncounter: boolean;
}

export function useAiAssistantControls({
	generateEncountersByDefault,
	isEncounter,
}: UseAiAssistantControlsOptions) {
	const [isOpen, setIsOpen] = useState(false);
	const [isContextModalOpen, setIsContextModalOpen] = useState(false);
	const [useContext, setUseContext] = useState(true);
	const [error, setError] = useState("");
	const [userInstructions, setUserInstructions] = useState("");
	const [notification, setNotification] = useState<string | null>(null);
	const [attachedImages, setAttachedImages] = useState<AiUiAttachment[]>([]);
	const [attachedFiles, setAttachedFiles] = useState<AiUiAttachment[]>([]);
	const [parseAIResponse, setParseAIResponse] = useState(isEncounter);
	const [generateCharacters, setGenerateCharacters] = useState(false);
	const [generateNpcs, setGenerateNpcs] = useState(true);
	const [generateLocations, setGenerateLocations] = useState(true);
	const [generateEncounters, setGenerateEncounters] = useState(
		generateEncountersByDefault,
	);
	const [generateCustomMonsters, setGenerateCustomMonsters] = useState(false);

	return {
		attachedFiles,
		attachedImages,
		error,
		generateCharacters,
		generateCustomMonsters,
		generateEncounters,
		generateLocations,
		generateNpcs,
		isContextModalOpen,
		isOpen,
		notification,
		parseAIResponse,
		setAttachedFiles,
		setAttachedImages,
		setError,
		setGenerateCharacters,
		setGenerateCustomMonsters,
		setGenerateEncounters,
		setGenerateLocations,
		setGenerateNpcs,
		setIsContextModalOpen,
		setIsOpen,
		setNotification,
		setParseAIResponse,
		setUseContext,
		setUserInstructions,
		useContext,
		userInstructions,
	};
}
