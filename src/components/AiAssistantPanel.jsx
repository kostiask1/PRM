import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "../api";
import { isJsonString } from "../utils/json";
import { parseUrl } from "../utils/navigation";
import Button from "./Button";
import ClickToCopy from "./ClickToCopy";
import Icon from "./Icon";
import Input from "./Input";
import Modal from "./Modal";
import Checkbox from "./Checkbox";
import Notification from "./Notification";
import "../assets/components/AiAssistantPanel.css";

export default function AiAssistantPanel({
	sessionData,
	onInsertResult,
	modal,
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [isContextModalOpen, setIsContextModalOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [userInstructions, setUserInstructions] = useState("");
	const [notification, setNotification] = useState(null);
	const [showSceneSelector, setShowSceneSelector] = useState(false);
	const [parseAIResponse, setParseAIResponse] = useState(false);
	const [generateEncounters, setGenerateEncounters] = useState(false);
	const [sessionsList, setSessionsList] = useState([]);
	const [expandedSessions, setExpandedSessions] = useState({});
	const [contextConfig, setContextConfig] = useState({
		campaignNotes: true,
		campaignCharacters: true,
		sessions: {}, // { [slug]: { included: bool, notes: bool, result_text: bool, scenes: {}, data: {} } }
	});
	const [generatedPrompt, setGeneratedPrompt] = useState(null);
	const initialRoute = parseUrl();

	const isCampaign = !initialRoute.session;

	const showApiKeyInstructions = () => {
		modal.alert(
			"Налаштування Gemini AI",
			`Для використання функцій ШІ необхідно налаштувати API ключ:\n\n` +
				`1. Отримайте безкоштовний ключ у Google AI Studio (aistudio.google.com).\n` +
				`2. Створіть файл .env у кореневій папці проекту.\n` +
				`3. Додайте в нього рядок: GEMINI_API_KEY=ваш_ключ\n` +
				`Після цього магія ШІ стане доступною!`,
		);
	};

	useEffect(() => {
		if (isContextModalOpen && sessionsList.length === 0) {
			api.listSessions(initialRoute.campaign).then(setSessionsList);
		}
	}, [isContextModalOpen, initialRoute.campaign, sessionsList.length]);

	const toggleSessionDetails = async (sessionSlug) => {
		const isExpanded = !!expandedSessions[sessionSlug];
		if (!isExpanded && !contextConfig.sessions[sessionSlug]?.data) {
			setLoading(true);
			try {
				const fullData = await api.getSession(initialRoute.campaign, sessionSlug);
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
						current[path[i]] = { included: true, summary: true, goal: true, stakes: true, location: true, encounter: true };
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

	const generate = async (type = null, targetSceneId = null) => {
		setLoading(true);
		setError("");

		// Створюємо чисту копію конфігурації без важких даних сесій (data)
		// Сервер сам завантажить необхідні файли за потребою
		const configToSend = JSON.parse(JSON.stringify(contextConfig));
		if (configToSend.sessions) {
			Object.keys(configToSend.sessions).forEach(slug => {
				delete configToSend.sessions[slug].data;
			});
		}

		try {
			const data = await api.generateAi({
				type,
				userInstructions,
				path: initialRoute,
				sceneId: targetSceneId,
				parseAIResponse: type === "image" ? false : parseAIResponse,
				generateEncounters: !isCampaign && generateEncounters,
				contextConfig: configToSend,
			});

			// Одразу оновлюємо стан в батьківському компоненті, бо в БД вже записано
			if (data.prompt) {
				setGeneratedPrompt(data.prompt);
			} else if (data.updated && onInsertResult) {
				onInsertResult(data.updated);
				setUserInstructions(""); // Очищаємо поле після успіху
				setNotification("Магія ШІ успішно застосована!");
			}
		} catch (err) {
			if (err.message?.includes("GEMINI_API_KEY")) {
				showApiKeyInstructions();
				return;
			}

			setError(err.message || "Не вдалося зв’язатися з AI.");
			modal.alert("Помилка ШІ", err.message, err.status);
		} finally {
			setLoading(false);
		}
	};

	const getPlaceholder = () => {
		if (!parseAIResponse) {
			return "Надішліть свій запит. Відповідь буде отримана у вікні і не вплине на дані";
		} else if (isCampaign) {
			return "Опишіть зміни або нові гілки сюжету (наприклад: 'додай політичні інтриги' або 'зроби фінал більш епічним')...";
		} else {
			return "Опишіть стиль або умови (наприклад: 'занедбане підземне місто', 'атмосфера детективу')...";
		}
	};

	const SCENE_FIELDS = [
		{ key: "summary", label: "Суть сцени" },
		{ key: "goal", label: "Мета гравців" },
		{ key: "stakes", label: "Ставки" },
		{ key: "location", label: "Локація" },
		{ key: "encounter", label: "Енкаунтер (монстри)" },
	];

	const isResultJSONString = isJsonString(generatedPrompt);

	return (
		<div className="AiAssistant">
			{/* Кнопка виклику AI, аналогічно до DiceCalculator */}
			<button
				className="AiAssistant__toggle"
				onClick={() => setIsOpen(true)}
				title={isCampaign ? "AI Сюжетний Помічник" : "AI Помічник Сесії"}
			>
				<Icon name="wand" size={28} />
			</button>

			{isOpen && (
				<Modal
					title={isCampaign ? "AI Сюжетний Помічник" : "AI Помічник Сесії"}
					onCancel={() => setIsOpen(false)}
					showFooter={false}
				>
					<div className="AiAssistant__content">
						<div className="AiAssistant__actions">
							<Button 
								variant="primary"
								size="small"
								icon="database"
								onClick={() => setIsContextModalOpen(true)}
								disabled={loading}
								title="Налаштувати контекст для ШІ">
								Контекст
							</Button>
							{!isCampaign && (
								<Button
									variant="ghost"
									size="small"
									icon="image"
									onClick={() => setShowSceneSelector(true)}
									disabled={loading || !sessionData.scenes?.length}
									title="Згенерувати візуальний опис для сцени">
									Промпт для фото
								</Button>
							)}
							<Button
								variant={parseAIResponse ? "primary" : "ghost"}
								size="small"
								icon="list"
								onClick={() => setParseAIResponse(!parseAIResponse)}
								disabled={loading}
								title={
									parseAIResponse
										? "Парсити відповідь ШІ у поля форми"
										: "Показувати відповідь текстом у модальному вікні"
								}>
								Парсинг відповіді
							</Button>
							{!isCampaign && parseAIResponse && (
								<Button
									variant={generateEncounters ? "primary" : "ghost"}
									size="small"
									icon="swords"
									onClick={() => setGenerateEncounters(!generateEncounters)}
									disabled={loading}
									title="ШІ спробує підібрати монстрів для кожної сцени на основі рівня персонажів"
								>
									Генерація боїв
								</Button>
							)}
						</div>

						{isContextModalOpen && (
							<Modal
								title="Налаштування контексту"
								onCancel={() => setIsContextModalOpen(false)}
								onConfirm={() => setIsContextModalOpen(false)}
								confirmLabel="Зберегти">
								<div className="AiAssistant__context-manager">
									<section>
										<h4>Кампанія</h4>
										<div className="AiAssistant__context-row">
											<Checkbox
												checked={contextConfig.campaignNotes}
												onChange={(val) => setContextConfig((prev) => ({ ...prev, campaignNotes: val }))}
												label="Нотатки кампанії"
											/>
										</div>
										<div className="AiAssistant__context-row">
											<Checkbox
												checked={contextConfig.campaignCharacters}
												onChange={(val) => setContextConfig((prev) => ({ ...prev, campaignCharacters: val }))}
												label="Персонажі"
											/>
										</div>
									</section>

									<section>
										<h4>Сесії</h4>
										{sessionsList.map((session) => {
											const slug = session.fileName;
											const config = contextConfig.sessions[slug] || { included: false, notes: true, result_text: true, scenes: {} };
											const isExpanded = !!expandedSessions[slug];

											return (
												<div key={slug} className="AiAssistant__session-context">
													<div className="AiAssistant__context-row">
														<Checkbox
															checked={config.included}
															onChange={(included) => {
																setContextConfig((prev) => ({
																	...prev,
																	sessions: { ...prev.sessions, [slug]: { ...config, included } },
																}));
															}}
															label={session.name}
															className="AiAssistant__session-name"
														/>
														<Button
															icon="chevron"
															variant="ghost"
															size="small"
															className={isExpanded ? "is-rotated" : ""}
															onClick={() => toggleSessionDetails(slug)}
														/>
													</div>
													{isExpanded && config.data && (
														<div className="AiAssistant__context-details">
															<div className="AiAssistant__context-row">
																<Checkbox
																	checked={config.notes}
																	onChange={(val) => updateContextConfig(["sessions", slug, "notes"], val)}
																	label="Нотатки"
																/>
															</div>
															<div className="AiAssistant__context-row">
																<Checkbox
																	checked={config.result_text}
																	onChange={(val) => updateContextConfig(["sessions", slug, "result_text"], val)}
																	label="Підсумок"
																/>
															</div>
															<div className="AiAssistant__scenes-context">
																{(config.data.scenes || []).map((scene, idx) => {
																	const sceneConf = config.scenes[scene.id] || {
																		included: true,
																		summary: true,
																		goal: true,
																		stakes: true,
																		location: true,
																		encounter: true,
																	};
																	return (
																		<div key={scene.id} className="AiAssistant__scene-item">
																			<div className="AiAssistant__context-row">
																				<Checkbox
																					checked={sceneConf.included}
																					onChange={(val) => updateContextConfig(["sessions", slug, "scenes", scene.id, "included"], val)}
																					label={`Сцена ${idx + 1}`}
																				/>
																			</div>
																			{sceneConf.included && (
																				<div className="AiAssistant__scene-fields">
																					{SCENE_FIELDS.map((f) => (
																						<Checkbox
																							key={f.key}
																							checked={sceneConf[f.key]}
																							onChange={(val) => updateContextConfig(["sessions", slug, "scenes", scene.id, f.key], val)}
																							label={f.label}
																						/>
																					))}
																				</div>
																			)}
																		</div>
																	);
																})}
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
								title="Оберіть сцену для генерації промпту"
								onCancel={() => setShowSceneSelector(false)}
								showFooter={false}>
								<div className="AiAssistant__scene-list">
									{(sessionData.scenes || []).map((scene, idx) => (
										<div
											key={scene.id}
											className="AiAssistant__scene-option"
											onClick={() => {
												setShowSceneSelector(false);
												generate("image", scene.id);
											}}>
											<strong>Сцена {idx + 1}</strong>:{" "}
											{scene.texts?.summary?.slice(0, 60) || "Без опису"}...
										</div>
									))}
								</div>
							</Modal>
						)}

						{generatedPrompt && (
							<Modal
								title="Відповідь"
								confirmLabel="Закрити"
								onCancel={() => setGeneratedPrompt(null)}
								onConfirm={() => setGeneratedPrompt(null)}>
								<ClickToCopy
									text={generatedPrompt}
									message="Відповідь ШІ скопійовано у буфер обміну!"
									className="AiAssistant__prompt-result">
									{isResultJSONString ? (
										<pre>
											<ReactMarkdown className="AiAssistant__prompt-textarea-result">
												{generatedPrompt}
											</ReactMarkdown>
										</pre>
									) : (
										<ReactMarkdown className="AiAssistant__prompt-textarea-result">
											{generatedPrompt}
										</ReactMarkdown>
									)}
								</ClickToCopy>
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
								onClick={() => generate()}>
								{loading ? "Магія працює, зачекайте..." : "Згенерувати"}
							</Button>
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
