import {
	useEffect,
	useState,
} from "react";
import { isEditableAppTarget } from "./appShellPresentation.ts";

export function useAppModifierKey(): boolean {
	const [isPressed, setIsPressed] = useState(false);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (isEditableAppTarget(event.target)) return;
			if (event.ctrlKey || event.metaKey) setIsPressed(true);
		};
		const handleKeyUp = (event: KeyboardEvent) => {
			if (isEditableAppTarget(event.target)) return;
			if (!event.ctrlKey && !event.metaKey) setIsPressed(false);
		};
		const handleMouseUp = () => setIsPressed(false);

		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("keyup", handleKeyUp);
		document.addEventListener("mouseup", handleMouseUp);

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("keyup", handleKeyUp);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, []);

	return isPressed;
}
