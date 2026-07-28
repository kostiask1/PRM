import type {
	BestiaryFavorite,
	BestiaryMonster,
	LegendaryGroup,
} from "../../../entities/bestiary/api/bestiaryApi.ts";
import type {
	AiHistoryEntry,
	AiHistoryResource,
	AiHistoryRestoreResult,
} from "../../../features/ai/index.js";
import {
	addSourceMonsterImageToDraft,
	getFirstChangedMonsterName,
} from "../../../features/ai/index.js";

export interface MonsterReference {
	name: string;
	source: string;
}

export type BestiarySortOrder = "none" | "desc" | "asc";

export interface BestiaryFilterOptions {
	selectedSources: string[];
	sourceFilter: string;
	onlyFavorites: boolean;
	favorites: BestiaryFavorite[];
	search: string;
	isDetailedSearch: boolean;
	matchesDetailedSearch: (monster: BestiaryMonster, search: string) => boolean;
	matchesSimpleSearch: (monster: BestiaryMonster, search: string) => boolean;
}

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

export interface BestiarySelectionPlan {
	monster: BestiaryMonster;
	explicit: boolean;
}

export interface BestiaryInitialSelectionScrollPlan {
	scrollKey: string;
	selectedIndex: number;
}

export type BestiaryMonsterRowPrimaryAction = "select" | "add" | null;

export interface BestiaryMonsterRowPresentation {
	crDisplay: string | number;
	favoriteTitleKey: "Add to favorites" | "Remove from favorites";
	isCustom: boolean;
	isFavorite: boolean;
	isSelected: boolean;
	nextSelection: BestiaryMonster | null;
	primaryAction: BestiaryMonsterRowPrimaryAction;
	primaryTitleKey: "Add to encounter" | "Insert" | null;
	tokenSrc: string;
}

type BestiaryMonsterAction = (monster: BestiaryMonster) => void;

interface BestiaryDetailPresentation {
	monster: BestiaryMonster;
	favoriteActive: boolean;
	insertAction: BestiaryMonsterAction | undefined;
	addAction: BestiaryMonsterAction | undefined;
	addTitle: string | undefined;
	showAddToEncounterPicker: boolean;
	deleteAction: BestiaryMonsterAction | undefined;
}

export interface BestiarySyncEvent {
	version: string | number;
	resource: string;
	monsterName?: string;
	monsterSource?: string;
}

export interface BestiarySyncEventPlan {
	pendingSelection: MonsterReference | null;
	refreshFavorites: true;
	reloadMonsters: boolean;
	suppressAutoSelection: boolean;
}

export interface ExecuteBestiarySyncEventPlanOptions {
	plan: BestiarySyncEventPlan | null | undefined;
	refreshFavorites(): Promise<BestiaryFavorite[] | null | undefined>;
	onFavorites(favorites: BestiaryFavorite[]): void;
	onRefreshError(error: unknown): void;
	onPendingSelection(selection: MonsterReference): void;
	onSuppressAutoSelection(): void;
	onReloadMonsters(): void;
}

export interface BestiarySyncEventExecution {
	favoritesRefresh: Promise<void>;
}

export type BestiarySelectedSourcesSaveOutcome =
	| {
			status: "succeeded";
			scope: "campaign" | "global";
			ignoreSourcesList: string[];
	  }
	| { status: "failed"; error: unknown; ignoreSourcesList: string[] };

