import { createPortal } from "react-dom";
import { lang } from "../../../shared/lib/index.js";
import "../../../assets/components/Modal.css";
import {
	createModalApi,
	type ModalProps,
	type SetModalApiConfig,
} from "../model.ts";
import { ModalView } from "./ModalView.tsx";
import { useModalController } from "./useModalController.ts";

function Modal(props: ModalProps) {
	const controller = useModalController(props);
	return createPortal(
		<ModalView {...props} controller={controller} />,
		document.body,
	);
}

const ModalWithApi = Object.assign(Modal, {
	createApi: (setModalConfig: SetModalApiConfig) =>
		createModalApi(setModalConfig, () => lang.t("Status")),
});

export default ModalWithApi;
