import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import type { AiHistoryEntry } from "../../../features/ai/index.js";
import { addSourceMonsterImageToDraft } from "../../../features/ai/index.js";
import {
	getMonsterListFromResponse,
	type CustomBestiaryUpdateOptions,
} from "./bestiaryBrowserCustomData.ts";

export interface AiBestiaryGenerationResult {
	draft: boolean;
	aiResponse: AiHistoryEntry | null;
	updated: unknown;
	generated: CustomBestiaryUpdateOptions["generated"];
}

export type AiMonsterGenerationResultPlan =
	| { kind: "draft"; entry: AiHistoryEntry | null }
	| {
			kind: "update";
			updated: unknown;
			options: CustomBestiaryUpdateOptions;
	  }
	| { kind: "skip" };

export type AiMonsterEditMode = "edit" | "local-edit" | "create-based";

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function normalizeAiBestiaryGenerationResult(
	value: unknown,
): AiBestiaryGenerationResult {
	const record = isRecord(value) ? value : {};
	return {
		draft: record.draft === true,
		aiResponse: isRecord(record.aiResponse)
			? (record.aiResponse as AiHistoryEntry)
			: null,
		updated: record.updated,
		generated: isRecord(record.generated)
			? {
					monsters: getMonsterListFromResponse({
						monsters: record.generated.monsters,
					}),
				}
			: undefined,
	};
}

function getAiMonsterDraftResultPlan(
	data: AiBestiaryGenerationResult,
	targetMonster: BestiaryMonster,
): AiMonsterGenerationResultPlan | null {
	if (!data.draft || !data.aiResponse) return null;
	return {
		kind: "draft",
		entry:
			addSourceMonsterImageToDraft(data.aiResponse, targetMonster) ?? null,
	};
}

function getAiMonsterUpdateResultPlan(
	data: AiBestiaryGenerationResult,
	targetMonster: BestiaryMonster,
	mode: AiMonsterEditMode,
): AiMonsterGenerationResultPlan {
	if (!data.updated) return { kind: "skip" };
	return {
		kind: "update",
		updated: data.updated,
		options: {
			generated: data.generated,
			selectedName: mode === "edit" ? targetMonster.name : undefined,
			trackUndo: false,
		},
	};
}

export function getAiMonsterGenerationResultPlan(
	data: AiBestiaryGenerationResult,
	targetMonster: BestiaryMonster,
	mode: AiMonsterEditMode,
): AiMonsterGenerationResultPlan {
	return (
		getAiMonsterDraftResultPlan(data, targetMonster) ??
		getAiMonsterUpdateResultPlan(data, targetMonster, mode)
	);
}
