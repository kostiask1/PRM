import {
	useState,
	useEffect,
	useMemo,
	useRef,
	useCallback,
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
import {
	getHistoryChangeSummary as getAiHistoryChangeSummary,
	getLocalizedDiffResourceState,
} from "../../../features/ai/index.js";
import "../../../assets/components/Bestiary.css";
import { lang } from "../../../shared/lib/index.js";
import {
	getBestiaryInitialSelectionScrollPlan,
	getBestiarySelectionPlan,
	isCustomSource,
	isSameMonsterIdentity,
	parseBestiarySyncEvent,
	parseMonsterReference,
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
import { useBestiaryCustomMonsterEditing } from "../model/useBestiaryCustomMonsterEditing.ts";
import { useBestiarySourceSelection } from "./useBestiarySourceSelection.ts";
import { useBestiarySearchControls } from "./useBestiarySearchControls.ts";
import { useBestiaryMonsterList } from "./useBestiaryMonsterList.ts";

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
	const [allMonsters, setAllMonsters] = useState<BestiaryMonster[]>([]);
	const [loading, setLoading] = useState(false);
	const [selectedMonster, setSelectedMonster] = useState<BestiaryMonster | null>(null);
	const [legendaryGroups, setLegendaryGroups] = useState<LegendaryGroup[]>([]);
	const [favorites, setFavorites] = useState<BestiaryFavorite[]>([]);
	const [reloadToken, setReloadToken] = useState(0);
	const listRef = useRef<ReactList>(null);
	const selectedMonsterRef = useRef<BestiaryMonster | null>(null);
	const aiDraftResponseRef = useRef<HTMLDivElement>(null);
	const aiEditControllerRef = useRef<AbortController | null>(null);
	const openImagePromptForMonsterRef = useRef<((monster: BestiaryMonster) => void) | null>(null);
	const shouldAutoSelectMonsterRef = useRef(true);
	const pendingSyncSelectionRef = useRef<MonsterReference | null>(null);
	const embeddedScrolledMonsterRef = useRef("");
	const hasLoadedInitialMonstersRef = useRef(false);


	useEffect(() => {
		selectedMonsterRef.current = selectedMonster;
	}, [selectedMonster]);

	const {
		debouncedSearch,
		isDetailedSearch,
		search,
		setIsDetailedSearch,
		setSearch,
	} = useBestiarySearchControls({
		initialDetailedSearch,
		initialSearch,
		useSearchDebounce,
	});

	useEffect(() => {
		embeddedScrolledMonsterRef.current = "";
	}, [initialSelectedName, initialSelectedSource]);

	useEffect(() => {
		return () => {
			aiEditControllerRef.current?.abort();
		};
	}, []);

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
	const {
		closeEditCustomMonster,
		fieldEditingMonster,
		handleDeleteCustomMonster,
		handleExportCustomMonsters,
		handleImportCustomMonsters,
		openEditMonster,
		saveEditedCustomMonster,
	} = useBestiaryCustomMonsterEditing({
		customMonsters,
		onPushCustomUndoSnapshot: pushCustomUndoSnapshot,
		onRestoreCustomMonsters: restoreCustomMonsters,
		requestConfirmation,
		selectedMonsterRef,
		setAllMonsters,
		setFavorites,
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

	const {
		filterSourceOptions,
		selectedSources,
		saveSelectedSources,
		sourceFilter,
		sourceFilterLabel,
		sourceOptions,
		setSourceFilter,
	} = useBestiarySourceSelection({
		activeCampaign,
		activeCampaignSlug,
		globalIgnoreSourcesList,
		listCampaigns: api.listCampaigns,
		onCampaigns: replaceCampaigns,
		onUiIgnoreSources: setGlobalIgnoreSourcesList,
		showError: (message) => showMessage({ title: lang.t("Error"), message }),
		shouldAutoSelectMonsterRef,
		sources,
		translate,
		updateCampaign: api.updateCampaign,
		updateSettings: api.updateSettings,
	});

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

	const {
		displayedMonsters,
		onlyFavorites,
		setOnlyFavorites,
		sortOrder,
		toggleSort,
	} = useBestiaryMonsterList({
		allMonsters,
		debouncedSearch,
		favorites,
		isDetailedSearch,
		selectedSources,
		sourceFilter,
	});

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
