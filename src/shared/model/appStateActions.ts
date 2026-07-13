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

export function setUiSettingsAction(
	payload: UiSettingsInput | null | undefined,
): AppStateAction {
	const nextPayload: NormalizedUiSettingsPatch = {};
	if (payload && Object.prototype.hasOwnProperty.call(payload, "theme")) {
		nextPayload.theme = payload.theme === "dark" ? "dark" : "light";
	}
	if (
		payload &&
		Object.prototype.hasOwnProperty.call(payload, "encounterViewMode")
	) {
		nextPayload.encounterViewMode =
			payload.encounterViewMode === "grid" ? "grid" : "single";
	}
	if (
		payload &&
		Object.prototype.hasOwnProperty.call(payload, "encounterGridColumns")
	) {
		const columns = Number.parseInt(String(payload.encounterGridColumns), 10);
		nextPayload.encounterGridColumns = Math.min(
			4,
			Math.max(1, Number.isFinite(columns) ? columns : 2),
		);
	}
	if (
		payload &&
		Object.prototype.hasOwnProperty.call(payload, "simplifiedNotes")
	) {
		nextPayload.simplifiedNotes = Boolean(payload.simplifiedNotes);
	}
	if (payload && Object.prototype.hasOwnProperty.call(payload, "aiBasePrompt")) {
		nextPayload.aiBasePrompt = String(payload.aiBasePrompt || "");
	}
	if (
		payload &&
		Object.prototype.hasOwnProperty.call(payload, "imagePromptBasePrompt")
	) {
		nextPayload.imagePromptBasePrompt = String(
			payload.imagePromptBasePrompt || "",
		);
	}
	if (
		payload &&
		Object.prototype.hasOwnProperty.call(payload, "campaignAiBasePrompts")
	) {
		nextPayload.campaignAiBasePrompts = normalizePromptMap(
			payload.campaignAiBasePrompts,
		);
	}
	if (
		payload &&
		Object.prototype.hasOwnProperty.call(
			payload,
			"campaignImagePromptBasePrompts",
		)
	) {
		nextPayload.campaignImagePromptBasePrompts = normalizePromptMap(
			payload.campaignImagePromptBasePrompts,
		);
	}
	if (
		payload &&
		Object.prototype.hasOwnProperty.call(payload, "ignoreSourcesList")
	) {
		nextPayload.ignoreSourcesList = Array.from(
			new Set(
				(Array.isArray(payload.ignoreSourcesList)
					? payload.ignoreSourcesList
					: []
				)
					.map((source) => String(source || "").trim().toUpperCase())
					.filter(Boolean),
			),
		).sort((a, b) => a.localeCompare(b));
	}
	if (
		payload &&
		Object.prototype.hasOwnProperty.call(payload, "autoApplyAiChanges")
	) {
		nextPayload.autoApplyAiChanges = payload.autoApplyAiChanges !== false;
	}
	if (
		payload &&
		Object.prototype.hasOwnProperty.call(payload, "useSearchDebounce")
	) {
		nextPayload.useSearchDebounce = payload.useSearchDebounce !== false;
	}

	return { type: SET_UI_SETTINGS, payload: nextPayload };
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
