import { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from '../../api';
import Icon from '../Icon';
import Button from '../Button/Button';
import Input from '../Input/Input';
import AiAssistantPanel from '../AiAssistantPanel/AiAssistantPanel';
import Panel from '../Panel/Panel';
import './SessionView.css';

const SCENE_SCHEMA = [
    { key: 'summary', title: 'Суть сцени', type: 'textarea', placeholder: 'Коротко опиши сцену...' },
    { key: 'goal', title: 'Мета гравців', type: 'textarea', placeholder: 'Чого персонажі хочуть досягти...' },
    { key: 'stakes', title: 'Ставки', type: 'textarea', placeholder: 'Що буде при успіху/провалі...' },
    { key: 'location', title: 'Локація', type: 'textarea', placeholder: 'Де це відбувається...' },
    { key: 'npcs', title: 'NPC / фракції', type: 'textarea', placeholder: 'Хто бере участь...' },
    { key: 'clues', title: 'Підказки', type: 'textarea', placeholder: 'Інформація, яку отримають гравці...' },
];

/**
 * Допоміжний компонент для редагування Markdown по кліку
 */
function EditableMarkdownField({ title, value, onChange, placeholder, type }) {
    const [isEditing, setIsEditing] = useState(false);

    if (isEditing) {
        return (
            <div className="TodoItem__content" onClick={(e) => e.stopPropagation()}>
                {title && (<div className="TodoItem__title">{title}</div>)}
                <Input
                    type={type}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    onBlur={() => setIsEditing(false)}
                    autoFocus
                />
            </div>
        );
    }

    return (
        <div className="TodoItem__content">
            {title && (<div className="TodoItem__title">{title}</div>)}
            <div className="MarkdownView" onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}>
                {value ? <ReactMarkdown>{value}</ReactMarkdown> : <span className="muted">{placeholder}</span>}
            </div>
        </div>
    );
}

