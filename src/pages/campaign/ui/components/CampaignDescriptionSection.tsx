import type { ReactNode } from "react";
import "../../../../assets/components/CampaignDescriptionSection.css";
import { Button, CollapseToggleButton } from "../../../../shared/ui/index.js";
import { lang, makeDomId } from "../../../../shared/lib/index.js";
import { makeHistoryTargetId } from "../../../../entities/history/index.js";

interface CampaignDescriptionSectionProps {
	hasData: boolean;
	isCollapsed: boolean;
	onToggle: () => void;
	renderEditor: () => ReactNode;
}

export default function CampaignDescriptionSection({
	hasData,
	isCollapsed,
	onToggle,
	renderEditor,
}: CampaignDescriptionSectionProps) {
	return (
		<div
			className="CampaignDescriptionSection"
			id={makeDomId("campaign", "description")}
			data-history-focus-id={makeHistoryTargetId("campaign", "description")}
		>
			<div className="CampaignDescriptionSection__row">
				<div className="CampaignDescriptionSection__titleGroup" onClick={onToggle}>
					{hasData && (
						<CollapseToggleButton
							size={Button.SIZES.MEDIUM}
							collapsed={isCollapsed}
							onClick={onToggle}
						/>
					)}
					<h3>{lang.t("Campaign story")}</h3>
				</div>
			</div>
			{!isCollapsed && renderEditor()}
		</div>
	);
}
