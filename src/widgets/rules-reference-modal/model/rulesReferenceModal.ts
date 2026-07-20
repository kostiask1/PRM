import { objectMatchesSearch } from "../../../shared/lib/index.js";

export const REFERENCE_TAB_IDS = [
	"conditions",
	"diseases",
	"senses",
	"skills",
	"variantrules",
	"spells",
	"bestiary",
] as const;

export type ReferenceTabId = (typeof REFERENCE_TAB_IDS)[number];

export interface ReferenceItem extends Record<string, unknown> {
	name?: string;
	source?: string;
	kind?: string;
}

export interface ReferenceTabPolicy {
	id: ReferenceTabId;
	label: string;
	emptyLabel: string;
	searchFields: string[];
}

export interface ReferenceSelection<TItem extends ReferenceItem = ReferenceItem> {
	tabId: ReferenceTabId;
	item: TItem;
	name: string;
	tag: string;
}

export interface ReferenceKeyboardInput {
	key: string;
	altKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
	isEditableTarget: boolean;
	canNavigateBack: boolean;
}

export interface ReferenceKeyboardPlan {
	preventDefault: true;
	historyDirection: -1;
}

export interface ReferenceTabSelectionPlan {
	tabId: ReferenceTabId;
	navigationName: string | null;
	pendingNavigationTabId: ReferenceTabId | null;
}

export type ReferenceSelectionsByTab = Partial<Record<ReferenceTabId, string>>;

export type ReferenceSelectionReconciliationPlan =
	| { type: "clear"; tabId: ReferenceTabId }
	| { type: "select"; tabId: ReferenceTabId; name: string };

export interface ReferenceSelectionReconciliationInput {
	tabId: ReferenceTabId;
	hasLoaded: boolean;
	isLoading: boolean;
	activeItems: ReferenceItem[];
	filteredItems: ReferenceItem[];
	selectedName: string;
}

export interface ReferenceScrollInput {
	tabId: ReferenceTabId;
	hasLoaded: boolean;
	isLoading: boolean;
	shouldScroll: boolean;
	filteredItems: ReferenceItem[];
	selectedName: string;
}

export interface ReferenceScrollPlan {
	scrollIndex: number;
}

export interface ReferenceHistoryAvailability {
	canNavigateBack: boolean;
	canNavigateForward: boolean;
}

export interface ReferenceNavigationRequestInput {
	requestId?: number;
	tabId?: unknown;
	name?: string;
	forceTab?: boolean;
}

export type ReferenceNavigationRequestPlan =
	| { type: "tab-only"; requestId: number; tabId: unknown }
	| { type: "reference"; requestId: number; tabId: unknown; name: string };

export interface ReferenceHistoryEntryInput {
	tabId: unknown;
	name: string;
}

export type ReferenceInitialNavigationPlan =
	| { type: "force-reference"; tabId: ReferenceTabId; name: string }
	| { type: "force-tab"; tabId: ReferenceTabId }
	| { type: "reference"; tabId: ReferenceTabId; name: string }
	| { type: "history"; entry: ReferenceHistoryEntryInput }
	| { type: "tab"; tabId: ReferenceTabId };

export interface ReferenceInitialNavigationEffects {
	onTabOnly: (tabId: ReferenceTabId) => void;
	onReference: (tabId: ReferenceTabId, name: string) => void;
	onHistory: (entry: ReferenceHistoryEntryInput) => void;
	onTab: (tabId: ReferenceTabId) => void;
}

export interface ReferenceTabSelectionEffects {
	onScrollRequest: (shouldScroll: false) => void;
	onPendingNavigation: (tabId: ReferenceTabId | null) => void;
	onNavigation: (tabId: ReferenceTabId, name: string) => void;
	onActiveTab: (tabId: ReferenceTabId) => void;
}

export interface ReferenceModalHostPlan {
	requestId: number;
	shouldOpen: boolean;
	initialTab: unknown;
	initialName: string;
	forceTab: boolean;
}

