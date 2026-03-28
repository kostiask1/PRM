import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import Panel from '../Panel/Panel';
import Button from '../Button/Button';
import ListCard from '../ListCard/ListCard';
import Bestiary from '../Bestiary/Bestiary';
import MonsterStatBlock from '../MonsterStatBlock/MonsterStatBlock';
import Notification from '../Notification/Notification';
import './EncounterView.css';
import Icon from '../Icon';

export default function EncounterView({ campaign, sessionId, encounterId, onBack, onRefreshCampaigns, modal }) {
    const [encounter, setEncounter] = useState(null);
    const [selectedInstance, setSelectedInstance] = useState(null);
    const [showBestiary, setShowBestiary] = useState(false);
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        const loadEncounter = async () => {
            try {
                const session = await api.getSession(campaign.slug, sessionId);
                // Очікувана структура: session.data.encounters = [{ id, name, monsters: [] }]
                const found = (session.data.encounters || []).find(e => e.id.toString() === encounterId.toString());
                setEncounter(found);
            } catch (err) {
                console.error("Failed to load encounter", err);
            }
        };
        loadEncounter();
    }, [campaign.slug, sessionId, encounterId]);

    const saveEncounterState = async (updatedEncounter) => {
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

    const handleAddMonster = async (m) => {
        if (!encounter) return;
        
        try {
            // Fetch full monster data because search results are often truncated
            // We use the slug to get the complete stat block
            const response = await fetch(`https://api.open5e.com/monsters/${m.slug}/`);
            const fullData = await response.json();

            const newMonster = {
                ...fullData, 
                instanceId: `inst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                currentHp: fullData.hit_points || 0,
            };

            const updated = { ...encounter, monsters: [...encounter.monsters, newMonster] };
            setEncounter(updated);
            saveEncounterState(updated);
            
            setShowBestiary(false); // Close modal after adding
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
        saveEncounterState(updated);
    };

    const updateMonsterMaxHp = (instanceId, newMaxHp) => {
        const updatedMonsters = encounter.monsters.map(m => 
            m.instanceId === instanceId ? { ...m, hit_points: parseInt(newMaxHp) || 0 } : m
        );
        const updated = { ...encounter, monsters: updatedMonsters };
        setEncounter(updated);
        if (selectedInstance?.instanceId === instanceId) setSelectedInstance(updatedMonsters.find(m => m.instanceId === instanceId));
        saveEncounterState(updated);
    };

    const handleRename = async () => {
        const name = await modal.prompt("Перейменування", "Вкажіть нову назву зіткнення:", encounter.name);
        if (name && name !== encounter.name) {
            const updated = { ...encounter, name };
            setEncounter(updated);
            saveEncounterState(updated);
        }
    };

    const getHpColor = (current, max) => {
        const ratio = max > 0 ? Math.min(Math.max(0, current / max), 1) : 0;
        const hue = ratio * 120; // 120 - зелений, 0 - червоний
        return `hsl(${hue}, 80%, 60%)`;
    };

    if (!encounter) return <Panel className="EncounterView"><div className="Panel__body">Завантаження...</div></Panel>;

    return (
        <Panel className="EncounterView">
            <div className="Panel__header">
                <div>
                    <h2 className="editable-title" onClick={handleRename} title="Натисніть, щоб перейменувати">
                        {encounter.name}
                    </h2>
                    <p className="muted">Бойове зіткнення • {encounter.monsters.length} монстрів</p>
                </div>
                <Button onClick={onBack} icon="back">Назад до сесії</Button>
            </div>
            <div className="Panel__body EncounterView__body">
                <div className="EncounterView__main">
                    <div className="EncounterView__grid">
                        {encounter.monsters.map(m => (
                            <div 
                                key={m.instanceId} 
                                className={`EncounterMonsterCard ${selectedInstance?.instanceId === m.instanceId ? 'is-active' : ''}`}
                                onClick={() => setSelectedInstance(m)}
                            >
                                <div className="EncounterMonsterCard__header">
                                    <span className="EncounterMonsterCard__name">{m.name}</span>
                                    <Button variant="ghost" size="small" icon="x" onClick={(e) => { e.stopPropagation(); removeMonster(m.instanceId); }} />
                                </div>
                                <div className="EncounterMonsterCard__stats">
                                    <div className="EncounterMonsterCard__stat">
                                        <label>HP</label>
                                        <input 
                                            type="number" 
                                            value={m.currentHp} 
                                            onChange={(e) => updateMonsterHp(m.instanceId, e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{ color: getHpColor(m.currentHp, m.hit_points) }}
                                        />
                                        <span className="muted">/</span>
                                        <input 
                                            type="number" 
                                            value={m.hit_points} 
                                            onChange={(e) => updateMonsterMaxHp(m.instanceId, e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="EncounterMonsterCard__maxHpInput"
                                            title="Максимальне HP"
                                        />
                                    </div>
                                    <div className="EncounterMonsterCard__stat">
                                        <label>AC</label>
                                        <span>{m.armor_class}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        <button className="EncounterView__addSlot" onClick={() => setShowBestiary(true)}>
                            <Icon name="plus" size={32} />
                            <span>Додати монстра</span>
                        </button>
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

            {showBestiary && (
                <div className="EncounterView__modal">
                    <div className="EncounterView__modalContent">
                        <div className="EncounterView__modalHeader">
                            <h3>Вибір монстра</h3>
                            <Button variant="ghost" icon="x" onClick={() => setShowBestiary(false)} />
                        </div>
                        <Bestiary onAddMonster={handleAddMonster} isEmbedded={true} />
                    </div>
                </div>
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