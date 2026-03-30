import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import RollDice from '../RollDice/RollDice';
import Icon from '../Icon';
import SpellCard from '../SpellCard/SpellCard';
import './MonsterStatBlock.css';

const SPELL_CACHE = new Map();

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
    // Залишаємо в регулярному виразі лише кубики та бонуси атаки
    const regex = /(\d+d\d+(?:\s*[+-]\s*\d+)?)|([+-]\d+(?:\s+to\s+hit))/gi;
    const parts = text.split(regex);

    return parts.map((part, i) => {
        if (!part) return null;
        // Обробка кубиків (напр. 1d6+2)
        if (part.match(/^\d+d\d+/i)) {
            return <RollDice key={i} formula={part.replace(/\s+/g, '')}>{part}</RollDice>;
        }

        // Обробка бонусів атаки (напр. +5 to hit)
        if (part.match(/^[+-]\d+\s+to\s+hit$/i)) {
            const bonus = part.split(' ')[0];
            return <RollDice key={i} formula={`1d20${formatModifier(parseInt(bonus))}`}>{part}</RollDice>;
        }

        // Рендеримо текст через ReactMarkdown. 
        // components={{ p: 'span' }} дозволяє тексту залишатися в лінію, не створюючи зайвих відступів.
        return (
            <ReactMarkdown key={i} components={{ p: 'span' }}>
                {part}
            </ReactMarkdown>
        );
    });
};

