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
import type {
	AiHistoryEntry,
	AiHistoryResource,
} from "../../../features/ai/index.js";
import type { AiResponseModalComponent } from "../../../features/ai/ui/index.js";
import type { MonsterFieldEditModalProps } from "../../../features/edit-monster/index.js";
import { settingsApi } from "../../../features/settings/index.js";
import { MonsterAiActionModal } from "../../../features/ai-edit-monster/index.js";
import BestiaryContent from "./BestiaryContent.tsx";
import BestiaryHeaderActions from "./BestiaryHeaderActions.tsx";
import { MonsterStatBlockModel } from "../../../entities/bestiary/index.js";
import { useDebounce } from "../../../shared/lib/index.js";
import {
	getHistoryChangeSummary as getAiHistoryChangeSummary,
	getLocalizedDiffResourceState,
} from "../../../features/ai/index.js";
import { matchesMonsterSearch } from "../../../entities/bestiary/index.js";
import { objectMatchesSearch } from "../../../shared/lib/index.js";
import {
	getCampaignIgnoreSourcesList,
	getIgnoreSourcesListFromSelectedSources,
	getSelectedSourcesFromIgnoreList,
	normalizeSourceCode,
} from "../../../entities/reference/index.js";
import { formatSourceLabel } from "../../../entities/reference/index.js";
import { downloadJsonFile } from "../../../shared/lib/index.js";
import "../../../assets/components/Bestiary.css";
import { lang } from "../../../shared/lib/index.js";
import {
	cloneCustomMonsters,
	executeBestiaryFieldEditSave,
	executeBestiarySelectedSourcesSave,
	filterBestiaryMonsters,
	getBestiaryInitialSelectionScrollPlan,
	getBestiaryFieldEditStartPlan,
	getBestiarySelectionPlan,
	getCreateBasedMonsterPlan,
	getCustomMonsterDeleteStartPlan,
	getEditedCustomMonsterPayload,
	getMonsterListFromResponse,
	getNextBestiarySortOrder,
	isCustomSource,
	isSameMonsterIdentity,
	mergeImportedCustomMonsters,
	normalizeMonsterName,
	parseImportedCustomMonsters,
	parseBestiarySyncEvent,
	parseMonsterReference,
	removeDeletedCustomMonsterFavorite,
	replaceDeletedCustomMonsterList,
	sortBestiaryMonsters,
	type BestiarySortOrder,
	type MonsterReference,
} from "../model.js";
import type {
	BestiaryAiModalsSlot,
	BestiaryAssistantSlot,
	BestiaryMonsterStatBlockSlot,
} from "./bestiaryComposition.ts";
import { useBestiaryBrowserRuntime } from "./BestiaryBrowserRuntime.tsx";
import { useBestiaryDataLoading } from "../model/useBestiaryDataLoading.ts";
import { useBestiaryAiWorkflows } from "../model/useBestiaryAiWorkflows.ts";
import { useBestiaryCustomMonsterHistory } from "../model/useBestiaryCustomMonsterHistory.ts";

const api = { ...campaignApi, ...bestiaryApi, ...settingsApi };

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

export interface BestiaryBrowserProps {
	BestiaryAiModals: BestiaryAiModalsSlot;
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
	BestiaryAiModals,
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
	const {
		activeCampaign,
		activeCampaignSlug,
		currentLanguage,
		globalIgnoreSourcesList,
		requestConfirmation,
		replaceCampaigns,
		showMessage,
		setGlobalIgnoreSourcesList,
		syncEvent: rawSyncEvent,
		useSearchDebounce,
	} = useBestiaryBrowserRuntime();
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
	const listRef = useRef<ReactList>(null);
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
		return () => {
			aiEditControllerRef.current?.abort();
		};
	}, []);

	const displayedMonsters = useMemo(() => {
		return sortBestiaryMonsters(monsters, sortOrder);
	}, [monsters, sortOrder]);

	const {
		customMonsters,
		handleCustomBestiaryUpdate,
		handleRedo,
		handleUndo,
		pushCustomUndoSnapshot,
		redoStack,
		restoreCustomMonsters,
		undoStack,
	} = useBestiaryCustomMonsterHistory({
		allMonsters,
		selectedMonsterRef,
		setAllMonsters,
		setReloadToken,
		setSelectedMonster,
		shouldAutoSelectMonsterRef,
		showMessage,
	});

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
				onCampaigns: replaceCampaigns,
				updateSettings: api.updateSettings,
				onUiIgnoreSources: setGlobalIgnoreSourcesList,
				onLogError: (error) =>
					console.error("Failed to save ignored sources", error),
				onError: (error) =>
					showMessage({
						title: lang.t("Error"),
						message: getErrorMessage(error, lang.t("Unknown error")),
					}),
			});
		},
		[
			activeCampaignSlug,
			filterSourceOptions,
			replaceCampaigns,
			showMessage,
			setGlobalIgnoreSourcesList,
		],
	);

	useBestiaryDataLoading({
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
		syncEvent,
	});

	const {
		aiActionMonster,
		aiDraftDiffResources,
		aiDraftResponseEntry,
		aiEditAttachedFiles,
		aiEditAttachedImages,
		aiEditError,
		aiEditInstructions,
		aiEditMode,
		aiEditingMonster,
		aiModels,
		cancelAiEditCustomMonsterRequest,
		chooseMonsterAiAction,
		closeAiDraftResponse,
		closeAiEditCustomMonster,
		closeMonsterAiAction,
		isAiEditingMonster,
		isRestoringAiResponse,
		openAiEditCustomMonster,
		openMonsterAiAction,
		restoreAiDraftResponse,
		saveAiDraftResponseChanges,
		saveAiEditedCustomMonster,
		selectedAiModel,
		setAiEditAttachedFiles,
		setAiEditAttachedImages,
		setAiEditInstructions,
		setSelectedAiModel,
	} = useBestiaryAiWorkflows({
		aiEditControllerRef,
		currentLanguage,
		customMonsters,
		onCustomBestiaryUpdate: handleCustomBestiaryUpdate,
		onOpenImagePrompt: (monster) => {
			openImagePromptForMonsterRef.current?.(monster);
		},
		onPushCustomUndoSnapshot: pushCustomUndoSnapshot,
		showMessage,
	});

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
			onError: (error) => showMessage({
				title: lang.t("Error"),
				message: getErrorMessage(error, lang.t("Unknown error")),
			}),
		});
	};

	const handleDeleteCustomMonster = async (monster: BestiaryMonster) => {
		const startPlan = getCustomMonsterDeleteStartPlan(monster);
		if (startPlan.kind === "skip") return;
		const confirmed = await requestConfirmation({
			title: lang.t("Delete custom creature"),
			message: lang.t('Delete custom creature "{name}"?', {
				name: startPlan.monsterName,
			}),
		});
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
			showMessage({
				title: lang.t("Delete error"),
				message: getErrorMessage(err, lang.t("Unknown error")),
			});
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
			showMessage({
				title: lang.t("Import custom creatures"),
				message: lang.t("Imported custom creatures: {count}", {
					count: validImported.length,
				}),
			});
		} catch (err) {
			showMessage({
				title: lang.t("Import error"),
				message: getErrorMessage(err, lang.t("Unknown error")),
			});
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
		<BestiaryHeaderActions
			canExport={customMonsters.length > 0}
			canRedo={redoStack.length > 0}
			canUndo={undoStack.length > 0}
			onExport={handleExportCustomMonsters}
			onImport={handleImportCustomMonsters}
			onRedo={handleRedo}
			onUndo={handleUndo}
		/>
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
