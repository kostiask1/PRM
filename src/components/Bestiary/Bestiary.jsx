import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Panel from '../Panel/Panel';
import Input from '../Input/Input';
import ListCard from '../ListCard/ListCard';
import Button from '../Button/Button';
import RollDice from '../RollDice/RollDice';
import Icon from '../Icon';
import './Bestiary.css';

const getAbilityModifier = (abilityScore) => {
    const score = parseInt(abilityScore, 10);
    if (isNaN(score)) return 0;
    return Math.floor((score - 10) / 2);
};

const formatModifier = (modifier) => {
    if (modifier === 0) return '+0';
    return modifier > 0 ? `+${modifier}` : `${modifier}`;
};

const getDamageBonus = (action) => {
    const bonus = parseInt(action?.damage_bonus);
    if (!bonus || isNaN(bonus)) return '';
    return bonus > 0 ? `+${bonus}` : `${bonus}`;
};

/**
 * Шукає в тексті формули кубиків (2d6 + 4) та бонуси атаки (+8 to hit)
 * і замінює їх на інтерактивні компоненти RollDice.
 */
const parseTextWithRolls = (text) => {
    if (!text) return text;

    // Регулярний вираз для знаходження:
    // 1. Формул кубиків (напр. 1d8, 2d6 + 4)
    // 2. Бонусів атаки (напр. +7 to hit)
    const regex = /(\d+d\d+(?:\s*[+-]\s*\d+)?)|([+-]\d+(?:\s+to\s+hit))/gi;
    const parts = text.split(regex);

    return parts.map((part, i) => {
        if (!part) return null;

        // Перевірка на формулу кубиків
        if (part.match(/^\d+d\d+/i)) {
            return <RollDice key={i} formula={part.replace(/\s+/g, '')}>{part}</RollDice>;
        }
        // Перевірка на бонус атаки
        if (part.match(/^[+-]\d+\s+to\s+hit$/i)) {
            const bonus = part.split(' ')[0];
            return <RollDice key={i} formula={`1d20${formatModifier(parseInt(bonus))}`}>{part}</RollDice>;
        }

        return part;
    });
};



