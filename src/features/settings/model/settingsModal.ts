import type { CampaignRecord } from "../../../entities/campaign/index.js";
import { normalizeIgnoreSourcesList } from "../../../entities/reference/model.js";
import type {
	CampaignStorageBreakdown,
	SettingsStorageOverview,
	StorageHistoryMetric,
} from "../api/settingsApi.ts";

export const DEFAULT_IMAGE_PROMPT_BASE_PROMPT =
	"cinematic, photorealistic, ultra realistic, high detail, 8k, dramatic lighting, volumetric light, sharp focus, depth of field, film still, concept art";
export const GLOBAL_SETTINGS_SCOPE = "__global__";

export type SettingsSaveStatus = "idle" | "saving";
export type SettingsPromptMap = Record<string, string>;
export type CampaignIgnoreSourcesMap = Record<string, string[]>;

export interface SettingsCampaign extends CampaignRecord {
	ignoreSourcesList?: unknown;
	simplifiedNotes?: unknown;
}

export interface PromptSettingsPayload extends Record<string, unknown> {
	aiBasePrompt: string;
	imagePromptBasePrompt: string;
	campaignAiBasePrompts: SettingsPromptMap;
	campaignImagePromptBasePrompts: SettingsPromptMap;
}

export interface SelectedPromptSettings {
	isGlobalScope: boolean;
	basePrompt: string;
	imagePrompt: string;
}

export interface SelectedSourceSettings {
	isGlobalScope: boolean;
	ignoreSourcesList: string[];
}

export interface SelectedSimplifiedNotesSettings {
	isGlobalScope: boolean;
	isInherited: boolean;
	enabled: boolean;
}

interface UnknownRecord {
	[key: string]: unknown;
}

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null;
}

export function normalizeSettingsCampaigns(value: unknown): SettingsCampaign[] {
	if (!Array.isArray(value)) return [];
	return value.filter(
		(campaign): campaign is SettingsCampaign =>
			isRecord(campaign) &&
			typeof campaign.slug === "string" &&
			typeof campaign.name === "string",
	);
}

export function normalizeSettingsPromptMap(value: unknown): SettingsPromptMap {
	if (!isRecord(value)) return {};
	return Object.fromEntries(
		Object.entries(value).map(([slug, prompt]) => [
			slug,
			String(prompt || ""),
		]),
	);
}

export function buildCampaignIgnoreSourcesMap(
	campaigns: SettingsCampaign[],
): CampaignIgnoreSourcesMap {
	return Object.fromEntries(
		campaigns
			.filter((campaign) => Array.isArray(campaign.ignoreSourcesList))
			.map((campaign) => [
				campaign.slug,
				normalizeIgnoreSourcesList(campaign.ignoreSourcesList),
			]),
	);
}

export function mergeContentSourceOptions(
	bestiarySources: unknown,
	spellSources: unknown,
): string[] {
	return Array.from(
		new Set([
			"CUSTOM",
			...(Array.isArray(bestiarySources) ? bestiarySources : []),
			...(Array.isArray(spellSources) ? spellSources : []),
		]),
	)
		.map((source) => String(source || "").trim())
		.filter(Boolean)
		.sort((left, right) => left.localeCompare(right));
}

export function resolveSettingsScope(
	selectedScope: string,
	activeCampaignSlug: string | null,
	campaigns: SettingsCampaign[],
): string {
	if (selectedScope === GLOBAL_SETTINGS_SCOPE) return selectedScope;
	if (
		selectedScope &&
		campaigns.some((campaign) => campaign.slug === selectedScope)
	) {
		return selectedScope;
	}
	return activeCampaignSlug || GLOBAL_SETTINGS_SCOPE;
}

export function setSettingsPromptForScope(
	prompts: SettingsPromptMap,
	scope: string,
	value: string,
): SettingsPromptMap {
	return { ...prompts, [scope]: value };
}

export function resolveSelectedPromptSettings(options: {
	scope: string;
	aiBasePrompt: string;
	imagePromptBasePrompt: string;
	campaignAiBasePrompts: SettingsPromptMap;
	campaignImagePromptBasePrompts: SettingsPromptMap;
}): SelectedPromptSettings {
	const isGlobalScope = options.scope === GLOBAL_SETTINGS_SCOPE;
	return {
		isGlobalScope,
		basePrompt: isGlobalScope
			? options.aiBasePrompt
			: options.campaignAiBasePrompts[options.scope] || "",
		imagePrompt: isGlobalScope
			? options.imagePromptBasePrompt
			: options.campaignImagePromptBasePrompts[options.scope] || "",
	};
}

