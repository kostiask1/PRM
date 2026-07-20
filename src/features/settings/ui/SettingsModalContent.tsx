import "../../../assets/components/SettingsModal.css";
import SettingsModalView from "./SettingsModalView.tsx";
import { useSettingsModalController } from "./useSettingsModalController.ts";

export interface SettingsModalContentProps {
	onCancel: () => void;
}

export default function SettingsModalContent({
	onCancel,
}: SettingsModalContentProps) {
	const viewProps = useSettingsModalController(onCancel);
	return <SettingsModalView {...viewProps} />;
}
