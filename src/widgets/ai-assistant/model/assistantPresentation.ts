import { getAiCharacterContextKey } from "../../../features/ai/index.js";

export type AssistantTranslate = (
	phrase: string,
	variables?: Record<string, unknown>,
) => string;

export interface AssistantEntity extends Record<string, unknown> {
	id?: string | number;
	slug?: string;
	name?: string;
	title?: string;
	firstName?: string;
	first_name?: string;
	lastName?: string;
	last_name?: string;
	summary?: string;
	texts?: Record<string, unknown>;
}

export interface AssistantHistoryEntry extends Record<string, unknown> {
	createdAt?: unknown;
	text?: unknown;
	userInstructions?: unknown;
	applyState?: unknown;
	request?: Record<string, unknown>;
	retryPayload?: Record<string, unknown>;
}

export interface AssistantHistoryDetailRow {
	label: string;
	value: string;
}

export interface AssistantPresentationDependencies {
	translate: AssistantTranslate;
	isFailedHistoryEntry: (entry: AssistantHistoryEntry) => boolean;
	hasHistoryChanges: (entry: AssistantHistoryEntry) => boolean;
}

const MARKDOWN_PREVIEW_MARKERS = [
	"#",
	"*",
	"_",
	"`",
	">",
	"|",
	"~",
	"[",
	"]",
	"(",
	")",
];

const HISTORY_MODE_LABELS: Record<string, string> = {
	image: "Image prompt",
	encounter: "AI Encounter Assistant",
	session: "AI Session Assistant",
	campaign: "AI Story Assistant",
};

const HISTORY_GENERATION_OPTIONS = [
	["Create characters", "characterGeneration"],
	["Create NPCs", "npcGeneration"],
	["Create locations/factions", "locationGeneration"],
	["Encounter generation", "encounterGeneration"],
	["Custom monster generation", "customMonsterGeneration"],
] as const;

