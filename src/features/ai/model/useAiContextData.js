import { useCallback, useEffect, useRef, useState } from "react";
import { ensureContextListItems } from "./contextConfig.js";

export const createInitialAiContextConfig = (sessionSlug) => ({
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

const getLocationContextKey = (location) =>
	String(location?.slug || location?.id || location?.name || "").trim();

const getCharacterContextKey = (character) => {
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

export function mergeLoadedAiSessionData(current, loadedSessions) {
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
}) {
	const [sessionsList, setSessionsList] = useState([]);
	const [charactersList, setCharactersList] = useState([]);
	const [npcsList, setNpcsList] = useState([]);
	const [locationsList, setLocationsList] = useState([]);
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
		const load = async (type, label) => {
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
			entries.map(async ([slug, config]) => {
				try {
					const session = await getSession(campaignSlug, slug);
					return [slug, config, session?.data || {}];
				} catch (error) {
					onLoadError("Failed to load session for token estimate", error);
					return null;
				}
			}),
		).then((loaded) => {
			if (cancelled) return;
			const valid = loaded.filter(Boolean);
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
