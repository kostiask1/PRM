import { Tooltip } from "../../../../shared/ui/index.js";
import type { CampaignViewModel } from "../../../../entities/campaign/index.js";
import { lang } from "../../../../shared/lib/index.js";
import CampaignHeaderActions from "./CampaignHeaderActions.tsx";

interface CampaignHeaderView {
	handleRename: () => void;
	redoStack: readonly unknown[];
	undoStack: readonly unknown[];
	handleDeleteCampaign: () => void;
	handleExport: () => void;
	handleRedo: () => void;
	handleUndo: () => void;
}

interface CampaignHeaderProps {
	view: CampaignHeaderView;
	viewModel: CampaignViewModel;
	onOpenSearch: () => void;
	onOpenPartialArchive: () => void;
}

export default function CampaignHeader({
	view,
	viewModel,
	onOpenSearch,
	onOpenPartialArchive,
}: CampaignHeaderProps) {
	return (
		<div className="Panel__header">
			<div className="CampaignView__header">
				<Tooltip content={lang.t("Click to rename")}>
					<h2 className="editable_title" onClick={view.handleRename}>
						{viewModel.name}
					</h2>
				</Tooltip>
				<p className="muted">
					{lang.t("Created")}: {viewModel.createdAtLabel}
				</p>
			</div>
			<CampaignHeaderActions
				canRedo={view.redoStack.length > 0}
				canUndo={view.undoStack.length > 0}
				onDelete={() => view.handleDeleteCampaign()}
				onExport={() => view.handleExport()}
				onOpenPartialArchive={onOpenPartialArchive}
				onOpenSearch={onOpenSearch}
				onRedo={view.handleRedo}
				onUndo={view.handleUndo}
			/>
		</div>
	);
}
