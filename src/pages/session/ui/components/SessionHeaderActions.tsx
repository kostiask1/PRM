import type { RefObject } from "react";
import "../../../../assets/components/SessionHeaderActions.css";

import { classNames, lang } from "../../../../shared/lib/index.js";
import { Button, UndoRedoButtons } from "../../../../shared/ui/index.js";

interface SessionHeaderActionsProps {
	actionsRef: RefObject<HTMLDivElement>;
	canRedo: boolean;
	canUndo: boolean;
	isOpen: boolean;
	isSaving: boolean;
	onDelete: () => void;
	onOpenSearch: () => void;
	onRedo: () => void;
	onToggle: () => void;
	onUndo: () => void;
}

export default function SessionHeaderActions({
	actionsRef,
	canRedo,
	canUndo,
	isOpen,
	isSaving,
	onDelete,
	onOpenSearch,
	onRedo,
	onToggle,
	onUndo,
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
				className="SessionHeaderActions__toggle"
				onClick={onToggle}
				title={lang.t("Session actions")}
			/>
			<div className="SessionHeaderActions__menu">
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="search"
					onClick={onOpenSearch}
					title={lang.t("Global search")}
				>
					{lang.t("Search")}
				</Button>
				<UndoRedoButtons
					canRedo={canRedo}
					canUndo={canUndo}
					disabled={isSaving}
					onRedo={onRedo}
					onUndo={onUndo}
				/>
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
