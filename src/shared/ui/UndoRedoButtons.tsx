import { lang } from "../lib/index.js";
import Button from "./Button.tsx";

interface UndoRedoButtonsProps {
	canRedo: boolean;
	canUndo: boolean;
	disabled?: boolean;
	onRedo: () => void;
	onUndo: () => void;
	redoTitle?: string;
	undoTitle?: string;
}

export function UndoRedoButtons({
	canRedo,
	canUndo,
	disabled = false,
	onRedo,
	onUndo,
	redoTitle,
	undoTitle,
}: UndoRedoButtonsProps) {
	return (
		<>
			<Button
				variant="ghost"
				size={Button.SIZES.SMALL}
				icon="undo"
				onClick={onUndo}
				disabled={!canUndo || disabled}
				title={undoTitle || lang.t("Undo (Ctrl+Z)")}
			/>
			<Button
				variant="ghost"
				size={Button.SIZES.SMALL}
				icon="redo"
				onClick={onRedo}
				disabled={!canRedo || disabled}
				title={redoTitle || lang.t("Redo (Ctrl+Y)")}
			/>
		</>
	);
}
