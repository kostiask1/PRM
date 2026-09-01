import type {
	CardNote,
	CharacterData,
	DomainId,
	LocationData,
} from "../../../entities/campaign/index.js";
import type { SessionRecord } from "../../../entities/session/index.js";
import type {
	CampaignPageCampaign,
	CampaignPageEntity,
} from "./contracts.ts";

export type CampaignNotesViewMode = "list" | "graph";
export type CampaignEntitySectionType = "characters" | "npc" | "locations";
export type CampaignCharacterType = "characters" | "npc";
export type CampaignHashTarget = "notes" | "characters" | "npc" | "locations";
export type CampaignKeyboardAction = "undo" | "redo" | "none";

export interface CampaignKeyboardTarget {
	tagName?: unknown;
	isContentEditable?: unknown;
}

export interface CampaignKeyboardInput {
	code: string;
	shiftKey: boolean;
	isHistoryShortcut: boolean;
	shouldUseAppHistory: boolean;
	isEditableTarget: boolean;
}

export interface CampaignCharacterDropPayload {
	kind?: string;
	sourceType?: string;
	id?: DomainId;
}

export interface CampaignCharacterDropRequest {
	sourceType: CampaignCharacterType;
	targetType: CampaignCharacterType;
	id: DomainId;
}

export interface CampaignSessionItem extends SessionRecord {
	fileName: string;
}

export interface CampaignSectionStateInput {
	description: unknown;
	notes: unknown;
	characters?: CampaignPageEntity[];
	npcs?: CampaignPageEntity[];
	locations?: CampaignPageEntity[];
	isDescriptionCollapsed: boolean;
	isNotesCollapsed: boolean;
	isCharactersCollapsed: boolean;
	isNpcsCollapsed: boolean;
	isLocationsCollapsed: boolean;
}

export interface CampaignSectionState {
	hasDescriptionData: boolean;
	hasNotesData: boolean;
	hasCharactersData: boolean;
	hasNpcsData: boolean;
	hasLocationsData: boolean;
	isDescriptionCollapsed: boolean;
	isNotesCollapsed: boolean;
	isCharactersCollapsed: boolean;
	isNpcsCollapsed: boolean;
	isLocationsCollapsed: boolean;
}

export interface CampaignNotesSectionInput {
	hasData: boolean;
	isCollapsed: boolean;
	viewMode: CampaignNotesViewMode;
}

export interface CampaignNotesSectionPresentation {
	canToggleCollapse: boolean;
	isListVisible: boolean;
	isGraphVisible: boolean;
	showBulkCollapse: boolean;
	listButtonVariant: "primary" | "ghost";
	graphButtonVariant: "primary" | "ghost";
}

export type CampaignNotesCollapsePatch = Partial<CampaignPageCampaign> & {
	isNotesCollapsed: boolean;
};

export interface CampaignNotesViewModePlan {
	viewMode: CampaignNotesViewMode;
	collapsePatch: CampaignNotesCollapsePatch | null;
}

export interface CampaignHashNavigationInput {
	hash: unknown;
	collapsed: Readonly<Record<CampaignHashTarget, boolean>>;
}

export interface CampaignHashNavigationPlan {
	target: CampaignHashTarget | null;
	shouldUseListView: boolean;
	sectionToExpand: CampaignHashTarget | null;
}

export interface CampaignHashNavigationEffects {
	useListView: () => void;
	expandSection: (target: CampaignHashTarget) => void;
}

export type CampaignEntityAiIgnoredUpdate =
	| { kind: "none" }
	| {
			kind: "npc" | "locations";
			entityId: DomainId;
			entity: CampaignPageEntity;
	  };

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isCampaignEditableTarget(
	target: CampaignKeyboardTarget | null | undefined,
): boolean {
	return ["INPUT", "TEXTAREA"].includes(target?.tagName as string)
		|| Boolean(target?.isContentEditable);
}

function canRouteCampaignHistoryAction({
	isHistoryShortcut,
	shouldUseAppHistory,
	isEditableTarget,
}: Pick<
	CampaignKeyboardInput,
	"isHistoryShortcut" | "shouldUseAppHistory" | "isEditableTarget"
>): boolean {
	const targetAllowsAppHistory = !isEditableTarget || shouldUseAppHistory;
	return isHistoryShortcut && targetAllowsAppHistory;
}

function getCampaignHistoryKeyAction(
	code: string,
	shiftKey: boolean,
): CampaignKeyboardAction {
	if (code === "KeyZ") return shiftKey ? "redo" : "undo";
	return code === "KeyY" ? "redo" : "none";
}

