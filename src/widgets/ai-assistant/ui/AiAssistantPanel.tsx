import {
	Children,
	cloneElement,
	createElement,
	isValidElement,
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
	type ReactNode,
} from "react";
import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import { campaignApi } from "../../../entities/campaign/index.js";
import { sessionApi } from "../../../entities/session/index.js";
import { bestiaryApi } from "../../../entities/bestiary/index.js";
import {
	aiApi,
	aiGenerationLifecycleReducer,
	buildAiGeneratedResultPlan,
	buildAiUpdatedDataPlan,
	buildAiTokenEstimate,
	buildAiGenerationRequest,
	createAiHistoryWorkflow,
	executeAiGeneratedResultPlan,
	executeAiGeneration,
	executeAiHistoryRetry,
	executeAiUpdatedDataPlan,
	formatAiGenerationFailureAlert,
	getAiHistoryRetryFailure,
	hasHistoryChanges,
	initialAiGenerationLifecycle,
	isAiGenerationPending,
	saveGeminiApiKeyAndRefreshModels,
	isFailedHistoryEntry,
	useAiImagePromptData,
	type AiGenerationResult,
	type AiHistoryEntry,
	type AiHistoryResource,
	type AiModelDescriptor,
	type AiContextSession,
	type BuildAiUpdatedDataPlanOptions,
} from "../../../features/ai/index.js";
import type { AiUiAttachment } from "../../../features/ai/ui/index.js";
const api = { ...campaignApi, ...sessionApi, ...bestiaryApi, ...aiApi };
import AiImagePromptPickerModal from "./AiImagePromptPickerModal.tsx";
import AiAssistantPanelView from "./AiAssistantPanelView.tsx";
import { createAiAssistantPresentation } from "../model/assistantPresentation.ts";
import {
	getAiAssistantPromptPlaceholder,
	getAiAssistantRouteState,
	getAiAssistantTitle,
} from "../model/assistantContext.ts";
import { useAiAssistantContextController } from "../model/useAiAssistantContextController.ts";
import { useAiAssistantHistoryController } from "../model/useAiAssistantHistoryController.ts";
import { useAiImagePromptController } from "../model/useAiImagePromptController.ts";
import { useAiImagePromptState } from "../model/useAiImagePromptState.ts";
import type { ImagePromptTarget } from "../model/imagePromptPicker.ts";
import { AiResponseModal } from "../../ai-response-modal/index.js";
import {
	alert,
	confirm,
	dataSyncReceivedAction,
	refreshEntitiesAction,
	requestCampaignsReloadAction,
	setActiveCampaignAction,
	setActiveEncounterAction,
	setActiveSessionAction,
} from "../../../shared/model/index.js";
import { useAppDispatch, useAppSelector } from "../../../shared/model/index.js";
import { lang } from "../../../shared/lib/index.js";
import { renderMentionText } from "../../../features/rich-content/index.js";
import { formatBytes } from "../../../shared/lib/index.js";
import {
	getHistoryChangeSummary as getAiHistoryChangeSummary,
	getLocalizedDiffResourceState,
} from "../../../features/ai/index.js";
import "../../../assets/components/AiAssistantPanel.css";

const markdownTagsWithMentions = [
	"p",
	"strong",
	"em",
	"del",
	"blockquote",
	"li",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"td",
	"th",
	"a",
	"span",
];

function translate(
	phrase: string,
	variables?: Record<string, unknown>,
): string {
	return lang.t(phrase, variables);
}

const {
	formatResponseDate,
	getAiResponseStateLabel,
	getCharacterContextKey,
	getCharacterDisplayName,
	getHistoryDetailRows,
	getHistoryRequestText,
	getHistoryTitle,
	getImagePromptPreview,
	getLocationContextKey,
	getLocationDisplayName,
	getSceneImagePromptDescription,
	getSceneImagePromptTitle,
} = createAiAssistantPresentation({
	translate,
	isFailedHistoryEntry: (entry) =>
		isFailedHistoryEntry(entry as AiHistoryEntry),
	hasHistoryChanges: (entry) => hasHistoryChanges(entry as AiHistoryEntry),
});

const { buildRetryPlan, canRetryHistoryEntry } =
	createAiHistoryWorkflow(getHistoryRequestText);

