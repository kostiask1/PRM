import {
	hideMessageBox,
	useAppDispatch,
	useAppSelector,
} from "../../shared/model/index.js";
import { Modal } from "../../shared/ui/index.js";

export default function MessageBoxHost() {
	const dispatch = useAppDispatch();
	const messageBox = useAppSelector((state) => state.messageBox);

	if (!messageBox) return null;

	const handleResolve = (value: unknown) => {
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
