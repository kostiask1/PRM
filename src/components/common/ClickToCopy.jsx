import { useState } from "react";
import Notification from "./Notification";
import Tooltip from "./Tooltip";
import "../../assets/components/ClickToCopy.css";
import classNames from "../../utils/classNames";

/**
 * Універсальний компонент для копіювання тексту в буфер обміну.
 * Інкапсулює в собі логіку копіювання та показ сповіщення.
 */
export default function ClickToCopy({
	text,
	children,
	message,
	className = "",
}) {
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
			<Tooltip content="Натисніть, щоб скопіювати">
				<div
					className={classNames("ClickToCopy", className)}
					onClick={handleCopy}>
					{children}
				</div>
			</Tooltip>
			{notification && (
				<Notification
					message={notification}
					onClose={() => setNotification(null)}
				/>
			)}
		</>
	);
}
