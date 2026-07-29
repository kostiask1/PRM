import type { ReactNode } from "react";

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
			<Tooltip className="AiAssistant__toggle" content={title}>
				<button onClick={onOpen}>
					<Icon name="wand" size={28} />
				</button>
			</Tooltip>

			{isOpen && (
				<Modal
					title={title}
					className="AiAssistant__main_modal"
					onConfirm={() => {}}
					onCancel={onClose}
					showFooter={false}
					cancelDisabled={isLoading}
				>
					<div className="AiAssistant__content">{children}</div>
				</Modal>
			)}

			{imagePromptModal}

			{notification && (
				<Notification message={notification} onClose={onCloseNotification} />
			)}
		</div>
	);
}
