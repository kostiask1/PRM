import type {
	AiChatContextPreview,
	AiContextCatalogItem,
	AiContextSettings,
} from "./aiChatTypes.ts";

export type ContextSectionKey =
	| "currentSession"
	| "characters"
	| "npcs"
	| "locations"
	| "recentSessions"
	| "bestiary";

export type ContextSelectionState = "all" | "partial" | "none";

export interface ContextTokenBreakdown {
	systemTokens: number;
	contextTokens: number;
	historyTokens: number;
	totalTokens: number;
	sectionTokens: Record<ContextSectionKey, number>;
}

interface SectionSettingMapping {
	includeKey:
		| "includeCurrentScene"
		| "includeCampaignCharacters"
		| "includeCampaignNpc"
		| "includeCampaignLocations"
		| "includeRecentSessionHistory"
		| "includeBestiary";
	selectedKey:
		| "selectedSceneIds"
		| "selectedCharacterIds"
		| "selectedNpcIds"
		| "selectedLocationIds"
		| "selectedSessionFileNames"
		| "selectedBestiaryIds";
	defaultLimit: number | null;
}

const SECTION_SETTING_MAP: Record<ContextSectionKey, SectionSettingMapping> = {
	currentSession: {
		includeKey: "includeCurrentScene",
		selectedKey: "selectedSceneIds",
		defaultLimit: null,
	},
	characters: {
		includeKey: "includeCampaignCharacters",
		selectedKey: "selectedCharacterIds",
		defaultLimit: null,
	},
	npcs: {
		includeKey: "includeCampaignNpc",
		selectedKey: "selectedNpcIds",
		defaultLimit: null,
	},
	locations: {
		includeKey: "includeCampaignLocations",
		selectedKey: "selectedLocationIds",
		defaultLimit: null,
	},
	recentSessions: {
		includeKey: "includeRecentSessionHistory",
		selectedKey: "selectedSessionFileNames",
		defaultLimit: 3,
	},
	bestiary: {
		includeKey: "includeBestiary",
		selectedKey: "selectedBestiaryIds",
		defaultLimit: 25,
	},
};

function isSectionEnabled(section: ContextSectionKey, settings: AiContextSettings): boolean {
	if (section === "characters") {
		return settings.includeCampaignCharacters !== undefined
			? settings.includeCampaignCharacters !== false
			: settings.includeCampaignNpc !== false;
	}
	const { includeKey } = SECTION_SETTING_MAP[section];
	return Boolean(settings[includeKey]);
}

function getSectionSelectedArray(
	section: ContextSectionKey,
	settings: AiContextSettings,
): string[] | null {
	const { selectedKey } = SECTION_SETTING_MAP[section];
	const raw = settings[selectedKey];
	return Array.isArray(raw) ? raw : null;
}

/** Returns the active IDs sent to the model for a section under the current settings. */
export function getEffectiveSelectedIds(
	section: ContextSectionKey,
	settings: AiContextSettings,
	items: readonly Pick<AiContextCatalogItem, "id">[],
	defaultRecentCount = 3,
): Set<string> {
	if (!isSectionEnabled(section, settings)) return new Set();
	const selectedArray = getSectionSelectedArray(section, settings);
	const availableIds = new Set(items.map((item) => item.id));
	if (selectedArray !== null) {
		return new Set(selectedArray.filter((id) => availableIds.has(id)));
	}
	const defaultLimit =
		section === "recentSessions"
			? defaultRecentCount
			: SECTION_SETTING_MAP[section].defaultLimit;
	const defaultSlice = defaultLimit ? items.slice(0, defaultLimit) : items;
	return new Set(defaultSlice.map((item) => item.id));
}

/** Computes tri-state ("all" | "partial" | "none") and item counts for a context accordion section. */
export function getSectionSelectionState(
	section: ContextSectionKey,
	settings: AiContextSettings,
	items: readonly Pick<AiContextCatalogItem, "id">[],
	defaultRecentCount = 3,
): { state: ContextSelectionState; selectedCount: number; totalCount: number } {
	const totalCount = items.length;
	const enabled = isSectionEnabled(section, settings);
	if (!enabled) {
		return { state: "none", selectedCount: 0, totalCount };
	}
	const selectedArray = getSectionSelectedArray(section, settings);
	if (totalCount === 0) {
		return { state: "all", selectedCount: 0, totalCount: 0 };
	}
	const effective = getEffectiveSelectedIds(section, settings, items, defaultRecentCount);
	const selectedCount = effective.size;
	if (selectedArray !== null && selectedCount === 0) {
		return { state: "none", selectedCount: 0, totalCount };
	}
	if (selectedCount >= totalCount) {
		return { state: "all", selectedCount: totalCount, totalCount };
	}
	return { state: "partial", selectedCount, totalCount };
}

/** Toggles an entire context section between all-default and completely off. */
export function toggleContextSection(
	section: ContextSectionKey,
	settings: AiContextSettings,
): AiContextSettings {
	const { includeKey, selectedKey } = SECTION_SETTING_MAP[section];
	const enabled = isSectionEnabled(section, settings);
	const selectedArray = getSectionSelectedArray(section, settings);
	const currentlyActive = enabled && !(selectedArray !== null && selectedArray.length === 0);
	return {
		...settings,
		[includeKey]: !currentlyActive,
		[selectedKey]: null,
	};
}

