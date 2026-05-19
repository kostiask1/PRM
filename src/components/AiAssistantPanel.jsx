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
import Input from "./form/Input";
import Modal from "./common/Modal";
import Select from "./form/Select";
import Checkbox from "./form/Checkbox";
import Notification from "./common/Notification";
import CollapseToggleButton from "./common/CollapseToggleButton";
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
import classNames from "../utils/classNames";
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
	"code",
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
		character?.slug || character?.id || getCharacterDisplayName(character) || "",
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
	const value = String(text || "").replace(/\s+/g, " ").trim();
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
		`${lang.t("Create characters")}: ${getOnOffLabel(options.characterGeneration)}`,
		`${lang.t("Create NPCs")}: ${getOnOffLabel(options.npcGeneration)}`,
		`${lang.t("Create locations/factions")}: ${getOnOffLabel(options.locationGeneration)}`,
		options.entityScope
			? `${lang.t("AI entity scope")}: ${lang.t(
					options.entityScope === "campaign"
						? "Campaign scope"
						: "Session scope",
				)}`
			: null,
		`${lang.t("Encounter generation")}: ${getOnOffLabel(options.encounterGeneration)}`,
		`${lang.t("Custom monster generation")}: ${getOnOffLabel(options.customMonsterGeneration)}`,
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

