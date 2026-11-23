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
import { lang, makeDomId } from "../../../../shared/lib/index.js";
import { useAiAssistantRuntime } from "../../ui/AiAssistantRuntime.tsx";
import { useAiAssistantUpdatedData } from "../../model/useAiAssistantUpdatedData.ts";
import { formatModelContextWindow, localizeAiModelOption } from "./aiChatLocalization.ts";
import type {
	AiActionCard,
	AiChatAnchorData,
	AiChatAttachment,
	AiChatContextPreview,
	AiChatSession,
	AiChatSessionSummary,
	AiContextAnchor,
	AiContextSettings,
	AiModelOption,
	AiWorkspaceContext,
	ChatMessage,
	CompactContextFeedback,
} from "./aiChatTypes.ts";
import { calculateLiveContextTokens } from "./aiContextSelection.ts";
import { AI_MODELS, DEFAULT_AI_MODEL } from "./aiModels.ts";

const INITIAL_CONTEXT_SETTINGS: AiContextSettings = {
	includeCurrentScene: true,
	includeCampaignCharacters: true,
	includeCampaignNpc: true,
	includeCampaignLocations: true,
	includeRecentSessionHistory: false,
	includeBestiary: false,
	selectedCharacterIds: null,
	selectedNpcIds: null,
	selectedLocationIds: null,
	selectedSceneIds: null,
	selectedSessionFileNames: null,
	selectedBestiaryIds: null,
	mutationPermission: "diff_only",
	responseTone: "narrative",
	rulesEdition: "5.5e",
};

function normalizeClientContextSettings(
	raw?: Partial<AiContextSettings> | null,
): AiContextSettings {
	if (!raw) return INITIAL_CONTEXT_SETTINGS;
	const includeCampaignNpc = raw.includeCampaignNpc ?? INITIAL_CONTEXT_SETTINGS.includeCampaignNpc;
	const includeCampaignCharacters =
		raw.includeCampaignCharacters === undefined
			? includeCampaignNpc
			: raw.includeCampaignCharacters;
	return {
		includeCurrentScene: raw.includeCurrentScene ?? INITIAL_CONTEXT_SETTINGS.includeCurrentScene,
		includeCampaignCharacters,
		includeCampaignNpc,
		includeCampaignLocations:
			raw.includeCampaignLocations ?? INITIAL_CONTEXT_SETTINGS.includeCampaignLocations,
		includeRecentSessionHistory:
			raw.includeRecentSessionHistory ?? INITIAL_CONTEXT_SETTINGS.includeRecentSessionHistory,
		includeBestiary: raw.includeBestiary ?? INITIAL_CONTEXT_SETTINGS.includeBestiary,
		selectedCharacterIds: Array.isArray(raw.selectedCharacterIds) ? raw.selectedCharacterIds : null,
		selectedNpcIds: Array.isArray(raw.selectedNpcIds) ? raw.selectedNpcIds : null,
		selectedLocationIds: Array.isArray(raw.selectedLocationIds) ? raw.selectedLocationIds : null,
		selectedSceneIds: Array.isArray(raw.selectedSceneIds) ? raw.selectedSceneIds : null,
		selectedSessionFileNames: Array.isArray(raw.selectedSessionFileNames)
			? raw.selectedSessionFileNames
			: null,
		selectedBestiaryIds: Array.isArray(raw.selectedBestiaryIds) ? raw.selectedBestiaryIds : null,
		mutationPermission: raw.mutationPermission ?? INITIAL_CONTEXT_SETTINGS.mutationPermission,
		responseTone: raw.responseTone ?? INITIAL_CONTEXT_SETTINGS.responseTone,
		rulesEdition:
			raw.rulesEdition === "5e" || raw.rulesEdition === "5.5e"
				? raw.rulesEdition
				: INITIAL_CONTEXT_SETTINGS.rulesEdition,
	};
}

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

function mapApiModelsToOptions(models: AiModelDescriptor[]): AiModelOption[] {
	if (!Array.isArray(models) || models.length === 0) {
		return AI_MODELS.map(localizeAiModelOption);
	}
	return models.map((descriptor) => {
		const preset = AI_MODELS.find((m) => m.id === descriptor.name);
		const presetDesc = preset?.description ? lang.t(preset.description) : "";
		return {
			id: descriptor.name,
			name: descriptor.displayName || preset?.name || descriptor.name,
			description: descriptor.description || presetDesc || lang.t("Gemini model"),
			badge: preset?.badge ? lang.t(preset.badge) : undefined,
			contextWindow:
				formatModelContextWindow(descriptor.inputTokenLimit) ||
				(preset?.contextWindow ? lang.t(preset.contextWindow) : undefined),
			inputTokenLimit: descriptor.inputTokenLimit ?? preset?.inputTokenLimit,
		};
	});
}

