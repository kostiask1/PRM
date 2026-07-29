import {
	useState,
	useEffect,
	useMemo,
	useRef,
	useCallback,
	type ChangeEvent,
	type ComponentType,
} from "react";
import type ReactList from "react-list";
import { campaignApi } from "../../../entities/campaign/index.js";
import {
	bestiaryApi,
	type BestiaryFavorite,
	type BestiaryMonster,
	type LegendaryGroup,
} from "../../../entities/bestiary/index.js";
import { aiApi } from "../../../features/ai/index.js";
import type {
	AiHistoryEntry,
	AiHistoryResource,
	AiModelDescriptor,
} from "../../../features/ai/index.js";
import type {
	AiResponseModalComponent,
	AiUiAttachment,
} from "../../../features/ai/ui/index.js";
import type { MonsterFieldEditModalProps } from "../../../features/edit-monster/index.js";
import { settingsApi } from "../../../features/settings/index.js";
import { isAbortError } from "../../../shared/api/index.ts";
import {
	alert,
	confirm,
	setCampaignsAction,
	setUiSettingsAction,
} from "../../../shared/model/index.js";
import { useAppDispatch, useAppSelector } from "../../../shared/model/index.js";
import { Button } from "../../../shared/ui/index.js";
import {
	BestiaryAiModals,
	MonsterAiActionModal,
	type MonsterAiAction,
	type MonsterAiEditMode,
} from "../../../features/ai-edit-monster/index.js";
import BestiaryContent from "./BestiaryContent.tsx";
import { MonsterStatBlockModel } from "../../../entities/bestiary/index.js";
import { useDebounce } from "../../../shared/lib/index.js";
import { buildDiffResources } from "../../../features/ai/index.js";
import {
	getHistoryChangeSummary as getAiHistoryChangeSummary,
	getLocalizedDiffResourceState,
} from "../../../features/ai/index.js";
import { loadAiModelOptions } from "../../../features/ai/index.js";
import { matchesMonsterSearch } from "../../../entities/bestiary/index.js";
import { objectMatchesSearch } from "../../../shared/lib/index.js";
import {
	getCampaignIgnoreSourcesList,
	getIgnoreSourcesListFromSelectedSources,
	getSelectedSourcesFromIgnoreList,
	normalizeSourceCode,
	type CampaignSourceSettings,
} from "../../../entities/reference/index.js";
import { formatSourceLabel } from "../../../entities/reference/index.js";
import {
	addUndoSnapshot,
	clearRedoStack,
	createRedoTransition,
	createUndoTransition,
} from "../../../shared/lib/index.js";
import { downloadJsonFile } from "../../../shared/lib/index.js";
import "../../../assets/components/Bestiary.css";
import { lang } from "../../../shared/lib/index.js";
import { classNames } from "../../../shared/lib/index.js";
import {
	cloneCustomMonsters,
	enrichMonstersWithLegendaryGroups,
	executeAiDraftRestore,
	executeAiMonsterEditRequest,
	executeBestiaryFieldEditSave,
	executeBestiarySelectedSourcesSave,
	executeBestiarySyncEventPlan,
	filterBestiaryMonsters,
	getBestiarySourceCodes,
	getBestiarySyncEventPlan,
	getBestiaryInitialSelectionScrollPlan,
	getBestiaryFieldEditStartPlan,
	getBestiarySelectionPlan,
	getCustomBestiaryUpdatePlan,
	getCustomRefreshSelection,
	getCreateBasedMonsterPlan,
	getCustomMonsterDeleteStartPlan,
	getEditedCustomMonsterPayload,
	getAiDraftRestoreStartPlan,
	getAiMonsterEditStartPlan,
	getAiMonsterGenerationResultPlan,
	getMonsterListFromResponse,
	getNextBestiarySortOrder,
	isCustomSource,
	isSameMonsterIdentity,
	mergeImportedCustomMonsters,
	normalizeMonsterName,
	parseImportedCustomMonsters,
	parseBestiarySyncEvent,
	parseMonsterReference,
	preserveAiDraftResourceMetadata,
	removeDeletedCustomMonsterFavorite,
	replaceDeletedCustomMonsterList,
	shouldClearAiMonsterEditController,
	sortBestiaryMonsters,
	type AiBestiaryGenerationResult,
	type BestiarySortOrder,
	type CustomBestiaryUpdateOptions,
	type MonsterReference,
} from "../model.js";
import type {
	BestiaryAssistantSlot,
	BestiaryMonsterStatBlockSlot,
} from "./bestiaryComposition.ts";

const api = { ...campaignApi, ...bestiaryApi, ...aiApi, ...settingsApi };

function translate(value: string): string {
	return lang.t(value);
}

function getHistoryChangeSummary(entry: AiHistoryEntry | null | undefined): string {
	return getAiHistoryChangeSummary(entry, translate);
}

