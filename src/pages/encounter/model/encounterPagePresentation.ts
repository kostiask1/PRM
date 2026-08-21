import type {
	CampaignEntityRecord,
	CampaignRecord,
	CharacterData,
} from "../../../entities/campaign/index.js";
import { MonsterStatBlockModel } from "../../../entities/bestiary/index.js";
import {
	createEncounterCharacterParticipant,
	ensureEncounterMonsterId,
	isEncounterCharacterParticipant,
} from "../../../entities/encounter/index.js";
import type { EncounterEditorState } from "../../../features/encounter-editor/index.js";
import {
	addSourceMonsterImageToDraft,
	getFirstChangedMonster,
	type AiGenerationResult,
	type AiHistoryEntry,
	type AiHistoryRestoreResult,
} from "../../../features/ai/index.js";
import { getFirstGeneratedMonster } from "../../../features/ai-edit-monster/model.js";
import type {
	EncounterSyncEvent,
	EncounterUpdateOptions,
	EncounterViewModel,
	EncounterViewParticipant,
	EncounterViewSession,
	EncounterViewState,
	MonsterAiUpdateOptions,
} from "./contracts.ts";

export type EncounterNavigationAction = "close-bestiary" | "back" | "none";
export type EncounterHistoryAction = "undo" | "redo" | "none";

export interface EncounterKeyboardInput {
	key: string;
	code: string;
	shiftKey: boolean;
	isEditableTarget: boolean;
	isHistoryShortcut: boolean;
	shouldUseAppHistory: boolean;
	showBestiary: boolean;
}

export interface EncounterEditableTarget {
	tagName?: unknown;
	isContentEditable?: unknown;
}

export type EncounterLoadPlan =
	| { kind: "retry"; retries: number; resetHistory: boolean }
	| { kind: "not-found" }
	| {
			kind: "loaded";
			encounter: EncounterViewState;
			selectedInstance: EncounterViewParticipant | null;
			resetHistory: boolean;
	  };

export type EncounterMonsterDropPlan =
	| { kind: "none" }
	| {
			kind: "persist";
			encounter: EncounterViewState;
			undoSnapshot: EncounterViewState | null;
	  };

export type EncounterUpdatePlan =
	| { kind: "none" }
	| {
			kind: "update";
			encounter: EncounterViewState;
			undoSnapshot: EncounterViewState | null;
			persist: boolean;
			saveDebounceMs: number;
			preferredId: string | null;
	  };

export interface EncounterMonsterRowStats {
	ac: string | number;
	maxHp: string | number;
}

export interface EncounterDiceResultInput {
	result?: { total?: unknown } | null;
	context?: {
		kind?: string;
		campaignSlug?: string;
		sessionId?: string;
		encounterId?: string;
		instanceId?: string;
	} | null;
	campaignSlug: string;
	sessionId: string;
	encounterId: string;
	encounter: EncounterViewState | null;
}

export interface EncounterDiceHpUpdate {
	encounter: EncounterViewState;
	preferredId: string;
}

export interface EncounterDiceProcessingInput extends EncounterDiceResultInput {
	resultId?: string | number;
	processedResultId?: string | number | null;
}

export interface EncounterDiceProcessingEffects {
	onProcessed: (resultId: string | number) => void;
	onUpdate: (update: EncounterDiceHpUpdate) => void;
}

export type EncounterAiDraftMode = "local" | "global";
export type EncounterAiRestoreMode = "apply" | "undo";

export interface EncounterAiResultEffects {
	onDraftMode: (mode: EncounterAiDraftMode) => void;
	onDraftEntry: (entry: AiHistoryEntry | null) => void;
	onMonsterUpdate: (instanceId: string, monster: EncounterViewParticipant) => void;
}

export interface EncounterAiRestoreEffects {
	onEntry: (entry: AiHistoryEntry) => void;
	onLocalUpdate: (session: EncounterViewSession) => void;
	onMonsterUpdate: (instanceId: string, monster: EncounterViewParticipant) => void;
}

export interface EncounterAiRestoreLifecycle {
	request(): Promise<AiHistoryRestoreResult | null>;
	onResult(result: AiHistoryRestoreResult | null): void;
	onError(error: unknown): void;
	onComplete(): void;
}

export type EncounterParticipantSelectionPlan =
	| { kind: "open-character"; character: EncounterViewParticipant }
	| {
			kind: "select";
			participant: EncounterViewParticipant;
			focusInstanceId: string | null;
	  };

export interface EncounterParticipantSelectionEffects {
	onOpenCharacter(character: EncounterViewParticipant): void;
	onSelect(participant: EncounterViewParticipant): void;
	onFocus(instanceId: string): void;
}

