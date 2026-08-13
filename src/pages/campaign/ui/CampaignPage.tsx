import {
	useEffect,
	useMemo,
	useState,
	type Dispatch,
	type ReactNode,
	type SetStateAction,
} from "react";
import {
	Button,
	Panel,
	Tooltip,
} from "../../../shared/ui/index.js";
import { EditableField } from "../../../features/editor/ui/index.js";
import { DraggableList, ListCard } from "../../../shared/ui/index.js";
import {
	AiContextIgnoreButton,
	BulkCollapseButton,
	useSimplifiedNotesEnabled,
} from "../../../features/notes/ui/index.js";
import {
	CharacterCard,
	CreateCharacterButton,
	CreateLocationButton,
	LocationCard,
} from "../../../widgets/campaign-entity-card/index.js";
import CampaignHeaderActions from "./components/CampaignHeaderActions.tsx";
import CampaignDescriptionSection from "./components/CampaignDescriptionSection.tsx";
import CampaignNotesSection from "./components/CampaignNotesSection.tsx";
import CampaignSessionsSection from "./components/CampaignSessionsSection.tsx";
import PartialArchiveModal from "./components/PartialArchiveModal.tsx";
import { GlobalSearchModal } from "../../../widgets/campaign-search/index.js";
import { CollapseToggleButton } from "../../../shared/ui/index.js";
import "../../../assets/components/CampaignView.css";
import useCampaignView from "../model/useCampaignView.ts";
import { useCampaignPageRuntime } from "../model/CampaignPageRuntime.tsx";
import { CampaignViewModel } from "../../../entities/campaign/index.js";
import { lang } from "../../../shared/lib/index.js";
import { getNotesForRender } from "../../../shared/lib/index.js";
import { makeDomId, scrollToHashTarget } from "../../../shared/lib/index.js";
import type { DomainId } from "../../../entities/campaign/index.js";
import type { CampaignPartialArchiveSection } from "../../../entities/campaign/index.js";
import type { CampaignPageCampaign, CampaignPageEntity } from "../model/contracts.ts";
import {
	filterCampaignSessions,
	executeCampaignHashNavigationPlan,
	getCampaignCharacterDropRequest,
	getCampaignEntityAiIgnoredUpdate,
	getCampaignEntityRenderKey,
	getCampaignHashNavigationPlan,
	getCampaignPageCampaign,
	getCampaignNotesViewModePlan,
	getCampaignSectionState,
	type CampaignEntitySectionType,
	type CampaignCharacterDropPayload,
	type CampaignNotesViewMode,
	type CampaignSessionItem,
} from "../model/campaignPagePresentation.ts";

interface CampaignDragDropDetail {
	payload?: CampaignCharacterDropPayload;
	clientX: number;
	clientY: number;
}

type CampaignViewController = ReturnType<typeof useCampaignView>;

interface CampaignHeaderProps {
	view: CampaignViewController;
	viewModel: CampaignViewModel;
	onOpenSearch: () => void;
	onOpenPartialArchive: () => void;
}

function CampaignHeader({
	view,
	viewModel,
	onOpenSearch,
	onOpenPartialArchive,
}: CampaignHeaderProps) {
	return (
		<div className="Panel__header">
			<div className="CampaignView__header">
				<Tooltip content={lang.t("Click to rename")}>
					<h2 className="editable_title" onClick={view.handleRename}>
						{viewModel.name}
					</h2>
				</Tooltip>
				<p className="muted">
					{lang.t("Created")}: {viewModel.createdAtLabel}
				</p>
			</div>
			<CampaignHeaderActions
				canRedo={view.redoStack.length > 0}
				canUndo={view.undoStack.length > 0}
				onDelete={() => view.handleDeleteCampaign()}
				onExport={() => view.handleExport()}
				onOpenPartialArchive={onOpenPartialArchive}
				onOpenSearch={onOpenSearch}
				onRedo={view.handleRedo}
				onUndo={view.handleUndo}
			/>
		</div>
	);
}

type CampaignCollapseField =
	| "isCharactersCollapsed"
	| "isNpcsCollapsed"
	| "isLocationsCollapsed";

