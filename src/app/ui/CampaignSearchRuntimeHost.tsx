import { useCallback, useMemo, type ReactNode } from "react";

import {
	CampaignSearchRuntimeProvider,
	type CampaignSearchRuntime,
} from "../../widgets/campaign-search/index.js";
import { navigateTo, useAppSelector } from "../model/index.js";

export default function CampaignSearchRuntimeHost({
	children,
}: {
	children?: ReactNode;
}) {
	const activeCampaign = useAppSelector((state) => state.active.campaign);
	const navigateToCampaignSearchTarget = useCallback<
		CampaignSearchRuntime["navigateTo"]
	>((campaignSlug, sessionFileName, encounterId) => {
		navigateTo(campaignSlug, sessionFileName, false, encounterId);
	}, []);
	const runtime = useMemo<CampaignSearchRuntime>(
		() => ({
			activeCampaign,
			navigateTo: navigateToCampaignSearchTarget,
		}),
		[activeCampaign, navigateToCampaignSearchTarget],
	);

	return (
		<CampaignSearchRuntimeProvider runtime={runtime}>
			{children}
		</CampaignSearchRuntimeProvider>
	);
}
