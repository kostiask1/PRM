import { useCallback, useEffect, useRef, useState } from "react";
import {
	ensureContextListItems,
	type ContextListConfig,
} from "./contextConfig.ts";
import {
	getAiCharacterContextKey,
	getAiLocationContextKey,
	type AiContextIdentityEntity,
} from "./contextIdentity.ts";

export type AiContextEntity = AiContextIdentityEntity;

export interface AiContextSession extends Record<string, unknown> {
	fileName: string;
	name?: string;
	data?: AiContextSessionData;
}

export interface AiContextScene extends Record<string, unknown> {
	id: string;
}

export interface AiContextSessionData extends Record<string, unknown> {
	scenes?: AiContextScene[];
}

export interface AiSessionSceneContextConfig extends Record<string, unknown> {
	included: boolean;
	summary: boolean;
	goal: boolean;
	stakes: boolean;
	location: boolean;
	notes: boolean;
	encounter: boolean;
}

export interface AiSessionContextConfig extends Record<string, unknown> {
	included: boolean;
	notes?: boolean;
	result_text?: boolean;
	scenes?: Record<string, AiSessionSceneContextConfig>;
	data?: AiContextSessionData;
}

export interface AiContextDataConfig extends Record<string, unknown> {
	campaignNotes: boolean;
	campaignCharacters: ContextListConfig;
	campaignNpcs: ContextListConfig;
	campaignLocations: ContextListConfig;
	sessions: Record<string, AiSessionContextConfig>;
}

export interface UseAiContextDataOptions {
	campaignSlug?: string | null;
	sessionSlug?: string | null;
	isBestiary?: boolean;
	isPanelOpen?: boolean;
	isContextModalOpen?: boolean;
	isImagePromptPickerOpen?: boolean;
	useContext?: boolean;
	listSessions(campaignSlug: string): Promise<AiContextSession[] | null>;
	getEntities(campaignSlug: string, type: string): Promise<AiContextEntity[] | null>;
	getSession(
		campaignSlug: string,
		fileName: string,
	): Promise<AiContextSession | null>;
	onLoadError?(message: string, error: unknown): void;
}

export const createInitialAiContextConfig = (
	sessionSlug?: string | null,
): AiContextDataConfig => ({
	campaignNotes: true,
	campaignCharacters: { included: true, items: {} },
	campaignNpcs: { included: true, items: {} },
	campaignLocations: { included: true, items: {} },
	sessions: sessionSlug
		? {
				[sessionSlug]: {
					included: true,
					notes: true,
					result_text: true,
					scenes: {},
				},
			}
		: {},
});

type LoadedSessionTuple = readonly [
	string,
	AiSessionContextConfig,
	AiContextSessionData,
];

type PendingSessionEntry = readonly [string, AiSessionContextConfig];
type ContextListConfigKey =
	| "campaignCharacters"
	| "campaignNpcs"
	| "campaignLocations";

function mergeLoadedSessionTuple(
	sessions: Record<string, AiSessionContextConfig>,
	[slug, fallbackConfig, data]: LoadedSessionTuple,
): boolean {
	if (sessions[slug]?.data) return false;
	sessions[slug] = {
		...(sessions[slug] || fallbackConfig),
		data,
	};
	return true;
}

export function mergeLoadedAiSessionData(
	current: AiContextDataConfig,
	loadedSessions: readonly LoadedSessionTuple[],
): AiContextDataConfig {
	const nextSessions = { ...(current.sessions || {}) };
	let changed = false;
	for (const loadedSession of loadedSessions) {
		if (mergeLoadedSessionTuple(nextSessions, loadedSession)) changed = true;
	}
	return changed ? { ...current, sessions: nextSessions } : current;
}

interface ContextDataVisibility {
	isBestiary?: boolean;
	isPanelOpen?: boolean;
	isContextModalOpen?: boolean;
	isImagePromptPickerOpen?: boolean;
	useContext?: boolean;
}

