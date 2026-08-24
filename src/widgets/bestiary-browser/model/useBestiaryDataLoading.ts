import {
	useEffect,
	useMemo,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from "react";
import {
	bestiaryApi,
	type BestiaryFavorite,
	type BestiaryMonster,
	type LegendaryGroup,
} from "../../../entities/bestiary/index.js";
import { isAbortError } from "../../../shared/api/index.ts";
import {
	enrichMonstersWithLegendaryGroups,
	executeBestiarySyncEventPlan,
	getBestiarySourceCodes,
	getBestiarySyncEventPlan,
	getCustomRefreshSelection,
	getMonsterListFromResponse,
	isCustomSource,
	parseBestiarySyncEvent,
	type MonsterReference,
} from "./bestiaryBrowser.ts";

interface Options {
	hasLoadedInitialMonstersRef: MutableRefObject<boolean>;
	legendaryGroups: LegendaryGroup[];
	pendingSyncSelectionRef: MutableRefObject<MonsterReference | null>;
	reloadToken: number;
	selectedMonsterRef: MutableRefObject<BestiaryMonster | null>;
	setAllMonsters: Dispatch<SetStateAction<BestiaryMonster[]>>;
	setFavorites: Dispatch<SetStateAction<BestiaryFavorite[]>>;
	setLegendaryGroups: Dispatch<SetStateAction<LegendaryGroup[]>>;
	setLoading: Dispatch<SetStateAction<boolean>>;
	setReloadToken: Dispatch<SetStateAction<number>>;
	setSelectedMonster: Dispatch<SetStateAction<BestiaryMonster | null>>;
	setSources: Dispatch<SetStateAction<string[]>>;
	shouldAutoSelectMonsterRef: MutableRefObject<boolean>;
	sources: string[];
	rawSyncEvent: unknown;
}

export function useBestiaryDataLoading({
	hasLoadedInitialMonstersRef,
	legendaryGroups,
	pendingSyncSelectionRef,
	reloadToken,
	selectedMonsterRef,
	setAllMonsters,
	setFavorites,
	setLegendaryGroups,
	setLoading,
	setReloadToken,
	setSelectedMonster,
	setSources,
	shouldAutoSelectMonsterRef,
	sources,
	rawSyncEvent,
}: Options): void {
	const syncEvent = useMemo(
		() => parseBestiarySyncEvent(rawSyncEvent),
		[rawSyncEvent],
	);

	useEffect(() => {
		const controller = new AbortController();
		const loadInitialData = async () => {
			try {
				const [sourcesData, legendaryData, favData] = await Promise.all([
					bestiaryApi.getBestiarySources({ signal: controller.signal }),
					bestiaryApi.getLegendaryGroups({ signal: controller.signal }),
					bestiaryApi.getBestiaryFavorites({ signal: controller.signal }),
				]);
				if (controller.signal.aborted) return;
				setSources(getBestiarySourceCodes(sourcesData));
				setLegendaryGroups(Array.isArray(legendaryData) ? legendaryData : []);
				setFavorites(Array.isArray(favData) ? favData : []);
			} catch (error) {
				if (isAbortError(error)) return;
				console.error(
					"Failed to load bestiary sources or legendary groups",
					error,
				);
			}
		};
		loadInitialData();
		return () => controller.abort();
	}, []);

	useEffect(() => {
		const plan = getBestiarySyncEventPlan(syncEvent);
		if (!plan) return undefined;
		const controller = new AbortController();
		executeBestiarySyncEventPlan({
			plan,
			refreshFavorites: () =>
				bestiaryApi.getBestiaryFavorites({ signal: controller.signal }),
			onFavorites: (favorites) => {
				if (!controller.signal.aborted) setFavorites(favorites);
			},
			onRefreshError: (error) => {
				if (!isAbortError(error)) {
					console.error("Failed to reload bestiary favorites", error);
				}
			},
			onPendingSelection: (selection) => {
				pendingSyncSelectionRef.current = selection;
			},
			onSuppressAutoSelection: () => {
				shouldAutoSelectMonsterRef.current = false;
			},
			onReloadMonsters: () => {
				setReloadToken((current) => current + 1);
			},
		});
		return () => controller.abort();
	}, [syncEvent]);

	useEffect(() => {
		if (sources.length === 0) return;

		const controller = new AbortController();
		const loadData = async () => {
			setLoading(true);
			try {
				const [officialData, customData] = await Promise.all([
					bestiaryApi.getBestiaryData("all", { signal: controller.signal }),
					bestiaryApi.getCustomBestiaryData({ signal: controller.signal }),
				]);
				if (controller.signal.aborted) return;
				const enrichedOfficialMonsters = enrichMonstersWithLegendaryGroups(
					getMonsterListFromResponse(officialData),
					legendaryGroups,
				);
				const enrichedCustomMonsters = enrichMonstersWithLegendaryGroups(
					getMonsterListFromResponse(customData),
					legendaryGroups,
				);
				hasLoadedInitialMonstersRef.current = true;
				setAllMonsters([
					...enrichedOfficialMonsters,
					...enrichedCustomMonsters,
				]);
			} catch (error) {
				if (!isAbortError(error)) {
					console.error("Failed to load local monsters", error);
				}
			} finally {
				if (!controller.signal.aborted) setLoading(false);
			}
		};
		loadData();
		return () => controller.abort();
	}, [sources, legendaryGroups]);

	useEffect(() => {
		if (sources.length === 0 || !hasLoadedInitialMonstersRef.current) return;

		const controller = new AbortController();
		const loadCustomData = async () => {
			try {
				const customData = await bestiaryApi.getCustomBestiaryData({
					signal: controller.signal,
				});
				if (controller.signal.aborted) return;
				const enrichedCustomMonsters = enrichMonstersWithLegendaryGroups(
					getMonsterListFromResponse(customData),
					legendaryGroups,
				);
				setAllMonsters((current) => [
					...current.filter((monster) => !isCustomSource(monster.source)),
					...enrichedCustomMonsters,
				]);
				const pendingSelection = pendingSyncSelectionRef.current;
				const nextSelected = getCustomRefreshSelection(
					enrichedCustomMonsters,
					pendingSelection,
					selectedMonsterRef.current,
				);
				if (!nextSelected) return;
				if (pendingSelection?.name) pendingSyncSelectionRef.current = null;
				shouldAutoSelectMonsterRef.current = false;
				selectedMonsterRef.current = nextSelected;
				setSelectedMonster(nextSelected);
			} catch (error) {
				if (!isAbortError(error)) {
					console.error("Failed to load custom monsters", error);
				}
			}
		};
		loadCustomData();
		return () => controller.abort();
	}, [sources, legendaryGroups, reloadToken]);
}
