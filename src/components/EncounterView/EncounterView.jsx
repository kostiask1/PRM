import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '../../api';
import Panel from '../Panel/Panel';
import Button from '../Button/Button';
import Modal from '../Modal/Modal';
import Bestiary from '../Bestiary/Bestiary';
import MonsterStatBlock from '../MonsterStatBlock/MonsterStatBlock';
import Notification from '../Notification/Notification';
import './EncounterView.css';

const MONSTER_FULL_DATA_CACHE = new Map();

export default function EncounterView({ campaign, sessionId, encounterId, onBack, onRefreshCampaigns, modal }) {
    const [encounter, setEncounter] = useState(null);
    const [selectedInstance, setSelectedInstance] = useState(null);
    const [showBestiary, setShowBestiary] = useState(false);
    const [notification, setNotification] = useState(null);
    const [draggingId, setDraggingId] = useState(null);

    const saveTimeoutRef = useRef(null);

    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && showBestiary) {
                setShowBestiary(false);
            } else if (e.key === 'Backspace') {
                const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
                if (!isInput) {
                    e.preventDefault();
                    if (showBestiary) {
                        setShowBestiary(false);
                    } else {
                        onBack();
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showBestiary, onBack]);

    useEffect(() => {
        let isMounted = true;
        const loadEncounter = async (retries = 3) => {
            try {
                const session = await api.getSession(campaign.slug, sessionId);
                if (!isMounted) return;

                // Очікувана структура: session.data.encounters = [{ id, name, monsters: [] }]
                const found = (session.data.encounters || []).find(e => e.id.toString() === encounterId.toString());

                if (!found && retries > 0) {
                    // Можлива затримка запису файлу на сервері, пробуємо ще раз через 300мс
                    setTimeout(() => loadEncounter(retries - 1), 300);
                    return;
                }

                if (!found) {
                    modal.alert("Помилка", "Зіткнення не знайдено або дані ще оновлюються.");
                    onBack();
                    return;
                }

                setEncounter(found);
                if (found && found.monsters?.length > 0 && !selectedInstance) {
                    setSelectedInstance(found.monsters[0]);
                }
            } catch (err) {
                if (isMounted) console.error("Failed to load encounter", err);
            }
        };
        loadEncounter();
        return () => { isMounted = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [campaign.slug, sessionId, encounterId]);

    const saveEncounterState = useCallback((updatedEncounter, debounceMs = 0) => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        const performSave = async () => {
            try {
                const currentSession = await api.getSession(campaign.slug, sessionId);
                const updatedEncounters = (currentSession.data.encounters || []).map(e =>
                    e.id.toString() === encounterId.toString() ? updatedEncounter : e
                );

                await api.updateSession(campaign.slug, sessionId, {
                    ...currentSession,
                    data: { ...currentSession.data, encounters: updatedEncounters }
                });
                onRefreshCampaigns();
            } catch (err) {
                console.error("Failed to save encounter updates", err);
            }
        };

        if (debounceMs > 0) {
            saveTimeoutRef.current = setTimeout(performSave, debounceMs);
        } else {
            performSave();
        }
    }, [campaign.slug, sessionId, encounterId, onRefreshCampaigns]);

    const handleAddMonster = async (m) => {
        if (!encounter) return;

        try {
            let fullData;

            if (MONSTER_FULL_DATA_CACHE.has(m.slug)) {
                fullData = MONSTER_FULL_DATA_CACHE.get(m.slug);
            } else {
                // Fetch full monster data because search results are often truncated
                const response = await fetch(`https://api.open5e.com/monsters/${m.slug}/`);
                fullData = await response.json();
                MONSTER_FULL_DATA_CACHE.set(m.slug, fullData);
            }

            const newMonster = {
                ...fullData,
                instanceId: `inst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                currentHp: fullData.hit_points || 0,
            };

            const updated = { ...encounter, monsters: [...encounter.monsters, newMonster] };
            setEncounter(updated);
            saveEncounterState(updated);

            setNotification(`${fullData.name} додано до бою.`);
        } catch (err) {
            console.error("Error adding monster:", err);
            modal.alert("Помилка", "Не вдалося завантажити повні дані монстра.");
        }
    };

    const removeMonster = (instanceId) => {
        const updated = { ...encounter, monsters: encounter.monsters.filter(m => m.instanceId !== instanceId) };
        setEncounter(updated);
        saveEncounterState(updated);
    };

    const updateMonsterHp = (instanceId, newHp) => {
        const updatedMonsters = encounter.monsters.map(m =>
            m.instanceId === instanceId ? { ...m, currentHp: Math.max(0, parseInt(newHp) || 0) } : m
        );
        const updated = { ...encounter, monsters: updatedMonsters };
        setEncounter(updated);
        // Update selection if it's the same monster to keep the detail view in sync
        if (selectedInstance?.instanceId === instanceId) setSelectedInstance(updatedMonsters.find(m => m.instanceId === instanceId));
        saveEncounterState(updated, 500);
    };

    const updateMonsterMaxHp = (instanceId, newMaxHp) => {
        const updatedMonsters = encounter.monsters.map(m =>
            m.instanceId === instanceId ? { ...m, hit_points: parseInt(newMaxHp) || 0 } : m
        );
        const updated = { ...encounter, monsters: updatedMonsters };
        setEncounter(updated);
        if (selectedInstance?.instanceId === instanceId) setSelectedInstance(updatedMonsters.find(m => m.instanceId === instanceId));
        saveEncounterState(updated, 500);
    };

    const handleRename = async () => {
        const name = await modal.prompt("Перейменування", "Вкажіть нову назву зіткнення:", encounter.name);
        if (name && name !== encounter.name) {
            const updated = { ...encounter, name };
            setEncounter(updated);
            saveEncounterState(updated);
        }
    };

    const handleRenameMonster = async (instanceId, currentName) => {
        const name = await modal.prompt("Перейменування", "Вкажіть нове ім'я монстра:", currentName);
        if (name && name !== currentName) {
            const updatedMonsters = encounter.monsters.map(m =>
                m.instanceId === instanceId ? { ...m, name } : m
            );
            const updated = { ...encounter, monsters: updatedMonsters };
            setEncounter(updated);
            if (selectedInstance?.instanceId === instanceId) {
                setSelectedInstance(updatedMonsters.find(m => m.instanceId === instanceId));
            }
            saveEncounterState(updated);
        }
    };

    const duplicateMonster = (m) => {
        const newMonster = {
            ...m,
            instanceId: `inst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        };
        const index = encounter.monsters.findIndex(item => item.instanceId === m.instanceId);
        const updatedMonsters = [...encounter.monsters];
        updatedMonsters.splice(index + 1, 0, newMonster);

        const updated = { ...encounter, monsters: updatedMonsters };
        setEncounter(updated);
        saveEncounterState(updated);
    };

    const handleDragStart = (e, instanceId) => {
        setDraggingId(instanceId);
        e.dataTransfer.effectAllowed = 'move';
        // Додаємо невелику затримку, щоб браузер встиг зробити скріншот елемента перед зміною стилю
        setTimeout(() => e.target.classList.add('is-dragging'), 0);
    };

    const handleDragEnd = (e) => {
        e.target.classList.remove('is-dragging');
        setDraggingId(null);
        saveEncounterState(encounter);
    };

    const handleDragEnter = (targetId) => {
        if (draggingId === targetId || !draggingId) return;

        const items = [...encounter.monsters];
        const draggedIdx = items.findIndex(m => m.instanceId === draggingId);
        const targetIdx = items.findIndex(m => m.instanceId === targetId);

        if (draggedIdx !== -1 && targetIdx !== -1) {
            const [removed] = items.splice(draggedIdx, 1);
            items.splice(targetIdx, 0, removed);
            setEncounter({ ...encounter, monsters: items });
        }
    };

    const getHpColor = (current, max) => {
        const ratio = max > 0 ? Math.min(Math.max(0, current / max), 1) : 0;
        const hue = ratio * 120; // 120 - зелений, 0 - червоний
        return `hsl(${hue}, 80%, 60%)`;
    };

    const averageInitiative = useMemo(() => {
        if (!encounter || encounter.monsters.length === 0) return 0;
        const total = encounter.monsters.reduce((sum, m) => {
            const mod = Math.floor(((m.dexterity || 10) - 10) / 2);
            return sum + 10.5 + mod;
        }, 0);
        const avg = total / encounter.monsters.length;
        return avg % 1 === 0 ? avg : avg.toFixed(1);
    }, [encounter]);

    if (!encounter) return <Panel className="EncounterView"><div className="Panel__body">Завантаження...</div></Panel>;

    return (
        <Panel className="EncounterView">
            <div className="Panel__header">
                <div className="EncounterView__header">
                    <Button variant="ghost" size="small" onClick={onBack} icon="back" className="SessionView__backBtn" />
                    <h2 className="editable-title" onClick={handleRename} title="Натисніть, щоб перейменувати">
                        {encounter.name}
                    </h2>
                    <p className="muted">
                        Бойове зіткнення • {encounter.monsters.length} монстрів
                        {encounter.monsters.length > 0 && ` • Сер. ініціатива: ${averageInitiative}`}
                    </p>
                </div>
            </div>
            <div className="Panel__body EncounterView__body">
                <div className="EncounterView__main">
                    <div className="EncounterView__list">
                        <Button
                            variant="create"
                            onClick={() => setShowBestiary(true)}
                            icon="plus"
                            className="EncounterView__addBtn"
                        >
                            Додати монстра
                        </Button>

                        {encounter.monsters.map(m => (
                            <div
                                key={m.instanceId}
                                className={`EncounterMonsterRow ${selectedInstance?.instanceId === m.instanceId ? 'is-active' : ''} ${draggingId === m.instanceId ? 'is-dragging' : ''}`}
                                onClick={() => setSelectedInstance(m)}
                                draggable
                                onDragStart={(e) => handleDragStart(e, m.instanceId)}
                                onDragEnd={handleDragEnd}
                                onDragOver={(e) => e.preventDefault()}
                                onDragEnter={() => handleDragEnter(m.instanceId)}
                                onDrop={(e) => e.preventDefault()}
                            >
                                <div className="EncounterMonsterRow__content">
                                    <div
                                        className="EncounterMonsterRow__name editable-title"
                                        onClick={(e) => { e.stopPropagation(); handleRenameMonster(m.instanceId, m.name); }}
                                        title="Натисніть, щоб змінити ім'я"
                                    >
                                        {m.name}
                                    </div>
                                    <div className="EncounterMonsterRow__stats">
                                        <div className="EncounterMonsterRow__hp">
                                            <input
                                                type="number"
                                                value={m.currentHp}
                                                onChange={(e) => updateMonsterHp(m.instanceId, e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="EncounterMonsterRow__hpInput"
                                                style={{ color: getHpColor(m.currentHp, m.hit_points) }}
                                            />
                                            <span className="muted">/</span>
                                            <input
                                                type="number"
                                                value={m.hit_points}
                                                onChange={(e) => updateMonsterMaxHp(m.instanceId, e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="EncounterMonsterRow__maxHpInput"
                                                title="Максимальне HP"
                                            />
                                        </div>
                                        <div className="EncounterMonsterRow__ac">
                                            AC {m.armor_class}
                                        </div>
                                    </div>
                                </div>
                                <div className="EncounterMonsterRow__actions">
                                    <Button
                                        variant="ghost"
                                        size="small"
                                        icon="plus"
                                        className="EncounterMonsterRow__action"
                                        onClick={(e) => { e.stopPropagation(); duplicateMonster(m); }}
                                        title="Дублювати"
                                    />
                                    <Button
                                        variant="danger"
                                        size="small"
                                        icon="x"
                                        className="EncounterMonsterRow__action"
                                        onClick={(e) => { e.stopPropagation(); removeMonster(m.instanceId); }}
                                        title="Видалити"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="EncounterView__detailView">
                        {selectedInstance ? (
                            <MonsterStatBlock monster={selectedInstance} />
                        ) : (
                            <p className="muted">Оберіть монстра з сітки, щоб побачити його характеристики.</p>
                        )}
                    </div>
                </div>
            </div>

            {showBestiary && ( // Render the generic Modal component
                <Modal
                    title="Вибір монстра"
                    onCancel={() => setShowBestiary(false)}
                    showFooter={false} // Bestiary handles its own add logic
                    type="custom" // Use a custom type for specific styling
                >
                    <Bestiary onAddMonster={handleAddMonster} isEmbedded={true} />
                </Modal>
            )}

            {notification && (
                <Notification
                    message={notification}
                    onClose={() => setNotification(null)}
                />
            )}
        </Panel>
    );
}