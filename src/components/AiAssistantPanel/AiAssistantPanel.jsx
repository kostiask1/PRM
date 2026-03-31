import { useCallback, useState } from 'react';
import Button from '../Button/Button';
import Icon from '../Icon';
import Input from '../Input/Input';
import Modal from '../Modal/Modal';
import Notification from '../Notification/Notification';
import './AiAssistantPanel.css';

export default function AiAssistantPanel({ sessionName, sessionData, campaignSlug, campaignContext, sessionId, onInsertResult, modal }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [useCampaignContext, setUseCampaignContext] = useState(true);
    const [generateWithReplace, setGenerateWithReplace] = useState(true);
    const [activeType, setActiveType] = useState('scene_ideas');
    const [userInstructions, setUserInstructions] = useState('');
    const [notification, setNotification] = useState(null);
    const [showSceneSelector, setShowSceneSelector] = useState(false);
    const [generatedPrompt, setGeneratedPrompt] = useState(null);

    const isCampaign = !sessionId;

    const showApiKeyInstructions = () => {
        modal.alert(
            "Налаштування Gemini AI",
            `Для використання функцій ШІ необхідно налаштувати API ключ:\n\n` +
            `1. Отримайте безкоштовний ключ у Google AI Studio (aistudio.google.com).\n` +
            `2. Створіть файл .env у кореневій папці проекту.\n` +
            `3. Додайте в нього рядок: GEMINI_API_KEY=ваш_ключ\n` +
            `4. Перезапустіть сервер.\n\n` +
            `Після цього магія ШІ стане доступною!`
        );
    };

    const generate = async (overrideType = null, targetSceneId = null) => {
        setLoading(true);
        setError('');
        try {
            const promptData = { ...sessionData };

            if (useCampaignContext && campaignContext) {
                promptData.description = campaignContext.description;
                promptData.notes = campaignContext.notes;
            }

            const typeToSend = overrideType || (isCampaign ? 'campaign_plot' : activeType);

            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: typeToSend,
                    sessionName,
                    sessionData: promptData,
                    slug: campaignSlug,
                    fileName: sessionId,
                    generateWithReplace: targetSceneId ? false : generateWithReplace,
                    userInstructions,
                    sceneId: targetSceneId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();

                if (errorData.error?.includes('GEMINI_API_KEY')) {
                    showApiKeyInstructions();
                    return;
                }

                throw new Error(errorData.error || 'Помилка сервера');
            }
            const data = await response.json(); // Це буде JSON-об'єкт від AI

            // Одразу оновлюємо стан в батьківському компоненті, бо в БД вже записано
            if (data.prompt) {
                setGeneratedPrompt(data.prompt);
            } else if (data.updated && onInsertResult) {
                onInsertResult(data.updated);
                setUserInstructions(''); // Очищаємо поле після успіху
                setNotification('Магія ШІ успішно застосована!');
            }
        } catch (err) {
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


    const actions = [
        { id: 'scene_ideas', label: 'Ідеї сцен', icon: 'map' },
        { id: 'npc_ideas', label: 'Генерація NPC', icon: 'users' },
        { id: 'plot_twists', label: 'Сюжетні повороти', icon: 'zap' },
    ];

    const getPlaceholder = () => {
        if (isCampaign) {
            return "Опишіть зміни або нові гілки сюжету (наприклад: 'додай політичні інтриги' або 'зроби фінал більш епічним')...";
        }
        switch (activeType) {
            case 'scene_ideas': return "Опишіть стиль або умови (наприклад: 'занедбане підземне місто', 'атмосфера детективу')...";
            case 'npc_ideas': return "Які риси мають бути? (наприклад: 'корумпований стражник', 'таємничий мандрівник з маскою')...";
            case 'plot_twists': return "Задайте вектор (наприклад: 'зрада союзника', 'несподівана допомога від ворога')...";
            default: return "Додайте деталі для ШІ...";
        }
    };

    // Допоміжна функція для відображення JSON-результату
    return (
        <div className="AiAssistant">
            <div className="AiAssistant__header">
                <h3>{isCampaign ? 'AI Сюжетний Помічник' : 'AI Помічник Сесії'}</h3>
                <Icon name="wand" size={20} className="AiAssistant__header-icon" />
            </div>

            {!isCampaign && (
                <div className="AiAssistant__actions">
                    <Button
                        variant={useCampaignContext ? 'primary' : 'ghost'}
                        size="small"
                        onClick={() => setUseCampaignContext((useCampaignContext) => !useCampaignContext)}
                        disabled={loading}
                    >
                        Використати контекст кампанії
                    </Button>
                    <Button
                        variant={generateWithReplace ? 'primary' : 'ghost'}
                        size="small"
                        onClick={() => setGenerateWithReplace((generateWithReplace) => !generateWithReplace)}
                        disabled={loading}
                    >
                        {generateWithReplace ? "Додавання із заміною" : "Додати нові дані"}
                    </Button>
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
                    <span className="muted" style={{ margin: '0 5px' }}>|</span>
                    {actions.map(action => (
                        <Button
                            key={action.id}
                            variant={activeType === action.id ? 'primary' : 'ghost'}
                            size="small"
                            onClick={() => setActiveType(action.id)}
                            disabled={loading}
                        >
                            {action.label}
                        </Button>
                    ))}
                </div>
            )}

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
                                    generate('image_prompt', scene.id);
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
                    title="Опис для генерації зображення"
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