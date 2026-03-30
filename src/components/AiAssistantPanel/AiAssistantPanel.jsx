import React, { useState } from 'react';
import Button from '../Button/Button';
import Input from '../Input/Input';
import './AiAssistantPanel.css';

export default function AiAssistantPanel({ sessionName, sessionData, campaignSlug, sessionId, onInsertResult, modal }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeType, setActiveType] = useState('scene_ideas');
    const [userInstructions, setUserInstructions] = useState('');

    const isCampaign = !sessionId;

    const showApiKeyInstructions = () => {
        modal.alert(
            "Налаштування Gemini AI",
            `Для використання функцій ШІ необхідно налаштувати API ключ:\n\n` +
            `1. Отримайте безкоштовний ключ у Google AI Studio (aistudio.google.com).\n` +
            `2. Створіть файл .env у кореневій папці проекту (там, де server.js).\n` +
            `3. Додайте в нього рядок: GEMINI_API_KEY=ваш_ключ\n` +
            `4. Перезапустіть сервер (термінал з node server.js).\n\n` +
            `Після цього магія ШІ стане доступною!`
        );
    };

    const generate = async (type) => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    type: isCampaign ? 'campaign_plot' : activeType, 
                    sessionName, 
                    sessionData, 
                    slug: campaignSlug, 
                    fileName: sessionId,
                    userInstructions 
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
            if (data.updated && onInsertResult) {
                onInsertResult(data.updated);
                setUserInstructions(''); // Очищаємо поле після успіху
            }
        } catch (err) {
            setError('Не вдалося зв’язатися з AI. Перевірте ключ API або з’єднання.');
        } finally {
            setLoading(false);
        }
    };

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
            </div>

            {!isCampaign && (
                <div className="AiAssistant__actions">
                    {actions.map(action => (
                        <Button
                            key={action.id}
                            variant={activeType === action.id ? 'primary' : 'ghost'}
                            size="small"
                            onClick={() => setActiveType(action.id)}
                        >
                            {action.label}
                        </Button>
                    ))}
                </div>
            )}

            <div className="AiAssistant__prompt-area" style={{ marginTop: '16px' }}>
                <Input
                    type="textarea"
                    placeholder={getPlaceholder()}
                    value={userInstructions}
                    onChange={(e) => setUserInstructions(e.target.value)}
                    style={{ minHeight: '80px', marginBottom: '12px' }}
                />
                <Button
                    variant="create"
                    disabled={loading}
                    onClick={generate}
                    style={{ width: '100%' }}
                >
                    {loading ? 'Магія працює...' : 'Згенерувати'}
                </Button>
            </div>

            {loading && <div className="AiAssistant__loading">Магія працює, зачекайте...</div>}

            {error && <div className="AiAssistant__error">{error}</div>}
        </div>
    );
}