export interface EncounterNavigationEffects {
	onHandled(): void;
	onCloseBestiary(): void;
	onBack(): void;
}

export interface EncounterHistoryEffects {
	onHandled(): void;
	onUndo(): void;
	onRedo(): void;
}

export interface EncounterAddCharacterPlan {
	encounter: EncounterViewState;
	participant: EncounterViewParticipant;
	preferredId: string | null;
	displayName: string;
}

export interface EncounterRenamePlan {
	encounter: EncounterViewState;
}

export interface EncounterGridProjection {
	monsters: EncounterViewParticipant[];
	representativeByInstanceId: Map<string, string>;
}

export type EncounterDisplayMode = "grid" | "single";

export interface EncounterPlayerCreationLifecycle {
	request(): Promise<CampaignEntityRecord | null>;
	onRefresh(): void;
	onAdd(character: CampaignEntityRecord): void;
	onReset(): void;
	onError(error: unknown): void;
	onComplete(): void;
}

export function getEncounterRenderContext(
	view: EncounterViewModel,
	campaign: CampaignRecord | null,
	sessionId: string | null,
) {
	if (!view.encounter || !campaign || !sessionId) return null;
	return { encounter: view.encounter, campaign, sessionId };
}

export function getEncounterSelectedGridId(
	selected: EncounterViewParticipant | null,
	representatives: Map<string, string>,
): string | null {
	if (!selected) return null;
	const instanceId = String(selected.instanceId || selected.id || "");
	return representatives.get(instanceId) || instanceId;
}

export function getEncounterLayout(
	displayMode: EncounterDisplayMode,
	gridColumns: number,
	monsterCount: number,
) {
	return {
		displayMode: monsterCount === 1 ? "single" as const : displayMode,
		gridColumns: Math.max(1, Math.min(gridColumns, monsterCount || 1)),
	};
}

export function applyEncounterGeneratedMonsterResult(
	data: AiGenerationResult | null,
	sourceMonster: EncounterViewParticipant,
	draftMode: EncounterAiDraftMode,
	targetInstanceId: string | null,
	effects: EncounterAiResultEffects,
): void {
	const draftEntry = getEncounterGeneratedDraftEntry(data);
	if (draftEntry) {
		applyEncounterGeneratedDraft(draftEntry, sourceMonster, draftMode, effects);
		return;
	}
	applyEncounterGeneratedUpdate(data?.updated, targetInstanceId, effects);
}

function getEncounterGeneratedDraftEntry(
	data: AiGenerationResult | null,
): AiHistoryEntry | null {
	if (!data?.draft) return null;
	return data.aiResponse || null;
}

function applyEncounterGeneratedDraft(
	entry: AiHistoryEntry,
	sourceMonster: EncounterViewParticipant,
	draftMode: EncounterAiDraftMode,
	effects: EncounterAiResultEffects,
): void {
	effects.onDraftMode(draftMode);
	effects.onDraftEntry(addSourceMonsterImageToDraft(entry, sourceMonster) || null);
}

function applyEncounterGeneratedUpdate(
	updated: unknown,
	targetInstanceId: string | null,
	effects: EncounterAiResultEffects,
): void {
	if (!targetInstanceId) return;
	const monster = getFirstGeneratedMonster(updated);
	if (monster) {
		effects.onMonsterUpdate(targetInstanceId, monster as EncounterViewParticipant);
	}
}

export function applyEncounterMonsterRestoreResult(
	result: AiHistoryRestoreResult | null,
	fallbackEntry: AiHistoryEntry,
	draftMode: EncounterAiDraftMode,
	mode: EncounterAiRestoreMode,
	resourceIds: string[] | undefined,
	targetInstanceId: string | null,
	effects: EncounterAiRestoreEffects,
): void {
	const entry = result?.response || fallbackEntry;
	effects.onEntry(entry);
	if (draftMode === "local") {
		applyEncounterLocalRestore(result, effects);
		return;
	}
	applyEncounterGlobalRestore(entry, mode, resourceIds, targetInstanceId, effects);
}

function applyEncounterLocalRestore(
	result: AiHistoryRestoreResult | null,
	effects: EncounterAiRestoreEffects,
): void {
	if (result?.updated) effects.onLocalUpdate(result.updated as EncounterViewSession);
}

