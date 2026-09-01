import { useState, type Dispatch, type SetStateAction } from "react";
import {
	getContextListConfig,
	setAllContextListItems,
	updateContextConfigValue,
	updateContextListIncluded,
	updateContextListItem,
	useAiContextData,
	type AiContextDataConfig,
	type AiContextConfiguration,
	type AiContextEntity,
	type AiContextSession,
	type ContextListConfig,
} from "../../../features/ai/index.js";
import {
	getAiAssistantContextProjection,
	type AiAssistantContextProjection,
} from "./assistantContext.ts";

export interface UseAiAssistantContextControllerOptions {
	campaignSlug?: string | null;
	sessionSlug?: string | null;
	isBestiary: boolean;
	isCampaign: boolean;
	isEncounter: boolean;
	isPanelOpen: boolean;
	isContextModalOpen: boolean;
	isImagePromptPickerOpen: boolean;
	useContext: boolean;
	parseAiResponse: boolean;
	generateEncounters: boolean;
	activeCampaign?: unknown;
	activeSession?: unknown;
	activeEncounter?: unknown;
	listSessions(campaignSlug: string): Promise<AiContextSession[] | null>;
	getEntities(
		campaignSlug: string,
		type: string,
	): Promise<AiContextEntity[] | null>;
	getSession(
		campaignSlug: string,
		fileName: string,
	): Promise<AiContextSession | null>;
}

export interface AiAssistantContextController
	extends AiAssistantContextProjection {
	charactersList: AiContextEntity[];
	npcsList: AiContextEntity[];
	locationsList: AiContextEntity[];
	sessionsList: AiContextSession[];
	contextConfig: AiContextDataConfig;
	setContextConfig: Dispatch<SetStateAction<AiContextDataConfig>>;
	ensureCampaignEntities: ReturnType<typeof useAiContextData>["ensureCampaignEntities"];
	ensureSessions: ReturnType<typeof useAiContextData>["ensureSessions"];
	expandedSessions: Record<string, boolean>;
	isLoading: boolean;
	characterContext: ContextListConfig;
	npcContext: ContextListConfig;
	locationContext: ContextListConfig;
	characterContextItems: Record<string, boolean>;
	npcContextItems: Record<string, boolean>;
	locationContextItems: Record<string, boolean>;
	toggleSessionDetails(sessionSlug: string): Promise<void>;
	updateContextConfig(path: string[], value: unknown): void;
	updateCampaignContextListIncluded(contextKey: string, included: boolean): void;
	updateCampaignContextListItem(
		contextKey: string,
		itemKey: string,
		value: boolean,
	): void;
	setAllCampaignContextItems<T>(
		contextKey: string,
		list: readonly T[],
		getKey: (item: T) => string,
		checked: boolean,
	): void;
}

function mergeSessionData(
	current: AiContextDataConfig,
	sessionSlug: string,
	data: Record<string, unknown>,
): AiContextDataConfig {
	return {
		...current,
		sessions: {
			...current.sessions,
			[sessionSlug]: {
				...(current.sessions[sessionSlug] || {
					included: false,
					notes: true,
					result_text: true,
					scenes: {},
				}),
				data,
			},
		},
	};
}

function mergeContextUpdate(
	current: AiContextDataConfig,
	updated: AiContextConfiguration | null | undefined,
): AiContextDataConfig {
	return { ...current, ...(updated || {}) } as AiContextDataConfig;
}

export function useAiAssistantContextController(
	options: UseAiAssistantContextControllerOptions,
): AiAssistantContextController {
	const contextData = useAiContextData({
		campaignSlug: options.campaignSlug,
		sessionSlug: options.sessionSlug,
		isBestiary: options.isBestiary,
		isPanelOpen: options.isPanelOpen,
		isContextModalOpen: options.isContextModalOpen,
		isImagePromptPickerOpen: options.isImagePromptPickerOpen,
		useContext: options.useContext,
		listSessions: options.listSessions,
		getEntities: options.getEntities,
		getSession: options.getSession,
	});
	const [expandedSessions, setExpandedSessions] = useState<
		Record<string, boolean>
	>({});
	const [isLoading, setIsLoading] = useState(false);
	const projection = getAiAssistantContextProjection({
		activeCampaign: options.activeCampaign,
		activeSession: options.activeSession,
		activeEncounter: options.activeEncounter,
		characters: contextData.charactersList,
		npcs: contextData.npcsList,
		locations: contextData.locationsList,
		isBestiary: options.isBestiary,
		isCampaign: options.isCampaign,
		isEncounter: options.isEncounter,
		parseAiResponse: options.parseAiResponse,
		generateEncounters: options.generateEncounters,
	});
	const characterContext = getContextListConfig(
		contextData.contextConfig.campaignCharacters,
	);
	const npcContext = getContextListConfig(
		contextData.contextConfig.campaignNpcs,
	);
	const locationContext = getContextListConfig(
		contextData.contextConfig.campaignLocations,
	);

	const toggleSessionDetails = async (sessionSlug: string) => {
		const isExpanded = Boolean(expandedSessions[sessionSlug]);
		const sessionConfig = contextData.contextConfig.sessions[sessionSlug];
		if (!isExpanded && !sessionConfig?.data && options.campaignSlug) {
			setIsLoading(true);
			try {
				const session = await options.getSession(
					options.campaignSlug,
					sessionSlug,
				);
				contextData.setContextConfig((current) =>
					mergeSessionData(current, sessionSlug, session?.data || {}),
				);
			} catch (error) {
				console.error("Failed to fetch session details", error);
			} finally {
				setIsLoading(false);
			}
		}
		setExpandedSessions((current) => ({
			...current,
			[sessionSlug]: !isExpanded,
		}));
	};
	const updateContextConfig = (path: string[], value: unknown) => {
		contextData.setContextConfig((current) =>
			mergeContextUpdate(
				current,
				updateContextConfigValue(current, path, value),
			),
		);
	};
	const updateCampaignContextListIncluded = (
		contextKey: string,
		included: boolean,
	) => {
		contextData.setContextConfig((current) =>
			mergeContextUpdate(
				current,
				updateContextListIncluded(current, contextKey, included),
			),
		);
	};
	const updateCampaignContextListItem = (
		contextKey: string,
		itemKey: string,
		value: boolean,
	) => {
		contextData.setContextConfig((current) =>
			mergeContextUpdate(
				current,
				updateContextListItem(current, contextKey, itemKey, value),
			),
		);
	};
	const setAllCampaignContextItems = <T,>(
		contextKey: string,
		list: readonly T[],
		getKey: (item: T) => string,
		checked: boolean,
	) => {
		contextData.setContextConfig((current) =>
			mergeContextUpdate(
				current,
				setAllContextListItems(
					current,
					contextKey,
					list,
					getKey,
					checked,
				),
			),
		);
	};

	return {
		...contextData,
		...projection,
		expandedSessions,
		isLoading,
		characterContext,
		npcContext,
		locationContext,
		characterContextItems: characterContext.items,
		npcContextItems: npcContext.items,
		locationContextItems: locationContext.items,
		toggleSessionDetails,
		updateContextConfig,
		updateCampaignContextListIncluded,
		updateCampaignContextListItem,
		setAllCampaignContextItems,
	};
}
