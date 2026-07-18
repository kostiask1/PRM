export interface EditorMentionEntity extends Record<string, unknown> {
	id?: string | number;
	type?: string;
	name?: string;
	firstName?: string;
	lastName?: string;
}

export interface MentionEntityGroup {
	key: "characters" | "npc" | "locations";
	label: string;
	items: EditorMentionEntity[];
}

export function filterMentionEntities(
	entities: EditorMentionEntity[],
	query: string,
): EditorMentionEntity[] {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) return entities;
	return entities.filter((entity) => {
		const name = String(entity.name || "").toLowerCase();
		const firstName = String(entity.firstName || "").toLowerCase();
		const lastName = String(entity.lastName || "").toLowerCase();
		return [name, firstName, lastName, `${firstName} ${lastName}`.trim()].some(
			(value) => value.includes(normalizedQuery),
		);
	});
}

export function groupMentionEntities(
	entities: EditorMentionEntity[],
): MentionEntityGroup[] {
	return [
		{
			key: "characters",
			label: "Characters",
			items: entities.filter((entity) => entity.type === "characters"),
		},
		{
			key: "npc",
			label: "NPCs",
			items: entities.filter((entity) => entity.type === "npc"),
		},
		{
			key: "locations",
			label: "Locations/Factions",
			items: entities.filter((entity) => entity.type === "locations"),
		},
	];
}

export interface InputSelectionPreview {
	index?: number;
	previewOffset?: number;
	previewToRaw?: number[];
}

export function resolveInitialCursorPosition(
	initialSelection: number | InputSelectionPreview | null | undefined,
	rawValue = "",
): number {
	if (initialSelection == null) return rawValue.length;
	if (typeof initialSelection === "number") {
		return clampCursorPosition(initialSelection, rawValue.length);
	}
	if (typeof initialSelection.index === "number") {
		return clampCursorPosition(initialSelection.index, rawValue.length);
	}
	return resolvePreviewCursorPosition(initialSelection, rawValue.length);
}

function clampCursorPosition(position: number, valueLength: number): number {
	return Math.min(Math.max(0, position), valueLength);
}

function resolvePreviewCursorPosition(
	initialSelection: InputSelectionPreview,
	valueLength: number,
): number {
	const { previewOffset, previewToRaw } = initialSelection;
	if (typeof previewOffset !== "number" || !Array.isArray(previewToRaw)) {
		return valueLength;
	}
	if (previewToRaw.length === 0) return 0;
	if (previewOffset <= 0) return Math.max(0, previewToRaw[0] ?? 0);
	if (previewOffset >= previewToRaw.length) return valueLength;
	return clampCursorPosition(
		previewToRaw[previewOffset] ?? valueLength,
		valueLength,
	);
}

export function supportsSelectionRange(type: string): boolean {
	return [
		"textarea",
		"text",
		"search",
		"tel",
		"url",
		"password",
		"email",
	].includes(type);
}

export function isRangeInsideSquareBrackets(
	value = "",
	start = 0,
	end = start,
): boolean {
	const openIndex = value.lastIndexOf("[", Math.max(0, start - 1));
	if (openIndex === -1) return false;
	const closeIndex = value.indexOf("]", openIndex + 1);
	return closeIndex !== -1 && start > openIndex && end <= closeIndex;
}

export type InputShortcutAction =
	| { kind: "tab" }
	| { kind: "mention" }
	| { kind: "format"; marker: "*" | "**" }
	| { kind: "list"; add: boolean }
	| { kind: "heading"; level: number }
	| { kind: "quote" }
	| null;

const INPUT_MODIFIED_SHORTCUTS: Readonly<
	Record<string, Exclude<InputShortcutAction, null | { kind: "tab" } | { kind: "heading"; level: number }>>
> = Object.freeze({
	k: { kind: "mention" },
	л: { kind: "mention" },
	b: { kind: "format", marker: "**" },
	и: { kind: "format", marker: "**" },
	i: { kind: "format", marker: "*" },
	ш: { kind: "format", marker: "*" },
	"]": { kind: "list", add: true },
	ї: { kind: "list", add: true },
	"[": { kind: "list", add: false },
	х: { kind: "list", add: false },
	q: { kind: "quote" },
	й: { kind: "quote" },
});