export function resolveSelectedSourceSettings(options: {
	scope: string;
	ignoreSourcesList: string[];
	campaignIgnoreSourcesLists: CampaignIgnoreSourcesMap;
}): SelectedSourceSettings {
	const isGlobalScope = options.scope === GLOBAL_SETTINGS_SCOPE;
	return {
		isGlobalScope,
		ignoreSourcesList: isGlobalScope
			? options.ignoreSourcesList
			: options.campaignIgnoreSourcesLists[options.scope] ||
				options.ignoreSourcesList,
	};
}

export function resolveSelectedSimplifiedNotesSettings(options: {
	scope: string;
	simplifiedNotes: boolean;
	campaigns: SettingsCampaign[];
}): SelectedSimplifiedNotesSettings {
	const isGlobalScope = options.scope === GLOBAL_SETTINGS_SCOPE;
	const campaign = options.campaigns.find(
		(candidate) => candidate.slug === options.scope,
	);
	const hasCampaignOverride =
		!isGlobalScope && typeof campaign?.simplifiedNotes === "boolean";
	return {
		isGlobalScope,
		isInherited: !isGlobalScope && !hasCampaignOverride,
		enabled: hasCampaignOverride
			? campaign.simplifiedNotes as boolean
			: Boolean(options.simplifiedNotes),
	};
}

export function setCampaignSimplifiedNotesSetting(
	campaigns: SettingsCampaign[],
	scope: string,
	value: boolean,
): SettingsCampaign[] {
	return campaigns.map((campaign) => {
		if (campaign.slug !== scope) return campaign;
		return { ...campaign, simplifiedNotes: value };
	});
}

export function setCampaignIgnoreSourcesForScope(
	current: CampaignIgnoreSourcesMap,
	scope: string,
	ignoreSourcesList: string[],
): CampaignIgnoreSourcesMap {
	return {
		...current,
		[scope]: normalizeIgnoreSourcesList(ignoreSourcesList),
	};
}

export function sanitizeSettingsPromptMap(
	prompts: SettingsPromptMap,
): SettingsPromptMap {
	return Object.fromEntries(
		Object.entries(prompts)
			.map(([slug, prompt]) => [slug, String(prompt || "")])
			.filter(([slug, prompt]) => Boolean(slug && prompt.trim())),
	);
}

export function buildPromptSettingsPayload(options: {
	aiBasePrompt: string;
	imagePromptBasePrompt: string;
	campaignAiBasePrompts: SettingsPromptMap;
	campaignImagePromptBasePrompts: SettingsPromptMap;
}): PromptSettingsPayload {
	return {
		aiBasePrompt: options.aiBasePrompt,
		imagePromptBasePrompt: options.imagePromptBasePrompt,
		campaignAiBasePrompts: sanitizeSettingsPromptMap(
			options.campaignAiBasePrompts,
		),
		campaignImagePromptBasePrompts: sanitizeSettingsPromptMap(
			options.campaignImagePromptBasePrompts,
		),
	};
}

export function normalizeSavedPromptSettings(
	value: unknown,
): PromptSettingsPayload {
	const saved = isRecord(value) ? value : {};
	return {
		aiBasePrompt: String(saved.aiBasePrompt || ""),
		imagePromptBasePrompt:
			saved.imagePromptBasePrompt === undefined
				? DEFAULT_IMAGE_PROMPT_BASE_PROMPT
				: String(saved.imagePromptBasePrompt || ""),
		campaignAiBasePrompts: normalizeSettingsPromptMap(
			saved.campaignAiBasePrompts,
		),
		campaignImagePromptBasePrompts: normalizeSettingsPromptMap(
			saved.campaignImagePromptBasePrompts,
		),
	};
}

export function normalizeSavedIgnoreSources(value: unknown): string[] {
	if (!isRecord(value)) return [];
	return normalizeIgnoreSourcesList(value.ignoreSourcesList);
}

export type SettingsStorageAction =
	| "ai-all"
	| "ai-bestiary"
	| "ai-campaign"
	| "undo-all"
	| "undo-application"
	| "undo-campaign";

