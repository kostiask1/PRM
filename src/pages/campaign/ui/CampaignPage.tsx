import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type Dispatch,
	type ReactNode,
	type RefObject,
	type SetStateAction,
} from "react";
import { Button, Panel, Tooltip } from "../../../shared/ui/index.js";
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
import CampaignNotesSection from "./components/CampaignNotesSection.tsx";
import PartialArchiveModal from "./components/PartialArchiveModal.tsx";
import { GlobalSearchModal } from "../../../widgets/campaign-search/index.js";
import { CollapseToggleButton } from "../../../shared/ui/index.js";
import "../../../assets/components/CampaignView.css";
import useCampaignView from "../model/useCampaignView.ts";
import { CampaignViewModel } from "../../../entities/campaign/index.js";
import { navigateTo, useAppSelector } from "../../../shared/model/index.js";
import { lang } from "../../../shared/lib/index.js";
import {
	classNames,
	getNotesForRender,
} from "../../../shared/lib/index.js";
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
	headerActionsRef: RefObject<HTMLDivElement | null>;
	isHeaderActionsOpen: boolean;
	setIsHeaderActionsOpen: Dispatch<SetStateAction<boolean>>;
	onOpenSearch: () => void;
	onOpenPartialArchive: () => void;
}

function CampaignHeader({
	view,
	viewModel,
	headerActionsRef,
	isHeaderActionsOpen,
	setIsHeaderActionsOpen,
	onOpenSearch,
	onOpenPartialArchive,
}: CampaignHeaderProps) {
	const closeActions = () => setIsHeaderActionsOpen(false);
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
			<div
				ref={headerActionsRef as RefObject<HTMLDivElement>}
				className={classNames("CampaignView__headerActions", {
					is_open: isHeaderActionsOpen,
				})}
			>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="search"
					onClick={onOpenSearch}
					title={lang.t("Global search")}
				>
					{lang.t("Search")}
				</Button>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="undo"
					onClick={view.handleUndo}
					disabled={view.undoStack.length === 0}
					title={lang.t("Undo (Ctrl+Z)")}
				/>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="redo"
					onClick={view.handleRedo}
					disabled={view.redoStack.length === 0}
					title={lang.t("Redo (Ctrl+Y)")}
				/>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="menu"
					className="CampaignView__headerActionsToggle"
					onClick={() => setIsHeaderActionsOpen((value) => !value)}
					title={lang.t("Campaign actions")}
				/>
				<div className="CampaignView__headerActionsMenu">
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						onClick={() => {
							closeActions();
							view.handleExport();
						}}
						icon="export"
					>
						{lang.t("Export")}
					</Button>
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="database"
						onClick={() => {
							closeActions();
							onOpenPartialArchive();
						}}
					>
						{lang.t("Import/export parts")}
					</Button>
					<Button
						variant="danger"
						size={Button.SIZES.SMALL}
						icon="trash"
						onClick={() => {
							closeActions();
							view.handleDeleteCampaign();
						}}
					>
						{lang.t("Delete")}
					</Button>
				</div>
			</div>
		</div>
	);
}

interface CampaignSessionsSectionProps {
	view: CampaignViewController;
	sessionSearch: string;
	setSessionSearch: Dispatch<SetStateAction<string>>;
	filteredSessions: CampaignSessionItem[];
	canReorderSessions: boolean;
	renderSessionCard: (session: CampaignSessionItem) => ReactNode;
}

