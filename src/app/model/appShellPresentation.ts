import type {
	CampaignEntityRecord,
	CampaignRecord,
} from "../../entities/campaign/index.js";
import type { UiSettingsInput } from "../../shared/model/index.js";

export interface AppMentionEntityOption extends Record<string, unknown> {
	id: string | number;
	type: "characters" | "npc" | "locations";
	name: string;
	firstName: string;
	lastName: string;
}

export interface AppSettingsProjection {
	language: unknown;
	ui: UiSettingsInput;
}

export interface CampaignCompletionPlan {
	completed: boolean;
	completedAt: unknown;
	nextCompletedAt: string;
	previousDateLabel: string | null;
	requiresDateConfirmation: boolean;
}

export interface AppMentionPickerCallbacks {
	select: (name: string) => void;
	cancel: () => void;
}

const UI_SETTING_KEYS = [
	"theme",
	"encounterViewMode",
	"encounterGridColumns",
	"simplifiedNotes",
	"aiBasePrompt",
	"imagePromptBasePrompt",
	"campaignAiBasePrompts",
	"campaignImagePromptBasePrompts",
	"ignoreSourcesList",
	"autoApplyAiChanges",
	"useSearchDebounce",
] as const;

export function isEditableAppTarget(target: EventTarget | null): boolean {
	if (!target || typeof target !== "object") return false;
	const candidate = target as {
		tagName?: unknown;
		isContentEditable?: unknown;
	};
	return (
		candidate.tagName === "INPUT" ||
		candidate.tagName === "TEXTAREA" ||
		candidate.isContentEditable === true
	);
}

export function hasValidMentionPickerCallbacks(
	value: unknown,
): value is AppMentionPickerCallbacks {
	if (!isRecord(value)) return false;
	return typeof value.select === "function" && typeof value.cancel === "function";
}

export function getAppSettingsProjection(settings: unknown): AppSettingsProjection {
	const record = isRecord(settings) ? settings : {};
	const ui: UiSettingsInput = {};
	for (const key of UI_SETTING_KEYS) ui[key] = record[key];
	return { language: record.language, ui };
}

export function buildAppMentionOptions(
	collections: {
		characters: readonly CampaignEntityRecord[];
		npc: readonly CampaignEntityRecord[];
		locations: readonly CampaignEntityRecord[];
	},
	locale: string,
): AppMentionEntityOption[] {
	return (
		[
			...mapMentionEntities(collections.characters, "characters"),
			...mapMentionEntities(collections.npc, "npc"),
			...mapMentionEntities(collections.locations, "locations"),
		] as AppMentionEntityOption[]
	).sort((left, right) => left.name.localeCompare(right.name, locale));
}

function mapMentionEntities(
	entities: readonly CampaignEntityRecord[],
	type: AppMentionEntityOption["type"],
): AppMentionEntityOption[] {
	return entities
		.map((entity) => toAppMentionOption(entity, type))
		.filter((entity): entity is AppMentionEntityOption => entity !== null);
}

export function toAppMentionOption(
	entity: CampaignEntityRecord,
	type: AppMentionEntityOption["type"],
): AppMentionEntityOption | null {
	const firstName = readTrimmedString(entity.firstName);
	const lastName = readTrimmedString(entity.lastName);
	const fullName = `${firstName} ${lastName}`.trim();
	const name =
		fullName || readTrimmedString(entity.name) || readTrimmedString(entity.title);
	if (!name) return null;
	return {
		id: readEntityId(entity.id) ?? readEntityId(entity.slug) ?? name,
		type,
		name,
		firstName,
		lastName,
	};
}

export function getCampaignCompletionPlan(
	campaign: CampaignRecord,
	now: Date,
	formatDate: (date: Date) => string,
): CampaignCompletionPlan {
	const completed = !Boolean(campaign.completed);
	const completedAt = campaign.completedAt;
	const nextCompletedAt = now.toISOString();
	if (!completed) {
		return {
			completed,
			completedAt,
			nextCompletedAt,
			previousDateLabel: null,
			requiresDateConfirmation: false,
		};
	}
	const previousDate = getValidDate(completedAt);
	const previousDateLabel = previousDate ? formatDate(previousDate) : null;
	return {
		completed,
		completedAt,
		nextCompletedAt,
		previousDateLabel,
		requiresDateConfirmation: Boolean(
			previousDateLabel && previousDateLabel !== formatDate(now),
		),
	};
}

export function getAppErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

export function isSettingsSyncEvent(event: unknown): boolean {
	return isRecord(event) && event.resource === "settings";
}

function readTrimmedString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function readEntityId(value: unknown): string | number | null {
	return typeof value === "string" || typeof value === "number" ? value : null;
}

function getValidDate(value: unknown): Date | null {
	if (typeof value !== "string" && typeof value !== "number") return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