function isAnyContextSurfaceOpen({
	isPanelOpen,
	isContextModalOpen,
	isImagePromptPickerOpen,
}: ContextDataVisibility): boolean {
	return Boolean(
		isPanelOpen || isContextModalOpen || isImagePromptPickerOpen,
	);
}

function shouldLoadCampaignEntities(
	visibility: ContextDataVisibility,
): boolean {
	if (visibility.isBestiary) return false;
	if (visibility.isContextModalOpen || visibility.isImagePromptPickerOpen) {
		return true;
	}
	return Boolean(visibility.isPanelOpen && visibility.useContext);
}

function shouldLoadContextSessions(
	visibility: ContextDataVisibility,
): boolean {
	return Boolean(
		!visibility.isBestiary &&
			visibility.useContext &&
			isAnyContextSurfaceOpen(visibility),
	);
}

function getContextSessionHydrationCampaign(
	campaignSlug: string | null | undefined,
	visibility: ContextDataVisibility,
): string | null {
	if (visibility.isBestiary || !visibility.isPanelOpen || !visibility.useContext) {
		return null;
	}
	return campaignSlug || null;
}

function getPendingSessionEntries(
	sessions: Record<string, AiSessionContextConfig>,
): PendingSessionEntry[] {
	return Object.entries(sessions).filter(
		([, config]) => config?.included && !config?.data,
	);
}

async function loadContextSessionTuple(
	campaignSlug: string,
	[slug, config]: PendingSessionEntry,
	getSession: UseAiContextDataOptions["getSession"],
	onLoadError: NonNullable<UseAiContextDataOptions["onLoadError"]>,
): Promise<LoadedSessionTuple | null> {
	try {
		const session = await getSession(campaignSlug, slug);
		return [slug, config, session?.data || {}] as const;
	} catch (error) {
		onLoadError("Failed to load session for token estimate", error);
		return null;
	}
}

function loadContextSessionTuples(
	campaignSlug: string,
	entries: readonly PendingSessionEntry[],
	getSession: UseAiContextDataOptions["getSession"],
	onLoadError: NonNullable<UseAiContextDataOptions["onLoadError"]>,
): Promise<Array<LoadedSessionTuple | null>> {
	return Promise.all(
		entries.map((entry) =>
			loadContextSessionTuple(campaignSlug, entry, getSession, onLoadError),
		),
	);
}

function applyLoadedContextSessions(
	loaded: Array<LoadedSessionTuple | null>,
	cancelled: boolean,
	setContextConfig: (
		updater: (current: AiContextDataConfig) => AiContextDataConfig,
	) => void,
): void {
	if (cancelled) return;
	const valid = loaded.filter(
		(item): item is LoadedSessionTuple => Boolean(item),
	);
	if (valid.length === 0) return;
	setContextConfig((current) => mergeLoadedAiSessionData(current, valid));
}

function synchronizeContextList<T>(
	current: AiContextDataConfig,
	configKey: ContextListConfigKey,
	list: readonly T[],
	getKey: (item: T) => string,
): AiContextDataConfig {
	const next = ensureContextListItems(current[configKey], list, getKey);
	return next === current[configKey]
		? current
		: { ...current, [configKey]: next };
}

