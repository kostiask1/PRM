import {
	useRef,
	useState,
	type ChangeEvent,
} from "react";

import { classNames, lang } from "../../../shared/lib/index.js";
import {
	Button,
	usePointerDownOutsideDismissal,
} from "../../../shared/ui/index.js";

interface BestiaryHeaderActionsProps {
	canExport: boolean;
	canRedo: boolean;
	canUndo: boolean;
	onExport: () => void;
	onImport: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
	onRedo: () => Promise<void>;
	onUndo: () => Promise<void>;
}

export default function BestiaryHeaderActions({
	canExport,
	canRedo,
	canUndo,
	onExport,
	onImport,
	onRedo,
	onUndo,
}: BestiaryHeaderActionsProps) {
	const [isHeaderActionsOpen, setIsHeaderActionsOpen] = useState(false);
	const customImportInputRef = useRef<HTMLInputElement>(null);
	const headerActionsRef = useRef<HTMLDivElement>(null);

	usePointerDownOutsideDismissal({
		containerRef: headerActionsRef,
		isOpen: isHeaderActionsOpen,
		setIsOpen: setIsHeaderActionsOpen,
	});

	const closeActions = () => {
		setIsHeaderActionsOpen(false);
	};

	const toggleActions = () => {
		setIsHeaderActionsOpen((value) => !value);
	};

	const handleImport = () => {
		closeActions();
		customImportInputRef.current?.click();
	};

	const handleExport = () => {
		closeActions();
		onExport();
	};

	const handleUndo = () => {
		closeActions();
		onUndo();
	};

	const handleRedo = () => {
		closeActions();
		onRedo();
	};

	return (
		<div
			ref={headerActionsRef}
			className={classNames("Bestiary__header_actions", {
				is_open: isHeaderActionsOpen,
			})}
		>
			<input
				ref={customImportInputRef}
				type="file"
				accept=".json"
				style={{ display: "none" }}
				onChange={onImport}
			/>
			<Button
				variant="ghost"
				size={Button.SIZES.SMALL}
				icon="menu"
				className="Bestiary__header_actionsToggle"
				onClick={toggleActions}
				title={lang.t("Bestiary actions")}
			/>
			<div className="Bestiary__header_actionsMenu">
				<Button
					variant="ghost"
					size={Button.SIZES.MEDIUM}
					icon="import"
					onClick={handleImport}
					title={lang.t("Import custom creatures")}
				>
					{lang.t("Import")}
				</Button>
				<Button
					variant="ghost"
					size={Button.SIZES.MEDIUM}
					icon="export"
					onClick={handleExport}
					disabled={!canExport}
					title={lang.t("Export custom creatures")}
				>
					{lang.t("Export")}
				</Button>
				<Button
					variant="ghost"
					size={Button.SIZES.MEDIUM}
					icon="undo"
					onClick={handleUndo}
					disabled={!canUndo}
					title={lang.t("Undo (Ctrl+Z)")}
				/>
				<Button
					variant="ghost"
					size={Button.SIZES.MEDIUM}
					icon="redo"
					onClick={handleRedo}
					disabled={!canRedo}
					title={lang.t("Redo (Ctrl+Y)")}
				/>
			</div>
		</div>
	);
}