export const REFERENCE_TAB_POLICIES: ReferenceTabPolicy[] = [
	{ id: "conditions", label: "Conditions", emptyLabel: "No conditions or statuses found.", searchFields: ["name"] },
	{ id: "diseases", label: "Diseases", emptyLabel: "No diseases found.", searchFields: ["name", "type"] },
	{ id: "senses", label: "Senses", emptyLabel: "No senses found.", searchFields: ["name"] },
	{ id: "skills", label: "Skills", emptyLabel: "No skills found.", searchFields: ["name", "ability"] },
	{ id: "variantrules", label: "Variant Rules", emptyLabel: "No variant rules found.", searchFields: ["name", "ruleType"] },
	{ id: "spells", label: "Spells", emptyLabel: "No spells found.", searchFields: ["name", "school", "source", "level", "level_int"] },
	{ id: "bestiary", label: "Bestiary", emptyLabel: "No creatures found.", searchFields: ["name", "source", "cr"] },
];

const TAB_ID_SET = new Set<ReferenceTabId>(REFERENCE_TAB_IDS);

export function isReferenceTabId(value: unknown): value is ReferenceTabId {
	return typeof value === "string" && TAB_ID_SET.has(value as ReferenceTabId);
}

export function getInitialTabId(value: unknown): ReferenceTabId {
	return isReferenceTabId(value) ? value : "conditions";
}

export function normalizeReferenceList(value: unknown): ReferenceItem[] {
	return Array.isArray(value) ? (value as ReferenceItem[]) : [];
}

function isPresentReferencePayload(value: unknown): boolean {
	return value !== null && value !== undefined;
}

function readReferenceList(value: unknown): ReferenceItem[] {
	if (Array.isArray(value)) return value as ReferenceItem[];
	if (value === null || typeof value !== "object") return [];
	const record = value as Record<string, unknown>;
	const payload = [record.monster, record.monsters, record.results].find(isPresentReferencePayload);
	return normalizeReferenceList(payload);
}

export function combineBestiaryLists(official: unknown, custom: unknown): ReferenceItem[] {
	return [...readReferenceList(official), ...readReferenceList(custom)];
}

export function getReferenceItemKey(tabId: ReferenceTabId, item: ReferenceItem): string {
	return `${tabId}:${String(item.source || "")}:${String(item.name || "")}`;
}

export function getSpellReferenceName(item: ReferenceItem = {}): string {
	return getQualifiedReferenceName(item);
}

export function getCreatureReferenceName(item: ReferenceItem = {}): string {
	return getQualifiedReferenceName(item);
}

function getQualifiedReferenceName(item: ReferenceItem): string {
	const name = stringifyTruthyReferenceValue(item.name).trim();
	if (!name) return "";
	const source = stringifyTruthyReferenceValue(item.source).trim();
	return [name, source].filter(Boolean).join("|");
}

function stringifyTruthyReferenceValue(value: unknown): string {
	return value ? String(value) : "";
}

interface ReferenceInlineTagPolicy {
	tag: (item: ReferenceItem) => string;
	identity: (item: ReferenceItem, name: string) => string;
}

const INLINE_TAG_POLICIES: Record<ReferenceTabId, ReferenceInlineTagPolicy> = {
	conditions: {
		tag: (item) => item.kind === "status" ? "status" : "condition",
		identity: (_item, name) => name,
	},
	diseases: { tag: () => "disease", identity: (_item, name) => name },
	senses: { tag: () => "sense", identity: (_item, name) => name },
	skills: { tag: () => "skill", identity: (_item, name) => name },
	variantrules: { tag: () => "variantrule", identity: (_item, name) => name },
	spells: { tag: () => "spell", identity: (item) => getSpellReferenceName(item) },
	bestiary: { tag: () => "creature", identity: (item) => getCreatureReferenceName(item) },
};

