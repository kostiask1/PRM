// Keep this import as JSX is used
import ReactMarkdown from 'react-markdown';
import RollDice from '../components/RollDice/RollDice';
import SpellLink from '../components/SpellLink/SpellLink';

export const getAbilityModifier = (abilityScore) => {
    const score = parseInt(abilityScore, 10);
    if (isNaN(score)) return 0;
    return Math.floor((score - 10) / 2);
};

export const formatModifier = (modifier) => {
    if (modifier === 0) return '+0';
    return modifier > 0 ? `+${modifier}` : `${modifier}`;
};

export const getDamageBonus = (action) => {
    const bonus = parseInt(action?.damage_bonus);
    if (!bonus || isNaN(bonus)) return '';
    return bonus > 0 ? `+${bonus}` : `${bonus}`;
};

export const parseRollsAndSpells = (text, onSpellClick) => {
    if (!text) return text;
    // Regex для пошуку кубиків, бонусів атаки, посилань {@spell Name} та Markdown посилань [Name](URL)
    const regex = /(\d+d\d+(?:\s*[+-]\s*\d+)?)|([+-]\d+(?:\s+to\s+hit))|(\{@spell\s+([^}]+)\})|(\[([^\]]+)\]\((?:https?:\/\/[^\s)]+\/spells\/)([^\/)]+)\/?\))/gi;
    const parts = text.split(regex);

    const elements = [];
    for (let i = 0; i < parts.length; i += 8) {
        if (parts[i]) elements.push(<ReactMarkdown key={`t-${i}`} components={{ p: 'span' }}>{parts[i]}</ReactMarkdown>);

        if (i + 1 < parts.length) {
            const roll = parts[i + 1];
            const hit = parts[i + 2];
            const spellFull = parts[i + 3];
            const spellName = parts[i + 4];
            const mdLinkFull = parts[i + 5];
            const mdLinkText = parts[i + 6];
            const mdLinkSlug = parts[i + 7];

            if (roll) {
                elements.push(<RollDice key={`r-${i}`} formula={roll.replace(/\s+/g, '')}>{roll}</RollDice>);
            } else if (hit) {
                const bonus = hit.split(' ')[0];
                elements.push(<RollDice key={`h-${i}`} formula={`1d20${formatModifier(parseInt(bonus))}`}>{hit}</RollDice>);
            } else if (spellFull && onSpellClick) {
                elements.push(
                    <SpellLink key={`s-${i}`} onClick={() => onSpellClick(spellName)}>
                        {spellName}
                    </SpellLink>
                );
            } else if (mdLinkFull && onSpellClick) {
                elements.push(
                    <SpellLink key={`m-${i}`} onClick={() => onSpellClick(mdLinkSlug)}>
                        {mdLinkText}
                    </SpellLink>
                );
            }
        }
    }
    return elements;
};