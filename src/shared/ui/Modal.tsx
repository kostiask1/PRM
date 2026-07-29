import { createPortal } from "react-dom";
import "../../assets/components/Modal.css";
import type { ModalProps } from "./modalModel.ts";
import { ModalView } from "./ModalView.tsx";
import { useModalController } from "./useModalController.ts";

export type { ModalProps } from "./modalModel.ts";

export default function Modal(props: ModalProps) {
	const controller = useModalController(props);
	return createPortal(
		<ModalView {...props} controller={controller} />,
		document.body,
	);
}
