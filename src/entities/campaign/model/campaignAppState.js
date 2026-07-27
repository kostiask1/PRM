export const SET_CAMPAIGNS = "campaigns/set";
export const SET_ACTIVE_CAMPAIGN = "active/setCampaign";
export const REQUEST_CAMPAIGNS_RELOAD = "campaigns/requestReload";

export function setCampaignsAction(payload) {
	return {
		type: SET_CAMPAIGNS,
		payload: Array.isArray(payload) ? payload : [],
	};
}

export function setActiveCampaignAction(payload) {
	return {
		type: SET_ACTIVE_CAMPAIGN,
		payload: payload || null,
	};
}

export function requestCampaignsReloadAction() {
	return { type: REQUEST_CAMPAIGNS_RELOAD };
}
