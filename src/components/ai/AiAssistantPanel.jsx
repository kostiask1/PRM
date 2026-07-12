import {
	Children,
	cloneElement,
	createElement,
	isValidElement,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { campaignApi } from "../../entities/campaign/index.js";
import { sessionApi } from "../../entities/session/index.js";
import { bestiaryApi } from "../../entities/bestiary/index.js";
import { aiApi } from "../../features/ai/index.js";

const api = { ...campaignApi, ...sessionApi, ...bestiaryApi, ...aiApi };
import Button from "../form/Button.jsx";
import EditableField from "../form/EditableField.jsx";
import Icon from "../common/Icon.jsx";
import AiAttachmentControls from "./AiAttachmentControls.jsx";
import Modal from "../common/Modal.jsx";
import Notification from "../common/Notification.jsx";
import AiApiKeyPanel from "./AiApiKeyPanel.jsx";
import AiAssistantToolbar from "./AiAssistantToolbar.jsx";
import AiContextSettingsModal from "./AiContextSettingsModal.jsx";
import AiImagePromptPickerModal from "./AiImagePromptPickerModal.jsx";
import AiResponseHistory from "./AiResponseHistory.jsx";
import AiResponseModal from "./AiResponseModal.jsx";
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
import Tooltip from "../common/Tooltip.jsx";
import { useAppDispatch, useAppSelector } from "../../store/appStore.js";
import { lang } from "../../services/localization.js";
import { renderMentionText } from "../../renderers/contentRenderer.jsx";
import { formatBytes } from "../../utils/formatBytes.js";
import { ESTIMATED_FILE_TOKEN_BYTES } from "../../utils/aiAttachments.js";
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

const ESTIMATED_IMAGE_TOKENS = 260;
const SYSTEM_TOKEN_ESTIMATES = {
	prompt: 650,
	campaign: 1500,
	scene: 1900,
	encounter: 1200,
	"custom-monster": 2200,
	image: 550,
};

function estimateTextTokens(text) {
	const value = String(text || "");
	if (!value.trim()) return 0;

	const cyrillic = (value.match(/[\u0400-\u04ff]/g) || []).length;
	const latinDigits = (value.match(/[A-Za-z0-9]/g) || []).length;
	const whitespace = (value.match(/\s/g) || []).length;
	const other = Math.max(0, value.length - cyrillic - latinDigits - whitespace);
	return Math.ceil(cyrillic / 2.7 + latinDigits / 4 + other / 3.5);
}

function estimateValueTokens(value) {
	if (value === null || value === undefined) return 0;
	if (typeof value === "string") return estimateTextTokens(value);
	return estimateTextTokens(JSON.stringify(value));
}

function compactNoteForEstimate(note) {
	if (!note || note._aiIgnored) return null;
	return {
		title: note.title || "",
		text: note.text || "",
	};
}

function compactEntityForEstimate(entity) {
	if (!entity || entity._aiIgnored) return null;
	return {
		name:
			[
				entity.firstName || entity.first_name || "",
				entity.lastName || entity.last_name || "",
			]
				.filter(Boolean)
				.join(" ") ||
			entity.name ||
			entity.title ||
			"",
		description: entity.description || "",
		motivation: entity.motivation || "",
		trait: entity.trait || "",
		notes: (entity.notes || []).map(compactNoteForEstimate).filter(Boolean),
	};
}

function compactSessionForEstimate(data = {}) {
	return {
		notes: (data.notes || []).map(compactNoteForEstimate).filter(Boolean),
		result: data.result_text || "",
		scenes: (data.scenes || []).map((scene) => ({
			texts: scene.texts || {},
			notes: (scene.notes || []).map(compactNoteForEstimate).filter(Boolean),
			npcs: scene.npcs || [],
			encounterId: scene.encounterId || "",
		})),
		npcs: (data.npcs || []).map(compactEntityForEstimate).filter(Boolean),
		locations: (data.locations || [])
			.map(compactEntityForEstimate)
			.filter(Boolean),
	};
}

function getEstimatedAiMode({
	isBestiary,
	isEncounter,
	isCampaign,
	parseAIResponse,
}) {
	if (isBestiary) return "custom-monster";
	if (!parseAIResponse) return "prompt";
	if (isEncounter) return "encounter";
	if (isCampaign) return "campaign";
	return "scene";
}

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

function getNoteTextForImagePrompt(note) {
	if (!note) return "";
	if (typeof note === "string") return note;
	if (typeof note !== "object" || note._aiIgnored) return "";
	return [note.title, note.text].filter(Boolean).join("\n").trim();
}

function getEntityNotesForImagePrompt(entity) {
	return (entity?.notes || [])
		.map(getNoteTextForImagePrompt)
		.filter(Boolean)
		.slice(0, 8);
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

function getContextListConfig(value) {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return {
			included: value.included !== false,
			items: value.items && typeof value.items === "object" ? value.items : {},
		};
	}
	return {
		included: value !== false,
		items: {},
	};
}

function ensureContextListItems(currentValue, list, getKey) {
	const current = getContextListConfig(currentValue);
	const nextItems = { ...current.items };
	let changed =
		!currentValue ||
		typeof currentValue !== "object" ||
		Array.isArray(currentValue) ||
		!currentValue.items;

	for (const item of list) {
		const key = getKey(item);
		if (!key || Object.prototype.hasOwnProperty.call(nextItems, key)) {
			continue;
		}
		nextItems[key] = true;
		changed = true;
	}

	if (!changed) return currentValue;
	return {
		included: current.included,
		items: nextItems,
	};
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

function getHistoryChangeResources(entry) {
	return Array.isArray(entry?.changes?.resources)
		? entry.changes.resources
		: [];
}

function getHistoryChangedEntityTypes(entry) {
	return [
		...new Set(
			getHistoryChangeResources(entry)
				.filter((resource) => resource?.kind === "entity" && resource.type)
				.map((resource) => resource.type),
		),
	];
}

function getGeneratedEntityTypes(generated, historyEntry = null) {
	const types = [];
	if (Array.isArray(generated?.characters)) types.push("characters");
	if (Array.isArray(generated?.npcs)) types.push("npc");
	if (Array.isArray(generated?.locations)) types.push("locations");
	if (types.length > 0) return types;
	return historyEntry ? getHistoryChangedEntityTypes(historyEntry) : [];
}

function hasGeneratedCampaignChanges(generated, historyEntry = null) {
	const operations = Array.isArray(generated?.operations)
		? generated.operations
		: [];
	if (
		operations.some(
			(operation) =>
				operation?.entity === "campaign" ||
				operation?.scope === "campaign" ||
				operation?.to === "campaign" ||
				operation?.from === "campaign",
		)
	) {
		return true;
	}
	return getHistoryChangeResources(historyEntry).some(
		(resource) => resource?.kind === "campaign",
	);
}

function hasHistoryChanges(entry) {
	return getHistoryChangeResources(entry).length > 0;
}

function isFailedHistoryEntry(entry) {
	return entry?.status === "failed";
}

function isNonParsedHistoryEntry(entry) {
	return entry?.request?.options?.responseParsing === false;
}

function buildRetryPayloadFromHistoryEntry(entry) {
	if (entry?.retryPayload && typeof entry.retryPayload === "object") {
		return entry.retryPayload;
	}
	if (!isNonParsedHistoryEntry(entry)) return null;

	const options = entry?.request?.options || {};
	const path = entry?.path || {};
	if (!path.campaign) return null;

	return {
		type: entry.type || options.mode || null,
		modelName: entry.modelName || options.modelName || undefined,
		userInstructions: getHistoryRequestText(entry),
		path,
		sceneId: options.sceneId || undefined,
		imageTarget: options.imageTarget || undefined,
		parseAIResponse: false,
		generateCharacters: Boolean(options.characterGeneration),
		generateNpcs: Boolean(options.npcGeneration),
		generateLocations: Boolean(options.locationGeneration),
		generateEncounters: false,
		generateCustomMonsters: false,
		contextConfig: null,
		language: entry.language || undefined,
	};
}

function canRetryHistoryEntry(entry) {
	if (isFailedHistoryEntry(entry)) return Boolean(entry?.retryPayload);
	if (isNonParsedHistoryEntry(entry)) {
		return Boolean(buildRetryPayloadFromHistoryEntry(entry));
	}
	return false;
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
	const [loading, setLoading] = useState(false);
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
	const [imagePromptSessions, setImagePromptSessions] = useState([]);
	const [imagePromptCustomMonsters, setImagePromptCustomMonsters] = useState(
		[],
	);
	const [isImagePromptDataLoading, setIsImagePromptDataLoading] =
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
	const [sessionsList, setSessionsList] = useState([]);
	const [charactersList, setCharactersList] = useState([]);
	const [npcsList, setNpcsList] = useState([]);
	const [locationsList, setLocationsList] = useState([]);
	const [expandedSessions, setExpandedSessions] = useState({});
	const [contextConfig, setContextConfig] = useState(() => ({
		campaignNotes: true,
		campaignCharacters: {
			included: true,
			items: {},
		},
		campaignNpcs: {
			included: true,
			items: {},
		},
		campaignLocations: {
			included: true,
			items: {},
		},
		sessions: initialRoute.session
			? {
					[initialRoute.session]: {
						included: true,
						notes: true,
						result_text: true,
						scenes: {},
					},
				}
			: {}, // { [slug]: { included: bool, notes: bool, result_text: bool, scenes: {}, data: {} } }
	}));
	const [generatedPrompt, setGeneratedPrompt] = useState(null);
	const [selectedResponseId, setSelectedResponseId] = useState(null);
	const [selectedResponseEntry, setSelectedResponseEntry] = useState(null);
	const [responseHistory, setResponseHistory] = useState([]);
	const [responseHistorySizeBytes, setResponseHistorySizeBytes] = useState(0);
	const [isRestoringResponse, setIsRestoringResponse] = useState(false);
	const activeGenerateControllerRef = useRef(null);
	const generatedPromptRef = useRef(null);
	const imagePromptCampaignDataLoadedRef = useRef(false);
	const imagePromptCampaignEntitiesLoadedRef = useRef(false);
	const imagePromptBestiaryDataLoadedRef = useRef(false);
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
		if (
			!isBestiary &&
			(isOpen || isContextModalOpen || isImagePromptPickerOpen) &&
			useContext &&
			sessionsList.length === 0
		) {
			api.listSessions(initialRoute.campaign).then(setSessionsList);
		}
	}, [
		isBestiary,
		isOpen,
		isContextModalOpen,
		isImagePromptPickerOpen,
		initialRoute.campaign,
		sessionsList.length,
		useContext,
	]);

	useEffect(() => {
		if (isBestiary) return;
		if (
			isImagePromptPickerOpen &&
			imagePromptCampaignEntitiesLoadedRef.current
		) {
			return;
		}
		if (!isOpen && !isContextModalOpen && !isImagePromptPickerOpen) return;
		if (!useContext && !isContextModalOpen && !isImagePromptPickerOpen) return;

		let cancelled = false;
		const loadCampaignEntities = async (type, label) => {
			try {
				const entities = await api.getEntities(initialRoute.campaign, type);
				return Array.isArray(entities) ? entities : [];
			} catch (err) {
				console.error(`Failed to load ${label}`, err);
				return [];
			}
		};

		Promise.all([
			loadCampaignEntities("characters", "characters"),
			loadCampaignEntities("npc", "NPCs"),
			loadCampaignEntities("locations", "locations"),
		])
			.then(([characters, npcs, locations]) => {
				if (cancelled) return;
				setCharactersList(characters);
				setNpcsList(npcs);
				setLocationsList(locations);
				if (isImagePromptPickerOpen) {
					imagePromptCampaignEntitiesLoadedRef.current = true;
				}
			})
			.catch((err) => console.error("Failed to load campaign context", err));

		return () => {
			cancelled = true;
		};
	}, [
		isBestiary,
		isOpen,
		isContextModalOpen,
		isImagePromptPickerOpen,
		initialRoute.campaign,
		useContext,
	]);

	useEffect(() => {
		if (isBestiary || !isOpen || !useContext) return;
		if (!initialRoute.campaign || !contextConfig.sessions) return;

		const entriesToLoad = Object.entries(contextConfig.sessions).filter(
			([, conf]) => conf?.included && !conf?.data,
		);
		if (entriesToLoad.length === 0) return;

		let cancelled = false;
		Promise.all(
			entriesToLoad.map(async ([slug, conf]) => {
				try {
					const session = await api.getSession(initialRoute.campaign, slug);
					return [slug, conf, session?.data || {}];
				} catch (err) {
					console.error("Failed to load session for token estimate", err);
					return null;
				}
			}),
		).then((loadedSessions) => {
			if (cancelled) return;
			const validSessions = loadedSessions.filter(Boolean);
			if (validSessions.length === 0) return;
			setContextConfig((prev) => {
				const nextSessions = { ...(prev.sessions || {}) };
				let changed = false;
				for (const [slug, conf, data] of validSessions) {
					if (nextSessions[slug]?.data) continue;
					nextSessions[slug] = {
						...(nextSessions[slug] || conf),
						data,
					};
					changed = true;
				}
				return changed ? { ...prev, sessions: nextSessions } : prev;
			});
		});

		return () => {
			cancelled = true;
		};
	}, [
		contextConfig.sessions,
		initialRoute.campaign,
		isBestiary,
		isOpen,
		useContext,
	]);

	useEffect(() => {
		if (charactersList.length === 0) return;

		setContextConfig((prev) => {
			const nextCharacters = ensureContextListItems(
				prev.campaignCharacters,
				charactersList,
				getCharacterContextKey,
			);
			if (nextCharacters === prev.campaignCharacters) return prev;
			return {
				...prev,
				campaignCharacters: nextCharacters,
			};
		});
	}, [charactersList]);

	useEffect(() => {
		if (npcsList.length === 0) return;

		setContextConfig((prev) => {
			const nextNpcs = ensureContextListItems(
				prev.campaignNpcs,
				npcsList,
				getCharacterContextKey,
			);
			if (nextNpcs === prev.campaignNpcs) return prev;
			return {
				...prev,
				campaignNpcs: nextNpcs,
			};
		});
	}, [npcsList]);

	useEffect(() => {
		if (locationsList.length === 0) return;

		setContextConfig((prev) => {
			const nextLocations = ensureContextListItems(
				prev.campaignLocations,
				locationsList,
				getLocationContextKey,
			);
			if (nextLocations === prev.campaignLocations) return prev;
			return {
				...prev,
				campaignLocations: nextLocations,
			};
		});
	}, [locationsList]);

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

	useEffect(() => {
		if (!isImagePromptPickerOpen || !isCampaign || !initialRoute.campaign) {
			return;
		}
		if (imagePromptCampaignDataLoadedRef.current) return;

		let cancelled = false;
		setIsImagePromptDataLoading(true);
		(async () => {
			try {
				const sessions =
					sessionsList.length > 0
						? sessionsList
						: await api.listSessions(initialRoute.campaign);
				if (cancelled) return;
				if (sessionsList.length === 0) {
					setSessionsList(sessions);
				}
				const fullSessions = await Promise.all(
					sessions.map((session) =>
						api
							.getSession(initialRoute.campaign, session.fileName)
							.catch((err) => {
								console.error("Failed to load session for image prompt", err);
								return null;
							}),
					),
				);
				if (!cancelled) {
					setImagePromptSessions(fullSessions.filter(Boolean));
					imagePromptCampaignDataLoadedRef.current = true;
				}
			} finally {
				if (!cancelled) setIsImagePromptDataLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [
		isImagePromptPickerOpen,
		isCampaign,
		initialRoute.campaign,
		sessionsList,
	]);

	useEffect(() => {
		if (!isImagePromptPickerOpen || !isBestiary) return;
		if (imagePromptBestiaryDataLoadedRef.current) return;

		let cancelled = false;
		setIsImagePromptDataLoading(true);
		api
			.getCustomBestiaryData()
			.then((data) => {
				if (cancelled) return;
				const monsters = Array.isArray(data?.monster)
					? data.monster
					: Array.isArray(data?.monsters)
						? data.monsters
						: Array.isArray(data)
							? data
							: [];
				setImagePromptCustomMonsters(monsters);
				imagePromptBestiaryDataLoadedRef.current = true;
			})
			.catch((err) => {
				console.error("Failed to load custom monsters for image prompt", err);
				if (!cancelled) setImagePromptCustomMonsters([]);
			})
			.finally(() => {
				if (!cancelled) setIsImagePromptDataLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [isImagePromptPickerOpen, isBestiary]);

	const deleteResponseHistoryEntry = async (entry) => {
		const confirmed = await dispatch(
			confirm({
				title: lang.t("Delete response"),
				message: lang.t("Delete this AI response?"),
			}),
		);
		if (!confirmed) return;

		try {
			const responses = await api.deleteAiResponse(
				getAiResponseHistoryCampaign(entry),
				entry.id,
			);
			setResponseHistory(Array.isArray(responses) ? responses : []);
			refreshResponseHistoryStats();
			if (selectedResponseId === entry.id) {
				closeGeneratedPrompt();
			}
		} catch (err) {
			dispatch(alert({ title: lang.t("Delete error"), message: err.message }));
		}
	};

	const clearResponseHistory = async () => {
		const confirmed = await dispatch(
			confirm({
				title: lang.t("Clear response history"),
				message: lang.t("Delete all saved AI responses?"),
			}),
		);
		if (!confirmed) return;

		try {
			const responses = await api.clearAiResponses(aiHistoryCampaign);
			setResponseHistory(Array.isArray(responses) ? responses : []);
			refreshResponseHistoryStats();
			closeGeneratedPrompt();
		} catch (err) {
			dispatch(alert({ title: lang.t("Delete error"), message: err.message }));
		}
	};

	const upsertResponseHistoryEntry = (entry) => {
		if (!entry?.id) return;
		setResponseHistory((prev) => [
			entry,
			...prev.filter((item) => item.id !== entry.id),
		]);
		refreshResponseHistoryStats();
		if (selectedResponseId === entry.id) {
			setSelectedResponseEntry(entry);
			setGeneratedPrompt(entry.text);
		}
	};

	const getAiResponseHistoryCampaign = (entry) =>
		entry?.path?.campaign || aiHistoryCampaign;

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
		if (Array.isArray(result?.responses)) {
			setResponseHistory(result.responses);
			refreshResponseHistoryStats();
		} else if (result?.response) {
			upsertResponseHistoryEntry(result.response);
		}

		const nextEntry = result?.response || entry;
		if (nextEntry?.id === selectedResponseId) {
			setSelectedResponseEntry(nextEntry);
			setGeneratedPrompt(nextEntry.text);
		}

		const updated = result?.updated;
		let appliedDirectly = false;
		if (updated && typeof updated === "object") {
			const entryPath = nextEntry?.path || {};
			const updatedIsSessionLike =
				updated.data && typeof updated.data === "object";
			const isSameCampaign = entryPath.campaign === initialRoute.campaign;
			const canApplyDirectly =
				(isBestiary && Array.isArray(updated.monsters)) ||
				(isCampaign &&
					isSameCampaign &&
					!entryPath.session &&
					!updatedIsSessionLike) ||
				(!isCampaign &&
					isSameCampaign &&
					entryPath.session === initialRoute.session &&
					updatedIsSessionLike);

			if (canApplyDirectly) {
				applyUpdatedAiData(updated, {
					entityTypes: getHistoryChangedEntityTypes(nextEntry),
					trackUndo: false,
					historyEntry: nextEntry,
				});
				appliedDirectly = true;
			}
		}

		if (!appliedDirectly) {
			dispatch(requestCampaignsReloadAction());
			if (getHistoryChangedEntityTypes(nextEntry).length > 0) {
				dispatch(refreshEntitiesAction());
			}
		}
	};

	const restoreAiHistoryEntry = async (entry, mode, options = {}) => {
		if (!entry?.id || isRestoringResponse) return;
		const isUndo = mode === "undo";
		const isPartialApply =
			!isUndo &&
			Array.isArray(options.resourceIds) &&
			options.resourceIds.length > 0;
		const isPartialUndo =
			isUndo &&
			Array.isArray(options.resourceIds) &&
			options.resourceIds.length > 0;
		const confirmed = await dispatch(
			confirm({
				title: isUndo
					? isPartialUndo
						? lang.t("Undo selected AI change")
						: lang.t("Undo AI changes")
					: isPartialApply
						? lang.t("Apply selected AI change")
						: lang.t("Apply AI changes"),
				message: isUndo
					? isPartialUndo
						? lang.t(
								"Undo only this AI change? Newer edits in this resource may be overwritten.",
							)
						: lang.t(
								"Restore data to the state before this AI response? Newer edits in these resources may be overwritten.",
							)
					: isPartialApply
						? lang.t(
								"Apply only this AI change? Newer edits in this resource may be overwritten.",
							)
						: lang.t(
								"Restore data to the state after this AI response? Newer edits in these resources may be overwritten.",
							),
			}),
		);
		if (!confirmed) return;

		setIsRestoringResponse(true);
		try {
			const historyCampaign = getAiResponseHistoryCampaign(entry);
			const result = isUndo
				? await api.undoAiResponse(historyCampaign, entry.id, {
						resourceIds: options.resourceIds,
					})
				: await api.applyAiResponse(historyCampaign, entry.id, {
						resourceIds: options.resourceIds,
					});
			refreshAfterAiHistoryRestore(result, entry);
			setNotification(
				isUndo
					? lang.t("AI changes undone.")
					: lang.t("AI changes applied successfully!"),
			);
		} catch (err) {
			dispatch(
				alert({
					title: lang.t("AI history error"),
					message: err.message || lang.t("Unknown error"),
				}),
			);
		} finally {
			setIsRestoringResponse(false);
		}
	};

	const saveDraftHistoryEntryChanges = async (entry, resources) => {
		if (!entry?.id) return null;
		const updatedEntry = await api.updateAiResponse(
			getAiResponseHistoryCampaign(entry),
			entry.id,
			{
				resources,
			},
		);
		if (updatedEntry) {
			upsertResponseHistoryEntry(updatedEntry);
			setSelectedResponseEntry(updatedEntry);
			setGeneratedPrompt(updatedEntry.text);
		}
		return updatedEntry;
	};

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
			setLoading(true);
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
				setLoading(false);
			}
		}
		setExpandedSessions((prev) => ({ ...prev, [sessionSlug]: !isExpanded }));
	};

	const updateContextConfig = (path, value) => {
		setContextConfig((prev) => {
			const next = JSON.parse(JSON.stringify(prev));
			let current = next;
			for (let i = 0; i < path.length - 1; i++) {
				if (!current[path[i]]) {
					if (path[i - 1] === "scenes") {
						current[path[i]] = {
							included: true,
							summary: true,
							goal: true,
							stakes: true,
							location: true,
							notes: true,
							encounter: true,
						};
					} else {
						current[path[i]] = {};
					}
				}
				current = current[path[i]];
			}
			current[path[path.length - 1]] = value;
			return next;
		});
	};

	const updateCampaignContextListIncluded = (contextKey, included) => {
		setContextConfig((prev) => {
			const current = getContextListConfig(prev[contextKey]);
			return {
				...prev,
				[contextKey]: {
					...current,
					included,
				},
			};
		});
	};

	const updateCampaignContextListItem = (contextKey, itemKey, value) => {
		setContextConfig((prev) => {
			const current = getContextListConfig(prev[contextKey]);
			return {
				...prev,
				[contextKey]: {
					...current,
					items: {
						...current.items,
						[itemKey]: value,
					},
				},
			};
		});
	};

	const setAllCampaignContextItems = (contextKey, list, getKey, checked) => {
		const items = Object.fromEntries(
			list
				.map((item) => getKey(item))
				.filter(Boolean)
				.map((key) => [key, checked]),
		);

		setContextConfig((prev) => ({
			...prev,
			[contextKey]: {
				...getContextListConfig(prev[contextKey]),
				included: true,
				items,
			},
		}));
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
		const requestType =
			isBestiary && type !== "image" ? "custom-monster" : type;
		cancelGenerateRequest();
		const controller = new AbortController();
		activeGenerateControllerRef.current = controller;
		setCanCancelGenerate(true);
		setLoading(true);
		setError("");

		// Create a clean config copy without heavy session data.
		// The server loads required files when needed.
		const configToSend = JSON.parse(JSON.stringify(contextConfig));
		if (configToSend.sessions) {
			Object.keys(configToSend.sessions).forEach((slug) => {
				delete configToSend.sessions[slug].data;
			});
		}

		const shouldParseResponse =
			requestType === "image"
				? false
				: isBestiary
					? true
					: forceParseAIResponse === null
						? parseAIResponse
						: forceParseAIResponse;
		const structuredEntityOptionsEnabled =
			shouldParseResponse && !isEncounter && !isBestiary;
		try {
			const data = await api.generateAi(
				{
					type: requestType,
					modelName: selectedModel || undefined,
					userInstructions:
						userInstructionsOverride === null
							? userInstructions
							: userInstructionsOverride,
					path: initialRoute,
					sceneId: targetSceneId,
					imageTarget,
					attachedImages,
					attachedFiles,
					imagePromptBasePromptOverride,
					parseAIResponse: shouldParseResponse,
					generateCharacters: structuredEntityOptionsEnabled
						? generateCharacters
						: true,
					generateNpcs: structuredEntityOptionsEnabled ? generateNpcs : true,
					generateLocations: structuredEntityOptionsEnabled
						? generateLocations
						: true,
					generateEncounters:
						requestType === "image"
							? false
							: shouldParseResponse &&
								!isCampaign &&
								!isBestiary &&
								generateEncounters,
					generateCustomMonsters:
						requestType !== "image" &&
						shouldParseResponse &&
						!isCampaign &&
						!isBestiary &&
						generateEncounters &&
						generateCustomMonsters,
					contextConfig: !isBestiary && useContext ? configToSend : null,
					language: currentLanguage,
				},
				{ signal: controller.signal },
			);
			handleGeneratedAiData({
				data,
				requestType,
				shouldParseResponse,
			});
		} catch (err) {
			if (err?.name === "AbortError") {
				return;
			}
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
			setLoading(false);
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
		activeGenerateControllerRef.current = controller;
		setCanCancelGenerate(true);
		setLoading(true);
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
		} catch (err) {
			if (err?.name === "AbortError") return;
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
			setLoading(false);
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
		const mode = getEstimatedAiMode({
			isBestiary,
			isEncounter,
			isCampaign,
			parseAIResponse,
		});
		const filterByListConfig = (list, config, getKey) => {
			const items = config.items || {};
			const hasExplicitItems = Object.keys(items).length > 0;
			if (config.included === false) return [];
			return (Array.isArray(list) ? list : []).filter((item) => {
				if (!hasExplicitItems) return true;
				return items[getKey(item)] !== false;
			});
		};

		const context = {};
		if (!isBestiary) {
			if (isCampaign) {
				context.campaign = {
					name: sessionData?.name || sessionName || "",
					description: sessionData?.description || "",
				};
				if (useContext) {
					if (contextConfig.campaignNotes) {
						context.campaign.notes = (sessionData?.notes || [])
							.map(compactNoteForEstimate)
							.filter(Boolean);
					}
					context.campaign.characters = filterByListConfig(
						sessionData?.characters || charactersList,
						characterContext,
						getCharacterContextKey,
					)
						.map(compactEntityForEstimate)
						.filter(Boolean);
					context.campaign.npcs = filterByListConfig(
						sessionData?.npcs || npcsList,
						npcContext,
						getCharacterContextKey,
					)
						.map(compactEntityForEstimate)
						.filter(Boolean);
					context.campaign.locations = filterByListConfig(
						sessionData?.locations || locationsList,
						locationContext,
						getLocationContextKey,
					)
						.map(compactEntityForEstimate)
						.filter(Boolean);
				}
			} else {
				context.campaign = {
					description: campaignContext?.description || "",
				};
				if (isEncounter) {
					context.currentEncounter = sessionData || {};
				} else if (parseAIResponse) {
					context.currentSession = compactSessionForEstimate(sessionData || {});
				}
				if (useContext) {
					context.campaign = {
						...context.campaign,
						description: campaignContext?.description || "",
						notes: contextConfig.campaignNotes
							? (campaignContext?.notes || [])
									.map(compactNoteForEstimate)
									.filter(Boolean)
							: [],
						characters: filterByListConfig(
							charactersList,
							characterContext,
							getCharacterContextKey,
						)
							.map(compactEntityForEstimate)
							.filter(Boolean),
						npcs: filterByListConfig(
							npcsList,
							npcContext,
							getCharacterContextKey,
						)
							.map(compactEntityForEstimate)
							.filter(Boolean),
						locations: filterByListConfig(
							locationsList,
							locationContext,
							getLocationContextKey,
						)
							.map(compactEntityForEstimate)
							.filter(Boolean),
					};
					context.selectedSessions = Object.entries(
						contextConfig.sessions || {},
					)
						.filter(([, conf]) => conf?.included && conf?.data)
						.map(([slug, conf]) => ({
							slug,
							data: compactSessionForEstimate(conf.data),
						}));
				}
			}
		}

		const requestShape = {
			mode,
			language: currentLanguage,
			modelName: selectedModel,
			userInstructions,
			options: {
				responseParsing: mode !== "prompt",
				characterGeneration: generateCharacters,
				npcGeneration: generateNpcs,
				locationGeneration: generateLocations,
				encounterGeneration: generateEncounters,
				customMonsterGeneration: generateCustomMonsters,
				contextEnabled: useContext && !isBestiary,
			},
			basePrompts: {
				global: globalAiBasePrompt,
				campaign: activeCampaignBasePrompt,
			},
			context,
			attachedImages: attachedImages.map((image) => ({
				name: image.name,
				url: image.url,
			})),
			attachedFiles: attachedFiles.map((file) => ({
				name: file.name,
				mimeType: file.mimeType,
				sizeBytes: file.sizeBytes,
			})),
		};
		const textTokens =
			(SYSTEM_TOKEN_ESTIMATES[mode] || SYSTEM_TOKEN_ESTIMATES.prompt) +
			estimateValueTokens(requestShape);
		const imageTokens = attachedImages.length * ESTIMATED_IMAGE_TOKENS;
		const fileTokens = Math.ceil(
			attachedFiles.reduce(
				(total, file) => total + (Number(file.sizeBytes) || 0),
				0,
			) / ESTIMATED_FILE_TOKEN_BYTES,
		);
		return {
			textTokens,
			imageTokens,
			fileTokens,
			total: textTokens + imageTokens + fileTokens,
		};
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

	const getSceneEncounterForImagePrompt = (scene) => {
		const encounters = Array.isArray(scene?._imagePromptEncounters)
			? scene._imagePromptEncounters
			: [];
		if (scene?.encounterId) {
			return encounters.find(
				(encounter) => String(encounter.id) === String(scene.encounterId),
			);
		}
		if (Number.isInteger(scene?.encounterIndex)) {
			return encounters[scene.encounterIndex];
		}
		return null;
	};

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

	const loadCampaignImagePromptData = async () => {
		if (!initialRoute.campaign) return;

		const loadCampaignEntities = async (type, label) => {
			try {
				const entities = await api.getEntities(initialRoute.campaign, type);
				return Array.isArray(entities) ? entities : [];
			} catch (err) {
				console.error(`Failed to load ${label}`, err);
				return [];
			}
		};

		if (!imagePromptCampaignEntitiesLoadedRef.current) {
			const [characters, npcs, locations] = await Promise.all([
				loadCampaignEntities("characters", "characters"),
				loadCampaignEntities("npc", "NPCs"),
				loadCampaignEntities("locations", "locations"),
			]);
			setCharactersList(characters);
			setNpcsList(npcs);
			setLocationsList(locations);
			imagePromptCampaignEntitiesLoadedRef.current = true;
		}

		if (!isCampaign || imagePromptCampaignDataLoadedRef.current) return;
		const sessions =
			sessionsList.length > 0
				? sessionsList
				: await api.listSessions(initialRoute.campaign);
		if (sessionsList.length === 0) {
			setSessionsList(sessions);
		}
		const fullSessions = await Promise.all(
			sessions.map((session) =>
				api.getSession(initialRoute.campaign, session.fileName).catch((err) => {
					console.error("Failed to load session for image prompt", err);
					return null;
				}),
			),
		);
		setImagePromptSessions(fullSessions.filter(Boolean));
		imagePromptCampaignDataLoadedRef.current = true;
	};

	const loadBestiaryImagePromptData = async () => {
		if (imagePromptBestiaryDataLoadedRef.current) return;
		try {
			const data = await api.getCustomBestiaryData();
			const monsters = Array.isArray(data?.monster)
				? data.monster
				: Array.isArray(data?.monsters)
					? data.monsters
					: Array.isArray(data)
						? data
						: [];
			setImagePromptCustomMonsters(monsters);
		} catch (err) {
			console.error("Failed to load custom monsters for image prompt", err);
			setImagePromptCustomMonsters([]);
		}
		imagePromptBestiaryDataLoadedRef.current = true;
	};

	const openImagePromptPicker = async () => {
		setSelectedImagePromptTarget(null);
		setIsImagePromptContextMode(false);
		setImagePromptInstructions(activeImagePromptBasePrompt);
		setImagePromptRequest("");
		setIsImagePromptDataLoading(true);
		try {
			if (isBestiary) {
				await loadBestiaryImagePromptData();
			} else if (initialRoute.campaign) {
				await loadCampaignImagePromptData();
			}
		} finally {
			setIsImagePromptDataLoading(false);
			setIsImagePromptPickerOpen(true);
		}
	};

	const getImagePromptTargetTitle = (target) => {
		if (!target) return "";
		if (target.type === "scene" && target.sessionName) {
			return `${target.name} - ${target.sessionName}`;
		}
		return target.name || target.id || target.type || "";
	};

	const buildNpcImageTarget = (npc) => ({
		type: "npc",
		id: npc?.id || npc?.slug || "",
		name: getCharacterDisplayName(npc),
		race: npc?.race || "",
		class: npc?.class || "",
		level: npc?.level ?? "",
		description: npc?.description || "",
		motivation: npc?.motivation || "",
		trait: npc?.trait || "",
		notes: getEntityNotesForImagePrompt(npc),
		scope: isCampaign ? "campaign" : "session",
	});

	const buildLocationImageTarget = (location) => ({
		type: "location",
		id: location?.id || location?.slug || "",
		name: getLocationDisplayName(location),
		description: location?.description || "",
		notes: getEntityNotesForImagePrompt(location),
		scope: isCampaign ? "campaign" : "session",
	});

	const buildSceneImageTarget = (scene) => {
		const encounter = getSceneEncounterForImagePrompt(scene);
		return {
			type: "scene",
			id: scene?.id || "",
			name: getSceneImagePromptTitle(scene, scene?._imagePromptIndex || 0),
			sessionName: scene?._imagePromptSessionName || "",
			sessionFileName: scene?._imagePromptSessionFileName || "",
			texts: scene?.texts || {},
			notes: getEntityNotesForImagePrompt(scene),
			npcs: scene?.npcs || [],
			encounter: encounter
				? {
						name: encounter.name || "",
						monsters: (encounter.monsters || []).map(
							(monster) => monster.name || monster.monsterName,
						),
					}
				: null,
		};
	};

	const buildCustomMonsterImageTarget = (monster) => ({
		type: "custom-monster",
		id: monster?.name || "",
		name: monster?.name || "",
		source: monster?.source || "CUSTOM",
		size: monster?.size || "",
		creatureType: monster?.type || "",
		alignment: monster?.alignment || "",
		description: monster?.description || monster?.desc || "",
		trait: monster?.trait || [],
		actions: monster?.action || [],
		bonusActions: monster?.bonus || [],
		reactions: monster?.reaction || [],
		legendaryActions: monster?.legendary || [],
		cr: monster?.cr || "",
		ac: monster?.ac || "",
		hp: monster?.hp || "",
		speed: monster?.speed || "",
		abilities: {
			str: monster?.str ?? "",
			dex: monster?.dex ?? "",
			con: monster?.con ?? "",
			int: monster?.int ?? "",
			wis: monster?.wis ?? "",
			cha: monster?.cha ?? "",
		},
	});

	const openImagePromptForMonster = useCallback(
		(monster) => {
			if (!monster?.name) return;
			setSelectedImagePromptTarget(buildCustomMonsterImageTarget(monster));
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
			buildCustomMonsterImageTarget={buildCustomMonsterImageTarget}
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
		<div className="AiAssistant">
			<Tooltip className="AiAssistant__toggle" content={assistantTitle}>
				<button onClick={() => setIsOpen(true)}>
					<Icon name="wand" size={28} />
				</button>
			</Tooltip>

			{isOpen && (
				<Modal
					title={assistantTitle}
					className="AiAssistant__main_modal"
					onCancel={() => {
						if (loading) return;
						setIsOpen(false);
					}}
					showFooter={false}
					cancelDisabled={loading}
				>
					<div className="AiAssistant__content">
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

						<AiResponseModal
							generatedPrompt={generatedPrompt}
							generatedPromptRef={generatedPromptRef}
							isGeneratedPromptCopied={isGeneratedPromptCopied}
							isRestoringResponse={isRestoringResponse}
							markdownComponents={markdownMentionComponents}
							onApply={(entry = selectedResponseEntry) =>
								restoreAiHistoryEntry(entry, "apply")
							}
							onApplyResource={(entry = selectedResponseEntry, resourceIds) =>
								restoreAiHistoryEntry(entry, "apply", { resourceIds })
							}
							onCancel={closeGeneratedPrompt}
							onCopy={copyGeneratedPrompt}
							onSaveDraftChanges={(resources) =>
								saveDraftHistoryEntryChanges(selectedResponseEntry, resources)
							}
							onUndo={() =>
								restoreAiHistoryEntry(selectedResponseEntry, "undo")
							}
							onUndoResource={(entry = selectedResponseEntry, resourceIds) =>
								restoreAiHistoryEntry(entry, "undo", { resourceIds })
							}
							selectedResponseDetails={selectedResponseDetails}
							selectedResponseDiffResources={selectedResponseDiffResources}
							selectedResponseEntry={selectedResponseEntry}
							selectedResponseHasChanges={selectedResponseHasChanges}
							getDiffResourceState={getDiffResourceState}
							getHistoryChangeSummary={getHistoryChangeSummary}
						/>

						<div className="AiAssistant__prompt_area">
							<div className="AiAssistant__prompt_row">
								<div className="AiAssistant__prompt_column">
									<EditableField
										type="textarea"
										className="AiAssistant__prompt_input"
										placeholder={getPlaceholder()}
										value={userInstructions}
										onChange={(e) => setUserInstructions(e.target.value)}
										disabled={loading}
									/>
									<div
										className="AiAssistant__token_estimate"
										title={lang.t(
											"Approximate estimate. Actual token usage may differ.",
										)}
									>
										<span>
											{lang.t("Estimated request")}:{" "}
											<strong>{formattedTokenEstimate}</strong>{" "}
											{lang.t("tokens")}
										</span>
										<span>
											{lang.t("Text")}: {formattedTextTokenEstimate}
											{tokenEstimate.imageTokens > 0
												? `; ${lang.t("Images")}: ${formattedImageTokenEstimate}`
												: ""}
											{tokenEstimate.fileTokens > 0
												? `; ${lang.t("Files")}: ${formattedFileTokenEstimate}`
												: ""}
										</span>
									</div>
									<Button
										variant="create"
										className="AiAssistant__generate_btn"
										disabled={loading}
										onClick={() => generate()}
									>
										{loading
											? lang.t("AI is working, please wait...")
											: lang.t("Generate")}
									</Button>
									{canCancelGenerate && (
										<Button
											variant="danger"
											className="AiAssistant__cancel_btn"
											onClick={cancelGenerateRequest}
										>
											{lang.t("Cancel")}
										</Button>
									)}
								</div>
								<AiAttachmentControls
									attachedFiles={attachedFiles}
									attachedImages={attachedImages}
									campaignSlug={isBestiary ? "general" : initialRoute.campaign}
									disabled={loading}
									setAttachedFiles={setAttachedFiles}
									setAttachedImages={setAttachedImages}
								/>
							</div>
						</div>

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
					</div>
				</Modal>
			)}

			{imagePromptModal}

			{notification && (
				<Notification
					message={notification}
					onClose={() => setNotification(null)}
				/>
			)}
		</div>
	);
}
