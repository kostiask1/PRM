import type { ReactNode, RefObject } from "react";
import { lang } from "../../../../shared/lib/index.js";
import { Button, Tooltip } from "../../../../shared/ui/index.js";
import { renderMentionText } from "../../../../features/entity-link/index.js";
import "../../../../assets/components/EncounterHeader.css";
import type { EncounterViewModel } from "../../model/contracts.ts";
import EncounterHeaderActions from "./EncounterHeaderActions.tsx";

type EncounterDisplayMode = "grid" | "single";

type EncounterHeaderView = Pick<
	EncounterViewModel,
	| "encounter"
	| "initiativeStats"
	| "handleBack"
	| "handleRename"
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

interface EncounterHeaderProps {
	view: EncounterHeaderView;
	displayMode: EncounterDisplayMode;
	displayedMonsterCount: number;
	gridColumns: number;
	isActionsOpen: boolean;
	actionsRef: RefObject<HTMLDivElement | null>;
	onToggleActions: () => void;
	onDisplayMode: (mode: EncounterDisplayMode) => void;
	onGridColumns: (columns: number) => void;
}

interface EncounterHeaderTooltips {
	averageTooltip: ReactNode;
	maxTooltip: ReactNode;
	weightedTooltip: ReactNode;
}

export default function EncounterHeader({
	view,
	displayMode,
	displayedMonsterCount,
	gridColumns,
	isActionsOpen,
	actionsRef,
	onToggleActions,
	onDisplayMode,
	onGridColumns,
}: EncounterHeaderProps) {
	const { averageTooltip, maxTooltip, weightedTooltip, metricsTooltip } =
		getEncounterHeaderTooltips(view);
	return (
		<div className="Panel__header">
			<EncounterHeaderIdentity view={view} averageTooltip={averageTooltip} maxTooltip={maxTooltip} weightedTooltip={weightedTooltip} />
			<EncounterHeaderActions {...{ view, displayMode, displayedMonsterCount, gridColumns, isActionsOpen, actionsRef, metricsTooltip, onToggleActions, onDisplayMode, onGridColumns }} />
		</div>
	);
}

function getEncounterHeaderTooltips(
	view: Pick<EncounterViewModel, "encounter" | "initiativeStats">,
) {
	const participantCount = view.encounter?.monsters.length || 0;
	return {
		averageTooltip: (
			<div>
				<div className="Tooltip__title">{lang.t("Avg initiative")}</div>
				<div className="Tooltip__text">
					{lang.t(
						"Expected initiative for each participant is 10.5 + Dexterity modifier. Arithmetic average across all participants. Best for regular encounters with roughly equal threats.",
					)}
				</div>
			</div>
		),
		maxTooltip: (
			<div>
				<div className="Tooltip__title">{lang.t("Max initiative")}</div>
				<div className="Tooltip__text">
					{lang.t(
						"Expected initiative is calculated as 10.5 + Dexterity modifier for each participant, then the highest value is shown. Best for deadly encounters with a BBEG.",
					)}
				</div>
			</div>
		),
		weightedTooltip: (
			<div>
				<div className="Tooltip__title">
					{lang.t("CR-weighted avg initiative")}
				</div>
				<div className="Tooltip__text">
					{lang.t(
						"Each participant's expected initiative is multiplied by CR + 1, then divided by the sum of those weights. Best for balanced battles with a boss.",
					)}
				</div>
			</div>
		),
		metricsTooltip: (
			<div className="EncounterView__metricsTooltip">
				<div className="Tooltip__title">{lang.t("Combat encounters")}</div>
				<div className="EncounterView__metricsTooltipList">
					<div className="EncounterView__metricsTooltipRow">
						<span>{lang.t("Participants")}</span>
						<strong>{participantCount}</strong>
					</div>
					{participantCount > 0 && (
						<>
							<div className="EncounterView__metricsTooltipRow">
								<span>{lang.t("Avg initiative")}</span>
								<strong>{view.initiativeStats.average}</strong>
							</div>
							<div className="EncounterView__metricsTooltipRow">
								<span>{lang.t("Max initiative")}</span>
								<strong>{view.initiativeStats.max}</strong>
							</div>
							<div className="EncounterView__metricsTooltipRow">
								<span>{lang.t("CR-weighted avg initiative")}</span>
								<strong>{view.initiativeStats.weightedAverage}</strong>
							</div>
						</>
					)}
				</div>
			</div>
		),
	};
}

function EncounterHeaderIdentity({
	view,
	averageTooltip,
	maxTooltip,
	weightedTooltip,
}: Pick<EncounterHeaderProps, "view"> & EncounterHeaderTooltips) {
	return (
		<div className="EncounterView__header">
			<Button variant="ghost" size={Button.SIZES.SMALL} onClick={view.handleBack} icon="back" className="EncounterHeader__backButton" />
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
}: Pick<EncounterHeaderProps, "view"> & EncounterHeaderTooltips) {
	const participantCount = view.encounter?.monsters.length || 0;
	const metrics: Array<[ReactNode, ReactNode, ReactNode, string]> = [
		[lang.t("Avg initiative"), view.initiativeStats.average, averageTooltip, ""],
		[lang.t("Max initiative"), view.initiativeStats.max, maxTooltip, ""],
		[
			lang.t("CR-weighted avg initiative"),
			view.initiativeStats.weightedAverage,
			weightedTooltip,
			" EncounterHeader__metric_accent",
		],
	];
	return (
		<div className="EncounterView__metrics">
			<div className="EncounterHeader__metric">
				<span className="EncounterHeader__metricLabel">{lang.t("Participants")}</span>
				<span className="EncounterHeader__metricValue">{participantCount}</span>
			</div>
			{participantCount > 0 &&
				metrics.map(([label, value, content, modifier]) => (
					<div className={`EncounterHeader__metric${modifier}`} key={String(label)}>
						<Tooltip content={content} className="EncounterHeader__metricTooltip">
							<span className="EncounterHeader__metricLabel">{label}</span>
							<span className="EncounterHeader__metricValue">{value}</span>
						</Tooltip>
					</div>
				))}
		</div>
	);
}
