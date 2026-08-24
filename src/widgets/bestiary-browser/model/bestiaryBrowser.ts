import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import type {
	AiHistoryEntry,
	AiHistoryResource,
	AiHistoryRestoreResult,
} from "../../../features/ai/index.js";
import { getFirstChangedMonsterName } from "../../../features/ai/index.js";
import {
	cloneCustomMonsters,
	customMonsterListsEqual,
	type MonsterReference,
} from "./bestiaryBrowserSelection.ts";
import {
	getMonsterListFromResponse,
	type CustomBestiaryUpdateOptions,
	type CustomBestiaryUpdatePlan,
} from "./bestiaryBrowserCustomData.ts";
import {
	normalizeAiBestiaryGenerationResult,
	type AiBestiaryGenerationResult,
} from "./bestiaryBrowserAiResults.ts";

export {
	filterBestiaryMonsters,
	getMonsterCrDisplay,
	getMonsterItemKey,
	getMonsterSizeText,
	getMonsterTagText,
	getNextBestiarySortOrder,
	isCustomSource,
	normalizeMonsterName,
	normalizeMonsterSource,
	parseMonsterCr,
	sortBestiaryMonsters,
} from "./bestiaryBrowserFiltering.ts";
export type {
	BestiaryFilterOptions,
	BestiarySortOrder,
} from "./bestiaryBrowserFiltering.ts";
export {
	executeBestiarySelectedSourcesSave,
	executeBestiarySyncEventPlan,
	getBestiarySourceCodes,
	getBestiarySyncEventPlan,
	parseBestiarySyncEvent,
} from "./bestiaryBrowserSync.ts";
export type {
	BestiarySelectedSourcesSaveOutcome,
	BestiarySyncEvent,
	BestiarySyncEventExecution,
	BestiarySyncEventPlan,
	ExecuteBestiarySelectedSourcesSaveOptions,
	ExecuteBestiarySyncEventPlanOptions,
} from "./bestiaryBrowserSync.ts";
export { enrichMonstersWithLegendaryGroups } from "./bestiaryBrowserLegendary.ts";
export {
	getBestiaryDetailPresentation,
	getBestiaryMonsterRowPresentation,
} from "./bestiaryBrowserPresentation.ts";
export type {
	BestiaryMonsterRowPresentation,
	BestiaryMonsterRowPrimaryAction,
} from "./bestiaryBrowserPresentation.ts";
export {
	cloneCustomMonsters,
	customMonsterListsEqual,
	findCustomMonsterByName,
	getAutoSelectedMonster,
	getBestiaryInitialSelectionScrollPlan,
	getBestiarySelectionPlan,
	getCustomRefreshSelection,
	getMonsterListIndex,
	isSameMonsterIdentity,
	monsterMatchesReference,
	parseMonsterReference,
} from "./bestiaryBrowserSelection.ts";
export type {
	BestiaryInitialSelectionScrollPlan,
	BestiarySelectionPlan,
	MonsterReference,
} from "./bestiaryBrowserSelection.ts";
export {
	getCustomBestiaryUpdatePlan,
	getCustomMonsterDeleteStartPlan,
	getMonsterListFromResponse,
	mergeImportedCustomMonsters,
	parseImportedCustomMonsters,
	removeDeletedCustomMonsterFavorite,
	replaceDeletedCustomMonsterList,
} from "./bestiaryBrowserCustomData.ts";
export type {
	CustomBestiaryUpdateOptions,
	CustomBestiaryUpdatePlan,
	CustomMonsterDeleteStartPlan,
} from "./bestiaryBrowserCustomData.ts";
export {
	executeBestiaryFieldEditSave,
	getBestiaryFieldEditStartPlan,
	getCreateBasedMonsterPlan,
	getEditedCustomMonsterPayload,
} from "./bestiaryBrowserFieldEditing.ts";
export type {
	BestiaryFieldEditMode,
	BestiaryFieldEditSaveOutcome,
	BestiaryFieldEditStartPlan,
	CreateBasedMonsterPlan,
	ExecuteBestiaryFieldEditSaveOptions,
} from "./bestiaryBrowserFieldEditing.ts";
export { getAiMonsterGenerationResultPlan } from "./bestiaryBrowserAiResults.ts";
export type {
	AiBestiaryGenerationResult,
	AiMonsterEditMode,
	AiMonsterGenerationResultPlan,
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

export type AiDraftRestoreMode = "apply" | "undo";

export interface AiDraftRestoreStartPlan {
	entry: AiHistoryEntry;
	mode: AiDraftRestoreMode;
	resourceIds: string[] | undefined;
	undoSnapshot: BestiaryMonster[] | null;
}

export interface AiDraftRestoreUpdatePlan {
	updated: Record<string, unknown>;
	options: CustomBestiaryUpdateOptions;
	undoSnapshot: BestiaryMonster[] | null;
}

export interface AiDraftRestoreResultPlan {
	nextEntry: AiHistoryEntry;
	update: AiDraftRestoreUpdatePlan | null;
}

export interface AiDraftRestorePayload {
	resourceIds: string[] | undefined;
}

export interface ExecuteAiDraftRestoreOptions {
	start: AiDraftRestoreStartPlan | null;
	onBusy(isBusy: boolean): void;
	apply(
		entry: AiHistoryEntry,
		payload: AiDraftRestorePayload,
	): Promise<AiHistoryRestoreResult | null>;
	undo(
		entry: AiHistoryEntry,
		payload: AiDraftRestorePayload,
	): Promise<AiHistoryRestoreResult | null>;
	onEntry(entry: AiHistoryEntry): void;
	onUndoSnapshot(snapshot: BestiaryMonster[]): void;
	onUpdate(
		updated: Record<string, unknown>,
		options: CustomBestiaryUpdateOptions,
	): void;
	onError(error: unknown): void;
}

export type AiDraftRestoreExecutionOutcome =
	| { status: "skipped" }
	| { status: "succeeded"; plan: AiDraftRestoreResultPlan }
	| { status: "failed"; error: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function getAiDraftRestoreStartPlan(
	entry: AiHistoryEntry | null | undefined,
	mode: AiDraftRestoreMode,
	resourceIds: string[] | undefined,
	isRestoring: boolean,
	customMonsters: BestiaryMonster[],
): AiDraftRestoreStartPlan | null {
	if (!entry?.id || isRestoring) return null;
	return {
		entry,
		mode,
		resourceIds,
		undoSnapshot:
			mode === "apply" ? cloneCustomMonsters(customMonsters) : null,
	};
}

function getAiDraftRestoreUndoSnapshot(
	start: AiDraftRestoreStartPlan,
	updated: Record<string, unknown>,
): BestiaryMonster[] | null {
	if (start.mode !== "apply" || !start.undoSnapshot) return null;
	return customMonsterListsEqual(
		start.undoSnapshot,
		getMonsterListFromResponse(updated),
	)
		? null
		: start.undoSnapshot;
}

function getAiDraftRestoreUpdateOptions(
	start: AiDraftRestoreStartPlan,
	nextEntry: AiHistoryEntry,
): CustomBestiaryUpdateOptions {
	if (start.mode === "undo") return { trackUndo: false };
	return {
		selectedName:
			getFirstChangedMonsterName(nextEntry, start.resourceIds) ?? undefined,
		trackUndo: false,
	};
}

export function getAiDraftRestoreResultPlan(
	start: AiDraftRestoreStartPlan,
	result: AiHistoryRestoreResult | null,
): AiDraftRestoreResultPlan {
	const nextEntry = result?.response || start.entry;
	if (!result?.updated) return { nextEntry, update: null };
	return {
		nextEntry,
		update: {
			updated: result.updated,
			options: getAiDraftRestoreUpdateOptions(start, nextEntry),
			undoSnapshot: getAiDraftRestoreUndoSnapshot(start, result.updated),
		},
	};
}

function requestAiDraftRestore(
	options: ExecuteAiDraftRestoreOptions,
	start: AiDraftRestoreStartPlan,
): Promise<AiHistoryRestoreResult | null> {
	const payload = { resourceIds: start.resourceIds };
	return start.mode === "undo"
		? options.undo(start.entry, payload)
		: options.apply(start.entry, payload);
}

function applyAiDraftRestoreResult(
	options: ExecuteAiDraftRestoreOptions,
	plan: AiDraftRestoreResultPlan,
): void {
	options.onEntry(plan.nextEntry);
	if (!plan.update) return;
	if (plan.update.undoSnapshot) {
		options.onUndoSnapshot(plan.update.undoSnapshot);
	}
	options.onUpdate(plan.update.updated, plan.update.options);
}

export async function executeAiDraftRestore(
	options: ExecuteAiDraftRestoreOptions,
): Promise<AiDraftRestoreExecutionOutcome> {
	const { start } = options;
	if (!start) return { status: "skipped" };
	options.onBusy(true);
	try {
		const result = await requestAiDraftRestore(options, start);
		const plan = getAiDraftRestoreResultPlan(start, result);
		applyAiDraftRestoreResult(options, plan);
		return { status: "succeeded", plan };
	} catch (error) {
		options.onError(error);
		return { status: "failed", error };
	} finally {
		options.onBusy(false);
	}
}

function getResourceAfterRecord(
	resource: AiHistoryResource | undefined,
): Record<string, unknown> | null {
	return isRecord(resource?.after) ? resource.after : null;
}

export function preserveAiDraftResourceMetadata(
	resources: AiHistoryResource[],
	sourceResources: AiHistoryResource[] | null | undefined,
): AiHistoryResource[] {
	const sourceById = new Map(
		(sourceResources ?? []).map((resource) => [String(resource.id), resource]),
	);
	return resources.map((resource) => {
		const after = getResourceAfterRecord(resource);
		if (!after) return resource;
		const sourceAfter = getResourceAfterRecord(sourceById.get(String(resource.id)));
		if (!sourceAfter) return resource;
		return {
			...resource,
			after: {
				...after,
				imageUrl: after.imageUrl || sourceAfter.imageUrl,
				originalBestiaryName:
					after.originalBestiaryName || sourceAfter.originalBestiaryName,
			},
		};
	});
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
	return (
		error instanceof DOMException &&
		error.name === "AbortError"
	);
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