function getDiffResourceState(resource: AiHistoryResource): string {
	return getLocalizedDiffResourceState(resource, translate);
}

function getErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

interface ApplyCustomMonsterListOptions {
	selectedName?: string;
	clearSelection?: boolean;
}

export interface BestiaryBrowserProps {
	AiAssistantPanel: BestiaryAssistantSlot;
	MonsterStatBlock: BestiaryMonsterStatBlockSlot;
	ResponseModal: AiResponseModalComponent;
	MonsterEditorModal: ComponentType<
		Pick<
			MonsterFieldEditModalProps,
			"editingMonster" | "onCancel" | "onSave"
		>
	>;
	onAddMonster?: ((monster: BestiaryMonster) => void) | null;
	initialSearch?: string;
	initialDetailedSearch?: boolean;
	initialSelectedName?: string;
	initialSelectedSource?: string;
	scrollToInitialSelected?: boolean;
	hideSearchInput?: boolean;
	onActiveMonsterChange?: ((monster: BestiaryMonster) => void) | null;
	onSelectMonster?: ((monster: BestiaryMonster) => void) | null;
}

export default function BestiaryBrowser({
	AiAssistantPanel,
	MonsterStatBlock,
	ResponseModal,
	MonsterEditorModal,
	onAddMonster,
	initialSearch = "",
	initialDetailedSearch = false,
	initialSelectedName = "",
	initialSelectedSource = "",
	scrollToInitialSelected = true,
	hideSearchInput = false,
	onActiveMonsterChange = null,
	onSelectMonster = null,
}: BestiaryBrowserProps) {
	const dispatch = useAppDispatch();
	const currentLanguage = useAppSelector(
		(state) => state.localization.language,
	);
	const useSearchDebounce = useAppSelector(
		(state) => state.ui.useSearchDebounce !== false,
	);
	const activeCampaignSlug = useAppSelector(
		(state) => state.navigation.activeCampaignSlug,
	);
	const activeCampaign = useAppSelector(
		(state) => state.active.campaign,
	) as CampaignSourceSettings | null;
	const globalIgnoreSourcesList = useAppSelector(
		(state) => state.ui.ignoreSourcesList || [],
	);
	const rawSyncEvent = useAppSelector((state) => state.sync.event);
	const syncEvent = useMemo(
		() => parseBestiarySyncEvent(rawSyncEvent),
		[rawSyncEvent],
	);
	const initialMonsterReference = useMemo(
		() => parseMonsterReference(initialSelectedName, initialSelectedSource),
		[initialSelectedName, initialSelectedSource],
	);
	const [sources, setSources] = useState<string[]>([]);
	const [sourceFilter, setSourceFilter] = useState("all");
	const [allMonsters, setAllMonsters] = useState<BestiaryMonster[]>([]);
	const [monsters, setMonsters] = useState<BestiaryMonster[]>([]);
	const [search, setSearch] = useState(initialSearch);
	const debouncedSearch = useDebounce(search, useSearchDebounce ? 250 : 0);
	const [isDetailedSearch, setIsDetailedSearch] = useState(
		initialDetailedSearch,
	);
	const [loading, setLoading] = useState(false);
	const [selectedMonster, setSelectedMonster] = useState<BestiaryMonster | null>(null);
	const [legendaryGroups, setLegendaryGroups] = useState<LegendaryGroup[]>([]);
	const [favorites, setFavorites] = useState<BestiaryFavorite[]>([]);
	const [onlyFavorites, setOnlyFavorites] = useState(false);
	const [sortOrder, setSortOrder] = useState<BestiarySortOrder>("none");
	const [reloadToken, setReloadToken] = useState(0);
	const [fieldEditingMonster, setFieldEditingMonster] = useState<BestiaryMonster | null>(null);
	const [fieldEditingMode, setFieldEditingMode] = useState<"edit" | "create-based">("edit");
	const [fieldEditingOriginalMonster, setFieldEditingOriginalMonster] =
		useState<BestiaryMonster | null>(null);
	const [aiEditingMonster, setAiEditingMonster] = useState<BestiaryMonster | null>(null);
	const [aiEditMode, setAiEditMode] = useState<MonsterAiEditMode>("edit");
	const [aiActionMonster, setAiActionMonster] = useState<BestiaryMonster | null>(null);
	const [aiEditInstructions, setAiEditInstructions] = useState("");
	const [aiEditAttachedImages, setAiEditAttachedImages] = useState<AiUiAttachment[]>([]);
	const [aiEditAttachedFiles, setAiEditAttachedFiles] = useState<AiUiAttachment[]>([]);
	const [aiEditError, setAiEditError] = useState("");
	const [isAiEditingMonster, setIsAiEditingMonster] = useState(false);
	const [aiModels, setAiModels] = useState<AiModelDescriptor[]>([]);
	const [selectedAiModel, setSelectedAiModel] = useState("");
	const [aiDraftResponseEntry, setAiDraftResponseEntry] = useState<AiHistoryEntry | null>(null);
	const [isRestoringAiResponse, setIsRestoringAiResponse] = useState(false);
	const [isHeaderActionsOpen, setIsHeaderActionsOpen] = useState(false);
	const [undoStack, setUndoStack] = useState<BestiaryMonster[][]>([]);
	const [redoStack, setRedoStack] = useState<BestiaryMonster[][]>([]);
	const listRef = useRef<ReactList>(null);
	const customImportInputRef = useRef<HTMLInputElement>(null);
	const headerActionsRef = useRef<HTMLDivElement>(null);
	const selectedMonsterRef = useRef<BestiaryMonster | null>(null);
	const aiDraftResponseRef = useRef<HTMLDivElement>(null);
	const aiEditControllerRef = useRef<AbortController | null>(null);
	const openImagePromptForMonsterRef = useRef<((monster: BestiaryMonster) => void) | null>(null);
	const shouldAutoSelectMonsterRef = useRef(true);
	const pendingSyncSelectionRef = useRef<MonsterReference | null>(null);
	const embeddedScrolledMonsterRef = useRef("");
	const hasLoadedInitialMonstersRef = useRef(false);

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
		if (sourceFilter === "all") return lang.t("All sources");
		if (isCustomSource(sourceFilter)) return lang.t("Custom creatures");
		return formatSourceLabel(sourceFilter.replace(/^bestiary-/i, ""));
	}, [sourceFilter]);

	useEffect(() => {
		if (sourceFilter === "all") return;
		const selectedSourceSet = new Set(selectedSources.map(normalizeSourceCode));
		if (!selectedSourceSet.has(normalizeSourceCode(sourceFilter))) {
			setSourceFilter("all");
		}
	}, [selectedSources, sourceFilter]);

	useEffect(() => {
		selectedMonsterRef.current = selectedMonster;
	}, [selectedMonster]);

	useEffect(() => {
		setSearch(initialSearch);
	}, [initialSearch]);

	useEffect(() => {
		setIsDetailedSearch(Boolean(initialDetailedSearch));
	}, [initialDetailedSearch]);

	useEffect(() => {
		embeddedScrolledMonsterRef.current = "";
	}, [initialSelectedName, initialSelectedSource]);

	useEffect(() => {
		if (!isHeaderActionsOpen) return undefined;

		const handlePointerDown = (event: PointerEvent) => {
			if (
				event.target instanceof Node &&
				headerActionsRef.current?.contains(event.target)
			) return;
			setIsHeaderActionsOpen(false);
		};

		document.addEventListener("pointerdown", handlePointerDown);
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
		};
	}, [isHeaderActionsOpen]);

	useEffect(() => {
		return () => {
			aiEditControllerRef.current?.abort();
		};
	}, []);

	const displayedMonsters = useMemo(() => {
		return sortBestiaryMonsters(monsters, sortOrder);
	}, [monsters, sortOrder]);

	const customMonsters = useMemo(
		() => allMonsters.filter((monster) => isCustomSource(monster.source)),
		[allMonsters],
	);
	const aiDraftDiffResources = useMemo(
		() =>
			buildDiffResources(aiDraftResponseEntry, {
				creature: lang.t("Creature"),
			}),
		[aiDraftResponseEntry],
	);

	const pushCustomUndoSnapshot = (snapshot: BestiaryMonster[]) => {
		setUndoStack((current) =>
			addUndoSnapshot(current, snapshot, cloneCustomMonsters),
		);
		setRedoStack(clearRedoStack());
	};

	const pushCustomUndo = () => {
		pushCustomUndoSnapshot(customMonsters);
	};

	const applyCustomMonsterList = (
		nextCustomMonsters: BestiaryMonster[],
		options: ApplyCustomMonsterListOptions = {},
	) => {
		const selectedName = options.selectedName;
		const nextSelected = selectedName
			? nextCustomMonsters.find((monster) => monster.name === selectedName)
			: null;
		setAllMonsters((current) => [
			...current.filter((item) => !isCustomSource(item.source)),
			...nextCustomMonsters,
		]);
		if (nextSelected) {
			shouldAutoSelectMonsterRef.current = false;
			selectedMonsterRef.current = nextSelected;
			setSelectedMonster(nextSelected);
		} else if (options.clearSelection) {
			shouldAutoSelectMonsterRef.current = false;
			selectedMonsterRef.current = null;
			setSelectedMonster(null);
		}
	};

	const selectMonster = useCallback(
		(monster: BestiaryMonster | null) => {
			shouldAutoSelectMonsterRef.current = false;
			setSelectedMonster(monster);
			if (monster?.name) {
				onActiveMonsterChange?.(monster);
			}
		},
		[onActiveMonsterChange],
	);

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
				updateCampaign: api.updateCampaign,
				listCampaigns: api.listCampaigns,
				onCampaigns: (campaigns) =>
					dispatch(setCampaignsAction(campaigns)),
				updateSettings: api.updateSettings,
				onUiIgnoreSources: (ignoreSourcesList) =>
					dispatch(setUiSettingsAction({ ignoreSourcesList })),
				onLogError: (error) =>
					console.error("Failed to save ignored sources", error),
				onError: (error) => dispatch(
					alert({
						title: lang.t("Error"),
						message: getErrorMessage(error, lang.t("Unknown error")),
					}),
				),
			});
		},
		[activeCampaignSlug, dispatch, filterSourceOptions],
	);

	const restoreCustomMonsters = async (
		nextCustomMonsters: BestiaryMonster[],
		options: ApplyCustomMonsterListOptions = {},
	): Promise<BestiaryMonster[]> => {
		const updated = await api.replaceCustomBestiaryMonsters(nextCustomMonsters);
		const normalized = Array.isArray(updated) ? updated : [];
		applyCustomMonsterList(normalized, options);
		return normalized;
	};

	const handleUndo = async () => {
		if (undoStack.length === 0) return;
		const transition = createUndoTransition({
			undoStack,
			redoStack,
			current: customMonsters,
			clone: cloneCustomMonsters,
		});
		if (!transition.target) return;
		try {
			await restoreCustomMonsters(transition.target, { clearSelection: true });
			setUndoStack(transition.undoStack);
			setRedoStack(transition.redoStack);
		} catch (err) {
			dispatch(alert({
				title: lang.t("Undo error"),
				message: getErrorMessage(err, lang.t("Unknown error")),
			}));
		}
	};

	const handleRedo = async () => {
		if (redoStack.length === 0) return;
		const transition = createRedoTransition({
			undoStack,
			redoStack,
			current: customMonsters,
			clone: cloneCustomMonsters,
		});
		if (!transition.target) return;
		try {
			await restoreCustomMonsters(transition.target, { clearSelection: true });
			setRedoStack(transition.redoStack);
			setUndoStack(transition.undoStack);
		} catch (err) {
			dispatch(alert({
				title: lang.t("Redo error"),
				message: getErrorMessage(err, lang.t("Unknown error")),
			}));
		}
	};

	// Load available source files.
	useEffect(() => {
		const controller = new AbortController();
		const loadInitialData = async () => {
			try {
				const [sourcesData, legendaryData, favData] = await Promise.all([
					api.getBestiarySources({ signal: controller.signal }),
					api.getLegendaryGroups({ signal: controller.signal }),
					api.getBestiaryFavorites({ signal: controller.signal }),
				]);
				if (controller.signal.aborted) return;
				setSources(getBestiarySourceCodes(sourcesData));
				setLegendaryGroups(Array.isArray(legendaryData) ? legendaryData : []);
				setFavorites(Array.isArray(favData) ? favData : []);
			} catch (err) {
				if (isAbortError(err)) return;
				console.error(
					"Failed to load bestiary sources or legendary groups",
					err,
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
				api.getBestiaryFavorites({ signal: controller.signal }),
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

	// Load the full monster list once; sources are filtered locally after that.
	useEffect(() => {
		if (sources.length === 0) return;

		const controller = new AbortController();
		const loadData = async () => {
			setLoading(true);
			try {
				const [officialData, customData] = await Promise.all([
					api.getBestiaryData("all", { signal: controller.signal }),
					api.getCustomBestiaryData({ signal: controller.signal }),
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
				const customData = await api.getCustomBestiaryData({
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

	useEffect(() => {
		if (!aiEditingMonster || aiModels.length > 0) return;
		loadAiModelOptions({
			setAiModels,
			setSelectedAiModel,
			onError: (err: unknown) => {
				console.error("Failed to load AI models", err);
				setAiEditError(
					getErrorMessage(err, lang.t("Failed to connect to AI.")),
				);
			},
		});
	}, [aiEditingMonster, aiModels.length]);

	// Local search filtering.
	useEffect(() => {
		const filtered = filterBestiaryMonsters(allMonsters, {
			selectedSources,
			sourceFilter,
			onlyFavorites,
			favorites,
			search: debouncedSearch,
			isDetailedSearch,
			matchesDetailedSearch: objectMatchesSearch,
			matchesSimpleSearch: matchesMonsterSearch,
		});
		setMonsters(filtered);
	}, [
		debouncedSearch,
		allMonsters,
		onlyFavorites,
		favorites,
		selectedSources,
		sourceFilter,
		isDetailedSearch,
	]);

	const handleToggleFavorite = async (monster: BestiaryMonster) => {
		try {
			const newFavs = await api.toggleBestiaryFavorite(
				monster.name,
				String(monster.source ?? ""),
			);
			setFavorites(newFavs ?? []);
		} catch (err) {
			console.error("Failed to toggle favorite", err);
		}
	};

	const handleCustomBestiaryUpdate = (
		updated: unknown,
		options: CustomBestiaryUpdateOptions = {},
	) => {
		const plan = getCustomBestiaryUpdatePlan(updated, options);
		if (plan.trackUndo) {
			pushCustomUndo();
		}

		shouldAutoSelectMonsterRef.current = false;
		if (plan.hasUpdatedMonsters) {
			setAllMonsters((current) => [
				...current.filter((item) => !isCustomSource(item.source)),
				...plan.updatedMonsters,
			]);
		}
		if (plan.nextSelectedMonster) {
			selectedMonsterRef.current = plan.nextSelectedMonster;
			setSelectedMonster(plan.nextSelectedMonster);
		}
		setReloadToken((value) => value + 1);
	};

	const openEditMonster = (monster: BestiaryMonster) => {
		const plan = getBestiaryFieldEditStartPlan(
			monster,
			lang.t("Creature"),
			(target) => new MonsterStatBlockModel(target).localTokenSrc,
		);
		if (plan.kind === "skip") return;
		setFieldEditingMode(plan.mode);
		setFieldEditingOriginalMonster(plan.originalMonster);
		setFieldEditingMonster(plan.draftMonster);
	};

	const closeEditCustomMonster = () => {
		setFieldEditingMonster(null);
		setFieldEditingMode("edit");
		setFieldEditingOriginalMonster(null);
	};

	const openAiEditCustomMonster = (
		monster: BestiaryMonster,
		mode: MonsterAiEditMode = "edit",
	) => {
		if (!monster?.name) return;
		if (mode === "edit" && !isCustomSource(monster.source)) return;
		setAiEditMode(mode);
		setAiEditingMonster(monster);
		setAiEditInstructions("");
		setAiEditAttachedImages([]);
		setAiEditAttachedFiles([]);
		setAiEditError("");
	};

	const closeAiEditCustomMonster = () => {
		if (isAiEditingMonster) return;
		setAiEditingMonster(null);
		setAiEditMode("edit");
		setAiEditInstructions("");
		setAiEditAttachedImages([]);
		setAiEditAttachedFiles([]);
		setAiEditError("");
	};

	const cancelAiEditCustomMonsterRequest = () => {
		aiEditControllerRef.current?.abort();
	};

	const openMonsterAiAction = (monster: BestiaryMonster) => {
		if (!monster?.name) return;
		setAiActionMonster(monster);
	};

	const closeMonsterAiAction = () => {
		if (isAiEditingMonster) return;
		setAiActionMonster(null);
	};

	const chooseMonsterAiAction = (mode: MonsterAiAction) => {
		if (!aiActionMonster) return;
		const target = aiActionMonster;
		setAiActionMonster(null);
		if (mode === "image-prompt") {
			openImagePromptForMonsterRef.current?.(target);
			return;
		}
		openAiEditCustomMonster(target, mode);
	};

	const applyUpdatedCustomMonster = (
		previousName: string,
		updatedMonster: BestiaryMonster,
	) => {
		pushCustomUndoSnapshot(cloneCustomMonsters(customMonsters));
		shouldAutoSelectMonsterRef.current = false;
		setAllMonsters((current) => [
			...current.filter(
				(item) =>
					!isCustomSource(item.source) ||
					!(item.name === previousName || item.name === updatedMonster.name),
			),
			updatedMonster,
		]);
		setSelectedMonster(updatedMonster);
		selectedMonsterRef.current = updatedMonster;
		if (previousName !== updatedMonster.name) {
			setFavorites((current) =>
				current.map((favorite) =>
					favorite.name === previousName && isCustomSource(favorite.source)
						? { ...favorite, name: updatedMonster.name, source: "CUSTOM" }
						: favorite,
				),
			);
		}
	};

	const createBasedCustomMonster = async (
		draftMonster: BestiaryMonster,
	): Promise<BestiaryMonster> => {
		const customMonsters = getMonsterListFromResponse(
			await api.getCustomBestiaryData(),
		);
		const originalModel = new MonsterStatBlockModel(
			fieldEditingOriginalMonster ?? {},
		);
		const plan = getCreateBasedMonsterPlan(
			customMonsters,
			draftMonster,
			fieldEditingOriginalMonster,
			originalModel.localTokenSrc,
		);
		if (plan.duplicate) {
			throw new Error(
				lang.t("Custom creature with this name already exists."),
			);
		}
		const updated = await api.replaceCustomBestiaryMonsters([
			...customMonsters,
			plan.monster,
		]);
		return (
			(updated ?? []).find(
				(monster) => normalizeMonsterName(monster.name) === plan.normalizedName,
			) ?? plan.monster
		);
	};

	const updateEditedCustomMonster = async (
		draftMonster: BestiaryMonster,
		editingMonster: BestiaryMonster,
	): Promise<BestiaryMonster> => {
		const updated = await api.updateCustomBestiaryMonster(
			String(editingMonster.id || editingMonster.name),
			{
				monster: getEditedCustomMonsterPayload(
					draftMonster,
					editingMonster,
					fieldEditingOriginalMonster,
				),
			},
		);
		if (!updated) throw new Error(lang.t("Empty custom creature response."));
		return updated;
	};

	const saveEditedCustomMonster = async (draftMonster: BestiaryMonster) => {
		await executeBestiaryFieldEditSave({
			draftMonster,
			editingMonster: fieldEditingMonster,
			mode: fieldEditingMode,
			createBased: createBasedCustomMonster,
			update: updateEditedCustomMonster,
			onApplied: applyUpdatedCustomMonster,
			onClose: closeEditCustomMonster,
			onError: (error) => dispatch(alert({
				title: lang.t("Error"),
				message: getErrorMessage(error, lang.t("Unknown error")),
			})),
		});
	};

	const resetAiEditState = () => {
		setAiEditingMonster(null);
		setAiEditMode("edit");
		setAiEditInstructions("");
		setAiEditAttachedImages([]);
		setAiEditAttachedFiles([]);
	};

	const applyAiGenerationResult = (
		data: AiBestiaryGenerationResult,
		targetMonster: BestiaryMonster,
	) => {
		const plan = getAiMonsterGenerationResultPlan(
			data,
			targetMonster,
			aiEditMode,
		);
		if (plan.kind === "draft") {
			setAiDraftResponseEntry(plan.entry);
		} else if (plan.kind === "update") {
			handleCustomBestiaryUpdate(plan.updated, plan.options);
		}
	};

	const saveAiEditedCustomMonster = async () => {
		const startPlan = getAiMonsterEditStartPlan({
			targetMonster: aiEditingMonster,
			mode: aiEditMode,
			rawInstructions: aiEditInstructions,
			createInstruction: lang.t(
				"Create a new custom creature based on the selected creature. Do not change the selected creature.",
			),
			selectedModel: selectedAiModel,
			attachedImages: aiEditAttachedImages,
			attachedFiles: aiEditAttachedFiles,
			language: currentLanguage,
		});
		if (startPlan.kind === "skip") return;
		if (startPlan.kind === "invalid") {
			setAiEditError(lang.t("Describe what to change."));
			return;
		}

		setIsAiEditingMonster(true);
		setAiEditError("");
		const controller = new AbortController();
		aiEditControllerRef.current = controller;
		await executeAiMonsterEditRequest({
			plan: startPlan,
			signal: controller.signal,
			fallbackError: lang.t("Unknown error"),
			generateAi: api.generateAi,
			onApplied: applyAiGenerationResult,
			onReset: resetAiEditState,
			onError: setAiEditError,
			onSettled: () => {
				if (
					shouldClearAiMonsterEditController(
						aiEditControllerRef.current,
						controller,
					)
				) {
					aiEditControllerRef.current = null;
				}
				setIsAiEditingMonster(false);
			},
		});
	};

	const saveAiDraftResponseChanges = async (
		resources: AiHistoryResource[],
	): Promise<AiHistoryEntry | null> => {
		if (!aiDraftResponseEntry?.id) return null;
		const updatedEntry = await api.updateAiResponse(
			"bestiary",
			aiDraftResponseEntry.id,
			{
				resources: preserveAiDraftResourceMetadata(
					resources,
					aiDraftResponseEntry.changes?.resources,
				),
			},
		);
		if (updatedEntry) {
			setAiDraftResponseEntry(updatedEntry);
		}
		return updatedEntry;
	};

	const restoreAiDraftResponse = async (
		entry: AiHistoryEntry | null = aiDraftResponseEntry,
		mode: "apply" | "undo" = "apply",
		options: { resourceIds?: string[] } = {},
	) => {
		const start = getAiDraftRestoreStartPlan(
			entry,
			mode,
			options.resourceIds,
			isRestoringAiResponse,
			customMonsters,
		);
		await executeAiDraftRestore({
			start,
			onBusy: setIsRestoringAiResponse,
			apply: (restoreEntry, payload) =>
				api.applyAiResponse("bestiary", restoreEntry.id, payload),
			undo: (restoreEntry, payload) =>
				api.undoAiResponse("bestiary", restoreEntry.id, payload),
			onEntry: setAiDraftResponseEntry,
			onUndoSnapshot: pushCustomUndoSnapshot,
			onUpdate: handleCustomBestiaryUpdate,
			onError: (error) => {
				dispatch(
					alert({
						title: lang.t("AI history error"),
						message: getErrorMessage(error, lang.t("Unknown error")),
					}),
				);
			},
		});
	};

	const closeAiDraftResponse = () => {
		if (isRestoringAiResponse) return;
		setAiDraftResponseEntry(null);
	};

	const handleDeleteCustomMonster = async (monster: BestiaryMonster) => {
		const startPlan = getCustomMonsterDeleteStartPlan(monster);
		if (startPlan.kind === "skip") return;
		const confirmed = await dispatch(
			confirm({
				title: lang.t("Delete custom creature"),
				message: lang.t('Delete custom creature "{name}"?', {
					name: startPlan.monsterName,
				}),
			}),
		);
		if (!confirmed) return;

		const undoSnapshot = cloneCustomMonsters(customMonsters);
		try {
			const updatedCustomMonsters = await api.deleteCustomBestiaryMonster(
				startPlan.monsterName,
			);
			pushCustomUndoSnapshot(undoSnapshot);
			shouldAutoSelectMonsterRef.current = false;
			selectedMonsterRef.current = null;
			setSelectedMonster(null);
			setAllMonsters((current) =>
				replaceDeletedCustomMonsterList(current, updatedCustomMonsters),
			);
			setFavorites((current) =>
				removeDeletedCustomMonsterFavorite(current, startPlan.monsterName),
			);
		} catch (err) {
			dispatch(
				alert({
					title: lang.t("Delete error"),
					message: getErrorMessage(err, lang.t("Unknown error")),
				}),
			);
		}
	};

	const handleExportCustomMonsters = () => {
		downloadJsonFile(
			{
				version: 1,
				type: "custom-bestiary",
				exportedAt: new Date().toISOString(),
				monster: customMonsters,
			},
			`custom-bestiary-${new Date().toISOString().slice(0, 10)}.json`,
		);
	};

	const handleImportCustomMonsters = async (
		event: ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		try {
			const raw = await file.text();
			const validImported = parseImportedCustomMonsters(raw);
			if (validImported.length === 0) {
				throw new Error(lang.t("No custom creatures found in file."));
			}
			const undoSnapshot = cloneCustomMonsters(customMonsters);
			await restoreCustomMonsters(
				mergeImportedCustomMonsters(customMonsters, validImported),
				{
				selectedName: validImported[0].name,
				},
			);
			pushCustomUndoSnapshot(undoSnapshot);
			dispatch(
				alert({
					title: lang.t("Import custom creatures"),
					message: lang.t("Imported custom creatures: {count}", {
						count: validImported.length,
					}),
				}),
			);
		} catch (err) {
			dispatch(
				alert({
					title: lang.t("Import error"),
				message: getErrorMessage(err, lang.t("Unknown error")),
				}),
			);
		}
	};

	useEffect(() => {
		const plan = getBestiarySelectionPlan(
			displayedMonsters,
			allMonsters,
			initialMonsterReference,
			selectedMonsterRef.current,
			shouldAutoSelectMonsterRef.current,
		);
		if (!plan) return;
		if (isSameMonsterIdentity(selectedMonsterRef.current, plan.monster)) return;
		if (plan.explicit) shouldAutoSelectMonsterRef.current = false;
		selectedMonsterRef.current = plan.monster;
		setSelectedMonster(plan.monster);
	}, [
		allMonsters,
		displayedMonsters,
		initialMonsterReference,
	]);

	useEffect(() => {
		const plan = getBestiaryInitialSelectionScrollPlan(
			displayedMonsters,
			initialMonsterReference,
			selectedMonster,
			scrollToInitialSelected,
			embeddedScrolledMonsterRef.current,
		);
		if (!plan) return undefined;

		embeddedScrolledMonsterRef.current = plan.scrollKey;
		const frameId = requestAnimationFrame(() => {
			listRef.current?.scrollTo(plan.selectedIndex);
		});
		return () => cancelAnimationFrame(frameId);
	}, [
		displayedMonsters,
		initialMonsterReference,
		scrollToInitialSelected,
		selectedMonster,
	]);

	const toggleSort = () => {
		setSortOrder(getNextBestiarySortOrder);
	};

	const bestiaryActions = (
		<div
			ref={headerActionsRef}
			className={classNames("Bestiary__header_actions", {
				is_open: isHeaderActionsOpen,
			})}
		>
			<input
				ref={customImportInputRef}
				type="file"
				accept=".json"
				style={{ display: "none" }}
				onChange={handleImportCustomMonsters}
			/>
			<Button
				variant="ghost"
				size={Button.SIZES.SMALL}
				icon="menu"
				className="Bestiary__header_actionsToggle"
				onClick={() => setIsHeaderActionsOpen((value) => !value)}
				title={lang.t("Bestiary actions")}
			/>
			<div className="Bestiary__header_actionsMenu">
				<Button
					variant="ghost"
					size={Button.SIZES.MEDIUM}
					icon="import"
					onClick={() => {
						setIsHeaderActionsOpen(false);
						customImportInputRef.current?.click();
					}}
					title={lang.t("Import custom creatures")}
				>
					{lang.t("Import")}
				</Button>
				<Button
					variant="ghost"
					size={Button.SIZES.MEDIUM}
					icon="export"
					onClick={() => {
						setIsHeaderActionsOpen(false);
						handleExportCustomMonsters();
					}}
					disabled={customMonsters.length === 0}
					title={lang.t("Export custom creatures")}
				>
					{lang.t("Export")}
				</Button>
				<Button
					variant="ghost"
					size={Button.SIZES.MEDIUM}
					icon="undo"
					onClick={() => {
						setIsHeaderActionsOpen(false);
						handleUndo();
					}}
					disabled={undoStack.length === 0}
					title={lang.t("Undo (Ctrl+Z)")}
				/>
				<Button
					variant="ghost"
					size={Button.SIZES.MEDIUM}
					icon="redo"
					onClick={() => {
						setIsHeaderActionsOpen(false);
						handleRedo();
					}}
					disabled={redoStack.length === 0}
					title={lang.t("Redo (Ctrl+Y)")}
				/>
			</div>
		</div>
	);

	const bestiaryContent = (
		<BestiaryContent
			AiAssistantPanel={AiAssistantPanel}
			MonsterStatBlock={MonsterStatBlock}
			ResponseModal={ResponseModal}
			displayedMonsters={displayedMonsters}
			favorites={favorites}
			headerActions={bestiaryActions}
			hideSearchInput={hideSearchInput}
			isDetailedSearch={isDetailedSearch}
			listRef={listRef}
			loading={loading}
			onAddMonster={onAddMonster}
			onAiEditCustomMonster={openAiEditCustomMonster}
			onDeleteCustomMonster={handleDeleteCustomMonster}
			onEditMonster={openEditMonster}
			onFavoriteListChange={setFavorites}
			onMonsterAiAction={openMonsterAiAction}
			onRegisterImagePromptAction={(handler) => {
				openImagePromptForMonsterRef.current = handler;
			}}
			onSelectMonster={onSelectMonster}
			onToggleFavorite={handleToggleFavorite}
			onlyFavorites={onlyFavorites}
			search={search}
			searchHighlight={debouncedSearch}
			selectedMonster={selectedMonster}
			onSelectedSourcesChange={saveSelectedSources}
			onSourceFilterChange={setSourceFilter}
			setIsDetailedSearch={setIsDetailedSearch}
			setOnlyFavorites={setOnlyFavorites}
			setSearch={setSearch}
			setSelectedMonster={selectMonster}
			selectedSources={selectedSources}
			sourceFilter={sourceFilter}
			sourceFilterLabel={sourceFilterLabel}
			sortOrder={sortOrder}
			sourceOptions={sourceOptions}
			sources={sources}
			toggleSort={toggleSort}
		/>
	);

	const bestiaryModals = (
		<>
			<MonsterEditorModal
				editingMonster={fieldEditingMonster}
				onCancel={closeEditCustomMonster}
				onSave={saveEditedCustomMonster}
			/>
			<MonsterAiActionModal
				aiActionMonster={aiActionMonster}
				onCancel={closeMonsterAiAction}
				onChoose={chooseMonsterAiAction}
				showGlobalEdit={isCustomSource(aiActionMonster?.source)}
				showImagePromptAction
			/>
			<BestiaryAiModals
				ResponseModal={ResponseModal}
				aiDraftDiffResources={aiDraftDiffResources}
				aiDraftResponseEntry={aiDraftResponseEntry}
				aiDraftResponseRef={aiDraftResponseRef}
				aiEditAttachedFiles={aiEditAttachedFiles}
				aiEditAttachedImages={aiEditAttachedImages}
				aiEditingMonster={aiEditingMonster}
				aiEditError={aiEditError}
				aiEditInstructions={aiEditInstructions}
				aiEditMode={aiEditMode}
				aiModels={aiModels}
				getDiffResourceState={getDiffResourceState}
				getHistoryChangeSummary={getHistoryChangeSummary}
				isAiEditingMonster={isAiEditingMonster}
				isRestoringAiResponse={isRestoringAiResponse}
				onApplyDraft={(entry) => restoreAiDraftResponse(entry, "apply")}
				onApplyDraftResource={(entry, resourceIds) =>
					restoreAiDraftResponse(entry, "apply", { resourceIds })
				}
				onCancelDraft={closeAiDraftResponse}
				onCancelEdit={closeAiEditCustomMonster}
				onCancelEditRequest={cancelAiEditCustomMonsterRequest}
				onInstructionsChange={setAiEditInstructions}
				onModelChange={setSelectedAiModel}
				onSaveDraftChanges={saveAiDraftResponseChanges}
				onSaveEdit={saveAiEditedCustomMonster}
				onUndoDraft={(entry) => restoreAiDraftResponse(entry, "undo")}
				onUndoDraftResource={(entry, resourceIds) =>
					restoreAiDraftResponse(entry, "undo", { resourceIds })
				}
				selectedAiModel={selectedAiModel}
				setAiEditAttachedFiles={setAiEditAttachedFiles}
				setAiEditAttachedImages={setAiEditAttachedImages}
			/>
		</>
	);

	return (
		<>
			{bestiaryContent}
			{bestiaryModals}
		</>
	);
}
