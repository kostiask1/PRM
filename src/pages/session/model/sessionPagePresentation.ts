import type { SessionEncounter, SessionScene } from "../../../entities/session/index.js";
import type { SharedNote } from "../../../shared/lib/index.js";
import type { SessionSyncEvent } from "./contracts.ts";
import type { SessionEntityType } from "./sessionEntityModel.ts";

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

export interface SessionEncounterLink {
	id: string | number;
	name: string;
	sceneNumber: number | null;
}

export interface SessionScopeImportCopy {
	title: string;
	emptyText: string;
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

export function getSessionSyncAction(
	event: SessionSyncEvent | null | undefined,
	campaignSlug: string,
	sessionFileName: string,
	hasPendingSave: boolean,
): SessionSyncAction {
	if (!event?.version) return "ignore";
	if (!matchesSessionSyncScope(event, campaignSlug, sessionFileName)) return "ignore";
	if (!isSessionReloadResource(event.resource)) return "ignore";
	if (event.resource === "ai") return "discard-and-reload";
	return hasPendingSave ? "ignore" : "reload";
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

function isSessionReloadResource(resource: unknown): boolean {
	return ["sessions", "ai", "import", "entities", "images"].includes(
		String(resource || ""),
	);
}

export function hasSessionNoteContent(notes: readonly SharedNote[] = []): boolean {
	return notes.some(
		(note) =>
			String(note?.title || "").trim().length > 0 ||
			String(note?.text || "").trim().length > 0,
	);
}

export function getSessionSectionCollapsed(
	hasContent: boolean,
	storedCollapsed: unknown,
): boolean {
	return hasContent && Boolean(storedCollapsed);
}

export function getSessionEncounterLinks(
	scenes: readonly SessionScene[] = [],
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
	scenes: readonly SessionScene[],
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
