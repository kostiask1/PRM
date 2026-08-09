import { useEffect, useMemo, useState } from "react";

import { campaignApi } from "../../../entities/campaign/index.js";
import { sessionApi } from "../../../entities/session/index.js";
import { lang } from "../../../shared/lib/index.js";
import {
	CAMPAIGN_SEARCH_FILTERS,
	executeCampaignSearchIndexLoad,
	filterCampaignSearchResults,
	toggleCampaignSearchFilter,
	type CampaignSearchCampaign,
	type CampaignSearchFilter,
	type CampaignSearchResult,
} from "../model.js";
import { useCampaignSearchRuntime } from "./CampaignSearchRuntime.tsx";

const api = { ...campaignApi, ...sessionApi };

function isCampaignSearchCampaign(value: unknown): value is CampaignSearchCampaign {
	if (!value || typeof value !== "object") return false;
	const campaign = value as Record<string, unknown>;
	return typeof campaign.slug === "string" && typeof campaign.name === "string";
}

export interface GlobalSearchModalController {
	query: string;
	activeFilters: Set<CampaignSearchFilter>;
	results: CampaignSearchResult[];
	isLoading: boolean;
	error: string;
	setQuery: (query: string) => void;
	toggleFilter: (filter: CampaignSearchFilter) => void;
}

export function useGlobalSearchModalController(): GlobalSearchModalController {
	const { activeCampaign } = useCampaignSearchRuntime();
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
		const controller = new AbortController();
		setIsLoading(true);
		setError("");
		void executeCampaignSearchIndexLoad({
			campaign,
			currentData: campaign,
			api,
			translate: (key, params) => lang.t(key, params),
			unknownErrorMessage: lang.t("Unknown error"),
			isCancelled: () => controller.signal.aborted,
			requestOptions: { signal: controller.signal },
			effects: { setIndex, setError, setLoading: setIsLoading },
		});
		return () => controller.abort();
	}, [campaign]);

	const results = useMemo(
		() => filterCampaignSearchResults(index, query, activeFilters),
		[activeFilters, index, query],
	);
	const toggleFilter = (filter: CampaignSearchFilter) => {
		setActiveFilters((current) => toggleCampaignSearchFilter(current, filter));
	};
	return { query, activeFilters, results, isLoading, error, setQuery, toggleFilter };
}
