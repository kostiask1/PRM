import { useRef, useState } from "react";
import "../../../../assets/components/CampaignHeaderActions.css";

import { classNames, lang } from "../../../../shared/lib/index.js";
import {
	Button,
	UndoRedoButtons,
	usePointerDownOutsideDismissal,
} from "../../../../shared/ui/index.js";

interface CampaignHeaderActionsProps {
	canRedo: boolean;
	canUndo: boolean;
	disabled?: boolean;
	onDelete: () => void;
	onExport: () => void;
	onOpenPartialArchive: () => void;
	onOpenSearch: () => void;
	onRedo: () => void;
	onUndo: () => void;
	redoTitle?: string;
	undoTitle?: string;
}

export default function CampaignHeaderActions({
	canRedo,
	canUndo,
	disabled = false,
	onDelete,
	onExport,
	onOpenPartialArchive,
	onOpenSearch,
	onRedo,
	onUndo,
	redoTitle,
	undoTitle,
}: CampaignHeaderActionsProps) {
	const [isHeaderActionsOpen, setIsHeaderActionsOpen] = useState(false);
	const headerActionsRef = useRef<HTMLDivElement>(null);

	usePointerDownOutsideDismissal({
		containerRef: headerActionsRef,
		isOpen: isHeaderActionsOpen,
		setIsOpen: setIsHeaderActionsOpen,
	});

	const closeActions = () => setIsHeaderActionsOpen(false);

	return (
		<div
			ref={headerActionsRef}
			className={classNames("CampaignHeaderActions", {
				is_open: isHeaderActionsOpen,
			})}
		>
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
				disabled={disabled}
				onRedo={onRedo}
				onUndo={onUndo}
				redoTitle={redoTitle}
				undoTitle={undoTitle}
			/>
			<Button
				variant="ghost"
				size={Button.SIZES.SMALL}
				icon="menu"
				className="CampaignHeaderActions__toggle"
				onClick={() => setIsHeaderActionsOpen((value) => !value)}
				title={lang.t("Campaign actions")}
			/>
			<div className="CampaignHeaderActions__menu">
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					onClick={() => {
						closeActions();
						onExport();
					}}
					icon="export"
				>
					{lang.t("Export")}
				</Button>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="database"
					onClick={() => {
						closeActions();
						onOpenPartialArchive();
					}}
				>
					{lang.t("Import/export parts")}
				</Button>
				<Button
					variant="danger"
					size={Button.SIZES.SMALL}
					icon="trash"
					onClick={() => {
						closeActions();
						onDelete();
					}}
				>
					{lang.t("Delete")}
				</Button>
			</div>
		</div>
	);
}