function applyEncounterGlobalRestore(
	entry: AiHistoryEntry,
	mode: EncounterAiRestoreMode,
	resourceIds: string[] | undefined,
	targetInstanceId: string | null,
	effects: EncounterAiRestoreEffects,
): void {
	if (mode === "undo" || !targetInstanceId) return;
	const monster = getFirstChangedMonster(entry, resourceIds);
	if (monster) {
		effects.onMonsterUpdate(targetInstanceId, monster as EncounterViewParticipant);
	}
}

export async function executeEncounterAiRestoreRequest(
	lifecycle: EncounterAiRestoreLifecycle,
): Promise<void> {
	try {
		lifecycle.onResult(await lifecycle.request());
	} catch (error) {
		lifecycle.onError(error);
	} finally {
		lifecycle.onComplete();
	}
}

export async function executeEncounterPlayerCreation(
	lifecycle: EncounterPlayerCreationLifecycle,
): Promise<void> {
	try {
		const character = await lifecycle.request();
		lifecycle.onRefresh();
		lifecycle.onAdd(requireCreatedEncounterCharacter(character));
		lifecycle.onReset();
	} catch (error) {
		lifecycle.onError(error);
	} finally {
		lifecycle.onComplete();
	}
}

function requireCreatedEncounterCharacter(
	character: CampaignEntityRecord | null,
): CampaignEntityRecord {
	if (!character) throw new Error("Entity creation returned no result");
	return character;
}

export function isCustomBestiarySource(source: unknown): boolean {
	return String(source || "").toUpperCase() === "CUSTOM";
}

export function getEncounterGridMonsterKey(
	monster: EncounterViewParticipant,
): string {
	return monster._localOverride
		? getLocalMonsterKey(monster)
		: getOfficialMonsterGridKey(monster);
}

function getOfficialMonsterGridKey(monster: EncounterViewParticipant): string {
	const baseName = normalizeKeyPart(getPreferredGridMonsterName(monster));
	if (!baseName) return String(monster.instanceId || "");
	return `${baseName}|${normalizeKeyPart(monster.source)}`;
}

function getPreferredGridMonsterName(monster: EncounterViewParticipant): unknown {
	return monster.originalBestiaryName || monster.name;
}

export function getEncounterGridProjection(
	participants: readonly EncounterViewParticipant[],
): EncounterGridProjection {
	const projection: EncounterGridProjection = {
		monsters: [],
		representativeByInstanceId: new Map(),
	};
	const representativeByKey = new Map<string, string>();
	participants
		.filter((participant) => !isEncounterCharacterParticipant(participant))
		.forEach((monster) => addEncounterGridMonster(monster, projection, representativeByKey));
	return projection;
}

function addEncounterGridMonster(
	monster: EncounterViewParticipant,
	projection: EncounterGridProjection,
	representativeByKey: Map<string, string>,
): void {
	const key = getEncounterGridMonsterKey(monster);
	const instanceId = getEncounterParticipantId(monster);
	const representativeId = representativeByKey.get(key) || instanceId;
	if (!representativeByKey.has(key)) {
		representativeByKey.set(key, representativeId);
		projection.monsters.push(monster);
	}
	projection.representativeByInstanceId.set(instanceId, representativeId);
}

function getEncounterParticipantId(participant: EncounterViewParticipant): string {
	return String(participant.instanceId || participant.id || "");
}

export function getAvailableEncounterCharacters(
	participants: readonly EncounterViewParticipant[],
	characters: readonly CampaignEntityRecord[],
): CampaignEntityRecord[] {
	const addedIds = new Set(
		participants
			.filter(isEncounterCharacterParticipant)
			.map((entry) => String(entry.originalCharacterId || entry.id || "")),
	);
	return characters.filter((character) => isCharacterAvailable(character, addedIds));
}

function isCharacterAvailable(
	character: CampaignEntityRecord,
	addedIds: ReadonlySet<string>,
): boolean {
	const id = String(character.id || "");
	return !id || !addedIds.has(id);
}

export function getEncounterParticipantSelectionPlan(
	participant: EncounterViewParticipant,
	selectedInstanceId: string | undefined,
	displayMode: "grid" | "single",
): EncounterParticipantSelectionPlan {
	if (isEncounterCharacterParticipant(participant)) {
		return getCharacterSelectionPlan(participant, selectedInstanceId);
	}
	return {
		kind: "select",
		participant,
		focusInstanceId: displayMode === "grid"
			? getEncounterParticipantId(participant)
			: null,
	};
}

function getCharacterSelectionPlan(
	character: EncounterViewParticipant,
	selectedInstanceId: string | undefined,
): EncounterParticipantSelectionPlan {
	return selectedInstanceId === character.instanceId
		? { kind: "open-character", character }
		: { kind: "select", participant: character, focusInstanceId: null };
}