export function getCampaignKeyboardAction({
	code,
	shiftKey,
	isHistoryShortcut,
	shouldUseAppHistory,
	isEditableTarget,
}: CampaignKeyboardInput): CampaignKeyboardAction {
	const canRoute = canRouteCampaignHistoryAction({
		isHistoryShortcut,
		shouldUseAppHistory,
		isEditableTarget,
	});
	return canRoute ? getCampaignHistoryKeyAction(code, shiftKey) : "none";
}

export function getCampaignPageCampaign(
	value: unknown,
): CampaignPageCampaign | null {
	if (!isRecord(value)) return null;
	if (typeof value.slug !== "string" || typeof value.name !== "string") return null;
	return value as CampaignPageCampaign;
}

export function hasCampaignDescription(description: unknown): boolean {
	return String(description || "").trim().length > 0;
}

export function hasCampaignNoteContent(notes: unknown): boolean {
	return (Array.isArray(notes) ? notes : []).some((note) => {
		if (!isRecord(note)) return false;
		return Boolean(String(note.title || "").trim() || String(note.text || "").trim());
	});
}

function hasCampaignItems(items: CampaignPageEntity[] | undefined): boolean {
	return Array.isArray(items) && items.length > 0;
}

function getStoredCollapseState(hasData: boolean, collapsed: boolean): boolean {
	return hasData ? collapsed : false;
}

export function getCampaignSectionState(
	input: CampaignSectionStateInput,
): CampaignSectionState {
	const hasDescriptionData = hasCampaignDescription(input.description);
	const hasNotesData = hasCampaignNoteContent(input.notes);
	const hasCharactersData = hasCampaignItems(input.characters);
	const hasNpcsData = hasCampaignItems(input.npcs);
	const hasLocationsData = hasCampaignItems(input.locations);
	return {
		hasDescriptionData,
		hasNotesData,
		hasCharactersData,
		hasNpcsData,
		hasLocationsData,
		isDescriptionCollapsed: getStoredCollapseState(
			hasDescriptionData,
			input.isDescriptionCollapsed,
		),
		isNotesCollapsed: getStoredCollapseState(
			hasNotesData,
			input.isNotesCollapsed,
		),
		isCharactersCollapsed: getStoredCollapseState(
			hasCharactersData,
			input.isCharactersCollapsed,
		),
		isNpcsCollapsed: getStoredCollapseState(
			hasNpcsData,
			input.isNpcsCollapsed,
		),
		isLocationsCollapsed: getStoredCollapseState(
			hasLocationsData,
			input.isLocationsCollapsed,
		),
	};
}

function isCampaignNotesModeVisible(
	isCollapsed: boolean,
	viewMode: CampaignNotesViewMode,
	targetMode: CampaignNotesViewMode,
): boolean {
	return !isCollapsed && viewMode === targetMode;
}

function getCampaignNotesButtonVariant(
	viewMode: CampaignNotesViewMode,
	targetMode: CampaignNotesViewMode,
): "primary" | "ghost" {
	return viewMode === targetMode ? "primary" : "ghost";
}

export function getCampaignNotesSectionPresentation({
	hasData,
	isCollapsed,
	viewMode,
}: CampaignNotesSectionInput): CampaignNotesSectionPresentation {
	const isListVisible = isCampaignNotesModeVisible(
		isCollapsed,
		viewMode,
		"list",
	);
	return {
		canToggleCollapse: hasData,
		isListVisible,
		isGraphVisible: isCampaignNotesModeVisible(
			isCollapsed,
			viewMode,
			"graph",
		),
		showBulkCollapse: isListVisible,
		listButtonVariant: getCampaignNotesButtonVariant(viewMode, "list"),
		graphButtonVariant: getCampaignNotesButtonVariant(viewMode, "graph"),
	};
}

export function getCampaignNotesCollapsePatch(
	hasData: boolean,
	isCollapsed: boolean,
): CampaignNotesCollapsePatch | null {
	return hasData ? { isNotesCollapsed: !isCollapsed } : null;
}

export function getCampaignNotesViewModePlan(
	viewMode: CampaignNotesViewMode,
	isCollapsed: boolean,
): CampaignNotesViewModePlan {
	return {
		viewMode,
		collapsePatch: isCollapsed ? { isNotesCollapsed: false } : null,
	};
}

export function getCampaignHashTarget(hash: unknown): CampaignHashTarget | null {
	const value = String(hash || "");
	return CAMPAIGN_HASH_TARGETS.find(([marker]) => value.includes(marker))?.[1] ?? null;
}

const CAMPAIGN_HASH_TARGETS: readonly (readonly [string, CampaignHashTarget])[] = [
	["campaign-note", "notes"],
	["campaign-character", "characters"],
	["campaign-npc", "npc"],
	["campaign-location", "locations"],
];

