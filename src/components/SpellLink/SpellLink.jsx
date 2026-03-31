import React from 'react';
import './SpellLink.css';

export default function SpellLink({ children, onClick }) {
    return (
        <span className="SpellLink" onClick={onClick}>
            {children}
        </span>
    );
}