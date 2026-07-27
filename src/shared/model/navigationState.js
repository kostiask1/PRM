import { getAppStore } from "../lib/index.js";
import { buildNavigationUrl, parseUrl } from "../lib/navigation.js";

export const SET_NAVIGATION = "navigation/set";

let routerNavigate = null;

export function setNavigationAction(payload) {
	return {
		type: SET_NAVIGATION,
		payload,
	};
}

export function syncNavigationFromPath(pathname) {
	const route = parseUrl(pathname);
	getAppStore().dispatch(
		setNavigationAction({
			activeCampaignSlug: route.campaign || null,
			activeSessionFileName: route.session || null,
			activeEncounterId: route.encounter || null,
		}),
	);
}

export function setRouterNavigate(navigate) {
	routerNavigate = typeof navigate === "function" ? navigate : null;
}

export function navigateTo(
	slug,
	fileName = null,
	replace = false,
	encounterId = null,
	openInNewTab = false,
) {
	const url = buildNavigationUrl(slug, fileName, encounterId);
	if (openInNewTab) {
		window.open(url, "_blank");
		return;
	}
	getAppStore().dispatch(
		setNavigationAction({
			activeCampaignSlug: slug || null,
			activeSessionFileName: fileName || null,
			activeEncounterId: encounterId || null,
		}),
	);
	if (routerNavigate) {
		routerNavigate(url, { replace });
	} else if (replace) {
		window.history.replaceState({}, "", url);
	} else {
		window.history.pushState({}, "", url);
	}
}
