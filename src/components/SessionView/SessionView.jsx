import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../api';
import Icon from '../Icon';
import Button from '../Button/Button';
import Input from '../Input/Input';
import './SessionView.css';

const SCENE_SCHEMA = [
    { key: 'summary', title: 'Суть сцени', type: 'textarea', placeholder: 'Коротко опиши сцену...' },
    { key: 'goal', title: 'Мета гравців', type: 'textarea', placeholder: 'Чого персонажі хочуть досягти...' },
    { key: 'stakes', title: 'Ставки', type: 'textarea', placeholder: 'Що буде при успіху/провалі...' },
    { key: 'location', title: 'Локація', type: 'textarea', placeholder: 'Де це відбувається...' },
    { key: 'npcs', title: 'NPC / фракції', type: 'textarea', placeholder: 'Хто бере участь...' },
    { key: 'clues', title: 'Підказки', type: 'textarea', placeholder: 'Інформація, яку отримають гравці...' },
];

export default function SessionView({ campaignSlug, sessionId, onBack, onNavigate, onRefreshCampaigns, modal }) {
    const [session, setSession] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const saveTimeout = useRef(null);

    const autoResize = (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
    };

    useEffect(() => {
        const loadSession = async () => {
            try {
                const data = await api.getSession(campaignSlug, sessionId);
                setSession(data);
            } catch (err) {
                console.error("Failed to load session", err);
            }
        };
        loadSession();
    }, [campaignSlug, sessionId]);

    const saveToServer = useCallback(async (updatedSession) => {
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        setIsSaving(true);
        try {
            const result = await api.updateSession(campaignSlug, sessionId, updatedSession);
            // Якщо після збереження змінився fileName (через ренейм), оновлюємо URL
            if (result && result.fileName !== sessionId) {
                onNavigate(campaignSlug, result.fileName, true);
                onRefreshCampaigns();
            }
        } catch (err) {
            console.error("Save failed", err);
        } finally {
            setIsSaving(false);
        }
    }, [campaignSlug, sessionId, onNavigate, onRefreshCampaigns]);

    const triggerSave = useCallback((updatedSession, instant = false) => {
        if (saveTimeout.current) clearTimeout(saveTimeout.current);

        if (instant) {
            saveToServer(updatedSession);
        } else {
            setIsSaving(true);
            saveTimeout.current = setTimeout(() => saveToServer(updatedSession), 250);
        }
    }, [saveToServer]);

    const updateSession = (updates, instant = false) => {
        setSession(prev => {
            const next = { ...prev, ...updates };
            triggerSave(next, instant);
            return next;
        });
    };

    const updateData = (key, value, instant = false) => {
        const nextData = { ...session.data, [key]: value };
        updateSession({ data: nextData }, instant);
    };

    const addScene = () => {
        const scenes = session.data.scenes || [];
        updateData('scenes', [...scenes, { id: Date.now(), texts: {}, collapsed: false }], true);
    };

    const updateScene = (sceneId, field, value) => {
        const scenes = session.data.scenes.map(s =>
            s.id === sceneId ? { ...s, texts: { ...s.texts, [field]: value } } : s
        );
        updateData('scenes', scenes);
    };

    const toggleSceneCollapse = (sceneId) => {
        const scenes = session.data.scenes.map(s =>
            s.id === sceneId ? { ...s, collapsed: !s.collapsed } : s
        );
        updateData('scenes', scenes, true);
    };

    const removeScene = async (sceneId) => {
        if (!(await modal.confirm("Видалення сцени", "Ви впевнені, що хочете видалити цю сцену?"))) return;
        updateData('scenes', session.data.scenes.filter(s => s.id !== sceneId), true);
    };

    if (!session) return null;

    const checklistItems = [
        { id: 'goal', label: 'Визначити головну мету сесії', hasText: true },
        { id: 'conflict', label: 'Сформулювати основний конфлікт', hasText: true },
        { id: 'social', label: 'Підготувати соціальну сцену', note: 'Переговори, допит, суперечка.' },
        { id: 'exploration', label: 'Підготувати сцену дослідження', note: 'Локація, загадка, пастка.' },
        { id: 'combat', label: 'Підготувати бій / сцену напруги', note: 'Ризик і тиск.' },
    ];

    const totalChecks = checklistItems.length;
    const completedChecks = checklistItems.filter(item => session.data[`${item.id}_check`]).length;
    const progress = Math.round((completedChecks / totalChecks) * 100);

    const handleRename = async () => {
        const name = await modal.prompt("Перейменування", "Введіть нову назву сесії:", session.name);
        if (name && name !== session.name) updateSession({ name }, true);
    };

    return (
        <section className="SessionView Panel">
            <div className="Panel__header">
                <div className="SessionView__header">
                    <div className="SessionView__titleGroup">
                        <div className="SessionView__titleRow">
                            <Button variant="ghost" size="small" onClick={onBack} icon="back" className="SessionView__backBtn" />
                            <h2 className="editable-title" onClick={handleRename}>{session.name}</h2>
                        </div>
                        <p className="muted" style={{ fontSize: '0.85rem' }}>
                            {isSaving ? 'Зберігання...' : 'Всі зміни збережено'}
                        </p>
                    </div>
                </div>
                <div className="SessionView__headerActions">
                    <Button
                        variant={session.completed ? 'primary' : ''}
                        onClick={() => updateSession({ completed: !session.completed }, true)}
                    >
                        {session.completed ? 'Відновити' : 'Завершити'}
                    </Button>
                    <Button variant="danger" icon="trash" onClick={async () => {
                        if (await modal.confirm("Видалення сесії", `Видалити сесію "${session.name}"?`)) {
                            await api.deleteSession(campaignSlug, sessionId);
                            onBack();
                            onRefreshCampaigns();
                        }
                    }} />
                </div>
            </div>

            <div className="SessionView__progressToolbar">
                <div className="SessionView__progressWrap">
                    <div className="ProgressBar__label">
                        <span>Прогрес підготовки</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="ProgressBar">
                        <div className="ProgressBar__fill" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="Panel__body">
                <div className="SessionView__todoList">
                    <TodoSection title="1. Чекліст підготовки">
                        {checklistItems.map(item => (
                            <TodoItem
                                key={item.id}
                                checked={!!session.data[`${item.id}_check`]}
                                onChange={(val) => updateData(`${item.id}_check`, val, true)}
                                title={item.label}
                                note={item.note}
                            >
                                {item.hasText && (
                                    <Input
                                        type="textarea"
                                        rows="1"
                                        onInput={autoResize}
                                        value={session.data[`${item.id}_text`] || ''}
                                        onChange={(e) => updateData(`${item.id}_text`, e.target.value)}
                                    />
                                )}
                            </TodoItem>
                        ))}
                    </TodoSection>

                    <TodoSection
                        title="2. Сцени"
                        action={
                            <Button variant="primary" size="small" onClick={addScene} icon="plus" iconSize={16}>
                                Додати
                            </Button>
                        }
                    >
                        {(session.data.scenes || []).map((scene, idx) => (
                            <SceneCard
                                key={scene.id}
                                number={idx + 1}
                                collapsed={scene.collapsed}
                                onToggle={() => toggleSceneCollapse(scene.id)}
                                onRemove={() => removeScene(scene.id)}
                            >
                                {SCENE_SCHEMA.map(field => (
                                    <div key={field.key} className="TodoItem__content">
                                        <div className="TodoItem__title" style={{ fontSize: '0.85rem' }}>{field.title}</div>
                                        <Input
                                            type={field.type}
                                            rows="1"
                                            onInput={field.type === 'textarea' ? autoResize : undefined}
                                            value={scene.texts[field.key] || ''}
                                            onChange={(e) => updateScene(scene.id, field.key, e.target.value)}
                                            placeholder={field.placeholder}
                                        />
                                    </div>
                                ))}
                            </SceneCard>
                        ))}
                    </TodoSection>

                    <TodoSection title="3. Результат сесії">
                        <div className="TodoItem__note" style={{ marginBottom: '8px' }}>
                            Запиши короткий підсумок того, що реально відбулося.
                        </div>
                        <Input
                            type="textarea"
                            className="field--result"
                            placeholder="Підсумок того, що реально відбулося..."
                            onInput={autoResize}
                            value={session.data.result_text || ''}
                            onChange={(e) => updateData('result_text', e.target.value)}
                        />
                    </TodoSection>
                </div>
            </div>
        </section>
    );
}

