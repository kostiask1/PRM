import {
	Children,
	cloneElement,
	createElement,
	isValidElement,
	useEffect,
	useRef,
	useState,
} from "react";
import { api } from "../api";
import { parseUrl } from "../utils/navigation";
import Button from "./form/Button";
import EditableField from "./form/EditableField";
import Icon from "./common/Icon";
import Modal from "./common/Modal";
import Notification from "./common/Notification";
import AiApiKeyPanel from "./ai/AiApiKeyPanel";
import AiAssistantToolbar from "./ai/AiAssistantToolbar";
import AiContextSettingsModal from "./ai/AiContextSettingsModal";
import AiImagePromptPickerModal from "./ai/AiImagePromptPickerModal";
import AiResponseHistory from "./ai/AiResponseHistory";
import AiResponseModal from "./ai/AiResponseModal";
import {
	alert,
	confirm,
	refreshEntitiesAction,
	requestCampaignsReloadAction,
} from "../actions/app";
import Tooltip from "./common/Tooltip";
import { useAppDispatch, useAppSelector } from "../store/appStore";
import { lang } from "../services/localization";
import { renderMentionText } from "../renderers/contentRenderer.jsx";
import {
	buildDiffResources,
	getDiffResourceState as getAiDiffResourceState,
} from "../utils/aiDiff.js";
import "../assets/components/AiAssistantPanel.css";

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

function getHistoryRequestText(entry) {
	return String(
		entry?.request?.userInstructions || entry?.userInstructions || "",
	).trim();
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
		options.responseParsing && options.entityScope
			? `${lang.t("AI entity scope")}: ${lang.t(
					options.entityScope === "campaign"
						? "Campaign scope"
						: "Session scope",
				)}`
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
		entityScope: options.entityScope || "campaign",
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
	const summary = entry?.changes?.summary || {};
	const total =
		Number(summary.total) || getHistoryChangeResources(entry).length || 0;
	if (!total) return "";
	const parts = [];
	if (summary.added) parts.push(`+${summary.added}`);
	if (summary.deleted) parts.push(`-${summary.deleted}`);
	if (summary.modified) parts.push(`~${summary.modified}`);
	return `${lang.t("Changes")}: ${parts.length ? parts.join(" ") : total}`;
}

function getAiResponseStateLabel(entry) {
	if (isFailedHistoryEntry(entry)) return lang.t("Failed");
	if (entry?.applyState === "draft") return lang.t("Draft");
	if (entry?.applyState === "applied") return lang.t("Applied");
	if (entry?.applyState === "undone") return lang.t("Undone");
	return "";
}

function getDiffResourceState(resource) {
	return getAiDiffResourceState(resource, {
		added: lang.t("Added"),
		deleted: lang.t("Deleted"),
		modified: lang.t("Modified"),
	});
}

