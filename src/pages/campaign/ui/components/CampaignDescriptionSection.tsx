import type { ReactNode } from "react";
import { Button, CollapseToggleButton } from "../../../../shared/ui/index.js";
import { lang, makeDomId } from "../../../../shared/lib/index.js";

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
			className="CampaignView__section"
			id={makeDomId("campaign", "description")}
		>
			<div className="section_row">
				<div className="section_title_group" onClick={onToggle}>
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
