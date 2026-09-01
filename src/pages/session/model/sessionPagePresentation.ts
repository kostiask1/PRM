import type {
	SessionEncounter,
	SessionScene as SessionViewScene,
} from "../../../entities/session/index.js";
import { getNotesForRender } from "../../../shared/lib/index.js";
import type { SharedNote } from "../../../shared/lib/index.js";
import type {
	SessionPageData,
	SessionPageSession,
	SessionSceneRecord,
	SessionSyncEvent,
} from "./contracts.ts";
import {
	normalizeSessionEntities,
	type SessionEntityType,
} from "./sessionEntityModel.ts";

export type SessionKeyboardAction = "back" | "undo" | "redo" | "none";
export type SessionSyncAction = "ignore" | "reload" | "discard-and-reload";

export interface SessionKeyboardInput {
	key: string;
	code: string;
	shiftKey: boolean;
	isHistoryShortcut: boolean;
	shouldUseAppHistory: boolean;
	isEditableTarget: boolean;
}

export interface SessionEditableTarget {
	tagName?: unknown;
	isContentEditable?: unknown;
}

export interface SessionEncounterLink {
	id: string | number;
	name: string;
	sceneNumber: number | null;
}

export interface SessionScopeImportCopy {
	title: string;
	emptyText: string;
}

export interface SessionScopeImportPresentation {
	type: SessionEntityType;
	copy: SessionScopeImportCopy | null;
}

export interface SessionSceneNotesPresentation {
	notes: SharedNote[];
	renderableNotes: ReturnType<typeof getNotesForRender>;
	hasData: boolean;
	isCollapsed: boolean;
	showBulkAction: boolean;
	showList: boolean;
	bulkActionShouldCollapse: boolean;
	bulkActionTitleKey: "Collapse all items" | "Expand all items";
	bulkActionLabelKey: "Collapse all" | "Expand all";
}

export type SessionTranslate = (
	key: string,
	params?: Record<string, unknown>,
) => string;

export function getSessionKeyboardAction({
	key,
	code,
	shiftKey,
	isHistoryShortcut,
	shouldUseAppHistory,
	isEditableTarget,
}: SessionKeyboardInput): SessionKeyboardAction {
	if (shouldNavigateBack(key, isEditableTarget)) return "back";
	if (shouldKeepNativeHistory(isHistoryShortcut, isEditableTarget, shouldUseAppHistory)) {
		return "none";
	}
	return getHistoryKeyboardAction(isHistoryShortcut, code, shiftKey);
}

function shouldNavigateBack(key: string, isEditableTarget: boolean): boolean {
	return !isEditableTarget && (key === "Backspace" || key === "Escape");
}

function shouldKeepNativeHistory(
	isHistoryShortcut: boolean,
	isEditableTarget: boolean,
	shouldUseAppHistory: boolean,
): boolean {
	return isHistoryShortcut && isEditableTarget && !shouldUseAppHistory;
}

function getHistoryKeyboardAction(
	isHistoryShortcut: boolean,
	code: string,
	shiftKey: boolean,
): SessionKeyboardAction {
	if (!isHistoryShortcut) return "none";
	if (code === "KeyZ") return shiftKey ? "redo" : "undo";
	return code === "KeyY" ? "redo" : "none";
}

export function isSessionEditableTarget(
	target: SessionEditableTarget | null | undefined,
): boolean {
	return ["INPUT", "TEXTAREA"].includes(String(target?.tagName || "")) ||
		Boolean(target?.isContentEditable);
}

type SessionSyncResourcePolicy = "ignore" | "reload" | "discard-and-reload";

const SESSION_SYNC_RESOURCE_POLICIES: Record<string, SessionSyncResourcePolicy> = {
	sessions: "reload",
	ai: "discard-and-reload",
	import: "reload",
	entities: "reload",
	images: "reload",
	history: "reload",
};

export function getSessionSyncAction(
	event: SessionSyncEvent | null | undefined,
	campaignSlug: string,
	sessionFileName: string,
	hasPendingSave: boolean,
): SessionSyncAction {
	if (!event?.version) return "ignore";
	if (!matchesSessionSyncScope(event, campaignSlug, sessionFileName)) return "ignore";
	return applySessionSyncPendingPolicy(
		getSessionSyncResourcePolicy(event.resource),
		hasPendingSave,
	);
}

function matchesSessionSyncScope(
	event: SessionSyncEvent,
	campaignSlug: string,
	sessionFileName: string,
): boolean {
	if (event.campaignSlug && event.campaignSlug !== campaignSlug) return false;
	if (!event.sessionFileName) return true;
	return String(event.sessionFileName) === String(sessionFileName);
}

function getSessionSyncResourcePolicy(resource: unknown): SessionSyncResourcePolicy {
	return SESSION_SYNC_RESOURCE_POLICIES[String(resource || "")] || "ignore";
}

function applySessionSyncPendingPolicy(
	policy: SessionSyncResourcePolicy,
	hasPendingSave: boolean,
): SessionSyncAction {
	if (policy !== "reload") return policy;
	return hasPendingSave ? "ignore" : "reload";
}

export function hasSessionNoteContent(notes: readonly SharedNote[] = []): boolean {
	return notes.some(hasSessionNoteText);
}

