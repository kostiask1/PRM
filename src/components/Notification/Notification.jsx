import { useEffect } from 'react';
import './Notification.css';

export default function Notification({ message, onClose, duration = 3000 }) {
    useEffect(() => {
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [onClose, duration]);

    return (
        <div className="Notification">
            {message}
        </div>
    );
}