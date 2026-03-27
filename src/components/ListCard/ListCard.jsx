import React from 'react';
import './ListCard.css';

export default function ListCard({
    children, // Основний контент картки (назва, мета)
    actions,  // Елементи дій праворуч (бейдж статусу, кнопки)
    active = false,
    dragging = false,
    onClick,
    className = '',
    ...dragProps // Пропси для drag-and-drop (draggable, onDragStart, etc.)
}) {
    const combinedClassName = `ListCard ${active ? 'ListCard--active' : ''} ${dragging ? 'ListCard--dragging' : ''} ${className}`.trim();

    return (
        <article
            className={combinedClassName}
            {...dragProps}
        >
            <button className="ListCard__main" onClick={onClick}>
                {children}
            </button>
            {actions && <div className="ListCard__actions">{actions}</div>}
        </article>
    );
}