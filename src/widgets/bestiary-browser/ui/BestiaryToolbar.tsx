import type { Dispatch, ReactNode, SetStateAction } from "react";
import { formatSourceLabel } from "../../../entities/reference/index.js";
import { Input } from "../../../features/editor/ui/index.js";
import { lang } from "../../../shared/lib/index.js";
import { classNames } from "../../../shared/lib/index.js";
import { Button, Icon, MultiSelect } from "../../../shared/ui/index.js";
import type { BestiarySortOrder } from "../model.js";

export interface BestiaryToolbarProps {
	headerActions?: ReactNode;
	hideSearchInput?: boolean;
	isDetailedSearch: boolean;
	onSelectedSourcesChange: (sources: string[]) => void | Promise<void>;
	onSourceFilterChange: (source: string) => void;
	onlyFavorites: boolean;
	search: string;
	selectedSources: string[];
	setIsDetailedSearch: Dispatch<SetStateAction<boolean>>;
	setOnlyFavorites: Dispatch<SetStateAction<boolean>>;
	setSearch: Dispatch<SetStateAction<string>>;
	sortOrder: BestiarySortOrder;
	sourceFilter: string;
	sourceFilterLabel: string;
	sourceOptions: string[];
	sources: string[];
	toggleSort: () => void;
}

export function BestiaryToolbar({
	headerActions,
	hideSearchInput,
	isDetailedSearch,
	onSelectedSourcesChange,
	onSourceFilterChange,
	onlyFavorites,
	search,
	selectedSources,
	setIsDetailedSearch,
	setOnlyFavorites,
	setSearch,
	sortOrder,
	sourceFilter,
	sourceFilterLabel,
	sourceOptions,
	sources,
	toggleSort,
}: BestiaryToolbarProps) {
	return (
		<div className="Bestiary__search">
			<MultiSelect
				className="Bestiary__source_select"
				dropdownMinWidth={450}
				value={selectedSources}
				onChange={onSelectedSourcesChange}
				onOptionClick={onSourceFilterChange}
				activeValue={sourceFilter}
				allOptionLabel={lang.t("All sources")}
				onAllOptionClick={() => onSourceFilterChange("all")}
				labelOverride={sourceFilterLabel}
				placeholder={lang.t("Sources")}
				allSelectedLabel={lang.t("All sources")}
				noneSelectedLabel={lang.t("No sources")}
				selectAllLabel={lang.t("Select all")}
				clearLabel={lang.t("Clear")}
				disabled={sources.length === 0}
				options={[
					{ value: "CUSTOM", label: lang.t("Custom creatures") },
					...sourceOptions.map((source) => ({
						value: source,
						label: formatSourceLabel(source.replace(/^bestiary-/i, "")),
					})),
				]}
			/>
			{!hideSearchInput && (
				<div className="Bestiary__searchInput">
					<Input
						placeholder={lang.t("Search by name or type...")}
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
					<Button
						variant={isDetailedSearch ? "primary" : "ghost"}
						icon="search-detailed"
						onClick={() => setIsDetailedSearch((value) => !value)}
						title={lang.t("Detailed search")}
						className="DetailedSearchButton Bestiary__detailed_search_btn"
					/>
				</div>
			)}
			<Button
				variant={onlyFavorites ? "primary" : "ghost"}
				icon="star"
				onClick={() => setOnlyFavorites(!onlyFavorites)}
				title={lang.t("Only favorites")}
				className="Bestiary__filter_fav_btn"
			/>
			<Button
				className={classNames("Bestiary__sort_btn", {
					is_active: sortOrder !== "none",
				})}
				variant="ghost"
				onClick={toggleSort}
				title={lang.t("Sort by CR (Challenge Rating)")}
			>
				<span className="Bestiary__sort_label">CR</span>
				<Icon
					name={`sort-${sortOrder}`}
					className={classNames(
						"Bestiary__sort_icon",
						`state-${sortOrder}`,
					)}
				/>
			</Button>
			{headerActions && (
				<div className="Bestiary__embedded_actions">{headerActions}</div>
			)}
		</div>
	);
}