function getHistoryTitle(entry) {
	const requestText = getHistoryRequestText(entry);
	if (requestText) return requestText;
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
	const [imagePromptCustomMonsters, setImagePromptCustomMonsters] = useState([]);
	const [isImagePromptDataLoading, setIsImagePromptDataLoading] = useState(false);
	const [parseAIResponse, setParseAIResponse] = useState(isEncounter);
	const [generateCharacters, setGenerateCharacters] = useState(true);
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
			})
			.catch((err) => console.error("Failed to load campaign context", err));

		return () => {
			cancelled = true;
		};
	}, [isBestiary, isContextModalOpen, isImagePromptPickerOpen, initialRoute.campaign]);

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
		if (!isOpen || aiModels.length > 0) return;
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
	}, [isOpen, aiModels.length, selectedModel]);

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

	const restoreAiHistoryEntry = async (entry, mode) => {
		if (!entry?.id || isRestoringResponse) return;
		const isUndo = mode === "undo";
		const confirmed = await dispatch(
			confirm({
				title: isUndo
					? lang.t("Undo AI changes")
					: lang.t("Apply AI changes"),
				message: isUndo
					? lang.t(
							"Restore data to the state before this AI response? Newer edits in these resources may be overwritten.",
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
				? await api.undoAiResponse(initialRoute.campaign, entry.id)
				: await api.applyAiResponse(initialRoute.campaign, entry.id);
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

	const generate = async (
		type = null,
		targetSceneId = null,
		{
			forceParseAIResponse = null,
			imageTarget = null,
			userInstructionsOverride = null,
		} = {},
	) => {
		const requestType = isBestiary && type !== "image" ? "custom-monster" : type;
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
					parseAIResponse: shouldParseResponse,
					generateCharacters: !isEncounter && !isBestiary && generateCharacters,
					generateNpcs: !isEncounter && !isBestiary && generateNpcs,
					generateLocations: !isEncounter && !isBestiary && generateLocations,
					generateEncounters:
						requestType === "image"
							? false
							: !isCampaign && !isBestiary && generateEncounters,
					generateCustomMonsters:
						requestType !== "image" &&
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

			// Одразу оновлюємо стан в батьківському компоненті, бо в БД вже записано
			if (data.prompt) {
				const historyEntry = data.aiResponse || {
					id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
					text: data.prompt,
					createdAt: new Date().toISOString(),
				};
				upsertResponseHistoryEntry(historyEntry);
				showGeneratedPrompt(historyEntry);
			} else if (data.updated) {
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

				setUserInstructions(""); // Очищаємо поле після успіху
				setNotification(
					requestType === "custom-monster"
						? lang.t("Custom creatures saved.")
						: lang.t("AI changes applied successfully!"),
				);
				if (
					!canApplyDirectly &&
					generatedEntityTypes.length > 0
				) {
					dispatch(refreshEntitiesAction());
				}
				if (shouldParseResponse || isEncounter || isBestiary) {
					setIsOpen(false);
					setIsContextModalOpen(false);
					setIsImagePromptPickerOpen(false);
				}
			}
		} catch (err) {
			if (err?.name === "AbortError") {
				return;
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

	const getPlaceholder = () => {
		if (isBestiary) {
			return lang.t(
				"Describe the custom creature to create...",
			);
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

	const SCENE_FIELDS = [
		{ key: "summary", label: "Scene summary" },
		{ key: "goal", label: "Players' goal" },
		{ key: "stakes", label: "Stakes" },
		{ key: "location", label: "Location" },
		{ key: "notes", label: "Scene notes" },
		{ key: "encounter", label: "Encounter (monsters)" },
	];

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
	const selectedResponseDiffResources = buildDiffResources(selectedResponseEntry, {
		note: lang.t("Note"),
		scene: lang.t("Scene"),
		encounter: lang.t("Encounter"),
		creature: lang.t("Creature"),
	});
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
			userInstructionsOverride: imagePromptInstructions.trim(),
		});
		setSelectedImagePromptTarget(null);
		setImagePromptInstructions("");
	};

	const selectImagePromptTarget = (target) => {
		setSelectedImagePromptTarget(target);
		setImagePromptInstructions("");
	};

	const closeImagePromptPicker = () => {
		setIsImagePromptPickerOpen(false);
		setSelectedImagePromptTarget(null);
		setImagePromptInstructions("");
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

	const renderCampaignEntityContext = ({
		contextKey,
		context,
		contextItems,
		emptyLabel,
		getDisplayName,
		getKey,
		label,
		list,
	}) => (
		<>
			<div className="AiAssistant__context_row">
				<Checkbox
					checked={context.included !== false}
					onChange={(included) =>
						updateCampaignContextListIncluded(contextKey, included)
					}
					label={lang.t(label)}
				/>
			</div>
			{context.included !== false && (
				<div className="AiAssistant__location_context">
					<div className="AiAssistant__location_actions">
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							onClick={() =>
								setAllCampaignContextItems(contextKey, list, getKey, true)
							}
							disabled={list.length === 0}
						>
							{lang.t("All")}
						</Button>
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							onClick={() =>
								setAllCampaignContextItems(contextKey, list, getKey, false)
							}
							disabled={list.length === 0}
						>
							{lang.t("Clear")}
						</Button>
					</div>
					{list.length > 0 ? (
						list.map((item) => {
							const itemKey = getKey(item);
							if (!itemKey) return null;
							return (
								<div
									key={itemKey}
									className="AiAssistant__context_row AiAssistant__location_row"
								>
									<Checkbox
										checked={contextItems[itemKey] !== false}
										onChange={(val) =>
											updateCampaignContextListItem(contextKey, itemKey, val)
										}
										label={getDisplayName(item)}
									/>
								</div>
							);
						})
					) : (
						<div className="muted AiAssistant__empty_context">
							{lang.t(emptyLabel)}
						</div>
					)}
				</div>
			)}
		</>
	);

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
						<div className="AiAssistant__actions">
							<label className="AiAssistant__modelPicker">
								<Select
									className={classNames("AiAssistant__modelSelect", {
										"is_disabled": loading || aiModels.length === 0,
									})}
									disabled={loading || aiModels.length === 0}
									value={selectedModel}
									onChange={(event) => {
										if (loading || aiModels.length === 0) return;
										setSelectedModel(event.target.value);
									}}
								>
									{aiModels.length > 0 ? (
										aiModels.map((model) => (
											<option key={model.name} value={model.name}>
												{model.displayName || model.name}
											</option>
										))
									) : (
										<option key="loading" value="">
											{lang.t("Loading models...")}
										</option>
									)}
								</Select>
							</label>
							{!isBestiary && (
								<div
									className={classNames("AiAssistant__context_toggle", {
										"is_active": useContext,
									})}
								>
									<Checkbox
										checked={useContext}
										onChange={(val) => setUseContext(val)}
										title={
											useContext
												? lang.t("Disable context usage")
												: lang.t("Enable context usage")
										}
									/>
									<Button
										variant={useContext ? "primary" : "ghost"}
										size={Button.SIZES.SMALL}
										icon="database"
										onClick={() => setIsContextModalOpen(true)}
										disabled={loading}
										title={lang.t("Configure context details for AI")}
									>
										{lang.t("Context")}
									</Button>
								</div>
							)}
							{!isEncounter && (
								<Button
									variant="ghost"
									size={Button.SIZES.SMALL}
									icon="image"
									onClick={() => {
										setSelectedImagePromptTarget(null);
										setImagePromptInstructions("");
										setIsImagePromptPickerOpen(true);
									}}
									disabled={loading}
									title={lang.t("Choose an element to generate a prompt")}
								>
									{lang.t("Image prompt")}
								</Button>
							)}
							{!isBestiary && !isEncounter && (
								<>
									<Button
										variant={generateCharacters ? "primary" : "ghost"}
										size={Button.SIZES.SMALL}
										icon="users"
										onClick={() => setGenerateCharacters((prev) => !prev)}
										disabled={loading}
										title={lang.t("Create characters with AI")}
									>
										{lang.t("Create characters")}
									</Button>
									<Button
										variant={generateNpcs ? "primary" : "ghost"}
										size={Button.SIZES.SMALL}
										icon="folder-npc"
										onClick={() => setGenerateNpcs((prev) => !prev)}
										disabled={loading}
										title={lang.t("Create NPCs with AI")}
									>
										{lang.t("Create NPCs")}
									</Button>
									<Button
										variant={generateLocations ? "primary" : "ghost"}
										size={Button.SIZES.SMALL}
										icon="map"
										onClick={() => setGenerateLocations((prev) => !prev)}
										disabled={loading}
										title={lang.t("Create locations/factions with AI")}
									>
										{lang.t("Create locations/factions")}
									</Button>
									{isEntityScopeVisible && (
										<Button
											variant={entityScopeIsSession ? "primary" : "ghost"}
											size={Button.SIZES.SMALL}
											icon={entityScopeIsSession ? "file" : "database"}
											onClick={() =>
												setEntityScope((prev) =>
													prev === "campaign" ? "session" : "campaign",
												)
											}
											disabled={loading}
											title={
												entityScopeIsSession
													? lang.t(
															"AI will create NPCs and locations inside this session",
														)
													: lang.t(
															"AI will create NPCs and locations in the campaign",
														)
											}
										>
											{entityScopeIsSession
												? lang.t("Session scope")
												: lang.t("Campaign scope")}
										</Button>
									)}
								</>
							)}
							{!isBestiary && (
								<Button
									variant={
										parseAIResponse || isResponseParsingLocked
											? "primary"
											: "ghost"
									}
									size={Button.SIZES.SMALL}
									icon="list"
									onClick={() => {
										if (isResponseParsingLocked) return;
										setParseAIResponse(!parseAIResponse);
									}}
									disabled={loading || isResponseParsingLocked}
									title={
										generateEncounters
											? lang.t("Parsing is required when generating encounters")
											: parseAIResponse
												? lang.t("Parse AI response into form fields")
												: lang.t("Show response as text in a modal")
									}
								>
									{lang.t("Response parsing")}
								</Button>
							)}
							{!isBestiary && !isCampaign && (
								<Button
									variant={generateEncounters ? "primary" : "ghost"}
									size={Button.SIZES.SMALL}
									icon="swords"
									onClick={() => {
										const enabled = !generateEncounters;
										setGenerateEncounters(enabled);
										if (enabled) {
											setParseAIResponse(true);
										} else if (isEncounter) {
											setParseAIResponse(false);
										}
										if (!enabled) {
											setGenerateCustomMonsters(false);
										}
									}}
									disabled={loading}
									title={
										isEncounter
											? lang.t(
													"AI will update the current encounter with monsters based on character levels",
												)
											: lang.t(
													"AI will try to pick monsters for each scene based on character levels",
												)
									}
								>
									{lang.t("Encounter generation")}
								</Button>
							)}
							{isCustomMonsterGenerationVisible && (
								<Button
									variant={generateCustomMonsters ? "primary" : "ghost"}
									size={Button.SIZES.SMALL}
									icon="wand"
									onClick={() =>
										setGenerateCustomMonsters((enabled) => !enabled)
									}
									disabled={loading}
									title={lang.t(
										"AI may create custom creatures only when official monsters do not fit the scene",
									)}
								>
									{lang.t("Generate monsters")}
								</Button>
							)}
							{isEncounter && (
								<Button
									variant="ghost"
									size={Button.SIZES.SMALL}
									icon="wand"
									onClick={() =>
										generate("custom-monster", null, {
											forceParseAIResponse: true,
										})
									}
									disabled={loading}
									title={lang.t("Create custom creature")}
								>
									{lang.t("Create custom creature")}
								</Button>
							)}
						</div>
						{isApiKeyMissing && (
							<div className="AiAssistant__api_key_panel">
								<div className="AiAssistant__api_key_title">
									{lang.t("Gemini AI setup")}
								</div>
								<div className="AiAssistant__api_key_help">
									{lang.t(
										"Paste Gemini API key and it will be saved to the project .env file.",
									)}
								</div>
								<div className="AiAssistant__api_key_row">
									<Input
										type="password"
										value={apiKeyInput}
										placeholder={lang.t("Gemini API key")}
										onChange={(event) => setApiKeyInput(event.target.value)}
										onKeyDown={(event) => {
											if (event.key === "Enter") {
												handleSaveApiKey();
											}
										}}
										disabled={isSavingApiKey || loading}
									/>
									<Button
										variant="primary"
										icon="check"
										onClick={handleSaveApiKey}
										disabled={isSavingApiKey || loading || !apiKeyInput.trim()}
									>
										{isSavingApiKey ? lang.t("Saving...") : lang.t("Save")}
									</Button>
								</div>
							</div>
						)}
						{isContextModalOpen && (
							<Modal
								title={lang.t("Context settings")}
								onCancel={() => setIsContextModalOpen(false)}
								showFooter={false}
							>
								<div className="AiAssistant__context_manager">
									<section>
										<h4>{lang.t("Campaign")}</h4>
										<div className="AiAssistant__context_row">
											<Checkbox
												checked={contextConfig.campaignNotes}
												onChange={(val) =>
													setContextConfig((prev) => ({
														...prev,
														campaignNotes: val,
													}))
												}
												label={lang.t("Campaign notes")}
											/>
										</div>
										{renderCampaignEntityContext({
											contextKey: "campaignCharacters",
											context: characterContext,
											contextItems: characterContextItems,
											emptyLabel: "No characters yet.",
											getDisplayName: getCharacterDisplayName,
											getKey: getCharacterContextKey,
											label: "Characters",
											list: charactersList,
										})}
										{renderCampaignEntityContext({
											contextKey: "campaignNpcs",
											context: npcContext,
											contextItems: npcContextItems,
											emptyLabel: "No NPCs yet.",
											getDisplayName: getCharacterDisplayName,
											getKey: getCharacterContextKey,
											label: "NPCs",
											list: npcsList,
										})}
										{renderCampaignEntityContext({
											contextKey: "campaignLocations",
											context: locationContext,
											contextItems: locationContextItems,
											emptyLabel: "No locations/factions yet.",
											getDisplayName: getLocationDisplayName,
											getKey: getLocationContextKey,
											label: "Locations/Factions",
											list: locationsList,
										})}
									</section>

									<section>
										<h4>{lang.t("Sessions")}</h4>
										{sessionsList.map((session) => {
											const slug = session.fileName;
											const config = contextConfig.sessions[slug] || {
												included: false,
												notes: true,
												result_text: true,
												scenes: {},
											};
											const isExpanded = !!expandedSessions[slug];

											return (
												<div
													key={slug}
													className="AiAssistant__session_context"
												>
													<div className="AiAssistant__context_row">
														<Checkbox
															checked={config.included}
															onChange={(included) => {
																setContextConfig((prev) => ({
																	...prev,
																	sessions: {
																		...prev.sessions,
																		[slug]: { ...config, included },
																	},
																}));
															}}
															label={session.name}
															className="AiAssistant__session_name"
														/>
														<CollapseToggleButton
															size={Button.SIZES.SMALL}
															rotated={isExpanded}
															onClick={() => toggleSessionDetails(slug)}
														/>
													</div>
													{isExpanded && config.data && (
														<div className="AiAssistant__context_details">
															<div className="AiAssistant__context_row">
																<Checkbox
																	checked={config.notes}
																	onChange={(val) =>
																		updateContextConfig(
																			["sessions", slug, "notes"],
																			val,
																		)
																	}
																	label={lang.t("Notes")}
																/>
															</div>
															<div className="AiAssistant__context_row">
																<Checkbox
																	checked={config.result_text}
																	onChange={(val) =>
																		updateContextConfig(
																			["sessions", slug, "result_text"],
																			val,
																		)
																	}
																	label={lang.t("Summary")}
																/>
															</div>
															<div className="AiAssistant__scenes_context">
																{(config.data.scenes || []).map(
																	(scene, idx) => {
																		const sceneConf = config.scenes[
																			scene.id
																		] || {
																			included: true,
																			summary: true,
																			goal: true,
																			stakes: true,
																			location: true,
																			notes: true,
																			encounter: true,
																		};
																		return (
																			<div
																				key={scene.id}
																				className="AiAssistant__scene_item"
																			>
																				<div className="AiAssistant__context_row">
																					<Checkbox
																						checked={sceneConf.included}
																						onChange={(val) =>
																							updateContextConfig(
																								[
																									"sessions",
																									slug,
																									"scenes",
																									scene.id,
																									"included",
																								],
																								val,
																							)
																						}
																						label={lang.t("Scene {number}", {
																							number: idx + 1,
																						})}
																					/>
																				</div>
																				{sceneConf.included && (
																					<div className="AiAssistant__scene_fields">
																						{SCENE_FIELDS.map((f) => (
																							<Checkbox
																								key={f.key}
																								checked={sceneConf[f.key]}
																								onChange={(val) =>
																									updateContextConfig(
																										[
																											"sessions",
																											slug,
																											"scenes",
																											scene.id,
																											f.key,
																										],
																										val,
																									)
																								}
																								label={lang.t(f.label)}
																							/>
																						))}
																					</div>
																				)}
																			</div>
																		);
																	},
																)}
															</div>
														</div>
													)}
												</div>
											);
										})}
									</section>
								</div>
							</Modal>
						)}

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
							getSceneImagePromptDescription={
								getSceneImagePromptDescription
							}
							getSceneImagePromptTitle={getSceneImagePromptTitle}
							imagePromptInstructions={imagePromptInstructions}
							imagePromptLocations={imagePromptLocations}
							imagePromptNpcs={imagePromptNpcs}
							imagePromptScenes={imagePromptScenes}
							isBestiary={isBestiary}
							isCampaign={isCampaign}
							isDataLoading={isImagePromptDataLoading}
							isOpen={isImagePromptPickerOpen}
							loading={loading}
							onBackToSelection={() => {
								setSelectedImagePromptTarget(null);
								setImagePromptInstructions("");
							}}
							onCancel={closeImagePromptPicker}
							onGenerate={generateImagePromptForTarget}
							onInstructionsChange={setImagePromptInstructions}
							onSelectTarget={selectImagePromptTarget}
							selectedTarget={selectedImagePromptTarget}
						/>

						<AiResponseModal
							generatedPrompt={generatedPrompt}
							generatedPromptRef={generatedPromptRef}
							isGeneratedPromptCopied={isGeneratedPromptCopied}
							isRestoringResponse={isRestoringResponse}
							markdownComponents={markdownMentionComponents}
							onApply={() =>
								restoreAiHistoryEntry(selectedResponseEntry, "apply")
							}
							onCancel={closeGeneratedPrompt}
							onCopy={copyGeneratedPrompt}
							onUndo={() =>
								restoreAiHistoryEntry(selectedResponseEntry, "undo")
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
							onSelect={showGeneratedPrompt}
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
