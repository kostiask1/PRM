import type { MentionSelectionResult } from "../model/mentionPicker.ts";

export interface EditorMentionEntity extends Record<string, unknown> {
	id?: string | number;
	type?: string;
	name?: string;
	firstName?: string;
	lastName?: string;
}

export interface EditableFieldChangeEvent {
	target: { value: string; [key: string]: unknown };
	currentTarget?: { value: string; [key: string]: unknown };
	[key: string]: unknown;
}

interface EditableModifierSource {
	ctrlKey: unknown;
	metaKey: unknown;
}

interface EditableClosestTarget {
	closest(selector: string): unknown;
}

interface EditableMentionTarget {
	dataset: {
		mention?: string;
	};
}

export type EditableClickPlan<Mention> =
	| {
			kind: "mention";
			mention: Mention;
	  }
	| {
			kind: "content";
			preventDefault: boolean;
	  };

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

interface InputValueSource {
	value?: string | number | readonly string[];
}

interface InputClassPresentation {
	baseClassName: string;
	mentionClassName: false | "has-mentions";
}

function getEditableChangeEventSource(
	sourceEvent: unknown,
): Record<string, unknown> {
	if (!sourceEvent) return {};
	if (typeof sourceEvent !== "object") return {};
	return sourceEvent as Record<string, unknown>;
}

function getEditableChangeEventProperty(
	source: Record<string, unknown>,
	property: "currentTarget" | "target",
	fallback: Record<string, unknown>,
): Record<string, unknown> {
	if (!source[property]) return fallback;
	if (typeof source[property] !== "object") return fallback;
	return source[property] as Record<string, unknown>;
}

export function createEditableFieldChangeEvent(
	sourceEvent: unknown,
	value: string,
): EditableFieldChangeEvent {
	const source = getEditableChangeEventSource(sourceEvent);
	const target = getEditableChangeEventProperty(source, "target", {});
	const currentTarget = getEditableChangeEventProperty(
		source,
		"currentTarget",
		target,
	);
	return {
		...source,
		currentTarget: {
			...currentTarget,
			value,
		},
		target: {
			...target,
			value,
		},
	};
}

export function shouldActivateEditableMention<Mention>(
	mention: Mention | null | undefined,
	modifiers: EditableModifierSource,
): mention is Mention {
	return Boolean(mention && (modifiers.ctrlKey || modifiers.metaKey));
}

export function hasEditableLinkTarget(
	target: EditableClosestTarget | null | undefined,
): boolean {
	return Boolean(target?.closest("a"));
}

export function getEditableClickPlan<Mention>(
	target: EditableClosestTarget | null | undefined,
	modifiers: EditableModifierSource,
): EditableClickPlan<Mention> {
	const mention = target?.closest("[data-mention]") as
		| Mention
		| null
		| undefined;

	if (shouldActivateEditableMention(mention, modifiers)) {
		return { kind: "mention", mention };
	}

	return {
		kind: "content",
		preventDefault: hasEditableLinkTarget(target),
	};
}

export function getEditableMentionName(
	mention: EditableMentionTarget,
): string {
	return mention.dataset.mention || "";
}

export function shouldInsertEditableMentionResult(
	result: MentionSelectionResult,
): result is Extract<MentionSelectionResult, { status: "selected" }> {
	return result.status === "selected" && Boolean(result.name);
}

export interface EditableCopyRequest<Editor, MarkdownValue> {
	editor: Editor;
	markdownValue: MarkdownValue;
}

export function getEditableCopyRequest<Editor, MarkdownValue>(
	editor: Editor | null | undefined,
	markdownValue: MarkdownValue | null | undefined,
): EditableCopyRequest<Editor, MarkdownValue> | null {
	if (!editor || !markdownValue) return null;
	return { editor, markdownValue };
}

export interface LexicalEditableFieldViewPresentation {
	ariaMultiline: boolean;
	historyShortcuts: "true" | undefined;
	showHistory: boolean;
	showRichText: boolean;
	tabIndex: -1 | 0;
}