function renderMentionChildren(children: ReactNode): ReactNode {
	return Children.map(children, (child) => {
		if (typeof child === "string") {
			return renderMentionText(child);
		}
		if (isValidElement<{ children?: ReactNode }>(child) && child.props.children) {
			if (child.type === "code" || child.type === "pre") {
				return child;
			}
			return cloneElement(child, {
				...child.props,
				children: renderMentionChildren(child.props.children),
			});
		}
		return child;
	});
}

const markdownMentionComponents = Object.fromEntries(
	markdownTagsWithMentions.map((tag) => [
		tag,
		({ children, ...tagProps }: { children?: ReactNode } & Record<string, unknown>) =>
			createElement(tag, tagProps, renderMentionChildren(children)),
	]),
);

function getHistoryChangeSummary(entry: AiHistoryEntry | null | undefined) {
	return getAiHistoryChangeSummary(entry, translate);
}

function getDiffResourceState(resource: AiHistoryResource) {
	return getLocalizedDiffResourceState(resource, translate);
}

async function listAiContextSessions(
	campaignSlug: string,
): Promise<AiContextSession[]> {
	const sessions = await api.listSessions(campaignSlug);
	return (Array.isArray(sessions) ? sessions : []).filter(
		(session): session is typeof session & { fileName: string } =>
			typeof session.fileName === "string" && Boolean(session.fileName),
	);
}

async function getAiContextSession(
	campaignSlug: string,
	fileName: string,
): Promise<AiContextSession | null> {
	const session = await api.getSession(campaignSlug, fileName);
	return session ? { ...session, fileName: session.fileName || fileName } : null;
}

interface ApplyUpdatedAiDataOptions {
	entityTypes?: unknown;
	generated?: BuildAiUpdatedDataPlanOptions["generated"];
	historyEntry?: AiHistoryEntry | null;
	trackUndo?: boolean;
}

interface GenerateOptions {
	forceParseAIResponse?: boolean | null;
	imageTarget?: ImagePromptTarget | null;
	imagePromptBasePromptOverride?: string;
	userInstructionsOverride?: string | null;
}

interface GeneratedAiDataInput {
	data: AiGenerationResult | null;
	requestType: string | null;
	shouldParseResponse: boolean;
	clearPromptOnApplied?: boolean;
}

const optional = <T,>(value: T | null | undefined): T | undefined =>
	value ?? undefined;

export interface AiAssistantPanelProps {
	isBestiary?: boolean;
	onRegisterImagePromptAction?: (
		handler: ((monster: BestiaryMonster) => void) | null,
	) => void;
}

