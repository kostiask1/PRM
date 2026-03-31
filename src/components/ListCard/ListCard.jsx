
import './ListCard.css';

export default function ListCard({
    children, // Основний контент картки (назва, мета)
    actions,  // Елементи дій праворуч (бейдж статусу, кнопки)
    active = false,
    dragging = false,
    onClick,
    href,
    className = '',
    ...dragProps // Пропси для drag-and-drop (draggable, onDragStart, etc.)
}) {
    const combinedClassName = `ListCard ${active ? 'ListCard--active' : ''} ${dragging ? 'ListCard--dragging' : ''} ${className}`.trim();

    const handleClick = (e) => {
        if (href && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
            e.preventDefault();
            if (onClick) onClick();
        } else if (!href && onClick) {
            onClick();
        }
    };

    const Component = href ? 'a' : 'button';

    return (
        <article
            className={combinedClassName}
            {...dragProps}
        >
            <Component
                className="ListCard__main"
                onClick={handleClick}
                href={href}
            >
                {children}
            </Component>
            {actions && <div className="ListCard__actions">{actions}</div>}
        </article>
    );
}