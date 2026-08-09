import type { ReactElement } from "react";

export interface SettingsModalContentProps {
	onCancel: () => void;
}

export interface SettingsModalEditableFieldChangeEvent {
	target: { value: string };
}

export interface SettingsModalEditableFieldSlotProps {
	type: "textarea";
	className: string;
	value: string;
	onChange: (event: SettingsModalEditableFieldChangeEvent) => void;
	placeholder: string;
	disabled: boolean;
}

export type SettingsModalEditableFieldSlot = (
	props: SettingsModalEditableFieldSlotProps,
) => ReactElement | null;

export interface SettingsModalCompositionSlots {
	EditableField: SettingsModalEditableFieldSlot;
}

export type SettingsModalContentComponent = (
	props: SettingsModalContentProps,
) => ReactElement | null;
