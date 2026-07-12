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
} from "react";
import { campaignApi } from "../../entities/campaign/index.js";
import { sessionApi } from "../../entities/session/index.js";
import { bestiaryApi } from "../../entities/bestiary/index.js";
import {
	aiApi,
	aiGenerationLifecycleReducer,
	buildAiTokenEstimate,
	buildAiGenerationRequest,
	buildAiHistoryRestorePlan,
	buildCustomMonsterImageTarget as buildCustomMonsterImageTargetModel,
	buildLocationImageTarget as buildLocationImageTargetModel,
	buildNpcImageTarget as buildNpcImageTargetModel,
	buildSceneImageTarget as buildSceneImageTargetModel,
	createAiHistoryWorkflow,
	getGeneratedEntityTypes,
	getAiHistoryCampaign,
	getContextListConfig,
	hasGeneratedCampaignChanges,
	hasHistoryChanges,
	initialAiGenerationLifecycle,
	isAiGenerationPending,
	upsertAiHistoryEntry,
	useAiHistoryCommands,
	isFailedHistoryEntry,
	setAllContextListItems,
	updateContextConfigValue,
	updateContextListIncluded,
	updateContextListItem,
	useAiContextData,
	useAiImagePromptData,
} from "../../features/ai/index.js";
import {
	AiApiKeyPanel,
	AiAssistantShell,
	AiAssistantToolbar,
	AiContextSettingsModal,
	AiHistoryResponseDialog,
	AiPromptComposer,
	AiResponseHistory,
} from "../../features/ai/ui/index.js";

const api = { ...campaignApi, ...sessionApi, ...bestiaryApi, ...aiApi };
import AiImagePromptPickerModal from "./AiImagePromptPickerModal.jsx";
import {
	alert,
	confirm,
	dataSyncReceivedAction,
	refreshEntitiesAction,
	requestCampaignsReloadAction,
	setActiveCampaignAction,
	setActiveEncounterAction,
	setActiveSessionAction,
} from "../../actions/app.js";
import { useAppDispatch, useAppSelector } from "../../store/appStore.js";
import { lang } from "../../services/localization.js";
import { renderMentionText } from "../../renderers/contentRenderer.jsx";
import { formatBytes } from "../../utils/formatBytes.js";
import { buildDiffResources } from "../../utils/aiDiff.js";
import {
	getFirstChangedMonsterName,
	getHistoryChangeSummary as getAiHistoryChangeSummary,
	getLocalizedDiffResourceState,
	isAiResponseVisibleForRoute,
} from "../../utils/aiResponseHelpers.js";
import "../../assets/components/AiAssistantPanel.css";

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

function translate(...args) {
	return lang.t(...args);
}

function renderMentionChildren(children) {
	return Children.map(children, (child) => {
		if (typeof child === "string") {
			return renderMentionText(child);
		}
		if (isValidElement(child) && child.props?.children) {
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
		({ children, ...tagProps }) =>
			createElement(tag, tagProps, renderMentionChildren(children)),
	]),
);

function getResponsePreview(text) {
	const plainText = [
		"#",
		"*",
		"_",
		"`",
		">",
		"|",
		"~",
		"[",
		"]",
		"(",
		")",
	].reduce((value, marker) => value.split(marker).join(""), String(text || ""));

	return plainText.replace(/\s+/g, " ").trim();
}

function formatResponseDate(date, language) {
	const parsed = new Date(date);
	if (Number.isNaN(parsed.getTime())) return "";
	return parsed.toLocaleString(language);
}

function findJsonObjectEnd(text, startIndex) {
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let index = startIndex; index < text.length; index += 1) {
		const character = text[index];
		if (escaped) {
			escaped = false;
			continue;
		}
		if (character === "\\") {
			escaped = inString;
			continue;
		}
		if (character === '"') {
			inString = !inString;
			continue;
		}
		if (inString) continue;
		if (character === "{") {
			depth += 1;
		} else if (character === "}") {
			depth -= 1;
			if (depth === 0) return index + 1;
		}
	}
	return -1;
}

function stripGeneratedMonsterEditPrompt(text) {
	const source = String(text || "").trim();
	if (!source) return "";

	const createPrefixes = [
		lang.t(
			"Create a new custom creature based on the selected creature. Do not change the selected creature.",
		),
		"Create a new custom creature based on the selected creature. Do not change the selected creature.",
	].filter(Boolean);
	for (const prefix of createPrefixes) {
		if (source.startsWith(prefix)) {
			return source.slice(prefix.length).trim();
		}
	}

	const creatureLabels = [
		`${lang.t("Current encounter creature")}:`,
		"Current encounter creature:",
	];
	const labelIndex = creatureLabels.reduce((foundIndex, label) => {
		if (foundIndex !== -1) return foundIndex;
		return source.indexOf(label);
	}, -1);
	if (labelIndex === -1) return source;

	const objectStart = source.indexOf("{", labelIndex);
	if (objectStart === -1) return source;
	const objectEnd = findJsonObjectEnd(source, objectStart);
	if (objectEnd === -1) return source;
	return source.slice(objectEnd).trim();
}

function getHistoryRequestText(entry) {
	const explicitHistoryText = String(
		entry?.retryPayload?.historyUserInstructions || "",
	).trim();
	if (explicitHistoryText) return explicitHistoryText;
	return stripGeneratedMonsterEditPrompt(
		entry?.request?.userInstructions || entry?.userInstructions || "",
	);
}

const { buildRetryPayloadFromHistoryEntry, canRetryHistoryEntry } =
	createAiHistoryWorkflow(getHistoryRequestText);

function getHistoryModeName(mode) {
	const labels = {
		image: "Image prompt",
		encounter: "AI Encounter Assistant",
		session: "AI Session Assistant",
		campaign: "AI Story Assistant",
	};
	return lang.t(labels[mode] || mode || "AI response");
}

function getOnOffLabel(value) {
	return value ? lang.t("On") : lang.t("Off");
}

function getLocationContextKey(location) {
	return String(location?.slug || location?.id || location?.name || "").trim();
}

function getLocationDisplayName(location) {
	return String(location?.name || location?.title || lang.t("Untitled")).trim();
}

