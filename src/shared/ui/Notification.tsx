import { useEffect } from "react";
import type { ReactNode } from "react";
import "../../assets/components/Notification.css";

export interface NotificationProps {
	message: ReactNode;
	onClose: () => void;
	duration?: number;
}

export default function Notification({
	message,
	onClose,
	duration = 3000,
}: NotificationProps) {
	useEffect(() => {
		const timer = setTimeout(onClose, duration);
		return () => clearTimeout(timer);
	}, [onClose, duration]);

	return <div className="Notification">{message}</div>;
}
