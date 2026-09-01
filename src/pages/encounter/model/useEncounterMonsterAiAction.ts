import { useState } from "react";
import type { MonsterAiAction, MonsterAiEditMode } from "../../../features/ai-edit-monster/index.js";
import type { EncounterViewParticipant } from "./contracts.ts";

interface Options {
	isEditing: boolean;
	onStartEditing(
		monster: EncounterViewParticipant,
		mode: MonsterAiEditMode,
	): void;
}

export function useEncounterMonsterAiAction(options: Options) {
	const [actionMonster, setActionMonster] =
		useState<EncounterViewParticipant | null>(null);
	const [targetInstanceId, setTargetInstanceId] = useState<string | null>(null);

	const openAction = (monster: EncounterViewParticipant) => {
		if (!monster?.name) return;
		setTargetInstanceId(monster.instanceId || null);
		setActionMonster(monster);
	};

	const closeAction = () => {
		if (options.isEditing) return;
		setActionMonster(null);
	};

	const chooseAction = (action: MonsterAiAction) => {
		if (action === "image-prompt") return;
		const mode = action;
		if (!actionMonster) return;
		const target = actionMonster;
		setActionMonster(null);
		options.onStartEditing(target, mode);
	};

	return {
		actionMonster,
		targetInstanceId,
		openAction,
		closeAction,
		chooseAction,
	};
}
