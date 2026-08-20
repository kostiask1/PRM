import type { ReactNode, RefObject } from "react";
import { lang } from "../../../../shared/lib/index.js";
import { Button, Tooltip } from "../../../../shared/ui/index.js";
import { renderMentionText } from "../../../../features/entity-link/index.js";
import type { EncounterViewModel } from "../../model/contracts.ts";
import EncounterHeaderActions from "./EncounterHeaderActions.tsx";

type EncounterDisplayMode = "grid" | "single";

type EncounterHeaderView = Pick<
	EncounterViewModel,
	| "encounter"
	| "initiativeStats"
	| "handleBack"
	| "handleRename"
	| "undoStack"
	| "redoStack"
	| "isSaving"
	| "fileInputRef"
	| "handleFileChange"
	| "handleExport"
	| "handleUndo"
	| "handleRedo"
>;

interface EncounterHeaderProps {
	view: EncounterHeaderView;
	displayMode: EncounterDisplayMode;
	displayedMonsterCount: number;
	gridColumns: number;
	isActionsOpen: boolean;
	actionsRef: RefObject<HTMLDivElement | null>;
	averageTooltip: ReactNode;
	maxTooltip: ReactNode;
	weightedTooltip: ReactNode;
	metricsTooltip: ReactNode;
	onToggleActions: () => void;
	onDisplayMode: (mode: EncounterDisplayMode) => void;
	onGridColumns: (columns: number) => void;
}

export default function EncounterHeader({
	view,
	displayMode,
	displayedMonsterCount,
	gridColumns,
	isActionsOpen,
	actionsRef,
	averageTooltip,
	maxTooltip,
	weightedTooltip,
	metricsTooltip,
	onToggleActions,
	onDisplayMode,
	onGridColumns,
}: EncounterHeaderProps) {
	return (
		<div className="Panel__header">
			<EncounterHeaderIdentity view={view} averageTooltip={averageTooltip} maxTooltip={maxTooltip} weightedTooltip={weightedTooltip} />
			<EncounterHeaderActions {...{ view, displayMode, displayedMonsterCount, gridColumns, isActionsOpen, actionsRef, metricsTooltip, onToggleActions, onDisplayMode, onGridColumns }} />
		</div>
	);
}

function EncounterHeaderIdentity({
	view,
	averageTooltip,
	maxTooltip,
	weightedTooltip,
}: Pick<
	EncounterHeaderProps,
	"view" | "averageTooltip" | "maxTooltip" | "weightedTooltip"
>) {
	return (
		<div className="EncounterView__header">
			<Button variant="ghost" size={Button.SIZES.SMALL} onClick={view.handleBack} icon="back" className="SessionView__backBtn" />
			<Tooltip content={lang.t("Click to rename")}>
				<h2 className="editable_title" onClick={view.handleRename}>{renderMentionText(view.encounter?.name || "")}</h2>
			</Tooltip>
			<EncounterMetrics {...{ view, averageTooltip, maxTooltip, weightedTooltip }} />
		</div>
	);
}

function EncounterMetrics({
	view,
	averageTooltip,
	maxTooltip,
	weightedTooltip,
}: Pick<
	EncounterHeaderProps,
	"view" | "averageTooltip" | "maxTooltip" | "weightedTooltip"
>) {
	const participantCount = view.encounter?.monsters.length || 0;
	const metrics: Array<[ReactNode, ReactNode, ReactNode, string]> = [
		[lang.t("Avg initiative"), view.initiativeStats.average, averageTooltip, ""],
		[lang.t("Max initiative"), view.initiativeStats.max, maxTooltip, ""],
		[
			lang.t("CR-weighted avg initiative"),
			view.initiativeStats.weightedAverage,
			weightedTooltip,
			" EncounterViewMetric__accent",
		],
	];
	return (
		<div className="EncounterView__metrics">
			<div className="EncounterViewMetric">
				<span className="EncounterViewMetric__label">{lang.t("Participants")}</span>
				<span className="EncounterViewMetric__value">{participantCount}</span>
			</div>
			{participantCount > 0 &&
				metrics.map(([label, value, content, modifier]) => (
					<div className={`EncounterViewMetric${modifier}`} key={String(label)}>
						<Tooltip content={content} className="EncounterViewMetric__tooltip">
							<span className="EncounterViewMetric__label">{label}</span>
							<span className="EncounterViewMetric__value">{value}</span>
						</Tooltip>
					</div>
				))}
		</div>
	);
}