export function getInputShortcutAction({
	ctrlKey,
	key,
	metaKey,
	type,
}: {
	ctrlKey: boolean;
	key: string;
	metaKey: boolean;
	type: string;
}): InputShortcutAction {
	if (type !== "textarea") return null;
	const normalizedKey = key.toLowerCase();
	if (normalizedKey === "tab") return { kind: "tab" };
	if (!ctrlKey && !metaKey) return null;
	const mappedAction = INPUT_MODIFIED_SHORTCUTS[normalizedKey];
	if (mappedAction) return mappedAction;
	if (/^[1-6]$/.test(normalizedKey)) {
		return { kind: "heading", level: Number(normalizedKey) };
	}
	return null;
}

export interface InputTextEdit {
	value: string;
	selectionStart: number;
	selectionEnd: number;
}

export function insertInputTab(
	value: string,
	selectionStart: number,
	selectionEnd: number,
): InputTextEdit {
	return {
		value: `${value.substring(0, selectionStart)}\t${value.substring(selectionEnd)}`,
		selectionStart: selectionStart + 1,
		selectionEnd: selectionStart + 1,
	};
}

export function toggleInputMention(
	value: string,
	selectionStart: number,
	selectionEnd: number,
): InputTextEdit {
	const selection = value.substring(selectionStart, selectionEnd);
	const wrappedSelection =
		selection.startsWith("[") &&
		selection.endsWith("]") &&
		selection.length >= 2;
	if (wrappedSelection) {
		return {
			value:
				value.substring(0, selectionStart) +
				selection.substring(1, selection.length - 1) +
				value.substring(selectionEnd),
			selectionStart,
			selectionEnd: selectionEnd - 2,
		};
	}
	const wrappedAround =
		selectionStart > 0 &&
		selectionEnd < value.length &&
		value[selectionStart - 1] === "[" &&
		value[selectionEnd] === "]";
	if (wrappedAround) {
		return {
			value:
				value.substring(0, selectionStart - 1) +
				selection +
				value.substring(selectionEnd + 1),
			selectionStart: selectionStart - 1,
			selectionEnd: selectionEnd - 1,
		};
	}
	return {
		value:
			value.substring(0, selectionStart) +
			"[" +
			selection +
			"]" +
			value.substring(selectionEnd),
		selectionStart: selectionStart + 1,
		selectionEnd: selectionEnd + 1,
	};
}

export function toggleInputFormat(
	value: string,
	selectionStart: number,
	selectionEnd: number,
	marker: "*" | "**",
): InputTextEdit {
	const selection = value.substring(selectionStart, selectionEnd);
	if (isInputFormatWrappedInside(selection, marker)) {
		return {
			value:
				value.substring(0, selectionStart) +
				selection.substring(marker.length, selection.length - marker.length) +
				value.substring(selectionEnd),
			selectionStart,
			selectionEnd: selectionEnd - marker.length * 2,
		};
	}
	if (isInputFormatWrappedOutside(value, selectionStart, selectionEnd, marker)) {
		return {
			value:
				value.substring(0, selectionStart - marker.length) +
				selection +
				value.substring(selectionEnd + marker.length),
			selectionStart: selectionStart - marker.length,
			selectionEnd: selectionEnd - marker.length,
		};
	}
	return {
		value:
			value.substring(0, selectionStart) +
			marker +
			selection +
			marker +
			value.substring(selectionEnd),
		selectionStart: selectionStart + marker.length,
		selectionEnd: selectionEnd + marker.length,
	};
}

function isInputFormatWrappedInside(
	selection: string,
	marker: "*" | "**",
): boolean {
	const italicConflict =
		marker === "*" &&
		selection.startsWith("**") &&
		!selection.startsWith("***");
	return (
		selection.startsWith(marker) &&
		selection.endsWith(marker) &&
		selection.length >= marker.length * 2 &&
		!italicConflict
	);
}

function isInputFormatWrappedOutside(
	value: string,
	selectionStart: number,
	selectionEnd: number,
	marker: "*" | "**",
): boolean {
	const italicConflict =
		marker === "*" &&
		value.substring(selectionStart - 2, selectionStart) === "**" &&
		value.substring(selectionStart - 3, selectionStart) !== "***";
	return (
		selectionStart >= marker.length &&
		value.substring(selectionStart - marker.length, selectionStart) === marker &&
		value.substring(selectionEnd, selectionEnd + marker.length) === marker &&
		!italicConflict
	);
}

type InputBlockEdit =
	| { kind: "list"; add: boolean }
	| { kind: "heading"; level: number }
	| { kind: "quote" };

