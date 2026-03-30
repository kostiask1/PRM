import React, { useState } from 'react';
import Button from '../Button/Button';
import Input from '../Input/Input';
import './AiAssistantPanel.css';

export default function AiAssistantPanel({ sessionName, sessionData, campaignSlug, sessionId, onInsertResult }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeType, setActiveType] = useState('scene_ideas');
    const [userInstructions, setUserInstructions] = useState('');

    const generate = async (type) => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    type: activeType, 
                    sessionName, 
                    sessionData, 
                    slug: campaignSlug, 
                    fileName: sessionId,
                    userInstructions 
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
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

    // Допоміжна функція для відображення JSON-результату
    return (
        <div className="AiAssistant">
            <div className="AiAssistant__header">
                <h3>AI Помічник Майстра</h3>
            </div>
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

            <div className="AiAssistant__prompt-area" style={{ marginTop: '16px' }}>
                <Input
                    type="textarea"
                    placeholder="Додайте деталі (наприклад: 'атмосфера жаху', 'NPC має бути ельфом')..."
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
                    {loading ? 'Магія працює...' : 'Згенерувати та зберегти'}
                </Button>
            </div>

            {loading && <div className="AiAssistant__loading">Магія працює, зачекайте...</div>}

            {error && <div className="AiAssistant__error">{error}</div>}
        </div>
    );
}