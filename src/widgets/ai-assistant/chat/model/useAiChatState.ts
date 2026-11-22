import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import {
	MAX_AI_ATTACHMENTS,
	MAX_AI_FILE_BYTES,
	MAX_AI_IMAGE_BYTES,
	aiApi,
	getAttachedFileKey,
	getAttachedImageKey,
	getSupportedAiFileMimeType,
	getSupportedAiImageMimeType,
	readFileAsBase64,
	saveGeminiApiKeyAndRefreshModels,
	type AiChatActionMutationResult,
	type AiChatAnchor,
	type AiChatRecord,
	type AiHistoryEntry,
	type AiHistoryResource,
	type AiModelDescriptor,
} from "../../../../features/ai/index.js";
import { makeDomId } from "../../../../shared/lib/index.js";
import { useAiAssistantRuntime } from "../../ui/AiAssistantRuntime.tsx";
import { useAiAssistantUpdatedData } from "../../model/useAiAssistantUpdatedData.ts";
import type {
	AiActionCard,
	AiChatAnchorData,
	AiChatAttachment,
	AiChatSession,
	AiChatSessionSummary,
	AiContextAnchor,
	AiContextSettings,
	AiModelOption,
	AiWorkspaceContext,
	ChatMessage,
} from "./aiChatTypes.ts";
import { AI_MODELS, DEFAULT_AI_MODEL } from "./aiModels.ts";

const INITIAL_CONTEXT_SETTINGS: AiContextSettings = {
	includeCurrentScene: true,
	includeCampaignNpc: true,
	includeCampaignLocations: true,
	includeRecentSessionHistory: false,
	includeBestiary: false,
	mutationPermission: "diff_only",
	responseTone: "narrative",
};

interface CampaignShape {
	slug?: string;
	name?: string;
}

interface SceneShape {
	id?: string | number;
	name?: string;
	title?: string;
}

interface SessionShape {
	name?: string;
	fileName?: string;
	data?: {
		scenes?: SceneShape[];
		encounters?: Array<{ id?: string | number; name?: string }>;
	};
}

interface EncounterShape {
	id?: string | number;
	name?: string;
}

function formatContextWindow(limit?: number): string | undefined {
	if (!limit || !Number.isFinite(limit) || limit <= 0) return undefined;
	if (limit >= 1000000) {
		const m = limit / 1000000;
		return `${Number.isInteger(m) ? m : m.toFixed(1)}M токенів`;
	}
	if (limit >= 1000) {
		return `${Math.round(limit / 1000)}K токенів`;
	}
	return `${limit} токенів`;
}

function mapApiModelsToOptions(models: AiModelDescriptor[]): AiModelOption[] {
	if (!Array.isArray(models) || models.length === 0) {
		return [...AI_MODELS];
	}
	return models.map((descriptor) => {
		const preset = AI_MODELS.find((m) => m.id === descriptor.name);
		return {
			id: descriptor.name,
			name: descriptor.displayName || preset?.name || descriptor.name,
			description: descriptor.description || preset?.description || "Модель Gemini",
			badge: preset?.badge,
			contextWindow: formatContextWindow(descriptor.inputTokenLimit) || preset?.contextWindow,
			inputTokenLimit: descriptor.inputTokenLimit,
		};
	});
}

function toFrontendSession(record: AiChatRecord): AiChatSession {
	return {
		id: record.id,
		campaignSlug: record.campaignSlug,
		title: record.title,
		isAutoTitled: record.isAutoTitled,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
		model: record.model || DEFAULT_AI_MODEL,
		messages: Array.isArray(record.messages) ? (record.messages as ChatMessage[]) : [],
		autoApply: Boolean(record.autoApply),
		contextSettings: record.contextSettings || INITIAL_CONTEXT_SETTINGS,
		anchor: record.anchor || null,
		summary: record.summary,
		tokenEstimate: record.tokenEstimate,
		maxTokens: record.maxTokens,
	};
}

function toSummaryFromSession(session: AiChatSession): AiChatSessionSummary {
	return {
		id: session.id,
		campaignSlug: session.campaignSlug,
		title: session.title,
		isAutoTitled: session.isAutoTitled,
		createdAt: session.createdAt,
		updatedAt: session.updatedAt,
		model: session.model,
		autoApply: session.autoApply,
		messageCount: session.messages.length,
		userMessageCount: session.messages.filter((m) => m.role === "user").length,
		tokenEstimate: session.tokenEstimate,
		maxTokens: session.maxTokens,
	};
}

function upsertSummaryList(
	list: AiChatSessionSummary[],
	next: AiChatSessionSummary,
): AiChatSessionSummary[] {
	const merged = [next, ...list.filter((item) => item.id !== next.id)];
	return merged.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException
		? error.name === "AbortError"
		: Boolean((error as { name?: string })?.name === "AbortError");
}

