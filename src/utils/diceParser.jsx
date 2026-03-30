import React from 'react'; // Keep this import as JSX is used
import ReactMarkdown from 'react-markdown';
import RollDice from '../components/RollDice/RollDice';

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

export const parseTextWithRolls = (text) => {
    if (!text) return text;
    // Regex to find dice rolls (e.g., 1d6, 2d8+3) and attack bonuses (e.g., +5 to hit)
    const regex = /(\d+d\d+(?:\s*[+-]\s*\d+)?)|([+-]\d+(?:\s+to\s+hit))/gi;
    const parts = text.split(regex);

    return parts.map((part, i) => {
        if (!part) return null;
        // Handle dice rolls (e.g., 1d6+2)
        if (part.match(/^\d+d\d+/i)) {
            return <RollDice key={i} formula={part.replace(/\s+/g, '')}>{part}</RollDice>;
        }

        // Handle attack bonuses (e.g., +5 to hit)
        if (part.match(/^[+-]\d+\s+to\s+hit$/i)) {
            const bonus = part.split(' ')[0];
            return <RollDice key={i} formula={`1d20${formatModifier(parseInt(bonus))}`}>{part}</RollDice>;
        }

        // Render other text via ReactMarkdown.
        // components={{ p: 'span' }} allows text to stay inline.
        return <ReactMarkdown key={i} components={{ p: 'span' }}>{part}</ReactMarkdown>;
    });
};