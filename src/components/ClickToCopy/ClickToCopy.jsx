import { useState } from 'react';
import Notification from '../Notification/Notification';
import './ClickToCopy.css';

/**
 * Універсальний компонент для копіювання тексту в буфер обміну.
 * Інкапсулює в собі логіку копіювання та показ сповіщення.
 */
export default function ClickToCopy({ text, children, message, className = "" }) {
    const [notification, setNotification] = useState(null);

    const handleCopy = (e) => {
        e.stopPropagation();
        if (!text) return;

        navigator.clipboard.writeText(text).then(() => {
            setNotification(message || `"${text}" скопійовано!`);
        });
    };

    return (
        <>
            <div 
                className={`ClickToCopy ${className}`} 
                onClick={handleCopy}
                title="Натисніть, щоб скопіювати"
            >
                {children}
            </div>
            {notification && (
                <Notification message={notification} onClose={() => setNotification(null)} />
            )}
        </>
    );
}