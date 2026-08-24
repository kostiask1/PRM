import type {
	BestiaryFavorite,
	BestiaryMonster,
} from "../../../entities/bestiary/index.js";
import type {
	AiHistoryEntry,
	AiHistoryResource,
	AiHistoryRestoreResult,
} from "../../../features/ai/index.js";
import {
	addSourceMonsterImageToDraft,
	getFirstChangedMonsterName,
} from "../../../features/ai/index.js";
import {
	isCustomSource,
	normalizeMonsterName,
	normalizeMonsterSource,
} from "./bestiaryBrowserFiltering.ts";
import {
	cloneCustomMonsters,
	customMonsterListsEqual,
	findCustomMonsterByName,
	getAutoSelectedMonster,
	getMonsterListIndex,
	isSameMonsterIdentity,
	monsterMatchesReference,
	type MonsterReference,
} from "./bestiaryBrowserSelection.ts";

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

export interface CustomBestiaryUpdateOptions {
	generated?: { monsters?: BestiaryMonster[] } | null;
	selectedName?: string;
	trackUndo?: boolean;
}

export interface CustomBestiaryUpdatePlan {
	hasUpdatedMonsters: boolean;
	updatedMonsters: BestiaryMonster[];
	nextSelectedMonster: BestiaryMonster | null;
	trackUndo: boolean;
}

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

export interface CreateBasedMonsterPlan {
	duplicate: boolean;
	normalizedName: string;
	monster: BestiaryMonster;
}

export type BestiaryFieldEditStartPlan =
	| { kind: "skip" }
	| {
			kind: "ready";
			mode: "edit" | "create-based";
			originalMonster: BestiaryMonster;
			draftMonster: BestiaryMonster;
	  };

export type BestiaryFieldEditMode = "edit" | "create-based";

export type BestiaryFieldEditSaveOutcome =
	| { status: "skipped" }
	| { status: "succeeded"; updatedMonster: BestiaryMonster }
	| { status: "failed"; error: unknown };

export interface ExecuteBestiaryFieldEditSaveOptions {
	draftMonster: BestiaryMonster;
	editingMonster: BestiaryMonster | null;
	mode: BestiaryFieldEditMode;
	createBased(draftMonster: BestiaryMonster): Promise<BestiaryMonster>;
	update(
		draftMonster: BestiaryMonster,
		editingMonster: BestiaryMonster,
	): Promise<BestiaryMonster>;
	onApplied(previousName: string, updatedMonster: BestiaryMonster): void;
	onClose(): void;
	onError(error: unknown): void;
}

export type CustomMonsterDeleteStartPlan =
	| { kind: "skip" }
	| { kind: "ready"; monsterName: string };

export interface AiMonsterInstructionPlan {
	error: "missing-instructions" | null;
	instructions: string;
}

export type AiMonsterEditMode = "edit" | "local-edit" | "create-based";

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

function isBestiaryMonster(value: unknown): value is BestiaryMonster {
	return isRecord(value) && typeof value.name === "string";
}

export function getMonsterListFromResponse(data: unknown): BestiaryMonster[] {
	if (Array.isArray(data)) return data.filter(isBestiaryMonster);
	if (!isRecord(data)) return [];
	const candidates = [data.monster, data.monsters, data.results];
	const list = candidates.find(Array.isArray);
	return Array.isArray(list) ? list.filter(isBestiaryMonster) : [];
}

