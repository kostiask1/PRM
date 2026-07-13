import { useCallback, useEffect, useRef, useState } from "react";

export interface AiImagePromptSession extends Record<string, unknown> {
	fileName: string;
}

export type AiImagePromptMonster = Record<string, unknown>;

interface MonsterCollectionEnvelope {
	monster?: unknown;
	monsters?: unknown;
}

export interface UseAiImagePromptDataOptions {
	campaignSlug?: string | null;
	isCampaign?: boolean;
	isBestiary?: boolean;
	isPickerOpen?: boolean;
	ensureCampaignEntities(): Promise<unknown>;
	ensureSessions(): Promise<AiImagePromptSession[]>;
	getSession(
		campaignSlug: string,
		fileName: string,
	): Promise<AiImagePromptSession | null>;
	getCustomBestiaryData(): Promise<unknown>;
	onLoadError?(message: string, error: unknown): void;
}

export function normalizeCustomMonsterCollection(
	data: unknown,
): AiImagePromptMonster[] {
	const envelope =
		data && typeof data === "object" && !Array.isArray(data)
			? (data as MonsterCollectionEnvelope)
			: null;
	if (Array.isArray(envelope?.monster)) return envelope.monster;
	if (Array.isArray(envelope?.monsters)) return envelope.monsters;
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
}: UseAiImagePromptDataOptions) {
	const [sessions, setSessions] = useState<AiImagePromptSession[]>([]);
	const [customMonsters, setCustomMonsters] = useState<AiImagePromptMonster[]>([]);
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
		setSessions(
			loadedSessions.filter(
				(session): session is AiImagePromptSession => Boolean(session),
			),
		);
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