function transformInputLine(
	line: string,
	edit: InputBlockEdit,
): { line: string; shift: number } {
	if (edit.kind === "list") {
		if (edit.add) return { line: `- ${line}`, shift: 2 };
		return line.startsWith("- ")
			? { line: line.slice(2), shift: -2 }
			: { line, shift: 0 };
	}
	if (edit.kind === "quote") {
		return line.startsWith("> ")
			? { line: line.slice(2), shift: -2 }
			: { line: `> ${line}`, shift: 2 };
	}
	const marker = `${"#".repeat(edit.level)} `;
	const existing = line.match(/^#{1,6} /)?.[0];
	if (!existing) return { line: marker + line, shift: marker.length };
	if (existing === marker) {
		return { line: line.slice(existing.length), shift: -existing.length };
	}
	return {
		line: marker + line.slice(existing.length),
		shift: marker.length - existing.length,
	};
}

export function applyInputBlockEdit(
	value: string,
	selectionStart: number,
	selectionEnd: number,
	edit: InputBlockEdit,
): InputTextEdit {
	const firstLineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
	const nextLineStart = value.indexOf("\n", selectionEnd);
	const lastLineEnd = nextLineStart === -1 ? value.length : nextLineStart;
	let firstLineShift = 0;
	let totalShift = 0;
	const lines = value
		.substring(firstLineStart, lastLineEnd)
		.split("\n")
		.map((line, index) => {
			const result = transformInputLine(line, edit);
			if (index === 0) firstLineShift = result.shift;
			totalShift += result.shift;
			return result.line;
		});
	return {
		value:
			value.substring(0, firstLineStart) +
			lines.join("\n") +
			value.substring(lastLineEnd),
		selectionStart: selectionStart + firstLineShift,
		selectionEnd: selectionEnd + totalShift,
	};
}

export type EditableFieldType = "text" | "textarea";

export function normalizeEditableText(value: unknown = ""): string {
	return String(value || "")
		.replace(/\u200B/g, "")
		.replace(/\uFEFF/g, "")
		.replace(/\u00A0/g, " ");
}

export function normalizeEditableMarkdown(
	value: unknown = "",
	type: EditableFieldType = "textarea",
): string {
	const normalized = normalizeEditableText(value).replace(/\r\n?/g, "\n");
	if (type !== "textarea") return normalized.replace(/\n+/g, " ").trim();
	return normalized
		.split("\n")
		.map((line) => line.replace(/ +$/g, ""))
		.join("\n")
		.replace(/^\n+|\n+$/g, "");
}

export type EditableShortcutAction =
	| "delegate"
	| "blur"
	| "tab"
	| "space-after-mention"
	| "bold"
	| "italic"
	| "mention"
	| "list"
	| "outdent"
	| "quote"
	| `heading-${1 | 2 | 3 | 4 | 5 | 6}`;

const EDITABLE_CODE_SHORTCUTS: Readonly<Record<string, EditableShortcutAction>> =
	Object.freeze({
		KeyB: "bold",
		KeyI: "italic",
		KeyK: "mention",
		BracketRight: "list",
		BracketLeft: "outdent",
		KeyQ: "quote",
	});

export function getEditableShortcutAction({
	code,
	ctrlKey,
	enableHistory,
	isDisabled,
	key,
	metaKey,
	type,
}: {
	code: string;
	ctrlKey: boolean;
	enableHistory: boolean;
	isDisabled: boolean;
	key: string;
	metaKey: boolean;
	type: EditableFieldType;
}): EditableShortcutAction | null {
	const modified = ctrlKey || metaKey;
	if (shouldDelegateEditableHistory(code, modified, enableHistory)) {
		return "delegate";
	}
	if (isDisabled) return "delegate";
	if (type !== "textarea") return getSingleLineEditableAction(key, modified);
	return getTextareaEditableAction(code, key, modified);
}

export function shouldDelegateEditableHistory(
	code: string,
	modified: boolean,
	enableHistory: boolean,
): boolean {
	return !enableHistory && modified && (code === "KeyZ" || code === "KeyY");
}

function getSingleLineEditableAction(
	key: string,
	modified: boolean,
): EditableShortcutAction | null {
	if (key === "Enter") return "blur";
	return modified ? "delegate" : null;
}

function getTextareaEditableAction(
	code: string,
	key: string,
	modified: boolean,
): EditableShortcutAction | null {
	if (key.toLowerCase() === "tab") return "tab";
	if (key === " ") return "space-after-mention";
	if (!modified) return null;
	const mappedAction = EDITABLE_CODE_SHORTCUTS[code];
	if (mappedAction) return mappedAction;
	if (/^[1-6]$/.test(key)) return `heading-${key}` as EditableShortcutAction;
	return null;
}
