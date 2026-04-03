import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "../../api";
import { isJsonString } from "../../utils/json";
import { parseUrl } from "../../utils/navigation";
import Button from "../Button/Button";
import ClickToCopy from "../ClickToCopy/ClickToCopy";
import Icon from "../Icon";
import Input from "../Input/Input";
import Modal from "../Modal/Modal";
import Notification from "../Notification/Notification";
import "./AiAssistantPanel.css";

export default function AiAssistantPanel({
	sessionData,
	onInsertResult,
	modal,
}) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [userInstructions, setUserInstructions] = useState("");
	const [notification, setNotification] = useState(null);
	const [showSceneSelector, setShowSceneSelector] = useState(false);
	const [useSessionsResults, setUseSessionsResults] = useState(true);
	const [parseAIResponse, setParseAIResponse] = useState(false);
	const [useContext, setUseContext] = useState(true);
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

	const generate = async (type = null, targetSceneId = null) => {
		setLoading(true);
		setError("");

		try {
			const data = await api.generateAi({
				type,
				userInstructions,
				path: initialRoute,
				sceneId: targetSceneId,
				parseAIResponse: type === "image" ? false : parseAIResponse,
				useSessionsResults,
				useContext,
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

	const isResultJSONString = isJsonString(generatedPrompt);

	// Допоміжна функція для відображення JSON-результату
	return (
		<div className="AiAssistant">
			<div className="AiAssistant__header">
				<h3>{isCampaign ? "AI Сюжетний Помічник" : "AI Помічник Сесії"}</h3>
				<Icon name="wand" size={20} className="AiAssistant__header-icon" />
			</div>

			<div className="AiAssistant__actions">
				<Button
					variant={useContext ? "primary" : "ghost"}
					size="small"
					icon="database"
					onClick={() => setUseContext(!useContext)}
					disabled={loading}
					title={
						useContext
							? "Використовувати контекст кампанії, сесії та сценаріїв"
							: "Без контексту"
					}>
					Контекст
				</Button>
				<Button
					variant={useContext && useSessionsResults ? "primary" : "ghost"}
					size="small"
					icon="history"
					onClick={() =>
						useContext && setUseSessionsResults(!useSessionsResults)
					}
					disabled={loading}
					title={
						useSessionsResults
							? 'Використовувати дані з "Результат сесії" попередніх сесій'
							: "Контекст лише кампанії і поточної сесії"
					}>
					Контекст сесій
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
			</div>

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

			{notification && (
				<Notification
					message={notification}
					onClose={() => setNotification(null)}
				/>
			)}
		</div>
	);
}
