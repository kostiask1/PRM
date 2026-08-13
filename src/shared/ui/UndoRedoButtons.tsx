import { lang } from "../lib/index.js";
import Button from "./Button.tsx";

interface UndoRedoButtonsProps {
	canRedo: boolean;
	canUndo: boolean;
	disabled?: boolean;
	onRedo: () => void;
	onUndo: () => void;
}

export function UndoRedoButtons({
	canRedo,
	canUndo,
	disabled = false,
	onRedo,
	onUndo,
}: UndoRedoButtonsProps) {
	return (
		<>
			<Button
				variant="ghost"
				size={Button.SIZES.SMALL}
				icon="undo"
				onClick={onUndo}
				disabled={!canUndo || disabled}
				title={lang.t("Undo (Ctrl+Z)")}
			/>
			<Button
				variant="ghost"
				size={Button.SIZES.SMALL}
				icon="redo"
				onClick={onRedo}
				disabled={!canRedo || disabled}
				title={lang.t("Redo (Ctrl+Y)")}
			/>
		</>
	);
}