function isMissingApiKeyError(error: unknown): boolean {
	const rec = error as { status?: number; code?: string; message?: string } | null;
	if (!rec) return false;
	if (rec.code === "API_KEY_MISSING" || rec.code === "NO_MODELS_AVAILABLE") return true;
	const msg = String(rec.message || "").toLowerCase();
	return msg.includes("api key") || msg.includes("gemini_api_key");
}

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error.trim()) return error;
	return fallback;
}

export function useAiChatState({
	campaignTitle,
	sessionTitle,
	sceneTitle,
}: {
	campaignTitle?: string;
	sessionTitle?: string;
	sceneTitle?: string;
} = {}) {
	const runtime = useAiAssistantRuntime();
	const location = useLocation();

	const activeCampaign = runtime.activeCampaign as CampaignShape | null;
	const runtimeSession = runtime.activeSession as SessionShape | null;
	const activeEncounter = runtime.activeEncounter as EncounterShape | null;
	const campaignSlug = String(
		runtime.navigation.activeCampaignSlug || activeCampaign?.slug || "",
	).trim();
	const activeSessionFileName =
		runtime.navigation.activeSessionFileName || runtimeSession?.fileName || null;
	const activeEncounterId =
		runtime.navigation.activeEncounterId ?? activeEncounter?.id ?? null;

	// Detect active scene from URL hash when in session view
	const detectedScene = useMemo(() => {
		const scenes = Array.isArray(runtimeSession?.data?.scenes)
			? runtimeSession.data.scenes
			: [];
		if (scenes.length === 0 || !location.hash) return null;
		const hash = location.hash;
		for (const scene of scenes) {
			if (scene?.id === undefined || scene?.id === null) continue;
			const baseDomId = makeDomId("session", "scene", scene.id);
			if (hash === `#${baseDomId}` || hash.startsWith(`#${baseDomId}-`)) {
				return scene;
			}
		}
		return null;
	}, [runtimeSession, location.hash]);

	const activeSection = useMemo(() => {
		const params = new URLSearchParams(location.search || "");
		return params.get("section") || "";
	}, [location.search]);

	const workspaceViewType: AiWorkspaceContext["viewType"] = activeEncounterId
		? "encounter"
		: activeSessionFileName
			? "session"
			: "campaign";

	const workspaceContext = useMemo<AiWorkspaceContext>(
		() => ({
			viewType: workspaceViewType,
			campaignSlug,
			sessionFileName: activeSessionFileName,
			encounterId: activeEncounterId,
			sceneId: detectedScene?.id ?? null,
			...(activeSection ? { activeSection } : {}),
		}),
		[
			workspaceViewType,
			campaignSlug,
			activeSessionFileName,
			activeEncounterId,
			detectedScene,
			activeSection,
		],
	);

	const { applyUpdatedAiData } = useAiAssistantUpdatedData({
		activeCampaign: runtime.activeCampaign,
		campaignSlug,
		encounterId: activeEncounterId,
		fallbackSessionFileName: activeSessionFileName || undefined,
		isBestiary: false,
		isCampaign: workspaceViewType === "campaign",
		isEncounter: workspaceViewType === "encounter",
		publishSyncEvent: runtime.publishSyncEvent,
		refreshEntities: runtime.refreshEntities,
		requestCampaignReload: runtime.requestCampaignReload,
		setActiveCampaign: runtime.setActiveCampaign,
		setActiveEncounter: runtime.setActiveEncounter,
		setActiveSession: runtime.setActiveSession,
		sessionFileName: activeSessionFileName,
	});

	// Chat sessions & active record state
	const [sessions, setSessions] = useState<AiChatSessionSummary[]>([]);
	const [activeSessionRecord, setActiveSessionRecord] = useState<AiChatSession | null>(null);
	const [isLoadingChats, setIsLoadingChats] = useState(false);

	// Composer & model states
	const [inputValue, setInputValue] = useState("");
	const [availableModels, setAvailableModels] = useState<AiModelOption[]>([...AI_MODELS]);
	const [selectedModel, setSelectedModelState] = useState<string>(DEFAULT_AI_MODEL);
	const [autoApply, setAutoApplyState] = useState<boolean>(false);
	const [contextSettings, setContextSettingsState] =
		useState<AiContextSettings>(INITIAL_CONTEXT_SETTINGS);
	const [attachments, setAttachments] = useState<AiChatAttachment[]>([]);

	// Request & API key states
	const [isSending, setIsSending] = useState(false);
	const [busyActionIds, setBusyActionIds] = useState<Set<string>>(() => new Set());
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
	const [isSavingApiKey, setIsSavingApiKey] = useState(false);
	const sendAbortRef = useRef<AbortController | null>(null);

	// Anchor pin state for unsaved or active chats
	const [draftAnchor, setDraftAnchor] = useState<AiChatAnchorData | null>(null);

	// Popover states
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);
	const [isContextSettingsOpen, setIsContextSettingsOpen] = useState(false);
	const [isCommandsInfoOpen, setIsCommandsInfoOpen] = useState(false);
	const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
	const [diffModalCard, setDiffModalCard] = useState<AiActionCard | null>(null);

	// Load available models on mount
	const loadModels = useCallback(async () => {
		try {
			const result = await aiApi.listAiModels();
			const models = Array.isArray(result?.models) ? result.models : [];
			const mapped = mapApiModelsToOptions(models);
			setAvailableModels(mapped);
			const keyMissing = result?.source === "fallback" && models.length === 0;
			setIsApiKeyMissing(keyMissing);
			if (models.length > 0 && result) {
				const preferred = result.defaultModel || models[0].name;
				setSelectedModelState((prev) =>
					models.some((m) => m.name === prev) ? prev : preferred,
				);
			}
		} catch {
			// Fallback to static model presets silently
		}
	}, []);

	useEffect(() => {
		void loadModels();
	}, [loadModels]);

	// Load chats when active campaign changes
	useEffect(() => {
		let cancelled = false;
		sendAbortRef.current?.abort();
		setIsSending(false);
		setErrorMessage(null);
		setAttachments([]);
		setDraftAnchor(null);
		setDiffModalCard(null);

		if (!campaignSlug) {
			setSessions([]);
			setActiveSessionRecord(null);
			return;
		}

		setIsLoadingChats(true);
		aiApi
			.listAiChats(campaignSlug)
			.then(async (summaries) => {
				if (cancelled) return;
				const normalizedList: AiChatSessionSummary[] = (Array.isArray(summaries) ? summaries : []).map((s) => ({
					id: s.id,
					campaignSlug: s.campaignSlug,
					title: s.title,
					isAutoTitled: s.isAutoTitled,
					createdAt: s.createdAt,
					updatedAt: s.updatedAt,
					model: s.model,
					autoApply: s.autoApply,
					messageCount: s.messageCount,
					userMessageCount: s.userMessageCount,
					tokenEstimate: s.tokenEstimate,
					maxTokens: s.maxTokens,
				}));
				setSessions(normalizedList);
				if (normalizedList.length > 0) {
					const latest = await aiApi.getAiChat(campaignSlug, normalizedList[0].id);
					if (cancelled || !latest) return;
					const converted = toFrontendSession(latest);
					setActiveSessionRecord(converted);
					if (converted.model) setSelectedModelState(converted.model);
					setAutoApplyState(Boolean(converted.autoApply));
					if (converted.contextSettings) setContextSettingsState(converted.contextSettings);
				} else {
					setActiveSessionRecord(null);
				}
			})
			.catch((error) => {
				if (cancelled) return;
				setErrorMessage(getErrorMessage(error, "Не вдалося завантажити історію AI-чатів."));
			})
			.finally(() => {
				if (!cancelled) setIsLoadingChats(false);
			});

		return () => {
			cancelled = true;
		};
	}, [campaignSlug]);

	// Current live workspace anchor label
	const liveWorkspaceAnchor = useMemo<AiChatAnchorData>(() => {
		const effectiveCampaignName = activeCampaign?.name || campaignTitle || campaignSlug || "Кампанія";
		const effectiveSessionName = runtimeSession?.name || sessionTitle || "";
		const effectiveEncounterName = activeEncounter?.name || "";
		const effectiveSceneName = detectedScene?.name || detectedScene?.title || sceneTitle || "";

		let title = effectiveCampaignName;
		if (effectiveEncounterName) {
			title = `${effectiveSessionName ? `${effectiveSessionName} · ` : ""}${effectiveEncounterName}`;
		} else if (effectiveSceneName) {
			title = `${effectiveSessionName ? `${effectiveSessionName} · ` : ""}${effectiveSceneName}`;
		} else if (effectiveSessionName) {
			title = effectiveSessionName;
		}

		return {
			type: workspaceViewType,
			title,
			...(activeSessionFileName ? { sessionFileName: activeSessionFileName } : {}),
			...(activeEncounterId !== null && activeEncounterId !== undefined && activeEncounterId !== ""
				? { encounterId: String(activeEncounterId) }
				: {}),
			...(detectedScene?.id !== undefined && detectedScene?.id !== null
				? { sceneId: String(detectedScene.id) }
				: {}),
			pinned: false,
		};
	}, [
		activeCampaign?.name,
		campaignTitle,
		campaignSlug,
		runtimeSession?.name,
		sessionTitle,
		activeEncounter?.name,
		detectedScene,
		sceneTitle,
		workspaceViewType,
		activeSessionFileName,
		activeEncounterId,
	]);

	// Compute active displayed session object (always returns valid shape even when unsaved draft)
	const activeSession = useMemo<AiChatSession>(() => {
		if (activeSessionRecord) return activeSessionRecord;
		const now = Date.now();
		return {
			id: "draft-new",
			campaignSlug,
			title: "Новий діалог",
			createdAt: now,
			updatedAt: now,
			model: selectedModel,
			autoApply,
			contextSettings,
			anchor: draftAnchor || liveWorkspaceAnchor,
			messages: [],
			tokenEstimate: 0,
			maxTokens: 1000000,
		};
	}, [
		activeSessionRecord,
		campaignSlug,
		selectedModel,
		autoApply,
		contextSettings,
		draftAnchor,
		liveWorkspaceAnchor,
	]);

	// Effective anchor & sync indicator
	const contextAnchor = useMemo<AiContextAnchor>(() => {
		const activeModelObj = availableModels.find((m) => m.id === selectedModel);
		const maxTokens =
			activeSessionRecord?.maxTokens ||
			activeModelObj?.inputTokenLimit ||
			1000000;
		const tokenEstimate = activeSessionRecord?.tokenEstimate || 0;

		const storedAnchor = activeSessionRecord ? activeSessionRecord.anchor : draftAnchor;
		const isPinned = Boolean(storedAnchor?.pinned);

		if (isPinned && storedAnchor) {
			const sameTarget =
				(storedAnchor.sessionFileName || "") === (liveWorkspaceAnchor.sessionFileName || "") &&
				(storedAnchor.encounterId || "") === (liveWorkspaceAnchor.encounterId || "") &&
				(storedAnchor.sceneId || "") === (liveWorkspaceAnchor.sceneId || "");
			return {
				type: (storedAnchor.type as AiContextAnchor["type"]) || "campaign",
				title: storedAnchor.title,
				subtitle: sameTarget ? "Синхронізовано з редактором" : "Закріплено до іншого контексту",
				synced: sameTarget,
				pinned: true,
				tokenEstimate,
				maxTokens,
				sessionFileName: storedAnchor.sessionFileName,
				encounterId: storedAnchor.encounterId,
				sceneId: storedAnchor.sceneId,
			};
		}

		return {
			type: (liveWorkspaceAnchor.type as AiContextAnchor["type"]) || "campaign",
			title: liveWorkspaceAnchor.title,
			subtitle: "Синхронізовано з редактором",
			synced: true,
			pinned: false,
			tokenEstimate,
			maxTokens,
			sessionFileName: liveWorkspaceAnchor.sessionFileName,
			encounterId: liveWorkspaceAnchor.encounterId,
			sceneId: liveWorkspaceAnchor.sceneId,
		};
	}, [
		availableModels,
		selectedModel,
		activeSessionRecord,
		draftAnchor,
		liveWorkspaceAnchor,
	]);

	// Persist partial patch when backend chat exists
	const persistActiveChatPatch = useCallback(
		async (patch: Record<string, unknown>) => {
			if (!campaignSlug || !activeSessionRecord?.id) return;
			try {
				const updated = await aiApi.updateAiChat(
					campaignSlug,
					activeSessionRecord.id,
					patch,
				);
				if (!updated) return;
				const session = toFrontendSession(updated);
				setActiveSessionRecord(session);
				setSessions((prev) => upsertSummaryList(prev, toSummaryFromSession(session)));
			} catch (error) {
				setErrorMessage(getErrorMessage(error, "Не вдалося зберегти налаштування чату."));
			}
		},
		[campaignSlug, activeSessionRecord?.id],
	);

	const createNewChat = useCallback(() => {
		sendAbortRef.current?.abort();
		setIsSending(false);
		setActiveSessionRecord(null);
		setDraftAnchor(null);
		setErrorMessage(null);
		setIsHistoryOpen(false);
	}, []);

	const selectSession = useCallback(
		async (chatId: string) => {
			if (!campaignSlug || !chatId || chatId === activeSessionRecord?.id) {
				setIsHistoryOpen(false);
				return;
			}
			sendAbortRef.current?.abort();
			setIsSending(false);
			setIsLoadingChats(true);
			setErrorMessage(null);
			try {
				const fetched = await aiApi.getAiChat(campaignSlug, chatId);
				if (!fetched) throw new Error("Не вдалося завантажити дані чату.");
				const session = toFrontendSession(fetched);
				setActiveSessionRecord(session);
				if (session.model) setSelectedModelState(session.model);
				setAutoApplyState(Boolean(session.autoApply));
				if (session.contextSettings) setContextSettingsState(session.contextSettings);
				setIsHistoryOpen(false);
			} catch (error) {
				setErrorMessage(getErrorMessage(error, "Не вдалося відкрити чат."));
			} finally {
				setIsLoadingChats(false);
			}
		},
		[campaignSlug, activeSessionRecord?.id],
	);

	const deleteSession = useCallback(
		async (chatId: string) => {
			if (!campaignSlug || !chatId) return;
			try {
				const nextSummaries = await aiApi.deleteAiChat(campaignSlug, chatId);
				const mappedSummaries = (Array.isArray(nextSummaries) ? nextSummaries : []) as AiChatSessionSummary[];
				setSessions(mappedSummaries);
				if (activeSessionRecord?.id === chatId) {
					if (mappedSummaries.length > 0) {
						const nextChat = await aiApi.getAiChat(campaignSlug, mappedSummaries[0].id);
						if (!nextChat) {
							setActiveSessionRecord(null);
							return;
						}
						const converted = toFrontendSession(nextChat);
						setActiveSessionRecord(converted);
						if (converted.model) setSelectedModelState(converted.model);
						setAutoApplyState(Boolean(converted.autoApply));
						if (converted.contextSettings) setContextSettingsState(converted.contextSettings);
					} else {
						setActiveSessionRecord(null);
					}
				}
			} catch (error) {
				setErrorMessage(getErrorMessage(error, "Не вдалося видалити чат."));
			}
		},
		[campaignSlug, activeSessionRecord?.id],
	);

	const setSelectedModel = useCallback(
		(modelId: string) => {
			setSelectedModelState(modelId);
			setIsModelPickerOpen(false);
			setActiveSessionRecord((prev) => (prev ? { ...prev, model: modelId } : prev));
			void persistActiveChatPatch({ model: modelId });
		},
		[persistActiveChatPatch],
	);

	const setAutoApply = useCallback(
		(nextVal: boolean) => {
			setAutoApplyState(nextVal);
			setActiveSessionRecord((prev) => (prev ? { ...prev, autoApply: nextVal } : prev));
			void persistActiveChatPatch({ autoApply: nextVal });
		},
		[persistActiveChatPatch],
	);

	const setContextSettings = useCallback(
		(nextSettings: AiContextSettings) => {
			setContextSettingsState(nextSettings);
			setActiveSessionRecord((prev) =>
				prev ? { ...prev, contextSettings: nextSettings } : prev,
			);
			void persistActiveChatPatch({ contextSettings: nextSettings });
		},
		[persistActiveChatPatch],
	);

	const togglePinAnchor = useCallback(() => {
		const nextPinned = !contextAnchor.pinned;
		const anchorPayload: AiChatAnchor = nextPinned
			? {
					type: liveWorkspaceAnchor.type,
					title: liveWorkspaceAnchor.title,
					...(liveWorkspaceAnchor.sessionFileName
						? { sessionFileName: liveWorkspaceAnchor.sessionFileName }
						: {}),
					...(liveWorkspaceAnchor.encounterId
						? { encounterId: liveWorkspaceAnchor.encounterId }
						: {}),
					...(liveWorkspaceAnchor.sceneId
						? { sceneId: liveWorkspaceAnchor.sceneId }
						: {}),
					pinned: true,
				}
			: { ...liveWorkspaceAnchor, pinned: false };

		setDraftAnchor(anchorPayload);
		setActiveSessionRecord((prev) => (prev ? { ...prev, anchor: anchorPayload } : prev));
		void persistActiveChatPatch({ anchor: anchorPayload });
	}, [contextAnchor.pinned, liveWorkspaceAnchor, persistActiveChatPatch]);

	const resyncAnchorToCurrentWorkspace = useCallback(() => {
		const nextAnchor: AiChatAnchor = {
			...liveWorkspaceAnchor,
			pinned: false,
		};
		setDraftAnchor(nextAnchor);
		setActiveSessionRecord((prev) => (prev ? { ...prev, anchor: nextAnchor } : prev));
		void persistActiveChatPatch({ anchor: nextAnchor });
	}, [liveWorkspaceAnchor, persistActiveChatPatch]);

	const syncMutationResultToWorkspace = useCallback(
		(result: {
			updated?: unknown;
			changedEntityTypes?: string[];
			aiResponse?: AiChatActionMutationResult["aiResponse"];
			actionCard?: AiChatActionMutationResult["actionCard"];
		}) => {
			const hasCustomMonsterChange =
				Boolean((result.updated as { monsters?: unknown } | null)?.monsters) ||
				Boolean(
					result.actionCard?.diffResources?.some(
						(r) => r?.kind === "custom-monster" || r?.kind === "custom-bestiary",
					),
				) ||
				Boolean(
					result.aiResponse?.changes?.resources?.some(
						(r) => r?.kind === "custom-monster" || r?.kind === "custom-bestiary",
					),
				);

			if (result.updated) {
				applyUpdatedAiData(result.updated, {
					entityTypes: result.changedEntityTypes,
					historyEntry: result.aiResponse || null,
				});
			} else if (Array.isArray(result.changedEntityTypes) && result.changedEntityTypes.length > 0) {
				runtime.refreshEntities();
				runtime.publishSyncEvent({
					resource: "ai",
					campaignSlug: campaignSlug || undefined,
					sessionFileName: activeSessionFileName || undefined,
				});
			}

			if (hasCustomMonsterChange) {
				runtime.publishSyncEvent({ resource: "custom-bestiary" });
			}
		},
		[applyUpdatedAiData, runtime, campaignSlug, activeSessionFileName],
	);

	const cancelSending = useCallback(() => {
		sendAbortRef.current?.abort();
	}, []);

	const sendMessage = useCallback(
		async (contentToSend?: string) => {
			if (!campaignSlug || isSending) return;
			const text = (contentToSend ?? inputValue).trim();
			const pendingAttachments = [...attachments];
			if (!text && pendingAttachments.length === 0) return;

			setErrorMessage(null);
			setIsSending(true);
			const previousDraft = contentToSend === undefined ? inputValue : null;
			if (contentToSend === undefined) setInputValue("");
			setAttachments([]);

			const now = Date.now();
			const optimisticUserMsg: ChatMessage = {
				id: `temp-user-${now}`,
				role: "user",
				content: text,
				timestamp: now,
				status: "done",
				...(pendingAttachments.length > 0 ? { attachments: pendingAttachments } : {}),
			};
			const streamingPlaceholder: ChatMessage = {
				id: `temp-assistant-${now + 1}`,
				role: "assistant",
				content: "",
				timestamp: now + 1,
				status: "streaming",
				streamPhase: "thinking",
			};

			const prevRecordSnapshot = activeSessionRecord;
			setActiveSessionRecord((prev) => ({
				...(prev || {
					id: "draft-new",
					campaignSlug,
					title: "Новий діалог",
					createdAt: now,
					updatedAt: now,
					model: selectedModel,
					autoApply,
					contextSettings,
					anchor: draftAnchor || liveWorkspaceAnchor,
					messages: [],
				}),
				messages: [
					...(prev?.messages || []),
					optimisticUserMsg,
					streamingPlaceholder,
				],
			}));

			const controller = new AbortController();
			sendAbortRef.current = controller;

			try {
				let targetChatId = activeSessionRecord?.id;
				if (!targetChatId || targetChatId === "draft-new") {
					const created = await aiApi.createAiChat(campaignSlug, {
						model: selectedModel,
						autoApply,
						contextSettings,
						anchor: draftAnchor || liveWorkspaceAnchor,
					});
					if (!created?.id) throw new Error("Не вдалося створити новий чат.");
					targetChatId = created.id;
				}

				const attachedImages = pendingAttachments.filter((a) => a.kind === "image");
				const attachedFiles = pendingAttachments.filter((a) => a.kind !== "image");

				const result = await aiApi.sendAiChatMessageStream(
					campaignSlug,
					targetChatId,
					{
						content: text,
						model: selectedModel,
						autoApply,
						contextSettings,
						anchor: contextAnchor.pinned
							? activeSessionRecord?.anchor || draftAnchor
							: liveWorkspaceAnchor,
						workspaceContext,
						language: runtime.currentLanguage || "uk",
						attachedImages,
						attachedFiles,
					},
					{
						signal: controller.signal,
						onStatus: (phase) => {
							setActiveSessionRecord((prev) => {
								if (!prev) return prev;
								return {
									...prev,
									messages: prev.messages.map((msg) =>
										msg.id === streamingPlaceholder.id
											? { ...msg, streamPhase: phase }
											: msg,
									),
								};
							});
						},
						onDelta: (partialText, replyComplete) => {
							setActiveSessionRecord((prev) => {
								if (!prev) return prev;
								return {
									...prev,
									messages: prev.messages.map((msg) =>
										msg.id === streamingPlaceholder.id
											? {
													...msg,
													content: partialText,
													streamPhase: replyComplete ? "preparing_actions" : "streaming",
												}
											: msg,
									),
								};
							});
						},
					},
				);
				if (!result?.chat) throw new Error("Некоректна відповідь сервера.");

				const persistedSession = toFrontendSession(result.chat);
				setActiveSessionRecord(persistedSession);
				setSessions((prev) =>
					upsertSummaryList(prev, toSummaryFromSession(persistedSession)),
				);
				const appliedCards = persistedSession.messages.flatMap((m) => m.actionCards || []);
				const appliedCard = appliedCards.find((c) =>
					result.appliedActionIds?.includes(c.id),
				);
				syncMutationResultToWorkspace({
					updated: result.updated,
					changedEntityTypes: result.changedEntityTypes,
					actionCard: appliedCard,
				});
			} catch (error) {
				setActiveSessionRecord(prevRecordSnapshot);
				if (previousDraft !== null) setInputValue(previousDraft);
				setAttachments(pendingAttachments);
				if (!isAbortError(error)) {
					if (isMissingApiKeyError(error)) {
						setIsApiKeyMissing(true);
					}
					setErrorMessage(
						getErrorMessage(error, "Не вдалося отримати відповідь від AI-асистента."),
					);
				}
			} finally {
				if (sendAbortRef.current === controller) {
					sendAbortRef.current = null;
				}
				setIsSending(false);
			}
		},
		[
			campaignSlug,
			isSending,
			inputValue,
			attachments,
			activeSessionRecord,
			selectedModel,
			autoApply,
			contextSettings,
			draftAnchor,
			liveWorkspaceAnchor,
			contextAnchor.pinned,
			workspaceContext,
			runtime.currentLanguage,
			syncMutationResultToWorkspace,
		],
	);

	const runActionMutation = useCallback(
		async (
			cardId: string,
			executor: (chatId: string) => Promise<AiChatActionMutationResult | null>,
			fallbackError: string,
		) => {
			if (!campaignSlug || !activeSessionRecord?.id) return;
			const chatId = activeSessionRecord.id;
			setErrorMessage(null);
			setBusyActionIds((prev) => new Set(prev).add(cardId));
			try {
				const result = await executor(chatId);
				if (!result?.chat) return;
				const updatedSession = toFrontendSession(result.chat);
				setActiveSessionRecord(updatedSession);
				setSessions((prev) =>
					upsertSummaryList(prev, toSummaryFromSession(updatedSession)),
				);
				if (diffModalCard?.id === cardId) {
					setDiffModalCard(null);
				}
				syncMutationResultToWorkspace({
					updated: result.updated,
					changedEntityTypes: result.changedEntityTypes,
					aiResponse: result.aiResponse,
					actionCard: result.actionCard,
				});
			} catch (error) {
				setErrorMessage(getErrorMessage(error, fallbackError));
			} finally {
				setBusyActionIds((prev) => {
					const next = new Set(prev);
					next.delete(cardId);
					return next;
				});
			}
		},
		[campaignSlug, activeSessionRecord?.id, diffModalCard?.id, syncMutationResultToWorkspace],
	);

	const applyActionCard = useCallback(
		(cardId: string, options?: { useDraftSnapshot?: boolean }) => {
			void runActionMutation(
				cardId,
				(chatId) =>
					aiApi.applyAiChatAction(campaignSlug, chatId, cardId, {
						workspaceContext,
						language: runtime.currentLanguage || "uk",
						...(options?.useDraftSnapshot ? { useDraftSnapshot: true } : {}),
					}),
				"Не вдалося застосувати дію.",
			);
		},
		[runActionMutation, campaignSlug, workspaceContext, runtime.currentLanguage],
	);

	const saveCardDraftResources = useCallback(
		async (cardId: string, resources: AiHistoryResource[]): Promise<AiHistoryEntry | null> => {
			if (!campaignSlug || !activeSessionRecord) return null;
			const targetCard = activeSessionRecord.messages
				.flatMap((m) => m.actionCards || [])
				.find((c) => c.id === cardId);
			if (!targetCard?.aiResponseId) return null;

			const updatedEntry = await aiApi.updateAiResponse(
				campaignSlug,
				targetCard.aiResponseId,
				{
					resources: resources.map(({ id, after }) => ({ id, after })),
				},
			);
			const nextResources = updatedEntry?.changes?.resources;
			if (Array.isArray(nextResources)) {
				setActiveSessionRecord((prev) => {
					if (!prev) return prev;
					return {
						...prev,
						messages: prev.messages.map((msg) => ({
							...msg,
							actionCards: msg.actionCards?.map((c) =>
								c.id === cardId ? { ...c, diffResources: nextResources } : c,
							),
						})),
					};
				});
				setDiffModalCard((prev) =>
					prev?.id === cardId ? { ...prev, diffResources: nextResources } : prev,
				);
			}
			return updatedEntry || null;
		},
		[campaignSlug, activeSessionRecord],
	);

	const undoActionCard = useCallback(
		(cardId: string) => {
			void runActionMutation(
				cardId,
				(chatId) => aiApi.undoAiChatAction(campaignSlug, chatId, cardId),
				"Не вдалося скасувати застосовану дію.",
			);
		},
		[runActionMutation, campaignSlug],
	);

	const rejectActionCard = useCallback(
		(cardId: string) => {
			void runActionMutation(
				cardId,
				(chatId) => aiApi.rejectAiChatAction(campaignSlug, chatId, cardId),
				"Не вдалося відхилити пропозицію.",
			);
		},
		[runActionMutation, campaignSlug],
	);

	const addAttachments = useCallback(
		async (fileList: FileList | File[]) => {
			const files = Array.from(fileList || []);
			if (files.length === 0) return;
			setErrorMessage(null);

			let nextList = [...attachments];
			for (const file of files) {
				const imageMime = getSupportedAiImageMimeType(file);
				const fileMime = imageMime ? "" : getSupportedAiFileMimeType(file);
				if (!imageMime && !fileMime) {
					setErrorMessage(`Непідтримуваний формат файлу: ${file.name}`);
					continue;
				}
				const isImage = Boolean(imageMime);
				const sameKindCount = nextList.filter((a) =>
					isImage ? a.kind === "image" : a.kind === "file",
				).length;
				if (sameKindCount >= MAX_AI_ATTACHMENTS) {
					setErrorMessage(`Максимум ${MAX_AI_ATTACHMENTS} вкладення одного типу.`);
					break;
				}
				const maxBytes = isImage ? MAX_AI_IMAGE_BYTES : MAX_AI_FILE_BYTES;
				if (file.size > maxBytes) {
					setErrorMessage(`Файл "${file.name}" перевищує ліміт 10 МБ.`);
					continue;
				}
				try {
					const data = await readFileAsBase64(file);
					const descriptor: AiChatAttachment = {
						id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
						name: file.name,
						mimeType: imageMime || fileMime,
						sizeBytes: file.size,
						kind: isImage ? "image" : "file",
						data,
					};
					const key = isImage
						? getAttachedImageKey(descriptor)
						: getAttachedFileKey(descriptor);
					const exists = nextList.some((item) =>
						isImage
							? getAttachedImageKey(item) === key
							: getAttachedFileKey(item) === key,
					);
					if (!exists) {
						nextList = [...nextList, descriptor];
					}
				} catch (error) {
					setErrorMessage(getErrorMessage(error, `Помилка читання файлу ${file.name}`));
				}
			}
			setAttachments(nextList);
		},
		[attachments],
	);

	const removeAttachment = useCallback((id: string) => {
		setAttachments((prev) => prev.filter((item) => item.id !== id));
	}, []);

	const saveApiKey = useCallback(async (apiKey: string) => {
		const trimmed = String(apiKey || "").trim();
		if (!trimmed) {
			setErrorMessage("Введіть Gemini API ключ.");
			return false;
		}
		setIsSavingApiKey(true);
		setErrorMessage(null);
		try {
			const res = await saveGeminiApiKeyAndRefreshModels({ apiKey: trimmed });
			if (res.status === "saved" && res.modelSelection) {
				const mapped = mapApiModelsToOptions(res.modelSelection.models);
				if (mapped.length > 0) setAvailableModels(mapped);
				if (res.modelSelection.selectedModel) {
					setSelectedModelState(res.modelSelection.selectedModel);
				}
				setIsApiKeyMissing(false);
				return true;
			}
			await loadModels();
			setIsApiKeyMissing(false);
			return true;
		} catch (error) {
			setErrorMessage(getErrorMessage(error, "Не вдалося зберегти API ключ."));
			return false;
		} finally {
			setIsSavingApiKey(false);
		}
	}, [loadModels]);

	const insertCommand = useCallback((command: string) => {
		setInputValue((prev) => {
			const space = prev.length > 0 && !prev.endsWith(" ") ? " " : "";
			return `${prev}${space}${command} `;
		});
		setIsCommandsInfoOpen(false);
	}, []);

	useEffect(() => {
		const handleAiChatPrefill = (event: Event) => {
			const detail = (event as CustomEvent<{ text?: string; focus?: boolean }>).detail;
			const nextText = typeof detail?.text === "string" ? detail.text : "";
			if (!nextText) return;
			setInputValue(nextText);
			setErrorMessage(null);
			setIsCommandsInfoOpen(false);
			if (detail?.focus === false) return;
			window.setTimeout(() => {
				const editable = document.querySelector<HTMLElement>(
					'.AiChatComposerV2__editor .MarkdownView[contenteditable="true"]',
				);
				if (!editable) return;
				editable.focus();
				const selection = window.getSelection();
				if (selection) {
					const range = document.createRange();
					range.selectNodeContents(editable);
					range.collapse(false);
					selection.removeAllRanges();
					selection.addRange(range);
				}
			}, 60);
		};
		window.addEventListener("prm:ai-chat-prefill", handleAiChatPrefill);
		return () => window.removeEventListener("prm:ai-chat-prefill", handleAiChatPrefill);
	}, []);

	return {
		campaignSlug,
		sessions,
		activeSession,
		activeSessionId: activeSession.id,
		availableModels,
		inputValue,
		selectedModel,
		autoApply,
		contextSettings,
		contextAnchor,
		attachments,
		isSending,
		isLoadingChats,
		busyActionIds,
		errorMessage,
		isApiKeyMissing,
		isSavingApiKey,
		isHistoryOpen,
		isContextSettingsOpen,
		isCommandsInfoOpen,
		isModelPickerOpen,
		diffModalCard,
		setInputValue,
		setAutoApply,
		setSelectedModel,
		setContextSettings,
		setErrorMessage,
		setIsHistoryOpen,
		setIsContextSettingsOpen,
		setIsCommandsInfoOpen,
		setIsModelPickerOpen,
		setDiffModalCard,
		createNewChat,
		selectSession,
		deleteSession,
		sendMessage,
		cancelSending,
		applyActionCard,
		saveCardDraftResources,
		undoActionCard,
		rejectActionCard,
		addAttachments,
		removeAttachment,
		saveApiKey,
		togglePinAnchor,
		resyncAnchorToCurrentWorkspace,
		insertCommand,
	};
}