export function getReferenceInlineTag(tabId: ReferenceTabId, item: ReferenceItem = {}): string {
	const name = String(item.name || "").trim();
	if (!name) return "";
	const policy = INLINE_TAG_POLICIES[tabId];
	return `{@${policy.tag(item)} ${policy.identity(item, name)}}`;
}

export function getReferenceKeyboardPlan(input: ReferenceKeyboardInput): ReferenceKeyboardPlan | null {
	const blockers = [
		input.key !== "Backspace",
		input.altKey,
		input.ctrlKey,
		input.metaKey,
		input.shiftKey,
		input.isEditableTarget,
		!input.canNavigateBack,
	];
	if (blockers.includes(true)) {
		return null;
	}
	return { preventDefault: true, historyDirection: -1 };
}

function preferSelectedReferenceName(selectedName: string, firstItemName: string): string {
	return selectedName || firstItemName;
}

const TAB_NAVIGATION_NAME_POLICIES: Record<ReferenceTabId, (selectedName: string, firstItemName: string) => string> = {
	conditions: preferSelectedReferenceName,
	diseases: preferSelectedReferenceName,
	senses: preferSelectedReferenceName,
	skills: preferSelectedReferenceName,
	variantrules: preferSelectedReferenceName,
	spells: (selectedName) => selectedName,
	bestiary: preferSelectedReferenceName,
};

function getReferenceItemOrEmpty(item: ReferenceItem | null | undefined): ReferenceItem {
	return item ? item : {};
}

function createReferenceTabSelectionPlan(
	tabId: ReferenceTabId,
	navigationName: string,
): ReferenceTabSelectionPlan {
	if (navigationName) {
		return { tabId, navigationName, pendingNavigationTabId: null };
	}
	return { tabId, navigationName: null, pendingNavigationTabId: tabId };
}

export function getReferenceTabSelectionPlan(
	tabId: unknown,
	selectedName: string,
	firstItem: ReferenceItem | null | undefined,
): ReferenceTabSelectionPlan | null {
	if (!isReferenceTabId(tabId)) return null;
	const firstItemName = getReferenceSelectionName(tabId, getReferenceItemOrEmpty(firstItem));
	const navigationName = TAB_NAVIGATION_NAME_POLICIES[tabId](selectedName, firstItemName);
	return createReferenceTabSelectionPlan(tabId, navigationName);
}

export function getReferenceSelectionReconciliationPlan(
	input: ReferenceSelectionReconciliationInput,
): ReferenceSelectionReconciliationPlan | null {
	const blockers = [
		!input.hasLoaded,
		input.isLoading,
		input.tabId === "spells",
		input.activeItems.some((item) => itemMatchesSelectedName(input.tabId, item, input.selectedName)),
	];
	if (blockers.includes(true)) return null;
	if (!input.filteredItems.length) return { type: "clear", tabId: input.tabId };
	const hasFilteredSelection = input.filteredItems.some((item) =>
		itemMatchesSelectedName(input.tabId, item, input.selectedName),
	);
	if (hasFilteredSelection) return null;
	return {
		type: "select",
		tabId: input.tabId,
		name: getReferenceSelectionName(input.tabId, input.filteredItems[0]),
	};
}

export function applyReferenceSelectionReconciliationPlan(
	selectedByTab: ReferenceSelectionsByTab,
	plan: ReferenceSelectionReconciliationPlan,
): ReferenceSelectionsByTab {
	if (plan.type === "clear") {
		if (!selectedByTab[plan.tabId]) return selectedByTab;
		return { ...selectedByTab, [plan.tabId]: "" };
	}
	return { ...selectedByTab, [plan.tabId]: plan.name };
}

export function getReferenceScrollPlan(input: ReferenceScrollInput): ReferenceScrollPlan | null {
	const blockers = [
		!input.hasLoaded,
		input.isLoading,
		!input.selectedName,
		!input.shouldScroll,
	];
	if (blockers.includes(true)) return null;
	const activeItem = findSelectedReferenceItem(input.tabId, input.filteredItems, input.selectedName);
	return { scrollIndex: activeItem ? input.filteredItems.indexOf(activeItem) : -1 };
}

