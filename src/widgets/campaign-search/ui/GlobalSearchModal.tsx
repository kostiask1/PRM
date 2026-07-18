import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { campaignApi } from "../../../entities/campaign/index.js";
import { sessionApi } from "../../../entities/session/index.js";
import { Modal } from "../../../features/modal/index.js";
import { buildNavigationUrl, lang, scrollToHashTarget } from "../../../shared/lib/index.js";
import { navigateTo, useAppSelector } from "../../../shared/model/index.js";
import { Button } from "../../../shared/ui/index.js";
import "../../../assets/components/GlobalSearchModal.css";
import {
	CAMPAIGN_SEARCH_FILTERS,
	filterCampaignSearchResults,
	loadCampaignSearchIndex,
	toggleCampaignSearchFilter,
	type CampaignSearchCampaign,
	type CampaignSearchFilter,
	type CampaignSearchResult,
	type CampaignSearchTarget,
} from "../model.js";
import CampaignSearchResults, { FILTER_COLOR_BY_ID } from "./CampaignSearchResults.tsx";

const api = { ...campaignApi, ...sessionApi };

export interface GlobalSearchModalProps {
	onCancel?: () => void;
}

function isCampaignSearchCampaign(value: unknown): value is CampaignSearchCampaign {
	if (!value || typeof value !== "object") return false;
	const campaign = value as Record<string, unknown>;
	return typeof campaign.slug === "string" && typeof campaign.name === "string";
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error && error.message ? error.message : lang.t("Unknown error");
}

function openCampaignSearchTarget(target: CampaignSearchTarget): void {
	const sessionFileName = target.sessionFileName || null;
	const encounterId = target.encounterId || null;
	const url = buildNavigationUrl(target.campaignSlug, sessionFileName, encounterId);
	navigateTo(target.campaignSlug, sessionFileName, false, encounterId);
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
	const activeCampaign = useAppSelector((state) => state.active.campaign);
	const campaign = isCampaignSearchCampaign(activeCampaign) ? activeCampaign : null;
	const [query, setQuery] = useState("");
	const [activeFilters, setActiveFilters] = useState<Set<CampaignSearchFilter>>(
		() => new Set(CAMPAIGN_SEARCH_FILTERS),
	);
	const [index, setIndex] = useState<CampaignSearchResult[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!campaign) {
			setIsLoading(false);
			return undefined;
		}
		let cancelled = false;
		setIsLoading(true);
		setError("");
		void loadCampaignSearchIndex({
			campaign,
			currentData: campaign,
			api,
			translate: (key, params) => lang.t(key, params),
		})
			.then((nextIndex) => { if (!cancelled) setIndex(nextIndex); })
			.catch((loadError: unknown) => { if (!cancelled) setError(getErrorMessage(loadError)); })
			.finally(() => { if (!cancelled) setIsLoading(false); });
		return () => { cancelled = true; };
	}, [campaign]);

	const results = useMemo(
		() => filterCampaignSearchResults(index, query, activeFilters),
		[activeFilters, index, query],
	);
	const openResult = (result: CampaignSearchResult) => {
		onCancel?.();
		openCampaignSearchTarget(result.target);
	};

	return (
		<Modal title={lang.t("Global search")} onConfirm={() => onCancel?.()} onCancel={onCancel} showFooter={false}>
			<div className="GlobalSearch">
				<div className="GlobalSearch__bar">
					<input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={lang.t("Search campaign...")} />
				</div>
				<div className="GlobalSearch__filters">
					{CAMPAIGN_SEARCH_FILTERS.map((filter) => (
						<Button
							key={filter}
							variant={activeFilters.has(filter) ? "primary" : "ghost"}
							size={Button.SIZES.SMALL}
							className="GlobalSearch__filter"
							onClick={() => setActiveFilters((current) => toggleCampaignSearchFilter(current, filter))}
							style={{ "--search-result-color": FILTER_COLOR_BY_ID[filter] } as CSSProperties}
						>
							{lang.t(`Search filter: ${filter}`)}
						</Button>
					))}
				</div>
				{isLoading && <div className="GlobalSearch__state">{lang.t("Loading...")}</div>}
				{error && <div className="GlobalSearch__state is_error">{error}</div>}
				{!isLoading && !error && <CampaignSearchResults results={results} query={query} onOpen={openResult} />}
			</div>
		</Modal>
	);
}