function hasSessionNoteText(note: SharedNote): boolean {
	return hasSessionTextValue(note?.title) || hasSessionTextValue(note?.text);
}

function hasSessionTextValue(value: unknown): boolean {
	return String(value || "").trim().length > 0;
}

export function getSessionSectionCollapsed(
	hasContent: boolean,
	storedCollapsed: unknown,
): boolean {
	return hasContent && Boolean(storedCollapsed);
}

export function getSessionEncounterLinks(
	scenes: readonly SessionViewScene[] = [],
	encounters: readonly SessionEncounter[] = [],
	untitledLabel: string,
): SessionEncounterLink[] {
	const sceneNumbers = getEncounterSceneNumbers(scenes);
	return encounters.map((encounter) => ({
		id: encounter.id,
		name: encounter.name || untitledLabel,
		sceneNumber: sceneNumbers.get(String(encounter.id)) ?? null,
	}));
}

function getEncounterSceneNumbers(
	scenes: readonly SessionViewScene[],
): ReadonlyMap<string, number> {
	const result = new Map<string, number>();
	scenes.forEach((scene, index) => {
		if (scene.encounterId == null) return;
		const id = String(scene.encounterId);
		if (!result.has(id)) result.set(id, index + 1);
	});
	return result;
}

export function getSessionScopeImportCopy(
	type: SessionEntityType,
	translate: SessionTranslate,
): SessionScopeImportCopy {
	if (type === "locations") {
		return {
			title: translate("Choose location/faction to move into this session"),
			emptyText: translate("No campaign locations/factions available."),
		};
	}
	return {
		title: translate("Choose NPC to move into this session"),
		emptyText: translate("No campaign NPCs available."),
	};
}

export function getSessionScopeImportPresentation(
	modal: { type?: unknown } | null | undefined,
	translate: SessionTranslate,
): SessionScopeImportPresentation {
	const type: SessionEntityType = modal?.type === "locations" ? "locations" : "npc";
	return {
		type,
		copy: modal ? getSessionScopeImportCopy(type, translate) : null,
	};
}

export function getSessionPageData(
	session: SessionPageSession | null | undefined,
): SessionPageData {
	return session?.data || {};
}

export function normalizeSessionPageSession(
	value: unknown,
): SessionPageSession {
	const source = value && typeof value === "object"
		? (value as SessionPageSession)
		: {};
	if (!source.data) return source;
	return {
		...source,
		data: {
			...source.data,
			notes: source.data.notes || [],
			scenes: normalizeSessionPageScenes(source.data.scenes),
			npcs: normalizeSessionEntities("npc", source.data.npcs),
			locations: normalizeSessionEntities("locations", source.data.locations),
		},
	};
}

function normalizeSessionPageScenes(
	scenes: SessionSceneRecord[] | null | undefined,
): SessionSceneRecord[] {
	return (scenes || []).map(normalizeSessionPageScene);
}

function normalizeSessionPageScene(scene: SessionSceneRecord): SessionSceneRecord {
	return {
		...scene,
		notes: scene.notes || [],
		isNotesCollapsed: Boolean(scene.isNotesCollapsed),
	};
}

export function getSessionRenamePlan(
	promptValue: unknown,
	currentName: unknown,
): { kind: "cancelled" } | { kind: "rename"; name: string } {
	if (typeof promptValue !== "string") return { kind: "cancelled" };
	if (!promptValue || promptValue === currentName) return { kind: "cancelled" };
	return { kind: "rename", name: promptValue };
}

export function executeSessionRenamePlan(
	plan: ReturnType<typeof getSessionRenamePlan>,
	onRename: (name: string) => void,
): "renamed" | "cancelled" {
	if (plan.kind === "cancelled") return "cancelled";
	onRename(plan.name);
	return "renamed";
}

export function getSessionSceneNotesPresentation(
	notesValue: SharedNote[] | null | undefined,
	storedCollapsed: unknown,
	simplifiedNotes: boolean,
): SessionSceneNotesPresentation {
	const notes = notesValue || [];
	const renderableNotes = getNotesForRender(notes, { simplifiedNotes });
	const hasData = hasSessionNoteContent(notes);
	const isCollapsed = getSessionSectionCollapsed(hasData, storedCollapsed);
	const bulkActionShouldCollapse = renderableNotes.some(
		shouldCollapseSessionSceneNote,
	);
	return {
		notes,
		renderableNotes,
		hasData,
		isCollapsed,
		showBulkAction: !isCollapsed && notes.length > 0,
		showList: !isCollapsed,
		bulkActionShouldCollapse,
		bulkActionTitleKey: bulkActionShouldCollapse
			? "Collapse all items"
			: "Expand all items",
		bulkActionLabelKey: bulkActionShouldCollapse ? "Collapse all" : "Expand all",
	};
}

function shouldCollapseSessionSceneNote(
	note: ReturnType<typeof getNotesForRender>[number],
): boolean {
	return !note._isVirtual && !note.collapsed;
}

export function getSceneNotesWithCollapsedState(
	notes: readonly SharedNote[],
	collapsed: boolean,
): SharedNote[] {
	return notes.map((note) => ({ ...note, collapsed }));
}

export function shouldExpandSessionNotesFromHash(
	hash: string,
	isCollapsed: boolean,
): boolean {
	return isCollapsed && decodeURIComponent(hash || "").includes("session-note");
}
