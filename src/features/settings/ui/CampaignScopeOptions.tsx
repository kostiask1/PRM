import type { CampaignRecord } from "../../../entities/campaign/index.js";
import { lang } from "../../../shared/lib/index.js";

export interface CampaignScopeOptionsProps {
	campaigns: CampaignRecord[];
}

export default function CampaignScopeOptions({
	campaigns,
}: CampaignScopeOptionsProps) {
	return (
		<>
			{campaigns.length === 0 && (
				<option value="">{lang.t("No campaigns")}</option>
			)}
			{campaigns.map((campaign) => (
				<option key={campaign.slug} value={campaign.slug}>
					{campaign.name}
				</option>
			))}
		</>
	);
}
