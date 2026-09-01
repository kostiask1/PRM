import type { HistoryFocusTarget } from "../api/historyApi.ts";

export const HISTORY_FOCUS_EVENT = "dnd:persistent-history-focus";
export const HISTORY_CARET_REQUEST_EVENT = "dnd:persistent-history-caret-request";

const LEXICAL_CARET_OWNER = "lexical";
const INVISIBLE_CARET_TEXT = /[\u200B\uFEFF]/u;

export interface HistoryCaretRequest {
	offset: number;
	valueRevision: string | null;
}

export interface HistoryFocusNavigation {
	campaignSlug: string | null;
	sessionFileName: string | null;
	encounterId: string | number | null;
	hash: string | null;
	fallbackHashes: string[];
	preserveCurrentRoute: boolean;
}

interface HistoryHashPlan {
	hash: string | null;
	fallbackHashes: string[];
}

export function getHistoryCaretValueRevision(value: string): string {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193) >>> 0;
	}
	return `${value.length}:${hash.toString(16).padStart(8, "0")}`;
}

function normalizeTargetPart(value: string): string {
	return value.replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-");
}

export function makeHistoryTargetId(
	scope: string,
	kind: string,
	...identityParts: unknown[]
): string {
	const prefix = `history-${normalizeTargetPart(scope)}-${normalizeTargetPart(kind)}`;
	if (identityParts.length === 0) return prefix;
	const identities = identityParts.map((part) => {
		const encoded = encodeURIComponent(String(part));
		return `${encoded.length}:${encoded}`;
	});
	return `${prefix}--${identities.join("--")}`;
}

function hasIdentity(value: unknown): value is string | number {
	return value !== null && value !== undefined && String(value) !== "";
}

function entityMarker(type: string | null | undefined): string {
	if (type === "characters") return "character";
	if (type === "locations") return "location";
	return "npc";
}

function plan(hash: string | null, ...fallbackHashes: Array<string | null>): HistoryHashPlan {
	return {
		hash,
		fallbackHashes: fallbackHashes.filter(
			(value): value is string => Boolean(value && value !== hash),
		),
	};
}

function campaignHash(target: HistoryFocusTarget): HistoryHashPlan {
	if (target.resource === "campaign-list") {
		const campaignTarget = target.exists && target.campaignSlug
			? makeHistoryTargetId("sidebar", "campaign", target.campaignSlug)
			: null;
		return plan(campaignTarget || makeHistoryTargetId("sidebar", "campaigns"));
	}
	if (target.resource === "campaign-sessions") {
		return plan(makeHistoryTargetId("campaign", "sessions"));
	}
	if (
		target.resource === "entity" ||
		(Boolean(target.entityType) && !target.sessionFileName)
	) {
		const marker = entityMarker(target.entityType);
		const entityId = target.entityId ?? target.resourceId ?? target.entitySlug;
		const section = makeHistoryTargetId("campaign", `${marker}-section`);
		if (!hasIdentity(entityId)) return plan(section);
		const entity = makeHistoryTargetId("campaign", marker, entityId);
		if (hasIdentity(target.noteId)) {
			return plan(
				target.noteExists !== false
					? makeHistoryTargetId(
						"campaign",
						`${marker}-note`,
						entityId,
						target.noteId,
					)
					: entity,
				entity,
				section,
			);
		}
		return target.exists ? plan(entity, section) : plan(section);
	}
	if (hasIdentity(target.noteId)) {
		const section = makeHistoryTargetId("campaign", "notes");
		return target.noteExists !== false
			? plan(makeHistoryTargetId("campaign", "note", target.noteId), section)
			: plan(section);
	}
	if (target.field === "notes") {
		return plan(makeHistoryTargetId("campaign", "notes"));
	}
	if (target.field === "description") {
		return plan(makeHistoryTargetId("campaign", "description"));
	}
	return plan(makeHistoryTargetId("campaign", "summary"));
}

function sessionEntityHash(target: HistoryFocusTarget): HistoryHashPlan {
	const marker = entityMarker(target.entityType);
	const entityId = target.entityId ?? target.resourceId ?? target.entitySlug;
	const section = makeHistoryTargetId("session", `${marker}-section`);
	if (!hasIdentity(entityId)) return plan(section);
	const entity = makeHistoryTargetId("session", marker, entityId);
	if (hasIdentity(target.noteId)) {
		return plan(
			target.noteExists !== false
				? makeHistoryTargetId(
					"session",
					`${marker}-note`,
					entityId,
					target.noteId,
				)
				: entity,
			entity,
			section,
		);
	}
	return target.exists ? plan(entity, section) : plan(section);
}