export function executeEncounterParticipantSelection(
	plan: EncounterParticipantSelectionPlan,
	effects: EncounterParticipantSelectionEffects,
): void {
	if (plan.kind === "open-character") {
		effects.onOpenCharacter(plan.character);
		return;
	}
	effects.onSelect(plan.participant);
	if (plan.focusInstanceId) effects.onFocus(plan.focusInstanceId);
}

export function getEncounterAddCharacterPlan(
	encounter: EncounterViewState | null,
	character: CampaignEntityRecord,
): EncounterAddCharacterPlan | null {
	if (!encounter) return null;
	const participant = createEncounterCharacterParticipant(character) as EncounterViewParticipant;
	return {
		encounter: { ...encounter, monsters: [...encounter.monsters, participant] },
		participant,
		preferredId: participant.instanceId || null,
		displayName: String(participant.name || ""),
	};
}

export function getEncounterRenamePlan(
	encounter: EncounterViewState | null,
	name: unknown,
): EncounterRenamePlan | null {
	if (!encounter) return null;
	if (!isEncounterRenameValue(name, encounter.name)) return null;
	return { encounter: { ...encounter, name } };
}

function isEncounterRenameValue(name: unknown, currentName: string): name is string {
	return typeof name === "string" && Boolean(name) && name !== currentName;
}

function getLocalMonsterKey(monster: EncounterViewParticipant): string {
	return `local:${monster.instanceId || monster.id || monster.name || ""}`;
}

function normalizeKeyPart(value: unknown): string {
	return String(value || "").trim().toLowerCase();
}

export function createEmptyEncounterCharacterDraft(now = Date.now()): CharacterData {
	return {
		id: `new-character-${now}`,
		firstName: "",
		lastName: "",
		race: "",
		class: "",
		level: 1,
		motivation: "",
		description: "",
		trait: "",
		notes: [{ id: now + 1, title: "", text: "", collapsed: false }],
		collapsed: false,
		isNotesCollapsed: false,
	};
}

export function resolveEncounterHpInputValue(
	inputValue: unknown,
	previousHp: unknown,
): number {
	const text = String(inputValue ?? "").trim();
	const previousValue = parseInteger(previousHp);
	const relativeMatch = text.match(/^([+-])\s*(\d+)$/);
	if (!relativeMatch) return Math.max(0, parseInteger(text));
	return applyRelativeHp(previousValue, relativeMatch[1], relativeMatch[2]);
}

function applyRelativeHp(previous: number, operator: string, value: string): number {
	const delta = parseInteger(value);
	return Math.max(0, operator === "-" ? previous - delta : previous + delta);
}

function parseInteger(value: unknown): number {
	return Number.parseInt(String(value ?? ""), 10) || 0;
}

export function getEncounterMonsterRowStats(
	monster: EncounterViewParticipant,
): EncounterMonsterRowStats {
	const modelInput: Record<string, unknown> = { ...monster };
	const model = new MonsterStatBlockModel(modelInput);
	return {
		ac: String(getFirstEncounterStat([model.ac.val, monster.armor_class], "-")),
		maxHp: Number(getFirstEncounterStat([monster.hit_points, model.hp.val], 0)) || 0,
	};
}

function getFirstEncounterStat(
	values: readonly unknown[],
	fallback: unknown,
): unknown {
	return values.find(isEncounterStatDefined) ?? fallback;
}

function isEncounterStatDefined(value: unknown): boolean {
	return value !== null && value !== undefined;
}

const ENCOUNTER_BACK_KEYS = new Set(["Backspace", "Escape"]);

export function getEncounterNavigationAction(
	input: EncounterKeyboardInput,
): EncounterNavigationAction {
	if (shouldCloseEncounterBestiary(input)) return "close-bestiary";
	if (input.isEditableTarget) return "none";
	return ENCOUNTER_BACK_KEYS.has(input.key) ? "back" : "none";
}

export function executeEncounterNavigationAction(
	action: EncounterNavigationAction,
	effects: EncounterNavigationEffects,
): void {
	if (action === "none") return;
	effects.onHandled();
	if (action === "close-bestiary") effects.onCloseBestiary();
	if (action === "back") effects.onBack();
}

function shouldCloseEncounterBestiary(input: EncounterKeyboardInput): boolean {
	return input.key === "Escape" && input.showBestiary;
}

export function isEncounterEditableTarget(
	target: EncounterEditableTarget | null | undefined,
): boolean {
	return isEncounterTextInputTarget(target) || Boolean(target?.isContentEditable);
}

