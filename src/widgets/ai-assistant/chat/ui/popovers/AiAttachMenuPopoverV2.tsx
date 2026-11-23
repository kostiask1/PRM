import { useRef } from "react";
import { lang } from "../../../../../shared/lib/index.js";
import { useDismissablePopover } from "./useDismissablePopover.ts";

interface AiAttachMenuPopoverV2Props {
	isOpen: boolean;
	onClose: () => void;
	onChooseFromGallery: () => void;
	onChooseFromDevice: () => void;
	imageOnly?: boolean;
	disabled?: boolean;
}

/**
 * Popover menu above the composer attachment button allowing the user to pick
 * an image from the campaign/app gallery or upload a file from their device.
 */
export default function AiAttachMenuPopoverV2({
	isOpen,
	onClose,
	onChooseFromGallery,
	onChooseFromDevice,
	imageOnly = false,
	disabled = false,
}: AiAttachMenuPopoverV2Props) {
	const ref = useRef<HTMLDivElement>(null);

	useDismissablePopover({
		isOpen,
		popoverRef: ref,
		triggerSelector: ".AiChatComposerV2__attachBtn",
		onClose,
	});

	if (!isOpen) return null;

	const deviceSubtitle = imageOnly
		? lang.t("Upload PNG, JPG or WebP")
		: lang.t("Images, PDF, Markdown or text");

	return (
		<div
			className="AiAttachMenuPopoverV2"
			ref={ref}
			role="menu"
			aria-label={lang.t("Attach file")}
		>
			<div className="AiAttachMenuPopoverV2__list">
				<button
					type="button"
					role="menuitem"
					className="AiAttachMenuPopoverV2__item"
					disabled={disabled}
					onClick={() => {
						onClose();
						onChooseFromGallery();
					}}
				>
					<span
						className="AiAttachMenuPopoverV2__itemIcon AiAttachMenuPopoverV2__itemIcon--gallery"
						aria-hidden="true"
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
							<circle cx="8.5" cy="8.5" r="1.5" />
							<polyline points="21 15 16 10 5 21" />
						</svg>
					</span>
					<span className="AiAttachMenuPopoverV2__itemBody">
						<span className="AiAttachMenuPopoverV2__itemTitle">
							{lang.t("Choose from gallery")}
						</span>
						<span className="AiAttachMenuPopoverV2__itemSub">
							{lang.t("Campaign images & library")}
						</span>
					</span>
				</button>

				<button
					type="button"
					role="menuitem"
					className="AiAttachMenuPopoverV2__item"
					disabled={disabled}
					onClick={() => {
						onClose();
						onChooseFromDevice();
					}}
				>
					<span
						className="AiAttachMenuPopoverV2__itemIcon AiAttachMenuPopoverV2__itemIcon--device"
						aria-hidden="true"
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
							<polyline points="17 8 12 3 7 8" />
							<line x1="12" y1="3" x2="12" y2="15" />
						</svg>
					</span>
					<span className="AiAttachMenuPopoverV2__itemBody">
						<span className="AiAttachMenuPopoverV2__itemTitle">
							{lang.t("File from device")}
						</span>
						<span className="AiAttachMenuPopoverV2__itemSub">
							{deviceSubtitle}
						</span>
					</span>
				</button>
			</div>

			<div className="AiAttachMenuPopoverV2__hint">
				{lang.t("Ctrl+V also pastes images from clipboard")}
			</div>
		</div>
	);
}
