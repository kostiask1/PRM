import { Icon } from "../../../shared/ui/index.js";
import { Modal } from "../../modal/index.js";
import { Notification } from "../../../shared/ui/index.js";
import { Tooltip } from "../../../shared/ui/index.js";

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
}) {
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