export function getLexicalEditableFieldViewPresentation(
	enableHistory: boolean,
	isDisabled: boolean,
	type: EditableFieldType,
): LexicalEditableFieldViewPresentation {
	const isTextarea = type === "textarea";
	return {
		ariaMultiline: isTextarea,
		historyShortcuts: enableHistory ? undefined : "true",
		showHistory: enableHistory,
		showRichText: isTextarea,
		tabIndex: isDisabled ? -1 : 0,
	};
}

export function getEditableFieldMarkdownValue(value: unknown): string {
	return value || value === 0 ? String(value) : "";
}

export function isEditableFieldDisabled(
	disabled: unknown,
	readOnly: unknown,
): boolean {
	return Boolean(disabled || readOnly);
}

export function getEditableFieldTitleContent(title: unknown): string | null {
	if (typeof title === "string" && title.trim()) return title;
	return null;
}

interface EditableFieldTooltipSource<Content, Anchor> {
	content: Content;
	anchor: Anchor;
}

export interface EditableFieldTooltipPresentation<Content, Anchor> {
	content: Content;
	anchor: Anchor;
	disabled: boolean;
}

export function getEditableFieldTooltipPresentation<
	Content,
	Anchor,
	FieldContent,
>(
	mentionTooltip: EditableFieldTooltipSource<Content, Anchor>,
	fieldTooltipContent: FieldContent,
): EditableFieldTooltipPresentation<
	Content | FieldContent,
	Anchor | null
> {
	const content = mentionTooltip.content || fieldTooltipContent;
	return {
		content,
		anchor: mentionTooltip.anchor || null,
		disabled: !content,
	};
}

export function resolveEditableFieldCampaignSlug(
	campaignSlug: string | null | undefined,
	parseCurrentUrl: () => { campaign: string | null },
): string | null {
	return campaignSlug || parseCurrentUrl().campaign;
}

export interface EditableFieldCopyPresentation {
	showButton: string | boolean;
	icon: "check" | "copy";
}

export function getEditableFieldCopyPresentation(
	normalizedMarkdownValue: string,
	showCopyButton: boolean,
	copied: boolean,
): EditableFieldCopyPresentation {
	return {
		showButton: normalizedMarkdownValue && showCopyButton,
		icon: copied ? "check" : "copy",
	};
}

export function getNextEditableMentionTooltipState<Content, Anchor>(
	current: EditableFieldTooltipSource<Content, Anchor>,
	content: Content,
	anchor: Anchor,
): EditableFieldTooltipSource<Content, Anchor> {
	if (current.content === content && current.anchor === anchor) return current;
	return { content, anchor };
}

export function getInputRawValue(source: InputValueSource): string {
	if (Array.isArray(source.value)) return source.value.join(",");
	return String(source.value ?? "");
}

function getInputBaseClassName(type: string): string {
	return type === "textarea" ? "Input Input__textarea" : "Input";
}

function getInputMentionClassName(
	source: InputValueSource,
): InputClassPresentation["mentionClassName"] {
	if (typeof source.value !== "string") return false;
	if (!source.value.includes("[")) return false;
	return "has-mentions";
}