export default function AiAssistantPanel({
	isBestiary = false,
	onRegisterImagePromptAction,
}: AiAssistantPanelProps) {
	const dispatch = useAppDispatch();
	const currentLanguage = useAppSelector(
		(state) => state.localization.language,
	);
	const activeCampaign = useAppSelector((state) => state.active.campaign);
	const activeSession = useAppSelector((state) => state.active.session);
	const activeEncounter = useAppSelector((state) => state.active.encounter);
	const imagePromptBasePrompt = useAppSelector(
		(state) => state.ui.imagePromptBasePrompt || "",
	);
	const globalAiBasePrompt = useAppSelector(
		(state) => state.ui.aiBasePrompt || "",
	);
	const campaignAiBasePrompts = useAppSelector(
		(state) => state.ui.campaignAiBasePrompts || {},
	);
	const campaignImagePromptBasePrompts = useAppSelector(
		(state) => state.ui.campaignImagePromptBasePrompts || {},
	);
	const navigation = useAppSelector((state) => state.navigation);
	const routeState = useMemo(
		() =>
			getAiAssistantRouteState({
				isBestiary,
				navigation,
				imagePromptBasePrompt,
				campaignAiBasePrompts,
				campaignImagePromptBasePrompts,
			}),
		[
			campaignAiBasePrompts,
			campaignImagePromptBasePrompts,
			imagePromptBasePrompt,
			isBestiary,
			navigation,
		],
	);
	const {
		route: initialRoute,
		activeImagePromptBasePrompt,
		activeCampaignBasePrompt,
		isCampaign,
		isEncounter,
		historyCampaign: aiHistoryCampaign,
		assetCampaignSlug,
		generateEncountersByDefault,
	} = routeState;

	const [isOpen, setIsOpen] = useState(false);
	const [isContextModalOpen, setIsContextModalOpen] = useState(false);
	const [generationLifecycle, dispatchGenerationLifecycle] = useReducer(
		aiGenerationLifecycleReducer,
		initialAiGenerationLifecycle,
	);
	const [useContext, setUseContext] = useState(true);
	const [error, setError] = useState("");
	const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
	const [apiKeyInput, setApiKeyInput] = useState("");
	const [isSavingApiKey, setIsSavingApiKey] = useState(false);
	const [userInstructions, setUserInstructions] = useState("");
	const [notification, setNotification] = useState<string | null>(null);
	const imagePromptState = useAiImagePromptState();
	const {
		isOpen: isImagePromptPickerOpen,
		setIsOpen: setIsImagePromptPickerOpen,
		selectedTarget: selectedImagePromptTarget,
		instructions: imagePromptInstructions,
		setInstructions: setImagePromptInstructions,
		request: imagePromptRequest,
		setRequest: setImagePromptRequest,
		isContextMode: isImagePromptContextMode,
	} = imagePromptState;
	const [attachedImages, setAttachedImages] = useState<AiUiAttachment[]>([]);
	const [attachedFiles, setAttachedFiles] = useState<AiUiAttachment[]>([]);
	const [parseAIResponse, setParseAIResponse] = useState(isEncounter);
	const [generateCharacters, setGenerateCharacters] = useState(false);
	const [generateNpcs, setGenerateNpcs] = useState(true);
	const [generateLocations, setGenerateLocations] = useState(true);
	const [generateEncounters, setGenerateEncounters] = useState(
		generateEncountersByDefault,
	);
	const [generateCustomMonsters, setGenerateCustomMonsters] = useState(false);
	const [aiModels, setAiModels] = useState<AiModelDescriptor[]>([]);
	const [selectedModel, setSelectedModel] = useState("");
	const {
		charactersList,
		characterContext,
		characterContextItems,
		campaignContext,
		contextConfig,
		ensureCampaignEntities,
		ensureSessions,
		expandedSessions,
		isCustomMonsterGenerationVisible,
		isLoading: isContextLoading,
		isResponseParsingLocked,
		locationContext,
		locationContextItems,
		locationsList,
		npcContext,
		npcContextItems,
		npcsList,
		sessionData,
		sessionName,
		sessionsList,
		setAllCampaignContextItems,
		setContextConfig,
		toggleSessionDetails,
		updateCampaignContextListIncluded,
		updateCampaignContextListItem,
		updateContextConfig,
	} = useAiAssistantContextController({
		campaignSlug: initialRoute.campaign,
		sessionSlug: initialRoute.session,
		isBestiary,
		isCampaign,
		isEncounter,
		isPanelOpen: isOpen,
		isContextModalOpen,
		isImagePromptPickerOpen,
		useContext,
		parseAiResponse: parseAIResponse,
		generateEncounters,
		activeCampaign,
		activeSession,
		activeEncounter,
		listSessions: listAiContextSessions,
		getEntities: api.getEntities,
		getSession: getAiContextSession,
	});
	const loading =
		isContextLoading || isAiGenerationPending(generationLifecycle);
	const {
		customMonsters: imagePromptCustomMonsters,
		isLoading: isImagePromptDataLoading,
		prepareImagePromptData,
		sessions: imagePromptSessions,
	} = useAiImagePromptData({
		campaignSlug: initialRoute.campaign,
		isCampaign,
		isBestiary,
		isPickerOpen: isImagePromptPickerOpen,
		ensureCampaignEntities,
		ensureSessions,
		getSession: getAiContextSession,
		getCustomBestiaryData: api.getCustomBestiaryData,
	});
	const activeGenerateControllerRef = useRef<AbortController | null>(null);
	const nextGenerationRequestIdRef = useRef(0);
	const [canCancelGenerate, setCanCancelGenerate] = useState(false);
	const cancelGenerateRequest = () => {
		activeGenerateControllerRef.current?.abort();
		activeGenerateControllerRef.current = null;
		setCanCancelGenerate(false);
	};

	useEffect(() => {
		if ((!isOpen && !isImagePromptPickerOpen) || aiModels.length > 0) return;
		api
			.listAiModels()
			.then((result) => {
				const models = Array.isArray(result?.models) ? result.models : [];
				setAiModels(models);
				if (!selectedModel) {
					setSelectedModel(result?.defaultModel || models[0]?.name || "");
				}
			})
			.catch((err) => {
				console.error("Failed to load AI models", err);
			});
	}, [isOpen, isImagePromptPickerOpen, aiModels.length, selectedModel]);

	const publishAiSyncEvent = useCallback(
		(extra: Record<string, unknown> = {}) => {
			dispatch(
				dataSyncReceivedAction({
					resource: "ai",
					campaignSlug:
						initialRoute.campaign && initialRoute.campaign !== "bestiary"
							? initialRoute.campaign
							: undefined,
					sessionFileName: initialRoute.session || undefined,
					...extra,
				}),
			);
		},
		[dispatch, initialRoute.campaign, initialRoute.session],
	);

	const applyUpdatedAiData = useCallback(
		(updated: unknown, options: ApplyUpdatedAiDataOptions = {}) => {
			const plan = buildAiUpdatedDataPlan({
				updated,
				entityTypes: options.entityTypes,
				generated: options.generated,
				historyEntry: options.historyEntry,
				activeCampaign,
				isBestiary,
				isCampaign,
				isEncounter,
				encounterId: initialRoute.encounter,
				fallbackSessionFileName: optional(initialRoute.session),
			});
			if (!plan) return false;
			return executeAiUpdatedDataPlan({
				plan,
				onSetActiveCampaign: (campaign) =>
					dispatch(setActiveCampaignAction(campaign)),
				onSetActiveSession: (session) =>
					dispatch(setActiveSessionAction(session)),
				onSetActiveEncounter: (encounter) =>
					dispatch(setActiveEncounterAction(encounter)),
				onRequestCampaignReload: () =>
					dispatch(requestCampaignsReloadAction()),
				onPublishSyncEvent: publishAiSyncEvent,
				onRefreshEntities: () => dispatch(refreshEntitiesAction()),
			});
		},
		[
			activeCampaign,
			dispatch,
			initialRoute.encounter,
			initialRoute.session,
			isBestiary,
			isCampaign,
			isEncounter,
			publishAiSyncEvent,
		],
	);

	const historyLabels = {
		note: lang.t("Note"),
		scene: lang.t("Scene"),
		encounter: lang.t("Encounter"),
		creature: lang.t("Creature"),
	};
	const {
		generatedPrompt,
		generatedPromptRef,
		isGeneratedPromptCopied,
		isRestoring: isRestoringResponse,
		deleteEntry: deleteResponseHistoryEntry,
		clearHistory: clearResponseHistory,
		restoreEntry: restoreAiHistoryEntry,
		saveDraft: saveDraftHistoryEntryChanges,
		diffResources: selectedResponseDiffResources,
		hasChanges: selectedResponseHasChanges,
		responseHistorySizeBytes,
		selectedResponseDetails,
		selectedResponseEntry,
		selectedResponseId,
		visibleEntries: visibleResponseHistory,
		closePrompt: closeGeneratedPrompt,
		copyPrompt: copyGeneratedPrompt,
		setResponseHistory,
		showPrompt: showGeneratedPrompt,
		upsertEntry: upsertResponseHistoryEntry,
		refreshStats: refreshResponseHistoryStats,
	} = useAiAssistantHistoryController({
		historyCampaign: aiHistoryCampaign,
		isOpen,
		route: initialRoute,
		isBestiary,
		isCampaign,
		currentLanguage,
		translate,
		listResponses: api.listAiResponses,
		getResponseStats: api.getAiResponsesStats,
		getDetails: (entry, language) =>
			entry ? getHistoryDetailRows(entry, language) : [],
		confirm: async (copy) => Boolean(await dispatch(confirm(copy))),
		alert: (copy) => dispatch(alert(copy)),
		applyUpdatedData: applyUpdatedAiData,
		requestReload: (entityTypes) => {
			dispatch(requestCampaignsReloadAction());
			if (entityTypes.length > 0) dispatch(refreshEntitiesAction());
		},
		notify: setNotification,
		labels: historyLabels,
	});

	const handleSaveApiKey = async (): Promise<void> => {
		const apiKey = apiKeyInput.trim();
		if (!apiKey) {
			setError(lang.t("Enter Gemini API key."));
			return;
		}

		setIsSavingApiKey(true);
		setError("");
		try {
			const result = await saveGeminiApiKeyAndRefreshModels({
				apiKey,
				onRefreshError: (refreshError) => {
					console.error(
						"Failed to refresh AI models after saving key",
						refreshError,
					);
				},
			});
			if (result.status === "saved" && result.modelSelection) {
				setAiModels(result.modelSelection.models);
				setSelectedModel(result.modelSelection.selectedModel);
			}
			setApiKeyInput("");
			setIsApiKeyMissing(false);
			setNotification(lang.t("Gemini API key saved."));
		} catch (error) {
			setError(
				error instanceof Error && error.message
					? error.message
					: lang.t("Failed to save Gemini API key."),
			);
		} finally {
			setIsSavingApiKey(false);
		}
	};

	const handleGeneratedAiData = ({
		data,
		requestType,
		shouldParseResponse,
		clearPromptOnApplied = true,
	}: GeneratedAiDataInput): void => {
		const plan = buildAiGeneratedResultPlan({
			data,
			requestType,
			shouldParseResponse,
			isBestiary,
			isCampaign,
			isEncounter,
			clearPromptOnApplied,
		});
		executeAiGeneratedResultPlan({
			plan,
			onHistoryEntry: upsertResponseHistoryEntry,
			onShowPrompt: showGeneratedPrompt,
			onNotification: (notification) => {
				setNotification(
					notification === "draft-created"
						? lang.t("AI draft created.")
						: notification === "custom-creatures-saved"
							? lang.t("Custom creatures saved.")
							: lang.t("AI changes applied successfully!"),
				);
			},
			onApplyUpdated: (updatedPlan) => {
				applyUpdatedAiData(updatedPlan.updated, {
					entityTypes: updatedPlan.entityTypes,
					generated: updatedPlan.generated,
					historyEntry: updatedPlan.historyEntry,
				});
			},
			onCampaignReload: () => dispatch(requestCampaignsReloadAction()),
			onClearPrompt: () => setUserInstructions(""),
			onRefreshEntities: () => dispatch(refreshEntitiesAction()),
			onCloseAuxiliaryDialogs: () => {
				setIsContextModalOpen(false);
				setIsImagePromptPickerOpen(false);
			},
			onCloseAssistantDialogs: () => {
				setIsOpen(false);
				setIsContextModalOpen(false);
				setIsImagePromptPickerOpen(false);
			},
		});
	};

	const generate = async (
		type: string | null = null,
		targetSceneId: string | number | null = null,
		{
			forceParseAIResponse = null,
			imageTarget = null,
			imagePromptBasePromptOverride = undefined,
			userInstructionsOverride = null,
		}: GenerateOptions = {},
	): Promise<void> => {
		const { requestType, shouldParseResponse, payload } =
			buildAiGenerationRequest({
				type,
				isBestiary,
				isEncounter,
				isCampaign,
				forceParseAIResponse,
				parseAIResponse,
				selectedModel,
				userInstructions,
				userInstructionsOverride,
				initialRoute,
				targetSceneId,
				imageTarget,
				attachedImages,
				attachedFiles,
				imagePromptBasePromptOverride,
				generateCharacters,
				generateNpcs,
				generateLocations,
				generateEncounters,
				generateCustomMonsters,
				useContext,
				contextConfig,
				currentLanguage,
			});
		cancelGenerateRequest();
		const controller = new AbortController();
		const requestId = (nextGenerationRequestIdRef.current += 1);
		activeGenerateControllerRef.current = controller;
		setCanCancelGenerate(true);
		dispatchGenerationLifecycle({ type: "start-generation", requestId });
		setError("");

		try {
			await executeAiGeneration({
				payload,
				signal: controller.signal,
				generateAi: api.generateAi,
				onSucceeded: (data) => {
					handleGeneratedAiData({
						data,
						requestType,
						shouldParseResponse,
					});
					dispatchGenerationLifecycle({ type: "succeed", requestId });
				},
				onCancelled: () => {
					dispatchGenerationLifecycle({ type: "cancel", requestId });
				},
				onFailedHistoryEntry: upsertResponseHistoryEntry,
				onApiKeyMissing: () => {
					dispatchGenerationLifecycle({ type: "fail", requestId });
				setIsApiKeyMissing(true);
				setError("");
				},
				onFailed: (failure) => {
					dispatchGenerationLifecycle({ type: "fail", requestId });
					setError(
						failure.message || lang.t("Failed to connect to AI."),
					);
					dispatch(
						alert({
							title: lang.t("AI error"),
							message: formatAiGenerationFailureAlert(
								failure,
								lang.t("Status"),
							),
						}),
					);
				},
			});
		} finally {
			if (activeGenerateControllerRef.current === controller) {
				activeGenerateControllerRef.current = null;
				setCanCancelGenerate(false);
			}
		}
	};

	const retryResponseHistoryEntry = async (
		entry: AiHistoryEntry,
	): Promise<void> => {
		const plan = buildRetryPlan(entry, {
			isLoading: loading,
			isBestiary,
			historyCampaign: aiHistoryCampaign,
		});
		if (!plan) return;

		cancelGenerateRequest();
		const controller = new AbortController();
		const requestId = (nextGenerationRequestIdRef.current += 1);
		activeGenerateControllerRef.current = controller;
		setCanCancelGenerate(true);
		dispatchGenerationLifecycle({ type: "start-retry", requestId });
		setError("");

		try {
			await executeAiHistoryRetry({
				plan,
				signal: controller.signal,
				deleteAiResponse: api.deleteAiResponse,
				generateAi: api.generateAi,
				onFailedEntryDeleted: (responses) => {
					setResponseHistory(responses);
					refreshResponseHistoryStats();
					if (selectedResponseId === entry.id) {
						closeGeneratedPrompt();
					}
				},
				onSucceeded: (data) => {
					handleGeneratedAiData({
						data,
						requestType: plan.requestType,
						shouldParseResponse: plan.shouldParseResponse,
						clearPromptOnApplied: false,
					});
					dispatchGenerationLifecycle({ type: "succeed", requestId });
				},
				onCancelled: () => {
					dispatchGenerationLifecycle({ type: "cancel", requestId });
				},
				onFailed: (error) => {
					const failure = getAiHistoryRetryFailure(error, lang.t("Status"));
					dispatchGenerationLifecycle({ type: "fail", requestId });
					if (failure.historyEntry) {
						upsertResponseHistoryEntry(failure.historyEntry);
					}
					setError(
						failure.message || lang.t("Failed to connect to AI."),
					);
					dispatch(
						alert({
							title: lang.t("AI error"),
							message: failure.alertMessage,
						}),
					);
				},
			});
		} finally {
			if (activeGenerateControllerRef.current === controller) {
				activeGenerateControllerRef.current = null;
				setCanCancelGenerate(false);
			}
		}
	};

	const routePresentation = {
		isBestiary,
		isCampaign,
		isEncounter,
		parseAiResponse: parseAIResponse,
	};
	const assistantTitle = getAiAssistantTitle(routePresentation, translate);
	const promptPlaceholder = getAiAssistantPromptPlaceholder(
		routePresentation,
		translate,
	);
	const tokenEstimate = useMemo(() => {
		return buildAiTokenEstimate({
			activeCampaignBasePrompt,
			attachedFiles,
			attachedImages,
			campaignContext: optional(campaignContext),
			characterContext,
			charactersList,
			contextConfig,
			currentLanguage,
			generateCharacters,
			generateCustomMonsters,
			generateEncounters,
			generateLocations,
			generateNpcs,
			globalAiBasePrompt,
			isBestiary,
			isCampaign,
			isEncounter,
			locationContext,
			locationsList,
			npcContext,
			npcsList,
			parseAIResponse,
			selectedModel,
			sessionData,
			sessionName,
			useContext,
			userInstructions,
			getCharacterKey: getCharacterContextKey,
			getLocationKey: getLocationContextKey,
		});
	}, [
		activeCampaignBasePrompt,
		attachedFiles,
		attachedImages,
		campaignContext,
		characterContext,
		charactersList,
		contextConfig,
		currentLanguage,
		generateCharacters,
		generateCustomMonsters,
		generateEncounters,
		generateLocations,
		generateNpcs,
		globalAiBasePrompt,
		isBestiary,
		isCampaign,
		isEncounter,
		locationContext,
		locationsList,
		npcContext,
		npcsList,
		parseAIResponse,
		selectedModel,
		sessionData,
		sessionName,
		useContext,
		userInstructions,
	]);
	const formattedTokenEstimate = new Intl.NumberFormat(
		currentLanguage || "en",
	).format(tokenEstimate.total);
	const formattedTextTokenEstimate = new Intl.NumberFormat(
		currentLanguage || "en",
	).format(tokenEstimate.textTokens);
	const formattedImageTokenEstimate = new Intl.NumberFormat(
		currentLanguage || "en",
	).format(tokenEstimate.imageTokens);
	const formattedFileTokenEstimate = new Intl.NumberFormat(
		currentLanguage || "en",
	).format(tokenEstimate.fileTokens || 0);

	const imagePromptController = useAiImagePromptController({
		state: imagePromptState,
		activeBasePrompt: activeImagePromptBasePrompt,
		currentLanguage,
		isBestiary,
		isCampaign,
		sessionData,
		sessionName,
		sessionFileName: optional(initialRoute.session),
		npcs: npcsList,
		locations: locationsList,
		sessions: imagePromptSessions,
		customMonsters: imagePromptCustomMonsters,
		prepareData: prepareImagePromptData,
		generate,
		setError,
		translate,
		getCharacterDisplayName,
		getLocationDisplayName,
		getSceneTitle: getSceneImagePromptTitle,
		onRegisterAction: onRegisterImagePromptAction,
	});

	useEffect(() => {
		return () => {
			cancelGenerateRequest();
		};
	}, []);

	const imagePromptModal = (
		<AiImagePromptPickerModal
			attachedFiles={attachedFiles}
			attachedImages={attachedImages}
			buildCustomMonsterImageTarget={imagePromptController.buildCustomMonsterTarget}
			buildLocationImageTarget={imagePromptController.buildLocationTarget}
			buildNpcImageTarget={imagePromptController.buildNpcTarget}
			buildSceneImageTarget={imagePromptController.buildSceneTarget}
			campaignSlug={assetCampaignSlug}
			customMonstersWithImages={imagePromptController.customMonstersWithImages}
			customMonstersWithoutImages={imagePromptController.customMonstersWithoutImages}
			getCharacterDisplayName={getCharacterDisplayName}
			getImagePromptPreview={getImagePromptPreview}
			getImagePromptTargetTitle={imagePromptController.getTargetTitle}
			getLocationDisplayName={getLocationDisplayName}
			getSceneImagePromptDescription={getSceneImagePromptDescription}
			getSceneImagePromptTitle={getSceneImagePromptTitle}
			imagePromptInstructions={imagePromptInstructions}
			imagePromptLocations={imagePromptController.locations}
			imagePromptNpcs={imagePromptController.npcs}
			imagePromptScenes={imagePromptController.scenes}
			aiModels={aiModels}
			isBestiary={isBestiary}
			isCampaign={isCampaign}
			isDataLoading={isImagePromptDataLoading}
			isOpen={isImagePromptPickerOpen}
			loading={loading}
			onBackToSelection={imagePromptController.onBackToSelection}
			onCancel={imagePromptController.onCancel}
			onContinueWithoutSelection={imagePromptController.onContinueWithoutSelection}
			onGenerate={imagePromptController.onGenerate}
			onInstructionsChange={setImagePromptInstructions}
			onRequestChange={setImagePromptRequest}
			onModelChange={setSelectedModel}
			onSelectTarget={imagePromptController.onSelectTarget}
			isContextMode={isImagePromptContextMode}
			imagePromptRequest={imagePromptRequest}
			selectedModel={selectedModel}
			selectedTarget={selectedImagePromptTarget}
			setAttachedFiles={setAttachedFiles}
			setAttachedImages={setAttachedImages}
		/>
	);

	return (
		<AiAssistantPanelView
			shell={{
				title: assistantTitle,
				isOpen,
				isLoading: loading,
				onOpen: () => setIsOpen(true),
				onClose: () => {
					if (!loading) setIsOpen(false);
				},
				imagePromptModal,
				notification,
				onCloseNotification: () => setNotification(null),
			}}
			toolbar={{
				aiModels,
				generateCharacters,
				generateCustomMonsters,
				generateEncounters,
				generateLocations,
				generateNpcs,
				isBestiary,
				isCampaign,
				isCustomMonsterGenerationVisible,
				isEncounter,
				isResponseParsingLocked,
				loading,
				onCreateCustomCreature: () =>
					generate("custom-monster", null, { forceParseAIResponse: true }),
				onOpenContext: () => setIsContextModalOpen(true),
				onOpenImagePrompt: imagePromptController.onOpen,
				parseAIResponse,
				selectedModel,
				setGenerateCharacters,
				setGenerateCustomMonsters,
				setGenerateEncounters,
				setGenerateLocations,
				setGenerateNpcs,
				setParseAIResponse,
				setSelectedModel,
				setUseContext,
				useContext,
			}}
			apiKey={
				isApiKeyMissing
					? {
							apiKeyInput,
							isSavingApiKey,
							loading,
							onApiKeyChange: setApiKeyInput,
							onSave: handleSaveApiKey,
						}
					: null
			}
			contextModal={{
				characterContext,
				characterContextItems,
				charactersList,
				contextConfig,
				expandedSessions,
				getCharacterContextKey,
				getCharacterDisplayName,
				getLocationContextKey,
				getLocationDisplayName,
				isOpen: isContextModalOpen,
				locationContext,
				locationContextItems,
				locationsList,
				npcContext,
				npcContextItems,
				npcsList,
				onCancel: () => setIsContextModalOpen(false),
				setAllCampaignContextItems,
				setContextConfig,
				sessionsList,
				toggleSessionDetails,
				updateCampaignContextListIncluded,
				updateCampaignContextListItem,
				updateContextConfig,
			}}
			historyDialog={{
				ResponseModal: AiResponseModal,
					generatedPrompt: optional(generatedPrompt),
				generatedPromptRef,
				isGeneratedPromptCopied,
				isRestoringResponse,
				markdownComponents: markdownMentionComponents,
					onRestore: async (entry, mode, options) => {
					if (!entry) return;
					await restoreAiHistoryEntry(entry, mode, {
						resourceIds: options?.resourceIds,
					});
				},
				onCancel: closeGeneratedPrompt,
				onCopy: copyGeneratedPrompt,
					onSaveDraftChanges: async (entry, resources) =>
					entry ? await saveDraftHistoryEntryChanges(entry, resources) : null,
				selectedResponseDetails,
				selectedResponseDiffResources,
				selectedResponseEntry,
				selectedResponseHasChanges,
				getDiffResourceState,
				getHistoryChangeSummary,
			}}
			promptComposer={{
				attachedFiles,
				attachedImages,
				campaignSlug: assetCampaignSlug,
				canCancel: canCancelGenerate,
				formattedFileTokenEstimate,
				formattedImageTokenEstimate,
				formattedTextTokenEstimate,
				formattedTokenEstimate,
				isLoading: loading,
				onCancel: cancelGenerateRequest,
				onGenerate: () => generate(),
				onInstructionsChange: setUserInstructions,
				placeholder: promptPlaceholder,
				setAttachedFiles,
				setAttachedImages,
				tokenEstimate,
				userInstructions,
			}}
			error={error}
			history={{
				entries: visibleResponseHistory,
				currentLanguage,
				storageSizeLabel: formatBytes(responseHistorySizeBytes),
				onClear: clearResponseHistory,
				onDelete: deleteResponseHistoryEntry,
				onRetry: retryResponseHistoryEntry,
				onSelect: showGeneratedPrompt,
				canRetry: canRetryHistoryEntry,
				formatResponseDate,
				getTitle: getHistoryTitle,
				getSummary: getHistoryChangeSummary,
				getStateLabel: getAiResponseStateLabel,
			}}
		/>
	);
}
