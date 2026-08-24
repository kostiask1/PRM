import {
	useMemo,
	type ComponentType,
} from "react";
import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import type { AiResponseModalComponent } from "../../../features/ai/ui/index.js";
import type { MonsterFieldEditModalProps } from "../../../features/edit-monster/index.js";
import "../../../assets/components/Bestiary.css";
import {
	parseBestiarySyncEvent,
	parseMonsterReference,
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
import { useBestiaryMonsterSelectionState } from "./useBestiaryMonsterSelectionState.ts";
import { useBestiaryMonsterSelectionLifecycle } from "./useBestiaryMonsterSelectionLifecycle.ts";
import { useBestiaryFavoriteToggle } from "./useBestiaryFavoriteToggle.ts";
import { useBestiaryBrowserState } from "./useBestiaryBrowserState.ts";
import {
	bestiaryBrowserApi,
	getDiffResourceState,
	getHistoryChangeSummary,
	translate,
} from "./bestiaryBrowserDependencies.ts";
import { BestiaryBrowserModals } from "./BestiaryBrowserModals.tsx";
import { BestiaryBrowserContent } from "./BestiaryBrowserContent.tsx";

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
	const {
		aiDraftResponseRef,
		allMonsters,
		favorites,
		hasLoadedInitialMonstersRef,
		legendaryGroups,
		listRef,
		loading,
		openImagePromptForMonsterRef,
		pendingSyncSelectionRef,
		reloadToken,
		setAllMonsters,
		setFavorites,
		setLegendaryGroups,
		setLoading,
		setReloadToken,
		setSources,
		sources,
	} = useBestiaryBrowserState();

	const {
		embeddedScrolledMonsterRef,
		selectedMonster,
		selectedMonsterRef,
		selectMonster,
		setSelectedMonster,
		shouldAutoSelectMonsterRef,
	} = useBestiaryMonsterSelectionState({
		initialSelectedName,
		initialSelectedSource,
		onActiveMonsterChange,
	});

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
		listCampaigns: bestiaryBrowserApi.listCampaigns,
		onCampaigns: replaceCampaigns,
		onUiIgnoreSources: setGlobalIgnoreSourcesList,
		showError: (message) => showMessage({ title: translate("Error"), message }),
		shouldAutoSelectMonsterRef,
		sources,
		translate,
		updateCampaign: bestiaryBrowserApi.updateCampaign,
		updateSettings: bestiaryBrowserApi.updateSettings,
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

	const { handleToggleFavorite } = useBestiaryFavoriteToggle({
		setFavorites,
		toggleFavorite: bestiaryBrowserApi.toggleBestiaryFavorite,
	});

	useBestiaryMonsterSelectionLifecycle({
		allMonsters,
		displayedMonsters,
		embeddedScrolledMonsterRef,
		initialMonsterReference,
		listRef,
		scrollToInitialSelected,
		selectedMonster,
		selectedMonsterRef,
		setSelectedMonster,
		shouldAutoSelectMonsterRef,
	});

	return (
		<>
			<BestiaryBrowserContent
				AiAssistantPanel={AiAssistantPanel}
				MonsterStatBlock={MonsterStatBlock}
				ResponseModal={ResponseModal}
				canExport={customMonsters.length > 0}
				canRedo={redoStack.length > 0}
				canUndo={undoStack.length > 0}
				displayedMonsters={displayedMonsters}
				favorites={favorites}
				hideSearchInput={hideSearchInput}
				isDetailedSearch={isDetailedSearch}
				listRef={listRef}
				loading={loading}
				onAddMonster={onAddMonster}
				onAiEditCustomMonster={openAiEditCustomMonster}
				onDeleteCustomMonster={handleDeleteCustomMonster}
				onEditMonster={openEditMonster}
				onExport={handleExportCustomMonsters}
				onFavoriteListChange={setFavorites}
				onImport={handleImportCustomMonsters}
				onMonsterAiAction={openMonsterAiAction}
				onRedo={handleRedo}
				onRegisterImagePromptAction={(handler) => {
					openImagePromptForMonsterRef.current = handler;
				}}
				onSelectMonster={onSelectMonster}
				onToggleFavorite={handleToggleFavorite}
				onUndo={handleUndo}
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
			<BestiaryBrowserModals
				BestiaryAiModals={BestiaryAiModals}
				MonsterEditorModal={MonsterEditorModal}
				ResponseModal={ResponseModal}
				aiActionMonster={aiActionMonster}
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
				fieldEditingMonster={fieldEditingMonster}
				getDiffResourceState={getDiffResourceState}
				getHistoryChangeSummary={getHistoryChangeSummary}
				isAiEditingMonster={isAiEditingMonster}
				isRestoringAiResponse={isRestoringAiResponse}
				onCancelDraft={closeAiDraftResponse}
				onCancelEdit={closeAiEditCustomMonster}
				onCancelEditCustomMonster={closeEditCustomMonster}
				onCancelEditRequest={cancelAiEditCustomMonsterRequest}
				onCancelMonsterAiAction={closeMonsterAiAction}
				onChooseMonsterAiAction={chooseMonsterAiAction}
				onInstructionsChange={setAiEditInstructions}
				onModelChange={setSelectedAiModel}
				onRestoreAiDraftResponse={restoreAiDraftResponse}
				onSaveDraftChanges={saveAiDraftResponseChanges}
				onSaveEdit={saveAiEditedCustomMonster}
				onSaveEditedCustomMonster={saveEditedCustomMonster}
				selectedAiModel={selectedAiModel}
				setAiEditAttachedFiles={setAiEditAttachedFiles}
				setAiEditAttachedImages={setAiEditAttachedImages}
			/>
		</>
	);
}
