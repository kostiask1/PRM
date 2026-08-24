import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import {
	normalizeAiBestiaryGenerationResult,
	type AiBestiaryGenerationResult,
	type AiMonsterEditMode,
} from "./bestiaryBrowserAiResults.ts";

export interface AiMonsterInstructionPlan {
	error: "missing-instructions" | null;
	instructions: string;
}

export interface AiMonsterEditRequestInput {
	targetMonster: BestiaryMonster | null;
	mode: AiMonsterEditMode;
	rawInstructions: string;
	createInstruction: string;
	selectedModel: string;
	attachedImages: unknown[];
	attachedFiles: unknown[];
	language: string;
}

export type AiMonsterEditStartPlan =
	| { kind: "skip" }
	| { kind: "invalid"; error: "missing-instructions" }
	| {
			kind: "ready";
			targetMonster: BestiaryMonster;
			payload: Record<string, unknown>;
	  };

type ReadyAiMonsterEditStartPlan = Extract<
	AiMonsterEditStartPlan,
	{ kind: "ready" }
>;

export type AiMonsterEditRequestOutcome =
	| { status: "succeeded"; data: AiBestiaryGenerationResult }
	| { status: "cancelled" }
	| { status: "failed"; error: unknown; message: string };

export interface ExecuteAiMonsterEditRequestOptions {
	plan: ReadyAiMonsterEditStartPlan;
	signal: AbortSignal;
	fallbackError: string;
	generateAi(
		payload: Record<string, unknown>,
		options: { signal: AbortSignal },
	): Promise<unknown>;
	onApplied(
		data: AiBestiaryGenerationResult,
		targetMonster: BestiaryMonster,
	): void;
	onReset(): void;
	onError(message: string): void;
	onSettled(): void;
}

export function getAiMonsterInstructionPlan(
	mode: AiMonsterEditMode,
	rawInstructions: string,
	createInstruction: string,
): AiMonsterInstructionPlan {
	const instructions = rawInstructions.trim();
	if (mode !== "create-based") {
		return {
			error: instructions ? null : "missing-instructions",
			instructions,
		};
	}
	return {
		error: null,
		instructions: [createInstruction, instructions].filter(Boolean).join("\n\n"),
	};
}

export function getAiMonsterEditStartPlan({
	targetMonster,
	mode,
	rawInstructions,
	createInstruction,
	selectedModel,
	attachedImages,
	attachedFiles,
	language,
}: AiMonsterEditRequestInput): AiMonsterEditStartPlan {
	if (!targetMonster?.name) return { kind: "skip" };
	const instructionPlan = getAiMonsterInstructionPlan(
		mode,
		rawInstructions,
		createInstruction,
	);
	if (instructionPlan.error) {
		return { kind: "invalid", error: instructionPlan.error };
	}
	return {
		kind: "ready",
		targetMonster,
		payload: {
			type: "custom-monster",
			modelName: selectedModel || undefined,
			userInstructions: instructionPlan.instructions,
			path: { campaign: "bestiary" },
			attachedImages,
			attachedFiles,
			customMonsterTarget: targetMonster,
			customMonsterMode: mode,
			parseAIResponse: true,
			generateCharacters: false,
			generateNpcs: false,
			generateLocations: false,
			generateEncounters: false,
			entityScope: "custom-bestiary",
			contextConfig: null,
			language,
		},
	};
}

export function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === "AbortError";
}

export function getAiMonsterEditErrorMessage(
	error: unknown,
	fallback: string,
): string | null {
	if (isAbortError(error)) return null;
	return error instanceof Error && error.message ? error.message : fallback;
}

export function shouldClearAiMonsterEditController(
	activeController: unknown,
	completedController: unknown,
): boolean {
	return activeController === completedController;
}

export async function executeAiMonsterEditRequest({
	plan,
	signal,
	fallbackError,
	generateAi,
	onApplied,
	onReset,
	onError,
	onSettled,
}: ExecuteAiMonsterEditRequestOptions): Promise<AiMonsterEditRequestOutcome> {
	try {
		const data = normalizeAiBestiaryGenerationResult(
			await generateAi(plan.payload, { signal }),
		);
		onApplied(data, plan.targetMonster);
		onReset();
		return { status: "succeeded", data };
	} catch (error) {
		const message = getAiMonsterEditErrorMessage(error, fallbackError);
		if (message === null) return { status: "cancelled" };
		onError(message);
		return { status: "failed", error, message };
	} finally {
		onSettled();
	}
}
