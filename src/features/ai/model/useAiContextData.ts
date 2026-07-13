import { useCallback, useEffect, useRef, useState } from "react";
import {
	ensureContextListItems,
	type ContextListConfig,
} from "./contextConfig.ts";

export interface AiContextEntity extends Record<string, unknown> {
	id?: string | number;
	slug?: string;
	name?: string;
	title?: string;
	firstName?: string;
	first_name?: string;
	lastName?: string;
	last_name?: string;
}

export interface AiContextSession extends Record<string, unknown> {
	fileName: string;
	data?: Record<string, unknown>;
}

export interface AiSessionContextConfig extends Record<string, unknown> {
	included: boolean;
	notes?: boolean;
	result_text?: boolean;
	scenes?: Record<string, unknown>;
	data?: Record<string, unknown>;
}

export interface AiContextDataConfig {
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

const getLocationContextKey = (location: AiContextEntity) =>
	String(location?.slug || location?.id || location?.name || "").trim();

const getCharacterContextKey = (character: AiContextEntity) => {
	const fullName = `${character?.firstName || character?.first_name || ""} ${
		character?.lastName || character?.last_name || ""
	}`.trim();
	return String(
		character?.slug ||
			character?.id ||
			fullName ||
			character?.name ||
			character?.title ||
			"",
	).trim();
};

type LoadedSessionTuple = readonly [
	string,
	AiSessionContextConfig,
	Record<string, unknown>,
];

export function mergeLoadedAiSessionData(
	current: AiContextDataConfig,
	loadedSessions: readonly LoadedSessionTuple[],
): AiContextDataConfig {
	const nextSessions = { ...(current.sessions || {}) };
	let changed = false;
	for (const [slug, fallbackConfig, data] of loadedSessions) {
		if (nextSessions[slug]?.data) continue;
		nextSessions[slug] = {
			...(nextSessions[slug] || fallbackConfig),
			data,
		};
		changed = true;
	}
	return changed ? { ...current, sessions: nextSessions } : current;
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
		if (
			isBestiary ||
			(!isPanelOpen && !isContextModalOpen && !isImagePromptPickerOpen) ||
			(!useContext && !isContextModalOpen && !isImagePromptPickerOpen)
		) return;
		void ensureCampaignEntities();
	}, [ensureCampaignEntities, isBestiary, isContextModalOpen, isImagePromptPickerOpen, isPanelOpen, useContext]);

	useEffect(() => {
		if (
			isBestiary ||
			(!isPanelOpen && !isContextModalOpen && !isImagePromptPickerOpen) ||
			!useContext
		) return;
		void ensureSessions();
	}, [ensureSessions, isBestiary, isContextModalOpen, isImagePromptPickerOpen, isPanelOpen, useContext]);

	useEffect(() => {
		if (isBestiary || !isPanelOpen || !useContext || !campaignSlug) return;
		const entries = Object.entries(contextConfig.sessions || {}).filter(
			([, config]) => config?.included && !config?.data,
		);
		if (entries.length === 0) return;
		let cancelled = false;
		Promise.all(
			entries.map(async ([slug, config]): Promise<LoadedSessionTuple | null> => {
				try {
					const session = await getSession(campaignSlug, slug);
					return [slug, config, session?.data || {}] as const;
				} catch (error) {
					onLoadError("Failed to load session for token estimate", error);
					return null;
				}
			}),
		).then((loaded) => {
			if (cancelled) return;
			const valid = loaded.filter(
				(item): item is LoadedSessionTuple => Boolean(item),
			);
			if (valid.length > 0) {
				setContextConfig((current) => mergeLoadedAiSessionData(current, valid));
			}
		});
		return () => {
			cancelled = true;
		};
	}, [campaignSlug, contextConfig.sessions, getSession, isBestiary, isPanelOpen, onLoadError, useContext]);

	useEffect(() => {
		if (charactersList.length === 0) return;
		setContextConfig((current) => {
			const next = ensureContextListItems(current.campaignCharacters, charactersList, getCharacterContextKey);
			return next === current.campaignCharacters ? current : { ...current, campaignCharacters: next };
		});
	}, [charactersList]);

	useEffect(() => {
		if (npcsList.length === 0) return;
		setContextConfig((current) => {
			const next = ensureContextListItems(current.campaignNpcs, npcsList, getCharacterContextKey);
			return next === current.campaignNpcs ? current : { ...current, campaignNpcs: next };
		});
	}, [npcsList]);

	useEffect(() => {
		if (locationsList.length === 0) return;
		setContextConfig((current) => {
			const next = ensureContextListItems(current.campaignLocations, locationsList, getLocationContextKey);
			return next === current.campaignLocations ? current : { ...current, campaignLocations: next };
		});
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
