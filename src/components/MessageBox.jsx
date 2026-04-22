import { hideMessageBox } from "../actions/app";
import { useAppDispatch, useAppSelector } from "../store/appStore";
import Modal from "./Modal";

export default function MessageBox() {
	const dispatch = useAppDispatch();
	const messageBox = useAppSelector((state) => state.messageBox);

	if (!messageBox) return null;

	const handleResolve = (value) => {
		messageBox.onResolve?.(value);
		dispatch(hideMessageBox());
	};

	const handleCancel = messageBox.isAlert
		? null
		: () => {
				messageBox.onCancelAction?.();
				handleResolve(null);
			};

	return (
		<Modal
			{...messageBox}
			onConfirm={(value) => handleResolve(value)}
			onCancel={handleCancel}
		/>
	);
}