export function getReferenceHistoryAvailability(
	index: number,
	entryCount: number,
): ReferenceHistoryAvailability {
	return {
		canNavigateBack: index > 0,
		canNavigateForward: [index >= 0, index < entryCount - 1].every(Boolean),
	};
}

export function getReferenceNavigationRequestPlan(
	request: ReferenceNavigationRequestInput | null | undefined,
	handledRequestId: number | null,
): ReferenceNavigationRequestPlan | null {
	const normalizedRequest = getNavigationRequestOrEmpty(request);
	const requestId = getTruthyRequestId(normalizedRequest.requestId);
	if (requestId === null) return null;
	if (handledRequestId === requestId) return null;
	const requestName = stringifyTruthyReferenceValue(normalizedRequest.name);
	const isTabOnly = [Boolean(normalizedRequest.forceTab), !requestName].every(Boolean);
	if (isTabOnly) return { type: "tab-only", requestId, tabId: normalizedRequest.tabId };
	return {
		type: "reference",
		requestId,
		tabId: normalizedRequest.tabId,
		name: requestName,
	};
}

function getNavigationRequestOrEmpty(
	request: ReferenceNavigationRequestInput | null | undefined,
): ReferenceNavigationRequestInput {
	return request ? request : {};
}

function getTruthyRequestId(requestId: number | undefined): number | null {
	return requestId ? requestId : null;
}

function allReferenceNavigationChecks(checks: boolean[]): boolean {
	return checks.every(Boolean);
}

function getHistoryEntryOrFallback(
	entry: ReferenceHistoryEntryInput | null | undefined,
	tabId: ReferenceTabId,
): ReferenceHistoryEntryInput {
	return entry ? entry : { tabId, name: "" };
}

export function getReferenceInitialNavigationPlan(
	hasInitialized: boolean,
	forceTab: boolean,
	initialTab: unknown,
	initialName: string,
	currentEntry: ReferenceHistoryEntryInput | null | undefined,
): ReferenceInitialNavigationPlan | null {
	if (hasInitialized) return null;
	const tabId = getInitialTabId(initialTab);
	const historyEntry = getHistoryEntryOrFallback(currentEntry, tabId);
	const candidates: Array<{ matches: boolean; plan: ReferenceInitialNavigationPlan }> = [
		{
			matches: allReferenceNavigationChecks([forceTab, Boolean(initialName)]),
			plan: { type: "force-reference", tabId, name: initialName },
		},
		{ matches: forceTab, plan: { type: "force-tab", tabId } },
		{ matches: Boolean(initialName), plan: { type: "reference", tabId, name: initialName } },
		{ matches: Boolean(currentEntry), plan: { type: "history", entry: historyEntry } },
		{ matches: true, plan: { type: "tab", tabId } },
	];
	return candidates.find((candidate) => candidate.matches)?.plan ?? null;
}

type InitialNavigationExecutor<TType extends ReferenceInitialNavigationPlan["type"]> = (
	plan: Extract<ReferenceInitialNavigationPlan, { type: TType }>,
	effects: ReferenceInitialNavigationEffects,
) => void;

const INITIAL_NAVIGATION_EXECUTORS: {
	[TType in ReferenceInitialNavigationPlan["type"]]: InitialNavigationExecutor<TType>;
} = {
	"force-reference": (plan, effects) => {
		effects.onTabOnly(plan.tabId);
		effects.onReference(plan.tabId, plan.name);
	},
	"force-tab": (plan, effects) => effects.onTabOnly(plan.tabId),
	reference: (plan, effects) => effects.onReference(plan.tabId, plan.name),
	history: (plan, effects) => effects.onHistory(plan.entry),
	tab: (plan, effects) => effects.onTab(plan.tabId),
};