interface CampaignEntitySectionProps {
	view: CampaignViewController;
	title: string;
	items: CampaignPageEntity[];
	entityType: CampaignEntitySectionType;
	collapseField: CampaignCollapseField;
	hasData: boolean;
	isCollapsed: boolean;
	setCollapsed: Dispatch<SetStateAction<boolean>>;
	listClassName: string;
	dropType?: "characters" | "npc";
	actions: ReactNode;
	dragData?: (entity: CampaignPageEntity) => unknown;
	renderItemControl?: (entity: CampaignPageEntity) => ReactNode;
	isItemControlActive?: (entity: CampaignPageEntity) => boolean;
	renderItem: (entity: CampaignPageEntity) => ReactNode;
	onReorder: (items: CampaignPageEntity[]) => void;
}

function CampaignEntitySection({
	view,
	title,
	items,
	entityType,
	collapseField,
	hasData,
	isCollapsed,
	setCollapsed,
	listClassName,
	dropType,
	actions,
	dragData,
	renderItemControl,
	isItemControlActive,
	renderItem,
	onReorder,
}: CampaignEntitySectionProps) {
	const toggle = () => {
		if (!hasData) return;
		const next = !isCollapsed;
		setCollapsed(next);
		view.triggerSave({ [collapseField]: next });
	};
	const collapseAll = (collapsed: boolean) => {
		const nextItems = items.map((item) => ({ ...item, collapsed }));
		onReorder(nextItems);
		view.persistEntitiesReorder(entityType, nextItems);
	};
	return (
		<div
			className="CampaignView__section"
			data-character-drop-type={dropType}
		>
			<div className="section_row">
				<div className="section_title_group" onClick={toggle}>
					{hasData && (
						<CollapseToggleButton
							size={Button.SIZES.MEDIUM}
							collapsed={isCollapsed}
							onClick={toggle}
						/>
					)}
					<h3>{title}</h3>
				</div>
				{!isCollapsed && (
					<div className="CampaignView__sectionActions">
						<BulkCollapseButton items={items} onChange={collapseAll} />
						{actions}
					</div>
				)}
			</div>
			{!isCollapsed && (
				<DraggableList
					items={items}
					className={listClassName}
					onReorder={onReorder}
					onDrop={(nextItems) =>
						view.persistEntitiesReorder(entityType, nextItems)
					}
					dragData={dragData}
					keyExtractor={(entity, index) =>
						getCampaignEntityRenderKey(entity, index)
					}
					renderItemControl={renderItemControl}
					isItemControlActive={isItemControlActive}
					renderItem={renderItem}
				/>
			)}
		</div>
	);
}

interface CampaignPageDialogsProps {
	view: CampaignViewController;
	isGlobalSearchOpen: boolean;
	onCloseGlobalSearch: () => void;
	isPartialArchiveOpen: boolean;
	onClosePartialArchive: () => void;
}

function CampaignPageDialogs({
	view,
	isGlobalSearchOpen,
	onCloseGlobalSearch,
	isPartialArchiveOpen,
	onClosePartialArchive,
}: CampaignPageDialogsProps) {
	const [isPartialArchiveBusy, setIsPartialArchiveBusy] = useState(false);
	const exportPartialArchive = async (
		sections: CampaignPartialArchiveSection[],
	) => {
		setIsPartialArchiveBusy(true);
		try {
			await view.handleExportPartial(sections);
		} finally {
			setIsPartialArchiveBusy(false);
		}
	};
	const importPartialArchive = async (
		file: File,
		sections: CampaignPartialArchiveSection[],
	) => {
		setIsPartialArchiveBusy(true);
		try {
			await view.handleImportPartial(file, sections);
			onClosePartialArchive();
		} finally {
			setIsPartialArchiveBusy(false);
		}
	};
	return (
		<>
			{isGlobalSearchOpen && (
				<GlobalSearchModal onCancel={onCloseGlobalSearch} />
			)}
			{isPartialArchiveOpen && (
				<PartialArchiveModal
					isBusy={isPartialArchiveBusy}
					onCancel={onClosePartialArchive}
					onExport={exportPartialArchive}
					onImport={importPartialArchive}
				/>
			)}
		</>
	);
}

