import type { CSSProperties } from "react";

import { Modal } from "../../../features/modal/index.js";
import { lang } from "../../../shared/lib/index.js";
import { Button } from "../../../shared/ui/index.js";
import {
	CAMPAIGN_SEARCH_FILTERS,
	type CampaignSearchFilter,
	type CampaignSearchResult,
} from "../model.js";
import CampaignSearchResults, { FILTER_COLOR_BY_ID } from "./CampaignSearchResults.tsx";

interface GlobalSearchModalViewProps {
	query: string;
	activeFilters: ReadonlySet<CampaignSearchFilter>;
	results: CampaignSearchResult[];
	isLoading: boolean;
	error: string;
	onQueryChange: (query: string) => void;
	onToggleFilter: (filter: CampaignSearchFilter) => void;
	onOpen: (result: CampaignSearchResult) => void;
	onCancel?: () => void;
}

const ignoreGlobalSearchConfirmation = () => undefined;

function getGlobalSearchConfirmationHandler(onCancel: (() => void) | undefined): () => void {
	return onCancel ?? ignoreGlobalSearchConfirmation;
}

function CampaignSearchFilterButton({ filter, active, onToggle }: {
	filter: CampaignSearchFilter;
	active: boolean;
	onToggle: (filter: CampaignSearchFilter) => void;
}) {
	return (
		<Button
			variant={active ? "primary" : "ghost"}
			size={Button.SIZES.SMALL}
			className="GlobalSearch__filter"
			onClick={() => onToggle(filter)}
			style={{ "--search-result-color": FILTER_COLOR_BY_ID[filter] } as CSSProperties}
		>
			{lang.t(`Search filter: ${filter}`)}
		</Button>
	);
}

function CampaignSearchContentState({ isLoading, error, results, query, onOpen }: Pick<
	GlobalSearchModalViewProps,
	"isLoading" | "error" | "results" | "query" | "onOpen"
>) {
	if (isLoading) return <div className="GlobalSearch__state">{lang.t("Loading...")}</div>;
	if (error) return <div className="GlobalSearch__state is_error">{error}</div>;
	return <CampaignSearchResults results={results} query={query} onOpen={onOpen} />;
}

export default function GlobalSearchModalView(props: GlobalSearchModalViewProps) {
	return (
		<Modal title={lang.t("Global search")} onConfirm={getGlobalSearchConfirmationHandler(props.onCancel)} onCancel={props.onCancel} showFooter={false}>
			<div className="GlobalSearch">
				<div className="GlobalSearch__bar">
					<input autoFocus value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder={lang.t("Search campaign...")} />
				</div>
				<div className="GlobalSearch__filters">
					{CAMPAIGN_SEARCH_FILTERS.map((filter) => (
						<CampaignSearchFilterButton key={filter} filter={filter} active={props.activeFilters.has(filter)} onToggle={props.onToggleFilter} />
					))}
				</div>
				<CampaignSearchContentState {...props} />
			</div>
		</Modal>
	);
}