function mapImageModelsToOptions(models?: AiModelDescriptor[]): AiModelOption[] {
	if (!Array.isArray(models) || models.length === 0) return [];
	return models.map((descriptor) => ({
		id: descriptor.name,
		name: descriptor.displayName || descriptor.name,
		description: descriptor.description || lang.t("Image generation model"),
		contextWindow: formatModelContextWindow(descriptor.inputTokenLimit),
		inputTokenLimit: descriptor.inputTokenLimit,
	}));
}

function toFrontendSession(record: AiChatRecord): AiChatSession {
	return {
		id: record.id,
		campaignSlug: record.campaignSlug,
		title: record.title,
		isAutoTitled: record.isAutoTitled,
		...(record.isLegacyArchive ? { isLegacyArchive: true } : {}),
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
		model: record.model || DEFAULT_AI_MODEL,
		messages: Array.isArray(record.messages) ? (record.messages as ChatMessage[]) : [],
		autoApply: Boolean(record.autoApply),
		contextSettings: normalizeClientContextSettings(record.contextSettings),
		anchor: record.anchor || null,
		summary: record.summary,
		summarizedMessageCount: record.summarizedMessageCount ?? 0,
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
		...(session.isLegacyArchive ? { isLegacyArchive: true } : {}),
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
	const rawCampaignSlug = String(
		runtime.navigation.activeCampaignSlug || activeCampaign?.slug || "",
	).trim();
	const isBestiaryScope = !rawCampaignSlug;
	const campaignSlug = rawCampaignSlug || "bestiary";
	const activeSessionFileName = isBestiaryScope
		? null
		: runtime.navigation.activeSessionFileName || runtimeSession?.fileName || null;
	const activeEncounterId = isBestiaryScope
		? null
		: runtime.navigation.activeEncounterId ?? activeEncounter?.id ?? null;

	// Detect active scene from URL hash when in session view
	const detectedScene = useMemo(() => {
		if (isBestiaryScope) return null;
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
	}, [isBestiaryScope, runtimeSession, location.hash]);

	const activeSection = useMemo(() => {
		const params = new URLSearchParams(location.search || "");
		return params.get("section") || "";
	}, [location.search]);

	const workspaceViewType: AiWorkspaceContext["viewType"] = isBestiaryScope
		? "bestiary"
		: activeEncounterId
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
		isBestiary: isBestiaryScope,
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
	const [rawApiModels, setRawApiModels] = useState<AiModelDescriptor[]>([]);
	const [selectedModel, setSelectedModelState] = useState<string>(DEFAULT_AI_MODEL);
	const [rawApiImageModels, setRawApiImageModels] = useState<AiModelDescriptor[]>([]);
	const [selectedImageModel, setSelectedImageModel] = useState<string>("");
	const [autoApply, setAutoApplyState] = useState<boolean>(false);
	const [contextSettings, setContextSettingsState] =
		useState<AiContextSettings>(INITIAL_CONTEXT_SETTINGS);
	const [attachments, setAttachments] = useState<AiChatAttachment[]>([]);

	const currentLanguage = runtime.currentLanguage || lang.getLanguage() || "en";

	const availableModels = useMemo(
		() => mapApiModelsToOptions(rawApiModels),
		[rawApiModels, currentLanguage],
	);
	const availableImageModels = useMemo(
		() => mapImageModelsToOptions(rawApiImageModels),
		[rawApiImageModels, currentLanguage],
	);

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
	const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
	const [isGalleryPickerOpen, setIsGalleryPickerOpen] = useState(false);
	const [isImageMode, setIsImageMode] = useState(false);
	const [imageModeAction, setImageModeAction] = useState<"generate" | "prompt">("generate");
	const [diffModalCard, setDiffModalCard] = useState<AiActionCard | null>(null);
	const composerFocusRef = useRef<(() => void) | null>(null);

	// Live context catalog & token estimation
	const [contextPreview, setContextPreview] = useState<AiChatContextPreview | null>(null);
	const [isLoadingContextPreview, setIsLoadingContextPreview] = useState(false);
	const [isCompactingContext, setIsCompactingContext] = useState(false);
	const [compactContextFeedback, setCompactContextFeedback] =
		useState<CompactContextFeedback | null>(null);
	const contextPreviewReqIdRef = useRef(0);

	// Load available models on mount
	const loadModels = useCallback(async () => {
		try {
			const result = await aiApi.listAiModels();
			const models = Array.isArray(result?.models) ? result.models : [];
			setRawApiModels(models);
			const imageModels = Array.isArray(result?.imageModels) ? result.imageModels : [];
			setRawApiImageModels(imageModels);
			if (imageModels.length > 0) {
				setSelectedImageModel((prev) =>
					imageModels.some((m) => m.name === prev) ? prev : imageModels[0].name,
				);
			}
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
		setIsAttachMenuOpen(false);
		setIsGalleryPickerOpen(false);
		setIsImageMode(false);
		setImageModeAction("generate");

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
					...(s.isLegacyArchive ? { isLegacyArchive: true } : {}),
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
				setErrorMessage(getErrorMessage(error, lang.t("Failed to load AI chat history.")));
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
		if (isBestiaryScope) {
			return {
				type: "bestiary",
				title: lang.t("Bestiary"),
				pinned: false,
			};
		}
		const effectiveCampaignName =
			activeCampaign?.name || campaignTitle || campaignSlug || lang.t("Campaign");
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
		isBestiaryScope,
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
		currentLanguage,
	]);

	// Compute active displayed session object (always returns valid shape even when unsaved draft)
	const activeSession = useMemo<AiChatSession>(() => {
		if (activeSessionRecord) return activeSessionRecord;
		const now = Date.now();
		return {
			id: "draft-new",
			campaignSlug,
			title: lang.t("New chat"),
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
		currentLanguage,
	]);

	// Effective anchor & sync indicator
	const liveTokenBreakdown = useMemo(
		() => calculateLiveContextTokens(contextPreview, contextSettings),
		[contextPreview, contextSettings],
	);

	const refreshContextPreview = useCallback(async () => {
		if (!campaignSlug) {
			setContextPreview(null);
			return;
		}
		const requestId = ++contextPreviewReqIdRef.current;
		setIsLoadingContextPreview(true);
		try {
			const effectiveAnchor = activeSessionRecord ? activeSessionRecord.anchor : draftAnchor;
			const preview = await aiApi.previewAiChatContext(campaignSlug, {
				...(activeSessionRecord?.id ? { chatId: activeSessionRecord.id } : {}),
				model: selectedModel,
				language: currentLanguage,
				anchor: effectiveAnchor || liveWorkspaceAnchor,
				workspaceContext,
				contextSettings,
			});
			if (requestId !== contextPreviewReqIdRef.current) return;
			if (preview) {
				setContextPreview(preview);
			}
		} catch {
			// Ignore transient preview errors silently
		} finally {
			if (requestId === contextPreviewReqIdRef.current) {
				setIsLoadingContextPreview(false);
			}
		}
	}, [
		campaignSlug,
		activeSessionRecord,
		draftAnchor,
		liveWorkspaceAnchor,
		selectedModel,
		currentLanguage,
		workspaceContext,
		contextSettings,
	]);

	const activeMessageCount = activeSessionRecord?.messages?.length ?? 0;
	const activeSummarizedCount = activeSessionRecord?.summarizedMessageCount ?? 0;
	useEffect(() => {
		void refreshContextPreview();
	}, [
		campaignSlug,
		workspaceContext.sessionFileName,
		workspaceContext.encounterId,
		workspaceContext.sceneId,
		activeSessionRecord?.id,
		activeMessageCount,
		activeSummarizedCount,
		selectedModel,
		currentLanguage,
		contextSettings.responseTone,
		contextSettings.rulesEdition,
		isContextSettingsOpen,
	]);

	const unsummarizedMessageCount = Math.max(0, activeMessageCount - activeSummarizedCount);
	const hasCompactedSummary = Boolean(activeSessionRecord?.summary);

	const compactChatContext = useCallback(async () => {
		if (!campaignSlug || !activeSessionRecord?.id || isSending || isCompactingContext) return;
		setIsCompactingContext(true);
		setErrorMessage(null);
		setCompactContextFeedback(null);
		try {
			const res = await aiApi.compactAiChatContext(campaignSlug, activeSessionRecord.id, {
				model: selectedModel,
				language: currentLanguage,
			});
			if (res?.chat) {
				const converted = toFrontendSession(res.chat);
				setActiveSessionRecord(converted);
				setSessions((prev) => upsertSummaryList(prev, toSummaryFromSession(converted)));
			}
			await refreshContextPreview();
			if (res?.compacted) {
				setCompactContextFeedback({
					kind: "compacted",
					compactedCount: res.compactedCount,
					previousHistoryTokens: res.previousHistoryTokens,
					nextHistoryTokens: res.nextHistoryTokens,
				});
			} else {
				setCompactContextFeedback({ kind: "already_compacted" });
			}
		} catch (error) {
			setErrorMessage(getErrorMessage(error, lang.t("Failed to compact conversation context.")));
		} finally {
			setIsCompactingContext(false);
		}
	}, [
		campaignSlug,
		activeSessionRecord?.id,
		isSending,
		isCompactingContext,
		selectedModel,
		currentLanguage,
		refreshContextPreview,
	]);

	const contextAnchor = useMemo<AiContextAnchor>(() => {
		const activeModelObj = availableModels.find((m) => m.id === selectedModel);
		const maxTokens =
			contextPreview?.maxTokens ||
			activeSessionRecord?.maxTokens ||
			activeModelObj?.inputTokenLimit ||
			1000000;
		const tokenEstimate = contextPreview
			? liveTokenBreakdown.totalTokens
			: activeSessionRecord?.tokenEstimate || 0;

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
				subtitle: sameTarget
					? lang.t("Synced with editor")
					: lang.t("Pinned to another context"),
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
			subtitle: lang.t("Synced with editor"),
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
		contextPreview,
		liveTokenBreakdown.totalTokens,
		currentLanguage,
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
				setErrorMessage(getErrorMessage(error, lang.t("Failed to save chat settings.")));
			}
		},
		[campaignSlug, activeSessionRecord?.id],
	);

	const createNewChat = useCallback(() => {
		sendAbortRef.current?.abort();
		setIsSending(false);
		setActiveSessionRecord(null);
		setContextSettingsState(INITIAL_CONTEXT_SETTINGS);
		setCompactContextFeedback(null);
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
			setCompactContextFeedback(null);
			setErrorMessage(null);
			try {
				const fetched = await aiApi.getAiChat(campaignSlug, chatId);
				if (!fetched) throw new Error(lang.t("Failed to load chat data."));
				const session = toFrontendSession(fetched);
				setActiveSessionRecord(session);
				if (session.model) setSelectedModelState(session.model);
				setAutoApplyState(Boolean(session.autoApply));
				if (session.contextSettings) setContextSettingsState(session.contextSettings);
				setIsHistoryOpen(false);
			} catch (error) {
				setErrorMessage(getErrorMessage(error, lang.t("Failed to open chat.")));
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
					setCompactContextFeedback(null);
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
				setErrorMessage(getErrorMessage(error, lang.t("Failed to delete chat.")));
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
			const hasSessionChange =
				Boolean(
					result.actionCard?.diffResources?.some((r) => r?.kind === "session"),
				) ||
				Boolean(
					result.aiResponse?.changes?.resources?.some(
						(r) => r?.kind === "session",
					),
				);
			const updatedSessionFileName =
				typeof (result.updated as { fileName?: unknown } | null)?.fileName ===
				"string"
					? String((result.updated as { fileName?: string }).fileName || "").trim()
					: "";
			const isDifferentSessionMutation = Boolean(
				updatedSessionFileName &&
					activeSessionFileName &&
					updatedSessionFileName !== activeSessionFileName,
			);

			if (isDifferentSessionMutation) {
				runtime.requestCampaignReload();
				if (
					Array.isArray(result.changedEntityTypes) &&
					result.changedEntityTypes.length > 0
				) {
					runtime.refreshEntities();
				}
				runtime.publishSyncEvent({
					resource: "ai",
					campaignSlug: campaignSlug || undefined,
					sessionFileName: updatedSessionFileName,
				});
			} else if (result.updated) {
				applyUpdatedAiData(result.updated, {
					entityTypes: result.changedEntityTypes,
					historyEntry: result.aiResponse || null,
				});
			} else if (
				hasSessionChange ||
				(Array.isArray(result.changedEntityTypes) &&
					result.changedEntityTypes.length > 0)
			) {
				if (hasSessionChange) {
					runtime.requestCampaignReload();
				}
				if (
					Array.isArray(result.changedEntityTypes) &&
					result.changedEntityTypes.length > 0
				) {
					runtime.refreshEntities();
				}
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
		async (
			contentToSend?: string,
			options?: {
				clearDraft?: boolean;
				restoreDraft?: string | null;
				restoreImageMode?: boolean;
			},
		) => {
			if (!campaignSlug || isSending) return;
			const text = (contentToSend ?? inputValue).trim();
			const pendingAttachments = [...attachments];
			if (!text && pendingAttachments.length === 0) return;

			setErrorMessage(null);
			setIsSending(true);
			setIsAttachMenuOpen(false);
			setIsModelPickerOpen(false);
			setIsCommandsInfoOpen(false);
			const shouldClearDraft = options?.clearDraft ?? contentToSend === undefined;
			const previousDraft =
				options?.restoreDraft !== undefined
					? options.restoreDraft
					: contentToSend === undefined
						? inputValue
						: null;
			if (shouldClearDraft) setInputValue("");
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
					title: lang.t("New chat"),
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
						language: currentLanguage,
					});
					if (!created?.id) throw new Error(lang.t("Failed to create a new chat."));
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
						language: currentLanguage,
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
				if (!result?.chat) throw new Error(lang.t("Invalid server response."));

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
				if (options?.restoreImageMode) setIsImageMode(true);
				setAttachments(pendingAttachments);
				if (!isAbortError(error)) {
					if (isMissingApiKeyError(error)) {
						setIsApiKeyMissing(true);
					}
					setErrorMessage(
						getErrorMessage(error, lang.t("Failed to get a response from the AI assistant.")),
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
			currentLanguage,
			syncMutationResultToWorkspace,
		],
	);

	const editAndResendMessage = useCallback(
		async (userMessageId: string, nextContent: string) => {
			if (!campaignSlug || isSending || !activeSessionRecord?.id || activeSessionRecord.isLegacyArchive) {
				return;
			}
			const trimmed = nextContent.trim();
			if (!trimmed) return;

			const messages = activeSessionRecord.messages || [];
			const cutIndex = messages.findIndex((m) => m.id === userMessageId);
			if (cutIndex === -1) return;

			const hasAppliedCards = messages
				.slice(cutIndex)
				.some((m) => m.actionCards?.some((c) => c.status === "applied"));
			if (hasAppliedCards) {
				const confirmed = await runtime.requestConfirmation({
					title: lang.t("Replace message?"),
					message: lang.t(
						"The previous response already has applied changes in this campaign. They will remain in the campaign, but the previous chat reply will be replaced with a new one. Continue?",
					),
				});
				if (!confirmed) return;
			}

			setErrorMessage(null);
			setIsSending(true);

			const now = Date.now();
			const targetMsg = messages[cutIndex];
			const optimisticUserMsg: ChatMessage = {
				id: `temp-user-${now}`,
				role: "user",
				content: trimmed,
				timestamp: now,
				status: "done",
				...(targetMsg?.attachments?.length ? { attachments: targetMsg.attachments } : {}),
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
			setActiveSessionRecord((prev) =>
				prev
					? {
							...prev,
							messages: [
								...prev.messages.slice(0, cutIndex),
								optimisticUserMsg,
								streamingPlaceholder,
							],
						}
					: prev,
			);

			const controller = new AbortController();
			sendAbortRef.current = controller;

			try {
				const result = await aiApi.sendAiChatMessageStream(
					campaignSlug,
					activeSessionRecord.id,
					{
						content: trimmed,
						model: selectedModel,
						autoApply,
						contextSettings,
						anchor: contextAnchor.pinned
							? activeSessionRecord.anchor || draftAnchor
							: liveWorkspaceAnchor,
						workspaceContext,
						language: currentLanguage,
						truncateFromMessageId: userMessageId,
						attachedImages: [],
						attachedFiles: [],
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
				if (!result?.chat) throw new Error(lang.t("Invalid server response."));

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
				if (!isAbortError(error)) {
					if (isMissingApiKeyError(error)) {
						setIsApiKeyMissing(true);
					}
					setErrorMessage(
						getErrorMessage(error, lang.t("Failed to get a response from the AI assistant.")),
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
			activeSessionRecord,
			runtime,
			selectedModel,
			autoApply,
			contextSettings,
			contextAnchor.pinned,
			draftAnchor,
			liveWorkspaceAnchor,
			workspaceContext,
			currentLanguage,
			syncMutationResultToWorkspace,
		],
	);

	const regenerateLastResponse = useCallback(async () => {
		if (!activeSessionRecord || isSending || activeSessionRecord.isLegacyArchive) return;
		const messages = activeSessionRecord.messages || [];
		for (let i = messages.length - 1; i >= 0; i -= 1) {
			if (messages[i].role === "user" && messages[i].content.trim()) {
				await editAndResendMessage(messages[i].id, messages[i].content);
				return;
			}
		}
	}, [activeSessionRecord, isSending, editAndResendMessage]);

	const registerComposerFocus = useCallback((fn: (() => void) | null) => {
		composerFocusRef.current = fn;
	}, []);

	const focusComposerEditor = useCallback(() => {
		if (typeof window === "undefined") return;
		window.requestAnimationFrame(() => {
			if (composerFocusRef.current) {
				composerFocusRef.current();
				return;
			}
			document
				.querySelector<HTMLElement>(
					'.AiChatComposerV2__inputWrap .MarkdownView[contenteditable="true"], .AiChatComposerV2__editor',
				)
				?.focus();
		});
	}, []);

	const openImageMode = useCallback(
		(prefillPrompt?: string) => {
			if (prefillPrompt !== undefined) {
				setInputValue(
					String(prefillPrompt || "").replace(/(^|\s)@image\b\s*/i, "$1").trim(),
				);
			} else {
				const stripped = inputValue.replace(/(^|\s)@image\b\s*/i, "$1").trim();
				if (stripped !== inputValue.trim()) {
					setInputValue(stripped);
				}
			}
			setIsCommandsInfoOpen(false);
			setIsModelPickerOpen(false);
			setIsAttachMenuOpen(false);
			setImageModeAction("generate");
			setIsImageMode(true);
			focusComposerEditor();
		},
		[inputValue, focusComposerEditor],
	);

	const exitImageMode = useCallback(() => {
		setIsImageMode(false);
		setIsModelPickerOpen(false);
		setIsAttachMenuOpen(false);
		focusComposerEditor();
	}, [focusComposerEditor]);

	const toggleImageMode = useCallback(() => {
		if (isImageMode) {
			exitImageMode();
		} else {
			openImageMode();
		}
	}, [isImageMode, exitImageMode, openImageMode]);

	const selectImageModel = useCallback((modelId: string) => {
		setSelectedImageModel(modelId);
		setIsModelPickerOpen(false);
	}, []);

	const generateChatImage = useCallback(
		async (promptText: string, modelName?: string) => {
			if (!campaignSlug || isSending) return;
			const trimmed = promptText.trim();
			if (!trimmed) return;

			setErrorMessage(null);
			setIsSending(true);
			const shouldClearDraft = trimmed === inputValue.trim() && inputValue.length > 0;
			const previousDraft = shouldClearDraft ? inputValue : null;
			if (shouldClearDraft) {
				setInputValue("");
			}
			setIsImageMode(false);
			setIsAttachMenuOpen(false);
			setIsModelPickerOpen(false);
			setIsCommandsInfoOpen(false);
			const pendingImages = attachments.filter((a) => a.kind === "image");
			setAttachments((prev) => prev.filter((a) => a.kind !== "image"));

			const now = Date.now();
			const optimisticUserMsg: ChatMessage = {
				id: `temp-user-img-${now}`,
				role: "user",
				content: `@image ${trimmed}`,
				timestamp: now,
				status: "done",
				...(pendingImages.length > 0 ? { attachments: pendingImages } : {}),
			};
			const loadingAssistantMsg: ChatMessage = {
				id: `temp-assistant-img-${now + 1}`,
				role: "assistant",
				content: lang.t("Generating image..."),
				timestamp: now + 1,
				status: "streaming",
				streamPhase: "thinking",
			};

			const prevRecordSnapshot = activeSessionRecord;
			setActiveSessionRecord((prev) => ({
				...(prev || {
					id: "draft-new",
					campaignSlug,
					title: lang.t("New chat"),
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
					loadingAssistantMsg,
				],
			}));

			try {
				let targetChatId = activeSessionRecord?.id;
				if (!targetChatId || targetChatId === "draft-new") {
					const created = await aiApi.createAiChat(campaignSlug, {
						model: selectedModel,
						autoApply,
						contextSettings,
						anchor: draftAnchor || liveWorkspaceAnchor,
						language: currentLanguage,
					});
					if (!created?.id) throw new Error(lang.t("Failed to create a new chat."));
					targetChatId = created.id;
				}

				const result = await aiApi.generateAiChatImage(campaignSlug, targetChatId, {
					prompt: trimmed,
					displayPrompt: `@image ${trimmed}`,
					modelName: modelName || selectedImageModel,
					chatModel: selectedModel,
					autoApply,
					contextSettings,
					anchor: contextAnchor.pinned
						? activeSessionRecord?.anchor || draftAnchor
						: liveWorkspaceAnchor,
					language: currentLanguage,
					attachedImages: pendingImages,
				});
				if (!result?.chat) throw new Error(lang.t("Invalid image generator response."));

				const persistedSession = toFrontendSession(result.chat);
				setActiveSessionRecord(persistedSession);
				setSessions((prev) =>
					upsertSummaryList(prev, toSummaryFromSession(persistedSession)),
				);
				runtime.publishSyncEvent({
					resource: "images",
					campaignSlug: isBestiaryScope ? "general" : campaignSlug,
				});
			} catch (error) {
				setActiveSessionRecord(prevRecordSnapshot);
				if (previousDraft !== null) {
					setInputValue(previousDraft);
				}
				setIsImageMode(true);
				setImageModeAction("generate");
				if (pendingImages.length > 0) {
					setAttachments((prev) => [...pendingImages, ...prev]);
				}
				if (isMissingApiKeyError(error)) {
					setIsApiKeyMissing(true);
				}
				setErrorMessage(
					getErrorMessage(error, lang.t("Failed to generate image.")),
				);
			} finally {
				setIsSending(false);
			}
		},
		[
			campaignSlug,
			isBestiaryScope,
			isSending,
			attachments,
			activeSessionRecord,
			selectedModel,
			selectedImageModel,
			autoApply,
			contextSettings,
			draftAnchor,
			liveWorkspaceAnchor,
			contextAnchor.pinned,
			currentLanguage,
			inputValue,
			runtime,
		],
	);

	const submitComposer = useCallback(async () => {
		if (isSending) return;
		if (!isImageMode) {
			await sendMessage();
			return;
		}
		const trimmed = inputValue.trim();
		if (imageModeAction === "generate") {
			if (!trimmed) return;
			await generateChatImage(trimmed, selectedImageModel);
			return;
		}
		if (!trimmed && attachments.length === 0) return;
		const prefixedPrompt = trimmed
			? /^@image\b/i.test(trimmed)
				? trimmed
				: `@image ${trimmed}`
			: "@image";
		setIsImageMode(false);
		await sendMessage(prefixedPrompt, {
			clearDraft: true,
			restoreDraft: inputValue,
			restoreImageMode: true,
		});
	}, [
		isSending,
		isImageMode,
		inputValue,
		imageModeAction,
		selectedImageModel,
		attachments.length,
		generateChatImage,
		sendMessage,
	]);

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
						language: currentLanguage,
						...(options?.useDraftSnapshot ? { useDraftSnapshot: true } : {}),
					}),
				lang.t("Failed to apply action."),
			);
		},
		[runActionMutation, campaignSlug, workspaceContext, currentLanguage],
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
				lang.t("Failed to undo applied action."),
			);
		},
		[runActionMutation, campaignSlug],
	);

	const rejectActionCard = useCallback(
		(cardId: string) => {
			void runActionMutation(
				cardId,
				(chatId) => aiApi.rejectAiChatAction(campaignSlug, chatId, cardId),
				lang.t("Failed to dismiss suggestion."),
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
					setErrorMessage(lang.t("Unsupported file format: {name}", { name: file.name }));
					continue;
				}
				const isImage = Boolean(imageMime);
				const sameKindCount = nextList.filter((a) =>
					isImage ? a.kind === "image" : a.kind === "file",
				).length;
				if (sameKindCount >= MAX_AI_ATTACHMENTS) {
					setErrorMessage(
						lang.t("Maximum {count} attachments of the same type.", {
							count: MAX_AI_ATTACHMENTS,
						}),
					);
					break;
				}
				const maxBytes = isImage ? MAX_AI_IMAGE_BYTES : MAX_AI_FILE_BYTES;
				if (file.size > maxBytes) {
					setErrorMessage(
						lang.t('File "{name}" exceeds the 10 MB limit.', { name: file.name }),
					);
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
					setErrorMessage(
						getErrorMessage(error, lang.t("Error reading file {name}", { name: file.name })),
					);
				}
			}
			setAttachments(nextList);
		},
		[attachments],
	);

	const removeAttachment = useCallback((id: string) => {
		setAttachments((prev) => prev.filter((item) => item.id !== id));
	}, []);

	const addGalleryAttachment = useCallback(
		(image: { name?: string; displayName?: string; url?: string; sizeBytes?: number } | null | undefined) => {
			if (!image?.url) return;
			const sameKindCount = attachments.filter((a) => a.kind === "image").length;
			if (sameKindCount >= MAX_AI_ATTACHMENTS) {
				setErrorMessage(
					lang.t("Maximum {count} attachments of the same type.", {
						count: MAX_AI_ATTACHMENTS,
					}),
				);
				setIsGalleryPickerOpen(false);
				setIsAttachMenuOpen(false);
				return;
			}
			setErrorMessage(null);
			const name =
				String(image.displayName || image.name || "gallery-image").trim() ||
				"gallery-image";
			const descriptor: AiChatAttachment = {
				id: `gallery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				kind: "image",
				name,
				url: image.url,
				sizeBytes: typeof image.sizeBytes === "number" ? image.sizeBytes : undefined,
			};
			const nextKey = getAttachedImageKey(descriptor);
			setAttachments((prev) => {
				if (prev.filter((a) => a.kind === "image").length >= MAX_AI_ATTACHMENTS) {
					return prev;
				}
				if (prev.some((item) => item.kind === "image" && getAttachedImageKey(item) === nextKey)) {
					return prev;
				}
				return [...prev, descriptor];
			});
			setIsGalleryPickerOpen(false);
			setIsAttachMenuOpen(false);
			focusComposerEditor();
		},
		[attachments, focusComposerEditor],
	);

	const saveApiKey = useCallback(async (apiKey: string) => {
		const trimmed = String(apiKey || "").trim();
		if (!trimmed) {
			setErrorMessage(lang.t("Enter a Gemini API key."));
			return false;
		}
		setIsSavingApiKey(true);
		setErrorMessage(null);
		try {
			const res = await saveGeminiApiKeyAndRefreshModels({ apiKey: trimmed });
			if (res.status === "saved" && res.modelSelection) {
				const models = Array.isArray(res.modelSelection.models) ? res.modelSelection.models : [];
				if (models.length > 0) setRawApiModels(models);
				const imageModels = Array.isArray(res.modelSelection.imageModels)
					? res.modelSelection.imageModels
					: [];
				if (imageModels.length > 0) {
					setRawApiImageModels(imageModels);
					setSelectedImageModel((prev) =>
						imageModels.some((m) => m.name === prev) ? prev : imageModels[0].name,
					);
				}
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
			setErrorMessage(getErrorMessage(error, lang.t("Failed to save API key.")));
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
		isBestiaryScope,
		sessions,
		activeSession,
		activeSessionId: activeSession.id,
		availableModels,
		availableImageModels,
		selectedImageModel,
		inputValue,
		selectedModel,
		autoApply,
		contextSettings,
		contextAnchor,
		contextPreview,
		isLoadingContextPreview,
		isCompactingContext,
		compactContextFeedback,
		unsummarizedMessageCount,
		hasCompactedSummary,
		liveTokenBreakdown,
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
		isAttachMenuOpen,
		isGalleryPickerOpen,
		isImageMode,
		imageModeAction,
		diffModalCard,
		setInputValue,
		setAutoApply,
		setSelectedModel,
		setSelectedImageModel: selectImageModel,
		setContextSettings,
		setErrorMessage,
		setIsHistoryOpen,
		setIsContextSettingsOpen,
		setIsCommandsInfoOpen,
		setIsModelPickerOpen,
		setIsAttachMenuOpen,
		setIsGalleryPickerOpen,
		setImageModeAction,
		setDiffModalCard,
		registerComposerFocus,
		focusComposerEditor,
		createNewChat,
		selectSession,
		deleteSession,
		sendMessage,
		submitComposer,
		editAndResendMessage,
		regenerateLastResponse,
		openImageMode,
		exitImageMode,
		toggleImageMode,
		generateChatImage,
		cancelSending,
		addGalleryAttachment,
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
		refreshContextPreview,
		compactChatContext,
	};
}