export default function Bestiary() {
    const [monsters, setMonsters] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedMonster, setSelectedMonster] = useState(null);
    const [imageError, setImageError] = useState(false);

    const fetchMonsters = useCallback(async (query = '') => {
        setLoading(true);
        try {
            const url = `https://api.open5e.com/monsters/?search=${query}&limit=20`;
            const response = await fetch(url);
            const data = await response.json();
            const results = data.results || [];
            const sorted = [...results].sort((a, b) => (b.armor_class || 0) - (a.armor_class || 0));
            setMonsters(sorted);
        } catch (error) {
            console.error("Failed to fetch monsters", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchMonsters(search);
        }, 500); // Debounce search

        return () => clearTimeout(timer);
    }, [search, fetchMonsters]);

    useEffect(() => {
        setImageError(false);
    }, [selectedMonster]);

    const renderActionList = (actions, title) => {
        if (!actions || actions.length === 0) return null;
        return (
            <div className="Bestiary__section">
                <h4>{title}:</h4>
                {actions.map((action, index) => (
                    <div key={index} className="Bestiary__ability">
                        <strong>{action.name}.</strong> {parseTextWithRolls(action.desc)}
                        <div className="Bestiary__action-rolls">
                            {action.attack_bonus && (
                                <div className="stat-item">
                                    Atk: <RollDice formula={`1d20${formatModifier(action.attack_bonus)}`}>{formatModifier(action.attack_bonus)}</RollDice>
                                </div>
                            )}                            
                            {action.damage_dice && (
                                <div className="stat-item">Dmg: <RollDice formula={`${action.damage_dice}${getDamageBonus(action)}`} /></div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <Panel className="Bestiary">
            <div className="Panel__header">
                <div>
                    <h2>Бестіарій</h2>
                    <p className="muted">Каталог монстрів Open5e (SRD)</p>
                </div>
            </div>
            <div className="Panel__body">
                <div className="Bestiary__search">
                    <Input 
                        placeholder="Пошук монстра (наприклад, Goblin, Dragon...)" 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="Bestiary__content">
                    <div className="Bestiary__list">
                        {loading && <p className="muted">Завантаження...</p>}
                        {!loading && monsters.length === 0 && <p className="muted">Нічого не знайдено</p>}
                        {monsters.map(monster => (
                            <ListCard 
                                key={monster.slug} 
                                active={selectedMonster?.slug === monster.slug}
                                onClick={() => setSelectedMonster(monster)}
                            >
                                <div className="ListCard__title">{monster.name}</div>
                                <div className="ListCard__meta">CR {monster.challenge_rating} • {monster.size} {monster.type}</div>
                            </ListCard>
                        ))}
                    </div>

                    {selectedMonster && (
                        <div className="Bestiary__details">
                            <h3>{selectedMonster.name}</h3>
                            <div className="Bestiary__header-row">
                                <div className="Bestiary__stats">
                                    <div className="stat-item">
                                        <strong>HP:</strong> {selectedMonster.hit_points} (<RollDice formula={selectedMonster.hit_dice} />)
                                    </div>
                                    <div className="stat-item"><strong>AC:</strong> {selectedMonster.armor_class} ({selectedMonster.armor_desc})</div>
                                    <div className="stat-item"><strong>Speed:</strong> {Object.entries(selectedMonster.speed).map(([k, v]) => `${k} ${v}`).join(', ')}</div>
                                    <div className="stat-item"><strong>Type:</strong> {selectedMonster.type}</div>
                                </div>
                                <div className="Bestiary__token-wrapper">
                                    {!imageError ? (
                                        <img 
                                            src={`https://5e.tools/img/bestiary/tokens/MM/${selectedMonster.name}.webp`} 
                                            alt={selectedMonster.name} 
                                            className="Bestiary__token"
                                            onError={() => setImageError(true)}
                                        />
                                    ) : (
                                        <div className="Bestiary__token-skeleton">
                                            <Icon name="d20" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="Bestiary__abilities">
                                <div onClick={() => window.dispatchEvent(new CustomEvent('rollDice', { detail: `1d20+${getAbilityModifier(selectedMonster.strength)}` }))}>
                                    <strong>STR:</strong> {selectedMonster.strength} ({getAbilityModifier(selectedMonster.strength)})
                                </div>
                                <div onClick={() => window.dispatchEvent(new CustomEvent('rollDice', { detail: `1d20+${getAbilityModifier(selectedMonster.dexterity)}` }))}>
                                    <strong>DEX:</strong> {selectedMonster.dexterity} ({getAbilityModifier(selectedMonster.dexterity)})
                                </div>
                                <div onClick={() => window.dispatchEvent(new CustomEvent('rollDice', { detail: `1d20+${getAbilityModifier(selectedMonster.constitution)}` }))}>
                                    <strong>CON:</strong> {selectedMonster.constitution} ({getAbilityModifier(selectedMonster.constitution)})
                                </div>
                                <div onClick={() => window.dispatchEvent(new CustomEvent('rollDice', { detail: `1d20+${getAbilityModifier(selectedMonster.intelligence)}` }))}>
                                    <strong>INT:</strong> {selectedMonster.intelligence} ({getAbilityModifier(selectedMonster.intelligence)})
                                </div>
                                <div onClick={() => window.dispatchEvent(new CustomEvent('rollDice', { detail: `1d20+${getAbilityModifier(selectedMonster.wisdom)}` }))}>
                                    <strong>WIS:</strong> {selectedMonster.wisdom} ({getAbilityModifier(selectedMonster.wisdom)})
                                </div>
                                <div onClick={() => window.dispatchEvent(new CustomEvent('rollDice', { detail: `1d20+${getAbilityModifier(selectedMonster.charisma)}` }))}>
                                    <strong>CHA:</strong> {selectedMonster.charisma} ({getAbilityModifier(selectedMonster.charisma)})
                                </div>
                            </div>

                            {selectedMonster.damage_immunities && (
                                <div className="Bestiary__damage">
                                    <strong>Damage Immunities:</strong> {selectedMonster.damage_immunities}
                                </div>
                            )}

                            {selectedMonster.damage_vulnerabilities && (
                                <div className="Bestiary__damage">
                                    <strong>Damage Vulnerabilities:</strong> {selectedMonster.damage_vulnerabilities}
                                </div>
                            )}

                            {selectedMonster.damage_resistances && (
                                <div className="Bestiary__damage">
                                    <strong>Damage Resistances:</strong> {selectedMonster.damage_resistances}
                                </div>
                            )}

                            <div className="Bestiary__description">
                                <p><strong>Senses:</strong> {selectedMonster.senses}</p>
                                <p><strong>Languages:</strong> {selectedMonster.languages}</p>
                            </div>

                            {renderActionList(selectedMonster.special_abilities, 'Special Abilities')}
                            {renderActionList(selectedMonster.actions, 'Actions')}
                            {renderActionList(selectedMonster.reactions, 'Reactions')}
                            {renderActionList(selectedMonster.legendary_actions, 'Legendary Actions')}
                            
                        </div>
                    )}
                </div>
            </div>
        </Panel>
    );
}