function getCharacterDisplayName(character) {
	const firstName = String(
		character?.firstName || character?.first_name || "",
	).trim();
	const lastName = String(
		character?.lastName || character?.last_name || "",
	).trim();
	const fullName = `${firstName} ${lastName}`.trim();
	return String(
		fullName || character?.name || character?.title || lang.t("Untitled"),
	).trim();
}

function getCharacterContextKey(character) {
	return String(
		character?.slug ||
			character?.id ||
			getCharacterDisplayName(character) ||
			"",
	).trim();
}

function getSceneImagePromptTitle(scene, index) {
	const summary = String(scene?.texts?.summary || scene?.summary || "").trim();
	return summary || lang.t("Scene {number}", { number: index + 1 });
}

function getSceneImagePromptDescription(scene) {
	const texts = scene?.texts || {};
	return [texts.summary, texts.goal, texts.stakes, texts.location]
		.filter(Boolean)
		.join(" ");
}

function getImagePromptPreview(text) {
	const value = String(text || "")
		.replace(/\s+/g, " ")
		.trim();
	return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

function getHistoryOptionsSummary(entry) {
	const options = entry?.request?.options;
	if (!options || typeof options !== "object" || !options.mode) {
		return entry?.request?.optionsSummary || "";
	}

	return [
		`${lang.t("Mode")}: ${getHistoryModeName(options.mode)}`,
		`${lang.t("Response parsing")}: ${getOnOffLabel(options.responseParsing)}`,
		options.responseParsing
			? `${lang.t("Create characters")}: ${getOnOffLabel(options.characterGeneration)}`
			: null,
		options.responseParsing
			? `${lang.t("Create NPCs")}: ${getOnOffLabel(options.npcGeneration)}`
			: null,
		options.responseParsing
			? `${lang.t("Create locations/factions")}: ${getOnOffLabel(options.locationGeneration)}`
			: null,
		options.responseParsing
			? `${lang.t("Encounter generation")}: ${getOnOffLabel(options.encounterGeneration)}`
			: null,
		options.responseParsing
			? `${lang.t("Custom monster generation")}: ${getOnOffLabel(options.customMonsterGeneration)}`
			: null,
		`${lang.t("Context")}: ${getOnOffLabel(options.contextEnabled)}`,
	]
		.filter(Boolean)
		.join("; ");
}

function getHistoryContextSummary(entry) {
	const context = entry?.request?.context;
	if (!context || typeof context !== "object") {
		return entry?.request?.contextSummary || "";
	}
	if (!context.enabled) {
		return `${lang.t("Context")}: ${lang.t("Off")}`;
	}

	const parts = [];
	if (context.campaignNotes)
		parts.push(`${lang.t("Notes")}: ${context.campaignNotes}`);
	if (context.campaignCharacters)
		parts.push(`${lang.t("Characters")}: ${context.campaignCharacters}`);
	if (context.campaignNpcs)
		parts.push(`${lang.t("NPCs")}: ${context.campaignNpcs}`);
	if (context.campaignLocations)
		parts.push(`${lang.t("Locations/Factions")}: ${context.campaignLocations}`);
	if (context.sessions)
		parts.push(`${lang.t("Sessions")}: ${context.sessions}`);
	if (context.scenes) parts.push(`${lang.t("Scenes")}: ${context.scenes}`);
	return `${lang.t("Context")}: ${parts.length ? parts.join(", ") : lang.t("Empty")}`;
}

function getHistoryDetailRows(entry, language) {
	const rows = [];
	const requestText = getHistoryRequestText(entry);
	const optionsSummary = getHistoryOptionsSummary(entry);
	const contextSummary = getHistoryContextSummary(entry);
	const createdAt = formatResponseDate(entry?.createdAt, language);

	if (requestText) rows.push({ label: lang.t("Request"), value: requestText });
	if (optionsSummary)
		rows.push({ label: lang.t("Settings"), value: optionsSummary });
	if (contextSummary)
		rows.push({ label: lang.t("Context"), value: contextSummary });
	if (createdAt) rows.push({ label: lang.t("Sent"), value: createdAt });

	return rows;
}

function getHistoryTitle(entry) {
	const requestText = getHistoryRequestText(entry);
	if (requestText) return requestText;
	if (isFailedHistoryEntry(entry)) return lang.t("Failed AI request");
	if (hasHistoryChanges(entry)) return lang.t("AI changes");
	return getResponsePreview(entry?.text) || lang.t("AI response");
}

function getHistoryChangeSummary(entry) {
	return getAiHistoryChangeSummary(entry, translate);
}

function getAiResponseStateLabel(entry) {
	if (isFailedHistoryEntry(entry)) return lang.t("Failed");
	if (entry?.applyState === "draft") return lang.t("Draft");
	if (entry?.applyState === "applied") return lang.t("Applied");
	if (entry?.applyState === "undone") return lang.t("Undone");
	return "";
}

function getDiffResourceState(resource) {
	return getLocalizedDiffResourceState(resource, translate);
}

export default function AiAssistantPanel({
	isBestiary = false,
	onRegisterImagePromptAction,
}) {
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
	const initialRoute = useMemo(
		() => ({
			campaign: isBestiary ? "bestiary" : navigation.activeCampaignSlug,
			session: navigation.activeSessionFileName,
			encounter: navigation.activeEncounterId,
		}),
		[
			isBestiary,
			navigation.activeCampaignSlug,
			navigation.activeEncounterId,
			navigation.activeSessionFileName,
		],
	);
	const activeImagePromptBasePrompt =
		campaignImagePromptBasePrompts[initialRoute.campaign] ||
		imagePromptBasePrompt;
	const activeCampaignBasePrompt =
		campaignAiBasePrompts[initialRoute.campaign] || "";
	const isCampaign = !initialRoute.session && !isBestiary;
	const isEncounter = !!initialRoute.encounter;
	const aiHistoryCampaign = isBestiary ? "bestiary" : initialRoute.campaign;

	const [isOpen, setIsOpen] = useState(false);
	const [isContextModalOpen, setIsContextModalOpen] = useState(false);
	const [isContextLoading, setIsContextLoading] = useState(false);
	const [generationLifecycle, dispatchGenerationLifecycle] = useReducer(
		aiGenerationLifecycleReducer,
		initialAiGenerationLifecycle,
	);
	const loading =
		isContextLoading || isAiGenerationPending(generationLifecycle);
	const [useContext, setUseContext] = useState(true);
	const [error, setError] = useState("");
	const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
	const [apiKeyInput, setApiKeyInput] = useState("");
	const [isSavingApiKey, setIsSavingApiKey] = useState(false);
	const [userInstructions, setUserInstructions] = useState("");
	const [notification, setNotification] = useState(null);
	const [isImagePromptPickerOpen, setIsImagePromptPickerOpen] = useState(false);
	const [selectedImagePromptTarget, setSelectedImagePromptTarget] =
		useState(null);
	const [attachedImages, setAttachedImages] = useState([]);
	const [attachedFiles, setAttachedFiles] = useState([]);
	const [imagePromptInstructions, setImagePromptInstructions] = useState("");
	const [imagePromptRequest, setImagePromptRequest] = useState("");
	const [isImagePromptContextMode, setIsImagePromptContextMode] =
		useState(false);
	const [parseAIResponse, setParseAIResponse] = useState(isEncounter);
	const [generateCharacters, setGenerateCharacters] = useState(false);
	const [generateNpcs, setGenerateNpcs] = useState(true);
	const [generateLocations, setGenerateLocations] = useState(true);
	const [generateEncounters, setGenerateEncounters] = useState(
		!isCampaign && !isBestiary,
	);
	const [generateCustomMonsters, setGenerateCustomMonsters] = useState(false);
	const [aiModels, setAiModels] = useState([]);
	const [selectedModel, setSelectedModel] = useState("");
	const [expandedSessions, setExpandedSessions] = useState({});
	const {
		charactersList,
		contextConfig,
		ensureCampaignEntities,
		ensureSessions,
		locationsList,
		npcsList,
		sessionsList,
		setContextConfig,
	} = useAiContextData({
		campaignSlug: initialRoute.campaign,
		sessionSlug: initialRoute.session,
		isBestiary,
		isPanelOpen: isOpen,
		isContextModalOpen,
		isImagePromptPickerOpen,
		useContext,
		listSessions: api.listSessions,
		getEntities: api.getEntities,
		getSession: api.getSession,
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
		getSession: api.getSession,
		getCustomBestiaryData: api.getCustomBestiaryData,
	});
	const [generatedPrompt, setGeneratedPrompt] = useState(null);
	const [selectedResponseId, setSelectedResponseId] = useState(null);
	const [selectedResponseEntry, setSelectedResponseEntry] = useState(null);
	const [responseHistory, setResponseHistory] = useState([]);
	const [responseHistorySizeBytes, setResponseHistorySizeBytes] = useState(0);
	const activeGenerateControllerRef = useRef(null);
	const nextGenerationRequestIdRef = useRef(0);
	const generatedPromptRef = useRef(null);
	const [canCancelGenerate, setCanCancelGenerate] = useState(false);
	const [isGeneratedPromptCopied, setIsGeneratedPromptCopied] = useState(false);
	const sessionName = isCampaign
		? activeCampaign?.name || ""
		: activeSession?.name || "";
	const campaignContext = useMemo(
		() =>
			!isBestiary
				? {
						description: activeCampaign?.description || "",
						notes: activeCampaign?.notes || [],
					}
				: null,
		[activeCampaign?.description, activeCampaign?.notes, isBestiary],
	);
	const sessionData = useMemo(() => {
		if (isBestiary) return {};
		if (isEncounter) return activeEncounter || {};
		if (isCampaign) {
			return {
				...(activeCampaign || {}),
				characters: charactersList,
				npcs: npcsList,
				locations: locationsList,
			};
		}
		return activeSession?.data || {};
	}, [
		activeCampaign,
		activeEncounter,
		activeSession?.data,
		charactersList,
		isBestiary,
		isCampaign,
		isEncounter,
		locationsList,
		npcsList,
	]);

	const cancelGenerateRequest = () => {
		activeGenerateControllerRef.current?.abort();
		activeGenerateControllerRef.current = null;
		setCanCancelGenerate(false);
	};

	const refreshResponseHistoryStats = useCallback(async () => {
		if (!aiHistoryCampaign) return;
		try {
			const stats = await api.getAiResponsesStats(aiHistoryCampaign);
			setResponseHistorySizeBytes(Number(stats?.bytes) || 0);
		} catch (err) {
			console.error("Failed to load AI response history stats", err);
			setResponseHistorySizeBytes(0);
		}
	}, [aiHistoryCampaign]);

	const showGeneratedPrompt = (response) => {
		const entry =
			response && typeof response === "object"
				? response
				: { id: null, text: response };
		setGeneratedPrompt(entry.text);
		setSelectedResponseId(entry.id || null);
		setSelectedResponseEntry(entry);
		setIsGeneratedPromptCopied(false);
	};

	const closeGeneratedPrompt = () => {
		setGeneratedPrompt(null);
		setSelectedResponseId(null);
		setSelectedResponseEntry(null);
		setIsGeneratedPromptCopied(false);
	};

	const copyGeneratedPrompt = async () => {
		if (!generatedPromptRef.current || !generatedPrompt) return;

		try {
			const html = generatedPromptRef.current.innerHTML;
			const data = [
				new ClipboardItem({
					"text/html": new Blob([html], { type: "text/html" }),
					"text/plain": new Blob([generatedPrompt], { type: "text/plain" }),
				}),
			];

			await navigator.clipboard.write(data);
			setIsGeneratedPromptCopied(true);
			setTimeout(() => setIsGeneratedPromptCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy formatted text:", err);
			await navigator.clipboard.writeText(generatedPrompt);
			setIsGeneratedPromptCopied(true);
			setTimeout(() => setIsGeneratedPromptCopied(false), 2000);
		}
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

	useEffect(() => {
		if (!isOpen || !aiHistoryCampaign) return;
		Promise.all([
			api.listAiResponses(aiHistoryCampaign),
			api.getAiResponsesStats(aiHistoryCampaign).catch((err) => {
				console.error("Failed to load AI response history stats", err);
				return null;
			}),
		])
			.then(([responses, stats]) => {
				setResponseHistory(Array.isArray(responses) ? responses : []);
				setResponseHistorySizeBytes(Number(stats?.bytes) || 0);
			})
			.catch((err) => {
				console.error("Failed to load AI response history", err);
			});
	}, [aiHistoryCampaign, isOpen]);

	const upsertResponseHistoryEntry = (entry) => {
		if (!entry?.id) return;
		setResponseHistory((prev) => upsertAiHistoryEntry(prev, entry));
		refreshResponseHistoryStats();
		if (selectedResponseId === entry.id) {
			setSelectedResponseEntry(entry);
			setGeneratedPrompt(entry.text);
		}
	};

	const getAiResponseHistoryCampaign = (entry) =>
		getAiHistoryCampaign(entry, aiHistoryCampaign);

	const publishAiSyncEvent = useCallback(
		(extra = {}) => {
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
		(updated, options = {}) => {
			if (!updated || typeof updated !== "object") return false;
			const entityTypes = Array.isArray(options.entityTypes)
				? options.entityTypes
				: getGeneratedEntityTypes(options.generated, options.historyEntry);
			const updatedIsSessionLike =
				updated.data && typeof updated.data === "object";

			if (isBestiary) {
				const changedMonsterName = getFirstChangedMonsterName(
					options.historyEntry,
				);
				publishAiSyncEvent({
					resource: "custom-bestiary",
					monsterName:
						changedMonsterName ||
						options.generated?.monsters?.[0]?.name ||
						undefined,
					monsterSource: "CUSTOM",
				});
				dispatch(refreshEntitiesAction());
				return true;
			}

			if (updatedIsSessionLike) {
				dispatch(setActiveSessionAction(updated));
				const updatedEncounter = isEncounter
					? (updated.data.encounters || []).find(
							(encounter) =>
								String(encounter.id) === String(initialRoute.encounter),
						)
					: null;
				if (updatedEncounter) {
					dispatch(setActiveEncounterAction(updatedEncounter));
				}
				dispatch(requestCampaignsReloadAction());
				publishAiSyncEvent({
					sessionFileName:
						updated.fileName || updated.file_name || initialRoute.session,
				});
				if (entityTypes.length > 0) {
					dispatch(refreshEntitiesAction());
				}
				return true;
			}

			if (isCampaign) {
				dispatch(
					setActiveCampaignAction({
						...(activeCampaign || {}),
						...updated,
					}),
				);
				dispatch(requestCampaignsReloadAction());
				publishAiSyncEvent();
				if (entityTypes.length > 0) {
					dispatch(refreshEntitiesAction());
				}
				return true;
			}

			dispatch(requestCampaignsReloadAction());
			publishAiSyncEvent();
			if (entityTypes.length > 0) {
				dispatch(refreshEntitiesAction());
			}
			return false;
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

	const refreshAfterAiHistoryRestore = (result, entry) => {
		const plan = buildAiHistoryRestorePlan({
			result,
			fallbackEntry: entry,
			selectedResponseId,
			currentRoute: initialRoute,
			isBestiary,
			isCampaign,
		});

		if (plan.historyUpdate?.type === "replace") {
			setResponseHistory(plan.historyUpdate.responses);
			refreshResponseHistoryStats();
		} else if (plan.historyUpdate?.type === "upsert") {
			setResponseHistory((current) =>
				upsertAiHistoryEntry(current, plan.historyUpdate.entry),
			);
			refreshResponseHistoryStats();
		}

		if (plan.updateSelection) {
			setSelectedResponseEntry(plan.nextEntry);
			setGeneratedPrompt(plan.nextEntry.text);
		}

		if (plan.applyDirectly) {
			applyUpdatedAiData(plan.updated, {
					entityTypes: plan.entityTypes,
					trackUndo: false,
					historyEntry: plan.nextEntry,
				});
		}

		if (plan.requestReload) {
			dispatch(requestCampaignsReloadAction());
			if (plan.entityTypes.length > 0) {
				dispatch(refreshEntitiesAction());
			}
		}
	};

	const {
		isRestoring: isRestoringResponse,
		deleteEntry: deleteResponseHistoryEntry,
		clearHistory: clearResponseHistory,
		restoreEntry: restoreAiHistoryEntry,
		saveDraft: saveDraftHistoryEntryChanges,
	} = useAiHistoryCommands({
		historyCampaign: aiHistoryCampaign,
		confirmDelete: () =>
			dispatch(
				confirm({
					title: lang.t("Delete response"),
					message: lang.t("Delete this AI response?"),
				}),
			),
		confirmClear: () =>
			dispatch(
				confirm({
					title: lang.t("Clear response history"),
					message: lang.t("Delete all saved AI responses?"),
				}),
			),
		confirmRestore: (_entry, { isUndo, isPartial }) =>
			dispatch(
				confirm({
					title: isUndo
						? isPartial
							? lang.t("Undo selected AI change")
							: lang.t("Undo AI changes")
						: isPartial
							? lang.t("Apply selected AI change")
							: lang.t("Apply AI changes"),
					message: isUndo
						? isPartial
							? lang.t(
									"Undo only this AI change? Newer edits in this resource may be overwritten.",
								)
							: lang.t(
									"Restore data to the state before this AI response? Newer edits in these resources may be overwritten.",
								)
						: isPartial
							? lang.t(
									"Apply only this AI change? Newer edits in this resource may be overwritten.",
								)
							: lang.t(
									"Restore data to the state after this AI response? Newer edits in these resources may be overwritten.",
								),
				}),
			),
		onHistoryReplaced: setResponseHistory,
		onHistoryChanged: refreshResponseHistoryStats,
		onEntryDeleted: (entry) => {
			if (selectedResponseId === entry.id) closeGeneratedPrompt();
		},
		onHistoryCleared: closeGeneratedPrompt,
		onEntryUpserted: upsertResponseHistoryEntry,
		onDraftSaved: (entry) => {
			setSelectedResponseEntry(entry);
			setGeneratedPrompt(entry.text);
		},
		onRestored: (result, entry, { isUndo }) => {
			refreshAfterAiHistoryRestore(result, entry);
			setNotification(
				isUndo
					? lang.t("AI changes undone.")
					: lang.t("AI changes applied successfully!"),
			);
		},
		onError: (command, error) => {
			dispatch(
				alert({
					title:
						command === "delete"
							? lang.t("Delete error")
							: lang.t("AI history error"),
					message: error.message || lang.t("Unknown error"),
				}),
			);
		},
	});

	const handleSaveApiKey = async () => {
		const apiKey = apiKeyInput.trim();
		if (!apiKey) {
			setError(lang.t("Enter Gemini API key."));
			return;
		}

		setIsSavingApiKey(true);
		setError("");
		try {
			await api.saveGeminiApiKey(apiKey);
			let result = null;
			for (let attempt = 0; attempt < 5; attempt++) {
				try {
					result = await api.listAiModels();
					break;
				} catch (err) {
					if (attempt === 4) {
						console.error("Failed to refresh AI models after saving key", err);
						break;
					}
					await new Promise((resolve) => setTimeout(resolve, 500));
				}
			}
			if (result) {
				const models = Array.isArray(result?.models) ? result.models : [];
				setAiModels(models);
				setSelectedModel(result?.defaultModel || models[0]?.name || "");
			}
			setApiKeyInput("");
			setIsApiKeyMissing(false);
			setNotification(lang.t("Gemini API key saved."));
		} catch (err) {
			setError(err.message || lang.t("Failed to save Gemini API key."));
		} finally {
			setIsSavingApiKey(false);
		}
	};

	const toggleSessionDetails = async (sessionSlug) => {
		const isExpanded = !!expandedSessions[sessionSlug];
		if (!isExpanded && !contextConfig.sessions[sessionSlug]?.data) {
			setIsContextLoading(true);
			try {
				const fullData = await api.getSession(
					initialRoute.campaign,
					sessionSlug,
				);
				setContextConfig((prev) => ({
					...prev,
					sessions: {
						...prev.sessions,
						[sessionSlug]: {
							...(prev.sessions[sessionSlug] || {
								included: false,
								notes: true,
								result_text: true,
								scenes: {},
							}),
							data: fullData.data,
						},
					},
				}));
			} catch (err) {
				console.error("Failed to fetch session details", err);
			} finally {
				setIsContextLoading(false);
			}
		}
		setExpandedSessions((prev) => ({ ...prev, [sessionSlug]: !isExpanded }));
	};

	const updateContextConfig = (path, value) => {
		setContextConfig((current) =>
			updateContextConfigValue(current, path, value),
		);
	};

	const updateCampaignContextListIncluded = (contextKey, included) => {
		setContextConfig((current) =>
			updateContextListIncluded(current, contextKey, included),
		);
	};

	const updateCampaignContextListItem = (contextKey, itemKey, value) => {
		setContextConfig((current) =>
			updateContextListItem(current, contextKey, itemKey, value),
		);
	};

	const setAllCampaignContextItems = (contextKey, list, getKey, checked) => {
		setContextConfig((current) =>
			setAllContextListItems(current, contextKey, list, getKey, checked),
		);
	};

	const handleGeneratedAiData = ({
		data,
		requestType,
		shouldParseResponse,
		clearPromptOnApplied = true,
	}) => {
		if (data.prompt) {
			const historyEntry = data.aiResponse || {
				id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
				text: data.prompt,
				createdAt: new Date().toISOString(),
			};
			upsertResponseHistoryEntry(historyEntry);
			showGeneratedPrompt(historyEntry);
			return;
		}

		if (data.draft && data.aiResponse) {
			upsertResponseHistoryEntry(data.aiResponse);
			showGeneratedPrompt(data.aiResponse);
			setNotification(lang.t("AI draft created."));
			if (shouldParseResponse || isEncounter || isBestiary) {
				setIsContextModalOpen(false);
				setIsImagePromptPickerOpen(false);
			}
			return;
		}

		if (!data.updated) return;

		if (data.aiResponse) {
			upsertResponseHistoryEntry(data.aiResponse);
		}
		const updatedIsSessionLike =
			data.updated &&
			typeof data.updated === "object" &&
			data.updated.data &&
			typeof data.updated.data === "object";
		const canApplyDirectly =
			isBestiary ||
			(isCampaign && !updatedIsSessionLike) ||
			(!isCampaign && updatedIsSessionLike);

		const generatedEntityTypes = getGeneratedEntityTypes(
			data.generated,
			data.aiResponse,
		);
		const hasCampaignChanges = hasGeneratedCampaignChanges(
			data.generated,
			data.aiResponse,
		);

		if (canApplyDirectly) {
			applyUpdatedAiData(data.updated, {
				entityTypes: generatedEntityTypes,
				generated: data.generated,
				historyEntry: data.aiResponse,
			});
			if (updatedIsSessionLike && hasCampaignChanges) {
				dispatch(requestCampaignsReloadAction());
			}
		} else {
			dispatch(requestCampaignsReloadAction());
		}

		if (clearPromptOnApplied) {
			setUserInstructions("");
		}
		setNotification(
			requestType === "custom-monster"
				? lang.t("Custom creatures saved.")
				: lang.t("AI changes applied successfully!"),
		);
		if (generatedEntityTypes.length > 0) {
			dispatch(refreshEntitiesAction());
		}
		if (shouldParseResponse || isEncounter || isBestiary) {
			setIsOpen(false);
			setIsContextModalOpen(false);
			setIsImagePromptPickerOpen(false);
		}
	};

	const generate = async (
		type = null,
		targetSceneId = null,
		{
			forceParseAIResponse = null,
			imageTarget = null,
			imagePromptBasePromptOverride = undefined,
			userInstructionsOverride = null,
		} = {},
	) => {
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
			const data = await api.generateAi(
				payload,
				{ signal: controller.signal },
			);
			handleGeneratedAiData({
				data,
				requestType,
				shouldParseResponse,
			});
			dispatchGenerationLifecycle({ type: "succeed", requestId });
		} catch (err) {
			if (err?.name === "AbortError") {
				dispatchGenerationLifecycle({ type: "cancel", requestId });
				return;
			}
			dispatchGenerationLifecycle({ type: "fail", requestId });
			if (err.data?.aiResponse) {
				upsertResponseHistoryEntry(err.data.aiResponse);
			}

			if (err.message?.includes("GEMINI_API_KEY")) {
				setIsApiKeyMissing(true);
				setError("");
				return;
			}

			setError(err.message || lang.t("Failed to connect to AI."));
			dispatch(
				alert({
					title: lang.t("AI error"),
					message: err.status
						? `[${lang.t("Status")}: ${err.status}] ${err.message}`
						: err.message,
				}),
			);
		} finally {
			if (activeGenerateControllerRef.current === controller) {
				activeGenerateControllerRef.current = null;
				setCanCancelGenerate(false);
			}
		}
	};

	const retryResponseHistoryEntry = async (entry) => {
		if (!canRetryHistoryEntry(entry) || loading) return;
		const retryPayload = buildRetryPayloadFromHistoryEntry(entry);
		if (!retryPayload) return;
		const requestType =
			retryPayload.type ||
			(isBestiary && retryPayload.type !== "image" ? "custom-monster" : null);
		const shouldParseResponse =
			retryPayload.type === "image"
				? false
				: Boolean(retryPayload.parseAIResponse);

		cancelGenerateRequest();
		const controller = new AbortController();
		const requestId = (nextGenerationRequestIdRef.current += 1);
		activeGenerateControllerRef.current = controller;
		setCanCancelGenerate(true);
		dispatchGenerationLifecycle({ type: "start-retry", requestId });
		setError("");

		try {
			if (isFailedHistoryEntry(entry)) {
				const responses = await api.deleteAiResponse(
					getAiResponseHistoryCampaign(entry),
					entry.id,
				);
				setResponseHistory(Array.isArray(responses) ? responses : []);
				refreshResponseHistoryStats();
				if (selectedResponseId === entry.id) {
					closeGeneratedPrompt();
				}
			}

			const data = await api.generateAi(retryPayload, {
				signal: controller.signal,
			});
			handleGeneratedAiData({
				data,
				requestType,
				shouldParseResponse,
				clearPromptOnApplied: false,
			});
			dispatchGenerationLifecycle({ type: "succeed", requestId });
		} catch (err) {
			if (err?.name === "AbortError") {
				dispatchGenerationLifecycle({ type: "cancel", requestId });
				return;
			}
			dispatchGenerationLifecycle({ type: "fail", requestId });
			if (err.data?.aiResponse) {
				upsertResponseHistoryEntry(err.data.aiResponse);
			}
			setError(err.message || lang.t("Failed to connect to AI."));
			dispatch(
				alert({
					title: lang.t("AI error"),
					message: err.status
						? `[${lang.t("Status")}: ${err.status}] ${err.message}`
						: err.message,
				}),
			);
		} finally {
			if (activeGenerateControllerRef.current === controller) {
				activeGenerateControllerRef.current = null;
				setCanCancelGenerate(false);
			}
		}
	};

	const getPlaceholder = () => {
		if (isBestiary) {
			return lang.t("Describe the custom creature to create...");
		}
		if (!parseAIResponse) {
			return lang.t(
				"Send your request. The response will appear in a dialog and will not change your data.",
			);
		} else if (isCampaign) {
			return lang.t(
				"Describe changes or new plot branches (for example: 'add political intrigue' or 'make the finale more epic')...",
			);
		} else if (isEncounter) {
			return lang.t(
				"Describe changes (for example: 'make the fight deadly', 'this is an easy skirmish', 'add guards for the boss')...",
			);
		} else {
			return lang.t(
				"Describe style or constraints (for example: 'abandoned underground city', 'detective atmosphere')...",
			);
		}
	};

	const characterContext = getContextListConfig(
		contextConfig.campaignCharacters,
	);
	const npcContext = getContextListConfig(contextConfig.campaignNpcs);
	const locationContext = getContextListConfig(contextConfig.campaignLocations);
	const characterContextItems = characterContext.items || {};
	const npcContextItems = npcContext.items || {};
	const locationContextItems = locationContext.items || {};
	const selectedResponseDetails = getHistoryDetailRows(
		selectedResponseEntry,
		currentLanguage,
	);
	const selectedResponseDiffResources = buildDiffResources(
		selectedResponseEntry,
		{
			note: lang.t("Note"),
			scene: lang.t("Scene"),
			encounter: lang.t("Encounter"),
			creature: lang.t("Creature"),
		},
	);
	const selectedResponseHasChanges = selectedResponseDiffResources.length > 0;
	const visibleResponseHistory = useMemo(
		() =>
			responseHistory.filter((entry) =>
				isAiResponseVisibleForRoute(entry, initialRoute, { isBestiary }),
			),
		[initialRoute, isBestiary, responseHistory],
	);
	const isResponseParsingLocked = isBestiary;
	const isCustomMonsterGenerationVisible =
		parseAIResponse &&
		!isBestiary &&
		!isCampaign &&
		!isEncounter &&
		generateEncounters;
	const imagePromptNpcs = isCampaign
		? sessionData?.npcs?.length
			? sessionData.npcs
			: npcsList
		: sessionData?.npcs || [];
	const imagePromptLocations = isCampaign
		? sessionData?.locations?.length
			? sessionData.locations
			: locationsList
		: sessionData?.locations || [];
	const imagePromptScenes = isCampaign
		? imagePromptSessions.flatMap((session) =>
				(session.data?.scenes || []).map((scene, index) => ({
					...scene,
					_imagePromptSessionName: session.name,
					_imagePromptSessionFileName: session.fileName,
					_imagePromptIndex: index,
					_imagePromptEncounters: session.data?.encounters || [],
				})),
			)
		: (sessionData?.scenes || []).map((scene, index) => ({
				...scene,
				_imagePromptSessionName: sessionName || sessionData?.name,
				_imagePromptSessionFileName: initialRoute.session,
				_imagePromptIndex: index,
				_imagePromptEncounters: sessionData?.encounters || [],
			}));
	const sortedImagePromptCustomMonsters = [...imagePromptCustomMonsters].sort(
		(a, b) =>
			String(a?.name || "").localeCompare(
				String(b?.name || ""),
				currentLanguage,
			),
	);
	const imagePromptCustomMonstersWithoutImages =
		sortedImagePromptCustomMonsters.filter((monster) => !monster?.imageUrl);
	const imagePromptCustomMonstersWithImages =
		sortedImagePromptCustomMonsters.filter((monster) => monster?.imageUrl);
	const assistantTitle = isBestiary
		? lang.t("AI Bestiary Assistant")
		: isCampaign
			? lang.t("AI Story Assistant")
			: isEncounter
				? lang.t("AI Encounter Assistant")
				: lang.t("AI Session Assistant");
	const tokenEstimate = useMemo(() => {
		return buildAiTokenEstimate({
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

	const generateImagePromptForTarget = (target = null) => {
		const basePrompt = imagePromptInstructions.trim();
		const request = imagePromptRequest.trim();
		if (!target && !request) {
			setError(
				lang.t(
					"Image prompt instructions are required when no element is selected.",
				),
			);
			return;
		}

		setIsImagePromptPickerOpen(false);
		generate("image", target?.type === "scene" ? target.id || null : null, {
			imageTarget: target || null,
			imagePromptBasePromptOverride: basePrompt,
			userInstructionsOverride: target ? "" : request,
		});
		setSelectedImagePromptTarget(null);
		setImagePromptInstructions("");
		setImagePromptRequest("");
		setIsImagePromptContextMode(false);
	};

	const selectImagePromptTarget = (target) => {
		setSelectedImagePromptTarget(target);
		setIsImagePromptContextMode(false);
		setImagePromptInstructions(activeImagePromptBasePrompt);
	};

	const continueImagePromptWithoutTarget = () => {
		setSelectedImagePromptTarget(null);
		setIsImagePromptContextMode(true);
		setImagePromptInstructions(activeImagePromptBasePrompt);
		setImagePromptRequest("");
	};

	const closeImagePromptPicker = () => {
		setIsImagePromptPickerOpen(false);
		setSelectedImagePromptTarget(null);
		setImagePromptInstructions("");
		setImagePromptRequest("");
		setIsImagePromptContextMode(false);
	};

	const openImagePromptPicker = async () => {
		setSelectedImagePromptTarget(null);
		setIsImagePromptContextMode(false);
		setImagePromptInstructions(activeImagePromptBasePrompt);
		setImagePromptRequest("");
		await prepareImagePromptData();
		setIsImagePromptPickerOpen(true);
	};

	const getImagePromptTargetTitle = (target) => {
		if (!target) return "";
		if (target.type === "scene" && target.sessionName) {
			return `${target.name} - ${target.sessionName}`;
		}
		return target.name || target.id || target.type || "";
	};

	const buildNpcImageTarget = (npc) =>
		buildNpcImageTargetModel(npc, {
			displayName: getCharacterDisplayName(npc),
			scope: isCampaign ? "campaign" : "session",
		});

	const buildLocationImageTarget = (location) =>
		buildLocationImageTargetModel(location, {
			displayName: getLocationDisplayName(location),
			scope: isCampaign ? "campaign" : "session",
		});

	const buildSceneImageTarget = (scene) =>
		buildSceneImageTargetModel(scene, {
			title: getSceneImagePromptTitle(scene, scene?._imagePromptIndex || 0),
		});

	const openImagePromptForMonster = useCallback(
		(monster) => {
			if (!monster?.name) return;
			setSelectedImagePromptTarget(buildCustomMonsterImageTargetModel(monster));
			setIsImagePromptContextMode(false);
			setImagePromptInstructions(activeImagePromptBasePrompt);
			setImagePromptRequest("");
			setIsImagePromptPickerOpen(true);
		},
		[activeImagePromptBasePrompt],
	);

	useEffect(() => {
		if (!isBestiary || typeof onRegisterImagePromptAction !== "function") {
			return undefined;
		}
		onRegisterImagePromptAction(openImagePromptForMonster);
		return () => onRegisterImagePromptAction(null);
	}, [isBestiary, onRegisterImagePromptAction, openImagePromptForMonster]);

	useEffect(() => {
		return () => {
			cancelGenerateRequest();
		};
	}, []);

	const imagePromptModal = (
		<AiImagePromptPickerModal
			attachedFiles={attachedFiles}
			attachedImages={attachedImages}
			buildCustomMonsterImageTarget={buildCustomMonsterImageTargetModel}
			buildLocationImageTarget={buildLocationImageTarget}
			buildNpcImageTarget={buildNpcImageTarget}
			buildSceneImageTarget={buildSceneImageTarget}
			campaignSlug={isBestiary ? "general" : initialRoute.campaign}
			customMonstersWithImages={imagePromptCustomMonstersWithImages}
			customMonstersWithoutImages={imagePromptCustomMonstersWithoutImages}
			getCharacterDisplayName={getCharacterDisplayName}
			getImagePromptPreview={getImagePromptPreview}
			getImagePromptTargetTitle={getImagePromptTargetTitle}
			getLocationDisplayName={getLocationDisplayName}
			getSceneImagePromptDescription={getSceneImagePromptDescription}
			getSceneImagePromptTitle={getSceneImagePromptTitle}
			imagePromptInstructions={imagePromptInstructions}
			imagePromptLocations={imagePromptLocations}
			imagePromptNpcs={imagePromptNpcs}
			imagePromptScenes={imagePromptScenes}
			aiModels={aiModels}
			isBestiary={isBestiary}
			isCampaign={isCampaign}
			isDataLoading={isImagePromptDataLoading}
			isOpen={isImagePromptPickerOpen}
			loading={loading}
			onBackToSelection={() => {
				setSelectedImagePromptTarget(null);
				setIsImagePromptContextMode(false);
				setImagePromptInstructions(activeImagePromptBasePrompt);
				setImagePromptRequest("");
			}}
			onCancel={closeImagePromptPicker}
			onContinueWithoutSelection={continueImagePromptWithoutTarget}
			onGenerate={generateImagePromptForTarget}
			onInstructionsChange={setImagePromptInstructions}
			onRequestChange={setImagePromptRequest}
			onModelChange={setSelectedModel}
			onSelectTarget={selectImagePromptTarget}
			isContextMode={isImagePromptContextMode}
			imagePromptRequest={imagePromptRequest}
			selectedModel={selectedModel}
			selectedTarget={selectedImagePromptTarget}
			setAttachedFiles={setAttachedFiles}
			setAttachedImages={setAttachedImages}
		/>
	);

	return (
		<AiAssistantShell
			title={assistantTitle}
			isOpen={isOpen}
			isLoading={loading}
			onOpen={() => setIsOpen(true)}
			onClose={() => {
				if (loading) return;
				setIsOpen(false);
			}}
			imagePromptModal={imagePromptModal}
			notification={notification}
			onCloseNotification={() => setNotification(null)}
		>
						<AiAssistantToolbar
							aiModels={aiModels}
							generateCharacters={generateCharacters}
							generateCustomMonsters={generateCustomMonsters}
							generateEncounters={generateEncounters}
							generateLocations={generateLocations}
							generateNpcs={generateNpcs}
							isBestiary={isBestiary}
							isCampaign={isCampaign}
							isCustomMonsterGenerationVisible={
								isCustomMonsterGenerationVisible
							}
							isEncounter={isEncounter}
							isResponseParsingLocked={isResponseParsingLocked}
							loading={loading}
							onCreateCustomCreature={() =>
								generate("custom-monster", null, {
									forceParseAIResponse: true,
								})
							}
							onOpenContext={() => setIsContextModalOpen(true)}
							onOpenImagePrompt={openImagePromptPicker}
							parseAIResponse={parseAIResponse}
							selectedModel={selectedModel}
							setGenerateCharacters={setGenerateCharacters}
							setGenerateCustomMonsters={setGenerateCustomMonsters}
							setGenerateEncounters={setGenerateEncounters}
							setGenerateLocations={setGenerateLocations}
							setGenerateNpcs={setGenerateNpcs}
							setParseAIResponse={setParseAIResponse}
							setSelectedModel={setSelectedModel}
							setUseContext={setUseContext}
							useContext={useContext}
						/>
						{isApiKeyMissing && (
							<AiApiKeyPanel
								apiKeyInput={apiKeyInput}
								isSavingApiKey={isSavingApiKey}
								loading={loading}
								onApiKeyChange={setApiKeyInput}
								onSave={handleSaveApiKey}
							/>
						)}
						<AiContextSettingsModal
							characterContext={characterContext}
							characterContextItems={characterContextItems}
							charactersList={charactersList}
							contextConfig={contextConfig}
							expandedSessions={expandedSessions}
							getCharacterContextKey={getCharacterContextKey}
							getCharacterDisplayName={getCharacterDisplayName}
							getLocationContextKey={getLocationContextKey}
							getLocationDisplayName={getLocationDisplayName}
							isOpen={isContextModalOpen}
							locationContext={locationContext}
							locationContextItems={locationContextItems}
							locationsList={locationsList}
							npcContext={npcContext}
							npcContextItems={npcContextItems}
							npcsList={npcsList}
							onCancel={() => setIsContextModalOpen(false)}
							setAllCampaignContextItems={setAllCampaignContextItems}
							setContextConfig={setContextConfig}
							sessionsList={sessionsList}
							toggleSessionDetails={toggleSessionDetails}
							updateCampaignContextListIncluded={
								updateCampaignContextListIncluded
							}
							updateCampaignContextListItem={updateCampaignContextListItem}
							updateContextConfig={updateContextConfig}
						/>

						<AiHistoryResponseDialog
							generatedPrompt={generatedPrompt}
							generatedPromptRef={generatedPromptRef}
							isGeneratedPromptCopied={isGeneratedPromptCopied}
							isRestoringResponse={isRestoringResponse}
							markdownComponents={markdownMentionComponents}
							onRestore={restoreAiHistoryEntry}
							onCancel={closeGeneratedPrompt}
							onCopy={copyGeneratedPrompt}
							onSaveDraftChanges={saveDraftHistoryEntryChanges}
							selectedResponseDetails={selectedResponseDetails}
							selectedResponseDiffResources={selectedResponseDiffResources}
							selectedResponseEntry={selectedResponseEntry}
							selectedResponseHasChanges={selectedResponseHasChanges}
							getDiffResourceState={getDiffResourceState}
							getHistoryChangeSummary={getHistoryChangeSummary}
						/>

						<AiPromptComposer
							attachedFiles={attachedFiles}
							attachedImages={attachedImages}
							campaignSlug={isBestiary ? "general" : initialRoute.campaign}
							canCancel={canCancelGenerate}
							formattedFileTokenEstimate={formattedFileTokenEstimate}
							formattedImageTokenEstimate={formattedImageTokenEstimate}
							formattedTextTokenEstimate={formattedTextTokenEstimate}
							formattedTokenEstimate={formattedTokenEstimate}
							isLoading={loading}
							onCancel={cancelGenerateRequest}
							onGenerate={() => generate()}
							onInstructionsChange={setUserInstructions}
							placeholder={getPlaceholder()}
							setAttachedFiles={setAttachedFiles}
							setAttachedImages={setAttachedImages}
							tokenEstimate={tokenEstimate}
							userInstructions={userInstructions}
						/>

						{error && <div className="AiAssistant__error">{error}</div>}

						<AiResponseHistory
							entries={visibleResponseHistory}
							currentLanguage={currentLanguage}
							storageSizeLabel={formatBytes(responseHistorySizeBytes)}
							onClear={clearResponseHistory}
							onDelete={deleteResponseHistoryEntry}
							onRetry={retryResponseHistoryEntry}
							onSelect={showGeneratedPrompt}
							canRetry={canRetryHistoryEntry}
							formatResponseDate={formatResponseDate}
							getTitle={getHistoryTitle}
							getSummary={getHistoryChangeSummary}
							getStateLabel={getAiResponseStateLabel}
						/>
		</AiAssistantShell>
	);
}
