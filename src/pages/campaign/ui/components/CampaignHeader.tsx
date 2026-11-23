import { Button, Tooltip } from "../../../../shared/ui/index.js";
import "../../../../assets/components/CampaignHeader.css";
import type { CampaignViewModel } from "../../../../entities/campaign/index.js";
import { lang } from "../../../../shared/lib/index.js";
import CampaignHeaderActions from "./CampaignHeaderActions.tsx";

interface CampaignHeaderView {
	canRedo: boolean;
	canUndo: boolean;
	handleRename: () => void;
	isHistoryRestoring: boolean;
	isSaving: boolean;
	redoLabel: string;
	undoLabel: string;
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
	onCreateSession: () => void;
}

export default function CampaignHeader({
	view,
	viewModel,
	onOpenSearch,
	onOpenPartialArchive,
	onCreateSession,
}: CampaignHeaderProps) {
	return (
		<div className="Panel__header">
			<div className="CampaignHeader">
				{/* <p className="WorkspaceEyebrow">{lang.t("Campaign")} / DUNGEONS &amp; DRAGONS 5E</p> */}
				<Tooltip content={lang.t("Click to rename")}>
					<h2 className="editable_title" onClick={view.handleRename}>
						{viewModel.name}
					</h2>
				</Tooltip>
			</div>
			<div className="CampaignHeader__actions">
			<Button variant="primary" size={Button.SIZES.SMALL} icon="plus" onClick={onCreateSession}>{lang.t("New session")}</Button>
			<CampaignHeaderActions
				canRedo={view.canRedo}
				canUndo={view.canUndo}
				disabled={view.isSaving || view.isHistoryRestoring}
				onDelete={() => view.handleDeleteCampaign()}
				onExport={() => view.handleExport()}
				onOpenPartialArchive={onOpenPartialArchive}
				onOpenSearch={onOpenSearch}
				onRedo={view.handleRedo}
				onUndo={view.handleUndo}
				redoTitle={view.redoLabel}
				undoTitle={view.undoLabel}
			/>
			</div>
		</div>
	);
}
