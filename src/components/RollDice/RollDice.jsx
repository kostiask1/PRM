import React from 'react';
import './RollDice.css';

export default function RollDice({ formula, children }) {
    const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('rollDice', { detail: formula }));
    };

    return (
        <span className="RollDice" onClick={handleClick} title={`Кинути ${formula}`}>
            {children || formula}
        </span>
    );
}