function CampaignView({ campaign }: { campaign: CampaignPageCampaign }) {
	const { navigateToSession } = useCampaignPageRuntime();
	const view = useCampaignView({ campaign });
	const viewModel = new CampaignViewModel(campaign);
	const [sessionSearch, setSessionSearch] = useState("");
	const [notesViewMode, setNotesViewMode] =
		useState<CampaignNotesViewMode>("list");
	const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
	const [isPartialArchiveOpen, setIsPartialArchiveOpen] = useState(false);
	const simplifiedNotesEnabled = useSimplifiedNotesEnabled();
	const {
		hasDescriptionData,
		hasNotesData,
		hasCharactersData,
		hasNpcsData,
		hasLocationsData,
		isDescriptionCollapsed,
		isNotesCollapsed,
		isCharactersCollapsed,
		isNpcsCollapsed,
		isLocationsCollapsed,
	} = getCampaignSectionState(view);
	const notesForRender = getNotesForRender(view.notes || [], {
		simplifiedNotes: simplifiedNotesEnabled,
	});
	const toggleCampaignNoteAiIgnored = (noteId: DomainId, ignored: boolean) => {
		view.handleNotesReorder(
			view.notes.map((note) =>
				note.id === noteId ? { ...note, _aiIgnored: ignored } : note,
			),
		);
	};
	const toggleCampaignEntityAiIgnored = (
		type: "npc" | "locations",
		entityId: DomainId | undefined,
		ignored: boolean,
	) => {
		const update = getCampaignEntityAiIgnoredUpdate(
			type,
			entityId,
			ignored,
			view.npcs,
			view.locations,
		);
		if (update.kind === "none") return;
		const applyUpdate = update.kind === "locations"
			? view.handleLocationChange
			: view.handleNpcChange;
		applyUpdate(update.entityId, update.entity);
	};
	const filteredSessions = useMemo(
		() => filterCampaignSessions(view.sessions, sessionSearch),
		[view.sessions, sessionSearch],
	);

	const canReorderSessions = sessionSearch.trim().length === 0;
	const {
		setIsCharactersCollapsed,
		setIsLocationsCollapsed,
		setIsNotesCollapsed,
		setIsNpcsCollapsed,
	} = view;

	useEffect(() => {
		const hash = decodeURIComponent(window.location.hash || "");
		const plan = getCampaignHashNavigationPlan({
			hash,
			collapsed: {
				notes: isNotesCollapsed,
				characters: isCharactersCollapsed,
				npc: isNpcsCollapsed,
				locations: isLocationsCollapsed,
			},
		});
		const sectionSetters = {
			notes: setIsNotesCollapsed,
			characters: setIsCharactersCollapsed,
			npc: setIsNpcsCollapsed,
			locations: setIsLocationsCollapsed,
		};
		executeCampaignHashNavigationPlan(plan, {
			useListView: () => setNotesViewMode("list"),
			expandSection: (target) => sectionSetters[target](false),
		});
		const timer = window.setTimeout(() => scrollToHashTarget(), 120);
		return () => window.clearTimeout(timer);
	}, [
		campaign.slug,
		isCharactersCollapsed,
		isLocationsCollapsed,
		isNotesCollapsed,
		isNpcsCollapsed,
		notesForRender,
		setIsCharactersCollapsed,
		setIsLocationsCollapsed,
		setIsNotesCollapsed,
		setIsNpcsCollapsed,
	]);

	useEffect(() => {
		const handleCharacterDragDrop = (
			event: CustomEvent<CampaignDragDropDetail>,
		) => {
			const target = document.elementFromPoint(
				event.detail.clientX,
				event.detail.clientY,
			);
			const dropZone = target?.closest?.<HTMLElement>(
				"[data-character-drop-type]",
			);
			const targetType = dropZone?.dataset.characterDropType;
			const request = getCampaignCharacterDropRequest(
				event.detail?.payload,
				targetType,
			);
			if (request) view.handleCharacterTypeDrop(request);
		};

		window.addEventListener(
			"prm-draggable-list-drop",
			handleCharacterDragDrop as EventListener,
		);
		return () => {
			window.removeEventListener(
				"prm-draggable-list-drop",
				handleCharacterDragDrop as EventListener,
			);
		};
	}, [view]);

	const handleNotesViewModeChange = (mode: CampaignNotesViewMode) => {
		const plan = getCampaignNotesViewModePlan(mode, isNotesCollapsed);
		setNotesViewMode(plan.viewMode);
		if (!plan.collapsePatch) return;
		view.setIsNotesCollapsed(plan.collapsePatch.isNotesCollapsed);
		view.triggerSave(plan.collapsePatch);
	};

	const handleBulkNotesCollapse = (collapsed: boolean) => {
		view.handleNotesReorder(view.notes.map((note) => ({ ...note, collapsed })));
		view.finishTrackedReorder();
	};
	const toggleCampaignDescription = () => {
		if (!hasDescriptionData) return;
		const next = !isDescriptionCollapsed;
		view.setIsDescriptionCollapsed(next);
		view.triggerSave({ isDescriptionCollapsed: next });
	};
	const renderCampaignDescriptionEditor = () => (
		<EditableField
			type="textarea"
			className="CampaignView__script"
			enableHistory={false}
			placeholder={lang.t(
				"Describe the main plotline, key events, and goals...",
			)}
			value={view.description}
			onChange={view.handleDescriptionChange}
		/>
	);

	const renderSessionCard = (session: CampaignSessionItem) => (
		<ListCard
			key={session.fileName}
			className="CampaignView__sessionCard"
			href={viewModel.buildSessionHref(session.fileName)}
			onClick={() => navigateToSession(campaign.slug, session.fileName)}
			actions={
				<Button
					className="CampaignView__sessionDelete"
					variant="danger"
					icon="trash"
					size={Button.SIZES.SMALL}
					onClick={(e) => {
						e.stopPropagation();
						view.handleDeleteSession(session);
					}}
				/>
			}
		>
			<div className="ListCard__title">{session.name}</div>
		</ListCard>
	);

	return (
		<Panel className="CampaignView">
			<CampaignHeader
				view={view}
				viewModel={viewModel}
				onOpenSearch={() => setIsGlobalSearchOpen(true)}
				onOpenPartialArchive={() => setIsPartialArchiveOpen(true)}
			/>
			<div className="Panel__body">
				<div className="CampaignView__layout">
					<CampaignSessionsSection
						canReorderSessions={canReorderSessions}
						filteredSessions={filteredSessions}
						onCreateSession={view.handleCreateSession}
						onReorder={view.setSessions}
						onReorderDrop={view.handleSessionReorderDrop}
						onSessionSearchChange={setSessionSearch}
						renderSessionCard={renderSessionCard}
						sessionSearch={sessionSearch}
					/>

					<div className="CampaignView__contentPanel">
						<CampaignDescriptionSection
							hasData={hasDescriptionData}
							isCollapsed={isDescriptionCollapsed}
							onToggle={toggleCampaignDescription}
							renderEditor={renderCampaignDescriptionEditor}
						/>

						<CampaignNotesSection
							campaign={campaign}
							view={view}
							notes={notesForRender}
							hasData={hasNotesData}
							isCollapsed={isNotesCollapsed}
							viewMode={notesViewMode}
							onViewModeChange={handleNotesViewModeChange}
							onBulkCollapse={handleBulkNotesCollapse}
							onToggleIgnored={toggleCampaignNoteAiIgnored}
						/>

						<CampaignEntitySection
							view={view}
							title={lang.t("Characters")}
							items={view.characters}
							entityType="characters"
							collapseField="isCharactersCollapsed"
							hasData={hasCharactersData}
							isCollapsed={isCharactersCollapsed}
							setCollapsed={view.setIsCharactersCollapsed}
							listClassName="CampaignView__characters"
							dropType="characters"
							actions={
								<CreateCharacterButton
									campaignSlug={campaign.slug}
									entityType="characters"
								/>
							}
							onReorder={view.handleCharactersReorder}
							dragData={(character) => ({
								kind: "campaign-character",
								sourceType: "characters",
								id: character.id,
							})}
							renderItem={(character) => (
								<div id={makeDomId("campaign", "character", character.id)}>
									<CharacterCard
										character={character}
										onToggleCollapse={(id) => {
											if (id !== undefined) view.handleToggleCharacterCollapse(id);
										}}
										onChange={(id, updated, options) => {
											if (id !== undefined) view.handleCharacterChange(id, updated, options);
										}}
										onNameBlur={(id, updated, oldName, newName) =>
											id === undefined
												? false
												: view.handleCharacterNameBlur(id, updated, oldName, newName)
										}
										onDelete={(id) => {
											if (id !== undefined) void view.handleDeleteCharacter(id);
										}}
										onReorderDrop={view.finishTrackedReorder}
										campaignSlug={campaign.slug}
										enableHistory={false}
										type="characters"
									/>
								</div>
							)}
						/>

						<CampaignEntitySection
							view={view}
							title={lang.t("NPC")}
							items={view.npcs}
							entityType="npc"
							collapseField="isNpcsCollapsed"
							hasData={hasNpcsData}
							isCollapsed={isNpcsCollapsed}
							setCollapsed={view.setIsNpcsCollapsed}
							listClassName="CampaignView__characters"
							dropType="npc"
							actions={
								<CreateCharacterButton
									campaignSlug={campaign.slug}
									entityType="npc"
								/>
							}
							onReorder={view.handleNpcsReorder}
							dragData={(npc) => ({
								kind: "campaign-character",
								sourceType: "npc",
								id: npc.id,
							})}
							isItemControlActive={(npc) => Boolean(npc._aiIgnored)}
							renderItemControl={(npc) => (
								<AiContextIgnoreButton
									ignored={Boolean(npc._aiIgnored)}
									onToggle={(ignored) =>
										toggleCampaignEntityAiIgnored("npc", npc.id, ignored)
									}
								/>
							)}
							renderItem={(npc) => (
								<div id={makeDomId("campaign", "npc", npc.id)}>
									<CharacterCard
										character={npc}
										onToggleCollapse={(id) => {
											if (id !== undefined) view.handleToggleNpcCollapse(id);
										}}
										onChange={(id, updated, options) => {
											if (id !== undefined) view.handleNpcChange(id, updated, options);
										}}
										onNameBlur={(id, updated, oldName, newName) =>
											id === undefined
												? false
												: view.handleNpcNameBlur(id, updated, oldName, newName)
										}
										onDelete={(id) => {
											if (id !== undefined) void view.handleNpcDelete(id);
										}}
										onReorderDrop={view.finishTrackedReorder}
										campaignSlug={campaign.slug}
										enableHistory={false}
										type="npc"
									/>
								</div>
							)}
						/>

						<CampaignEntitySection
							view={view}
							title={lang.t("Locations/Factions")}
							items={view.locations}
							entityType="locations"
							collapseField="isLocationsCollapsed"
							hasData={hasLocationsData}
							isCollapsed={isLocationsCollapsed}
							setCollapsed={view.setIsLocationsCollapsed}
							listClassName="CampaignView__locations"
							actions={<CreateLocationButton campaignSlug={campaign.slug} />}
							onReorder={view.handleLocationsReorder}
							isItemControlActive={(location) =>
								Boolean(location._aiIgnored)
							}
							renderItemControl={(location) => (
								<AiContextIgnoreButton
									ignored={Boolean(location._aiIgnored)}
									onToggle={(ignored) =>
										toggleCampaignEntityAiIgnored(
											"locations",
											location.id,
											ignored,
										)
									}
								/>
							)}
							renderItem={(location) => (
								<div id={makeDomId("campaign", "location", location.id)}>
									<LocationCard
										location={location}
										onToggleCollapse={(id) => {
											if (id !== undefined) view.handleToggleLocationCollapse(id);
										}}
										onChange={(id, updated, options) => {
											if (id !== undefined) view.handleLocationChange(id, updated, options);
										}}
										onNameBlur={(id, updated, oldName, newName) =>
											id === undefined
												? false
												: view.handleLocationNameBlur(id, updated, oldName, newName)
										}
										onDelete={(id) => {
											if (id !== undefined) void view.handleLocationDelete(id);
										}}
										onReorderDrop={view.finishTrackedReorder}
										campaignSlug={campaign.slug}
										enableHistory={false}
									/>
								</div>
							)}
						/>
					</div>
				</div>
			</div>
			<CampaignPageDialogs
				view={view}
				isGlobalSearchOpen={isGlobalSearchOpen}
				onCloseGlobalSearch={() => setIsGlobalSearchOpen(false)}
				isPartialArchiveOpen={isPartialArchiveOpen}
				onClosePartialArchive={() => setIsPartialArchiveOpen(false)}
			/>
		</Panel>
	);
}

export default function CampaignPage() {
	const { activeCampaign } = useCampaignPageRuntime();
	const campaign = getCampaignPageCampaign(
		activeCampaign,
	);
	return campaign ? <CampaignView campaign={campaign} /> : null;
}
