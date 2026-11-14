import type { ReactNode } from "react";
import "../../../../assets/components/CampaignDescriptionSection.css";
import { lang, makeDomId } from "../../../../shared/lib/index.js";
import { makeHistoryTargetId } from "../../../../entities/history/index.js";

interface CampaignDescriptionSectionProps {
	renderEditor: () => ReactNode;
}

export default function CampaignDescriptionSection({
	renderEditor,
}: CampaignDescriptionSectionProps) {
	return (
		<div
			className="CampaignDescriptionSection"
			id={makeDomId("campaign", "description")}
			data-history-focus-id={makeHistoryTargetId("campaign", "description")}
		>
			<div className="CampaignDescriptionSection__row">
				<h3>{lang.t("Campaign story")}</h3>
			</div>
			{renderEditor()}
		</div>
	);
}
