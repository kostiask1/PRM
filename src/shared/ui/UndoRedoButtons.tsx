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
	showLabels?: boolean;
}

export function UndoRedoButtons({
	canRedo,
	canUndo,
	disabled = false,
	onRedo,
	onUndo,
	redoTitle,
	undoTitle,
	showLabels = false,
}: UndoRedoButtonsProps) {
	return (
		<>
			<Button
				variant="ghost"
				size={Button.SIZES.SMALL}
				icon="undo"
				aria-label={undoTitle || lang.t("Undo (Ctrl+Z)")}
				onClick={onUndo}
				disabled={!canUndo || disabled}
				title={undoTitle || lang.t("Undo (Ctrl+Z)")}
			>{showLabels && lang.t("Undo")}</Button>
			<Button
				variant="ghost"
				size={Button.SIZES.SMALL}
				icon="redo"
				aria-label={redoTitle || lang.t("Redo (Ctrl+Y)")}
				onClick={onRedo}
				disabled={!canRedo || disabled}
				title={redoTitle || lang.t("Redo (Ctrl+Y)")}
			>{showLabels && lang.t("Redo")}</Button>
		</>
	);
}