export interface ExecuteBestiarySelectedSourcesSaveOptions {
	filterSourceOptions: string[];
	nextSelectedSources: string[];
	activeCampaignSlug: string | null;
	getIgnoreSourcesList(
		filterSourceOptions: string[],
		nextSelectedSources: string[],
	): string[];
	onEnableAutoSelection(): void;
	updateCampaign(
		slug: string,
		payload: { ignoreSourcesList: string[] },
	): Promise<unknown>;
	listCampaigns(): Promise<unknown[] | null | undefined>;
	onCampaigns(campaigns: unknown[]): void;
	updateSettings(payload: {
		ignoreSourcesList: string[];
	}): Promise<Record<string, unknown> | null>;
	onUiIgnoreSources(ignoreSourcesList: string[]): void;
	onLogError(error: unknown): void;
	onError(error: unknown): void;
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

export function normalizeMonsterName(value: unknown): string {
	return String(value ?? "").trim().toLowerCase();
}

export function normalizeMonsterSource(value: unknown): string {
	return String(value ?? "").trim().toUpperCase();
}

export function isCustomSource(source: unknown): boolean {
	return normalizeMonsterSource(source) === "CUSTOM";
}

export function parseMonsterReference(
	value: unknown,
	fallbackSource = "",
): MonsterReference {
	const [rawName = "", rawSource = ""] = String(value ?? "").split("|");
	return {
		name: rawName.trim(),
		source: String(fallbackSource || rawSource).trim(),
	};
}

function haveSameMonsterName(
	left: BestiaryMonster | null | undefined,
	right: BestiaryMonster | null | undefined,
): boolean {
	const leftName = normalizeMonsterName(left?.name);
	const rightName = normalizeMonsterName(right?.name);
	return Boolean(leftName) && leftName === rightName;
}

function haveSameMonsterSource(
	left: BestiaryMonster | null | undefined,
	right: BestiaryMonster | null | undefined,
): boolean {
	return normalizeMonsterSource(left?.source) === normalizeMonsterSource(right?.source);
}

export function isSameMonsterIdentity(
	left: BestiaryMonster | null | undefined,
	right: BestiaryMonster | null | undefined,
): boolean {
	if (!haveSameMonsterName(left, right)) return false;
	return haveSameMonsterSource(left, right);
}

function monsterNameMatchesReference(
	monster: BestiaryMonster | null | undefined,
	reference: MonsterReference,
): boolean {
	return normalizeMonsterName(monster?.name) === normalizeMonsterName(reference.name);
}

function monsterSourceMatchesReference(
	monster: BestiaryMonster | null | undefined,
	reference: MonsterReference,
): boolean {
	const source = normalizeMonsterSource(reference.source);
	if (!source) return true;
	return normalizeMonsterSource(monster?.source) === source;
}

export function monsterMatchesReference(
	monster: BestiaryMonster | null | undefined,
	reference: MonsterReference | null | undefined,
): boolean {
	if (!reference) return false;
	if (!monsterNameMatchesReference(monster, reference)) return false;
	return monsterSourceMatchesReference(monster, reference);
}

export function findCustomMonsterByName(
	monsters: BestiaryMonster[],
	name: unknown,
): BestiaryMonster | null {
	const normalizedName = normalizeMonsterName(name);
	if (!normalizedName) return null;
	return (
		monsters.find(
			(monster) =>
				isCustomSource(monster.source) &&
				normalizeMonsterName(monster.name) === normalizedName,
		) ?? null
	);
}

export function getMonsterListIndex(
	monsters: BestiaryMonster[],
	selectedMonster: BestiaryMonster | null | undefined,
): number {
	if (!selectedMonster?.name) return -1;
	return monsters.findIndex((monster) =>
		isSameMonsterIdentity(monster, selectedMonster),
	);
}

export function getAutoSelectedMonster(
	monsters: BestiaryMonster[],
): BestiaryMonster | null {
	return monsters.find((monster) => !isCustomSource(monster.source)) ?? null;
}

export function cloneCustomMonsters(
	monsters: BestiaryMonster[] | null | undefined,
): BestiaryMonster[] {
	return JSON.parse(JSON.stringify(monsters ?? [])) as BestiaryMonster[];
}

export function customMonsterListsEqual(
	left: BestiaryMonster[] | null | undefined,
	right: BestiaryMonster[] | null | undefined,
): boolean {
	return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
}

function getBestiaryMonsterRowPrimaryAction(
	hasSelectAction: boolean,
	hasAddAction: boolean,
): BestiaryMonsterRowPrimaryAction {
	if (hasSelectAction) return "select";
	if (hasAddAction) return "add";
	return null;
}

function getBestiaryMonsterRowTokenSrc(
	monster: BestiaryMonster,
	fallbackTokenSrc: string,
): string {
	return typeof monster.imageUrl === "string"
		? monster.imageUrl
		: fallbackTokenSrc;
}

function getBestiaryMonsterRowCrDisplay(
	monster: BestiaryMonster,
): string | number {
	return getMonsterCrDisplay(monster) || "--";
}

function getBestiaryMonsterRowFavoriteTitle(
	isFavorite: boolean,
): BestiaryMonsterRowPresentation["favoriteTitleKey"] {
	return isFavorite ? "Remove from favorites" : "Add to favorites";
}

function getBestiaryMonsterRowNextSelection(
	monster: BestiaryMonster,
	isSelected: boolean,
): BestiaryMonster | null {
	return isSelected ? null : monster;
}

function getBestiaryMonsterRowPrimaryTitle(
	primaryAction: BestiaryMonsterRowPrimaryAction,
): BestiaryMonsterRowPresentation["primaryTitleKey"] {
	if (primaryAction === "select") return "Insert";
	if (primaryAction === "add") return "Add to encounter";
	return null;
}

export function getBestiaryMonsterRowPresentation(
	monster: BestiaryMonster,
	selectedMonster: BestiaryMonster | null,
	favorites: BestiaryFavorite[],
	hasSelectAction: boolean,
	hasAddAction: boolean,
	fallbackTokenSrc: string,
): BestiaryMonsterRowPresentation {
	const isSelected = isSameMonsterIdentity(selectedMonster, monster);
	const isFavorite = isFavoriteMonster(favorites, monster);
	const primaryAction = getBestiaryMonsterRowPrimaryAction(
		hasSelectAction,
		hasAddAction,
	);
	return {
		crDisplay: getBestiaryMonsterRowCrDisplay(monster),
		favoriteTitleKey: getBestiaryMonsterRowFavoriteTitle(isFavorite),
		isCustom: isCustomSource(monster.source),
		isFavorite,
		isSelected,
		nextSelection: getBestiaryMonsterRowNextSelection(monster, isSelected),
		primaryAction,
		primaryTitleKey: getBestiaryMonsterRowPrimaryTitle(primaryAction),
		tokenSrc: getBestiaryMonsterRowTokenSrc(monster, fallbackTokenSrc),
	};
}

function normalizeBestiaryMonsterAction(
	action: BestiaryMonsterAction | null | undefined,
): BestiaryMonsterAction | undefined {
	return action ?? undefined;
}

function getBestiaryDetailAddTitle(
	action: BestiaryMonsterAction | null | undefined,
	getAddTitle: () => string,
): string | undefined {
	return action ? getAddTitle() : undefined;
}

function getBestiaryDetailDeleteAction(
	monster: BestiaryMonster,
	action: BestiaryMonsterAction | null | undefined,
): BestiaryMonsterAction | undefined {
	return isCustomSource(monster.source)
		? normalizeBestiaryMonsterAction(action)
		: undefined;
}

export function getBestiaryDetailPresentation(
	selectedMonster: BestiaryMonster | null,
	favorites: BestiaryFavorite[],
	onSelectMonster: BestiaryMonsterAction | null | undefined,
	onAddMonster: BestiaryMonsterAction | null | undefined,
	onDeleteCustomMonster: BestiaryMonsterAction | null | undefined,
	getAddTitle: () => string,
): BestiaryDetailPresentation | null {
	if (!selectedMonster) return null;
	return {
		monster: selectedMonster,
		favoriteActive: isFavoriteMonster(favorites, selectedMonster),
		insertAction: normalizeBestiaryMonsterAction(onSelectMonster),
		addAction: normalizeBestiaryMonsterAction(onAddMonster),
		addTitle: getBestiaryDetailAddTitle(onAddMonster, getAddTitle),
		showAddToEncounterPicker: Boolean(onAddMonster),
		deleteAction: getBestiaryDetailDeleteAction(
			selectedMonster,
			onDeleteCustomMonster,
		),
	};
}

function canScrollToInitialBestiarySelection(
	enabled: boolean,
	reference: MonsterReference,
	selectedMonster: BestiaryMonster | null | undefined,
): selectedMonster is BestiaryMonster {
	return Boolean(
		enabled &&
			reference.name &&
			selectedMonster?.name &&
			monsterMatchesReference(selectedMonster, reference),
	);
}

export function getBestiaryInitialSelectionScrollPlan(
	displayedMonsters: BestiaryMonster[],
	reference: MonsterReference,
	selectedMonster: BestiaryMonster | null | undefined,
	enabled: boolean,
	lastScrollKey: string,
): BestiaryInitialSelectionScrollPlan | null {
	if (!canScrollToInitialBestiarySelection(enabled, reference, selectedMonster)) {
		return null;
	}
	const scrollKey = `${selectedMonster.source || ""}:${selectedMonster.name}`;
	if (lastScrollKey === scrollKey) return null;
	const selectedIndex = getMonsterListIndex(displayedMonsters, selectedMonster);
	return selectedIndex < 0 ? null : { scrollKey, selectedIndex };
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

function getBestiarySourceCandidate(source: Record<string, unknown>): unknown {
	return source.value ?? source.source ?? source.id ?? source.name;
}

function getBestiarySourceCode(source: unknown): string {
	if (typeof source === "string") return source;
	if (!isRecord(source)) return "";
	const candidate = getBestiarySourceCandidate(source);
	return typeof candidate === "string" ? candidate : "";
}

export function getBestiarySourceCodes(data: unknown): string[] {
	if (!Array.isArray(data)) return [];
	return data.map(getBestiarySourceCode).filter(Boolean);
}

type BestiarySyncEventRequiredFields = Pick<
	BestiarySyncEvent,
	"resource" | "version"
>;

function getBestiarySyncEventVersion(value: unknown): string | number | null {
	return typeof value === "string" || typeof value === "number" ? value : null;
}

function getBestiarySyncEventRequiredFields(
	value: Record<string, unknown>,
): BestiarySyncEventRequiredFields | null {
	if (typeof value.resource !== "string") return null;
	const version = getBestiarySyncEventVersion(value.version);
	if (version === null) return null;
	return { resource: value.resource, version };
}

function getOptionalBestiarySyncEventString(
	value: Record<string, unknown>,
	key: "monsterName" | "monsterSource",
): string | undefined {
	return typeof value[key] === "string" ? value[key] : undefined;
}

export function parseBestiarySyncEvent(value: unknown): BestiarySyncEvent | null {
	if (!isRecord(value)) return null;
	const required = getBestiarySyncEventRequiredFields(value);
	if (!required) return null;
	return {
		...required,
		monsterName: getOptionalBestiarySyncEventString(value, "monsterName"),
		monsterSource: getOptionalBestiarySyncEventString(value, "monsterSource"),
	};
}

function isSupportedBestiarySyncEvent(
	event: BestiarySyncEvent | null | undefined,
): event is BestiarySyncEvent {
	return Boolean(
		event?.version &&
			["bestiary", "custom-bestiary", "ai"].includes(event.resource),
	);
}

function shouldReloadBestiaryMonsters(resource: string): boolean {
	return resource === "custom-bestiary" || resource === "ai";
}

function getBestiarySyncPendingSelection(
	event: BestiarySyncEvent,
	reloadMonsters: boolean,
): MonsterReference | null {
	if (!reloadMonsters || !event.monsterName) return null;
	return {
		name: event.monsterName,
		source: event.monsterSource || "CUSTOM",
	};
}

export function getBestiarySyncEventPlan(
	event: BestiarySyncEvent | null | undefined,
): BestiarySyncEventPlan | null {
	if (!isSupportedBestiarySyncEvent(event)) return null;
	const reloadMonsters = shouldReloadBestiaryMonsters(event.resource);
	const pendingSelection = getBestiarySyncPendingSelection(
		event,
		reloadMonsters,
	);
	return {
		pendingSelection,
		refreshFavorites: true,
		reloadMonsters,
		suppressAutoSelection: Boolean(pendingSelection),
	};
}

function startBestiaryFavoritesRefresh(
	options: ExecuteBestiarySyncEventPlanOptions,
): Promise<void> {
	return options
		.refreshFavorites()
		.then((favorites) => options.onFavorites(favorites ?? []))
		.catch((error: unknown) => options.onRefreshError(error));
}

function applyBestiarySyncPendingSelection(
	plan: BestiarySyncEventPlan,
	onPendingSelection: (selection: MonsterReference) => void,
): void {
	if (plan.pendingSelection) onPendingSelection(plan.pendingSelection);
}

function applyBestiarySyncAutoSelectionSuppression(
	plan: BestiarySyncEventPlan,
	onSuppressAutoSelection: () => void,
): void {
	if (plan.suppressAutoSelection) onSuppressAutoSelection();
}

function applyBestiarySyncReload(
	plan: BestiarySyncEventPlan,
	onReloadMonsters: () => void,
): void {
	if (plan.reloadMonsters) onReloadMonsters();
}

export function executeBestiarySyncEventPlan(
	options: ExecuteBestiarySyncEventPlanOptions,
): BestiarySyncEventExecution | null {
	const plan = options.plan;
	if (!plan) return null;
	const favoritesRefresh = startBestiaryFavoritesRefresh(options);
	applyBestiarySyncPendingSelection(plan, options.onPendingSelection);
	applyBestiarySyncAutoSelectionSuppression(
		plan,
		options.onSuppressAutoSelection,
	);
	applyBestiarySyncReload(plan, options.onReloadMonsters);
	return { favoritesRefresh };
}

async function saveCampaignBestiarySelectedSources(
	options: ExecuteBestiarySelectedSourcesSaveOptions,
	campaignSlug: string,
	ignoreSourcesList: string[],
): Promise<"campaign"> {
	await options.updateCampaign(campaignSlug, { ignoreSourcesList });
	const campaigns = await options.listCampaigns();
	options.onCampaigns(campaigns ?? []);
	return "campaign";
}

function getSavedBestiaryIgnoreSources(
	saved: Record<string, unknown> | null,
	requested: string[],
): string[] {
	return Array.isArray(saved?.ignoreSourcesList)
		? (saved.ignoreSourcesList as string[])
		: requested;
}

async function saveGlobalBestiarySelectedSources(
	options: ExecuteBestiarySelectedSourcesSaveOptions,
	ignoreSourcesList: string[],
): Promise<"global"> {
	const saved = await options.updateSettings({ ignoreSourcesList });
	options.onUiIgnoreSources(
		getSavedBestiaryIgnoreSources(saved, ignoreSourcesList),
	);
	return "global";
}

function saveBestiarySelectedSources(
	options: ExecuteBestiarySelectedSourcesSaveOptions,
	ignoreSourcesList: string[],
): Promise<"campaign" | "global"> {
	return options.activeCampaignSlug
		? saveCampaignBestiarySelectedSources(
				options,
				options.activeCampaignSlug,
				ignoreSourcesList,
			)
		: saveGlobalBestiarySelectedSources(options, ignoreSourcesList);
}

export async function executeBestiarySelectedSourcesSave(
	options: ExecuteBestiarySelectedSourcesSaveOptions,
): Promise<BestiarySelectedSourcesSaveOutcome> {
	const ignoreSourcesList = options.getIgnoreSourcesList(
		options.filterSourceOptions,
		options.nextSelectedSources,
	);
	options.onEnableAutoSelection();
	try {
		const scope = await saveBestiarySelectedSources(options, ignoreSourcesList);
		return { status: "succeeded", scope, ignoreSourcesList };
	} catch (error) {
		options.onLogError(error);
		options.onError(error);
		return { status: "failed", error, ignoreSourcesList };
	}
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

function getLegendaryGroupIdentity(group: LegendaryGroup): MonsterReference {
	return {
		name: typeof group.name === "string" ? group.name : "",
		source: typeof group.source === "string" ? group.source : "",
	};
}

function getMonsterLegendaryGroup(
	monster: BestiaryMonster,
): Record<string, unknown> | null {
	return isRecord(monster.legendaryGroup) ? monster.legendaryGroup : null;
}

function getMonsterLegendaryName(
	monster: BestiaryMonster,
	reference: Record<string, unknown> | null,
): string {
	return typeof reference?.name === "string" ? reference.name : monster.name;
}

function getMonsterLegendarySource(
	monster: BestiaryMonster,
	reference: Record<string, unknown> | null,
): string {
	return typeof reference?.source === "string"
		? reference.source
		: String(monster.source ?? "");
}

function getMonsterLegendaryReference(monster: BestiaryMonster): MonsterReference {
	const reference = getMonsterLegendaryGroup(monster);
	return {
		name: getMonsterLegendaryName(monster, reference),
		source: getMonsterLegendarySource(monster, reference),
	};
}

export function enrichMonstersWithLegendaryGroups(
	monsters: BestiaryMonster[],
	legendaryGroups: LegendaryGroup[],
): BestiaryMonster[] {
	const groupsByIdentity = new Map(
		legendaryGroups.map((group) => {
			const identity = getLegendaryGroupIdentity(group);
			return [`${normalizeMonsterName(identity.name)}|${normalizeMonsterSource(identity.source)}`, group];
		}),
	);
	return monsters.map((monster) => {
		const identity = getMonsterLegendaryReference(monster);
		const group = groupsByIdentity.get(
			`${normalizeMonsterName(identity.name)}|${normalizeMonsterSource(identity.source)}`,
		);
		if (!group) return monster;
		return {
			...monster,
			lairActions: group.lairActions,
			regionalEffects: group.regionalEffects,
		};
	});
}

function isFavoriteMonster(
	favorites: BestiaryFavorite[],
	monster: BestiaryMonster | null | undefined,
): boolean {
	return favorites.some((favorite) => isSameMonsterIdentity(favorite, monster));
}

export function getMonsterItemKey(monster: BestiaryMonster): string {
	return `${String(monster.source ?? "")}:${monster.name}`;
}

export function getMonsterSizeText(monster: BestiaryMonster): string {
	return String(Array.isArray(monster.size) ? monster.size[0] ?? "" : monster.size ?? "");
}

export function getMonsterTagText(monster: BestiaryMonster): string {
	if (!monster.type || typeof monster.type === "string") return "";
	return (monster.type.tags ?? [])
		.map((tag) => (isRecord(tag) ? tag.tag : tag))
		.filter((tag): tag is string => typeof tag === "string")
		.join(", ");
}

export function getMonsterCrDisplay(monster: BestiaryMonster): string | number {
	const cr = isRecord(monster.cr) ? monster.cr.cr : monster.cr;
	return typeof cr === "string" || typeof cr === "number" ? cr : "";
}

function getMonsterCrValue(monster: BestiaryMonster): unknown {
	return isRecord(monster.cr) ? monster.cr.cr : monster.cr;
}

function parseScalarMonsterCr(value: unknown): number {
	return Number.parseFloat(String(value ?? "0")) || 0;
}

function parseFractionMonsterCr(text: string): number {
	const [numerator = "0", denominator = "0"] = text.split("/");
	const denominatorValue = Number(denominator);
	return denominatorValue ? Number(numerator) / denominatorValue : 0;
}

function normalizeMonsterCrText(value: unknown): string {
	return String(value ?? "0");
}

function parseMonsterCrText(text: string): number {
	return text.includes("/")
		? parseFractionMonsterCr(text)
		: parseScalarMonsterCr(text);
}

function parseMonsterCrValue(value: unknown): number {
	if (typeof value === "number") return value;
	return parseMonsterCrText(normalizeMonsterCrText(value));
}

export function parseMonsterCr(monster: BestiaryMonster): number {
	return parseMonsterCrValue(getMonsterCrValue(monster));
}

function getBestiarySortDirection(order: BestiarySortOrder): number {
	return order === "desc" ? -1 : 1;
}

function compareBestiaryMonsters(
	left: BestiaryMonster,
	right: BestiaryMonster,
	direction: number,
): number {
	const crDifference = parseMonsterCr(left) - parseMonsterCr(right);
	return crDifference
		? crDifference * direction
		: left.name.localeCompare(right.name);
}

export function sortBestiaryMonsters(
	monsters: BestiaryMonster[],
	order: BestiarySortOrder,
): BestiaryMonster[] {
	if (order === "none") return [...monsters];
	const direction = getBestiarySortDirection(order);
	return [...monsters].sort((left, right) =>
		compareBestiaryMonsters(left, right, direction),
	);
}

function matchesSelectedSource(
	monster: BestiaryMonster,
	selectedSources: ReadonlySet<string>,
): boolean {
	return selectedSources.has(normalizeMonsterSource(monster.source));
}

function matchesBestiarySourceFilter(
	monster: BestiaryMonster,
	sourceFilter: string | null,
): boolean {
	return (
		sourceFilter === null ||
		normalizeMonsterSource(monster.source) === sourceFilter
	);
}

function getBestiaryFilterIdentityKey(
	monster: Pick<BestiaryMonster, "name" | "source"> | BestiaryFavorite,
): string | null {
	const name = normalizeMonsterName(monster.name);
	if (!name) return null;
	return JSON.stringify([name, normalizeMonsterSource(monster.source)]);
}

function createBestiaryFavoriteSet(
	favorites: BestiaryFavorite[],
): ReadonlySet<string> {
	return new Set(
		favorites
			.map(getBestiaryFilterIdentityKey)
			.filter((key): key is string => key !== null),
	);
}

interface CompiledBestiaryFilter {
	selectedSources: ReadonlySet<string>;
	sourceFilter: string | null;
	favorites: ReadonlySet<string> | null;
	search: string;
	searchMatcher: (
		monster: BestiaryMonster,
		search: string,
	) => boolean;
}

function compileBestiaryFilter(
	options: BestiaryFilterOptions,
): CompiledBestiaryFilter {
	return {
		selectedSources: new Set(
			options.selectedSources.map(normalizeMonsterSource),
		),
		sourceFilter:
			options.sourceFilter === "all"
				? null
				: normalizeMonsterSource(options.sourceFilter),
		favorites: options.onlyFavorites
			? createBestiaryFavoriteSet(options.favorites)
			: null,
		search: options.search,
		searchMatcher: options.isDetailedSearch
			? options.matchesDetailedSearch
			: options.matchesSimpleSearch,
	};
}

function matchesBestiaryFavoriteFilter(
	monster: BestiaryMonster,
	favorites: ReadonlySet<string> | null,
): boolean {
	if (favorites === null) return true;
	const identity = getBestiaryFilterIdentityKey(monster);
	return identity !== null && favorites.has(identity);
}

function matchesBestiaryMonster(
	monster: BestiaryMonster,
	filter: CompiledBestiaryFilter,
): boolean {
	if (!matchesSelectedSource(monster, filter.selectedSources)) return false;
	if (!matchesBestiarySourceFilter(monster, filter.sourceFilter)) return false;
	if (!matchesBestiaryFavoriteFilter(monster, filter.favorites)) return false;
	return filter.searchMatcher(monster, filter.search);
}

export function filterBestiaryMonsters(
	monsters: BestiaryMonster[],
	options: BestiaryFilterOptions,
): BestiaryMonster[] {
	const filter = compileBestiaryFilter(options);
	return monsters.filter((monster) => matchesBestiaryMonster(monster, filter));
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

function findReferencedMonster(
	displayedMonsters: BestiaryMonster[],
	allMonsters: BestiaryMonster[],
	reference: MonsterReference,
): BestiaryMonster | null {
	return (
		displayedMonsters.find((monster) =>
			monsterMatchesReference(monster, reference),
		) ??
		allMonsters.find((monster) => monsterMatchesReference(monster, reference)) ??
		null
	);
}

function getAutomaticMonsterSelection(
	displayedMonsters: BestiaryMonster[],
	currentMonster: BestiaryMonster | null,
	shouldAutoSelect: boolean,
): BestiarySelectionPlan | null {
	if (!shouldAutoSelect) return null;
	const monster = getAutoSelectedMonster(displayedMonsters);
	if (!monster) return null;
	if (currentMonster && getMonsterListIndex(displayedMonsters, currentMonster) >= 0) {
		return null;
	}
	return { monster, explicit: false };
}

export function getBestiarySelectionPlan(
	displayedMonsters: BestiaryMonster[],
	allMonsters: BestiaryMonster[],
	reference: MonsterReference,
	currentMonster: BestiaryMonster | null,
	shouldAutoSelect: boolean,
): BestiarySelectionPlan | null {
	if (reference.name) {
		const monster = findReferencedMonster(
			displayedMonsters,
			allMonsters,
			reference,
		);
		return monster ? { monster, explicit: true } : null;
	}
	return getAutomaticMonsterSelection(
		displayedMonsters,
		currentMonster,
		shouldAutoSelect,
	);
}

function getPendingCustomRefreshSelection(
	customMonsters: BestiaryMonster[],
	pendingSelection: MonsterReference | null | undefined,
): BestiaryMonster | null {
	return findCustomMonsterByName(customMonsters, pendingSelection?.name);
}

function getCurrentCustomRefreshSelection(
	customMonsters: BestiaryMonster[],
	currentSelection: BestiaryMonster | null | undefined,
): BestiaryMonster | null {
	if (!currentSelection || !isCustomSource(currentSelection.source)) return null;
	return (
		customMonsters.find((monster) =>
			isSameMonsterIdentity(monster, currentSelection),
		) ?? null
	);
}

export function getCustomRefreshSelection(
	customMonsters: BestiaryMonster[],
	pendingSelection: MonsterReference | null | undefined,
	currentSelection: BestiaryMonster | null | undefined,
): BestiaryMonster | null {
	const pending = getPendingCustomRefreshSelection(
		customMonsters,
		pendingSelection,
	);
	if (pending) return pending;
	return getCurrentCustomRefreshSelection(customMonsters, currentSelection);
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

export function getNextBestiarySortOrder(
	current: BestiarySortOrder,
): BestiarySortOrder {
	if (current === "none") return "desc";
	if (current === "desc") return "asc";
	return "none";
}