export type SettingsStorageSegmentId =
	| "images"
	| "content"
	| "ai"
	| "undoRedo"
	| "appData";

export interface SettingsStorageSegment {
	id: SettingsStorageSegmentId;
	bytes: number;
	percent: number;
}

export interface ScopedSettingsStorageSummary {
	isGlobalScope: boolean;
	campaignSlug: string | null;
	campaignName: string | null;
	totalBytes: number;
	contentBytes: number;
	imagesBytes: number;
	generalImagesBytes: number;
	appDataBytes: number;
	aiHistory: {
		bytes: number;
		entryCount: number;
		campaignsBytes: number;
		campaignsEntryCount: number;
		bestiaryBytes: number;
		bestiaryEntryCount: number;
	};
	undoRedo: {
		bytes: number;
		entryCount: number;
		applicationBytes: number;
		applicationEntryCount: number;
		tombstonesBytes: number;
		campaignsBytes: number;
		campaignsEntryCount: number;
	};
	segments: SettingsStorageSegment[];
}

function toNonNegativeNumber(value: unknown): number {
	const numeric = Number(value);
	return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function normalizeHistoryMetric(value: unknown): StorageHistoryMetric {
	const record = isRecord(value) ? value : {};
	return {
		bytes: toNonNegativeNumber(record.bytes),
		entryCount: Math.trunc(toNonNegativeNumber(record.entryCount)),
	};
}

function normalizeCampaignStorageBreakdown(
	value: unknown,
): CampaignStorageBreakdown | null {
	if (!isRecord(value) || typeof value.slug !== "string" || !value.slug) {
		return null;
	}
	const contentBytes = toNonNegativeNumber(value.contentBytes);
	const imagesBytes = toNonNegativeNumber(value.imagesBytes);
	const aiHistory = normalizeHistoryMetric(value.aiHistory);
	const undoRedo = normalizeHistoryMetric(value.undoRedo);
	const rawTotal = toNonNegativeNumber(value.totalBytes);
	const computedTotal =
		contentBytes + imagesBytes + aiHistory.bytes + undoRedo.bytes;
	return {
		slug: value.slug,
		name: typeof value.name === "string" && value.name ? value.name : value.slug,
		contentBytes,
		imagesBytes,
		aiHistory,
		undoRedo,
		totalBytes: rawTotal || computedTotal,
	};
}

export function normalizeSettingsStorageOverview(
	value: unknown,
): SettingsStorageOverview | null {
	if (!isRecord(value) || !isRecord(value.project)) return null;
	const project = value.project;
	const aiRecord = isRecord(project.aiHistory) ? project.aiHistory : {};
	const undoRecord = isRecord(project.undoRedo) ? project.undoRedo : {};
	const contentBytes = toNonNegativeNumber(project.contentBytes);
	const imagesBytes = toNonNegativeNumber(project.imagesBytes);
	const generalImagesBytes = toNonNegativeNumber(project.generalImagesBytes);
	const appDataBytes = toNonNegativeNumber(project.appDataBytes);
	const aiMetric = normalizeHistoryMetric(aiRecord);
	const undoMetric = normalizeHistoryMetric(undoRecord);
	const rawTotal = toNonNegativeNumber(project.totalBytes);
	const computedTotal =
		contentBytes +
		imagesBytes +
		appDataBytes +
		aiMetric.bytes +
		undoMetric.bytes;
	const campaigns = Array.isArray(value.campaigns)
		? value.campaigns
				.map(normalizeCampaignStorageBreakdown)
				.filter((item): item is CampaignStorageBreakdown => Boolean(item))
		: [];

	return {
		project: {
			contentBytes,
			imagesBytes,
			generalImagesBytes,
			appDataBytes,
			aiHistory: {
				...aiMetric,
				campaignsBytes: toNonNegativeNumber(aiRecord.campaignsBytes),
				campaignsEntryCount: Math.trunc(
					toNonNegativeNumber(aiRecord.campaignsEntryCount),
				),
				bestiaryBytes: toNonNegativeNumber(aiRecord.bestiaryBytes),
				bestiaryEntryCount: Math.trunc(
					toNonNegativeNumber(aiRecord.bestiaryEntryCount),
				),
			},
			undoRedo: {
				...undoMetric,
				applicationBytes: toNonNegativeNumber(undoRecord.applicationBytes),
				applicationEntryCount: Math.trunc(
					toNonNegativeNumber(undoRecord.applicationEntryCount),
				),
				tombstonesBytes: toNonNegativeNumber(undoRecord.tombstonesBytes),
				campaignsBytes: toNonNegativeNumber(undoRecord.campaignsBytes),
				campaignsEntryCount: Math.trunc(
					toNonNegativeNumber(undoRecord.campaignsEntryCount),
				),
			},
			totalBytes: rawTotal || computedTotal,
		},
		campaigns,
	};
}

function buildStorageSegments(
	entries: Array<{ id: SettingsStorageSegmentId; bytes: number }>,
): SettingsStorageSegment[] {
	const nonZero = entries.filter((entry) => entry.bytes > 0);
	const sum = nonZero.reduce((acc, entry) => acc + entry.bytes, 0);
	if (sum <= 0) return [];
	let remaining = 100;
	return nonZero.map((entry, index) => {
		const rawPercent =
			index === nonZero.length - 1
				? remaining
				: Math.round(((entry.bytes / sum) * 100) * 10) / 10;
		const percent = Math.min(remaining, Math.max(0, rawPercent));
		remaining = Math.max(0, Math.round((remaining - percent) * 10) / 10);
		return {
			id: entry.id,
			bytes: entry.bytes,
			percent,
		};
	});
}

export function resolveScopedStorageSummary(
	overview: SettingsStorageOverview | null,
	scope: string,
	campaigns: SettingsCampaign[],
): ScopedSettingsStorageSummary | null {
	if (!overview) return null;
	if (scope === GLOBAL_SETTINGS_SCOPE) {
		const { project } = overview;
		return {
			isGlobalScope: true,
			campaignSlug: null,
			campaignName: null,
			totalBytes: project.totalBytes,
			contentBytes: project.contentBytes,
			imagesBytes: project.imagesBytes,
			generalImagesBytes: project.generalImagesBytes,
			appDataBytes: project.appDataBytes,
			aiHistory: { ...project.aiHistory },
			undoRedo: { ...project.undoRedo },
			segments: buildStorageSegments([
				{ id: "images", bytes: project.imagesBytes },
				{ id: "content", bytes: project.contentBytes },
				{ id: "ai", bytes: project.aiHistory.bytes },
				{ id: "undoRedo", bytes: project.undoRedo.bytes },
				{ id: "appData", bytes: project.appDataBytes },
			]),
		};
	}

	if (!scope) return null;
	const breakdown = overview.campaigns.find((item) => item.slug === scope);
	const knownCampaign = campaigns.find((item) => item.slug === scope);
	const contentBytes = breakdown?.contentBytes ?? 0;
	const imagesBytes = breakdown?.imagesBytes ?? 0;
	const aiBytes = breakdown?.aiHistory.bytes ?? 0;
	const aiCount = breakdown?.aiHistory.entryCount ?? 0;
	const undoBytes = breakdown?.undoRedo.bytes ?? 0;
	const undoCount = breakdown?.undoRedo.entryCount ?? 0;
	const totalBytes =
		breakdown?.totalBytes ?? contentBytes + imagesBytes + aiBytes + undoBytes;

	return {
		isGlobalScope: false,
		campaignSlug: scope,
		campaignName: breakdown?.name || knownCampaign?.name || scope,
		totalBytes,
		contentBytes,
		imagesBytes,
		generalImagesBytes: 0,
		appDataBytes: 0,
		aiHistory: {
			bytes: aiBytes,
			entryCount: aiCount,
			campaignsBytes: aiBytes,
			campaignsEntryCount: aiCount,
			bestiaryBytes: 0,
			bestiaryEntryCount: 0,
		},
		undoRedo: {
			bytes: undoBytes,
			entryCount: undoCount,
			applicationBytes: 0,
			applicationEntryCount: 0,
			tombstonesBytes: 0,
			campaignsBytes: undoBytes,
			campaignsEntryCount: undoCount,
		},
		segments: buildStorageSegments([
			{ id: "images", bytes: imagesBytes },
			{ id: "content", bytes: contentBytes },
			{ id: "ai", bytes: aiBytes },
			{ id: "undoRedo", bytes: undoBytes },
		]),
	};
}
