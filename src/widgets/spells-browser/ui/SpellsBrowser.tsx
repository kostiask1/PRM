import { useEffect, useMemo, useRef, useState } from "react";
import ReactList from "react-list";
import { campaignApi } from "../../../entities/campaign/index.js";
import {
	formatSourceLabel,
	getCampaignIgnoreSourcesList,
	getIgnoreSourcesListFromSelectedSources,
	getSelectedSourcesFromIgnoreList,
} from "../../../entities/reference/index.js";
import { spellApi, type SpellRecord } from "../../../entities/spell/index.js";
import { settingsApi } from "../../../features/settings/index.js";
import { isAbortError } from "../../../shared/api/index.ts";
import type { RichContentRenderOptions } from "../../../features/rich-content/index.js";
import { lang, objectMatchesSearch, useDebounce } from "../../../shared/lib/index.js";
import {
	alert,
	setCampaignsAction,
	setUiSettingsAction,
	useAppDispatch,
	useAppSelector,
} from "../../../shared/model/index.js";
import "../../../assets/components/Spells.css";
import {
	filterSpells,
	getErrorMessage,
	getInitialSpellSelection,
	getInitialSpellScrollPlan,
	getNextSpellSortOrder,
	getSettingsIgnoreSources,
	getSpellClassOptions,
	getSpellListIndex,
	getSpellSchoolOptions,
	getValidSourceFilter,
	normalizeCampaignSourceSettings,
	normalizeSpellList,
	normalizeStringList,
	sortSpells,
	type SpellSortOrder,
} from "../model/spellsBrowser.ts";
import SpellsBrowserContent from "./SpellsBrowserContent.tsx";
import SpellsBrowserControls from "./SpellsBrowserControls.tsx";

export interface SpellsBrowserProps {
	onActiveSpellChange?: ((spell: SpellRecord) => void) | null;
	onSelectSpell?: ((spell: SpellRecord) => void) | null;
	initialSearch?: string;
	initialDetailedSearch?: boolean;
	initialSelectedName?: string;
	scrollToInitialSelected?: boolean;
	hideSearchInput?: boolean;
	renderOptions?: RichContentRenderOptions;
}

