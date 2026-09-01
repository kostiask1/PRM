import { buildNavigationUrl, scrollToHashTarget } from "../../../shared/lib/index.js";
import "../../../assets/components/GlobalSearchModal.css";
import {
	type CampaignSearchResult,
	type CampaignSearchTarget,
} from "../model.js";
import {
	type CampaignSearchRuntime,
	useCampaignSearchRuntime,
} from "./CampaignSearchRuntime.tsx";
import GlobalSearchModalView from "./GlobalSearchModalView.tsx";
import { useGlobalSearchModalController } from "./useGlobalSearchModalController.ts";

export interface GlobalSearchModalProps {
	onCancel?: () => void;
}

function openCampaignSearchTarget(
	target: CampaignSearchTarget,
	navigateTo: CampaignSearchRuntime["navigateTo"],
): void {
	const sessionFileName = target.sessionFileName || null;
	const encounterId = target.encounterId || null;
	const url = buildNavigationUrl(target.campaignSlug, sessionFileName, encounterId);
	navigateTo(target.campaignSlug, sessionFileName, encounterId);
	if (!target.hash) return;

	const hash = `#${encodeURIComponent(target.hash)}`;
	window.history.replaceState({}, "", `${url}${hash}`);
	window.setTimeout(() => scrollToHashTarget(`#${target.hash}`), 80);
	window.setTimeout(() => {
		if (window.location.pathname === url && window.location.hash === hash) {
			window.history.replaceState({}, "", url);
		}
	}, 2400);
}

export default function GlobalSearchModal({ onCancel }: GlobalSearchModalProps) {
	const controller = useGlobalSearchModalController();
	const { navigateTo } = useCampaignSearchRuntime();
	const openResult = (result: CampaignSearchResult) => {
		onCancel?.();
		openCampaignSearchTarget(result.target, navigateTo);
	};
	return <GlobalSearchModalView {...controller} onQueryChange={controller.setQuery} onToggleFilter={controller.toggleFilter} onOpen={openResult} onCancel={onCancel} />;
}
