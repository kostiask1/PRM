import { useCallback, useState } from 'react';
import { api } from '../../api';
import Button from '../Button/Button';
import Icon from '../Icon';
import Input from '../Input/Input';
import Modal from '../Modal/Modal';
import Notification from '../Notification/Notification';
import './AiAssistantPanel.css';
import { parseUrl } from '../../utils/navigation';

export default function AiAssistantPanel({ sessionData, onInsertResult, modal }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [userInstructions, setUserInstructions] = useState('');
    const [notification, setNotification] = useState(null);
    const [showSceneSelector, setShowSceneSelector] = useState(false);
    const [parseAIResponse, setParseAIResponse] = useState(true);
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
            `Після цього магія ШІ стане доступною!`
        );
    };

    const generate = async (type = null, targetSceneId = null) => {
        setLoading(true);
        setError('');

        try {
            const data = await api.generateAi({
                type,
                userInstructions,
                path: initialRoute,
                sceneId: targetSceneId,
                parseAIResponse: type === "image" ? false : parseAIResponse,
            });

            // Одразу оновлюємо стан в батьківському компоненті, бо в БД вже записано
            if (data.prompt) {
                setGeneratedPrompt(data.prompt);
                console.log('data:', data)
                console.log('data.prompt:', data.prompt)
            } else if (data.updated && onInsertResult) {
                onInsertResult(data.updated);
                setUserInstructions(''); // Очищаємо поле після успіху
                setNotification('Магія ШІ успішно застосована!');
            }
        } catch (err) {
            if (err.message?.includes('GEMINI_API_KEY')) {
                showApiKeyInstructions();
                return;
            }

            setError(err.message || 'Не вдалося зв’язатися з AI.');
            modal.alert("Помилка ШІ", err.message, err.status);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyGeneratedPrompt = useCallback(() => {
        if (generatedPrompt) {
            navigator.clipboard.writeText(generatedPrompt);
            setNotification('Промпт скопійовано у буфер обміну!');
        }
        setGeneratedPrompt(null);
    }, [generatedPrompt, setNotification]);

    const getPlaceholder = () => {
        if (isCampaign) {
            return "Опишіть зміни або нові гілки сюжету (наприклад: 'додай політичні інтриги' або 'зроби фінал більш епічним')...";
        } else {
            return "Опишіть стиль або умови (наприклад: 'занедбане підземне місто', 'атмосфера детективу')...";
        }
    };

    // Допоміжна функція для відображення JSON-результату
    return (
        <div className="AiAssistant">
            <div className="AiAssistant__header">
                <h3>{isCampaign ? 'AI Сюжетний Помічник' : 'AI Помічник Сесії'}</h3>
                <Icon name="wand" size={20} className="AiAssistant__header-icon" />
            </div>

            <div className="AiAssistant__actions">
                {!isCampaign && (
                    <Button
                        variant="ghost"
                        size="small"
                        icon="image"
                        onClick={() => setShowSceneSelector(true)}
                        disabled={loading || !sessionData.scenes?.length}
                        title="Згенерувати візуальний опис для сцени"
                    >
                        Промпт для фото
                    </Button>
                )}
                <Button
                    variant={parseAIResponse ? "primary" : "ghost"}
                    size="small"
                    icon="image"
                    onClick={() => setParseAIResponse(!parseAIResponse)}
                    disabled={loading}
                    title={parseAIResponse ? "Парсити відповідь ШІ" : "Показувати відповідь текстом"}
                >
                    Парсинг відповіді
                </Button>
            </div>

            {showSceneSelector && (
                <Modal
                    title="Оберіть сцену для генерації промпту"
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
                                    generate('image', scene.id);
                                }}
                            >
                                <strong>Сцена {idx + 1}</strong>: {scene.texts?.summary?.slice(0, 60) || 'Без опису'}...
                            </div>
                        ))}
                    </div>
                </Modal>
            )}

            {generatedPrompt && (
                <Modal
                    title="Відповідь"
                    confirmLabel="Копіювати"
                    onCancel={() => setGeneratedPrompt(null)}
                    onConfirm={handleCopyGeneratedPrompt}
                >
                    <div className="AiAssistant__prompt-result">
                        <textarea
                            className="AiAssistant__prompt-textarea-result"
                            readOnly
                            value={generatedPrompt}
                            onClick={(e) => e.target.select()}
                        />
                    </div>
                </Modal>
            )}

            <div className="AiAssistant__prompt-area" style={{ marginTop: '16px' }}>
                <Input
                    type="textarea"
                    placeholder={getPlaceholder()}
                    value={userInstructions}
                    onChange={(e) => setUserInstructions(e.target.value)}
                    disabled={loading}
                    style={{ minHeight: '80px', marginBottom: '12px' }}
                />
                <Button
                    variant="create"
                    disabled={loading}
                    onClick={() => generate()}
                    style={{ width: '100%' }}
                >
                    {loading ? 'Магія працює...' : 'Згенерувати'}
                </Button>
            </div>

            {loading && <div className="AiAssistant__loading">Магія працює, зачекайте...</div>}

            {error && <div className="AiAssistant__error">{error}</div>}

            {notification && <Notification message={notification} onClose={() => setNotification(null)} />}
        </div>
    );
}