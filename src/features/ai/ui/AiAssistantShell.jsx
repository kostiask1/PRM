import Icon from "../../../components/common/Icon.jsx";
import Modal from "../../../components/common/Modal.jsx";
import Notification from "../../../components/common/Notification.jsx";
import Tooltip from "../../../components/common/Tooltip.jsx";

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
