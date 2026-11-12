import type { ReactNode } from "react";

import { lang } from "../../../shared/lib/index.js";

import {
	Icon,
	Modal,
	Notification,
	Tooltip,
} from "../../../shared/ui/index.js";

export interface AiAssistantShellProps {
	children?: ReactNode;
	imagePromptModal?: ReactNode;
	isLoading: boolean;
	isOpen: boolean;
	notification?: ReactNode;
	onClose: () => void;
	onCloseNotification: () => void;
	onOpen: () => void;
	title: ReactNode;
}

export default function AiAssistantShell({
	children,
	imagePromptModal,
	isLoading,
	isOpen,
	notification,
	onClose,
	onCloseNotification,
	onOpen,
	title,
}: AiAssistantShellProps) {
	return (
		<div className="AiAssistant">
			<Tooltip className="AiAssistantPanel__toggle" content={title}>
				<button type="button" aria-label={typeof title === "string" ? title : lang.t("AI assistant")} aria-haspopup="dialog" aria-expanded={isOpen} onClick={onOpen}>
					<Icon name="wand" size={28} />
				</button>
			</Tooltip>

			{isOpen && (
				<Modal
					title={title}
					className="AiAssistantPanel__main_modal"
					onConfirm={() => {}}
					onCancel={onClose}
					showFooter={false}
					cancelDisabled={isLoading}
				>
					<div>{children}</div>
				</Modal>
			)}

			{imagePromptModal}

			{notification && (
				<Notification message={notification} onClose={onCloseNotification} />
			)}
		</div>
	);
}
