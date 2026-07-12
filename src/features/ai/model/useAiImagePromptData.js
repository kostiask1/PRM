import { useCallback, useEffect, useRef, useState } from "react";

export function normalizeCustomMonsterCollection(data) {
	if (Array.isArray(data?.monster)) return data.monster;
	if (Array.isArray(data?.monsters)) return data.monsters;
	return Array.isArray(data) ? data : [];
}

export function useAiImagePromptData({
	campaignSlug,
	isCampaign,
	isBestiary,
	isPickerOpen,
	ensureCampaignEntities,
	ensureSessions,
	getSession,
	getCustomBestiaryData,
	onLoadError = console.error,
}) {
	const [sessions, setSessions] = useState([]);
	const [customMonsters, setCustomMonsters] = useState([]);
	const [isLoading, setIsLoading] = useState(false);
	const campaignLoadedRef = useRef(false);
	const bestiaryLoadedRef = useRef(false);

	const loadCampaignData = useCallback(async () => {
		if (!campaignSlug) return;
		await ensureCampaignEntities();
		if (!isCampaign || campaignLoadedRef.current) return;
		const sessionEntries = await ensureSessions();
		const loadedSessions = await Promise.all(
			sessionEntries.map((session) =>
				getSession(campaignSlug, session.fileName).catch((error) => {
					onLoadError("Failed to load session for image prompt", error);
					return null;
				}),
			),
		);
		setSessions(loadedSessions.filter(Boolean));
		campaignLoadedRef.current = true;
	}, [
		campaignSlug,
		ensureCampaignEntities,
		ensureSessions,
		getSession,
		isCampaign,
		onLoadError,
	]);

	const loadBestiaryData = useCallback(async () => {
		if (bestiaryLoadedRef.current) return;
		try {
			const data = await getCustomBestiaryData();
			setCustomMonsters(normalizeCustomMonsterCollection(data));
		} catch (error) {
			onLoadError("Failed to load custom monsters for image prompt", error);
			setCustomMonsters([]);
		}
		bestiaryLoadedRef.current = true;
	}, [getCustomBestiaryData, onLoadError]);

	const prepareImagePromptData = useCallback(async () => {
		setIsLoading(true);
		try {
			if (isBestiary) {
				await loadBestiaryData();
			} else if (campaignSlug) {
				await loadCampaignData();
			}
		} finally {
			setIsLoading(false);
		}
	}, [campaignSlug, isBestiary, loadBestiaryData, loadCampaignData]);

	useEffect(() => {
		if (!isPickerOpen) return;
		void prepareImagePromptData();
	}, [isPickerOpen, prepareImagePromptData]);

	return {
		customMonsters,
		isLoading,
		prepareImagePromptData,
		sessions,
	};
}