export function executeReferenceInitialNavigationPlan(
	plan: ReferenceInitialNavigationPlan | null,
	effects: ReferenceInitialNavigationEffects,
): boolean {
	if (!plan) return false;
	const executor = INITIAL_NAVIGATION_EXECUTORS[plan.type] as (
		selectedPlan: ReferenceInitialNavigationPlan,
		selectedEffects: ReferenceInitialNavigationEffects,
	) => void;
	executor(plan, effects);
	return true;
}

export function getReferenceTabsToLoad(
	isGlobalSearch: boolean,
	tabIds: ReferenceTabId[],
	activeTabId: ReferenceTabId,
	itemsByTab: Partial<Record<ReferenceTabId, ReferenceItem[]>>,
	requestedTabIds: ReadonlySet<ReferenceTabId>,
): ReferenceTabId[] {
	const candidates = isGlobalSearch ? tabIds : [activeTabId];
	return candidates.filter((tabId) =>
		[!itemsByTab[tabId], !requestedTabIds.has(tabId)].every(Boolean),
	);
}

export function applyLoadedReferenceSelection(
	selectedByTab: ReferenceSelectionsByTab,
	tabId: ReferenceTabId,
	items: ReferenceItem[],
): ReferenceSelectionsByTab {
	const blockers = [Boolean(selectedByTab[tabId]), tabId === "spells"];
	if (blockers.includes(true)) return selectedByTab;
	return {
		...selectedByTab,
		[tabId]: getReferenceSelectionName(tabId, items[0]),
	};
}

export function applyReferenceTabOnlySelection(
	selectedByTab: ReferenceSelectionsByTab,
	tabId: ReferenceTabId,
): ReferenceSelectionsByTab {
	if (selectedByTab[tabId] === "") return selectedByTab;
	return { ...selectedByTab, [tabId]: "" };
}

export function getReferenceLoadErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

export function executeReferenceTabSelectionPlan(
	plan: ReferenceTabSelectionPlan | null,
	effects: ReferenceTabSelectionEffects,
): boolean {
	if (!plan) return false;
	effects.onScrollRequest(false);
	effects.onPendingNavigation(plan.pendingNavigationTabId);
	if (plan.navigationName) effects.onNavigation(plan.tabId, plan.navigationName);
	effects.onActiveTab(plan.tabId);
	return true;
}

export function getReferenceModalHostPlan(
	request: ReferenceNavigationRequestInput | null | undefined,
	handledRequestId: number | null,
	isOpen: boolean,
): ReferenceModalHostPlan | null {
	const navigationPlan = getReferenceNavigationRequestPlan(request, handledRequestId);
	if (!navigationPlan) return null;
	const normalizedRequest = getNavigationRequestOrEmpty(request);
	return {
		requestId: navigationPlan.requestId,
		shouldOpen: !isOpen,
		initialTab: normalizedRequest.tabId,
		initialName: stringifyTruthyReferenceValue(normalizedRequest.name),
		forceTab: Boolean(normalizedRequest.forceTab),
	};
}

function parseCreatureReference(value: unknown): { name: string; source: string } {
	const [name = "", source = ""] = String(value || "").split("|");
	return { name: name.trim().toLowerCase(), source: source.trim().toUpperCase() };
}

export function getCreatureReferenceMatchRank(item: ReferenceItem, selectedName: unknown): number {
	const selected = parseCreatureReference(selectedName);
	const candidate = parseCreatureReference(getCreatureReferenceName(item));
	const sameNamedCreature = [Boolean(selected.name), candidate.name === selected.name].every(Boolean);
	if (!sameNamedCreature) return 0;
	if (!selected.source) return 2;
	return 1 + Number(candidate.source === selected.source) * 2;
}

export function getReferenceSelectionName(tabId: ReferenceTabId, item: ReferenceItem = {}): string {
	if (tabId === "spells") return getSpellReferenceName(item);
	if (tabId === "bestiary") return getCreatureReferenceName(item);
	return String(item.name || "");
}