export function getCampaignHashNavigationPlan(
	input: CampaignHashNavigationInput,
): CampaignHashNavigationPlan {
	const target = getCampaignHashTarget(input.hash);
	const isCollapsed = target ? input.collapsed[target] : false;
	return {
		target,
		shouldUseListView: target === "notes",
		sectionToExpand: target && isCollapsed ? target : null,
	};
}

export function executeCampaignHashNavigationPlan(
	plan: CampaignHashNavigationPlan,
	effects: CampaignHashNavigationEffects,
): void {
	if (plan.shouldUseListView) effects.useListView();
	if (plan.sectionToExpand) effects.expandSection(plan.sectionToExpand);
}

export function getCampaignEntityAiIgnoredUpdate(
	type: "npc" | "locations",
	entityId: DomainId | undefined,
	ignored: boolean,
	npcs: CampaignPageEntity[],
	locations: CampaignPageEntity[],
): CampaignEntityAiIgnoredUpdate {
	if (entityId === undefined) return { kind: "none" };
	const collection = { npc: npcs, locations }[type];
	const entity = collection.find((item) => item.id === entityId);
	if (!entity) return { kind: "none" };
	return {
		kind: type,
		entityId,
		entity: { ...entity, _aiIgnored: ignored },
	};
}

function getCampaignCharacterType(value: unknown): CampaignCharacterType | null {
	if (value === "characters") return "characters";
	return value === "npc" ? "npc" : null;
}

function getCampaignCharacterDropSourceType(
	payload: CampaignCharacterDropPayload | null | undefined,
): CampaignCharacterType | null {
	return payload?.kind === "campaign-character"
		? getCampaignCharacterType(payload.sourceType)
		: null;
}

function getCampaignCharacterDropId(value: unknown): DomainId | null {
	if (typeof value === "string") return value;
	return typeof value === "number" ? value : null;
}

interface CampaignCharacterDropCandidate {
	sourceType: CampaignCharacterType | null;
	targetType: CampaignCharacterType | null;
	id: DomainId | null;
}

function isCampaignCharacterDropRequest(
	candidate: CampaignCharacterDropCandidate,
): candidate is CampaignCharacterDropRequest {
	return (
		candidate.sourceType !== null &&
		candidate.targetType !== null &&
		candidate.id !== null
	);
}

export function getCampaignCharacterDropRequest(
	payload: CampaignCharacterDropPayload | null | undefined,
	targetType: unknown,
): CampaignCharacterDropRequest | null {
	const candidate: CampaignCharacterDropCandidate = {
		sourceType: getCampaignCharacterDropSourceType(payload),
		targetType: getCampaignCharacterType(targetType),
		id: getCampaignCharacterDropId(payload?.id),
	};
	return isCampaignCharacterDropRequest(candidate) ? candidate : null;
}

export function filterCampaignSessions(
	sessions: SessionRecord[] | null | undefined,
	query: string,
): CampaignSessionItem[] {
	const normalizedQuery = query.trim().toLowerCase();
	return (Array.isArray(sessions) ? sessions : []).filter(
		(session): session is CampaignSessionItem =>
			typeof session.fileName === "string" &&
			session.fileName.length > 0 &&
			(!normalizedQuery || session.name.toLowerCase().includes(normalizedQuery)),
	);
}

export function normalizeCampaignCardNotes(notes: unknown): CardNote[] {
	return (Array.isArray(notes) ? notes : [])
		.filter(
			(note): note is Record<string, unknown> & { id: DomainId } =>
				isRecord(note) &&
				(typeof note.id === "string" || typeof note.id === "number"),
		)
		.map((note) => ({
			...note,
			id: note.id,
			title: typeof note.title === "string" ? note.title : "",
			text: typeof note.text === "string" ? note.text : "",
			collapsed: Boolean(note.collapsed),
		}));
}

export function normalizeCampaignCardNote(note: unknown): CardNote {
	return normalizeCampaignCardNotes([note])[0] ?? {
		id: "preview-note",
		title: "",
		text: "",
		collapsed: false,
	};
}

export function toCharacterCardData(entity: CampaignPageEntity): CharacterData {
	return { ...entity, notes: normalizeCampaignCardNotes(entity.notes) };
}

export function toLocationCardData(entity: CampaignPageEntity): LocationData {
	return { ...entity, notes: normalizeCampaignCardNotes(entity.notes) };
}

export function getCampaignEntityId(entity: CampaignPageEntity): DomainId | null {
	return typeof entity.id === "string" || typeof entity.id === "number"
		? entity.id
		: null;
}

export function getCampaignEntityRenderKey(
	entity: CampaignPageEntity,
	index: number,
): DomainId {
	return getCampaignEntityId(entity) ?? entity.slug ?? `entity-${index}`;
}