export default function AiAssistantPanel({
	sessionName,
	sessionData,
	onInsertResult,
	bestiaryMode = false,
}) {
	const dispatch = useAppDispatch();
	const currentLanguage = useAppSelector(
		(state) => state.localization.language,
	);
	const imagePromptBasePrompt = useAppSelector(
		(state) => state.ui.imagePromptBasePrompt || "",
	);
	const initialRoute = parseUrl();
	const isBestiary = bestiaryMode || initialRoute.campaign === "bestiary";
	const isCampaign = !initialRoute.session && !isBestiary;
	const isEncounter = !!initialRoute.encounter;

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
	const [imagePromptInstructions, setImagePromptInstructions] = useState("");
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
	const [entityScope, setEntityScope] = useState(
		isBestiary ? "custom-bestiary" : isCampaign ? "campaign" : "session",
	);
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
	const [isRestoringResponse, setIsRestoringResponse] = useState(false);
	const activeGenerateControllerRef = useRef(null);
	const generatedPromptRef = useRef(null);
	const imagePromptCampaignDataLoadedRef = useRef(false);
	const imagePromptCampaignEntitiesLoadedRef = useRef(false);
	const imagePromptBestiaryDataLoadedRef = useRef(false);
	const [canCancelGenerate, setCanCancelGenerate] = useState(false);
	const [isGeneratedPromptCopied, setIsGeneratedPromptCopied] = useState(false);

	const cancelGenerateRequest = () => {
		activeGenerateControllerRef.current?.abort();
		activeGenerateControllerRef.current = null;
		setCanCancelGenerate(false);
	};

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
			(isContextModalOpen || isImagePromptPickerOpen) &&
			sessionsList.length === 0
		) {
			api.listSessions(initialRoute.campaign).then(setSessionsList);
		}
	}, [
		isBestiary,
		isContextModalOpen,
		isImagePromptPickerOpen,
		initialRoute.campaign,
		sessionsList.length,
	]);

	useEffect(() => {
		if (isBestiary) return;
		if (
			isImagePromptPickerOpen &&
			imagePromptCampaignEntitiesLoadedRef.current
		) {
			return;
		}
		if (!isContextModalOpen && !isImagePromptPickerOpen) return;

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
		isContextModalOpen,
		isImagePromptPickerOpen,
		initialRoute.campaign,
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
		if (!isOpen || !initialRoute.campaign) return;
		api
			.listAiResponses(initialRoute.campaign)
			.then((responses) => {
				setResponseHistory(Array.isArray(responses) ? responses : []);
			})
			.catch((err) => {
				console.error("Failed to load AI response history", err);
			});
	}, [isOpen, initialRoute.campaign]);

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
				initialRoute.campaign,
				entry.id,
			);
			setResponseHistory(Array.isArray(responses) ? responses : []);
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
			const responses = await api.clearAiResponses(initialRoute.campaign);
			setResponseHistory(Array.isArray(responses) ? responses : []);
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
		if (selectedResponseId === entry.id) {
			setSelectedResponseEntry(entry);
			setGeneratedPrompt(entry.text);
		}
	};

	const refreshAfterAiHistoryRestore = (result, entry) => {
		if (Array.isArray(result?.responses)) {
			setResponseHistory(result.responses);
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
		if (updated && typeof updated === "object" && onInsertResult) {
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
				onInsertResult(updated, {
					entityTypes: getHistoryChangedEntityTypes(nextEntry),
					trackUndo: false,
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
			const result = isUndo
				? await api.undoAiResponse(initialRoute.campaign, entry.id, {
						resourceIds: options.resourceIds,
					})
				: await api.applyAiResponse(initialRoute.campaign, entry.id, {
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
			initialRoute.campaign,
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

		if (canApplyDirectly && onInsertResult) {
			onInsertResult(data.updated, {
				entityTypes: generatedEntityTypes,
				generated: data.generated,
			});
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
		if (!canApplyDirectly && generatedEntityTypes.length > 0) {
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

		// Створюємо чисту копію конфігурації без важких даних сесій (data)
		// Сервер сам завантажить необхідні файли за потребою
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
					imagePromptBasePromptOverride,
					parseAIResponse: shouldParseResponse,
					generateCharacters: structuredEntityOptionsEnabled
						? generateCharacters
						: true,
					generateNpcs: structuredEntityOptionsEnabled
						? generateNpcs
						: true,
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
					entityScope: isBestiary
						? "custom-bestiary"
						: isCampaign
							? "campaign"
							: entityScope,
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
						? `[Статус: ${err.status}] ${err.message}`
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
				: Boolean(
						retryPayload.parseAIResponse || retryPayload.generateEncounters,
					);

		cancelGenerateRequest();
		const controller = new AbortController();
		activeGenerateControllerRef.current = controller;
		setCanCancelGenerate(true);
		setLoading(true);
		setError("");

		try {
			if (isFailedHistoryEntry(entry)) {
				const responses = await api.deleteAiResponse(
					initialRoute.campaign,
					entry.id,
				);
				setResponseHistory(Array.isArray(responses) ? responses : []);
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
						? `[Статус: ${err.status}] ${err.message}`
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
	const isResponseParsingLocked = isBestiary || generateEncounters;
	const isEntityScopeVisible = !isBestiary && !isCampaign && !isEncounter;
	const isCustomMonsterGenerationVisible =
		!isBestiary && !isCampaign && !isEncounter && generateEncounters;
	const entityScopeIsSession = entityScope !== "campaign";
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
		(a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "uk"),
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

	const generateImagePromptForTarget = (target) => {
		setIsImagePromptPickerOpen(false);
		generate("image", target.type === "scene" ? target.id || null : null, {
			imageTarget: target,
			imagePromptBasePromptOverride: imagePromptInstructions.trim(),
			userInstructionsOverride: "",
		});
		setSelectedImagePromptTarget(null);
		setImagePromptInstructions("");
	};

	const selectImagePromptTarget = (target) => {
		setSelectedImagePromptTarget(target);
		setImagePromptInstructions(imagePromptBasePrompt);
	};

	const closeImagePromptPicker = () => {
		setIsImagePromptPickerOpen(false);
		setSelectedImagePromptTarget(null);
		setImagePromptInstructions("");
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
				api
					.getSession(initialRoute.campaign, session.fileName)
					.catch((err) => {
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
		setImagePromptInstructions(imagePromptBasePrompt);
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

	useEffect(() => {
		if (isResponseParsingLocked && !parseAIResponse) {
			setParseAIResponse(true);
		}
	}, [isResponseParsingLocked, parseAIResponse]);

	useEffect(() => {
		return () => {
			cancelGenerateRequest();
		};
	}, []);

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
					onCancel={() => {
						setIsOpen(false);
					}}
					showFooter={false}
				>
					<div className="AiAssistant__content">
						<AiAssistantToolbar
							aiModels={aiModels}
							entityScopeIsSession={entityScopeIsSession}
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
							isEntityScopeVisible={isEntityScopeVisible}
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
							setEntityScope={setEntityScope}
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

						<AiImagePromptPickerModal
							buildCustomMonsterImageTarget={buildCustomMonsterImageTarget}
							buildLocationImageTarget={buildLocationImageTarget}
							buildNpcImageTarget={buildNpcImageTarget}
							buildSceneImageTarget={buildSceneImageTarget}
							customMonstersWithImages={imagePromptCustomMonstersWithImages}
							customMonstersWithoutImages={
								imagePromptCustomMonstersWithoutImages
							}
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
								setImagePromptInstructions(imagePromptBasePrompt);
							}}
							onCancel={closeImagePromptPicker}
							onGenerate={generateImagePromptForTarget}
							onInstructionsChange={setImagePromptInstructions}
							onModelChange={setSelectedModel}
							onSelectTarget={selectImagePromptTarget}
							selectedModel={selectedModel}
							selectedTarget={selectedImagePromptTarget}
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
							<EditableField
								type="textarea"
								className="AiAssistant__prompt_input"
								placeholder={getPlaceholder()}
								value={userInstructions}
								onChange={(e) => setUserInstructions(e.target.value)}
								disabled={loading}
							/>
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

						{error && <div className="AiAssistant__error">{error}</div>}

						<AiResponseHistory
							entries={responseHistory}
							currentLanguage={currentLanguage}
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

			{notification && (
				<Notification
					message={notification}
					onClose={() => setNotification(null)}
				/>
			)}
		</div>
	);
}