/** Toggles one item inside a context section, collapsing back to null ("auto-all") when all items match default full inclusion. */
export function toggleContextItem(
	section: ContextSectionKey,
	settings: AiContextSettings,
	itemId: string,
	allItemIds: readonly string[],
	defaultRecentCount = 3,
): AiContextSettings {
	const { includeKey, selectedKey } = SECTION_SETTING_MAP[section];
	const stubItems = allItemIds.map((id) => ({ id }));
	const currentSet = getEffectiveSelectedIds(section, settings, stubItems, defaultRecentCount);
	if (currentSet.has(itemId)) {
		currentSet.delete(itemId);
	} else {
		currentSet.add(itemId);
	}

	const nextIds = allItemIds.filter((id) => currentSet.has(id));
	if (nextIds.length === 0) {
		return {
			...settings,
			[includeKey]: false,
			[selectedKey]: null,
		};
	}

	const defaultLimit =
		section === "recentSessions"
			? defaultRecentCount
			: SECTION_SETTING_MAP[section].defaultLimit;
	const canCollapseToNull =
		nextIds.length === allItemIds.length &&
		(!defaultLimit || allItemIds.length <= defaultLimit);

	return {
		...settings,
		[includeKey]: true,
		[selectedKey]: canCollapseToNull ? null : nextIds,
	};
}

/** Selects every item in a section explicitly (keeping explicit IDs if the backend default has a cap). */
export function selectAllContextItems(
	section: ContextSectionKey,
	settings: AiContextSettings,
	allItemIds: readonly string[],
	defaultRecentCount = 3,
): AiContextSettings {
	const { includeKey, selectedKey } = SECTION_SETTING_MAP[section];
	const defaultLimit =
		section === "recentSessions"
			? defaultRecentCount
			: SECTION_SETTING_MAP[section].defaultLimit;
	const needsExplicitList = Boolean(defaultLimit && allItemIds.length > defaultLimit);
	return {
		...settings,
		[includeKey]: true,
		[selectedKey]: needsExplicitList ? [...allItemIds] : null,
	};
}

/** Disables all items in a context section cleanly. */
export function clearContextItems(
	section: ContextSectionKey,
	settings: AiContextSettings,
): AiContextSettings {
	const { includeKey, selectedKey } = SECTION_SETTING_MAP[section];
	return {
		...settings,
		[includeKey]: false,
		[selectedKey]: null,
	};
}

/** Calculates instant client-side token breakdown from cached context preview catalog and current selection state. */
export function calculateLiveContextTokens(
	preview: AiChatContextPreview | null,
	settings: AiContextSettings,
): ContextTokenBreakdown {
	const emptySections: Record<ContextSectionKey, number> = {
		currentSession: 0,
		characters: 0,
		npcs: 0,
		locations: 0,
		recentSessions: 0,
		bestiary: 0,
	};
	if (!preview) {
		return {
			systemTokens: 0,
			contextTokens: 0,
			historyTokens: 0,
			totalTokens: 0,
			sectionTokens: emptySections,
		};
	}

	const recentLimit = preview.defaultRecentSessionCount || 3;
	const sumSectionItems = (section: ContextSectionKey, items: readonly AiContextCatalogItem[]) => {
		const activeIds = getEffectiveSelectedIds(section, settings, items, recentLimit);
		let sum = 0;
		for (const item of items) {
			if (activeIds.has(item.id)) {
				sum += Number(item.tokenEstimate) || 0;
			}
		}
		return sum;
	};

	const scenesTokens =
		preview.hasActiveSession && settings.includeCurrentScene
			? (preview.currentSessionBaseTokens || 0) +
				sumSectionItems("currentSession", preview.catalog.scenes)
			: 0;
	const charactersTokens = sumSectionItems("characters", preview.catalog.characters);
	const npcsTokens = sumSectionItems("npcs", preview.catalog.npcs);
	const locationsTokens = sumSectionItems("locations", preview.catalog.locations);
	const recentSessionsTokens = sumSectionItems("recentSessions", preview.catalog.sessions);
	const bestiaryTokens = sumSectionItems("bestiary", preview.catalog.bestiary);

	const contextTokens =
		(preview.campaignBaseTokens || 0) +
		scenesTokens +
		charactersTokens +
		npcsTokens +
		locationsTokens +
		recentSessionsTokens +
		bestiaryTokens;
	const systemTokens = preview.systemTokens || 0;
	const historyTokens = preview.historyTokens || 0;

	return {
		systemTokens,
		contextTokens,
		historyTokens,
		totalTokens: systemTokens + contextTokens + historyTokens,
		sectionTokens: {
			currentSession: scenesTokens,
			characters: charactersTokens,
			npcs: npcsTokens,
			locations: locationsTokens,
			recentSessions: recentSessionsTokens,
			bestiary: bestiaryTokens,
		},
	};
}

/** Formats compact token count labels (~420, ~1.8K). */
export function formatTokenBadge(tokens: number): string {
	const value = Math.max(0, Math.round(Number(tokens) || 0));
	if (value >= 1000) {
		const k = value / 1000;
		return `~${k >= 10 ? Math.round(k) : k.toFixed(1)}K`;
	}
	return `~${value}`;
}