function isEncounterTextInputTarget(
	target: EncounterEditableTarget | null | undefined,
): boolean {
	return ["INPUT", "TEXTAREA"].includes(getEncounterTargetTagName(target));
}

function getEncounterTargetTagName(
	target: EncounterEditableTarget | null | undefined,
): string {
	return String(target?.tagName || "");
}

interface EncounterHistoryKeyPolicy {
	plain: EncounterHistoryAction;
	shift: EncounterHistoryAction;
}

const ENCOUNTER_HISTORY_KEY_POLICIES: Record<string, EncounterHistoryKeyPolicy> = {
	KeyZ: { plain: "undo", shift: "redo" },
	KeyY: { plain: "redo", shift: "redo" },
};

export function getEncounterHistoryAction(
	input: EncounterKeyboardInput,
): EncounterHistoryAction {
	if (!canUseEncounterHistory(input)) return "none";
	const policy = ENCOUNTER_HISTORY_KEY_POLICIES[input.code];
	if (!policy) return "none";
	return input.shiftKey ? policy.shift : policy.plain;
}

export function executeEncounterHistoryAction(
	action: EncounterHistoryAction,
	effects: EncounterHistoryEffects,
): void {
	if (action === "none") return;
	effects.onHandled();
	if (action === "undo") effects.onUndo();
	if (action === "redo") effects.onRedo();
}

function canUseEncounterHistory(input: EncounterKeyboardInput): boolean {
	return input.isHistoryShortcut &&
		(!input.isEditableTarget || input.shouldUseAppHistory);
}

export function shouldReloadEncounterFromSync(
	event: EncounterSyncEvent | null | undefined,
	campaignSlug: string,
	sessionId: string,
	hasPendingSave: boolean,
): boolean {
	if (!canProcessEncounterSync(event, hasPendingSave)) return false;
	if (!matchesEncounterSyncScope(event, campaignSlug, sessionId)) return false;
	return isEncounterSyncResource(event?.resource);
}

function canProcessEncounterSync(
	event: EncounterSyncEvent | null | undefined,
	hasPendingSave: boolean,
): event is EncounterSyncEvent {
	return Boolean(event?.version) && !hasPendingSave;
}

function isEncounterSyncResource(resource: unknown): boolean {
	return ["sessions", "ai", "import"].includes(String(resource || ""));
}

function matchesEncounterSyncScope(
	event: EncounterSyncEvent,
	campaignSlug: string,
	sessionId: string,
): boolean {
	if (event.campaignSlug && event.campaignSlug !== campaignSlug) return false;
	if (!event.sessionFileName) return true;
	return String(event.sessionFileName) === String(sessionId);
}

export function getEncounterSessionEncounters(value: unknown): EncounterViewState[] {
	return getEncounterList(getEncounterSessionData(value));
}

function getEncounterSessionData(value: unknown): EncounterViewSession["data"] | null {
	return value && typeof value === "object"
		? (value as EncounterViewSession).data
		: null;
}

function getEncounterList(
	data: EncounterViewSession["data"] | null,
): EncounterViewState[] {
	return Array.isArray(data?.encounters) ? data.encounters : [];
}

export function getEncounterLoadPlan(
	session: unknown,
	encounterId: string | number,
	retries: number,
	resetHistory: boolean,
): EncounterLoadPlan {
	const encounter = findEncounterById(
		getEncounterSessionEncounters(session),
		encounterId,
	);
	return encounter
		? getLoadedEncounterPlan(encounter, resetHistory)
		: getMissingEncounterPlan(retries, resetHistory);
}

function getLoadedEncounterPlan(
	encounter: EncounterViewState,
	resetHistory: boolean,
): EncounterLoadPlan {
	return {
		kind: "loaded",
		encounter,
		selectedInstance: encounter.monsters[0] || null,
		resetHistory,
	};
}

function getMissingEncounterPlan(
	retries: number,
	resetHistory: boolean,
): EncounterLoadPlan {
	return retries > 0
		? { kind: "retry", retries: retries - 1, resetHistory }
		: { kind: "not-found" };
}

function findEncounterById(
	encounters: readonly EncounterViewState[],
	encounterId: string | number,
): EncounterViewState | null {
	return encounters.find(
		(encounter) => String(encounter.id ?? "") === String(encounterId),
	) || null;
}

export interface EncounterLoadPlanEffects {
	onRetry: (retries: number, resetHistory: boolean) => void;
	onNotFound: () => void;
	onLoaded: (
		encounter: EncounterViewState,
		selectedInstance: EncounterViewParticipant | null,
		resetHistory: boolean,
	) => void;
}

