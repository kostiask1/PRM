import { hideMessageBox } from "../../shared/model/index.js";
import { useAppDispatch, useAppSelector } from "../../shared/lib/index.js";
import Modal from "../../components/common/Modal";

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
			overlayClassName="MessageBox__overlay"
			onConfirm={(value) => handleResolve(value)}
			onCancel={handleCancel}
		/>
	);
}
