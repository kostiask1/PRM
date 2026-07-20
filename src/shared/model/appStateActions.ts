export const REFRESH_ENTITIES = "entities/refresh";
export const SET_NAVIGATION = "navigation/set";
export const SET_CAMPAIGNS = "campaigns/set";
export const SET_ACTIVE_CAMPAIGN = "active/setCampaign";
export const SET_ACTIVE_SESSION = "active/setSession";
export const SET_ACTIVE_ENCOUNTER = "active/setEncounter";
export const REQUEST_CAMPAIGNS_RELOAD = "campaigns/requestReload";
export const SET_LANGUAGE = "language/set";
export const SET_UI_SETTINGS = "ui/setSettings";
export const DATA_SYNC_RECEIVED = "sync/dataReceived";

export interface NavigationStatePatch {
	activeCampaignSlug?: string | null;
	activeSessionFileName?: string | null;
	activeEncounterId?: string | number | null;
}

export interface UiSettingsInput extends Record<string, unknown> {
	theme?: unknown;
	encounterViewMode?: unknown;
	encounterGridColumns?: unknown;
	simplifiedNotes?: unknown;
	aiBasePrompt?: unknown;
	imagePromptBasePrompt?: unknown;
	campaignAiBasePrompts?: unknown;
	campaignImagePromptBasePrompts?: unknown;
	ignoreSourcesList?: unknown;
	autoApplyAiChanges?: unknown;
	useSearchDebounce?: unknown;
}

export interface NormalizedUiSettingsPatch {
	theme?: "light" | "dark";
	encounterViewMode?: "grid" | "single";
	encounterGridColumns?: number;
	simplifiedNotes?: boolean;
	aiBasePrompt?: string;
	imagePromptBasePrompt?: string;
	campaignAiBasePrompts?: Record<string, string>;
	campaignImagePromptBasePrompts?: Record<string, string>;
	ignoreSourcesList?: string[];
	autoApplyAiChanges?: boolean;
	useSearchDebounce?: boolean;
}

type UiSettingsField = keyof NormalizedUiSettingsPatch;
type UiSettingsFieldPolicies = {
	[K in UiSettingsField]-?: (
		value: unknown,
	) => Required<NormalizedUiSettingsPatch>[K];
};

export type SyncEvent = object;

export type AppStateAction =
	| { type: typeof REFRESH_ENTITIES }
	| { type: typeof SET_NAVIGATION; payload: NavigationStatePatch }
	| { type: typeof SET_CAMPAIGNS; payload: unknown[] }
	| { type: typeof SET_ACTIVE_CAMPAIGN; payload: unknown | null }
	| { type: typeof SET_ACTIVE_SESSION; payload: unknown | null }
	| { type: typeof SET_ACTIVE_ENCOUNTER; payload: unknown | null }
	| { type: typeof REQUEST_CAMPAIGNS_RELOAD }
	| { type: typeof SET_LANGUAGE; payload: string }
	| { type: typeof SET_UI_SETTINGS; payload: NormalizedUiSettingsPatch }
	| { type: typeof DATA_SYNC_RECEIVED; payload: SyncEvent | null };

export function refreshEntitiesAction(): AppStateAction {
	return { type: REFRESH_ENTITIES };
}

export function setNavigationAction(
	payload: NavigationStatePatch,
): AppStateAction {
	return { type: SET_NAVIGATION, payload };
}

export function setCampaignsAction(payload: unknown): AppStateAction {
	return {
		type: SET_CAMPAIGNS,
		payload: Array.isArray(payload) ? payload : [],
	};
}

export function setActiveCampaignAction(payload: unknown): AppStateAction {
	return { type: SET_ACTIVE_CAMPAIGN, payload: payload || null };
}

export function setActiveSessionAction(payload: unknown): AppStateAction {
	return { type: SET_ACTIVE_SESSION, payload: payload || null };
}

export function setActiveEncounterAction(payload: unknown): AppStateAction {
	return { type: SET_ACTIVE_ENCOUNTER, payload: payload || null };
}

export function requestCampaignsReloadAction(): AppStateAction {
	return { type: REQUEST_CAMPAIGNS_RELOAD };
}

export function setLanguageAction(payload: unknown): AppStateAction {
	return {
		type: SET_LANGUAGE,
		payload: String(payload || "").toLowerCase(),
	};
}

function normalizeEncounterGridColumns(value: unknown): number {
	const columns = Number.parseInt(String(value), 10);
	return Math.min(4, Math.max(1, Number.isFinite(columns) ? columns : 2));
}

function normalizePromptValue(value: unknown): string {
	return String(value || "");
}

function normalizeIgnoreSourcesList(value: unknown): string[] {
	const sources = Array.isArray(value) ? value : [];
	return Array.from(
		new Set(
			sources
				.map((source) => String(source || "").trim().toUpperCase())
				.filter(Boolean),
		),
	).sort((a, b) => a.localeCompare(b));
}

function normalizeEnabledByDefault(value: unknown): boolean {
	return value !== false;
}

const UI_SETTINGS_FIELD_POLICIES: UiSettingsFieldPolicies = {
	theme: (value) => (value === "dark" ? "dark" : "light"),
	encounterViewMode: (value) => (value === "grid" ? "grid" : "single"),
	encounterGridColumns: normalizeEncounterGridColumns,
	simplifiedNotes: Boolean,
	aiBasePrompt: normalizePromptValue,
	imagePromptBasePrompt: normalizePromptValue,
	campaignAiBasePrompts: normalizePromptMap,
	campaignImagePromptBasePrompts: normalizePromptMap,
	ignoreSourcesList: normalizeIgnoreSourcesList,
	autoApplyAiChanges: normalizeEnabledByDefault,
	useSearchDebounce: normalizeEnabledByDefault,
};

function hasOwnUiSetting(
	payload: UiSettingsInput,
	field: UiSettingsField,
): boolean {
	return Object.prototype.hasOwnProperty.call(payload, field);
}

export function normalizeUiSettingsPatch(
	payload: UiSettingsInput | null | undefined,
): NormalizedUiSettingsPatch {
	if (!payload) return {};
	const entries = (Object.keys(UI_SETTINGS_FIELD_POLICIES) as UiSettingsField[])
		.filter((field) => hasOwnUiSetting(payload, field))
		.map((field) => [field, UI_SETTINGS_FIELD_POLICIES[field](payload[field])]);
	return Object.fromEntries(entries) as NormalizedUiSettingsPatch;
}

export function setUiSettingsAction(
	payload: UiSettingsInput | null | undefined,
): AppStateAction {
	return { type: SET_UI_SETTINGS, payload: normalizeUiSettingsPatch(payload) };
}

function normalizePromptMap(value: unknown): Record<string, string> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	return Object.fromEntries(
		Object.entries(value).map(([slug, prompt]) => [
			String(slug),
			String(prompt || ""),
		]),
	);
}

export function dataSyncReceivedAction(payload: unknown): AppStateAction {
	return {
		type: DATA_SYNC_RECEIVED,
		payload:
			payload && typeof payload === "object" ? (payload as SyncEvent) : null,
	};
}