function CampaignSessionsSection({
	view,
	sessionSearch,
	setSessionSearch,
	filteredSessions,
	canReorderSessions,
	renderSessionCard,
}: CampaignSessionsSectionProps) {
	return (
		<aside className="CampaignView__sessionsPane" id="campaign-sessions">
			<div className="CampaignView__sessionsPaneHeader">
				<h3>{lang.t("Sessions")}</h3>
				<Button
					variant="create"
					onClick={view.handleCreateSession}
					icon="plus"
					size={Button.SIZES.SMALL}
				>
					{lang.t("New session")}
				</Button>
			</div>
			<div className="CampaignView__sessionsPaneControls">
				<input
					className="CampaignView__sessionSearch"
					placeholder={lang.t("Search sessions...")}
					value={sessionSearch}
					onChange={(event) => setSessionSearch(event.target.value)}
				/>
			</div>
			<div className="CampaignView__sessionsPaneList">
				{canReorderSessions ? (
					<DraggableList
						items={filteredSessions}
						onReorder={view.setSessions}
						onDrop={view.handleSessionReorderDrop}
						keyExtractor={(session) => session.fileName}
						renderItem={renderSessionCard}
					/>
				) : (
					<div className="CampaignView__sessions">
						{filteredSessions.map(renderSessionCard)}
					</div>
				)}
				{filteredSessions.length === 0 && (
					<div className="muted CampaignView__emptySessions">
						{lang.t("No sessions found.")}
					</div>
				)}
			</div>
		</aside>
	);
}

interface CampaignDescriptionSectionProps {
	view: CampaignViewController;
	hasData: boolean;
	isCollapsed: boolean;
}

function CampaignDescriptionSection({
	view,
	hasData,
	isCollapsed,
}: CampaignDescriptionSectionProps) {
	const toggle = () => {
		if (!hasData) return;
		const next = !isCollapsed;
		view.setIsDescriptionCollapsed(next);
		view.triggerSave({ isDescriptionCollapsed: next });
	};
	return (
		<div className="CampaignView__section" id={makeDomId("campaign", "description")}>
			<div className="section_row">
				<div className="section_title_group" onClick={toggle}>
					{hasData && (
						<CollapseToggleButton
							size={Button.SIZES.MEDIUM}
							collapsed={isCollapsed}
							onClick={toggle}
						/>
					)}
					<h3>{lang.t("Campaign story")}</h3>
				</div>
			</div>
			{!isCollapsed && (
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
			)}
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
	const view = useCampaignView({ campaign });
	const viewModel = new CampaignViewModel(campaign);
	const [sessionSearch, setSessionSearch] = useState("");
	const [notesViewMode, setNotesViewMode] =
		useState<CampaignNotesViewMode>("list");
	const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
	const [isPartialArchiveOpen, setIsPartialArchiveOpen] = useState(false);
	const [isHeaderActionsOpen, setIsHeaderActionsOpen] = useState(false);
	const headerActionsRef = useRef<HTMLDivElement | null>(null);
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

	useEffect(() => {
		if (!isHeaderActionsOpen) return undefined;

		const handlePointerDown = (event: PointerEvent) => {
			if (
				event.target instanceof Node &&
				headerActionsRef.current?.contains(event.target)
			)
				return;
			setIsHeaderActionsOpen(false);
		};

		document.addEventListener("pointerdown", handlePointerDown);
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
		};
	}, [isHeaderActionsOpen]);

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

	const renderSessionCard = (session: CampaignSessionItem) => (
		<ListCard
			key={session.fileName}
			className="CampaignView__sessionCard"
			href={viewModel.buildSessionHref(session.fileName)}
			onClick={() => navigateTo(campaign.slug, session.fileName)}
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
				headerActionsRef={headerActionsRef}
				isHeaderActionsOpen={isHeaderActionsOpen}
				setIsHeaderActionsOpen={setIsHeaderActionsOpen}
				onOpenSearch={() => setIsGlobalSearchOpen(true)}
				onOpenPartialArchive={() => setIsPartialArchiveOpen(true)}
			/>
			<div className="Panel__body">
				<div className="CampaignView__layout">
					<CampaignSessionsSection
						view={view}
						sessionSearch={sessionSearch}
						setSessionSearch={setSessionSearch}
						filteredSessions={filteredSessions}
						canReorderSessions={canReorderSessions}
						renderSessionCard={renderSessionCard}
					/>

					<div className="CampaignView__contentPanel">
						<CampaignDescriptionSection
							view={view}
							hasData={hasDescriptionData}
							isCollapsed={isDescriptionCollapsed}
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
	const campaign = getCampaignPageCampaign(
		useAppSelector((state) => state.active.campaign),
	);
	return campaign ? <CampaignView campaign={campaign} /> : null;
}
