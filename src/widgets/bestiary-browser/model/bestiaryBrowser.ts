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
export {
	executeAiMonsterEditRequest,
	getAiMonsterEditErrorMessage,
	getAiMonsterEditStartPlan,
	getAiMonsterInstructionPlan,
	isAbortError,
	shouldClearAiMonsterEditController,
} from "./bestiaryBrowserAiRequest.ts";
export type {
	AiMonsterEditRequestInput,
	AiMonsterEditRequestOutcome,
	AiMonsterEditStartPlan,
	AiMonsterInstructionPlan,
	ExecuteAiMonsterEditRequestOptions,
} from "./bestiaryBrowserAiRequest.ts";

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
