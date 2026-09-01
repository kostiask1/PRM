import { useState } from "react";
import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import {
	executeMonsterFieldSavePlan,
	getMonsterFieldEditPlan,
	getMonsterFieldSavePlan,
	type EncounterMonsterTarget,
	type MonsterAiAction,
	type MonsterAiEditMode,
} from "../../../features/ai-edit-monster/index.js";
import { isEncounterCharacterParticipant } from "../../../entities/encounter/index.js";
import type {
	EncounterViewParticipant,
	MonsterAiUpdateOptions,
} from "./contracts.ts";

type FieldEditingMonster = {
	mode: MonsterAiEditMode;
	original: EncounterViewParticipant;
	monster: EncounterMonsterTarget;
};

type SaveApi = Parameters<typeof executeMonsterFieldSavePlan>[1];

interface Options {
	api: SaveApi;
	creatureLabel: string;
	duplicateNameMessage: string;
	errorTitle: string;
	unknownError: string;
	refreshEntities(): void;
	showMessage(message: { title: string; message: string }): void;
	onUpdateMonster(
		instanceId: string,
		monster: EncounterViewParticipant,
		options?: MonsterAiUpdateOptions,
	): void;
}

export function useEncounterMonsterFieldEditing(options: Options) {
	const [actionMonster, setActionMonster] =
		useState<EncounterViewParticipant | null>(null);
	const [editing, setEditing] = useState<FieldEditingMonster | null>(null);

	const openAction = (monster: EncounterViewParticipant) => {
		if (!monster?.instanceId || isEncounterCharacterParticipant(monster)) {
			return;
		}
		setActionMonster(monster);
	};

	const closeAction = () => {
		setActionMonster(null);
	};

	const chooseAction = (action: MonsterAiAction) => {
		const plan = getMonsterFieldEditPlan(
			action,
			actionMonster,
			options.creatureLabel,
		);
		if (plan.kind === "none") return;
		setActionMonster(null);
		setEditing({
			mode: plan.mode,
			original: plan.original as EncounterViewParticipant,
			monster: plan.monster,
		});
	};

	const closeEditor = () => {
		setEditing(null);
	};

	const save = async (draftMonster: BestiaryMonster) => {
		if (!editing) return;
		const plan = getMonsterFieldSavePlan(
			editing.mode,
			editing.original,
			draftMonster,
		);
		await executeMonsterFieldSavePlan(
			plan,
			options.api,
			options.duplicateNameMessage,
			{
				onLocal: (instanceId, monster) => options.onUpdateMonster(
					instanceId,
					monster as EncounterViewParticipant,
					{ localOverride: true, preserveCurrentHp: false },
				),
				onPersistent: (instanceId, monster) => options.onUpdateMonster(
					instanceId,
					monster as EncounterViewParticipant,
					{ preserveCurrentHp: false },
				),
				onRefresh: options.refreshEntities,
				onClose: closeEditor,
				onError: (error) => options.showMessage({
					title: options.errorTitle,
					message: error instanceof Error ? error.message : options.unknownError,
				}),
			},
		);
	};

	return {
		actionMonster,
		editingMonster: editing?.monster || null,
		openAction,
		closeAction,
		chooseAction,
		closeEditor,
		save,
	};
}