export default function SessionView({ campaignSlug, sessionId, onBack, onNavigate, onRefreshCampaigns, modal, onRollDice }) {
    const [session, setSession] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const saveTimeout = useRef(null);

    // Undo/Redo state
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    console.log('undoStack:', undoStack)
    const isUpdatingHistory = useRef(false); // Flag to prevent circular updates

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

    const handleUndo = useCallback(() => {
        if (undoStack.length === 0) return;

        const currentState = {
            data: session.data,
            completed: session.completed,
            completedAt: session.completedAt
        };

        let tempStack = [...undoStack];
        let stateToRestore = null;

        // Шукаємо перший стан у черзі, який реально відрізняється від поточного
        while (tempStack.length > 0) {
            const candidate = tempStack.pop();
            const isDifferent = JSON.stringify(candidate.data) !== JSON.stringify(currentState.data) ||
                candidate.completed !== currentState.completed;

            if (isDifferent) {
                stateToRestore = candidate;
                break;
            }
        }

        if (stateToRestore) {
            isUpdatingHistory.current = true;
            setRedoStack(prev => [currentState, ...prev]);
            setUndoStack(tempStack);

            setSession(prev => {
                const updated = {
                    ...prev,
                    data: stateToRestore.data,
                    completed: stateToRestore.completed,
                    completedAt: stateToRestore.completedAt
                };
                triggerSave(updated, true);
                return updated;
            });

            setTimeout(() => { isUpdatingHistory.current = false; }, 0);
        }
    }, [undoStack, session, triggerSave]);

    const handleRedo = useCallback(() => {
        if (redoStack.length === 0) return;

        const currentState = {
            data: session.data,
            completed: session.completed,
            completedAt: session.completedAt
        };

        let tempStack = [...redoStack];
        let stateToRestore = null;

        while (tempStack.length > 0) {
            const candidate = tempStack.shift();
            const isDifferent = JSON.stringify(candidate.data) !== JSON.stringify(currentState.data) ||
                candidate.completed !== currentState.completed;

            if (isDifferent) {
                stateToRestore = candidate;
                break;
            }
        }

        if (stateToRestore) {
            isUpdatingHistory.current = true;
            setUndoStack(prev => [...prev, currentState]);
            setRedoStack(tempStack);

            setSession(prev => {
                const updated = {
                    ...prev,
                    data: stateToRestore.data,
                    completed: stateToRestore.completed,
                    completedAt: stateToRestore.completedAt
                };
                triggerSave(updated, true);
                return updated;
            });

            setTimeout(() => { isUpdatingHistory.current = false; }, 0);
        }
    }, [redoStack, session, triggerSave]);

    const lastLoadedIdRef = useRef(null);

    useEffect(() => {
        const loadSession = async () => {
            try {
                const data = await api.getSession(campaignSlug, sessionId);
                setSession(data);

                if (lastLoadedIdRef.current !== data.id) {
                    setUndoStack([]);
                    setRedoStack([]);
                    lastLoadedIdRef.current = data.id;
                }
            } catch (err) {
                console.error("Failed to load session", err);
            }
        };
        loadSession();
    }, [campaignSlug, sessionId]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Backspace') {
                const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
                if (!isInput) {
                    e.preventDefault();
                    onBack();
                }
            }
            // Add keyboard shortcuts for Undo/Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                handleUndo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                handleRedo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown); // Removed autoResize from dependencies
    }, [onBack, handleUndo, handleRedo]);

    const updateSession = (updates, instant = false) => {
        setSession(prev => {
            if (!isUpdatingHistory.current && prev) {
                const currentState = {
                    data: prev.data,
                    completed: prev.completed,
                    completedAt: prev.completedAt
                };

                // Перевіряємо, чи нові дані реально відрізняються від поточних
                const isDataChanged = updates.data && JSON.stringify(updates.data) !== JSON.stringify(prev.data);
                const isStatusChanged = updates.completed !== undefined && updates.completed !== prev.completed;

                if (isDataChanged || isStatusChanged) {
                    setUndoStack(currentStack => [...currentStack, currentState]);
                    setRedoStack([]);
                }
            }

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

    const handleOpenEncounter = async (scene) => {
        let encounterId = scene.encounterId;

        if (!encounterId) {
            const sceneIndex = session.data.scenes.findIndex(s => s.id === scene.id);
            const name = await modal.prompt("Нове зіткнення", "Введіть назву для бою:", `Бій у сцені ${sceneIndex + 1}`);
            if (name === null) return;

            encounterId = Date.now().toString();
            const newEncounter = { id: encounterId, name: name || `Бій у сцені ${sceneIndex + 1}`, monsters: [] };

            const currentEncounters = session.data.encounters || [];
            const updatedScenes = session.data.scenes.map(s =>
                s.id === scene.id ? { ...s, encounterId } : s
            );

            updateSession({
                data: {
                    ...session.data,
                    encounters: [...currentEncounters, newEncounter],
                    scenes: updatedScenes
                }
            }, true);
        }

        onNavigate(campaignSlug, sessionId, false, encounterId);
    };

    const removeScene = async (sceneId) => {
        if (!(await modal.confirm("Видалення сцени", "Ви впевнені, що хочете видалити цю сцену?"))) return;
        updateData('scenes', session.data.scenes.filter(s => s.id !== sceneId), true);
    };

    const handleAiUpdate = (updatedSession) => {
        // Зберігаємо ПОВНИЙ поточний стан перед оновленням від ШІ
        setUndoStack(currentStack => [
            ...currentStack,
            {
                data: session.data,
                completed: session.completed,
                completedAt: session.completedAt
            }
        ]);
        setRedoStack([]); // Очищаємо redo stack при нових змінах
        setSession(updatedSession);
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
        <Panel className="SessionView">
            <div className="Panel__header">
                <div className="SessionView__header">
                    <div className="SessionView__titleGroup">
                        <div className="SessionView__titleRow">
                            <Button variant="ghost" size="small" onClick={onBack} icon="back" className="SessionView__backBtn" />
                            <h2 className="editable-title" onClick={handleRename}>{session.name}</h2>
                        </div>
                        <p className="muted">
                            {isSaving ? 'Зберігання...' : 'Всі зміни збережено'}
                        </p>
                    </div>
                </div>
                <div className="SessionView__headerActions">
                    <Button
                        variant="ghost"
                        size="small"
                        icon="undo"
                        onClick={handleUndo}
                        disabled={undoStack.length === 0 || isSaving}
                        title="Скасувати (Ctrl+Z)"
                    />
                    <Button
                        variant="ghost"
                        size="small"
                        icon="redo"
                        onClick={handleRedo}
                        disabled={redoStack.length === 0 || isSaving}
                        title="Повторити (Ctrl+Y)"
                    />
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
                                    <EditableMarkdownField
                                        type="textarea"
                                        value={session.data[`${item.id}_text`] || ''}
                                        onChange={(e) => updateData(`${item.id}_text`, e.target.value)}
                                        placeholder="Додайте деталі..."
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
                        <AiAssistantPanel
                            sessionName={session.name}
                            sessionData={session.data}
                            campaignSlug={campaignSlug}
                            sessionId={sessionId}
                            onInsertResult={handleAiUpdate}
                            modal={modal}
                        />
                        {(session.data.scenes || []).map((scene, idx) => (
                            <SceneCard
                                key={scene.id}
                                number={idx + 1}
                                collapsed={scene.collapsed}
                                onToggle={() => toggleSceneCollapse(scene.id)}
                                onRemove={() => removeScene(scene.id)}
                                onOpenEncounter={() => handleOpenEncounter(scene)}
                                hasEncounter={!!scene.encounterId}
                                encounterName={(session.data.encounters || []).find(e => e.id?.toString() === scene.encounterId?.toString())?.name || "Без назви"}
                            >
                                {SCENE_SCHEMA.map(field => (
                                    <EditableMarkdownField
                                        key={field.key}
                                        title={field.title}
                                        type={field.type}
                                        value={scene.texts[field.key] || ''}
                                        onChange={(e) => updateScene(scene.id, field.key, e.target.value)}
                                        placeholder={field.placeholder}
                                    />
                                ))}
                            </SceneCard>
                        ))}
                    </TodoSection>

                    <TodoSection title="3. Результат сесії">
                        <div className="TodoItem__note">
                            Запиши короткий підсумок того, що реально відбулося.
                        </div>
                        <EditableMarkdownField
                            type="textarea"
                            title="Підсумок"
                            className="field--result"
                            placeholder="Підсумок того, що реально відбулося..."
                            value={session.data.result_text || ''}
                            onChange={(e) => updateData('result_text', e.target.value)}
                        />
                    </TodoSection>
                </div>
            </div>
        </Panel>
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
        <div className={`TodoItem ${checked ? 'TodoItem--done' : ''}`}>
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <div className="TodoItem__content">
                <div
                    onClick={() => onChange(!checked)}
                    style={{ cursor: 'pointer' }}
                >
                    {title && (<div className="TodoItem__title">{title}</div>)}
                    {note && <div className="TodoItem__note">{note}</div>}
                </div>
                {children}
            </div>
        </div>
    );
}

function SceneCard({ number, onRemove, collapsed, onToggle, onOpenEncounter, hasEncounter, encounterName, children }) {
    return (
        <div className="SceneCard">
            <div className="SceneCard__header" onClick={onToggle}>
                <div className="SceneCard__titleGroup">
                    <div className="SceneCard__toggle">
                        <Icon name="chevron" className={collapsed ? 'Icon--rotated' : ''} />
                    </div>
                    <div className="SceneCard__title">Сцена {number}</div>
                </div>
                <div className="SceneCard__headerActions">
                    <Button
                        variant={hasEncounter ? "primary" : "ghost"}
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenEncounter();
                        }}
                        title={hasEncounter ? "Відкрити зіткнення" : "Додати бойове зіткнення"}
                    >
                        <Icon name="swords" size={18} style={{ marginRight: '8px' }} />
                        <span style={{ fontWeight: '600' }}>
                            {hasEncounter ? encounterName : "Додати бій"}
                        </span>
                    </Button>
                    <Button variant="danger" icon="x" iconSize={16} onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }} />
                </div>
            </div>
            {!collapsed && <div className="SceneCard__grid">{children}</div>}
        </div>
    );
}