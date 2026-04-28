import {
	Children,
	cloneElement,
	createElement,
	isValidElement,
	useEffect,
	useRef,
	useState,
} from "react";
import ReactMarkdown from "react-markdown";
import { api } from "../api";
import { parseUrl } from "../utils/navigation";
import Button from "./form/Button";
import Icon from "./common/Icon";
import Input from "./form/Input";
import Modal from "./common/Modal";
import Select from "./form/Select";
import Checkbox from "./form/Checkbox";
import Notification from "./common/Notification";
import CollapseToggleButton from "./common/CollapseToggleButton";
import ListCard from "./common/ListCard";
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
import { renderMentionText } from "../utils/parser.jsx";
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
		`${lang.t("Encounter generation")}: ${getOnOffLabel(options.encounterGeneration)}`,
		`${lang.t("Context")}: ${getOnOffLabel(options.contextEnabled)}`,
	].join("; ");
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

export default function AiAssistantPanel({ sessionData, onInsertResult }) {
	const dispatch = useAppDispatch();
	const currentLanguage = useAppSelector(
		(state) => state.localization.language,
	);
	const initialRoute = parseUrl();
	const isCampaign = !initialRoute.session;
	const isEncounter = !!initialRoute.encounter;

	const [isOpen, setIsOpen] = useState(false);
	const [isContextModalOpen, setIsContextModalOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [useContext, setUseContext] = useState(true);
	const [error, setError] = useState("");
	const [userInstructions, setUserInstructions] = useState("");
	const [notification, setNotification] = useState(null);
	const [showSceneSelector, setShowSceneSelector] = useState(false);
	const [parseAIResponse, setParseAIResponse] = useState(isEncounter);
	const [generateCharacters, setGenerateCharacters] = useState(true);
	const [generateNpcs, setGenerateNpcs] = useState(true);
	const [generateLocations, setGenerateLocations] = useState(true);
	const [generateEncounters, setGenerateEncounters] = useState(!isCampaign);
	const [aiModels, setAiModels] = useState([]);
	const [selectedModel, setSelectedModel] = useState("");
	const [sessionsList, setSessionsList] = useState([]);
	const [locationsList, setLocationsList] = useState([]);
	const [expandedSessions, setExpandedSessions] = useState({});
	const [contextConfig, setContextConfig] = useState(() => ({
		campaignNotes: true,
		campaignCharacters: true,
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

	const showApiKeyInstructions = () => {
		dispatch(
			alert({
				title: lang.t("Gemini AI setup"),
				message:
					`${lang.t("To use AI features, configure an API key:")}\n\n` +
					`1. ${lang.t("Get a free key in Google AI Studio (aistudio.google.com).")}\n` +
					`2. ${lang.t("Create a .env file in the project root.")}\n` +
					`3. ${lang.t("Add this line: GEMINI_API_KEY=your_key")}\n` +
					`${lang.t("After that, AI features will be available.")}`,
			}),
		);
	};

	useEffect(() => {
		if (isContextModalOpen && sessionsList.length === 0) {
			api.listSessions(initialRoute.campaign).then(setSessionsList);
		}
	}, [isContextModalOpen, initialRoute.campaign, sessionsList.length]);

	useEffect(() => {
		if (!isContextModalOpen) return;

		let cancelled = false;
		api
			.getEntities(initialRoute.campaign, "locations")
			.then((locations) => {
				if (!cancelled) {
					setLocationsList(Array.isArray(locations) ? locations : []);
				}
			})
			.catch((err) => {
				console.error("Failed to load locations", err);
				if (!cancelled) setLocationsList([]);
			});

		return () => {
			cancelled = true;
		};
	}, [isContextModalOpen, initialRoute.campaign]);

	useEffect(() => {
		if (locationsList.length === 0) return;

		setContextConfig((prev) => {
			const current = prev.campaignLocations || {
				included: true,
				items: {},
			};
			const currentItems = current.items || {};
			const nextItems = { ...currentItems };
			let changed = !prev.campaignLocations || !current.items;

			for (const location of locationsList) {
				const key = getLocationContextKey(location);
				if (!key || Object.prototype.hasOwnProperty.call(nextItems, key)) {
					continue;
				}
				nextItems[key] = true;
				changed = true;
			}

			if (!changed) return prev;
			return {
				...prev,
				campaignLocations: {
					included: current.included !== false,
					items: nextItems,
				},
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
		if (!isOpen) return;
		api
			.listAiResponses()
			.then((responses) => {
				setResponseHistory(Array.isArray(responses) ? responses : []);
			})
			.catch((err) => {
				console.error("Failed to load AI response history", err);
			});
	}, [isOpen]);

	const deleteResponseHistoryEntry = async (entry) => {
		const confirmed = await dispatch(
			confirm({
				title: lang.t("Delete response"),
				message: lang.t("Delete this AI response?"),
			}),
		);
		if (!confirmed) return;

		try {
			const responses = await api.deleteAiResponse(entry.id);
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
			const responses = await api.clearAiResponses();
			setResponseHistory(Array.isArray(responses) ? responses : []);
			closeGeneratedPrompt();
		} catch (err) {
			dispatch(alert({ title: lang.t("Delete error"), message: err.message }));
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

	const setAllLocationContextItems = (checked) => {
		const items = Object.fromEntries(
			locationsList
				.map((location) => getLocationContextKey(location))
				.filter(Boolean)
				.map((key) => [key, checked]),
		);

		setContextConfig((prev) => ({
			...prev,
			campaignLocations: {
				included: true,
				items,
			},
		}));
	};

	const generate = async (
		type = null,
		targetSceneId = null,
		{ forceParseAIResponse = null } = {},
	) => {
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
			type === "image"
				? false
				: forceParseAIResponse === null
					? parseAIResponse
					: forceParseAIResponse;
		try {
			const data = await api.generateAi(
				{
					type,
					modelName: selectedModel || undefined,
					userInstructions,
					path: initialRoute,
					sceneId: targetSceneId,
					parseAIResponse: shouldParseResponse,
					generateCharacters: !isEncounter && generateCharacters,
					generateNpcs: !isEncounter && generateNpcs,
					generateLocations: !isEncounter && generateLocations,
					generateEncounters: !isCampaign && generateEncounters,
					contextConfig: useContext ? configToSend : null,
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
				setResponseHistory((prev) => [
					historyEntry,
					...prev.filter((entry) => entry.id !== historyEntry.id),
				]);
				showGeneratedPrompt(historyEntry);
			} else if (data.updated) {
				const updatedIsSessionLike =
					data.updated &&
					typeof data.updated === "object" &&
					data.updated.data &&
					typeof data.updated.data === "object";
				const canApplyDirectly =
					(isCampaign && !updatedIsSessionLike) ||
					(!isCampaign && updatedIsSessionLike);

				if (canApplyDirectly && onInsertResult) {
					onInsertResult(data.updated);
				} else {
					dispatch(requestCampaignsReloadAction());
				}

				setUserInstructions(""); // Очищаємо поле після успіху
				setNotification(lang.t("AI changes applied successfully!"));
				if (
					Array.isArray(data.generated?.characters) ||
					Array.isArray(data.generated?.npcs) ||
					Array.isArray(data.generated?.locations)
				) {
					dispatch(refreshEntitiesAction());
				}
				if (shouldParseResponse || isEncounter) {
					setIsOpen(false);
					setIsContextModalOpen(false);
					setShowSceneSelector(false);
				}
			}
		} catch (err) {
			if (err?.name === "AbortError") {
				return;
			}

			if (err.message?.includes("GEMINI_API_KEY")) {
				showApiKeyInstructions();
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

	const locationContext = contextConfig.campaignLocations || {
		included: true,
		items: {},
	};
	const locationContextItems = locationContext.items || {};
	const selectedResponseDetails = getHistoryDetailRows(
		selectedResponseEntry,
		currentLanguage,
	);
	const isResponseParsingLocked = generateEncounters;

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
			{/* Кнопка виклику AI, аналогічно до DiceCalculator */}
			<Tooltip
				className="AiAssistant__toggle"
				content={
					isCampaign
						? lang.t("AI Story Assistant")
						: isEncounter
							? lang.t("AI Encounter Assistant")
							: lang.t("AI Session Assistant")
				}
			>
				<button onClick={() => setIsOpen(true)}>
					<Icon name="wand" size={28} />
				</button>
			</Tooltip>

			{isOpen && (
				<Modal
					title={
						isCampaign
							? lang.t("AI Story Assistant")
							: isEncounter
								? lang.t("AI Encounter Assistant")
								: lang.t("AI Session Assistant")
					}
					onCancel={() => {
						cancelGenerateRequest();
						setIsOpen(false);
					}}
					showFooter={false}
				>
					<div className="AiAssistant__content">
						<div className="AiAssistant__actions">
							<label className="AiAssistant__modelPicker">
								<Select
									className={classNames("AiAssistant__modelSelect", {
										"is-disabled": loading || aiModels.length === 0,
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
							<div
								className={classNames("AiAssistant__context-toggle", {
									"is-active": useContext,
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
							{!isCampaign && (
								<Button
									variant="ghost"
									size={Button.SIZES.SMALL}
									icon="image"
									onClick={() => setShowSceneSelector(true)}
									disabled={loading || !sessionData.scenes?.length}
									title={lang.t("Generate visual prompt for a scene")}
								>
									{lang.t("Image prompt")}
								</Button>
							)}
							{!isEncounter && (
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
								</>
							)}
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
							{!isCampaign && (
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
						</div>
						{isContextModalOpen && (
							<Modal
								title={lang.t("Context settings")}
								onCancel={() => setIsContextModalOpen(false)}
								showFooter={false}
							>
								<div className="AiAssistant__context-manager">
									<section>
										<h4>{lang.t("Campaign")}</h4>
										<div className="AiAssistant__context-row">
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
										<div className="AiAssistant__context-row">
											<Checkbox
												checked={contextConfig.campaignCharacters}
												onChange={(val) =>
													setContextConfig((prev) => ({
														...prev,
														campaignCharacters: val,
													}))
												}
												label={lang.t("Characters")}
											/>
										</div>
										<div className="AiAssistant__context-row">
											<Checkbox
												checked={locationContext.included !== false}
												onChange={(included) =>
													setContextConfig((prev) => ({
														...prev,
														campaignLocations: {
															...(prev.campaignLocations || { items: {} }),
															included,
														},
													}))
												}
												label={lang.t("Locations/Factions")}
											/>
										</div>
										{locationContext.included !== false && (
											<div className="AiAssistant__location-context">
												<div className="AiAssistant__location-actions">
													<Button
														variant="ghost"
														size={Button.SIZES.SMALL}
														onClick={() => setAllLocationContextItems(true)}
														disabled={locationsList.length === 0}
													>
														{lang.t("All")}
													</Button>
													<Button
														variant="ghost"
														size={Button.SIZES.SMALL}
														onClick={() => setAllLocationContextItems(false)}
														disabled={locationsList.length === 0}
													>
														{lang.t("Clear")}
													</Button>
												</div>
												{locationsList.length > 0 ? (
													locationsList.map((location) => {
														const locationKey = getLocationContextKey(location);
														if (!locationKey) return null;
														return (
															<div
																key={locationKey}
																className="AiAssistant__context-row AiAssistant__location-row"
															>
																<Checkbox
																	checked={
																		locationContextItems[locationKey] !== false
																	}
																	onChange={(val) =>
																		updateContextConfig(
																			[
																				"campaignLocations",
																				"items",
																				locationKey,
																			],
																			val,
																		)
																	}
																	label={getLocationDisplayName(location)}
																/>
															</div>
														);
													})
												) : (
													<div className="muted AiAssistant__empty-context">
														{lang.t("No locations/factions yet.")}
													</div>
												)}
											</div>
										)}
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
													className="AiAssistant__session-context"
												>
													<div className="AiAssistant__context-row">
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
															className="AiAssistant__session-name"
														/>
														<CollapseToggleButton
															size={Button.SIZES.SMALL}
															rotated={isExpanded}
															onClick={() => toggleSessionDetails(slug)}
														/>
													</div>
													{isExpanded && config.data && (
														<div className="AiAssistant__context-details">
															<div className="AiAssistant__context-row">
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
															<div className="AiAssistant__context-row">
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
															<div className="AiAssistant__scenes-context">
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
																				className="AiAssistant__scene-item"
																			>
																				<div className="AiAssistant__context-row">
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
																					<div className="AiAssistant__scene-fields">
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

						{showSceneSelector && (
							<Modal
								title={lang.t("Choose a scene to generate a prompt")}
								onCancel={() => setShowSceneSelector(false)}
								showFooter={false}
							>
								<div className="AiAssistant__scene-list">
									{(sessionData.scenes || []).map((scene, idx) => (
										<div
											key={scene.id}
											className="AiAssistant__scene-option"
											onClick={() => {
												setShowSceneSelector(false);
												generate("image", scene.id);
											}}
										>
											<strong>
												{lang.t("Scene {number}", { number: idx + 1 })}
											</strong>
											:{" "}
											{scene.texts?.summary?.slice(0, 60) ||
												lang.t("No description")}
											...
										</div>
									))}
								</div>
							</Modal>
						)}

						{generatedPrompt && (
							<Modal
								title={lang.t("Response")}
								onCancel={closeGeneratedPrompt}
								showFooter={false}
							>
								<div className="AiAssistant__prompt-result-wrap">
									<div className="AiAssistant__prompt-result-actions">
										<Button
											variant="ghost"
											size={Button.SIZES.SMALL}
											icon={isGeneratedPromptCopied ? "check" : "copy"}
											onClick={copyGeneratedPrompt}
											title={lang.t("Copy formatted text for Word")}
										/>
									</div>
									<div
										className="AiAssistant__prompt-result"
										ref={generatedPromptRef}
									>
										<ReactMarkdown components={markdownMentionComponents}>
											{generatedPrompt}
										</ReactMarkdown>
									</div>
									{selectedResponseDetails.length > 0 && (
										<div className="AiAssistant__response-details">
											<div className="AiAssistant__response-details-title">
												{lang.t("Request details")}
											</div>
											{selectedResponseDetails.map((row) => (
												<div
													key={row.label}
													className="AiAssistant__response-details-row"
												>
													<span className="AiAssistant__response-details-label">
														{row.label}
													</span>
													<span className="AiAssistant__response-details-value">
														{row.value}
													</span>
												</div>
											))}
										</div>
									)}
								</div>
							</Modal>
						)}

						<div className="AiAssistant__prompt-area">
							<Input
								type="textarea"
								className="AiAssistant__prompt-input"
								placeholder={getPlaceholder()}
								value={userInstructions}
								onChange={(e) => setUserInstructions(e.target.value)}
								disabled={loading}
							/>
							<Button
								variant="create"
								className="AiAssistant__generate-btn"
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
									className="AiAssistant__cancel-btn"
									onClick={cancelGenerateRequest}
								>
									{lang.t("Cancel")}
								</Button>
							)}
						</div>

						{error && <div className="AiAssistant__error">{error}</div>}

						{responseHistory.length > 0 && (
							<section className="AiAssistant__response-history">
								<div className="AiAssistant__response-history-header">
									<h4>{lang.t("Response history")}</h4>
									<Button
										variant="ghost"
										size={Button.SIZES.SMALL}
										icon="trash"
										onClick={clearResponseHistory}
										title={lang.t("Clear response history")}
									>
										{lang.t("Clear")}
									</Button>
								</div>
								<div className="AiAssistant__response-history-list">
									{responseHistory.map((entry) => {
										const responsePreview = getResponsePreview(entry.text);
										return (
											<ListCard
												key={entry.id}
												onClick={() => showGeneratedPrompt(entry)}
												className="AiAssistant__history-card"
												actions={
													<Button
														variant="ghost"
														size={Button.SIZES.SMALL}
														icon="trash"
														onClick={() => deleteResponseHistoryEntry(entry)}
														title={lang.t("Delete response")}
													/>
												}
											>
												<div className="ListCard__title AiAssistant__history-title">
													{responsePreview || lang.t("AI response")}
												</div>
												<div className="ListCard__meta AiAssistant__history-meta">
													<span>
														{formatResponseDate(
															entry.createdAt,
															currentLanguage,
														)}
													</span>
												</div>
											</ListCard>
										);
									})}
								</div>
							</section>
						)}
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
