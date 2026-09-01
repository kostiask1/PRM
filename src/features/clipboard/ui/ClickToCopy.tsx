import { useState } from "react";
import type { MouseEventHandler, ReactNode } from "react";

import "../../../assets/components/ClickToCopy.css";
import { classNames, lang } from "../../../shared/lib/index.js";
import { Notification, Tooltip } from "../../../shared/ui/index.js";

export interface ClickToCopyProps {
	text: string;
	children: ReactNode;
	message?: string;
	className?: string;
	onContextMenu?: MouseEventHandler<HTMLDivElement>;
}

/** Copies display text and reports successful clipboard writes. */
export default function ClickToCopy({
	text,
	children,
	message,
	className = "",
	onContextMenu,
}: ClickToCopyProps) {
	const [notification, setNotification] = useState<string | null>(null);

	const handleCopy: MouseEventHandler<HTMLDivElement> = (event) => {
		event.stopPropagation();
		if (!text) return;

		void navigator.clipboard.writeText(text).then(() => {
			setNotification(
				message ||
					lang.t('\"{text}\" copied!', {
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
