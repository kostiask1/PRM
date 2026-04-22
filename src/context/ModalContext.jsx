import { closeActiveModal, openModalRequest } from "../store/appStore";

export function useModal() {
	const open = (config) => openModalRequest(config);

	const close = () => closeActiveModal(null);

	const alert = (title, message, status = null) => {
		const fullMessage = status ? `[Статус: ${status}] ${message}` : message;
		return open({
			title,
			message: fullMessage,
			type: "error",
			isAlert: true,
		});
	};

	const success = (title, message) =>
		open({
			title,
			message,
			type: "success",
			isAlert: true,
		});

	const confirm = (title, message, status = null) => {
		const fullMessage = status ? `[Статус: ${status}] ${message}` : message;
		return open({ title, message: fullMessage, type: "confirm" });
	};

	const prompt = (title, message, defaultValue = "") =>
		open({
			title,
			message,
			type: "confirm",
			showInput: true,
			defaultValue,
		});

	return { open, close, alert, success, confirm, prompt };
}
