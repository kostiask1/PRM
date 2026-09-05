import {
	Children,
	cloneElement,
	createElement,
	isValidElement,
	useEffect,
	type ReactNode,
} from "react";
import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import { campaignApi } from "../../../entities/campaign/index.js";
import { sessionApi } from "../../../entities/session/index.js";
import { bestiaryApi } from "../../../entities/bestiary/index.js";
import {
	aiApi,
	createAiHistoryWorkflow,
	hasHistoryChanges,
	isFailedHistoryEntry,
	useAiImagePromptData,
	type AiHistoryEntry,
	type AiHistoryResource,
	type AiContextSession,
} from "../../../features/ai/index.js";
import type {
	AiResponseModalComponent,
} from "../../../features/ai/ui/index.js";
const api = { ...campaignApi, ...sessionApi, ...bestiaryApi, ...aiApi };
import AiImagePromptPickerModal from "./AiImagePromptPickerModal.tsx";
import AiAssistantPanelView from "./AiAssistantPanelView.tsx";
import { createAiAssistantPresentation } from "../model/assistantPresentation.ts";
import {
	getAiAssistantPromptPlaceholder,
	getAiAssistantTitle,
} from "../model/assistantContext.ts";
import { useAiAssistantContextController } from "../model/useAiAssistantContextController.ts";
import { useAiAssistantHistoryController } from "../model/useAiAssistantHistoryController.ts";
import { useAiImagePromptController } from "../model/useAiImagePromptController.ts";
import { useAiImagePromptState } from "../model/useAiImagePromptState.ts";
import { useAiAssistantModelAccess } from "../model/useAiAssistantModelAccess.ts";
import { useAiAssistantGeneratedResult } from "../model/useAiAssistantGeneratedResult.ts";
import { useAiAssistantGeneration } from "../model/useAiAssistantGeneration.ts";
import { useAiAssistantControls } from "../model/useAiAssistantControls.ts";
import { useAiAssistantRouteState } from "../model/useAiAssistantRouteState.ts";
import { useAiAssistantTokenEstimate } from "../model/useAiAssistantTokenEstimate.ts";
import { useAiAssistantUpdatedData } from "../model/useAiAssistantUpdatedData.ts";
import { lang } from "../../../shared/lib/index.js";
import { renderMentionText } from "../../../features/entity-link/index.js";
import { formatBytes } from "../../../shared/lib/index.js";
import {
	getHistoryChangeSummary as getAiHistoryChangeSummary,
	getLocalizedDiffResourceState,
} from "../../../features/ai/index.js";
import "../../../assets/components/AiAssistantPanel.css";
import { useAiAssistantRuntime } from "./AiAssistantRuntime.tsx";

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

const optional = <T,>(value: T | null | undefined): T | undefined =>
	value ?? undefined;

export interface AiAssistantPanelProps {
	ResponseModal: AiResponseModalComponent;
	isBestiary?: boolean;
	onRegisterImagePromptAction?: (
		handler: ((monster: BestiaryMonster) => void) | null,
	) => void;
}