export default function MonsterStatBlock({ monster, onNameClick, nameTitle, modal }) {
    const [imageStatus, setImageStatus] = useState('primary'); // 'primary' | 'fallback' | 'none'
    const [spells, setSpells] = useState([]);
    const [loadingSpells, setLoadingSpells] = useState(false);

    useEffect(() => {
        setImageStatus('primary');
        setSpells([]);

        if (monster.spell_list && monster.spell_list.length > 0) {
            const fetchSpells = async () => {
                setLoadingSpells(true);
                try {
                    console.log('monster.spell_list:', monster.spell_list)
                    const loaded = await Promise.all(
                        monster.spell_list.map(async (url) => {
                            console.log('url:', url)
                            const fixUrl = url.replace("https://api.open5e.com/v2/spells", "https://www.dnd5eapi.co/api/2014/spells");

                            if (SPELL_CACHE.has(url)) return SPELL_CACHE.get(fixUrl);
                            const res = await fetch(fixUrl);
                            const data = await res.json();
                            SPELL_CACHE.set(fixUrl, data);
                            return data;
                        })
                    );
                    setSpells(loaded.filter(Boolean));
                } catch (e) {
                    console.error("Error loading monster spells", e);
                } finally {
                    setLoadingSpells(false);
                }
            };
            fetchSpells();
        }
    }, [monster]);

    const renderActionList = (actions, title) => {
        if (!actions || actions.length === 0) return null;
        return (
            <div className="MonsterStatBlock__section">
                <h4>{title}:</h4>
                {actions.map((action, index) => (
                    <div key={index} className="MonsterStatBlock__action">
                        <strong>{action.name}.</strong> {parseTextWithRolls(action.desc)}
                        <div className="MonsterStatBlock__action-rolls">
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
                className="MonsterStatBlock__ability-box"
                onClick={() => window.dispatchEvent(new CustomEvent('rollDice', { detail: `1d20${formatModifier(mod)}` }))}
                title={`Кинути перевірку ${label}`}
            >
                <span className="ability-label">{label}</span>
                <span className="ability-mod">{formatModifier(mod)}</span>
                <span className="ability-score">{value}</span>
            </div>
        );
    };

    const renderSaves = () => {
        const saveNames = {
            strength_save: 'Str',
            dexterity_save: 'Dex',
            constitution_save: 'Con',
            intelligence_save: 'Int',
            wisdom_save: 'Wis',
            charisma_save: 'Cha'
        };

        const activeSaves = Object.entries(saveNames)
            .filter(([key]) => monster[key] !== null && monster[key] !== undefined)
            .map(([key, label], idx, arr) => (
                <React.Fragment key={key}>
                    {label} <RollDice formula={`1d20${formatModifier(monster[key])}`}>{formatModifier(monster[key])}</RollDice>
                    {idx < arr.length - 1 ? ', ' : ''}
                </React.Fragment>
            ));

        if (activeSaves.length === 0) return null;
        return <div className="MonsterStatBlock__property-item"><strong>Saving Throws:</strong> {activeSaves}</div>;
    };

    const renderSpellcasting = () => {
        if (loadingSpells) return <div className="MonsterStatBlock__section"><p className="muted">Завантаження заклинань...</p></div>;
        if (spells.length === 0) return null;

        const levels = spells.reduce((acc, s) => {
            const lvl = s.level_int !== undefined ? s.level_int : s.level;
            const key = lvl === 0 ? '0' : lvl.toString();
            if (!acc[key]) acc[key] = [];
            acc[key].push(s);
            return acc;
        }, {});

        const sortedLevels = Object.keys(levels).sort((a, b) => parseInt(a) - parseInt(b));

        return (
            <div className="MonsterStatBlock__section MonsterStatBlock__spells">
                <h4>Заклинання (Spells):</h4>
                {sortedLevels.map(lvl => (
                    <div key={lvl} style={{ marginBottom: '4px', lineHeight: '1.4' }}>
                        <strong>{lvl === "0" ? 'Замовляння' : `${lvl}-й рівень`}:</strong>{' '}
                        {levels[lvl].map((s, i) => (
                            <React.Fragment key={s.slug || s.name}>
                                <span 
                                    style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                                    onClick={() => modal?.confirm(s.name, <SpellCard spell={s} />)}
                                >
                                    {s.name}
                                </span>
                                {i < levels[lvl].length - 1 ? ', ' : ''}
                            </React.Fragment>
                        ))}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="MonsterStatBlock">
            <h3 className="MonsterStatBlock__name" onClick={() => onNameClick?.(monster)} title={nameTitle}>
                {monster.name}
            </h3>
            <div className="MonsterStatBlock__header">
                <div className="MonsterStatBlock__stats">
                    <div className="stat-item"><strong>HP:</strong> {monster.hit_points} (<RollDice formula={monster.hit_dice} />)</div>
                    <div className="stat-item"><strong>AC:</strong> {monster.armor_class}{monster.armor_desc ? ` (${monster.armor_desc})` : ''}</div>
                    <div className="stat-item"><strong>Speed:</strong> {Object.entries(monster.speed || {}).map(([k, v]) => `${k} ${v}`).join(', ')}</div>
                    <div className="stat-item"><strong>Type:</strong> {monster.type}</div>
                </div>
                <div className="MonsterStatBlock__token-wrapper">
                    {imageStatus === 'primary' && (
                        <img 
                            src={`https://5e.tools/img/bestiary/tokens/MM/${monster.name}.webp`} 
                            alt={monster.name} 
                            className="MonsterStatBlock__token" 
                            onError={() => setImageStatus('fallback')} 
                        />
                    )}
                    {imageStatus === 'fallback' && (
                        <img 
                            src={`https://www.dnd5eapi.co/api/images/monsters/${monster.slug}.png`} 
                            alt={monster.name} 
                            className="MonsterStatBlock__token" 
                            onError={() => setImageStatus('none')} 
                        />
                    )}
                    {imageStatus === 'none' && (
                        <div className="MonsterStatBlock__token-skeleton"><Icon name="dice" /></div>
                    )}
                </div>
            </div>
            <div className="MonsterStatBlock__abilities">
                {renderAbility('STR', monster.strength)}
                {renderAbility('DEX', monster.dexterity)}
                {renderAbility('CON', monster.constitution)}
                {renderAbility('INT', monster.intelligence)}
                {renderAbility('WIS', monster.wisdom)}
                {renderAbility('CHA', monster.charisma)}
            </div>
            <div className="MonsterStatBlock__properties">
                {renderSaves()}

                {monster.skills && Object.keys(monster.skills).length > 0 && (
                    <div className="MonsterStatBlock__property-item MonsterStatBlock__property-item--skills">
                        <strong>Skills:</strong> {Object.entries(monster.skills).map(([name, value], idx, arr) => (
                            <React.Fragment key={name}>
                                <span className="skill-name">{name}</span>{' '}
                                <RollDice formula={`1d20${formatModifier(value)}`}>{formatModifier(value)}</RollDice>
                                {idx < arr.length - 1 ? ', ' : ''}
                            </React.Fragment>
                        ))}
                    </div>
                )}

                {monster.damage_immunities && <div className="MonsterStatBlock__property-item"><strong>Damage Immunities:</strong> {monster.damage_immunities}</div>}
                {monster.damage_vulnerabilities && <div className="MonsterStatBlock__property-item"><strong>Damage Vulnerabilities:</strong> {monster.damage_vulnerabilities}</div>}
                {monster.damage_resistances && <div className="MonsterStatBlock__property-item"><strong>Damage Resistances:</strong> {monster.damage_resistances}</div>}
                <div className="MonsterStatBlock__description">
                    <p><strong>Senses:</strong> {monster.senses}</p>
                    <p><strong>Languages:</strong> {monster.languages}</p>
                </div>
                {monster.desc && (
                    <div className="MonsterStatBlock__lore">
                        {parseTextWithRolls(monster.desc)}
                    </div>
                )}
            </div>
            {renderSpellcasting()}
            {renderActionList(monster.special_abilities, 'Special Abilities')}
            {renderActionList(monster.actions, 'Actions')}
            {renderActionList(monster.reactions, 'Reactions')}
            {renderActionList(monster.legendary_actions, 'Legendary Actions')}
        </div>
    );
}