function isMobileViewport(): boolean {
	return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

export default function SpellsBrowser({
	onActiveSpellChange = null,
	onSelectSpell = null,
	initialSearch = "",
	initialDetailedSearch = false,
	initialSelectedName = "",
	scrollToInitialSelected = true,
	hideSearchInput = false,
	renderOptions = {},
}: SpellsBrowserProps) {
	const dispatch = useAppDispatch();
	const useSearchDebounce = useAppSelector((state) => state.ui.useSearchDebounce !== false);
	const activeCampaignSlug = useAppSelector((state) => state.navigation.activeCampaignSlug);
	const activeCampaign = useAppSelector((state) => state.active.campaign);
	const globalIgnoreSourcesList = useAppSelector((state) => state.ui.ignoreSourcesList);
	const [sources, setSources] = useState<string[]>([]);
	const [sourceFilter, setSourceFilter] = useState("all");
	const [allSpells, setAllSpells] = useState<SpellRecord[]>([]);
	const [selectedLevel, setSelectedLevel] = useState("all");
	const [selectedClass, setSelectedClass] = useState("all");
	const [selectedSchool, setSelectedSchool] = useState("all");
	const [search, setSearch] = useState(initialSearch);
	const debouncedSearch = useDebounce(search, useSearchDebounce ? 250 : 0);
	const [isDetailedSearch, setIsDetailedSearch] = useState(initialDetailedSearch);
	const [loading, setLoading] = useState(false);
	const [selectedSpell, setSelectedSpell] = useState<SpellRecord | null>(null);
	const [sortOrder, setSortOrder] = useState<SpellSortOrder>("none");
	const listRef = useRef<ReactList | null>(null);
	const listContainerRef = useRef<HTMLDivElement | null>(null);
	const detailRef = useRef<HTMLDivElement | null>(null);
	const selectedSpellRef = useRef<SpellRecord | null>(null);
	const embeddedScrolledSpellRef = useRef("");

	const ignoreSourcesList = useMemo(() => getCampaignIgnoreSourcesList(normalizeCampaignSourceSettings(activeCampaign), normalizeStringList(globalIgnoreSourcesList)), [activeCampaign, globalIgnoreSourcesList]);
	const selectedSources = useMemo(() => getSelectedSourcesFromIgnoreList(sources, ignoreSourcesList), [sources, ignoreSourcesList]);
	const filteredSpells = useMemo(() => filterSpells(allSpells, {
		search: debouncedSearch,
		detailedSearch: isDetailedSearch,
		selectedLevel,
		selectedClass,
		selectedSchool,
		selectedSources,
		sourceFilter,
	}, objectMatchesSearch), [allSpells, debouncedSearch, isDetailedSearch, selectedClass, selectedLevel, selectedSchool, selectedSources, sourceFilter]);
	const displayedSpells = useMemo(() => sortSpells(filteredSpells, sortOrder), [filteredSpells, sortOrder]);
	const classOptions = useMemo(() => getSpellClassOptions(allSpells), [allSpells]);
	const schoolOptions = useMemo(() => getSpellSchoolOptions(allSpells), [allSpells]);
	const sourceFilterLabel = sourceFilter === "all" ? lang.t("All sources") : formatSourceLabel(sourceFilter);

	useEffect(() => { selectedSpellRef.current = selectedSpell; }, [selectedSpell]);
	useEffect(() => { setSearch(initialSearch); }, [initialSearch]);
	useEffect(() => { setIsDetailedSearch(Boolean(initialDetailedSearch)); }, [initialDetailedSearch]);
	useEffect(() => { embeddedScrolledSpellRef.current = ""; }, [initialSelectedName]);
	useEffect(() => { setSourceFilter((current) => getValidSourceFilter(current, selectedSources)); }, [selectedSources]);

	useEffect(() => {
		const controller = new AbortController();
		void spellApi.getSpellSources({ signal: controller.signal })
			.then((value) => {
				if (!controller.signal.aborted) {
					setSources(normalizeStringList(value));
				}
			})
			.catch((error: unknown) => {
				if (!isAbortError(error)) {
					console.error("Failed to load spell sources", error);
				}
			});
		return () => controller.abort();
	}, []);

	useEffect(() => {
		if (sources.length === 0) return;
		const controller = new AbortController();
		setLoading(true);
		void spellApi.getSpellData("all", { signal: controller.signal })
			.then((value) => {
				if (!controller.signal.aborted) {
					setAllSpells(normalizeSpellList(value));
				}
			})
			.catch((error: unknown) => {
				if (!isAbortError(error)) {
					console.error("Failed to load local spells", error);
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
		return () => controller.abort();
	}, [sources]);

	useEffect(() => {
		const plan = getInitialSpellSelection(displayedSpells, allSpells, initialSelectedName, selectedSpellRef.current);
		if (plan.changed) setSelectedSpell(plan.spell);
	}, [allSpells, displayedSpells, initialSelectedName]);

	useEffect(() => {
		const plan = getInitialSpellScrollPlan(
			displayedSpells,
			initialSelectedName,
			selectedSpell,
			scrollToInitialSelected,
			embeddedScrolledSpellRef.current,
		);
		if (!plan) return;
		embeddedScrolledSpellRef.current = plan.scrollKey;
		const frameId = requestAnimationFrame(() =>
			listRef.current?.scrollTo(plan.selectedIndex),
		);
		return () => cancelAnimationFrame(frameId);
	}, [displayedSpells, initialSelectedName, scrollToInitialSelected, selectedSpell]);

	useEffect(() => {
		if (!selectedSpell || !isMobileViewport()) return;
		const selectedIndex = getSpellListIndex(displayedSpells, selectedSpell);
		if (selectedIndex < 0) return;
		const frameId = requestAnimationFrame(() => listRef.current?.scrollTo(selectedIndex));
		return () => cancelAnimationFrame(frameId);
	}, [displayedSpells, selectedSpell]);

	const saveSelectedSources = async (nextSelectedSources: string[]) => {
		const nextIgnoreSourcesList = getIgnoreSourcesListFromSelectedSources(sources, nextSelectedSources);
		try {
			if (activeCampaignSlug) {
				await campaignApi.updateCampaign(activeCampaignSlug, { ignoreSourcesList: nextIgnoreSourcesList });
				dispatch(setCampaignsAction(await campaignApi.listCampaigns() ?? []));
				return;
			}
			const saved = await settingsApi.updateSettings({ ignoreSourcesList: nextIgnoreSourcesList });
			dispatch(setUiSettingsAction({ ignoreSourcesList: getSettingsIgnoreSources(saved) }));
		} catch (error) {
			console.error("Failed to save ignored sources", error);
			dispatch(alert({ title: lang.t("Error"), message: getErrorMessage(error, lang.t("Unknown error")) }));
		}
	};

	const selectSpell = (spell: SpellRecord | null) => {
		setSelectedSpell(spell);
		if (spell) onActiveSpellChange?.(spell);
		if (!spell || !isMobileViewport()) return;
		requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
	};

	return (
		<div className="Spells"><div className="Spells__body">
			<SpellsBrowserControls
				sources={sources} selectedSources={selectedSources} sourceFilter={sourceFilter} sourceFilterLabel={sourceFilterLabel}
				selectedLevel={selectedLevel} selectedClass={selectedClass} selectedSchool={selectedSchool} classOptions={classOptions} schoolOptions={schoolOptions}
				sortOrder={sortOrder} search={search} detailedSearch={isDetailedSearch} hideSearchInput={hideSearchInput}
				onSourcesChange={(value) => { void saveSelectedSources(value); }} onSourceFilterChange={setSourceFilter}
				onLevelChange={setSelectedLevel} onClassChange={setSelectedClass} onSchoolChange={setSelectedSchool}
				onSort={() => setSortOrder((current) => getNextSpellSortOrder(current))} onSearchChange={setSearch}
				onDetailedSearchToggle={() => setIsDetailedSearch((value) => !value)}
			/>
			<SpellsBrowserContent spells={displayedSpells} selectedSpell={selectedSpell} search={debouncedSearch} loading={loading} renderOptions={renderOptions} listRef={listRef} listContainerRef={listContainerRef} detailRef={detailRef} onSelect={selectSpell} onInsert={onSelectSpell} onBack={() => listContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />
		</div></div>
	);
}
