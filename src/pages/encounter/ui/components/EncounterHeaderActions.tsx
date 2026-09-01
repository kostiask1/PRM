import type { ReactNode, RefObject } from "react";

import type { EncounterViewModel } from "../../model/contracts.ts";
import { classNames, lang } from "../../../../shared/lib/index.js";
import { Button, Tooltip } from "../../../../shared/ui/index.js";

type EncounterDisplayMode = "grid" | "single";

type EncounterHeaderActionsView = Pick<
	EncounterViewModel,
	| "encounter"
	| "canUndo"
	| "canRedo"
	| "isHistoryRestoring"
	| "undoLabel"
	| "redoLabel"
	| "isSaving"
	| "fileInputRef"
	| "handleFileChange"
	| "handleExport"
	| "handleUndo"
	| "handleRedo"
>;

interface EncounterHeaderActionsProps {
	actionsRef: RefObject<HTMLDivElement | null>;
	displayMode: EncounterDisplayMode;
	displayedMonsterCount: number;
	gridColumns: number;
	isActionsOpen: boolean;
	metricsTooltip: ReactNode;
	onDisplayMode: (mode: EncounterDisplayMode) => void;
	onGridColumns: (columns: number) => void;
	onToggleActions: () => void;
	view: EncounterHeaderActionsView;
}

export default function EncounterHeaderActions({
	view,
	displayMode,
	displayedMonsterCount,
	gridColumns,
	isActionsOpen,
	actionsRef,
	metricsTooltip,
	onToggleActions,
	onDisplayMode,
	onGridColumns,
}: EncounterHeaderActionsProps) {
	return (
		<div
			ref={actionsRef as RefObject<HTMLDivElement>}
			className={classNames("EncounterView__headerActions", {
				is_open: isActionsOpen,
			})}
		>
			<Tooltip
				content={metricsTooltip}
				className="EncounterView__metricsTooltipTrigger"
			>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="swords"
					aria-label={lang.t("Combat encounters")}
				>
					{view.encounter?.monsters.length || 0}
				</Button>
			</Tooltip>
			<Button
				variant="ghost"
				size={Button.SIZES.SMALL}
				icon="menu"
				className="EncounterView__headerActionsToggle"
				onClick={onToggleActions}
				title={lang.t("Encounter actions")}
			/>
			<div className="EncounterView__headerActionsMenu">
				<EncounterViewModeControls
					displayMode={displayMode}
					displayedMonsterCount={displayedMonsterCount}
					onDisplayMode={onDisplayMode}
				/>
				<EncounterGridColumnControls
					displayMode={displayMode}
					gridColumns={gridColumns}
					onGridColumns={onGridColumns}
				/>
				<EncounterHistoryControls view={view} />
				<input
					type="file"
					ref={view.fileInputRef as RefObject<HTMLInputElement>}
					style={{ display: "none" }}
					accept=".json"
					onChange={view.handleFileChange}
				/>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="import"
					onClick={() => view.fileInputRef.current?.click()}
					title={lang.t("Import encounter")}
				/>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="export"
					onClick={view.handleExport}
					title={lang.t("Export encounter")}
				/>
			</div>
		</div>
	);
}

interface EncounterViewModeControlsProps {
	displayMode: EncounterDisplayMode;
	displayedMonsterCount: number;
	onDisplayMode: (mode: EncounterDisplayMode) => void;
}

function EncounterViewModeControls({
	displayMode,
	displayedMonsterCount,
	onDisplayMode,
}: EncounterViewModeControlsProps) {
	return (
		<div className="EncounterView__viewModeSwitch">
			<Button
				variant={displayMode === "single" ? "primary" : "ghost"}
				size={Button.SIZES.SMALL}
				icon="list"
				onClick={() => onDisplayMode("single")}
				title={lang.t("Preview")}
			/>
			<Button
				variant={displayMode === "grid" ? "primary" : "ghost"}
				size={Button.SIZES.SMALL}
				icon="layers"
				onClick={() => onDisplayMode("grid")}
				disabled={displayedMonsterCount === 1}
				title={lang.t("All")}
			/>
		</div>
	);
}

interface EncounterGridColumnControlsProps {
	displayMode: EncounterDisplayMode;
	gridColumns: number;
	onGridColumns: (columns: number) => void;
}

function EncounterGridColumnControls({
	displayMode,
	gridColumns,
	onGridColumns,
}: EncounterGridColumnControlsProps) {
	if (displayMode !== "grid") return null;
	return (
		<div
			className="EncounterView__gridColumnsSwitch"
			aria-label={lang.t("Grid columns")}
		>
			{[1, 2, 3, 4].map((columns) => (
				<Button
					key={columns}
					variant={gridColumns === columns ? "primary" : "ghost"}
					size={Button.SIZES.SMALL}
					onClick={() => onGridColumns(columns)}
					title={lang.t("{count} columns", { count: columns })}
				>
					{columns}
				</Button>
			))}
		</div>
	);
}

function EncounterHistoryControls({
	view,
}: {
	view: EncounterHeaderActionsView;
}) {
	return (
		<>
			<Button
				variant="ghost"
				size={Button.SIZES.SMALL}
				icon="undo"
				onClick={view.handleUndo}
				disabled={!view.canUndo || view.isSaving || view.isHistoryRestoring}
				title={view.undoLabel}
			/>
			<Button
				variant="ghost"
				size={Button.SIZES.SMALL}
				icon="redo"
				onClick={view.handleRedo}
				disabled={!view.canRedo || view.isSaving || view.isHistoryRestoring}
				title={view.redoLabel}
			/>
		</>
	);
}
