import { formatSourceLabel } from "../../../entities/reference/index.js";
import { Input } from "../../../features/editor/ui/index.js";
import { classNames, lang } from "../../../shared/lib/index.js";
import { Button, Icon, MultiSelect, Select } from "../../../shared/ui/index.js";
import {
	SPELL_SCHOOL_NAMES,
	type SpellSchoolCode,
	type SpellSortOrder,
} from "../model/spellsBrowser.ts";

interface SpellsBrowserControlsProps {
	sources: string[];
	selectedSources: string[];
	sourceFilter: string;
	sourceFilterLabel: string;
	selectedLevel: string;
	selectedClass: string;
	selectedSchool: string;
	classOptions: string[];
	schoolOptions: SpellSchoolCode[];
	sortOrder: SpellSortOrder;
	search: string;
	detailedSearch: boolean;
	hideSearchInput: boolean;
	onSourcesChange: (sources: string[]) => void;
	onSourceFilterChange: (source: string) => void;
	onLevelChange: (level: string) => void;
	onClassChange: (className: string) => void;
	onSchoolChange: (school: string) => void;
	onSort: () => void;
	onSearchChange: (search: string) => void;
	onDetailedSearchToggle: () => void;
}

export default function SpellsBrowserControls(props: SpellsBrowserControlsProps) {
	return (
		<div className="Spells__search">
			{props.sources.length > 0 && (
				<MultiSelect<string>
					className="Spells__source_select"
					dropdownMinWidth={450}
					value={props.selectedSources}
					onChange={props.onSourcesChange}
					onOptionClick={props.onSourceFilterChange}
					activeValue={props.sourceFilter}
					allOptionLabel={lang.t("All sources")}
					onAllOptionClick={() => props.onSourceFilterChange("all")}
					labelOverride={props.sourceFilterLabel}
					placeholder={lang.t("Sources")}
					allSelectedLabel={lang.t("All sources")}
					noneSelectedLabel={lang.t("No sources")}
					selectAllLabel={lang.t("Select all")}
					clearLabel={lang.t("Clear")}
					options={props.sources.map((source) => ({ value: source, label: formatSourceLabel(source) }))}
				/>
			)}
			<Select value={props.selectedLevel} onChange={(event) => props.onLevelChange(event.target.value)} className="Spells__level_select">
				<option value="all">{lang.t("All levels")}</option>
				<option value="0">{lang.t("Cantrip (0)")}</option>
				{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => <option key={level} value={String(level)}>{lang.t("Level {level}", { level })}</option>)}
			</Select>
			<Select value={props.selectedClass} onChange={(event) => props.onClassChange(event.target.value)} className="Spells__class_select">
				<option value="all">{lang.t("All classes")}</option>
				{props.classOptions.map((className) => <option key={className} value={className}>{className}</option>)}
			</Select>
			<Select value={props.selectedSchool} onChange={(event) => props.onSchoolChange(event.target.value)} className="Spells__school_select">
				<option value="all">{lang.t("All schools")}</option>
				{props.schoolOptions.map((school) => <option key={school} value={school}>{SPELL_SCHOOL_NAMES[school]}</option>)}
			</Select>
			<Button className={classNames("Spells__sort_btn", { is_active: props.sortOrder !== "none" })} variant="ghost" onClick={props.onSort} title={lang.t("Sort by level")}>
				<span className="Spells__sort_label">LVL</span>
				<Icon name={`sort-${props.sortOrder}`} className={classNames("Spells__sort_icon", `state-${props.sortOrder}`)} />
			</Button>
			{!props.hideSearchInput && (
				<div className="Spells__searchInput">
					<Input placeholder={lang.t("Search spell...")} value={props.search} onChange={(event) => props.onSearchChange(event.target.value)} />
					<Button variant={props.detailedSearch ? "primary" : "ghost"} icon="search-detailed" onClick={props.onDetailedSearchToggle} title={lang.t("Detailed search")} className="DetailedSearchButton Spells__detailed_search_btn" />
				</div>
			)}
		</div>
	);
}
