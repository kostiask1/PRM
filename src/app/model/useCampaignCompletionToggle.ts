import { useCallback } from "react";
import {
	campaignApi,
	type CampaignRecord,
} from "../../entities/campaign/index.js";
import { lang } from "../../shared/lib/index.js";
import {
	alert,
	confirm,
	requestCampaignsReloadAction,
	type AppDispatch,
} from "../../shared/model/index.js";
import { getCampaignCompletionPlan } from "./appShellPresentation.ts";

const api = { ...campaignApi };

export interface CampaignCompletionRecord extends CampaignRecord {
	completed?: boolean;
	completedAt?: string | null;
}

export function useCampaignCompletionToggle(
	dispatch: AppDispatch,
): (campaign: CampaignCompletionRecord) => Promise<void> {
	return useCallback(
		async (campaign: CampaignCompletionRecord) => {
			const completion = getCampaignCompletionPlan(
				campaign,
				new Date(),
				(date) => date.toLocaleDateString(),
			);
			let completedAt = completion.completedAt;

			if (completion.requiresDateConfirmation) {
				const confirmUpdate = await dispatch(
					confirm({
						title: lang.t("Update completion date"),
						message: lang.t(
							"Campaign was already completed on {date}. Update completion date to today?",
							{ date: completion.previousDateLabel },
						),
					}),
				);
				if (confirmUpdate) completedAt = completion.nextCompletedAt;
			} else if (completion.completed) {
				completedAt = completion.nextCompletedAt;
			}

			try {
				await api.updateCampaign(campaign.slug, {
					completed: completion.completed,
					completedAt,
				});
				dispatch(requestCampaignsReloadAction());
			} catch (err) {
				console.error("Failed to toggle campaign status", err);
				dispatch(
					alert({
						title: lang.t("Error"),
						message: lang.t("Failed to update campaign status"),
					}),
				);
			}
		},
		[dispatch],
	);
}
