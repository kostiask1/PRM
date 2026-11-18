import type { CSSProperties } from "react";

import { lang } from "../../../shared/lib/index.js";
import { Button, Modal } from "../../../shared/ui/index.js";
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
			className="GlobalSearchModal__filter"
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
	if (isLoading) {
		return (
			<div className="GlobalSearchModal__results" aria-busy="true" aria-label={lang.t("Loading...")}>
				<span className="sr-only">{lang.t("Loading...")}</span>
				{Array.from({ length: 4 }).map((_, i) => (
					<div key={i} className="GlobalSearchModal__result Skeleton--card" style={{ cursor: "default" }}>
						<div className="Skeleton Skeleton--text" style={{ width: "25%", height: "16px", marginBottom: "4px" }} />
						<div className="Skeleton Skeleton--title" style={{ width: "60%", height: "18px" }} />
						<div className="Skeleton Skeleton--text" style={{ width: "90%", height: "14px" }} />
						<div className="Skeleton Skeleton--text" style={{ width: "75%", height: "14px" }} />
					</div>
				))}
			</div>
		);
	}
	if (error) return <div className="GlobalSearchModal__state is_error">{error}</div>;
	return <CampaignSearchResults results={results} query={query} onOpen={onOpen} />;
}

export default function GlobalSearchModalView(props: GlobalSearchModalViewProps) {
	return (
		<Modal title={lang.t("Global search")} onConfirm={getGlobalSearchConfirmationHandler(props.onCancel)} onCancel={props.onCancel} showFooter={false}>
			<div className="GlobalSearchModal">
				<div className="GlobalSearchModal__bar">
					<input autoFocus value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder={lang.t("Search campaign...")} />
				</div>
				<div className="GlobalSearchModal__filters">
					{CAMPAIGN_SEARCH_FILTERS.map((filter) => (
						<CampaignSearchFilterButton key={filter} filter={filter} active={props.activeFilters.has(filter)} onToggle={props.onToggleFilter} />
					))}
				</div>
				<CampaignSearchContentState {...props} />
			</div>
		</Modal>
	);
}
