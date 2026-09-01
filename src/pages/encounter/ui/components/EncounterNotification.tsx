import { Notification } from "../../../../shared/ui/index.js";

interface EncounterNotificationProps {
	message: string | null;
	onClose: () => void;
}

export default function EncounterNotification({
	message,
	onClose,
}: EncounterNotificationProps) {
	return message ? <Notification message={message} onClose={onClose} /> : null;
}