export function executeEncounterLoadPlan(
	plan: EncounterLoadPlan,
	effects: EncounterLoadPlanEffects,
): void {
	if (plan.kind === "retry") {
		effects.onRetry(plan.retries, plan.resetHistory);
		return;
	}
	if (plan.kind === "not-found") {
		effects.onNotFound();
		return;
	}
	effects.onLoaded(plan.encounter, plan.selectedInstance, plan.resetHistory);
}

interface EncounterImportOptions {
	invalidFileMessage: string;
	missingMonstersMessage: string;
	now?: () => number;
	random?: () => number;
}

export function parseEncounterImport(
	raw: unknown,
	encounter: EncounterViewState,
	{
		invalidFileMessage,
		missingMonstersMessage,
		now = Date.now,
		random = Math.random,
	}: EncounterImportOptions,
): EncounterViewState {
	const imported = parseEncounterImportPayload(
		raw,
		invalidFileMessage,
		missingMonstersMessage,
	);
	return {
		...encounter,
		name: getImportedEncounterName(imported.name, encounter.name),
		monsters: imported.monsters.map((monster, index) =>
			ensureEncounterMonsterId({
				...monster,
				instanceId: `inst-${now()}-${index}-${Math.floor(random() * 1000)}`,
			}),
		),
	};
}

interface EncounterImportPayload {
	name?: unknown;
	monsters: EncounterViewParticipant[];
}

function parseEncounterImportPayload(
	raw: unknown,
	invalidFileMessage: string,
	missingMonstersMessage: string,
): EncounterImportPayload {
	if (typeof raw !== "string") throw new Error(invalidFileMessage);
	const imported = JSON.parse(raw) as Partial<EncounterImportPayload>;
	if (!Array.isArray(imported.monsters)) throw new Error(missingMonstersMessage);
	return { ...imported, monsters: imported.monsters };
}

function getImportedEncounterName(value: unknown, fallback: string): string {
	return String(value || fallback);
}

export function getEncounterMonsterDropPlan({
	nextMonsters,
	currentEncounter,
	reorderStart,
	isUpdatingHistory,
}: {
	nextMonsters?: EncounterViewParticipant[] | null;
	currentEncounter: EncounterViewState | null;
	reorderStart: EncounterViewState | null;
	isUpdatingHistory: boolean;
}): EncounterMonsterDropPlan {
	const encounter = nextMonsters
		? ({ ...currentEncounter, monsters: nextMonsters } as EncounterViewState)
		: currentEncounter;
	if (!encounter) return { kind: "none" };
	return {
		kind: "persist",
		encounter,
		undoSnapshot: shouldRecordEncounterDropHistory(
			reorderStart,
			encounter,
			isUpdatingHistory,
		) ? reorderStart : null,
	};
}

function shouldRecordEncounterDropHistory(
	reorderStart: EncounterViewState | null,
	encounter: EncounterViewState,
	isUpdatingHistory: boolean,
): boolean {
	if (!reorderStart || isUpdatingHistory) return false;
	return JSON.stringify(reorderStart.monsters) !== JSON.stringify(encounter.monsters);
}

export interface EncounterMonsterDropEffects {
	clearReorderStart: () => void;
	recordUndo: (snapshot: EncounterViewState) => void;
	persist: (encounter: EncounterViewState) => void;
}

export function executeEncounterMonsterDropPlan(
	plan: EncounterMonsterDropPlan,
	effects: EncounterMonsterDropEffects,
): void {
	if (plan.kind === "none") return;
	effects.clearReorderStart();
	if (plan.undoSnapshot) effects.recordUndo(plan.undoSnapshot);
	effects.persist(plan.encounter);
}

export function getSelectedEncounterParticipant(
	encounter: EncounterViewState | null,
	preferredId?: string | null,
	previousId?: string | null,
): EncounterViewParticipant | null {
	const monsters = getSelectableEncounterParticipants(encounter);
	if (!monsters) return null;
	return findSelectedEncounterParticipant(
		monsters,
		getPreferredEncounterParticipantId(preferredId, previousId),
	);
}

function getSelectableEncounterParticipants(
	encounter: EncounterViewState | null,
): EncounterViewParticipant[] | null {
	return encounter && encounter.monsters.length ? encounter.monsters : null;
}

function getPreferredEncounterParticipantId(
	preferredId?: string | null,
	previousId?: string | null,
): string | null {
	return preferredId || previousId || null;
}

function findSelectedEncounterParticipant(
	monsters: EncounterViewParticipant[],
	targetId: string | null,
): EncounterViewParticipant {
	if (!targetId) return monsters[0];
	return monsters.find((monster) => monster.instanceId === targetId) || monsters[0];
}

