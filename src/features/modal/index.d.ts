import type { ComponentType } from "react";

import type {
	ModalApi,
	ModalProps,
	SetModalApiConfig,
} from "./model.ts";

export type {
	ModalApi,
	ModalApiConfig,
	ModalConfirmInput,
	ModalKeyboardPlan,
	ModalProps,
	ModalType,
	ResolvedModalApiConfig,
	SetModalApiConfig,
} from "./model.ts";

export type ModalComponent = ComponentType<ModalProps> & {
	createApi: (setModalConfig: SetModalApiConfig) => ModalApi;
};

export const Modal: ModalComponent;
export const MessageBox: ComponentType<Record<string, never>>;