const HISTORY_CONTEXT_FIELDS = [
	["Notes", "campaignNotes"],
	["Characters", "campaignCharacters"],
	["NPCs", "campaignNpcs"],
	["Locations/Factions", "campaignLocations"],
	["Sessions", "sessions"],
	["Scenes", "scenes"],
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function getFirstTruthyValue(...values: unknown[]): unknown {
	for (const value of values) {
		if (value) return value;
	}
	return "";
}

function stringifyTruthy(value: unknown): string {
	return String(value || "");
}

function findMatchingPrefix(
	source: string,
	prefixes: Array<string | null | undefined>,
): string | undefined {
	return (
		prefixes.find((prefix) => Boolean(prefix) && source.startsWith(prefix!)) ??
		undefined
	);
}

function findFirstLabelIndex(source: string, labels: string[]): number | undefined {
	for (const label of labels) {
		const index = source.indexOf(label);
		if (index >= 0) return index;
	}
	return undefined;
}

type JsonStringScanState = "outside" | "inside" | "escaped";

function getNextJsonStringScanState(
	state: JsonStringScanState,
	character: string,
): JsonStringScanState {
	if (state === "escaped") return "inside";
	if (state === "inside" && character === "\\") return "escaped";
	if (character === '"') return state === "inside" ? "outside" : "inside";
	return state;
}

function getJsonObjectDepthDelta(
	state: JsonStringScanState,
	character: string,
): number {
	if (state !== "outside") return 0;
	if (character === "{") return 1;
	return character === "}" ? -1 : 0;
}

function findJsonObjectEnd(text: string, startIndex: number): number {
	let depth = 0;
	let stringState: JsonStringScanState = "outside";
	for (let index = startIndex; index < text.length; index += 1) {
		const character = text[index];
		stringState = getNextJsonStringScanState(stringState, character);
		depth += getJsonObjectDepthDelta(stringState, character);
		if (character === "}" && depth === 0) return index + 1;
	}
	return -1;
}

function stripLabeledJsonObject(source: string, labelIndex?: number): string {
	if (labelIndex === undefined) return source;
	const objectStart = source.indexOf("{", labelIndex);
	if (objectStart < 0) return source;
	const objectEnd = findJsonObjectEnd(source, objectStart);
	return objectEnd < 0 ? source : source.slice(objectEnd).trim();
}

function getHistoryGenerationOptionRows(
	options: Record<string, unknown>,
	translate: AssistantTranslate,
	getOnOffLabel: (value: unknown) => string,
): string[] {
	return HISTORY_GENERATION_OPTIONS.map(
		([label, key]) => `${translate(label)}: ${getOnOffLabel(options[key])}`,
	);
}

function getHistoryContextParts(
	context: Record<string, unknown>,
	translate: AssistantTranslate,
): string[] {
	return HISTORY_CONTEXT_FIELDS.filter(([, key]) => Boolean(context[key])).map(
		([label, key]) => `${translate(label)}: ${String(context[key])}`,
	);
}

function formatHistoryContextParts(
	parts: string[],
	translate: AssistantTranslate,
): string {
	return parts.length ? parts.join(", ") : translate("Empty");
}

export function createAiAssistantPresentation({
	translate,
	isFailedHistoryEntry,
	hasHistoryChanges,
}: AssistantPresentationDependencies) {
	const getResponsePreview = (text: unknown): string => {
		const plainText = MARKDOWN_PREVIEW_MARKERS.reduce(
			(value, marker) => value.split(marker).join(""),
			String(text || ""),
		);
		return plainText.replace(/\s+/g, " ").trim();
	};

	const formatResponseDate = (date: unknown, language?: string): string => {
		const parsed =
			date instanceof Date
				? new Date(date.getTime())
				: new Date(
						typeof date === "string" || typeof date === "number" ? date : "",
					);
		return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString(language);
	};

	const stripGeneratedMonsterEditPrompt = (text: unknown): string => {
		const source = stringifyTruthy(text).trim();
		if (!source) return "";
		const baseCreatePrefix =
			"Create a new custom creature based on the selected creature. Do not change the selected creature.";
		const createPrefix = findMatchingPrefix(
			source,
			[translate(baseCreatePrefix), baseCreatePrefix],
		);
		if (createPrefix) return source.slice(createPrefix.length).trim();

		return stripLabeledJsonObject(
			source,
			findFirstLabelIndex(source, [
				`${translate("Current encounter creature")}:`,
				"Current encounter creature:",
			]),
		);
	};

	const getHistoryRequestText = (entry: AssistantHistoryEntry): string => {
		const explicitText = stringifyTruthy(
			entry.retryPayload?.historyUserInstructions,
		).trim();
		if (explicitText) return explicitText;
		return stripGeneratedMonsterEditPrompt(
			getFirstTruthyValue(
				entry.request?.userInstructions,
				entry.userInstructions,
			),
		);
	};

	const getLocationContextKey = (location: AssistantEntity): string =>
		String(location.slug || location.id || location.name || "").trim();

	const getLocationDisplayName = (location: AssistantEntity): string =>
		String(location.name || location.title || translate("Untitled")).trim();

	const getCharacterDisplayName = (character: AssistantEntity): string => {
		const firstName = stringifyTruthy(
			getFirstTruthyValue(character.firstName, character.first_name),
		).trim();
		const lastName = stringifyTruthy(
			getFirstTruthyValue(character.lastName, character.last_name),
		).trim();
		const displayName = getFirstTruthyValue(
			`${firstName} ${lastName}`.trim(),
			character.name,
			character.title,
		);
		return displayName
			? String(displayName).trim()
			: translate("Untitled").trim();
	};

	const getSceneImagePromptTitle = (
		scene: AssistantEntity,
		index: number,
	): string => {
		const summary = String(scene.texts?.summary || scene.summary || "").trim();
		return summary || translate("Scene {number}", { number: index + 1 });
	};

	const getSceneImagePromptDescription = (scene: AssistantEntity): string => {
		const texts = scene.texts || {};
		return [texts.summary, texts.goal, texts.stakes, texts.location]
			.filter(Boolean)
			.join(" ");
	};

	const getImagePromptPreview = (text: unknown): string => {
		const value = String(text || "").replace(/\s+/g, " ").trim();
		return value.length > 120 ? `${value.slice(0, 117)}...` : value;
	};

	const getOnOffLabel = (value: unknown): string =>
		translate(value ? "On" : "Off");

	const getHistoryOptionsSummary = (entry: AssistantHistoryEntry): string => {
		const request = asRecord(entry.request);
		const options = asRecord(request?.options);
		if (!options?.mode) return stringifyTruthy(request?.optionsSummary);
		const mode = String(options.mode);
		const rows = [
			`${translate("Mode")}: ${translate(String(getFirstTruthyValue(HISTORY_MODE_LABELS[mode], mode, "AI response")))}`,
			`${translate("Response parsing")}: ${getOnOffLabel(options.responseParsing)}`,
		];
		if (options.responseParsing) {
			rows.push(
				...getHistoryGenerationOptionRows(options, translate, getOnOffLabel),
			);
		}
		rows.push(`${translate("Context")}: ${getOnOffLabel(options.contextEnabled)}`);
		return rows.join("; ");
	};

	const getHistoryContextSummary = (entry: AssistantHistoryEntry): string => {
		const request = asRecord(entry.request);
		const context = asRecord(request?.context);
		if (!context) return stringifyTruthy(request?.contextSummary);
		if (!context.enabled) return `${translate("Context")}: ${translate("Off")}`;
		const parts = getHistoryContextParts(context, translate);
		return `${translate("Context")}: ${formatHistoryContextParts(parts, translate)}`;
	};

	const getHistoryDetailRows = (
		entry: AssistantHistoryEntry,
		language?: string,
	): AssistantHistoryDetailRow[] => {
		const candidates: Array<[string, string]> = [
			[translate("Request"), getHistoryRequestText(entry)],
			[translate("Settings"), getHistoryOptionsSummary(entry)],
			[translate("Context"), getHistoryContextSummary(entry)],
			[translate("Sent"), formatResponseDate(entry.createdAt, language)],
		];
		return candidates.flatMap(([label, value]) =>
			value ? [{ label, value }] : [],
		);
	};

	const getHistoryTitle = (entry: AssistantHistoryEntry): string => {
		const requestText = getHistoryRequestText(entry);
		if (requestText) return requestText;
		if (isFailedHistoryEntry(entry)) return translate("Failed AI request");
		if (hasHistoryChanges(entry)) return translate("AI changes");
		return getResponsePreview(entry.text) || translate("AI response");
	};

	const getAiResponseStateLabel = (entry: AssistantHistoryEntry): string => {
		if (isFailedHistoryEntry(entry)) return translate("Failed");
		const labels: Record<string, string> = {
			draft: "Draft",
			applied: "Applied",
			undone: "Undone",
		};
		const label = labels[String(entry.applyState || "")];
		return label ? translate(label) : "";
	};

	return {
		formatResponseDate,
		getAiResponseStateLabel,
		getCharacterContextKey: getAiCharacterContextKey,
		getCharacterDisplayName,
		getHistoryContextSummary,
		getHistoryDetailRows,
		getHistoryOptionsSummary,
		getHistoryRequestText,
		getHistoryTitle,
		getImagePromptPreview,
		getLocationContextKey,
		getLocationDisplayName,
		getResponsePreview,
		getSceneImagePromptDescription,
		getSceneImagePromptTitle,
		stripGeneratedMonsterEditPrompt,
	};
}