function sessionHash(target: HistoryFocusTarget): HistoryHashPlan {
	if (target.resource === "session-entity") return sessionEntityHash(target);
	if (hasIdentity(target.sceneId)) {
		const section = makeHistoryTargetId("session", "scenes");
		const scene = makeHistoryTargetId("session", "scene", target.sceneId);
		if (target.sceneExists === false) return plan(section);
		if (hasIdentity(target.noteId)) {
			return plan(
				target.noteExists !== false
					? makeHistoryTargetId(
						"session",
						"scene-note",
						target.sceneId,
						target.noteId,
					)
					: scene,
				scene,
				section,
			);
		}
		return plan(scene, section);
	}
	if (hasIdentity(target.noteId)) {
		const section = makeHistoryTargetId("session", "notes");
		return target.noteExists !== false
			? plan(makeHistoryTargetId("session", "note", target.noteId), section)
			: plan(section);
	}
	if (target.field === "notes") {
		return plan(makeHistoryTargetId("session", "notes"));
	}
	if (target.field === "scenes" || target.resource === "encounter") {
		return plan(makeHistoryTargetId("session", "scenes"));
	}
	if (target.field === "npcs") {
		return plan(makeHistoryTargetId("session", "npc-section"));
	}
	if (target.field === "locations") {
		return plan(makeHistoryTargetId("session", "location-section"));
	}
	return plan(makeHistoryTargetId("session", "summary"));
}

function encounterHash(target: HistoryFocusTarget): HistoryHashPlan {
	const summary = makeHistoryTargetId("encounter", "summary");
	if (
		target.participantExists !== false &&
		hasIdentity(target.participantInstanceId)
	) {
		return plan(
			makeHistoryTargetId(
				"encounter",
				"participant",
				target.participantInstanceId,
			),
			summary,
		);
	}
	return plan(summary);
}

export function getHistoryFocusNavigation(
	target: HistoryFocusTarget,
): HistoryFocusNavigation {
	const preserveCurrentRoute = Boolean(target.preserveRoute);
	const campaignSlug = target.resource === "campaign-list"
		? null
		: target.campaignSlug;
	const canOpenSession = Boolean(
		campaignSlug &&
		hasIdentity(target.sessionFileName) &&
		target.resource !== "campaign-sessions" &&
		!(target.resource === "session" && target.resourceExists === false),
	);
	const sessionFileName = canOpenSession ? target.sessionFileName ?? null : null;
	const canOpenEncounter = Boolean(
		sessionFileName &&
		hasIdentity(target.encounterId) &&
		target.encounterExists !== false,
	);
	const hashPlan = canOpenEncounter
		? encounterHash(target)
		: sessionFileName
			? sessionHash(target)
			: campaignHash(target);
	return {
		campaignSlug,
		sessionFileName,
		encounterId: canOpenEncounter ? target.encounterId ?? null : null,
		...hashPlan,
		preserveCurrentRoute,
	};
}

