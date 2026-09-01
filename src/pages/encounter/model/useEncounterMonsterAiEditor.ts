import { useState } from "react";
import type { AiModelDescriptor } from "../../../features/ai/index.js";
import type { MonsterAiEditMode } from "../../../features/ai-edit-monster/index.js";
import type { EncounterViewParticipant } from "./contracts.ts";

export function useEncounterMonsterAiEditor() {
	const [editingMonster, setEditingMonster] =
		useState<EncounterViewParticipant | null>(null);
	const [mode, setMode] = useState<MonsterAiEditMode>("edit");
	const [instructions, setInstructions] = useState("");
	const [error, setError] = useState("");
	const [isEditing, setIsEditing] = useState(false);
	const [models, setModels] = useState<AiModelDescriptor[]>([]);
	const [selectedModel, setSelectedModel] = useState("");

	const start = (monster: EncounterViewParticipant, nextMode: MonsterAiEditMode) => {
		setMode(nextMode);
		setEditingMonster(monster);
		setInstructions("");
		setError("");
	};

	const close = () => {
		if (isEditing) return;
		setEditingMonster(null);
		setMode("edit");
		setInstructions("");
		setError("");
	};

	const completeSuccess = () => {
		setEditingMonster(null);
		setMode("edit");
		setInstructions("");
	};

	return {
		editingMonster,
		mode,
		instructions,
		error,
		isEditing,
		models,
		selectedModel,
		setError,
		setInstructions,
		setIsEditing,
		setModels,
		setSelectedModel,
		start,
		close,
		completeSuccess,
	};
}