type ReferenceNameMatcher = (item: ReferenceItem, selectedName: string) => boolean;

function matchesStandardReferenceName(item: ReferenceItem, selectedName: string): boolean {
	return stringifyTruthyReferenceValue(item.name) === selectedName;
}

function matchesQualifiedReferenceName(tabId: ReferenceTabId, item: ReferenceItem, selectedName: string): boolean {
	const candidates = [getReferenceSelectionName(tabId, item), String(item.name || "")];
	return candidates.includes(selectedName);
}

const REFERENCE_NAME_MATCHERS: Record<ReferenceTabId, ReferenceNameMatcher> = {
	conditions: matchesStandardReferenceName,
	diseases: matchesStandardReferenceName,
	senses: matchesStandardReferenceName,
	skills: matchesStandardReferenceName,
	variantrules: matchesStandardReferenceName,
	spells: (item, selectedName) => matchesQualifiedReferenceName("spells", item, selectedName),
	bestiary: (item, selectedName) => getCreatureReferenceMatchRank(item, selectedName) > 0,
};

export function itemMatchesSelectedName(tabId: ReferenceTabId, item: ReferenceItem, selectedName: unknown): boolean {
	const selected = stringifyTruthyReferenceValue(selectedName).trim();
	if (!selected) return false;
	return REFERENCE_NAME_MATCHERS[tabId](item, selected);
}

type ReferenceItemFinder = (items: ReferenceItem[], selectedName: unknown) => ReferenceItem | null;

function findFirstReferenceItem(tabId: ReferenceTabId, items: ReferenceItem[], selectedName: unknown): ReferenceItem | null {
	return items.find((item) => itemMatchesSelectedName(tabId, item, selectedName)) ?? null;
}

function findBestiaryReferenceItem(items: ReferenceItem[], selectedName: unknown): ReferenceItem | null {
	const exactMatch = items.find((item) => getCreatureReferenceMatchRank(item, selectedName) === 3);
	if (exactMatch) return exactMatch;
	return items.find((item) => getCreatureReferenceMatchRank(item, selectedName) > 0) ?? null;
}

const REFERENCE_ITEM_FINDERS: Record<ReferenceTabId, ReferenceItemFinder> = {
	conditions: (items, selectedName) => findFirstReferenceItem("conditions", items, selectedName),
	diseases: (items, selectedName) => findFirstReferenceItem("diseases", items, selectedName),
	senses: (items, selectedName) => findFirstReferenceItem("senses", items, selectedName),
	skills: (items, selectedName) => findFirstReferenceItem("skills", items, selectedName),
	variantrules: (items, selectedName) => findFirstReferenceItem("variantrules", items, selectedName),
	spells: (items, selectedName) => findFirstReferenceItem("spells", items, selectedName),
	bestiary: findBestiaryReferenceItem,
};

export function findSelectedReferenceItem(tabId: ReferenceTabId, items: ReferenceItem[], selectedName: unknown): ReferenceItem | null {
	return REFERENCE_ITEM_FINDERS[tabId](items, selectedName);
}

export function itemMatchesQuery(
	policy: ReferenceTabPolicy,
	item: ReferenceItem,
	normalizedQuery: string,
	isDetailedSearch: boolean,
	metaValue: unknown = "",
): boolean {
	if (!normalizedQuery) return true;
	const values = [...policy.searchFields.map((field) => item[field]), metaValue].filter(Boolean);
	return (isDetailedSearch && objectMatchesSearch(item, normalizedQuery)) ||
		values.some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

export function createReferenceSelection<TItem extends ReferenceItem>(
	tabId: ReferenceTabId,
	item: TItem,
): ReferenceSelection<TItem> | null {
	const name = String(item.name || "");
	if (!name) return null;
	return { tabId, item, name, tag: getReferenceInlineTag(tabId, item) };
}