function TodoSection({ title, children, action }) {
    return (
        <section className="TodoSection">
            <div className="TodoSection__header">
                <h3>{title}</h3>
                {action}
            </div>
            {children && children.length > 0 && (
                <div className="TodoSection__body">{children}</div>
            )}
        </section>
    );
}

function TodoItem({ title, note, checked, onChange, children }) {
    return (
        <label className={`TodoItem ${checked ? 'TodoItem--done' : ''}`}>
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <div className="TodoItem__content">
                <div className="TodoItem__title">{title}</div>
                {note && <div className="TodoItem__note">{note}</div>}
                {children}
            </div>
        </label>
    );
}

function SceneCard({ number, onRemove, collapsed, onToggle, children }) {
    return (
        <div className="SceneCard">
            <div className="SceneCard__header" onClick={onToggle} style={{ cursor: 'pointer' }}>
                <div className="SceneCard__titleGroup">
                    <div className="SceneCard__toggle">
                        <Icon name="chevron" className={collapsed ? 'Icon--rotated' : ''} />
                    </div>
                    <div className="SceneCard__title">Сцена {number}</div>
                </div>
                <Button variant="danger" icon="x" iconSize={16} onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                }} />
            </div>
            {!collapsed && <div className="SceneCard__grid">{children}</div>}
        </div>
    );
}