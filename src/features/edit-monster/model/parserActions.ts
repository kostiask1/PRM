export const PARSER_ACTION_INTERACTIONS = [
	"direct",
	"form",
	"reference",
] as const;

export const PARSER_ACTION_REFERENCE_TABS = [
	"conditions",
	"diseases",
	"senses",
	"skills",
	"variantrules",
	"spells",
	"bestiary",
] as const;

export const PARSER_ACTION_FIELD_CONTROLS = [
	"text",
	"number",
	"select",
	"textarea",
] as const;

export const PARSER_ACTION_CONTEXTS = [
	"rich-text",
	"action-name",
	"armor-class",
	"senses",
] as const;

export type ParserActionInteraction =
	(typeof PARSER_ACTION_INTERACTIONS)[number];
export type ParserActionReferenceTab =
	(typeof PARSER_ACTION_REFERENCE_TABS)[number];
export type ParserActionFieldControl =
	(typeof PARSER_ACTION_FIELD_CONTROLS)[number];
export type ParserActionContext = (typeof PARSER_ACTION_CONTEXTS)[number];

export interface ParserActionOption {
	value: string;
	label: string;
}

export interface ParserActionFieldDefinition {
	name: string;
	label: string;
	control: ParserActionFieldControl;
	required: boolean;
	defaultValue: string;
	placeholder: string;
	useSelection: boolean;
	options: ParserActionOption[];
	min?: number;
	max?: number;
	pattern?: string;
	validationMessage?: string;
}

export interface ParserActionDefinition {
	type: string;
	interaction: ParserActionInteraction;
	label: string;
	description: string;
	template: string;
	example: string;
	group: string;
	contexts: ParserActionContext[];
	fields: ParserActionFieldDefinition[];
	referenceTab?: ParserActionReferenceTab;
}

export interface ParserActionReferenceSelection {
	tabId?: unknown;
	item?: unknown;
	name?: unknown;
	tag?: unknown;
}

export type ParserActionValues = Record<string, string>;

export interface ParserActionValidationIssue {
	field: ParserActionFieldDefinition;
	reason: "required" | "number" | "min" | "max" | "pattern";
}

const INTERACTION_SET = new Set<string>(PARSER_ACTION_INTERACTIONS);
const REFERENCE_TAB_SET = new Set<string>(PARSER_ACTION_REFERENCE_TABS);
const FIELD_CONTROL_SET = new Set<string>(PARSER_ACTION_FIELD_CONTROLS);
const CONTEXT_SET = new Set<string>(PARSER_ACTION_CONTEXTS);
const OPTIONAL_TEMPLATE_PLACEHOLDER_REGEX =
	/\{\{\s*(\|{1,2})([A-Za-z][A-Za-z0-9_]*)\s*}}/g;
const TEMPLATE_PLACEHOLDER_REGEX = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*}}/g;

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function readNonEmptyString(value: unknown): string {
	return readString(value).trim();
}

function readFiniteNumber(value: unknown): number | undefined {
	if (value === "" || value === null || value === undefined) return undefined;
	const number = Number(value);
	return Number.isFinite(number) ? number : undefined;
}

function normalizeParserActionOption(value: unknown): ParserActionOption | null {
	if (!isRecord(value)) return null;
	const optionValue = readString(value.value);
	const label = readNonEmptyString(value.label) || optionValue;
	return optionValue && label ? { value: optionValue, label } : null;
}

function normalizeParserActionField(
	value: unknown,
): ParserActionFieldDefinition | null {
	if (!isRecord(value)) return null;
	const name = readNonEmptyString(value.name);
	const label = readNonEmptyString(value.label) || name;
	const rawControl = readNonEmptyString(value.control);
	const control = FIELD_CONTROL_SET.has(rawControl)
		? (rawControl as ParserActionFieldControl)
		: "text";
	const options = Array.isArray(value.options)
		? value.options
				.map(normalizeParserActionOption)
				.filter((option): option is ParserActionOption => Boolean(option))
		: [];
	if (!name || !label || (control === "select" && options.length === 0)) {
		return null;
	}

	return {
		name,
		label,
		control,
		required: Boolean(value.required),
		defaultValue: readString(value.defaultValue),
		placeholder: readString(value.placeholder),
		useSelection: Boolean(value.useSelection),
		options,
		min: readFiniteNumber(value.min),
		max: readFiniteNumber(value.max),
		pattern: readNonEmptyString(value.pattern) || undefined,
		validationMessage: readNonEmptyString(value.validationMessage) || undefined,
	};
}

