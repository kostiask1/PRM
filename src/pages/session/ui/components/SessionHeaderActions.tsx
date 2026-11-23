import type { RefObject } from "react";
import "../../../../assets/components/SessionHeaderActions.css";

import { classNames, lang } from "../../../../shared/lib/index.js";
import { Button, UndoRedoButtons } from "../../../../shared/ui/index.js";

interface SessionHeaderActionsProps {
	actionsRef: RefObject<HTMLDivElement>;
	canRedo: boolean;
	canUndo: boolean;
	isOpen: boolean;
	isHistoryRestoring: boolean;
	isSaving: boolean;
	onDelete: () => void;
	onOpenSearch: () => void;
	onRedo: () => void;
	onToggle: () => void;
	onUndo: () => void;
	redoTitle?: string;
	undoTitle?: string;
}

export default function SessionHeaderActions({
	actionsRef,
	canRedo,
	canUndo,
	isOpen,
	isHistoryRestoring,
	isSaving,
	onDelete,
	onOpenSearch,
	onRedo,
	onToggle,
	onUndo,
	redoTitle,
	undoTitle,
}: SessionHeaderActionsProps) {
	return (
		<div
			ref={actionsRef}
			className={classNames("SessionHeaderActions", {
				is_open: isOpen,
			})}
		>
			<Button
				variant="ghost"
				size={Button.SIZES.SMALL}
				icon="menu"
				aria-label={lang.t("Session actions")}
				aria-expanded={isOpen}
				className="SessionHeaderActions__toggle"
				onClick={onToggle}
				title={lang.t("Session actions")}
			/>
			<div className="SessionHeaderActions__menu">
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="search"
					data-global-search-trigger="true"
					onClick={onOpenSearch}
					title={`${lang.t("Global search")} (Ctrl+K)`}
				>
					{lang.t("Search")}
				</Button>
				<div className="SessionHeaderActions__history" role="group" aria-label={lang.t("Campaign history")}>
				<UndoRedoButtons
					canRedo={canRedo}
					canUndo={canUndo}
					showLabels
					disabled={isSaving || isHistoryRestoring}
					onRedo={onRedo}
					onUndo={onUndo}
					redoTitle={redoTitle}
					undoTitle={undoTitle}
				/>
				</div>
				<Button
					variant="danger"
					size={Button.SIZES.SMALL}
					icon="trash"
					onClick={onDelete}
					title={lang.t("Delete session")}
				/>
			</div>
		</div>
	);
}
