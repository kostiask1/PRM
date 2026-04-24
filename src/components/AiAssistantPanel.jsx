import { useState, useEffect, useRef } from "react";
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
import {
	alert,
	refreshEntitiesAction,
	requestCampaignsReloadAction,
} from "../actions/app";
import Tooltip from "./common/Tooltip";
import classNames from "../utils/classNames";
import { useAppDispatch, useAppSelector } from "../store/appStore";
import { lang } from "../services/localization";
import "../assets/components/AiAssistantPanel.css";

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
	const [generateEncounters, setGenerateEncounters] = useState(false);
	const [aiModels, setAiModels] = useState([]);
	const [selectedModel, setSelectedModel] = useState("");
	const [sessionsList, setSessionsList] = useState([]);
	const [expandedSessions, setExpandedSessions] = useState({});
	const [contextConfig, setContextConfig] = useState(() => ({
		campaignNotes: true,
		campaignCharacters: true,
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
	const [assistantMode, setAssistantMode] = useState("content");
	const activeGenerateControllerRef = useRef(null);
	const [canCancelGenerate, setCanCancelGenerate] = useState(false);

	const cancelGenerateRequest = () => {
		activeGenerateControllerRef.current?.abort();
		activeGenerateControllerRef.current = null;
		setCanCancelGenerate(false);
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
		const requestPath =
			type === "character" || type === "npc"
				? {
						campaign: initialRoute.campaign,
						session: null,
						encounter: null,
					}
				: initialRoute;

		try {
			const data = await api.generateAi(
				{
					type,
					modelName: selectedModel || undefined,
					userInstructions,
					path: requestPath,
					sceneId: targetSceneId,
					parseAIResponse: shouldParseResponse,
					generateEncounters:
						type === "character" || type === "npc"
							? false
							: !isCampaign && generateEncounters,
					contextConfig: useContext ? configToSend : null,
					language: currentLanguage,
				},
				{ signal: controller.signal },
			);

			// Одразу оновлюємо стан в батьківському компоненті, бо в БД вже записано
			if (data.prompt) {
				setGeneratedPrompt(data.prompt);
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
				if (type === "character" || type === "npc") {
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
		if (assistantMode === "character") {
			return lang.t(
				"Describe what characters to create (count, role in story, race/class, motivation, key traits)...",
			);
		}
		if (assistantMode === "npc") {
			return lang.t(
				"Describe what NPCs to create (count, function in scene, personality, goals, secrets)...",
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

	const isCharacterCreationMode = assistantMode === "character";
	const isNpcCreationMode = assistantMode === "npc";
	const isEntityCreationMode = isCharacterCreationMode || isNpcCreationMode;
	const generationType = isCharacterCreationMode
		? "character"
		: isNpcCreationMode
			? "npc"
			: null;

	useEffect(() => {
		if (isEntityCreationMode && !parseAIResponse) {
			setParseAIResponse(true);
		}
	}, [isEntityCreationMode, parseAIResponse]);

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
										variant={isCharacterCreationMode ? "primary" : "ghost"}
										size={Button.SIZES.SMALL}
										icon="users"
										onClick={() =>
											setAssistantMode((prev) =>
												prev === "character" ? "content" : "character",
											)
										}
										disabled={loading}
										title={lang.t("Create characters with AI")}
									>
										{lang.t("Create characters")}
									</Button>
									<Button
										variant={isNpcCreationMode ? "primary" : "ghost"}
										size={Button.SIZES.SMALL}
										icon="folder-npc"
										onClick={() =>
											setAssistantMode((prev) =>
												prev === "npc" ? "content" : "npc",
											)
										}
										disabled={loading}
										title={lang.t("Create NPCs with AI")}
									>
										{lang.t("Create NPCs")}
									</Button>
								</>
							)}
							<Button
								variant={
									parseAIResponse || isEntityCreationMode ? "primary" : "ghost"
								}
								size={Button.SIZES.SMALL}
								icon="list"
								onClick={() => {
									if (isEntityCreationMode) return;
									setParseAIResponse(!parseAIResponse);
								}}
								disabled={loading || isEncounter || isEntityCreationMode}
								title={
									isEntityCreationMode
										? lang.t(
												"Parsing is required when creating characters or NPCs",
											)
										: parseAIResponse
										? lang.t("Parse AI response into form fields")
										: lang.t("Show response as text in a modal")
								}
							>
								{lang.t("Response parsing")}
							</Button>
							{!isCampaign &&
								(parseAIResponse || isEncounter) &&
								!isEntityCreationMode && (
								<Button
									variant={generateEncounters ? "primary" : "ghost"}
									size={Button.SIZES.SMALL}
									icon="swords"
									onClick={() => setGenerateEncounters(!generateEncounters)}
									disabled={loading || isEncounter}
									title={lang.t(
										"AI will try to pick monsters for each scene based on character levels",
									)}
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
								confirmLabel={lang.t("Close")}
								onCancel={() => setGeneratedPrompt(null)}
								onConfirm={() => setGeneratedPrompt(null)}
							>
								<EditableField
									type="textarea"
									value={generatedPrompt}
									onChange={(e) => setGeneratedPrompt(e.target.value)}
									showCopyButton={true}
									className="AiAssistant__prompt-result"
								/>
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
								onClick={() =>
									generate(generationType, null, {
										forceParseAIResponse: generationType ? true : null,
									})
								}
							>
								{loading
									? lang.t("AI is working, please wait...")
									: isCharacterCreationMode
										? lang.t("Create characters")
									: isNpcCreationMode
											? lang.t("Create NPCs")
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