function historyTargetIdFromHash(hash: string): string {
	try {
		return decodeURIComponent(String(hash || "").replace(/^#/, ""));
	} catch {
		return String(hash || "").replace(/^#/, "");
	}
}

export function matchesHistoryTargetId(
	hash: string,
	scope: string,
	kind: string,
	...identityParts: unknown[]
): boolean {
	const expected = makeHistoryTargetId(scope, kind, ...identityParts);
	const raw = String(hash || "").replace(/^#/, "");
	const candidates = new Set([raw, historyTargetIdFromHash(raw)]);
	return [...candidates].some(
		(actual) => actual === expected || actual.startsWith(`${expected}--`),
	);
}

export function findHistoryTargetElement(
	hash: string,
): HTMLElement | null {
	if (typeof document === "undefined") return null;
	const targetId = historyTargetIdFromHash(hash);
	if (!targetId) return null;
	const direct = document.getElementById(targetId);
	if (direct) return direct;
	for (const candidate of document.querySelectorAll<HTMLElement>(
		"[data-history-focus-id]",
	)) {
		if (candidate.dataset.historyFocusId === targetId) return candidate;
	}
	return null;
}

function findHistoryFieldElement(
	container: HTMLElement,
	field: string,
): HTMLElement | null {
	const candidates = [
		container,
		...container.querySelectorAll<HTMLElement>("[data-history-field]"),
	];
	const fieldContainer = candidates.find(
		(candidate) => candidate.dataset.historyField === field,
	);
	if (!fieldContainer) return null;
	if (
		fieldContainer.matches("input, textarea, [contenteditable='true']")
	) {
		return fieldContainer;
	}
	return fieldContainer.querySelector<HTMLElement>(
		"input, textarea, [contenteditable='true'], [role='textbox']",
	);
}

function visibleTextLength(value: string): number {
	let length = 0;
	for (const character of value) {
		if (!INVISIBLE_CARET_TEXT.test(character)) length += character.length;
	}
	return length;
}

function textNodeOffsetForVisibleOffset(value: string, offset: number): number {
	let visibleOffset = 0;
	let nodeOffset = 0;
	while (nodeOffset < value.length && visibleOffset < offset) {
		const codePoint = value.codePointAt(nodeOffset);
		if (codePoint === undefined) break;
		const character = String.fromCodePoint(codePoint);
		nodeOffset += character.length;
		if (!INVISIBLE_CARET_TEXT.test(character)) {
			visibleOffset += character.length;
		}
	}
	return nodeOffset;
}

function setDomContentEditableCaret(element: HTMLElement, offset: number): void {
	const selection = window.getSelection();
	if (!selection) return;
	const range = document.createRange();
	const walker = document.createTreeWalker(element, 4);
	let remaining = Math.max(0, offset);
	let node = walker.nextNode();
	while (node) {
		const text = node.textContent || "";
		const length = visibleTextLength(text);
		if (remaining <= length) {
			range.setStart(
				node,
				textNodeOffsetForVisibleOffset(text, remaining),
			);
			range.collapse(true);
			selection.removeAllRanges();
			selection.addRange(range);
			return;
		}
		remaining -= length;
		node = walker.nextNode();
	}
	range.selectNodeContents(element);
	range.collapse(false);
	selection.removeAllRanges();
	selection.addRange(range);
}

function setContentEditableCaret(
	element: HTMLElement,
	offset: number,
	valueRevision: string | null,
): boolean {
	const owner = element.dataset.historyCaretOwner;
	if (
		owner === LEXICAL_CARET_OWNER &&
		valueRevision &&
		element.dataset.historyCaretRevision !== valueRevision
	) {
		return false;
	}
	if (typeof element.dispatchEvent === "function") {
		const request = new CustomEvent<HistoryCaretRequest>(
			HISTORY_CARET_REQUEST_EVENT,
			{
				cancelable: true,
				detail: { offset, valueRevision },
			},
		);
		if (!element.dispatchEvent(request)) return true;
	}
	if (owner === LEXICAL_CARET_OWNER) return false;
	setDomContentEditableCaret(element, offset);
	return true;
}

export function focusHistoryTargetField(
	hash: string,
	field: string | null | undefined,
	caretOffset: number | null | undefined,
	caretValueRevision: string | null | undefined = null,
): boolean {
	if (!field || typeof window === "undefined") return false;
	const container = findHistoryTargetElement(hash);
	if (!container) return false;
	const editable = findHistoryFieldElement(container, field);
	if (!editable) return false;
	editable.focus({ preventScroll: true });
	const offset = Number.isSafeInteger(caretOffset)
		? Math.max(0, Number(caretOffset))
		: null;
	if (offset !== null && "setSelectionRange" in editable) {
		try {
			const valueLength = String(
				(editable as HTMLInputElement | HTMLTextAreaElement).value || "",
			).length;
			const clamped = Math.min(offset, valueLength);
			(editable as HTMLInputElement | HTMLTextAreaElement).setSelectionRange(
				clamped,
				clamped,
			);
		} catch {
			// Number inputs can be focused but do not support text selections.
		}
	} else if (offset !== null && editable.isContentEditable) {
		if (
			!setContentEditableCaret(
				editable,
				offset,
				caretValueRevision || null,
			)
		) {
			return false;
		}
	}
	editable.classList.add("is_history_focus_field");
	window.setTimeout(() => {
		editable.classList.remove("is_history_focus_field");
	}, 2200);
	return true;
}

export function scrollToHistoryTarget(hash: string): boolean {
	const target = findHistoryTargetElement(hash);
	if (!target) return false;
	target.scrollIntoView({ behavior: "smooth", block: "center" });
	target.classList.add("is_history_focus_target");
	window.setTimeout(() => {
		target.classList.remove("is_history_focus_target");
	}, 2200);
	return true;
}

export function publishHistoryFocus(target: HistoryFocusTarget | null | undefined): void {
	if (!target || typeof window === "undefined") return;
	window.dispatchEvent(
		new CustomEvent<HistoryFocusTarget>(HISTORY_FOCUS_EVENT, {
			detail: target,
		}),
	);
}
