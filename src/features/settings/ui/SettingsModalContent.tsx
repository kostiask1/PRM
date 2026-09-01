import "../../../assets/components/SettingsModal.css";
import SettingsModalView from "./SettingsModalView.tsx";
import type {
	SettingsModalCompositionSlots,
	SettingsModalContentComponent,
	SettingsModalContentProps,
} from "./settingsModalComposition.ts";
import { useSettingsModalController } from "./useSettingsModalController.ts";

type SettingsModalContentInternalProps = SettingsModalContentProps &
	SettingsModalCompositionSlots;

function SettingsModalContent({
	onCancel,
	runtime,
	EditableField,
}: SettingsModalContentInternalProps) {
	const viewProps = useSettingsModalController(onCancel, runtime);
	return <SettingsModalView {...viewProps} EditableField={EditableField} />;
}

export function createSettingsModalContentComponent({
	EditableField,
}: SettingsModalCompositionSlots): SettingsModalContentComponent {
	function ConfiguredSettingsModalContent(props: SettingsModalContentProps) {
		return (
			<SettingsModalContent {...props} EditableField={EditableField} />
		);
	}

	return ConfiguredSettingsModalContent;
}