export function normalizeEncounterViewState(
	next: EncounterEditorState,
	current: EncounterViewState | null,
): EncounterViewState {
	return {
		...next,
		name: getNormalizedEncounterName(next.name, current?.name),
		monsters: getNormalizedEncounterMonsters(next.monsters),
	};
}

function getNormalizedEncounterName(name: unknown, fallback: unknown): string {
	return String(name || fallback || "");
}

function getNormalizedEncounterMonsters(value: unknown): EncounterViewParticipant[] {
	return Array.isArray(value) ? value : [];
}

export function getEncounterUpdatePlan(
	nextEncounter: EncounterEditorState | null,
	currentEncounter: EncounterViewState | null,
	options: EncounterUpdateOptions = {},
	isUpdatingHistory = false,
): EncounterUpdatePlan {
	if (!nextEncounter) return { kind: "none" };
	const normalizedOptions = normalizeEncounterUpdateOptions(options);
	return {
		kind: "update",
		encounter: normalizeEncounterViewState(nextEncounter, currentEncounter),
		undoSnapshot: getEncounterUpdateUndoSnapshot(
			currentEncounter,
			normalizedOptions.pushUndo,
			isUpdatingHistory,
		),
		persist: normalizedOptions.persist,
		saveDebounceMs: normalizedOptions.saveDebounceMs,
		preferredId: normalizedOptions.preferredId,
	};
}

interface NormalizedEncounterUpdateOptions {
	saveDebounceMs: number;
	pushUndo: boolean;
	persist: boolean;
	preferredId: string | null;
}

function normalizeEncounterUpdateOptions(
	options: EncounterUpdateOptions,
): NormalizedEncounterUpdateOptions {
	return {
		saveDebounceMs: withEncounterDefault(options.saveDebounceMs, 0),
		pushUndo: withEncounterDefault(options.pushUndo, true),
		persist: withEncounterDefault(options.persist, true),
		preferredId: withEncounterDefault(options.preferredId, null),
	};
}

function withEncounterDefault<T>(value: T | undefined, fallback: T): T {
	return value === undefined ? fallback : value;
}

function getEncounterUpdateUndoSnapshot(
	currentEncounter: EncounterViewState | null,
	pushUndo: boolean,
	isUpdatingHistory: boolean,
): EncounterViewState | null {
	return pushUndo && currentEncounter && !isUpdatingHistory
		? currentEncounter
		: null;
}

export interface EncounterUpdateEffects {
	recordUndo: (snapshot: EncounterViewState) => void;
	setEncounter: (encounter: EncounterViewState) => void;
	syncSelected: (encounter: EncounterViewState, preferredId: string | null) => void;
	persist: (encounter: EncounterViewState, debounceMs: number) => void;
}

export function executeEncounterUpdatePlan(
	plan: EncounterUpdatePlan,
	effects: EncounterUpdateEffects,
): void {
	if (plan.kind === "none") return;
	if (plan.undoSnapshot) effects.recordUndo(plan.undoSnapshot);
	effects.setEncounter(plan.encounter);
	effects.syncSelected(plan.encounter, plan.preferredId);
	if (plan.persist) effects.persist(plan.encounter, plan.saveDebounceMs);
}

export function replaceEncounterMonsterFromAi(
	encounter: EncounterViewState,
	instanceId: string,
	nextMonster: EncounterViewParticipant,
	options: MonsterAiUpdateOptions = {},
): EncounterViewState {
	return {
		...encounter,
		monsters: encounter.monsters.map((monster) =>
			monster.instanceId === instanceId
				? mergeEncounterMonsterFromAi(monster, nextMonster, instanceId, options)
				: monster,
		),
	};
}

function mergeEncounterMonsterFromAi(
	current: EncounterViewParticipant,
	next: EncounterViewParticipant,
	instanceId: string,
	options: MonsterAiUpdateOptions,
): EncounterViewParticipant {
	const maxHp = getNextMonsterMaxHp(next, current);
	const currentHp = getNextMonsterCurrentHp(next, current, maxHp, options);
	return {
		...ensureEncounterMonsterId(next),
		instanceId,
		...getLocalMonsterIdentity(current, next, options.localOverride),
		currentHp,
		hit_points: maxHp,
	};
}

function getNextMonsterMaxHp(
	next: EncounterViewParticipant,
	current: EncounterViewParticipant,
): number {
	const nextMaxHp = parseInteger(getNextMonsterHpValue(next));
	return nextMaxHp || parseInteger(current.hit_points);
}