export function useAiContextData({
	campaignSlug,
	sessionSlug,
	isBestiary,
	isPanelOpen,
	isContextModalOpen,
	isImagePromptPickerOpen,
	useContext,
	listSessions,
	getEntities,
	getSession,
	onLoadError = console.error,
}: UseAiContextDataOptions) {
	const [sessionsList, setSessionsList] = useState<AiContextSession[]>([]);
	const [charactersList, setCharactersList] = useState<AiContextEntity[]>([]);
	const [npcsList, setNpcsList] = useState<AiContextEntity[]>([]);
	const [locationsList, setLocationsList] = useState<AiContextEntity[]>([]);
	const [contextConfig, setContextConfig] = useState(() =>
		createInitialAiContextConfig(sessionSlug),
	);
	const campaignEntitiesLoadedRef = useRef(false);

	const ensureSessions = useCallback(async () => {
		if (!campaignSlug) return [];
		if (sessionsList.length > 0) return sessionsList;
		try {
			const sessions = await listSessions(campaignSlug);
			const normalized = Array.isArray(sessions) ? sessions : [];
			setSessionsList(normalized);
			return normalized;
		} catch (error) {
			onLoadError("Failed to load sessions", error);
			return [];
		}
	}, [campaignSlug, listSessions, onLoadError, sessionsList]);

	const ensureCampaignEntities = useCallback(async () => {
		if (!campaignSlug || isBestiary) {
			return { characters: [], npcs: [], locations: [] };
		}
		if (campaignEntitiesLoadedRef.current) {
			return {
				characters: charactersList,
				npcs: npcsList,
				locations: locationsList,
			};
		}
		const load = async (type: string, label: string): Promise<AiContextEntity[]> => {
			try {
				const entities = await getEntities(campaignSlug, type);
				return Array.isArray(entities) ? entities : [];
			} catch (error) {
				onLoadError(`Failed to load ${label}`, error);
				return [];
			}
		};
		const [characters, npcs, locations] = await Promise.all([
			load("characters", "characters"),
			load("npc", "NPCs"),
			load("locations", "locations"),
		]);
		setCharactersList(characters);
		setNpcsList(npcs);
		setLocationsList(locations);
		campaignEntitiesLoadedRef.current = true;
		return { characters, npcs, locations };
	}, [
		campaignSlug,
		charactersList,
		getEntities,
		isBestiary,
		locationsList,
		npcsList,
		onLoadError,
	]);

	useEffect(() => {
		if (!shouldLoadCampaignEntities({
			isBestiary,
			isPanelOpen,
			isContextModalOpen,
			isImagePromptPickerOpen,
			useContext,
		})) return;
		void ensureCampaignEntities();
	}, [ensureCampaignEntities, isBestiary, isContextModalOpen, isImagePromptPickerOpen, isPanelOpen, useContext]);

	useEffect(() => {
		if (!shouldLoadContextSessions({
			isBestiary,
			isPanelOpen,
			isContextModalOpen,
			isImagePromptPickerOpen,
			useContext,
		})) return;
		void ensureSessions();
	}, [ensureSessions, isBestiary, isContextModalOpen, isImagePromptPickerOpen, isPanelOpen, useContext]);

	useEffect(() => {
		const hydrationCampaign = getContextSessionHydrationCampaign(
			campaignSlug,
			{ isBestiary, isPanelOpen, useContext },
		);
		if (!hydrationCampaign) return;
		const entries = getPendingSessionEntries(contextConfig.sessions || {});
		if (entries.length === 0) return;
		let cancelled = false;
		void loadContextSessionTuples(
			hydrationCampaign,
			entries,
			getSession,
			onLoadError,
		).then((loaded) => {
			applyLoadedContextSessions(loaded, cancelled, setContextConfig);
		});
		return () => {
			cancelled = true;
		};
	}, [campaignSlug, contextConfig.sessions, getSession, isBestiary, isPanelOpen, onLoadError, useContext]);

	useEffect(() => {
		if (charactersList.length === 0) return;
		setContextConfig((current) =>
			synchronizeContextList(
				current,
				"campaignCharacters",
				charactersList,
				getAiCharacterContextKey,
			),
		);
	}, [charactersList]);

	useEffect(() => {
		if (npcsList.length === 0) return;
		setContextConfig((current) =>
			synchronizeContextList(
				current,
				"campaignNpcs",
				npcsList,
				getAiCharacterContextKey,
			),
		);
	}, [npcsList]);

	useEffect(() => {
		if (locationsList.length === 0) return;
		setContextConfig((current) =>
			synchronizeContextList(
				current,
				"campaignLocations",
				locationsList,
				getAiLocationContextKey,
			),
		);
	}, [locationsList]);

	return {
		charactersList,
		contextConfig,
		ensureCampaignEntities,
		ensureSessions,
		locationsList,
		npcsList,
		sessionsList,
		setContextConfig,
	};
}