export function getInputClassPresentation(
	type: string,
	source: InputValueSource,
): InputClassPresentation {
	return {
		baseClassName: getInputBaseClassName(type),
		mentionClassName: getInputMentionClassName(source),
	};
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

function hasPreviewCursorMapping(
	previewOffset: unknown,
	previewToRaw: unknown,
): previewToRaw is number[] {
	return typeof previewOffset === "number" && Array.isArray(previewToRaw);
}

function resolveFirstPreviewCursorPosition(previewToRaw: number[]): number {
	return Math.max(0, previewToRaw[0] ?? 0);
}

function resolveMappedPreviewCursorPosition(
	previewOffset: number,
	previewToRaw: number[],
	valueLength: number,
): number {
	return clampCursorPosition(
		previewToRaw[previewOffset] ?? valueLength,
		valueLength,
	);
}

function resolveNonEmptyPreviewCursorPosition(
	previewOffset: number,
	previewToRaw: number[],
	valueLength: number,
): number {
	if (previewOffset <= 0) {
		return resolveFirstPreviewCursorPosition(previewToRaw);
	}
	if (previewOffset >= previewToRaw.length) return valueLength;
	return resolveMappedPreviewCursorPosition(
		previewOffset,
		previewToRaw,
		valueLength,
	);
}

function resolvePreviewCursorPosition(
	initialSelection: InputSelectionPreview,
	valueLength: number,
): number {
	const { previewOffset, previewToRaw } = initialSelection;
	if (!hasPreviewCursorMapping(previewOffset, previewToRaw)) {
		return valueLength;
	}
	if (previewToRaw.length === 0) return 0;
	return resolveNonEmptyPreviewCursorPosition(
		previewOffset as number,
		previewToRaw,
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

function hasInitialInputSelection(
	initialSelection: number | InputSelectionPreview | null | undefined,
	type: string,
): boolean {
	if (initialSelection == null) return false;
	return supportsSelectionRange(type);
}

export function getInitialInputSelectionPosition(
	hasAppliedInitialSelection: boolean,
	initialSelection: number | InputSelectionPreview | null | undefined,
	type: string,
	rawValue: string,
): number | null {
	if (hasAppliedInitialSelection) return null;
	if (!hasInitialInputSelection(initialSelection, type)) return null;
	return resolveInitialCursorPosition(initialSelection, rawValue);
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

function hasInputShortcutModifier(
	ctrlKey: boolean,
	metaKey: boolean,
): boolean {
	return !(!ctrlKey && !metaKey);
}

function getInputHeadingShortcutAction(
	normalizedKey: string,
): InputShortcutAction {
	if (!/^[1-6]$/.test(normalizedKey)) return null;
	return { kind: "heading", level: Number(normalizedKey) };
}

function getInputModifiedShortcutAction(
	normalizedKey: string,
): InputShortcutAction {
	const mappedAction = INPUT_MODIFIED_SHORTCUTS[normalizedKey];
	if (mappedAction) return mappedAction;
	return getInputHeadingShortcutAction(normalizedKey);
}

function getInputNormalizedShortcutAction(
	normalizedKey: string,
	ctrlKey: boolean,
	metaKey: boolean,
): InputShortcutAction {
	if (normalizedKey === "tab") return { kind: "tab" };
	if (!hasInputShortcutModifier(ctrlKey, metaKey)) return null;
	return getInputModifiedShortcutAction(normalizedKey);
}

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
	return getInputNormalizedShortcutAction(normalizedKey, ctrlKey, metaKey);
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

function hasInputMentionSelectedMarkers(selection: string): boolean {
	return selection.startsWith("[") && selection.endsWith("]");
}

function isInputMentionWrappedSelection(selection: string): boolean {
	return hasInputMentionSelectedMarkers(selection) && selection.length >= 2;
}

function removeInputMentionSelectedMarkers(
	value: string,
	selectionStart: number,
	selectionEnd: number,
	selection: string,
): InputTextEdit {
	return {
		value:
			value.substring(0, selectionStart) +
			selection.substring(1, selection.length - 1) +
			value.substring(selectionEnd),
		selectionStart,
		selectionEnd: selectionEnd - 2,
	};
}

function hasInputMentionSurroundingBounds(
	value: string,
	selectionStart: number,
	selectionEnd: number,
): boolean {
	return selectionStart > 0 && selectionEnd < value.length;
}

function hasInputMentionSurroundingMarkers(
	value: string,
	selectionStart: number,
	selectionEnd: number,
): boolean {
	return value[selectionStart - 1] === "[" && value[selectionEnd] === "]";
}

function isInputMentionWrappedAround(
	value: string,
	selectionStart: number,
	selectionEnd: number,
): boolean {
	return (
		hasInputMentionSurroundingBounds(value, selectionStart, selectionEnd) &&
		hasInputMentionSurroundingMarkers(value, selectionStart, selectionEnd)
	);
}

function removeInputMentionSurroundingMarkers(
	value: string,
	selectionStart: number,
	selectionEnd: number,
	selection: string,
): InputTextEdit {
	return {
		value:
			value.substring(0, selectionStart - 1) +
			selection +
			value.substring(selectionEnd + 1),
		selectionStart: selectionStart - 1,
		selectionEnd: selectionEnd - 1,
	};
}

function addInputMentionMarkers(
	value: string,
	selectionStart: number,
	selectionEnd: number,
	selection: string,
): InputTextEdit {
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

export function toggleInputMention(
	value: string,
	selectionStart: number,
	selectionEnd: number,
): InputTextEdit {
	const selection = value.substring(selectionStart, selectionEnd);
	if (isInputMentionWrappedSelection(selection)) {
		return removeInputMentionSelectedMarkers(
			value,
			selectionStart,
			selectionEnd,
			selection,
		);
	}
	if (isInputMentionWrappedAround(value, selectionStart, selectionEnd)) {
		return removeInputMentionSurroundingMarkers(
			value,
			selectionStart,
			selectionEnd,
			selection,
		);
	}
	return addInputMentionMarkers(value, selectionStart, selectionEnd, selection);
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

function hasInputFormatInsideItalicConflict(
	selection: string,
	marker: "*" | "**",
): boolean {
	return (
		marker === "*" &&
		selection.startsWith("**") &&
		!selection.startsWith("***")
	);
}

function hasInputFormatSelectedMarkers(
	selection: string,
	marker: "*" | "**",
): boolean {
	return (
		selection.startsWith(marker) &&
		selection.endsWith(marker) &&
		selection.length >= marker.length * 2
	);
}

function isInputFormatWrappedInside(
	selection: string,
	marker: "*" | "**",
): boolean {
	const italicConflict = hasInputFormatInsideItalicConflict(selection, marker);
	return hasInputFormatSelectedMarkers(selection, marker) && !italicConflict;
}

function hasInputFormatOutsideItalicConflict(
	value: string,
	selectionStart: number,
	marker: "*" | "**",
): boolean {
	return (
		marker === "*" &&
		value.substring(selectionStart - 2, selectionStart) === "**" &&
		value.substring(selectionStart - 3, selectionStart) !== "***"
	);
}

function hasInputFormatSurroundingStart(
	selectionStart: number,
	marker: "*" | "**",
): boolean {
	return selectionStart >= marker.length;
}

function hasInputFormatSurroundingMarkers(
	value: string,
	selectionStart: number,
	selectionEnd: number,
	marker: "*" | "**",
): boolean {
	return (
		value.substring(selectionStart - marker.length, selectionStart) === marker &&
		value.substring(selectionEnd, selectionEnd + marker.length) === marker
	);
}

function isInputFormatWrappedOutside(
	value: string,
	selectionStart: number,
	selectionEnd: number,
	marker: "*" | "**",
): boolean {
	const italicConflict = hasInputFormatOutsideItalicConflict(
		value,
		selectionStart,
		marker,
	);
	return (
		hasInputFormatSurroundingStart(selectionStart, marker) &&
		hasInputFormatSurroundingMarkers(
			value,
			selectionStart,
			selectionEnd,
			marker,
		) &&
		!italicConflict
	);
}

type InputBlockEdit =
	| { kind: "list"; add: boolean }
	| { kind: "heading"; level: number }
	| { kind: "quote" };

type InputLineTransform = { line: string; shift: number };

function addInputLineMarker(
	line: string,
	marker: string,
): InputLineTransform {
	return { line: `${marker}${line}`, shift: marker.length };
}

function removeInputLineMarker(
	line: string,
	marker: string,
): InputLineTransform {
	if (!line.startsWith(marker)) return { line, shift: 0 };
	return {
		line: line.slice(marker.length),
		shift: -marker.length,
	};
}

function toggleInputLineMarker(
	line: string,
	marker: string,
): InputLineTransform {
	return line.startsWith(marker)
		? {
				line: line.slice(marker.length),
				shift: -marker.length,
			}
		: addInputLineMarker(line, marker);
}

function transformInputListLine(
	line: string,
	add: boolean,
): InputLineTransform {
	return add
		? addInputLineMarker(line, "- ")
		: removeInputLineMarker(line, "- ");
}

function transformInputHeadingLine(
	line: string,
	level: number,
): InputLineTransform {
	const marker = `${"#".repeat(level)} `;
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

function transformInputLine(
	line: string,
	edit: InputBlockEdit,
): InputLineTransform {
	if (edit.kind === "list") {
		return transformInputListLine(line, edit.add);
	}
	if (edit.kind === "quote") {
		return toggleInputLineMarker(line, "> ");
	}
	return transformInputHeadingLine(line, edit.level);
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

type ActiveInputShortcutAction = Exclude<InputShortcutAction, null>;
type NonTabInputShortcutAction = Exclude<
	ActiveInputShortcutAction,
	{ kind: "tab" }
>;
type NonMentionInputShortcutAction = Exclude<
	NonTabInputShortcutAction,
	{ kind: "mention" }
>;

export type InputShortcutExecutionPlan =
	| { kind: "edit"; edit: InputTextEdit }
	| { kind: "mention-picker" };

function createInputShortcutEditPlan(
	edit: InputTextEdit,
): InputShortcutExecutionPlan {
	return { kind: "edit", edit };
}

function getInputMentionShortcutExecutionPlan(
	value: string,
	selectionStart: number,
	selectionEnd: number,
): InputShortcutExecutionPlan {
	if (selectionEnd === selectionStart) return { kind: "mention-picker" };
	return createInputShortcutEditPlan(
		toggleInputMention(value, selectionStart, selectionEnd),
	);
}

function getInputNonMentionShortcutExecutionPlan(
	action: NonMentionInputShortcutAction,
	value: string,
	selectionStart: number,
	selectionEnd: number,
): InputShortcutExecutionPlan {
	if (action.kind === "format") {
		return createInputShortcutEditPlan(
			toggleInputFormat(
				value,
				selectionStart,
				selectionEnd,
				action.marker,
			),
		);
	}
	return createInputShortcutEditPlan(
		applyInputBlockEdit(value, selectionStart, selectionEnd, action),
	);
}

function getInputNonTabShortcutExecutionPlan(
	action: NonTabInputShortcutAction,
	value: string,
	selectionStart: number,
	selectionEnd: number,
): InputShortcutExecutionPlan {
	if (action.kind === "mention") {
		return getInputMentionShortcutExecutionPlan(
			value,
			selectionStart,
			selectionEnd,
		);
	}
	return getInputNonMentionShortcutExecutionPlan(
		action,
		value,
		selectionStart,
		selectionEnd,
	);
}

export function getInputShortcutExecutionPlan(
	action: ActiveInputShortcutAction,
	value: string,
	selectionStart: number,
	selectionEnd: number,
): InputShortcutExecutionPlan {
	if (action.kind === "tab") {
		return createInputShortcutEditPlan(
			insertInputTab(value, selectionStart, selectionEnd),
		);
	}
	return getInputNonTabShortcutExecutionPlan(
		action,
		value,
		selectionStart,
		selectionEnd,
	);
}

export interface InputMentionInsertion {
	value: string;
	mention: string;
}

export function getInputBracketPasteEdit(
	value: string,
	selectionStart: number,
	selectionEnd: number,
	plainText: string,
): InputTextEdit {
	const normalizedPlainText = plainText.replace(/\r\n/g, "\n");
	return {
		value:
			value.substring(0, selectionStart) +
			normalizedPlainText +
			value.substring(selectionEnd),
		selectionStart: selectionStart + normalizedPlainText.length,
		selectionEnd: selectionStart + normalizedPlainText.length,
	};
}

export function getInputMentionInsertion(
	value: string,
	cursorStart: number,
	cursorEnd: number,
	result: MentionSelectionResult,
): InputMentionInsertion | null {
	if (result.status === "cancelled") return null;
	const mention = result.name ? `[${result.name}]` : "[]";
	return {
		value:
			value.substring(0, cursorStart) +
			mention +
			value.substring(cursorEnd),
		mention,
	};
}

export function getInputMentionCursorPosition(
	cursorStart: number,
	result: MentionSelectionResult,
	mention: string,
): number {
	return cursorStart + (result.status === "selected" ? mention.length : 1);
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

interface EditableKeyDownSource {
	code: string;
	ctrlKey: boolean;
	key: string;
	metaKey: boolean;
}

export type EditableKeyDownPlan =
	| { kind: "history" }
	| { kind: "delegate" }
	| {
			kind: "execute";
			action: Exclude<EditableShortcutAction, "delegate">;
	  };

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
	const delegatedAction = getEditableDelegatedShortcutAction(
		code,
		modified,
		enableHistory,
		isDisabled,
	);
	if (delegatedAction) return delegatedAction;
	return getEditableTypeShortcutAction(type, code, key, modified);
}

export function shouldDelegateEditableHistory(
	code: string,
	modified: boolean,
	enableHistory: boolean,
): boolean {
	return !enableHistory && modified && (code === "KeyZ" || code === "KeyY");
}

function getEditableKeyDownModified(event: EditableKeyDownSource): boolean {
	return event.ctrlKey || event.metaKey;
}

function getEditableNonHistoryKeyDownPlan(
	action: EditableShortcutAction | null,
): Exclude<EditableKeyDownPlan, { kind: "history" }> {
	if (!action || action === "delegate") return { kind: "delegate" };
	return { kind: "execute", action };
}

export function getEditableKeyDownPlan(
	event: EditableKeyDownSource,
	enableHistory: boolean,
	isDisabled: boolean,
	type: EditableFieldType,
): EditableKeyDownPlan {
	const modified = getEditableKeyDownModified(event);
	const action = getEditableShortcutAction({
		code: event.code,
		ctrlKey: event.ctrlKey,
		enableHistory,
		isDisabled,
		key: event.key,
		metaKey: event.metaKey,
		type,
	});
	if (shouldDelegateEditableHistory(event.code, modified, enableHistory)) {
		return { kind: "history" };
	}
	return getEditableNonHistoryKeyDownPlan(action);
}

function getEditableDelegatedShortcutAction(
	code: string,
	modified: boolean,
	enableHistory: boolean,
	isDisabled: boolean,
): EditableShortcutAction | null {
	if (shouldDelegateEditableHistory(code, modified, enableHistory)) {
		return "delegate";
	}
	return isDisabled ? "delegate" : null;
}

function getEditableTypeShortcutAction(
	type: EditableFieldType,
	code: string,
	key: string,
	modified: boolean,
): EditableShortcutAction | null {
	if (type !== "textarea") return getSingleLineEditableAction(key, modified);
	return getTextareaEditableAction(code, key, modified);
}

function getSingleLineEditableAction(
	key: string,
	modified: boolean,
): EditableShortcutAction | null {
	if (key === "Enter") return "blur";
	return modified ? "delegate" : null;
}

function getTextareaDirectEditableAction(
	key: string,
): EditableShortcutAction | null {
	if (key.toLowerCase() === "tab") return "tab";
	if (key === " ") return "space-after-mention";
	return null;
}

function getTextareaHeadingEditableAction(
	key: string,
): EditableShortcutAction | null {
	if (/^[1-6]$/.test(key)) return `heading-${key}` as EditableShortcutAction;
	return null;
}

function getTextareaModifiedEditableAction(
	code: string,
	key: string,
): EditableShortcutAction | null {
	const mappedAction = EDITABLE_CODE_SHORTCUTS[code];
	if (mappedAction) return mappedAction;
	return getTextareaHeadingEditableAction(key);
}

function getTextareaEditableAction(
	code: string,
	key: string,
	modified: boolean,
): EditableShortcutAction | null {
	const directAction = getTextareaDirectEditableAction(key);
	if (directAction) return directAction;
	if (!modified) return null;
	return getTextareaModifiedEditableAction(code, key);
}