export default function AiAssistantPanel({
	ResponseModal,
	isBestiary = false,
	onRegisterImagePromptAction,
}: AiAssistantPanelProps) {
	const {
		activeCampaign,
		activeEncounter,
		activeSession,
		campaignAiBasePrompts,
		campaignImagePromptBasePrompts,
		currentLanguage,
		globalAiBasePrompt,
		imagePromptBasePrompt,
		navigation,
		publishSyncEvent,
		refreshEntities,
		requestCampaignReload,
		requestConfirmation,
		setActiveCampaign,
		setActiveEncounter,
		setActiveSession,
		showMessage,
	} = useAiAssistantRuntime();
	const routeState = useAiAssistantRouteState({
		campaignAiBasePrompts,
		campaignImagePromptBasePrompts,
		imagePromptBasePrompt,
		isBestiary,
		navigation,
	});
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

	const {
		attachedFiles,
		attachedImages,
		error,
		editEncounterCreatures,
		generateCharacters,
		generateCustomMonsters,
		generateEncounters,
		generateLocations,
		generateNpcs,
		isContextModalOpen,
		isOpen,
		notification,
		parseAIResponse,
		setAttachedFiles,
		setAttachedImages,
		setError,
		setEditEncounterCreatures,
		setGenerateCharacters,
		setGenerateCustomMonsters,
		setGenerateEncounters,
		setGenerateLocations,
		setGenerateNpcs,
		setIsContextModalOpen,
		setIsOpen,
		setNotification,
		setParseAIResponse,
		setUseContext,
		setUserInstructions,
		useContext,
		userInstructions,
	} = useAiAssistantControls({
		generateEncountersByDefault,
		isEncounter,
	});
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
	const {
		aiModels,
		apiKeyInput,
		isApiKeyMissing,
		isSavingApiKey,
		saveApiKey: handleSaveApiKey,
		selectedModel,
		setApiKeyInput,
		setIsApiKeyMissing,
		setSelectedModel,
	} = useAiAssistantModelAccess({
		isImagePromptPickerOpen,
		isOpen,
		onError: setError,
		onNotification: setNotification,
	});

	const { applyUpdatedAiData } = useAiAssistantUpdatedData({
		activeCampaign,
		campaignSlug: initialRoute.campaign,
		encounterId: initialRoute.encounter,
		fallbackSessionFileName: optional(initialRoute.session),
		isBestiary,
		isCampaign,
		isEncounter,
		publishSyncEvent,
		refreshEntities,
		requestCampaignReload,
		setActiveCampaign,
		setActiveEncounter,
		setActiveSession,
		sessionFileName: initialRoute.session,
	});

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
		confirm: async (copy) => Boolean(await requestConfirmation(copy)),
		alert: showMessage,
		applyUpdatedData: applyUpdatedAiData,
		requestReload: (entityTypes) => {
			requestCampaignReload();
			if (entityTypes.length > 0) refreshEntities();
		},
		notify: setNotification,
		labels: historyLabels,
	});

	const { handleGeneratedAiData } = useAiAssistantGeneratedResult({
		applyUpdatedData: applyUpdatedAiData,
		isBestiary,
		isCampaign,
		isEncounter,
		onClearPrompt: () => setUserInstructions(""),
		onCloseAssistantDialogs: () => {
			setIsOpen(false);
			setIsContextModalOpen(false);
			setIsImagePromptPickerOpen(false);
		},
		onCloseAuxiliaryDialogs: () => {
			setIsContextModalOpen(false);
			setIsImagePromptPickerOpen(false);
		},
		onNotification: setNotification,
		onRequestCampaignReload: requestCampaignReload,
		onRefreshEntities: refreshEntities,
		showGeneratedPrompt,
		upsertResponseHistoryEntry,
	});

	const {
		canCancelGenerate,
		cancelGenerateRequest,
		generate,
		isGenerationPending,
		retryResponseHistoryEntry,
	} = useAiAssistantGeneration({
		attachedFiles,
		attachedImages,
		buildRetryPlan,
		contextConfig,
		currentLanguage,
		deleteAiResponse: api.deleteAiResponse,
		generateAi: api.generateAi,
		generateCharacters,
		editEncounterCreatures,
		generateCustomMonsters,
		generateEncounters,
		generateLocations,
		generateNpcs,
		handleGeneratedAiData,
		historyCampaign: aiHistoryCampaign,
		initialRoute,
		isBestiary,
		isCampaign,
		isContextLoading,
		isEncounter,
		onApiKeyMissing: () => setIsApiKeyMissing(true),
		onError: setError,
		parseAIResponse,
		refreshResponseHistoryStats,
		selectedResponseId,
		selectedModel,
		setResponseHistory,
		showMessage,
		closeGeneratedPrompt,
		upsertResponseHistoryEntry,
		useContext,
		userInstructions,
	});
	const loading = isContextLoading || isGenerationPending;

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
	const {
		formattedFileTokenEstimate,
		formattedImageTokenEstimate,
		formattedTextTokenEstimate,
		formattedTokenEstimate,
		tokenEstimate,
	} = useAiAssistantTokenEstimate({
		activeCampaignBasePrompt,
		attachedFiles,
		attachedImages,
		campaignContext: optional(campaignContext),
		characterContext,
		charactersList,
		contextConfig,
		currentLanguage,
		editEncounterCreatures,
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
				editEncounterCreatures,
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
				setEditEncounterCreatures,
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
				ResponseModal,
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