function normalizeParserAction(value: unknown): ParserActionDefinition | null {
	if (!isRecord(value)) return null;
	const type = readNonEmptyString(value.type);
	const rawInteraction = readNonEmptyString(value.interaction);
	const interaction = INTERACTION_SET.has(rawInteraction)
		? (rawInteraction as ParserActionInteraction)
		: null;
	const description = readNonEmptyString(value.description);
	const template = readString(value.template);
	const rawReferenceTab = readNonEmptyString(value.referenceTab);
	const referenceTab = REFERENCE_TAB_SET.has(rawReferenceTab)
		? (rawReferenceTab as ParserActionReferenceTab)
		: undefined;
	const fields = Array.isArray(value.fields)
		? value.fields
				.map(normalizeParserActionField)
				.filter((field): field is ParserActionFieldDefinition => Boolean(field))
		: [];
	const contexts = Array.isArray(value.contexts)
		? value.contexts.filter(
				(context): context is ParserActionContext =>
					typeof context === "string" && CONTEXT_SET.has(context),
			)
		: [];

	if (
		!type ||
		!interaction ||
		!description ||
		!template.trim() ||
		(interaction === "form" && fields.length === 0) ||
		(interaction === "reference" && !referenceTab)
	) {
		return null;
	}

	return {
		type,
		interaction,
		label: readNonEmptyString(value.label) || type,
		description,
		template,
		example: readString(value.example),
		group: readNonEmptyString(value.group) || "Other",
		contexts: contexts.length ? [...new Set(contexts)] : ["rich-text"],
		fields,
		...(referenceTab ? { referenceTab } : {}),
	};
}

export function normalizeParserActions(value: unknown): ParserActionDefinition[] {
	if (!Array.isArray(value)) return [];
	const seenTypes = new Set<string>();
	const actions: ParserActionDefinition[] = [];
	for (const entry of value) {
		const action = normalizeParserAction(entry);
		if (!action || seenTypes.has(action.type)) continue;
		seenTypes.add(action.type);
		actions.push(action);
	}
	return actions;
}

function getInitialSelectValue(field: ParserActionFieldDefinition): string {
	if (field.options.some((option) => option.value === field.defaultValue)) {
		return field.defaultValue;
	}
	return field.options[0]?.value || "";
}

export function getParserActionInitialValues(
	action: ParserActionDefinition,
	selectedText = "",
): ParserActionValues {
	return Object.fromEntries(
		action.fields.map((field) => {
			const selectedValue = field.useSelection ? selectedText : "";
			const fallbackValue =
				field.control === "select"
					? getInitialSelectValue(field)
					: field.defaultValue;
			return [field.name, selectedValue || fallbackValue];
		}),
	);
}

export function getParserActionValidationIssue(
	action: ParserActionDefinition,
	values: ParserActionValues,
): ParserActionValidationIssue | null {
	for (const field of action.fields) {
		const value = String(values[field.name] ?? "");
		if (field.required && !value.trim()) {
			return { field, reason: "required" };
		}
		if (field.control === "number" && value.trim()) {
			const number = Number(value);
			if (!Number.isFinite(number)) return { field, reason: "number" };
			if (field.min !== undefined && number < field.min) {
				return { field, reason: "min" };
			}
			if (field.max !== undefined && number > field.max) {
				return { field, reason: "max" };
			}
		}
		if (field.pattern && value.trim()) {
			try {
				if (!new RegExp(field.pattern).test(value)) {
					return { field, reason: "pattern" };
				}
			} catch {
				return { field, reason: "pattern" };
			}
		}
	}
	return null;
}

export function renderParserActionTemplate(
	template: string,
	values: Record<string, unknown>,
): string {
	return template
		.replace(
			OPTIONAL_TEMPLATE_PLACEHOLDER_REGEX,
			(_match, prefix: string, key: string) => {
				const value = String(values[key] ?? "");
				return value ? `${prefix}${value}` : "";
			},
		)
		.replace(
			TEMPLATE_PLACEHOLDER_REGEX,
			(_match, key: string) => String(values[key] ?? ""),
		);
}

function getReferenceItem(
	selection: ParserActionReferenceSelection,
): Record<string, unknown> {
	return isRecord(selection.item) ? selection.item : {};
}

export function renderParserReferenceAction(
	action: ParserActionDefinition,
	selection: ParserActionReferenceSelection,
): string {
	const item = getReferenceItem(selection);
	const tag = readString(selection.tag);
	if (
		tag &&
		readNonEmptyString(selection.tabId) &&
		selection.tabId !== action.referenceTab
	) {
		return tag;
	}
	const rendered = renderParserActionTemplate(action.template, {
		tag,
		name: readString(selection.name) || readString(item.name),
		source: readString(item.source),
		kind: readString(item.kind),
	});
	return rendered || tag;
}