function normalizeAiBestiaryGenerationResult(
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

function getMonsterImageUrl(monster: BestiaryMonster | null | undefined): string {
	return typeof monster?.imageUrl === "string" ? monster.imageUrl : "";
}

export function getCreateBasedMonsterPlan(
	currentMonsters: BestiaryMonster[],
	draftMonster: BestiaryMonster,
	originalMonster: BestiaryMonster | null,
	fallbackImageUrl: string,
): CreateBasedMonsterPlan {
	const normalizedName = normalizeMonsterName(draftMonster.name);
	return {
		duplicate: currentMonsters.some(
			(monster) => normalizeMonsterName(monster.name) === normalizedName,
		),
		normalizedName,
		monster: {
			...draftMonster,
			source: "CUSTOM",
			imageUrl:
				getMonsterImageUrl(draftMonster) ||
				getMonsterImageUrl(originalMonster) ||
				fallbackImageUrl,
		},
	};
}

export function getEditedCustomMonsterPayload(
	draftMonster: BestiaryMonster,
	editingMonster: BestiaryMonster,
	originalMonster: BestiaryMonster | null,
): BestiaryMonster {
	return {
		...draftMonster,
		source: "CUSTOM",
		imageUrl:
			draftMonster.imageUrl ??
			editingMonster.imageUrl ??
			originalMonster?.imageUrl ??
			null,
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

function hasBestiaryFieldEditTarget(
	monster: BestiaryMonster | null,
): monster is BestiaryMonster {
	return Boolean(monster?.name);
}

function getBestiaryFieldEditImageUrl(
	monster: BestiaryMonster,
	getLocalTokenSrc: (monster: BestiaryMonster) => string,
): string {
	if (typeof monster.imageUrl === "string" && monster.imageUrl) {
		return monster.imageUrl;
	}
	return getLocalTokenSrc(monster);
}

function getCustomBestiaryFieldEditPlan(
	monster: BestiaryMonster,
): BestiaryFieldEditStartPlan {
	return {
		kind: "ready",
		mode: "edit",
		originalMonster: monster,
		draftMonster: monster,
	};
}

function getOfficialBestiaryFieldEditPlan(
	monster: BestiaryMonster,
	fallbackName: string,
	getLocalTokenSrc: (monster: BestiaryMonster) => string,
): BestiaryFieldEditStartPlan {
	return {
		kind: "ready",
		mode: "create-based",
		originalMonster: monster,
		draftMonster: {
			...monster,
			name: monster.name || fallbackName,
			source: "CUSTOM",
			imageUrl: getBestiaryFieldEditImageUrl(monster, getLocalTokenSrc),
		},
	};
}

export function getBestiaryFieldEditStartPlan(
	monster: BestiaryMonster | null,
	fallbackName: string,
	getLocalTokenSrc: (monster: BestiaryMonster) => string,
): BestiaryFieldEditStartPlan {
	if (!hasBestiaryFieldEditTarget(monster)) return { kind: "skip" };
	return isCustomSource(monster.source)
		? getCustomBestiaryFieldEditPlan(monster)
		: getOfficialBestiaryFieldEditPlan(
				monster,
				fallbackName,
				getLocalTokenSrc,
			);
}

function saveBestiaryFieldEditMonster(
	options: ExecuteBestiaryFieldEditSaveOptions,
	editingMonster: BestiaryMonster,
): Promise<BestiaryMonster> {
	return options.mode === "create-based"
		? options.createBased(options.draftMonster)
		: options.update(options.draftMonster, editingMonster);
}

function getBestiaryFieldEditPreviousName(
	mode: BestiaryFieldEditMode,
	editingMonster: BestiaryMonster,
): string {
	return mode === "create-based" ? "" : editingMonster.name;
}

export async function executeBestiaryFieldEditSave(
	options: ExecuteBestiaryFieldEditSaveOptions,
): Promise<BestiaryFieldEditSaveOutcome> {
	const editingMonster = options.editingMonster;
	if (!editingMonster?.name) return { status: "skipped" };
	try {
		const updatedMonster = await saveBestiaryFieldEditMonster(
			options,
			editingMonster,
		);
		options.onApplied(
			getBestiaryFieldEditPreviousName(options.mode, editingMonster),
			updatedMonster,
		);
		options.onClose();
		return { status: "succeeded", updatedMonster };
	} catch (error) {
		options.onError(error);
		return { status: "failed", error };
	}
}

function hasNamedBestiaryMonster(
	monster: BestiaryMonster | null,
): monster is BestiaryMonster {
	return Boolean(monster?.name);
}

export function getCustomMonsterDeleteStartPlan(
	monster: BestiaryMonster | null,
): CustomMonsterDeleteStartPlan {
	if (!hasNamedBestiaryMonster(monster)) return { kind: "skip" };
	if (!isCustomSource(monster.source)) return { kind: "skip" };
	return { kind: "ready", monsterName: monster.name };
}

export function replaceDeletedCustomMonsterList(
	currentMonsters: BestiaryMonster[],
	updatedCustomMonsters: unknown,
): BestiaryMonster[] {
	return [
		...currentMonsters.filter((monster) => !isCustomSource(monster.source)),
		...(Array.isArray(updatedCustomMonsters)
			? (updatedCustomMonsters as BestiaryMonster[])
			: []),
	];
}

export function removeDeletedCustomMonsterFavorite(
	favorites: BestiaryFavorite[],
	monsterName: string,
): BestiaryFavorite[] {
	return favorites.filter(
		(favorite) => !isDeletedCustomMonsterFavorite(favorite, monsterName),
	);
}

function isDeletedCustomMonsterFavorite(
	favorite: BestiaryFavorite,
	monsterName: string,
): boolean {
	return favorite.name === monsterName && isCustomSource(favorite.source);
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

function getGeneratedMonsterSelection(
	updatedMonsters: BestiaryMonster[],
	generatedMonsters: BestiaryMonster[],
): BestiaryMonster | null {
	const generated = generatedMonsters[0];
	if (!generated) return null;
	return findCustomMonsterByName(updatedMonsters, generated.name) ?? generated;
}

function getRequestedMonsterSelection(
	updatedMonsters: BestiaryMonster[],
	selectedName: string | undefined,
): BestiaryMonster | null {
	return selectedName
		? findCustomMonsterByName(updatedMonsters, selectedName)
		: null;
}

function getUpdatedMonsterCollection(updated: unknown): {
	hasUpdatedMonsters: boolean;
	updatedMonsters: BestiaryMonster[];
} {
	const record = isRecord(updated) ? updated : null;
	if (!Array.isArray(record?.monsters)) {
		return { hasUpdatedMonsters: false, updatedMonsters: [] };
	}
	return {
		hasUpdatedMonsters: true,
		updatedMonsters: getMonsterListFromResponse({ monsters: record.monsters }),
	};
}

function getCustomBestiaryUpdateSelection(
	updatedMonsters: BestiaryMonster[],
	options: CustomBestiaryUpdateOptions,
): BestiaryMonster | null {
	const generatedMonsters = getMonsterListFromResponse(options.generated);
	return (
		getGeneratedMonsterSelection(updatedMonsters, generatedMonsters) ??
		getRequestedMonsterSelection(updatedMonsters, options.selectedName)
	);
}

function shouldTrackCustomBestiaryUpdate(
	hasUpdatedMonsters: boolean,
	trackUndo: boolean | undefined,
): boolean {
	return hasUpdatedMonsters && trackUndo !== false;
}

export function getCustomBestiaryUpdatePlan(
	updated: unknown,
	options: CustomBestiaryUpdateOptions = {},
): CustomBestiaryUpdatePlan {
	const { hasUpdatedMonsters, updatedMonsters } =
		getUpdatedMonsterCollection(updated);
	return {
		hasUpdatedMonsters,
		updatedMonsters,
		nextSelectedMonster: getCustomBestiaryUpdateSelection(
			updatedMonsters,
			options,
		),
		trackUndo: shouldTrackCustomBestiaryUpdate(
			hasUpdatedMonsters,
			options.trackUndo,
		),
	};
}

export function parseImportedCustomMonsters(raw: string): BestiaryMonster[] {
	const parsed: unknown = JSON.parse(raw);
	return getMonsterListFromResponse(parsed).map((monster) => ({
		...monster,
		name: monster.name.trim(),
		source: "CUSTOM",
	}));
}

export function mergeImportedCustomMonsters(
	current: BestiaryMonster[],
	imported: BestiaryMonster[],
): BestiaryMonster[] {
	const byName = new Map(
		current.map((monster) => [normalizeMonsterName(monster.name), monster]),
	);
	for (const monster of imported) {
		byName.set(normalizeMonsterName(monster.name), monster);
	}
	return [...byName.values()];
}
