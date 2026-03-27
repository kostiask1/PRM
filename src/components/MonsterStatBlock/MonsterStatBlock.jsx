import React, { useState, useEffect } from 'react';
import RollDice from '../RollDice/RollDice';
import Icon from '../Icon';
import './MonsterStatBlock.css';

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

const parseTextWithRolls = (text) => {
    if (!text) return text;
    const regex = /(\d+d\d+(?:\s*[+-]\s*\d+)?)|([+-]\d+(?:\s+to\s+hit))/gi;
    const parts = text.split(regex);

    return parts.map((part, i) => {
        if (!part) return null;
        if (part.match(/^\d+d\d+/i)) {
            return <RollDice key={i} formula={part.replace(/\s+/g, '')}>{part}</RollDice>;
        }
        if (part.match(/^[+-]\d+\s+to\s+hit$/i)) {
            const bonus = part.split(' ')[0];
            return <RollDice key={i} formula={`1d20${formatModifier(parseInt(bonus))}`}>{part}</RollDice>;
        }
        return part;
    });
};

export default function MonsterStatBlock({ monster, onNameClick, nameTitle }) {
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        setImageError(false);
    }, [monster]);

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

    const renderAbility = (label, value) => {
        const mod = getAbilityModifier(value);
        return (
            <div 
                className="Bestiary__ability-box" 
                onClick={() => window.dispatchEvent(new CustomEvent('rollDice', { detail: `1d20${formatModifier(mod)}` }))}
                title={`Кинути перевірку ${label}`}
            >
                <span className="ability-label">{label}</span>
                <span className="ability-mod">{formatModifier(mod)}</span>
                <span className="ability-score">{value}</span>
            </div>
        );
    };

    return (
        <div className="Bestiary__details">
            <h3 className="Bestiary__monster-name" onClick={() => onNameClick?.(monster)} title={nameTitle}>
                {monster.name}
            </h3>
            <div className="Bestiary__header-row">
                <div className="Bestiary__stats">
                    <div className="stat-item"><strong>HP:</strong> {monster.hit_points} (<RollDice formula={monster.hit_dice} />)</div>
                    <div className="stat-item"><strong>AC:</strong> {monster.armor_class} ({monster.armor_desc})</div>
                    <div className="stat-item"><strong>Speed:</strong> {Object.entries(monster.speed || {}).map(([k, v]) => `${k} ${v}`).join(', ')}</div>
                    <div className="stat-item"><strong>Type:</strong> {monster.type}</div>
                </div>
                <div className="Bestiary__token-wrapper">
                    {!imageError ? (
                        <img src={`https://5e.tools/img/bestiary/tokens/MM/${monster.name}.webp`} alt={monster.name} className="Bestiary__token" onError={() => setImageError(true)} />
                    ) : (
                        <div className="Bestiary__token-skeleton"><Icon name="d20" /></div>
                    )}
                </div>
            </div>
            <div className="Bestiary__abilities">
                {renderAbility('STR', monster.strength)}
                {renderAbility('DEX', monster.dexterity)}
                {renderAbility('CON', monster.constitution)}
                {renderAbility('INT', monster.intelligence)}
                {renderAbility('WIS', monster.wisdom)}
                {renderAbility('CHA', monster.charisma)}
            </div>
            <div className="Bestiary__properties">
                {monster.damage_immunities && <div className="Bestiary__damage"><strong>Damage Immunities:</strong> {monster.damage_immunities}</div>}
                {monster.damage_vulnerabilities && <div className="Bestiary__damage"><strong>Damage Vulnerabilities:</strong> {monster.damage_vulnerabilities}</div>}
                {monster.damage_resistances && <div className="Bestiary__damage"><strong>Damage Resistances:</strong> {monster.damage_resistances}</div>}
                <div className="Bestiary__description">
                    <p><strong>Senses:</strong> {monster.senses}</p>
                    <p><strong>Languages:</strong> {monster.languages}</p>
                </div>
            </div>
            {renderActionList(monster.special_abilities, 'Special Abilities')}
            {renderActionList(monster.actions, 'Actions')}
            {renderActionList(monster.reactions, 'Reactions')}
            {renderActionList(monster.legendary_actions, 'Legendary Actions')}
        </div>
    );
}