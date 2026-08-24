import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	type MutableRefObject,
} from "react";
import {
	getCampaignIgnoreSourcesList,
	getIgnoreSourcesListFromSelectedSources,
	getSelectedSourcesFromIgnoreList,
	normalizeSourceCode,
	type CampaignSourceSettings,
} from "../../../entities/reference/index.js";
import { formatSourceLabel } from "../../../entities/reference/index.js";
import {
	executeBestiarySelectedSourcesSave,
	isCustomSource,
	type ExecuteBestiarySelectedSourcesSaveOptions,
} from "../model.js";

type SourcePersistence = Pick<
	ExecuteBestiarySelectedSourcesSaveOptions,
	"listCampaigns" | "onCampaigns" | "onUiIgnoreSources" | "updateCampaign" | "updateSettings"
>;

export interface UseBestiarySourceSelectionOptions extends SourcePersistence {
	activeCampaign: CampaignSourceSettings | null;
	activeCampaignSlug: string | null;
	globalIgnoreSourcesList: string[];
	showError(message: string): void;
	shouldAutoSelectMonsterRef: MutableRefObject<boolean>;
	sources: string[];
	translate(value: string): string;
}

export function useBestiarySourceSelection({
	activeCampaign,
	activeCampaignSlug,
	globalIgnoreSourcesList,
	listCampaigns,
	onCampaigns,
	onUiIgnoreSources,
	showError,
	shouldAutoSelectMonsterRef,
	sources,
	translate,
	updateCampaign,
	updateSettings,
}: UseBestiarySourceSelectionOptions) {
	const [sourceFilter, setSourceFilter] = useState("all");
	const sourceOptions = useMemo(
		() => sources.filter((source) => !isCustomSource(source)),
		[sources],
	);
	const filterSourceOptions = useMemo(
		() => ["CUSTOM", ...sourceOptions],
		[sourceOptions],
	);
	const ignoreSourcesList = useMemo(
		() =>
			getCampaignIgnoreSourcesList(activeCampaign, globalIgnoreSourcesList),
		[activeCampaign, globalIgnoreSourcesList],
	);
	const selectedSources = useMemo(
		() =>
			getSelectedSourcesFromIgnoreList(
				filterSourceOptions,
				ignoreSourcesList,
			),
		[filterSourceOptions, ignoreSourcesList],
	);
	const sourceFilterLabel = useMemo(() => {
		if (sourceFilter === "all") return translate("All sources");
		if (isCustomSource(sourceFilter)) return translate("Custom creatures");
		return formatSourceLabel(sourceFilter.replace(/^bestiary-/i, ""));
	}, [sourceFilter, translate]);

	useEffect(() => {
		if (sourceFilter === "all") return;
		const selectedSourceSet = new Set(selectedSources.map(normalizeSourceCode));
		if (!selectedSourceSet.has(normalizeSourceCode(sourceFilter))) {
			setSourceFilter("all");
		}
	}, [selectedSources, sourceFilter]);

	const saveSelectedSources = useCallback(
		async (nextSelectedSources: string[]) => {
			await executeBestiarySelectedSourcesSave({
				filterSourceOptions,
				nextSelectedSources,
				activeCampaignSlug,
				getIgnoreSourcesList: getIgnoreSourcesListFromSelectedSources,
				onEnableAutoSelection: () => {
					shouldAutoSelectMonsterRef.current = true;
				},
				updateCampaign,
				listCampaigns,
				onCampaigns,
				updateSettings,
				onUiIgnoreSources,
				onLogError: (error) =>
					console.error("Failed to save ignored sources", error),
				onError: (error) => showError(error instanceof Error && error.message ? error.message : translate("Unknown error")),
			});
		},
		[
			activeCampaignSlug,
			filterSourceOptions,
			listCampaigns,
			onCampaigns,
			onUiIgnoreSources,
			showError,
			shouldAutoSelectMonsterRef,
			translate,
			updateCampaign,
			updateSettings,
		],
	);

	return {
		filterSourceOptions,
		selectedSources,
		saveSelectedSources,
		sourceFilter,
		sourceFilterLabel,
		sourceOptions,
		setSourceFilter,
	};
}
