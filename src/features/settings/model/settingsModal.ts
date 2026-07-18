import type { CampaignRecord } from "../../../entities/campaign/index.js";
import { normalizeIgnoreSourcesList } from "../../../entities/reference/model.js";

export const DEFAULT_IMAGE_PROMPT_BASE_PROMPT =
	"cinematic, photorealistic, ultra realistic, high detail, 8k, dramatic lighting, volumetric light, sharp focus, depth of field, film still, concept art";
export const GLOBAL_SETTINGS_SCOPE = "__global__";

export type SettingsSaveStatus = "idle" | "saving";
export type SettingsPromptMap = Record<string, string>;
export type CampaignIgnoreSourcesMap = Record<string, string[]>;

export interface SettingsCampaign extends CampaignRecord {
	ignoreSourcesList?: unknown;
}

export interface PromptSettingsPayload extends Record<string, unknown> {
	aiBasePrompt: string;
	imagePromptBasePrompt: string;
	campaignAiBasePrompts: SettingsPromptMap;
	campaignImagePromptBasePrompts: SettingsPromptMap;
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