function getNextMonsterHpValue(next: EncounterViewParticipant): unknown {
	if (next.hit_points !== null && next.hit_points !== undefined) return next.hit_points;
	return getStructuredMonsterAverageHp(next.hp);
}

function getStructuredMonsterAverageHp(value: unknown): unknown {
	return value && typeof value === "object"
		? (value as { average?: unknown }).average
		: undefined;
}

function getNextMonsterCurrentHp(
	next: EncounterViewParticipant,
	current: EncounterViewParticipant,
	maxHp: number,
	options: MonsterAiUpdateOptions,
): number {
	const candidate = options.preserveCurrentHp === false && next.currentHp !== undefined
		? Number.parseInt(String(next.currentHp), 10)
		: Number(current.currentHp);
	return Math.min(Number.isFinite(candidate) ? candidate : maxHp, maxHp);
}

function getLocalMonsterIdentity(
	current: EncounterViewParticipant,
	next: EncounterViewParticipant,
	localOverride: boolean | undefined,
): Partial<EncounterViewParticipant> {
	if (!localOverride) return {};
	return {
		source: current.source,
		originalBestiaryName:
			current.originalBestiaryName || next.originalBestiaryName || next.name,
		_localOverride: true,
	};
}

export function applyEncounterDiceHpResult({
	result,
	context,
	campaignSlug,
	sessionId,
	encounterId,
	encounter,
}: EncounterDiceResultInput): EncounterDiceHpUpdate | null {
	const target = getEncounterDiceHpTarget({
		result,
		context,
		campaignSlug,
		sessionId,
		encounterId,
		encounter,
	});
	if (!target) return null;
	return getEncounterDiceHpUpdate(target, getRolledEncounterHp(result?.total));
}

function getRolledEncounterHp(value: unknown): number {
	return Math.max(1, Number(value) || 0);
}

function getEncounterDiceHpUpdate(
	target: EncounterDiceHpTarget,
	rolledHp: number,
): EncounterDiceHpUpdate | null {
	const monsters = replaceMonsterHp(target.encounter.monsters, target.instanceId, rolledHp);
	if (monsters === target.encounter.monsters) return null;
	return {
		encounter: { ...target.encounter, monsters },
		preferredId: target.instanceId,
	};
}

interface EncounterDiceHpTarget {
	encounter: EncounterViewState;
	instanceId: string;
}

function getEncounterDiceHpTarget(
	input: EncounterDiceResultInput,
): EncounterDiceHpTarget | null {
	const target = getRequiredEncounterDiceHpTarget(input);
	if (!target) return null;
	if (!input.context) return null;
	if (!matchesEncounterDiceContext(
		input.context,
		input.campaignSlug,
		input.sessionId,
		input.encounterId,
	)) return null;
	return target;
}

function getRequiredEncounterDiceHpTarget(
	input: EncounterDiceResultInput,
): EncounterDiceHpTarget | null {
	if (!input.result || !input.encounter) return null;
	return getEncounterDiceContextTarget(input.context, input.encounter);
}

function getEncounterDiceContextTarget(
	context: EncounterDiceResultInput["context"],
	encounter: EncounterViewState,
): EncounterDiceHpTarget | null {
	if (!context?.instanceId) return null;
	return { encounter, instanceId: context.instanceId };
}

export type EncounterDiceProcessingOutcome = "ignored" | "processed" | "applied";

export function executeEncounterDiceProcessing(
	input: EncounterDiceProcessingInput,
	effects: EncounterDiceProcessingEffects,
): EncounterDiceProcessingOutcome {
	if (!input.resultId || input.resultId === input.processedResultId) return "ignored";
	effects.onProcessed(input.resultId);
	const update = applyEncounterDiceHpResult(input);
	if (!update) return "processed";
	effects.onUpdate(update);
	return "applied";
}

function matchesEncounterDiceContext(
	context: NonNullable<EncounterDiceResultInput["context"]>,
	campaignSlug: string,
	sessionId: string,
	encounterId: string,
): boolean {
	return (
		context.kind === "encounter_hp" &&
		context.campaignSlug === campaignSlug &&
		String(context.sessionId) === String(sessionId) &&
		String(context.encounterId) === String(encounterId)
	);
}

function replaceMonsterHp(
	monsters: EncounterViewParticipant[],
	instanceId: string,
	hp: number,
): EncounterViewParticipant[] {
	const index = monsters.findIndex((monster) => monster.instanceId === instanceId);
	if (index < 0) return monsters;
	return monsters.map((monster, monsterIndex) =>
		monsterIndex === index
			? { ...monster, hit_points: hp, currentHp: hp }
			: monster,
	);
}
