import { useState } from "react";
import Notification from "./Notification";
import Tooltip from "./Tooltip";
import "../../assets/components/ClickToCopy.css";
import classNames from "../../utils/classNames";
import { lang } from "../../services/localization";

/**
 * Generic component for copying text to the clipboard.
 * Encapsulates copy logic and notification display.
 */
export default function ClickToCopy({
	text,
	children,
	message,
	className = "",
	onContextMenu,
}) {
	const [notification, setNotification] = useState(null);

	const handleCopy = (e) => {
		e.stopPropagation();
		if (!text) return;

		navigator.clipboard.writeText(text).then(() => {
			setNotification(
				message ||
					lang.t('"{text}" copied!', {
						text,
					}),
			);
		});
	};

	return (
		<>
			<Tooltip content={lang.t("Click to copy")}>
				<div
					className={classNames("ClickToCopy", className)}
					onClick={handleCopy}
					onContextMenu={onContextMenu}
				>
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
