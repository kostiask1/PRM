import { useRef, useState } from "react";
import "../../../../assets/components/CampaignHeaderActions.css";

import { classNames, lang } from "../../../../shared/lib/index.js";
import {
	Button,
	Tooltip,
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
			<Tooltip delay={1200} content="CTRL+K">
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="search"
					aria-label={lang.t("Global search")}
					data-global-search-trigger="true"
					onClick={onOpenSearch}
				>
					{lang.t("Search")}
				</Button>
			</Tooltip>
			<div className="CampaignHeaderActions__history" role="group" aria-label={lang.t("Campaign history")}>
			<span className="CampaignHeaderActions__historyScope">{lang.t("Campaign history")}</span>
			<UndoRedoButtons
				canRedo={canRedo}
				canUndo={canUndo}
				showLabels
				disabled={disabled}
				onRedo={onRedo}
				onUndo={onUndo}
				redoTitle={redoTitle}
				undoTitle={undoTitle}
			/>
			</div>
			<Button
				variant="ghost"
				size={Button.SIZES.SMALL}
				icon="menu"
				aria-label={lang.t("Campaign actions")}
				aria-expanded={isHeaderActionsOpen}
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
